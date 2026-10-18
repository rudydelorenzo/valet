import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .limit(1);

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Don't expose the token in GET
  const { token, ...safe } = instance;
  return Response.json({ ...safe, hasToken: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.token !== undefined) updates.token = body.token;
  if (body.insecureTls !== undefined) updates.insecureTls = body.insecureTls;

  const [updated] = await db
    .update(portainerInstances)
    .set(updates)
    .where(eq(portainerInstances.id, id))
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
    .delete(portainerInstances)
    .where(eq(portainerInstances.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}