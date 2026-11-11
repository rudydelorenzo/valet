import { getWebhook } from "@/lib/db/webhooks";
import { createEvent, finishEvent, claimEventById } from "@/lib/helpers/webhook-events";
import { EVENT_SOURCE, EVENT_TYPE, TERMINAL_STATE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth/guard";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { consumeDeployEvent, preflightStack } from "@/lib/worker/jobs/deploy";
import { ensureWorker } from "@/lib/worker";
import { json } from "@/lib/http";
import { ApiErrorSchema, DeployResultSchema, type ApiError } from "@/types/api";
import type { Webhook, WebhookEvent } from "@/lib/db/schema";
import type { NextResponse } from "next/server";

/**
 * POST — manually trigger a webhook redeploy (for testing from the UI).
 * Runs the deploy synchronously and returns the result.
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: Webhook["id"] }> },
): Promise<
  NextResponse<{ success: boolean; message: string; eventId: WebhookEvent["id"] } | ApiError>
> => {
  const userId = await requireAuth();
  const { id: webhookId } = await params;

  const webhook = await getWebhook(webhookId);
  if (!webhook || webhook.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  // Pre-flight healthcheck — fail fast if the stack is unreachable
  const instance = await getPortainerInstance(webhook.portainerInstanceId);
  if (!instance) {
    return json(
      ApiErrorSchema,
      { error: "Instance not found" },
      { status: 424 },
    );
  }

  const preflight = await preflightStack(instance, webhook, "preflight");
  if ("error" in preflight) {
    return json(ApiErrorSchema, { error: preflight.error }, { status: 424 });
  }

  const event = await createEvent(webhook.id, EVENT_TYPE.DEPLOY, EVENT_SOURCE.MANUAL);

  // Claim the event atomically before running it inline — without this,
  // the worker loop would claim the same queued event on its next poll
  // and deploy the stack twice.
  const claimed = await claimEventById(event.id);
  if (!claimed) {
    ensureWorker();
    return json(DeployResultSchema, {
      success: true,
      message: "Redeploy queued — the worker is processing it",
      eventId: event.id,
    });
  }

  const result = await consumeDeployEvent(claimed);

  await finishEvent(
    event.id,
    result.success ? TERMINAL_STATE.SUCCESS : TERMINAL_STATE.ERROR,
    result.message,
  );

  // Drain any queued webhook events that arrived while we were deploying
  ensureWorker();

  return json(DeployResultSchema, { ...result, eventId: event.id });
};
