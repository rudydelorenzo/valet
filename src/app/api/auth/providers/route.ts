import { NextResponse } from "next/server";
import { listEnabledProviders } from "@/lib/db/oidc-providers";
import type { ProviderSummary } from "@/lib/db/types";

/**
 * GET — list enabled providers (public, used by the login page).
 * Only exposes name and id — never secrets.
 */
export const GET = async (): Promise<NextResponse<ProviderSummary[]>> => {
  const providers = await listEnabledProviders();

  return NextResponse.json(providers.map(({ id, name }) => ({ id, name })));
};