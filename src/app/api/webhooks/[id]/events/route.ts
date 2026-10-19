import { getWebhook } from "@/lib/db/webhooks";
import { listWebhookEvents } from "@/lib/db/webhook-events";
import { requireAuth } from "@/lib/auth/guard";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const events = await listWebhookEvents(id);

  return Response.json(events);
};