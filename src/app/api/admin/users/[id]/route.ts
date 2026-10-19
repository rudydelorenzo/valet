import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = (await request.json()) as { isAdmin?: boolean };

  if (body.isAdmin === undefined) {
    return Response.json({ error: "isAdmin is required" }, { status: 400 });
  }

  // If removing admin, ensure it's not the last one
  if (!body.isAdmin) {
    const adminCount = await db.$count(users, eq(users.isAdmin, true));
    if (adminCount <= 1) {
      return Response.json(
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isAdmin: body.isAdmin })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
};