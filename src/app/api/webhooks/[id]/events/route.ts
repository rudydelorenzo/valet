import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.webhookId, id))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(100);

  return Response.json(events);
};