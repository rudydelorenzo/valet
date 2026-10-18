import { db } from "@/lib/db";
import { webhooks, portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [webhook] = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      token: webhooks.token,
      portainerInstanceId: webhooks.portainerInstanceId,
      stackId: webhooks.stackId,
      endpointId: webhooks.endpointId,
      stackName: webhooks.stackName,
      enabled: webhooks.enabled,
      debounceSeconds: webhooks.debounceSeconds,
      createdAt: webhooks.createdAt,
      instanceName: portainerInstances.name,
    })
    .from(webhooks)
    .leftJoin(
      portainerInstances,
      eq(webhooks.portainerInstanceId, portainerInstances.id),
    )
    .where(eq(webhooks.id, id))
    .limit(1);

  if (!webhook) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(webhook);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.debounceSeconds !== undefined) updates.debounceSeconds = body.debounceSeconds;

  const [updated] = await db
    .update(webhooks)
    .set(updates)
    .where(eq(webhooks.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deleted] = await db
    .delete(webhooks)
    .where(eq(webhooks.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}