import { NextRequest } from "next/server";
import { getPortainerInstance } from "@/lib/db/portainer-instances";
import { getStack } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { StackSchema, type Stack } from "@/types";
import { ApiErrorSchema, type ApiError } from "@/types/api";
import type { NextResponse } from "next/server";

/**
 * GET /api/instances/[id]/environments/[envId]/stacks/[stackId]
 *
 * Returns the stack object if it exists (healthy), or 404 if not (unhealthy).
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; envId: string; stackId: string }> },
): Promise<NextResponse<Stack | ApiError>> {
  const userId = await requireAuth();
  const { id, envId, stackId } = await params;

  const instance = await getPortainerInstance(id);

  if (!instance || instance.userId !== userId) {
    return json(ApiErrorSchema, { error: "Instance not found" }, { status: 404 });
  }

  const parsedStackId = Number(stackId);
  const parsedEnvId = Number(envId);

  if (isNaN(parsedStackId) || isNaN(parsedEnvId)) {
    return json(ApiErrorSchema, { error: "Invalid stackId or envId" }, { status: 400 });
  }

  try {
    const stack = await getStack(
      instance.url,
      instance.token,
      instance.insecureTls,
      parsedStackId,
      parsedEnvId,
    );

    if (!stack) {
      return json(ApiErrorSchema, { error: "Stack not found" }, { status: 404 });
    }

    // StackSchema strips Portainer's Env (env-var values may hold secrets)
    return json(StackSchema, stack);
  } catch (err) {
    return json(
      ApiErrorSchema,
      { error: err instanceof Error ? err.message : "Failed to reach stack" },
      { status: 502 },
    );
  }
}
