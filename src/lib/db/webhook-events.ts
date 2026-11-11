import { db, type DbExecutor } from "@/lib/db";
import {
  webhookEvents,
  webhooks,
  portainerInstances,
} from "@/lib/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { lastEventStep } from "./webhook-event-steps";
import type { EventStepName } from "@/lib/constants";

/** Insert an event row. Opening its step log is the caller's job. */
export const insertWebhookEvent = (
  webhookId: string,
  type: string,
  triggerSource: string,
  tx: DbExecutor = db,
) => {
  return tx
    .insert(webhookEvents)
    .values({
      webhookId,
      type,
      triggerSource,
    })
    .returning()
    .get();
};

/** Events whose latest step is one of `steps`, oldest first. */
export const listEventsAtSteps = async (steps: EventStepName[], limit?: number) => {
  const query = db
    .select()
    .from(webhookEvents)
    // sql.join needs an explicit separator — with none it concatenates
    // the chunks ("IN (????)"), which SQLite rejects.
    .where(sql`${lastEventStep} IN (${sql.join(steps.map((s) => sql`${s}`), sql`, `)})`)
    .orderBy(asc(webhookEvents.createdAt));
  return limit !== undefined ? query.limit(limit) : query;
};

/** Fetch an event by ID, scoped to a specific webhook. */
export const getWebhookEvent = async (eventId: string, webhookId: string) => {
  const [event] = await db
    .select({
      id: webhookEvents.id,
      type: webhookEvents.type,
      triggerSource: webhookEvents.triggerSource,
      createdAt: webhookEvents.createdAt,
    })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.id, eventId),
        eq(webhookEvents.webhookId, webhookId),
      ),
    )
    .limit(1);
  return event ?? null;
};

/** Fetch the full event row by ID alone. */
export const getWebhookEventById = async (eventId: string) => {
  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.id, eventId))
    .limit(1);
  return event ?? null;
};

/** List events for a webhook, most recent first. */
export const listWebhookEvents = async (webhookId: string, limit = 100) => {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.webhookId, webhookId))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);
};

/** List recent events across all of a user's webhooks, most recent first. */
export const listWebhookEventsForUser = async (userId: string, limit = 20) => {
  return db
    .select({
      id: webhookEvents.id,
      type: webhookEvents.type,
      triggerSource: webhookEvents.triggerSource,
      createdAt: webhookEvents.createdAt,
      webhookName: webhooks.name,
      instanceName: portainerInstances.name,
    })
    .from(webhookEvents)
    .innerJoin(webhooks, eq(webhookEvents.webhookId, webhooks.id))
    .innerJoin(portainerInstances, eq(webhooks.portainerInstanceId, portainerInstances.id))
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);
};
