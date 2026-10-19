import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  // Verify ownership
  const [webhook] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
    .limit(1);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { webhookEvents } = await import("@/lib/db/schema");
  const { desc } = await import("drizzle-orm");

  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.webhookId, id))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(100);

  return Response.json(events);
};