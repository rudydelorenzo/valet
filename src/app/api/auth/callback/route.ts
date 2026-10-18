import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  discover,
  exchangeCode,
  getPKCEData,
  clearPKCECookie,
} from "@/lib/auth/oidc";
import { createSessionJwt, setSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, CALLBACK_PATH } from "@/lib/constants";

export const GET = async (request: NextRequest) => {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(url.searchParams.get("error_description") || error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=Missing+code+or+state", request.url));
  }

  // Retrieve PKCE data from cookie
  const pkce = await getPKCEData();
  await clearPKCECookie();

  if (!pkce || pkce.state !== state) {
    return NextResponse.redirect(new URL("/?error=Invalid+or+expired+session", request.url));
  }

  // Load the provider
  const [provider] = await db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.id, pkce.providerId))
    .limit(1);

  if (!provider) {
    return NextResponse.redirect(new URL("/?error=Provider+not+found", request.url));
  }

  try {
    const discovery = await discover(provider.issuer);
    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}${CALLBACK_PATH}`;

    const { userinfo } = await exchangeCode({
      discovery,
      clientId: provider.clientId,
      clientSecret: provider.clientSecret,
      code,
      redirectUri,
      codeVerifier: pkce.codeVerifier,
    });

    // Create session
    const jwt = await createSessionJwt({
      sub: userinfo.sub,
      email: userinfo.email ?? "",
      name: userinfo.name ?? userinfo.preferred_username ?? userinfo.email ?? "User",
      providerId: provider.id,
    });

    const response = NextResponse.redirect(new URL("/", request.url));
    // Set session cookie on the redirect response
    response.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message : "Authentication failed",
    );
    return NextResponse.redirect(new URL(`/?error=${msg}`, request.url));
  }
};