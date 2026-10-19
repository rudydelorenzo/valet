import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { listStacks } from "@/lib/portainer";
import { requireAuth } from "@/lib/auth/guard";

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

  try {
    const stacks = await listStacks(
      instance.url,
      instance.token,
      instance.insecureTls,
    );
    return Response.json(stacks);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list stacks" },
      { status: 502 },
    );
  }
};