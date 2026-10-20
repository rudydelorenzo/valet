import { z } from "zod";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { listStacks } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { StackSchema } from "@/types";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";
import type { Stack } from "@/types";

const StacksSchema = z.array(StackSchema);

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<Stack[] | ApiError>> => {
  const userId = await requireAuth();
  const { id } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Not found" }, { status: 404 });
  }

  try {
    const stacks = await listStacks(
      instance.url,
      instance.token,
      instance.insecureTls,
    );
    // StackSchema strips Portainer's Env (env-var values may hold secrets)
    return json(StacksSchema, stacks);
  } catch (err) {
    return json(
      ApiErrorSchema,
      { error: err instanceof Error ? err.message : "Failed to list stacks" },
      { status: 502 },
    );
  }
};
