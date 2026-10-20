import { connection } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/health";
import { json } from "@/lib/http";
import { HealthSchema, type HealthResponse } from "@/types/api";
import type { NextResponse } from "next/server";

/**
 * GET — liveness/readiness probe for container healthchecks.
 * 200 when the database is reachable and fully migrated, 503 otherwise.
 * Public — no auth required.
 */
export const GET = async (): Promise<NextResponse<HealthResponse>> => {
  // This route reads live DB state — wait for a real request instead of
  // prerendering at build time.
  await connection();

  const healthy = checkDatabaseHealth();

  if (healthy) {
    return json(HealthSchema, { status: "ok" }, { status: 200 });
  } else {
    return json(HealthSchema, { status: "unavailable" }, { status: 503 });
  }
};
