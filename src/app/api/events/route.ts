import { db } from "@/lib/db";
import { webhooks, webhookEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET — recent events across all of the authenticated user's webhooks.
 */
export const GET = async () => {
  const userId = await requireAuth();

  const events = await db
    .select({
      id: webhookEvents.id,
      status: webhookEvents.status,
      message: webhookEvents.message,
      triggerSource: webhookEvents.triggerSource,
      createdAt: webhookEvents.createdAt,
    })
    .from(webhookEvents)
    .innerJoin(webhooks, eq(webhookEvents.webhookId, webhooks.id))
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(20);

  return Response.json(events);
};