import {
  DEPLOY_STEP,
  INFLIGHT_STATE,
  type TerminalState,
  type DeployStepName,
} from "@/lib/constants";
import { stepsOfState } from "@/lib/utils";
import {
  insertWebhookEvent,
  getWebhookEventById,
  listEventsAtSteps,
} from "@/lib/db/webhook-events";
import { withTransaction } from "@/lib/db/common";
import {
  insertWebhookEventStep,
  insertWebhookEventStepIfLast,
  insertWebhookEventSteps,
  listEventStepsForEvent,
} from "@/lib/db/webhook-event-steps";
import type { EventStepData } from "@/types";

// ── The event lifecycle ────────────────────────────────────────────
//
// Domain rules that the pure db accessors must not know about: the birth
// protocol, pickability (queued = claimable), the claim race, recovery,
// and payload shapes. State lives ONLY in the step log; this layer
// composes the accessors from src/lib/db, never the db handle itself.

/**
 * Enqueue a new event for a webhook: opens its step log with `created`,
 * then marks it pickable with `queued` — the same transition recovery
 * re-appends on re-enqueue. One transaction: an event with an empty log
 * has no derivable status.
 */
export const createEvent = async (
  webhookId: string,
  type: string,
  triggerSource: string,
) =>
  withTransaction((tx) => {
    const event = insertWebhookEvent(webhookId, type, triggerSource, tx);
    insertWebhookEventSteps(
      [
        { eventId: event.id, step: DEPLOY_STEP.CREATED },
        { eventId: event.id, step: DEPLOY_STEP.QUEUED },
      ],
      tx,
    );
    return event;
  });

/**
 * Record one state-machine transition (append-only).
 * `data` is JSON-serialized by the steps accessor — the pre-PUT snapshot
 * on the `deploying` row is the evidence baseline recovery compares
 * against.
 */
export const recordEventStep = async (
  eventId: string,
  step: DeployStepName,
  data?: EventStepData,
) => {
  await insertWebhookEventStep(eventId, step, data);
};

/**
 * Finish an event: append the terminal step row carrying the outcome
 * message. The lifecycle status is derived from the log, so this single
 * insert IS the finish.
 */
export const finishEvent = async (
  eventId: string,
  outcome: TerminalState,
  message?: string,
) => {
  await insertWebhookEventStep(eventId, outcome, { message: message ?? null });
};

/**
 * The claim transition: append `claimed` only while the log is still at
 * `queued` (the pickable marker, appended at birth and on recovery
 * re-enqueue). The accessor's guarded INSERT lets exactly one claimer
 * win — the worker loop and the manual trigger share one connection.
 */
const tryClaim = (eventId: string): Promise<boolean> =>
  insertWebhookEventStepIfLast(
    eventId,
    DEPLOY_STEP.CLAIMED,
    undefined,
    DEPLOY_STEP.QUEUED,
  );

/**
 * Atomically claim one specific event, recording the `claimed`
 * transition — the processing window (deploy timeout) starts here.
 * Returns the claimed row, or null if someone else claimed it first.
 * The manual trigger route uses this before running the deploy inline —
 * without it, the worker loop would claim the same queued event on its
 * next poll and deploy the stack twice.
 */
export const claimEventById = async (eventId: string) => {
  if (!(await tryClaim(eventId))) return null;
  return getWebhookEventById(eventId);
};

/**
 * Atomically claim the oldest event at the `queued` step (across all
 * webhooks), recording the `claimed` transition (the processing window
 * starts here). Returns the full event row, or null if nothing is
 * pickable — including when a concurrent claimer won the guarded insert.
 */
export const claimNextEvent = async () => {
  const [event] = await listEventsAtSteps([DEPLOY_STEP.QUEUED], 1);

  if (!event) return null;
  return (await tryClaim(event.id)) ? event : null;
};

/**
 * Boot recovery, run once per process: the server died, so every event
 * still mid-work is orphaned (the worker is single-process and
 * sequential) — its log's last step is a work step. Re-append `queued`
 * (the pickable marker) so the claim transition becomes legal again; the
 * machine resumes at its furthest work step when claimed.
 */
export const requeueInterrupted = async () => {
  const orphaned = await listEventsAtSteps(stepsOfState(INFLIGHT_STATE.RUNNING));
  if (orphaned.length === 0) return;

  insertWebhookEventSteps(
    orphaned.map((o) => ({ eventId: o.id, step: DEPLOY_STEP.QUEUED })),
  );
};

/**
 * The outcome message of a finished event — the payload of its terminal
 * step row (which the log records last). Null while the event is still
 * running.
 */
export const getEventMessage = async (eventId: string): Promise<string | null> => {
  const steps = await listEventStepsForEvent(eventId);
  const data = steps.at(-1)?.data ?? null;
  return data !== null && "message" in data ? data.message : null;
};
