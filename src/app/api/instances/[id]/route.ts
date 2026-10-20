import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { validateInstance } from "@/lib/portainer";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(and(eq(portainerInstances.id, id), eq(portainerInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { token, ...safe } = instance;
  return Response.json({ ...safe, hasToken: true });
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url;
  if (body.token !== undefined) updates.token = body.token;
  if (body.insecureTls !== undefined) updates.insecureTls = body.insecureTls;

  // If URL or token changed, validate the new connection
  if (updates.url || updates.token) {
    const [current] = await db
      .select()
      .from(portainerInstances)
      .where(and(eq(portainerInstances.id, id), eq(portainerInstances.userId, userId)))
      .limit(1);

    if (!current) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const validation = await validateInstance(
      (updates.url as string) ?? current.url,
      (updates.token as string) ?? current.token,
      (updates.insecureTls as boolean) ?? current.insecureTls,
    );

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }
  }

  const [updated] = await db
    .update(portainerInstances)
    .set(updates)
    .where(and(eq(portainerInstances.id, id), eq(portainerInstances.userId, userId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const userId = await requireAuth();
  const { id } = await params;

  const [deleted] = await db
    .delete(portainerInstances)
    .where(and(eq(portainerInstances.id, id), eq(portainerInstances.userId, userId)))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
};