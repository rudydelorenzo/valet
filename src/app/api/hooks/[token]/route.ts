import { getWebhookByToken } from "@/lib/db/webhooks";
import { createEvent } from "@/lib/db/webhook-events";
import { EVENT_SOURCE, EVENT_TYPE } from "@/lib/constants";
import { ensureWorker } from "@/lib/worker";

/**
 * POST — inbound webhook receiver.
 * Authenticated by the token in the URL path.
 * Queues a deploy and returns immediately with an event ID
 * and a status URL the caller can poll.
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;

  const webhook = await getWebhookByToken(token);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!webhook.enabled) {
    return Response.json({ error: "Webhook is disabled" }, { status: 403 });
  }

  const event = await createEvent(webhook.id, EVENT_TYPE.DEPLOY, EVENT_SOURCE.WEBHOOK);

  ensureWorker();

  const origin = new URL(request.url).origin;
  return Response.json(
    {
      received: true,
      eventId: event.id,
      statusUrl: `${origin}/api/hooks/${token}/events/${event.id}`,
    },
    { status: 200 },
  );
};