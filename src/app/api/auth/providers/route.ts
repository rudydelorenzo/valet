import { z } from "zod";
import { connection } from "next/server";
import { listEnabledProviders } from "@/lib/db/oidc-providers";
import { json } from "@/lib/http";
import { ProviderSummarySchema } from "@/types";
import type { NextResponse } from "next/server";
import type { ProviderSummary } from "@/types";

const ProviderSummariesSchema = z.array(ProviderSummarySchema);

/**
 * GET — list enabled providers (public, used by the login page).
 * Only exposes name and id — never secrets.
 */
export const GET = async (): Promise<NextResponse<ProviderSummary[]>> => {
  // This route reads live DB state through a synchronous driver —
  // wait for a real request instead of prerendering at build time.
  await connection();

  const providers = await listEnabledProviders();

  return json(ProviderSummariesSchema, providers.map(({ id, name }) => ({ id, name })));
};
