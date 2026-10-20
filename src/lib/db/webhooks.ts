import { db } from "@/lib/db";
import { webhooks, portainerInstances, webhookEvents } from "@/lib/db/schema";
import { eq, desc, and, inArray, gte } from "drizzle-orm";
import {
  DEFAULT_DEBOUNCE_SECONDS,
  EVENT_STATUS,
  WEBHOOK_STATUS,
  type WebhookStatus,
} from "@/lib/constants";
import crypto from "node:crypto";

/** Degradation window in milliseconds (24 hours). */
const DEGRADATION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A webhook is degraded when more than this fraction of events failed. */
const DEGRADATION_THRESHOLD = 0.3;

/** Compute the derived status from enabled + degraded. */
export const computeWebhookStatus = (
  enabled: boolean,
  degraded: boolean,
): WebhookStatus => {
  if (!enabled) return WEBHOOK_STATUS.DISABLED;
  if (degraded) return WEBHOOK_STATUS.DEGRADED;
  return WEBHOOK_STATUS.ACTIVE;
};

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
 * Compute the 24h failure rate for the given webhooks.
 * Returns a map of webhook ID → { total, failed, degraded }.
 */
export const getWebhookHealth = async (webhookIds: string[]) => {
  const health = new Map<
    string,
    { total: number; failed: number; degraded: boolean }
  >();

  if (webhookIds.length === 0) return health;

  const since = new Date(Date.now() - DEGRADATION_WINDOW_MS);

  const events = await db
    .select({
      webhookId: webhookEvents.webhookId,
      status: webhookEvents.status,
    })
    .from(webhookEvents)
    .where(
      and(
        inArray(webhookEvents.webhookId, webhookIds),
        gte(webhookEvents.createdAt, since),
      ),
    );

  for (const evt of events) {
    const entry = health.get(evt.webhookId) ?? {
      total: 0,
      failed: 0,
      degraded: false,
    };
    entry.total++;
    if (evt.status === EVENT_STATUS.ERROR) entry.failed++;
    health.set(evt.webhookId, entry);
  }

  for (const entry of health.values()) {
    entry.degraded =
      entry.total > 0 && entry.failed / entry.total > DEGRADATION_THRESHOLD;
  }

  return health;
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