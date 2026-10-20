import { z } from "zod";
import { getWebhook } from "@/lib/db/webhooks";
import { listWebhookEvents } from "@/lib/db/webhook-events";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { EventSchema } from "@/types";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";
import type { Event } from "@/types";

const EventsSchema = z.array(EventSchema);

/**
 * GET — recent events for a webhook, most recent first.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Event[] | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  const events = await listWebhookEvents(id);

  return json(EventsSchema, events);
};
