import { getWebhookByToken } from "@/lib/db/webhooks";
import { getWebhookEvent } from "@/lib/db/webhook-events";

/**
 * GET — check the status of a queued/running/deployed event.
 * Authenticated by the webhook token (same token used for the POST).
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ token: string; eventId: string }> },
) => {
  const { token, eventId } = await params;

  const webhook = await getWebhookByToken(token);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const event = await getWebhookEvent(eventId, webhook.id);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  return Response.json(event);
};