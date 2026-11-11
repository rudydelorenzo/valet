import { db, type DbExecutor } from "@/lib/db";
import {
  webhookEvents,
  webhookEventSteps,
  type WebhookEvent,
  type WebhookEventStep,
} from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { EventStepDataSchema, type EventStep, type EventStepData } from "@/types";
import type { EventStepName } from "@/lib/constants";
import { id } from "@/lib/ids";

// Row → wire shape: parses `data` through the step-data union schema.
const toEventStep = (row: WebhookEventStep): EventStep => {
  let parsed: unknown = null;
  if (row.data !== null) {
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = null;
    }
  }
  return {
    step: row.step,
    createdAt: row.createdAt.toISOString(),
    // safeParse: a corrupt row degrades to "no payload", never a 500.
    data: EventStepDataSchema.safeParse(parsed).data ?? null,
  };
};

/** The stored text form of a step payload: JSON, or NULL when absent. */
const serializeData = (data: EventStepData | undefined): string | null =>
  data !== undefined ? JSON.stringify(data) : null;

/**
 * The event's latest step (correlated to `webhookEvents.id`). State lives
 * ONLY in the step log, so every "what state is this in" question —
 * pickability, orphan detection, lifecycle status — resolves through
 * this fragment.
 */
export const lastEventStep = sql<string>`(
  SELECT step FROM ${webhookEventSteps}
  WHERE ${webhookEventSteps.eventId} = ${webhookEvents.id}
  ORDER BY ${webhookEventSteps.createdAt} DESC, rowid DESC LIMIT 1
)`;

/**
 * Append one row to the step log. The log is append-only — there is no
 * update path, and that's by design: the event's history is the state.
 *
 * `data` is JSON-serialized here, symmetric with the parse on read —
 * callers deal only in EventStepData, never the stored text form.
 */
export const insertWebhookEventStep = async (
  eventId: WebhookEvent["id"],
  step: EventStepName,
  data?: EventStepData,
  tx: DbExecutor = db,
) => {
  await tx.insert(webhookEventSteps).values({
    eventId,
    step,
    data: serializeData(data),
  });
};

/**
 * Same append as insertWebhookEventStep — same append-only contract,
 * same JSON handling — with one extra DB-level guarantee: the row
 * lands only while the event's latest step is still `expectedLast`,
 * checked in the same atomic statement. Kept generic on purpose: the
 * db layer stays domain-free, and callers supply their own values (the
 * lifecycle's claim passes claimed/queued). Returns whether the row
 * landed, i.e. whether this caller won the race.
 */
export const insertWebhookEventStepIfLast = async (
  eventId: WebhookEvent["id"],
  step: EventStepName,
  data: EventStepData | undefined,
  expectedLast: EventStepName,
): Promise<boolean> => {
  const result = await db.run(sql`
    INSERT INTO webhook_event_steps (id, event_id, step, data, created_at)
    SELECT ${id("stp")}, id, ${step},
      ${serializeData(data)},
      ${Date.now()}
    FROM webhook_events
    WHERE id = ${eventId} AND ${lastEventStep} = ${expectedLast}
  `);
  return result.changes > 0;
};

/** Batch-append step rows (event birth, recovery re-enqueue). */
export const insertWebhookEventSteps = (
  rows: Array<{ eventId: WebhookEvent["id"]; step: EventStepName; data?: EventStepData }>,
  tx: DbExecutor = db,
) => {
  tx
    .insert(webhookEventSteps)
    .values(
      rows.map((r) => ({
        eventId: r.eventId,
        step: r.step,
        data: serializeData(r.data),
      })),
    )
    .run();
};

/**
 * Full step history for one event, oldest first — the canonical step-log
 * read, wire-shaped.
 *
 * Ordering is (created_at, rowid): transitions can share a millisecond
 * and backfilled pairs are stamped identically, so insertion order is
 * the tiebreak.
 */
export const listEventStepsForEvent = async (eventId: WebhookEvent["id"]): Promise<EventStep[]> => {
  const rows = await db
    .select()
    .from(webhookEventSteps)
    .where(eq(webhookEventSteps.eventId, eventId))
    .orderBy(asc(webhookEventSteps.createdAt), sql`rowid`);
  return rows.map(toEventStep);
};

/**
 * Step histories for many events at once, grouped by event id — the API
 * routes attach these to their event responses.
 */
export const listEventStepsForEvents = async (
  eventIds: WebhookEvent["id"][],
): Promise<Map<WebhookEvent["id"], EventStep[]>> => {
  const grouped = new Map<WebhookEvent["id"], EventStep[]>();
  for (const id of eventIds) {
    grouped.set(id, await listEventStepsForEvent(id));
  }
  return grouped;
};
