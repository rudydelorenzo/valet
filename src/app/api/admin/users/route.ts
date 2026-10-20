import { z } from "zod";
import { listUsers } from "@/lib/db/users";
import { requireAdmin } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { UserSchema } from "@/types";
import type { NextResponse } from "next/server";
import type { User } from "@/types";

const UsersSchema = z.array(UserSchema);

export const GET = async (): Promise<NextResponse<User[]>> => {
  await requireAdmin();

  return json(UsersSchema, await listUsers());
};
