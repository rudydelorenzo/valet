import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portainerInstances } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { pingInstance } from "@/lib/portainer";

export interface ReachabilityResult {
  reachable: boolean;
  version?: string;
}

/**
 * GET /api/instances/reachability?ids=inst_abc,inst_def
 *
 * Pings Portainer's /api/status for one or more instances in parallel.
 * Returns a map of instance ID → { reachable, version? }.
 */
export async function GET(req: NextRequest) {
  const userId = await requireAuth();
  const raw = req.nextUrl.searchParams.get("ids");

  if (!raw) {
    return NextResponse.json({ error: "ids parameter required" }, { status: 400 });
  }

  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const instances = await db
    .select({
      id: portainerInstances.id,
      url: portainerInstances.url,
      token: portainerInstances.token,
      insecureTls: portainerInstances.insecureTls,
    })
    .from(portainerInstances)
    .where(
      and(
        eq(portainerInstances.userId, userId),
        inArray(portainerInstances.id, ids),
      ),
    );

  const settled = await Promise.allSettled(
    instances.map(
      async (inst): Promise<[string, ReachabilityResult]> => [
        inst.id,
        await pingInstance(inst.url, inst.token, inst.insecureTls),
      ],
    ),
  );

  const results: Record<string, ReachabilityResult> = {};
  for (const entry of settled) {
    if (entry.status === "fulfilled") {
      const [id, result] = entry.value;
      results[id] = result;
    }
  }

  return NextResponse.json({ results });
}