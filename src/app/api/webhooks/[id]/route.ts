import { getWebhook, updateWebhook, deleteWebhook } from "@/lib/db/webhooks";
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

  return Response.json(webhook);
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: { name?: string; enabled?: boolean; debounceSeconds?: number } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return Response.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return Response.json({ error: "enabled must be a boolean" }, { status: 400 });
    }
    updates.enabled = body.enabled;
  }

  if (body.debounceSeconds !== undefined) {
    const val = body.debounceSeconds;
    if (!Number.isInteger(val) || val < 0 || val > 86400) {
      return Response.json(
        { error: "debounceSeconds must be an integer between 0 and 86400" },
        { status: 400 },
      );
    }
    updates.debounceSeconds = val;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await updateWebhook(id, updates);

  return Response.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook || webhook.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteWebhook(id);

  return Response.json({ ok: true });
};