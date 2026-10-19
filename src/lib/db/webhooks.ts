import { db } from "@/lib/db";
import { webhooks, portainerInstances } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_DEBOUNCE_SECONDS } from "@/lib/constants";
import crypto from "node:crypto";

// ── Read ──────────────────────────────────────────────────────────

/** Fetch a webhook by its public token (inbound hook auth). */
export const getWebhookByToken = async (token: string) => {
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.token, token))
    .limit(1);
  return webhook ?? null;
};

/**
 * Fetch a webhook by ID, joined with the Portainer instance name.
 * Returns userId so callers can do ownership checks.
 */
export const getWebhook = async (id: string) => {
  const [row] = await db
    .select({
      id: webhooks.id,
      userId: webhooks.userId,
      name: webhooks.name,
      token: webhooks.token,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      stackName: webhooks.stackName,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
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
export const listWebhooksByUser = async (userId: string) => {
  return db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      token: webhooks.token,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      stackName: webhooks.stackName,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
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

/** Create a new webhook with a random token. */
export const createWebhook = async (data: {
  userId: string;
  name: string;
  portainerInstanceId: string;
  stackId: number;
  endpointId: number;
  stackName: string;
  debounceSeconds?: number;
}) => {
  const token = crypto.randomBytes(32).toString("base64url");

  const [webhook] = await db
    .insert(webhooks)
    .values({
      ...data,
      token,
      debounceSeconds: data.debounceSeconds ?? DEFAULT_DEBOUNCE_SECONDS,
    })
    .returning();

  return webhook;
};

/** Patch a webhook (name, enabled, debounceSeconds). */
export const updateWebhook = async (
  id: string,
  updates: { name?: string; enabled?: boolean; debounceSeconds?: number },
) => {
  const [updated] = await db
    .update(webhooks)
    .set(updates)
    .where(eq(webhooks.id, id))
    .returning();
  return updated ?? null;
};

/** Delete a webhook by ID. */
export const deleteWebhook = async (id: string) => {
  const [deleted] = await db
    .delete(webhooks)
    .where(eq(webhooks.id, id))
    .returning();
  return deleted ?? null;
};