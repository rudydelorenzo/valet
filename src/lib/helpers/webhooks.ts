import crypto from "node:crypto";
import { insertWebhook, listRecentWebhookEvents } from "@/lib/db/webhooks";
import {
  DEFAULT_DEBOUNCE_SECONDS,
  DEFAULT_DEPLOY_TIMEOUT_SECONDS,
  DEGRADATION_THRESHOLD,
  DEGRADATION_WINDOW_MS,
  TERMINAL_STATE,
  WEBHOOK_STATUS,
  type WebhookStatus,
} from "@/lib/constants";
import type { User, Webhook, PortainerInstance } from "@/lib/db/schema";

/** Compute the derived status from enabled + degraded. */
export const computeWebhookStatus = (
  enabled: boolean,
  degraded: boolean,
): WebhookStatus => {
  if (!enabled) return WEBHOOK_STATUS.DISABLED;
  if (degraded) return WEBHOOK_STATUS.DEGRADED;
  return WEBHOOK_STATUS.ACTIVE;
};

/**
 * Compute the 24h failure rate for the given webhooks.
 * Returns a map of webhook ID → { total, failed, degraded }.
 */
export const getWebhookHealth = async (webhookIds: Webhook["id"][]) => {
  const health = new Map<
    Webhook["id"],
    { total: number; failed: number; degraded: boolean }
  >();

  if (webhookIds.length === 0) return health;

  const since = new Date(Date.now() - DEGRADATION_WINDOW_MS);
  const events = await listRecentWebhookEvents(webhookIds, since);

  for (const evt of events) {
    const entry = health.get(evt.webhookId) ?? {
      total: 0,
      failed: 0,
      degraded: false,
    };
    entry.total++;
    if (evt.lastStep === TERMINAL_STATE.ERROR) entry.failed++;
    health.set(evt.webhookId, entry);
  }

  for (const entry of health.values()) {
    entry.degraded =
      entry.total > 0 && entry.failed / entry.total > DEGRADATION_THRESHOLD;
  }

  return health;
};

/** Create a new webhook: generates the inbound token and applies defaults. */
export const createWebhook = async (data: {
  userId: User["id"];
  name: Webhook["name"];
  portainerInstanceId: PortainerInstance["id"];
  stackId: Webhook["stackId"];
  endpointId: Webhook["endpointId"];
  debounceSeconds?: Webhook["debounceSeconds"];
  deployTimeoutSeconds?: Webhook["deployTimeoutSeconds"];
}) => {
  const token = crypto.randomBytes(32).toString("base64url");
  return insertWebhook({
    ...data,
    token,
    debounceSeconds: data.debounceSeconds ?? DEFAULT_DEBOUNCE_SECONDS,
    deployTimeoutSeconds: data.deployTimeoutSeconds ?? DEFAULT_DEPLOY_TIMEOUT_SECONDS,
  });
};
