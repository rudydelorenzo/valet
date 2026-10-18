import { db } from "@/lib/db";
import { webhooks, webhookEvents, portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { id } from "@/lib/ids";
import { redeployStack } from "@/lib/portainer";

/**
 * POST — manually trigger a webhook redeploy (for testing from the UI).
 */
export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: webhookId } = await params;

  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(eq(portainerInstances.id, webhook.portainerInstanceId))
    .limit(1);

  if (!instance) {
    return Response.json({ error: "Portainer instance not found" }, { status: 404 });
  }

  // Log the event
  const [event] = await db
    .insert(webhookEvents)
    .values({
      id: id("evt"),
      webhookId: webhook.id,
      status: "pending",
      triggerSource: "manual",
    })
    .returning();

  // Redeploy
  const result = await redeployStack(
    instance.url,
    instance.token,
    instance.insecureTls,
    webhook.stackId,
    webhook.endpointId,
  );

  // Update the event
  await db
    .update(webhookEvents)
    .set({
      status: result.success ? "success" : "error",
      message: result.message,
    })
    .where(eq(webhookEvents.id, event.id));

  return Response.json(result);
};