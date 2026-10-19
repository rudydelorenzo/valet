import { getWebhook } from "@/lib/db/webhooks";
import { createEvent, setEventStatus } from "@/lib/db/webhook-events";
import { EVENT_SOURCE, EVENT_TYPE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth/guard";
import { consumeWebhookJob } from "@/lib/worker/jobs/deploy";
import { ensureWorker } from "@/lib/worker";

/**
 * POST — manually trigger a webhook redeploy (for testing from the UI).
 * Runs the deploy synchronously and returns the result.
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id: webhookId } = await params;

  const webhook = await getWebhook(webhookId);
  if (!webhook || webhook.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const event = await createEvent(webhook.id, EVENT_TYPE.DEPLOY, EVENT_SOURCE.MANUAL);

  const result = await consumeWebhookJob(event);

  await setEventStatus(
    event.id,
    result.success ? "success" : "error",
    result.message,
  );

  // Drain any queued webhook events that arrived while we were deploying
  ensureWorker();

  return Response.json({ ...result, eventId: event.id });
};