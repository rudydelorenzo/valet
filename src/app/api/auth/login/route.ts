import { NextRequest, NextResponse } from "next/server";
import { getProvider, listEnabledProviders } from "@/lib/db/oidc-providers";
import {
  discover,
  buildAuthorizationUrl,
  generateCodeVerifier,
  generateCodeChallenge,
  setPKCECookie,
} from "@/lib/auth/oidc";
import { CALLBACK_PATH } from "@/lib/constants";

export const GET = async (request: NextRequest) => {
  const providerId = request.nextUrl.searchParams.get("provider");

  // If no provider specified, check how many exist
  if (!providerId) {
    const providers = await listEnabledProviders();

    if (providers.length === 0) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    if (providers.length === 1) {
      // Auto-redirect to the single provider
      return NextResponse.redirect(
        new URL(`/api/auth/login?provider=${providers[0].id}`, request.url),
      );
    }
    // Multiple — show selection page
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Load the specified provider
  const provider = await getProvider(providerId);

  if (!provider || !provider.enabled) {
    return NextResponse.redirect(new URL("/login?error=Provider+not+found", request.url));
  }

  try {
    const discovery = await discover(provider.issuer);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier();

    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}${CALLBACK_PATH}`;

    const authUrl = buildAuthorizationUrl({
      discovery,
      clientId: provider.clientId,
      redirectUri,
      scopes: provider.scopes,
      state,
      codeChallenge,
    });

    await setPKCECookie({
      codeVerifier,
      state,
      providerId: provider.id,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message : "OIDC discovery failed",
    );
    return NextResponse.redirect(new URL(`/login?error=${msg}`, request.url));
  }
};