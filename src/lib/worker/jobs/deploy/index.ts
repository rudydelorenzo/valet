import { getWebhook } from "@/lib/db/webhooks";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { listEventStepsForEvent } from "@/lib/db/webhook-event-steps";
import { recordEventStep } from "@/lib/webhook-events";
import {
  getStack,
  getStackFile,
  updateStack,
  getStackContainers,
  PortainerError,
  type PortainerStack,
  type DockerContainerSummary,
} from "@/lib/portainer";
import type { PortainerInstance } from "@/lib/db/schema";
import { STACK_STATUS, DEPLOY_WATCH_INTERVAL_MS, DEPLOY_STEP } from "@/lib/constants";
import type { EventHandler } from "@/lib/worker";
import {
  classifyEvidence,
  watchVerdict,
  resumePath,
  progressStep,
  snapshotFromSteps,
  isPastDeadline,
  inactiveMessage,
  timeoutMessage,
  updateErrorMessage,
  type StackView,
  type ContainerView,
} from "./state";
import type { DeploySnapshot } from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isTimeout = (err: unknown): boolean =>
  err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

const stackView = (s: PortainerStack): StackView => ({
  status: s.Status,
  updateDate: s.UpdateDate,
  deploymentStatus: s.DeploymentStatus,
});

const containerView = (c: DockerContainerSummary): ContainerView => ({
  id: c.Id,
  created: c.Created,
  imageId: c.ImageID ?? "",
});

interface Ctx {
  event: { id: string; createdAt: Date };
  /** Where the machine died (furthest work step), "created" for birth-only logs. */
  step: string;
  /** Processing-window start: the first `claimed` row's time. */
  claimedAt: number;
  instance: PortainerInstance;
  webhook: { stackId: number; endpointId: number; name: string };
  timeoutSeconds: number;
}

/**
 * The deploy event handler. Fresh and recovered events run the same code:
 * the event's step log says where the previous attempt died and the
 * machine resumes from there. See ./state.ts for the invariants this
 * relies on.
 */
export const consumeDeployEvent: EventHandler = async (event) => {
  const webhook = await getWebhook(event.webhookId);
  if (!webhook) return { success: false, message: "Webhook not found" };
  if (!webhook.enabled) return { success: false, message: "Webhook is disabled" };

  const instance = await getPortainerInstance(webhook.portainerInstanceId);
  if (!instance) return { success: false, message: "Portainer instance not found" };

  const timeoutSeconds = webhook.deployTimeoutSeconds;

  // Rebuild the machine's position from the append-only step log: the
  // furthest work step reached (re-enqueue/claim rows after a crash
  // point must not reset progress).
  const steps = await listEventStepsForEvent(event.id);
  const step = progressStep(steps);

  // The processing window runs from the FIRST claim to resolution — a
  // crash-requeue cycle does not buy extra time. Pre-upgrade logs have no
  // claim row; creation time is the closest honest stand-in.
  const claimedRow = steps.find((s) => s.step === DEPLOY_STEP.CLAIMED);
  const claimedAt = claimedRow
    ? Date.parse(claimedRow.createdAt)
    : event.createdAt.getTime();

  const ctx: Ctx = {
    event,
    step,
    claimedAt,
    instance,
    webhook,
    timeoutSeconds,
  };

  if (isPastDeadline(Date.now(), claimedAt, timeoutSeconds)) {
    return { success: false, message: timeoutMessage(timeoutSeconds, step) };
  }

  if (resumePath(step) === "watch") {
    // Crashed on or after the PUT — observe, never re-send (one PUT per event).
    return await watchDeployment(ctx);
  }

  return await fetchAndDeploy(ctx);
};

// ── fetch stage (read-only; safe to redo after a crash) ────────────

const fetchAndDeploy = async (ctx: Ctx): Promise<{ success: boolean; message: string }> => {
  const { event, instance, webhook } = ctx;

  if (ctx.step !== DEPLOY_STEP.FETCHING) {
    await recordEventStep(event.id, DEPLOY_STEP.FETCHING);
  }

  // Everything in this stage is read-only. Failures here are honest
  // errors — nothing has been sent to Portainer yet — so surface the
  // raw message instead of the worker's "handler crashed" wrapper.
  let stack: PortainerStack | null;
  let file: { StackFileContent: string };
  try {
    stack = await getStack(
      instance.url,
      instance.token,
      instance.insecureTls,
      webhook.stackId,
      webhook.endpointId,
    );
    if (!stack) {
      return { success: false, message: "Stack not found — it may have been deleted" };
    }
    file = await getStackFile(instance.url, instance.token, instance.insecureTls, webhook.stackId);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }

  if (stack.Status === STACK_STATUS.INACTIVE) {
    return { success: false, message: inactiveMessage("fetching") };
  }
  // [] on error — the snapshot rungs simply degrade.
  const containers = await getStackContainers(
    instance.url,
    instance.token,
    instance.insecureTls,
    stack.EndpointId || webhook.endpointId,
    stack.Name ?? webhook.name,
  );

  // Snapshot BEFORE the PUT: recovery compares the live stack against
  // this, Docker-clock-to-Docker-clock, never against our own clock.
  // Written to the log here; the watch phase re-reads it from there
  // (state lives only in the log, never carried in memory).
  const snapshot: DeploySnapshot = {
    at: Date.now(),
    updateDate: stack.UpdateDate,
    containers: containers.map(containerView),
  };

  // The one-PUT invariant: this log entry MUST land before the PUT is
  // sent. A crash past this line is recovered by watching, never by
  // re-sending — the `deploying` row is what marks the point of no return.
  await recordEventStep(event.id, DEPLOY_STEP.DEPLOYING, snapshot);

  try {
    await updateStack(instance.url, instance.token, instance.insecureTls, webhook.stackId, stack.EndpointId || webhook.endpointId, {
      stackFileContent: file.StackFileContent,
      env: stack.Env ?? [],
    });
  } catch (err) {
    if (isTimeout(err)) {
      // The PUT may still be running server-side (Portainer keeps
      // deploying even if our connection died). Fall into the watch loop
      // — the evidence ladder decides the outcome. (watchDeployment
      // records the verifying row itself before observing.)
      return await watchDeployment(ctx);
    }
    if (err instanceof PortainerError) {
      return { success: false, message: updateErrorMessage(err.status, err.detail) };
    }
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }

  // 2xx: the response's Status is deliberately ignored — the redeploy is
  // confirmed (or refuted) by the evidence ladder like every other path,
  // keeping the machine version-agnostic. (watchDeployment records the
  // verifying row itself before observing.)
  return await watchDeployment(ctx);
};

// ── watch stage (shared by fresh and recovered paths) ───────────────

const watchDeployment = async (ctx: Ctx): Promise<{ success: boolean; message: string }> => {
  const { event, instance, webhook, timeoutSeconds } = ctx;

  // Hydrate the watch phase from the log — the SAME read on fresh and
  // recovered paths: the `deploying` row (written before the PUT) carries
  // the evidence baseline, and the furthest work step decides whether
  // the verifying row still needs recording.
  const steps = await listEventStepsForEvent(event.id);
  const snapshot = snapshotFromSteps(steps);

  // From here on we only observe — whether the PUT was witnessed or is
  // being recovered, success is decided by stack status + evidence alone.
  if (progressStep(steps) !== DEPLOY_STEP.VERIFYING) {
    await recordEventStep(event.id, DEPLOY_STEP.VERIFYING);
  }

  while (true) {
    if (isPastDeadline(Date.now(), ctx.claimedAt, timeoutSeconds)) {
      return { success: false, message: timeoutMessage(timeoutSeconds, "verifying") };
    }

    let stack: PortainerStack | null = null;
    try {
      stack = await getStack(
        instance.url,
        instance.token,
        instance.insecureTls,
        webhook.stackId,
        webhook.endpointId,
      );
    } catch {
      stack = null; // unreachable this tick — wait and retry
    }

    let containers: DockerContainerSummary[] = [];
    if (stack) {
      containers = await getStackContainers(
        instance.url,
        instance.token,
        instance.insecureTls,
        stack.EndpointId || webhook.endpointId,
        stack.Name ?? webhook.name,
      );
    }

    const verdict = watchVerdict({
      step: DEPLOY_STEP.VERIFYING,
      stack: stack ? stackView(stack) : null,
      stackName: stack?.Name ?? null,
      evidence: stack
        ? classifyEvidence({
            snapshot,
            stack: stackView(stack),
            containers: containers.map(containerView),
          })
        : { kind: "unconfirmed" },
    });

    if (verdict.kind === "success") return { success: true, message: verdict.message };
    if (verdict.kind === "error") return { success: false, message: verdict.message };

    await sleep(DEPLOY_WATCH_INTERVAL_MS);
  }
};
