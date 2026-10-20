import { z } from "zod";
import { listWebhookEventsForUser } from "@/lib/db/webhook-events";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { EventSchema } from "@/types";
import type { NextResponse } from "next/server";
import type { Event } from "@/types";

const EventsSchema = z.array(EventSchema);

/**
 * GET — recent events across all of the authenticated user's webhooks.
 */
export const GET = async (): Promise<NextResponse<Event[]>> => {
  const userId = await requireAuth();

  const events = await listWebhookEventsForUser(userId, 20);

  return json(EventsSchema, events);
};
