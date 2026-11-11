import { getWebhookByToken } from "@/lib/db/webhooks";
import { getWebhookEvent } from "@/lib/db/webhook-events";
import { listEventStepsForEvent } from "@/lib/db/webhook-event-steps";
import { json } from "@/lib/http";
import { EventSchema } from "@/types";
import { statusFromSteps } from "@/lib/worker/jobs/deploy/state";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { WebhookEvent } from "@/lib/db/schema";
import type { NextResponse } from "next/server";
import type { Event } from "@/types";

/**
 * GET — fetch the full details of a deploy event, including its complete
 * step history (the append-only state-machine log).
 * Authenticated by the webhook token (same token used for the POST).
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ token: string; eventId: WebhookEvent["id"] }> },
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

  const steps = await listEventStepsForEvent(event.id);

  return json(EventSchema, {
    ...event,
    status: statusFromSteps(steps),
    steps,
  });
};
