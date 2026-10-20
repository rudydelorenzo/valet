import { z } from "zod";
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
  const providers = await listEnabledProviders();

  return json(ProviderSummariesSchema, providers.map(({ id, name }) => ({ id, name })));
};
