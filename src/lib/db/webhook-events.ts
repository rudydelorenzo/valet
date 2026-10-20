import { db } from "@/lib/db";
import { webhookEvents, webhooks, portainerInstances } from "@/lib/db/schema";
import { eq, and, desc, asc, lte } from "drizzle-orm";
import { EVENT_STATUS } from "@/lib/constants";

// ── Read ──────────────────────────────────────────────────────────

/** Fetch an event by ID, scoped to a specific webhook. */
export const getWebhookEvent = async (eventId: string, webhookId: string) => {
  const [event] = await db
    .select({
      id: webhookEvents.id,
      status: webhookEvents.status,
      message: webhookEvents.message,
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
      status: webhookEvents.status,
      type: webhookEvents.type,
      message: webhookEvents.message,
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

// ── Write ─────────────────────────────────────────────────────────

/** Enqueue a new event for a webhook. */
export const createEvent = async (
  webhookId: string,
  type: string,
  triggerSource: string,
) => {
  const [event] = await db
    .insert(webhookEvents)
    .values({
      webhookId,
      type,
      status: EVENT_STATUS.QUEUED,
      triggerSource,
    })
    .returning();
  return event;
};

/** Update an event's status and optional message. */
export const setEventStatus = async (
  eventId: string,
  status: string,
  message?: string,
) => {
  await db
    .update(webhookEvents)
    .set({ status, message: message ?? null })
    .where(eq(webhookEvents.id, eventId));
};

/**
 * Atomically claim the oldest queued event (across all webhooks).
 * Returns the full event row, or null if the queue is empty.
 */
export const claimNextEvent = async () => {
  const [event] = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.status, EVENT_STATUS.QUEUED))
    .orderBy(asc(webhookEvents.createdAt))
    .limit(1);

  if (!event) return null;

  await db
    .update(webhookEvents)
    .set({ status: EVENT_STATUS.RUNNING })
    .where(eq(webhookEvents.id, event.id));

  return event;
};

/** Mark stale "running" events as error (e.g. after a server restart). */
export const cleanupStaleEvents = async (staleThreshold: Date) => {
  await db
    .update(webhookEvents)
    .set({
      status: "error",
      message: "Deploy interrupted or timed out",
    })
    .where(
      and(
        eq(webhookEvents.status, EVENT_STATUS.RUNNING),
        lte(webhookEvents.createdAt, staleThreshold),
      ),
    );
};