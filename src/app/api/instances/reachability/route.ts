import { NextRequest, NextResponse } from "next/server";
import { listPortainerInstancesByUser } from "@/lib/db/portainer-instances";
import { requireAuth } from "@/lib/auth/guard";
import { pingInstance } from "@/lib/portainer";
import type { ReachabilityResult } from "@/types/api";

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

  const instances = await listPortainerInstancesByUser(userId, ids);

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