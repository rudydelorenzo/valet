import { getWebhookByToken } from "@/lib/db/webhooks";
import { getWebhookEvent } from "@/lib/db/webhook-events";
import { json } from "@/lib/http";
import { EventSchema } from "@/types";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";
import type { Event } from "@/types";

/**
 * GET — fetch the full details of a deploy event.
 * Authenticated by the webhook token (same token used for the POST).
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ token: string; eventId: string }> },
): Promise<NextResponse<Event | ApiError>> => {
  const { token, eventId } = await params;

  const webhook = await getWebhookByToken(token);

  if (!webhook) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const event = await getWebhookEvent(eventId, webhook.id);

  if (!event) {
    return json(ApiErrorSchema, { error: "Event not found" }, { status: 404 });
  }

  return json(EventSchema, event);
};
