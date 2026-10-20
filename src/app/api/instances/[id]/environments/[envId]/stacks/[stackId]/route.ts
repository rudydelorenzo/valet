import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getStack } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";

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
) {
  const userId = await requireAuth();
  const { id, envId, stackId } = await params;

  const [instance] = await db
    .select()
    .from(portainerInstances)
    .where(and(eq(portainerInstances.id, id), eq(portainerInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const parsedStackId = Number(stackId);
  const parsedEnvId = Number(envId);

  if (isNaN(parsedStackId) || isNaN(parsedEnvId)) {
    return NextResponse.json({ error: "Invalid stackId or envId" }, { status: 400 });
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
      return NextResponse.json({ error: "Stack not found" }, { status: 404 });
    }

    return NextResponse.json(stack);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach stack" },
      { status: 502 },
    );
  }
}