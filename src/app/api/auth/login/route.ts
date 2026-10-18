import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  discover,
  buildAuthorizationUrl,
  generateCodeVerifier,
  generateCodeChallenge,
  setPKCECookie,
} from "@/lib/auth/oidc";

export const GET = async (request: NextRequest) => {
  // Find the first enabled provider
  const [provider] = await db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.enabled, true))
    .limit(1);

  if (!provider) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  try {
    const discovery = await discover(provider.issuer);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateCodeVerifier(); // reuse as random state

    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/callback`;

    const authUrl = buildAuthorizationUrl({
      discovery,
      clientId: provider.clientId,
      redirectUri,
      scopes: provider.scopes,
      state,
      codeChallenge,
    });

    // Store PKCE data in a short-lived cookie
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
    return NextResponse.redirect(
      new URL(`/admin/settings?error=${msg}`, request.url),
    );
  }
};