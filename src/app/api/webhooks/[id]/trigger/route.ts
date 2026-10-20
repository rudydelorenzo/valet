import { getWebhook } from "@/lib/db/webhooks";
import { createEvent, setEventStatus } from "@/lib/db/webhook-events";
import { EVENT_SOURCE, EVENT_TYPE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth/guard";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { getStack } from "@/lib/portainer";
import { consumeDeployEvent } from "@/lib/worker/jobs/deploy";
import { ensureWorker } from "@/lib/worker";
import { json } from "@/lib/http";
import { ApiErrorSchema, DeployResultSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";

/**
 * POST — manually trigger a webhook redeploy (for testing from the UI).
 * Runs the deploy synchronously and returns the result.
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<
  NextResponse<{ success: boolean; message: string; eventId: string } | ApiError>
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

  const stack = await getStack(
    instance.url,
    instance.token,
    instance.insecureTls,
    webhook.stackId,
    webhook.endpointId,
  );
  if (!stack) {
    return json(
      ApiErrorSchema,
      { error: "Stack not found — it may have been deleted" },
      { status: 424 },
    );
  }

  const event = await createEvent(webhook.id, EVENT_TYPE.DEPLOY, EVENT_SOURCE.MANUAL);

  const result = await consumeDeployEvent(event);

  await setEventStatus(
    event.id,
    result.success ? "success" : "error",
    result.message,
  );

  // Drain any queued webhook events that arrived while we were deploying
  ensureWorker();

  return json(DeployResultSchema, { ...result, eventId: event.id });
};
