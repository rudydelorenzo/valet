import { z } from "zod";
import { listWebhookEventsForUser } from "@/lib/db/webhook-events";
import { listEventStepsForEvents } from "@/lib/db/webhook-event-steps";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { EventSchema } from "@/types";
import { statusFromSteps } from "@/lib/worker/jobs/deploy/state";
import type { NextResponse } from "next/server";
import type { Event } from "@/types";

const EventsSchema = z.array(EventSchema);

/**
 * GET — recent events across all of the authenticated user's webhooks.
 */
export const GET = async (): Promise<NextResponse<Event[]>> => {
  const userId = await requireAuth();

  const events = await listWebhookEventsForUser(userId, 20);
  const stepsByEvent = await listEventStepsForEvents(events.map((e) => e.id));

  return json(
    EventsSchema,
    events.map((e) => {
      const steps = stepsByEvent.get(e.id) ?? [];
      return { ...e, status: statusFromSteps(steps), steps };
    }),
  );
};
