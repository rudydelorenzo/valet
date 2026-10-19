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
import { createSessionJwt } from "@/lib/auth/session";
import { findOrCreateUser } from "@/lib/auth/user";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  CALLBACK_PATH,
} from "@/lib/constants";

export const GET = async (request: NextRequest) => {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(url.searchParams.get("error_description") || error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=Missing+code+or+state", request.url));
  }

  // Retrieve PKCE data from cookie
  const pkce = await getPKCEData();
  await clearPKCECookie();

  if (!pkce || pkce.state !== state) {
    return NextResponse.redirect(new URL("/login?error=Invalid+or+expired+session", request.url));
  }

  // Load the provider
  const [provider] = await db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.id, pkce.providerId))
    .limit(1);

  if (!provider) {
    return NextResponse.redirect(new URL("/login?error=Provider+not+found", request.url));
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

    // Email is required
    if (!userinfo.email) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Email not provided by identity provider")}&provider=${provider.id}`, request.url),
      );
    }

    // Check email_verified unless the provider skips it
    if (
      !provider.skipEmailVerification &&
      userinfo.email_verified !== true
    ) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Email not verified with your identity provider")}&provider=${provider.id}`, request.url),
      );
    }

    // Find or create user
    const { user } = await findOrCreateUser({
      email: userinfo.email,
      name: userinfo.name ?? userinfo.preferred_username ?? userinfo.email,
      oidcSub: userinfo.sub,
      providerId: provider.id,
    });

    // Create session
    const jwt = await createSessionJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    const response = NextResponse.redirect(new URL("/", request.url));
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
    return NextResponse.redirect(new URL(`/login?error=${msg}&provider=${provider.id}`, request.url));
  }
};