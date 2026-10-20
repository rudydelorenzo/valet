import { listWebhookEventsForUser } from "@/lib/db/webhook-events";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET — recent events across all of the authenticated user's webhooks.
 */
export const GET = async () => {
  const userId = await requireAuth();

  const events = await listWebhookEventsForUser(userId, 20);

  return Response.json(events);
};
