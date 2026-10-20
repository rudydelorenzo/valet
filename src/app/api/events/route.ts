import { db } from "@/lib/db";
import { webhooks, webhookEvents, portainerInstances } from "@/lib/db/schema";
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
      type: webhookEvents.type,
      message: webhookEvents.message,
      triggerSource: webhookEvents.triggerSource,
      createdAt: webhookEvents.createdAt,
      webhookName: webhooks.name,
      instanceName: portainerInstances.name,
    })
    .from(webhookEvents)
    .innerJoin(webhooks, eq(webhookEvents.webhookId, webhooks.id))
    .innerJoin(portainerInstances, eq(webhooks.portainerInstanceId, portainerInstances.id))
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(20);

  return Response.json(events);
};