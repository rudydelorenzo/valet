import { db } from "@/lib/db";
import {
  webhooks,
  portainerInstances,
  webhookEvents,
  type Webhook,
  type User,
} from "@/lib/db/schema";
import { lastEventStep } from "./webhook-event-steps";
import { eq, desc, and, inArray, gte } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────

/** Fetch a webhook by its public token (inbound hook auth). */
export const getWebhookByToken = async (token: Webhook["token"]) => {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.token, token))
    .limit(1);
  return webhook ?? null;
};

/**
 * Rows for the health computation: each recent event's webhook and its
 * latest step. The failure-rate math lives in lib/helpers/webhooks.
 */
export const listRecentWebhookEvents = async (
  webhookIds: Webhook["id"][],
  since: Date,
) => {
  return db
    .select({
      webhookId: webhookEvents.webhookId,
      lastStep: lastEventStep,
    })
    .from(webhookEvents)
    .where(
      and(
        inArray(webhookEvents.webhookId, webhookIds),
        gte(webhookEvents.createdAt, since),
      ),
    );
};

/**
 * Fetch a webhook by ID, joined with the Portainer instance name.
 * Returns userId so callers can do ownership checks.
 */
export const getWebhook = async (id: Webhook["id"]) => {
  const [row] = await db
    .select({
      id: webhooks.id,
      userId: webhooks.userId,
      name: webhooks.name,
      token: webhooks.token,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
      deployTimeoutSeconds: webhooks.deployTimeoutSeconds,
      createdAt: webhooks.createdAt,
      instanceName: portainerInstances.name,
    })
    .from(webhooks)
    .leftJoin(
      portainerInstances,
      eq(webhooks.portainerInstanceId, portainerInstances.id),
    )
    .where(eq(webhooks.id, id))
    .limit(1);
  return row ?? null;
};

/** List all webhooks for a user, with instance names. */
export const listWebhooksByUser = async (userId: User["id"]) => {
  return db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
      deployTimeoutSeconds: webhooks.deployTimeoutSeconds,
      createdAt: webhooks.createdAt,
      instanceName: portainerInstances.name,
    })
    .from(webhooks)
    .leftJoin(
      portainerInstances,
      eq(webhooks.portainerInstanceId, portainerInstances.id),
    )
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt));
};

// ── Write ─────────────────────────────────────────────────────────

/** Insert a webhook row. */
export const insertWebhook = async (values: typeof webhooks.$inferInsert) => {
  const [webhook] = await db.insert(webhooks).values(values).returning();
  return webhook;
};

/** Patch a webhook (name, enabled, debounceSeconds, deployTimeoutSeconds). */
export const updateWebhook = async (
  id: Webhook["id"],
  updates: {
    name?: Webhook["name"];
    enabled?: Webhook["enabled"];
    debounceSeconds?: Webhook["debounceSeconds"];
    deployTimeoutSeconds?: Webhook["deployTimeoutSeconds"];
  },
) => {
  const [updated] = await db
    .update(webhooks)
    .set(updates)
    .where(eq(webhooks.id, id))
    .returning();
  return updated ?? null;
};

/** Delete a webhook by ID. */
export const deleteWebhook = async (id: Webhook["id"]) => {
  const [deleted] = await db
    .delete(webhooks)
    .where(eq(webhooks.id, id))
    .returning();
  return deleted ?? null;
};
