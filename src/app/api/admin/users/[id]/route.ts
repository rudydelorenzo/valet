import { countAdmins, updateUser } from "@/lib/db/users";

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
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      return Response.json(
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
  }

  const updated = await updateUser(id, { isAdmin: body.isAdmin });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
};