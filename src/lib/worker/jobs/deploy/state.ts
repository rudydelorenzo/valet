/**
 * Pure decision logic for the deploy state machine. No DB, no network
 * calls in this file. `index.ts` (the job) does all I/O and consults
 * these functions for every transition.
 *
 * ────── There are two key rules that make the design work and ──────
 * ────── that give the state machine the ability to resume if ───────
 * ───────────────────── the process is killed ───────────────────────
 *
 * 1. ONE PUT PER EVENT.
 *    The redeployment command sequence is not idempotent. Sending the
 *    redeploy PUT twice can make the container update to a later
 *    version than intended. Thus, it is imperative that we only send the
 *    PUT once. In fact, it is preferable to err on the side of caution and
 *    send NO PUT, than to risk sending it twice. The transition into step
 *    "deploying" — together with the pre-PUT snapshot — is written to the
 *    DB BEFORE the redeploy PUT is sent. A crash at any moment therefore
 *    leaves the event either before the PUT (safe: redo the read-only fetch stage)
 *    or in/after it (never re-sent — re-sending could pull a newer image than the one CI
 *    asked for, i.e. the redeploy is not idempotent). Recovered
 *    "deploying"/"verifying" events are observed to completion, never
 *    replayed. `resumePath` below encodes this: past the deploying
 *    write, the only action is "watch".
 *
 * 2. NO WALL CLOCKS IN EVIDENCE.
 *    Comparing Docker's `Created` (or Portainer's timestamps) against
 *    our own clock fails whenever the two hosts' clocks drift. So the
 *    job snapshots the stack's `UpdateDate` and its containers'
 *    `{id, created, imageId}` BEFORE the PUT, and every comparison here
 *    is Docker-vs-Docker or Portainer-vs-Portainer against that
 *    snapshot. Our clock appears only in error messages.
 *
 * ── State diagram ───────────────────────────────────────────────────
 *
 *   created → queued → claimed → fetching → deploying → verifying
 *                 ↑        ↑           │           │
 *                 │        └─crash─────┴─crash─────┘   (resume skips
 *                 │        (redo fetch)  (watch)       ahead to the
 *                 └─recovery re-enqueue                furthest step)
 *
 *   `queued` is the pickable marker: written at birth and re-appended
 *   when boot recovery re-enqueues an orphan. Terminal outcomes live in
 *   the event's `status`: success|error.
 */
import { STACK_STATUS, DEPLOY_STEP, type DeployStepName, type EventStepName, type EventState } from "@/lib/constants";
import { stateOfStep } from "@/lib/utils";
import type { DeploySnapshot, DeploymentJournalType, EventStep } from "@/types";

// ── Live Portainer views (distilled by the job; no wall-clock fields) ──

export interface StackView {
  status: number;
  updateDate: number;
  /** Deployment journal — only exists on newer Portainer (>=2.41). */
  deploymentStatus: DeploymentJournalType | null;
}

export interface ContainerView {
  id: string;
  created: number; // Docker's clock, seconds
  imageId: string;
}

// ── Evidence ────────────────────────────────────────────────────────

export type Evidence =
  | { kind: "applied" }
  | { kind: "failed"; message?: string }
  | { kind: "unconfirmed" };

/**
 * Decide whether the redeploy we sent (or may have sent) actually
 * happened, by comparing the live stack against the pre-PUT snapshot.
 * Rungs in order of strength; each is clock-free when a snapshot exists.
 */
export const classifyEvidence = (opts: {
  snapshot: DeploySnapshot | null;
  stack: StackView;
  containers: ContainerView[];
}): Evidence => {
  const { snapshot, stack, containers } = opts;

  if (!snapshot) {
    // No snapshot, no proof — never guess. (Only reachable for rows
    // whose payload was lost or corrupted; the deadline resolves them.)
    return { kind: "unconfirmed" };
  }

  // Rung 1: Portainer's deployment journal. It is "cleared when a new
  // deployment starts", so entries that postdate the pre-PUT updateDate
  // belong to our attempt (or a later one). Only consulted when the
  // baseline is non-zero: with a 0 baseline any stale journal would
  // match, and rung 3 covers that case anyway.
  const journal = stack.deploymentStatus ?? [];
  if (snapshot.updateDate > 0 && journal.length > 0) {
    const recent = journal.filter((e) => e.Time >= snapshot.updateDate);
    if (recent.length > 0) {
      const last = recent[recent.length - 1];
      if (last.Status === STACK_STATUS.ERROR) {
        return { kind: "failed", message: last.Message };
      }
      if (last.Status === STACK_STATUS.ACTIVE) {
        return { kind: "applied" };
      }
    }
  }

  // Rung 2: container recreation. A redeploy recreates changed
  // services — new container objects, hence new Ids (same-Id-with-new-
  // ImageID is practically impossible but checked anyway). A container
  // not present in the snapshot was created after it.
  const knownIds = new Set(snapshot.containers.map((c) => c.id));
  const knownImages = new Map(snapshot.containers.map((c) => [c.id, c.imageId]));
  for (const c of containers) {
    const before = knownImages.get(c.id);
    if (!knownIds.has(c.id) || (before !== undefined && c.imageId !== "" && before !== c.imageId)) {
      return { kind: "applied" };
    }
  }

  // Rung 3: UpdateDate bumped. Covers the no-op redeploy (same image
  // digest → compose recreates nothing → rung 2 stays silent), because
  // the stack update itself still stamps Portainer's clock.
  if (stack.updateDate > snapshot.updateDate) {
    return { kind: "applied" };
  }

  return { kind: "unconfirmed" };
};

// ── The machine ─────────────────────────────────────────────────────

/**
 * Where an event resumes from its stored step. Past the deploying write
 * the only legal action is "watch" — this is the one-PUT invariant in
 * code form: a recovered event can never re-enter the fetch-and-PUT path.
 * A null step (pre-upgrade row) means no PUT was ever tracked, so it
 * resumes at the fetch stage like a fresh event.
 */
export const resumePath = (step: string | null): "fetch" | "watch" =>
  step === DEPLOY_STEP.DEPLOYING || step === DEPLOY_STEP.VERIFYING ? "watch" : "fetch";

/**
 * The machine resumes from the furthest WORK step reached, not the last
 * row: recovery re-enqueue (`queued`) and re-claim (`claimed`) append
 * housekeeping rows after the crash point, and must not reset progress.
 * Birth-only logs have no work step — they start from `created`.
 */
export const progressStep = (steps: { step: string }[]): string =>
  steps.findLast(
    (s) =>
      s.step === DEPLOY_STEP.FETCHING ||
      s.step === DEPLOY_STEP.DEPLOYING ||
      s.step === DEPLOY_STEP.VERIFYING,
  )?.step ?? DEPLOY_STEP.CREATED;

/**
 * The evidence baseline for the watch phase — the pre-PUT snapshot
 * carried on the `deploying` row. Hydrated from the log by the job on
 * every path; null when the row is missing or its payload was lost or
 * corrupted (the deadline resolves such events).
 */
export const snapshotFromSteps = (steps: EventStep[]): DeploySnapshot | null => {
  const data = steps.find((s) => s.step === DEPLOY_STEP.DEPLOYING)?.data ?? null;
  return data !== null && "updateDate" in data ? data : null;
};

/**
 * Project the step log onto the public lifecycle status (the wire
 * vocabulary). State lives ONLY in the log — the last row decides
 * (terminal rows are always recorded last). Every event's log opens at
 * birth with `created`, so the last step is always present.
 */
export const statusFromSteps = (steps: { step: EventStepName }[]): EventState =>
  stateOfStep(steps[steps.length - 1].step);

/**
 * Whether the processing window has elapsed. The window runs from when
 * the event was CLAIMED (queue wait deliberately does not count) to its
 * resolution — see the deadline rule in the module header.
 */
export const isPastDeadline = (
  nowMs: number,
  claimedAtMs: number,
  timeoutSeconds: number,
): boolean => nowMs >= claimedAtMs + timeoutSeconds * 1000;

// ── Verdicts (watch loop) ───────────────────────────────────────────

export type WatchVerdict =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | { kind: "wait" };

export const watchVerdict = (opts: {
  step: DeployStepName;
  stack: StackView | null; // null = unreachable this tick
  stackName: string | null;
  evidence: Evidence;
}): WatchVerdict => {
  const { step, stack, stackName, evidence } = opts;

  if (!stack) return { kind: "wait" };

  if (stack.status === STACK_STATUS.INACTIVE) {
    return { kind: "error", message: inactiveMessage(step) };
  }
  if (stack.status === STACK_STATUS.ERROR) {
    return { kind: "error", message: deploymentErrorMessage(stack) };
  }
  if (stack.status !== STACK_STATUS.ACTIVE) {
    return { kind: "wait" }; // still deploying, or status unknown
  }

  if (evidence.kind === "failed") {
    return { kind: "error", message: evidence.message ?? "Stack deployment failed" };
  }
  // Success requires evidence — never a bare "active", however the
  // redeploy was initiated (fresh and recovered share this one lane).
  if (evidence.kind === "applied") {
    return { kind: "success", message: successMessage(stackName) };
  }

  // Active but nothing proves OUR redeploy happened yet — the PUT may
  // still be in flight server-side. Keep watching; the deadline ends it.
  return { kind: "wait" };
};

// ── Messages ────────────────────────────────────────────────────────

export const successMessage = (stackName: string | null): string =>
  `Stack${stackName ? ` "${stackName}"` : ""} redeployed successfully`;

/**
 * Deploys to inactive stacks are refused because a deploy would activate
 * the stack — an unintended side effect for an operator who stopped it.
 * The message names the step so the event log shows where it was caught.
 */
export const inactiveMessage = (step: string): string =>
  `Stack is inactive at step: ${step} — deploys to inactive stacks are refused (deploying would activate the stack)`;

export const timeoutMessage = (timeoutSeconds: number, step: string | null): string =>
  `Timed out after ${timeoutSeconds}s without a confirmed deploy (last step: ${step ?? "unknown"})`;

/** Prefer Portainer's own deployment-journal error message when present. */
export const deploymentErrorMessage = (stack: StackView): string => {
  const journal = stack.deploymentStatus ?? [];
  const last = journal[journal.length - 1];
  if (last?.Status === STACK_STATUS.ERROR && last.Message) return last.Message;
  return "Stack deployment failed";
};

/**
 * Map a failed redeploy PUT to a human message — specific where the
 * status code carries semantics, the raw Portainer payload otherwise.
 */
export const updateErrorMessage = (status: number, detail: string): string => {
  switch (status) {
    case 400:
      return `Portainer rejected the stack update: ${detail}`;
    case 403:
      return "Portainer denied the update — check the API key's permissions";
    case 404:
      return "Stack not found — it may have been deleted";
    case 409:
      return "Stack deployment is already in progress — try again shortly";
    default:
      return `Portainer API ${status}: ${detail}`;
  }
};
