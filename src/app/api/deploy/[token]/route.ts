import { getWebhookByToken } from "@/lib/db/webhooks";
import { createEvent } from "@/lib/db/webhook-events";
import { EVENT_SOURCE, EVENT_TYPE } from "@/lib/constants";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { getStack } from "@/lib/portainer";
import { getDeployUrl, getStatusUrl, getEventUrl } from "@/lib/webhook-urls";
import { ensureWorker } from "@/lib/worker";
import { json } from "@/lib/http";
import {
  ApiErrorSchema,
  DeployReceiptSchema,
  type ApiError,
  type DeployReceipt,
} from "@/types/api";
import type { NextResponse } from "next/server";

/**
 * POST — inbound webhook receiver.
 * Authenticated by the token in the URL path.
 * Queues a deploy and returns immediately with an event ID
 * and a status URL the caller can poll.
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<DeployReceipt | ApiError>> => {
  const { token } = await params;

  const webhook = await getWebhookByToken(token);

  if (!webhook) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  if (!webhook.enabled) {
    return json(ApiErrorSchema, { error: "Webhook is disabled" }, { status: 403 });
  }

  // Pre-flight healthcheck — fail fast if the stack is unreachable
  const instance = await getPortainerInstance(webhook.portainerInstanceId);
  if (!instance) {
    return json(ApiErrorSchema, { error: "Instance not found" }, { status: 424 });
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

  const event = await createEvent(webhook.id, EVENT_TYPE.DEPLOY, EVENT_SOURCE.WEBHOOK);

  ensureWorker();

  const origin = new URL(request.url).origin;
  return json(
    DeployReceiptSchema,
    {
      received: true,
      eventId: event.id,
      deployUrl: getDeployUrl(origin, token),
      statusUrl: getStatusUrl(origin, token, event.id),
      eventUrl: getEventUrl(origin, token, event.id),
    },
    { status: 200 },
  );
};
