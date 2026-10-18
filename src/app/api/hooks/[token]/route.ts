import { db } from "@/lib/db";
import { webhooks, webhookEvents, portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { id } from "@/lib/ids";
import { redeployStack } from "@/lib/portainer";

// In-memory debounce timers — keyed by webhook id
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * POST — inbound webhook receiver.
 * Authenticated by the token in the URL path.
 * Supports debounce: rapid duplicate calls are coalesced.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Look up the webhook by token
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.token, token))
    .limit(1);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!webhook.enabled) {
    return Response.json({ error: "Webhook is disabled" }, { status: 403 });
  }

  // Log the incoming event
  const [event] = await db
    .insert(webhookEvents)
    .values({
      id: id("evt"),
      webhookId: webhook.id,
      status: "pending",
      triggerSource: "webhook",
    })
    .returning();

  // Debounce the redeploy
  const existing = timers.get(webhook.id);
  if (existing) clearTimeout(existing);

  const delay = (webhook.debounceSeconds ?? 5) * 1000;

  timers.set(
    webhook.id,
    setTimeout(async () => {
      timers.delete(webhook.id);

      const [instance] = await db
        .select()
        .from(portainerInstances)
        .where(eq(portainerInstances.id, webhook.portainerInstanceId))
        .limit(1);

      if (!instance) {
        await db
          .update(webhookEvents)
          .set({ status: "error", message: "Portainer instance not found" })
          .where(eq(webhookEvents.id, event.id));
        return;
      }

      const result = await redeployStack(
        instance.url,
        instance.token,
        instance.insecureTls,
        webhook.stackId,
        webhook.endpointId,
      );

      await db
        .update(webhookEvents)
        .set({
          status: result.success ? "success" : "error",
          message: result.message,
        })
        .where(eq(webhookEvents.id, event.id));
    }, delay),
  );

  return Response.json({ received: true, eventId: event.id }, { status: 202 });
}