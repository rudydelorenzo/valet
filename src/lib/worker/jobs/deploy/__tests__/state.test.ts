import { describe, it, expect } from "vitest";
import {
  classifyEvidence,
  watchVerdict,
  resumePath,
  progressStep,
  snapshotFromSteps,
  statusFromSteps,
  isPastDeadline,
  inactiveMessage,
  timeoutMessage,
  deploymentErrorMessage,
  updateErrorMessage,
  type StackView,
  type ContainerView,
} from "../state";
import { stateOfStep, stepsOfState } from "@/lib/utils";
import { EVENT_STEPS, type EventStepName, type EventState } from "@/lib/constants";
import type { DeploySnapshot, EventStep } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────

const snapshot = (over: Partial<DeploySnapshot> = {}): DeploySnapshot => ({
  at: 1_000_000,
  updateDate: 1_000, // Portainer clock, pre-PUT baseline
  containers: [
    { id: "aaa", created: 900, imageId: "sha256:aaa" },
    { id: "bbb", created: 950, imageId: "sha256:bbb" },
  ],
  ...over,
});

const stack = (over: Partial<StackView> = {}): StackView => ({
  status: 1,
  updateDate: 1_000,
  deploymentStatus: null,
  ...over,
});

const containers = (list: Partial<ContainerView>[]): ContainerView[] =>
  list.map((c, i) => ({ id: `c${i}`, created: 0, imageId: "", ...c }));

const BASE = { snapshot: snapshot(), stack: stack(), containers: containers([]) };

// ── classifyEvidence ────────────────────────────────────────────────

describe("classifyEvidence", () => {
  it("rung 2: a container not in the snapshot means the stack was recreated", () => {
    const evidence = classifyEvidence({
      ...BASE,
      containers: containers([{ id: "brand-new-container" }]),
    });
    expect(evidence.kind).toBe("applied");
  });

  it("rung 2: same container Id with a different image digest means recreation", () => {
    const evidence = classifyEvidence({
      ...BASE,
      containers: containers([{ id: "aaa", imageId: "sha256:changed" }]),
    });
    expect(evidence.kind).toBe("applied");
  });

  it("rung 3: UpdateDate bumped proves the PUT landed even without recreation (no-op redeploy)", () => {
    const evidence = classifyEvidence({
      ...BASE,
      stack: stack({ updateDate: 1_200 }), // bumped after the PUT
      containers: containers([{ id: "aaa", imageId: "sha256:aaa" }]), // nothing recreated
    });
    expect(evidence.kind).toBe("applied");
  });

  it("rung 1: journal ending in active after the baseline is proof", () => {
    const evidence = classifyEvidence({
      ...BASE,
      stack: stack({
        deploymentStatus: [{ Status: 3, Time: 1_100 }, { Status: 1, Time: 1_150 }],
      }),
    });
    expect(evidence.kind).toBe("applied");
  });

  it("rung 1: journal ending in error is a failure, carrying Portainer's message", () => {
    const evidence = classifyEvidence({
      ...BASE,
      stack: stack({
        deploymentStatus: [
          { Status: 3, Time: 1_100 },
          { Status: 4, Time: 1_150, Message: "pull access denied" },
        ],
      }),
    });
    expect(evidence).toEqual({ kind: "failed", message: "pull access denied" });
  });

  it("rung 1: a stale journal (older than the baseline) is ignored", () => {
    const evidence = classifyEvidence({
      ...BASE,
      stack: stack({
        deploymentStatus: [{ Status: 1, Time: 500 }], // before updateDate=1000
      }),
    });
    expect(evidence.kind).toBe("unconfirmed");
  });

  it("rung 1: the journal is skipped entirely when the baseline updateDate is 0", () => {
    const evidence = classifyEvidence({
      ...BASE,
      snapshot: snapshot({ updateDate: 0 }),
      stack: stack({
        updateDate: 0,
        deploymentStatus: [{ Status: 1, Time: 500 }], // stale journal would otherwise match
      }),
    });
    expect(evidence.kind).toBe("unconfirmed");
  });

  it("nothing changed → unconfirmed", () => {
    const evidence = classifyEvidence({
      ...BASE,
      containers: containers([
        { id: "aaa", imageId: "sha256:aaa" },
        { id: "bbb", imageId: "sha256:bbb" },
      ]),
    });
    expect(evidence.kind).toBe("unconfirmed");
  });

  it("no snapshot → unconfirmed (the deadline resolves it)", () => {
    const evidence = classifyEvidence({ ...BASE, snapshot: null });
    expect(evidence.kind).toBe("unconfirmed");
  });
});

// ── watchVerdict ────────────────────────────────────────────────────

describe("watchVerdict", () => {
  const BASE_V = {
    step: "verifying" as const,
    stack: stack(),
    stackName: "my-stack",
    evidence: { kind: "unconfirmed" } as const,
  };

  it("inactive stack is an error naming the step, regardless of evidence", () => {
    const verdict = watchVerdict({
      ...BASE_V,
      stack: stack({ status: 2 }),
      evidence: { kind: "applied" },
    });
    expect(verdict).toEqual({
      kind: "error",
      message: inactiveMessage("verifying"),
    });
  });

  it("stack in error state → error with the journal message", () => {
    const verdict = watchVerdict({
      ...BASE_V,
      stack: stack({
        status: 4,
        deploymentStatus: [{ Status: 4, Time: 1, Message: "no such image" }],
      }),
    });
    expect(verdict).toEqual({ kind: "error", message: "no such image" });
  });

  it("status still deploying (3) → keep waiting", () => {
    const verdict = watchVerdict({ ...BASE_V, stack: stack({ status: 3 }) });
    expect(verdict.kind).toBe("wait");
  });

  it("unreachable stack this tick → keep waiting", () => {
    const verdict = watchVerdict({ ...BASE_V, stack: null });
    expect(verdict.kind).toBe("wait");
  });

  it("active + evidence applied → success", () => {
    const verdict = watchVerdict({
      ...BASE_V,
      evidence: { kind: "applied" },
    });
    expect(verdict).toEqual({
      kind: "success",
      message: 'Stack "my-stack" redeployed successfully',
    });
  });

  it("active without evidence never succeeds (witnessed PUT or not) — keeps watching until the deadline", () => {
    const verdict = watchVerdict({ ...BASE_V });
    expect(verdict.kind).toBe("wait");
  });

  it("evidence failed beats an active stack (the journal is the newer truth)", () => {
    const verdict = watchVerdict({
      ...BASE_V,
      evidence: { kind: "failed", message: "boom" },
    });
    expect(verdict).toEqual({ kind: "error", message: "boom" });
  });
});

// ── resumePath (the one-PUT invariant) ──────────────────────────────

describe("resumePath", () => {
  it("never allows re-entering the fetch-and-PUT path past the deploying write", () => {
    expect(resumePath("claimed")).toBe("fetch");
    expect(resumePath("fetching")).toBe("fetch");
    expect(resumePath("deploying")).toBe("watch");
    expect(resumePath("verifying")).toBe("watch");
  });

  it("a null step (pre-upgrade row) resumes like a fresh event", () => {
    expect(resumePath(null)).toBe("fetch");
  });
});

describe("progressStep", () => {
  it("ignores re-enqueue and re-claim rows after the crash point", () => {
    const steps = [
      { step: "created" },
      { step: "queued" },
      { step: "claimed" },
      { step: "fetching" },
      { step: "deploying" },
      { step: "queued" },
      { step: "claimed" },
    ];
    expect(progressStep(steps)).toBe("deploying");
  });

  it("resumes mid-fetch when that is the furthest work step", () => {
    const steps = [{ step: "fetching" }, { step: "queued" }, { step: "claimed" }];
    expect(progressStep(steps)).toBe("fetching");
  });

  it("birth-only logs start from created", () => {
    expect(
      progressStep([{ step: "created" }, { step: "queued" }, { step: "claimed" }]),
    ).toBe("created");
    expect(progressStep([])).toBe("created");
  });
});

describe("snapshotFromSteps", () => {
  const step = (s: EventStepName, data: EventStep["data"]): EventStep => ({
    step: s,
    createdAt: "2026-01-01T00:00:00.000Z",
    data,
  });

  it("extracts the deploying row's snapshot payload", () => {
    const snap = snapshot();
    const steps = [
      step("created", null),
      step("deploying", snap),
      step("verifying", null),
    ];
    expect(snapshotFromSteps(steps)).toEqual(snap);
  });

  it("returns null when no deploying row exists", () => {
    expect(snapshotFromSteps([step("created", null)])).toBeNull();
  });

  it("returns null when the payload is not a snapshot (lost/corrupted)", () => {
    expect(
      snapshotFromSteps([step("deploying", { message: "boom" })]),
    ).toBeNull();
    expect(snapshotFromSteps([step("deploying", null)])).toBeNull();
  });
});

describe("statusFromSteps", () => {
  it("maps the log's last row onto the lifecycle status", () => {
    const cases: Array<[EventStepName[], EventState]> = [
      [["created", "queued"], "queued"],
      [["created", "queued", "claimed"], "running"],
      [["created", "queued", "claimed", "fetching"], "running"],
      [["created", "queued", "claimed", "fetching", "deploying"], "running"],
      // re-enqueue + re-claim after a crash: still running
      [["created", "queued", "claimed", "fetching", "deploying", "queued", "claimed"], "running"],
      [["created", "queued", "claimed", "verifying"], "running"],
      [["created", "queued", "claimed", "fetching", "deploying", "verifying", "success"], "success"],
      [["created", "queued", "claimed", "fetching", "error"], "error"],
    ];
    for (const [steps, expected] of cases) {
      expect(statusFromSteps(steps.map((step) => ({ step })))).toBe(expected);
    }
  });
});

describe("WORK_STEPS", () => {
  it("is exactly the steps whose category is running", () => {
    expect(stepsOfState("running")).toEqual(["claimed", "fetching", "deploying", "verifying"]);
  });
});

describe("stateOfStep", () => {
  it("is the inverse of stepsOfState for every step", () => {
    for (const step of Object.values(EVENT_STEPS)) {
      expect(stepsOfState(stateOfStep(step))).toContain(step);
    }
  });
});

// ── deadline ────────────────────────────────────────────────────────

describe("isPastDeadline", () => {
  it("times out strictly from the processing-window start (claim)", () => {
    expect(isPastDeadline(99_999, 0, 100)).toBe(false);
    expect(isPastDeadline(100_000, 0, 100)).toBe(true);
  });
});

// ── messages ────────────────────────────────────────────────────────

describe("messages", () => {
  it("inactive message names the step", () => {
    expect(inactiveMessage("deploying")).toContain("step: deploying");
  });

  it("timeout message names the limit and last step", () => {
    const msg = timeoutMessage(300, "verifying");
    expect(msg).toContain("300s");
    expect(msg).toContain("verifying");
    expect(timeoutMessage(300, null)).toContain("unknown");
  });

  it("deployment error prefers the journal message", () => {
    expect(
      deploymentErrorMessage(
        stack({ deploymentStatus: [{ Status: 4, Time: 1, Message: "boom" }] }),
      ),
    ).toBe("boom");
    expect(deploymentErrorMessage(stack())).toBe("Stack deployment failed");
  });
});

describe("updateErrorMessage", () => {
  it("maps status codes with known semantics to specific messages", () => {
    expect(updateErrorMessage(400, "bad env")).toBe(
      "Portainer rejected the stack update: bad env",
    );
    expect(updateErrorMessage(403, "denied")).toBe(
      "Portainer denied the update — check the API key's permissions",
    );
    expect(updateErrorMessage(404, "gone")).toBe(
      "Stack not found — it may have been deleted",
    );
    expect(updateErrorMessage(409, "busy")).toBe(
      "Stack deployment is already in progress — try again shortly",
    );
  });

  it("falls back to the raw Portainer payload", () => {
    expect(updateErrorMessage(500, "boom")).toBe("Portainer API 500: boom");
  });
});
