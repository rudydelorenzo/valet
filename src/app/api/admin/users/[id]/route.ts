import { countAdmins, updateUser } from "@/lib/db/users";
import { requireAdmin } from "@/lib/auth/guard";
import { json, parseBody } from "@/lib/http";
import {
  ApiErrorSchema,
  OkSchema,
  UpdateUserSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  await requireAdmin();
  const { id } = await params;

  const body = await parseBody(request, UpdateUserSchema);
  if (body instanceof NextResponse) return body;
  const { isAdmin } = body;

  // If removing admin, ensure it's not the last one
  if (!isAdmin) {
    const adminCount = await countAdmins();
    if (adminCount <= 1) {
      return json(
        ApiErrorSchema,
        { error: "Cannot remove the last admin" },
        { status: 409 },
      );
    }
  }

  const updated = await updateUser(id, { isAdmin });

  if (!updated) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  return json(OkSchema, { ok: true });
};
