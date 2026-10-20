import { hasAnyProvider } from "@/lib/db/oidc-providers";
import { getOrGenerateSetupCode, verifySetupCode } from "@/lib/setup";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSecret } from "@/lib/auth/secret";
import { SETUP_COOKIE, JWT_ISSUER, SETUP_COOKIE_MAX_AGE_SECONDS } from "@/lib/constants";
import { json, parseBody } from "@/lib/http";
import {
  ApiErrorSchema,
  OkSchema,
  SetupCodeSchema,
  SetupStatusSchema,
  type ApiError,
  type SetupStatus,
} from "@/types/api";
import { NextResponse } from "next/server";

/**
 * GET — check setup status.
 * - { configured: true }                → providers exist, go to /
 * - { configured: false, verified: true } → setup cookie valid, go to /admin/settings
 * - { configured: false, verified: false } → need to enter the code
 */
export const GET = async (): Promise<NextResponse<SetupStatus>> => {
  try {
    if (await hasAnyProvider()) {
      return json(SetupStatusSchema, { configured: true });
    }
  } catch {
    // DB not reachable — treat as unconfigured
  }

  // Check if the user already verified via setup cookie
  const store = await cookies();
  const setupToken = store.get(SETUP_COOKIE)?.value;
  if (setupToken) {
    try {
      await jwtVerify(setupToken, getSecret(), { issuer: JWT_ISSUER });
      // Verified but no provider — let the frontend show the provider step
      return json(SetupStatusSchema, { configured: false, verified: true });
    } catch {
      // Expired or invalid — fall through
    }
  }

  getOrGenerateSetupCode();
  return json(SetupStatusSchema, { configured: false, verified: false });
};

/**
 * POST — verify the setup code and set a signed, short-lived JWT cookie
 * that grants access to /admin during initial configuration.
 */
export const POST = async (
  request: Request,
): Promise<NextResponse<{ ok: boolean } | ApiError>> => {
  const body = await parseBody(request, SetupCodeSchema);
  if (body instanceof NextResponse) return body;

  if (!verifySetupCode(body.code)) {
    return json(ApiErrorSchema, { error: "Invalid code" }, { status: 403 });
  }

  const jwt = await new SignJWT({ setup: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setIssuer(JWT_ISSUER)
    .sign(getSecret());

  const response = json(OkSchema, { ok: true });
  response.headers.set(
    "Set-Cookie",
    [
      `${SETUP_COOKIE}=${jwt}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Max-Age=${SETUP_COOKIE_MAX_AGE_SECONDS}`,
    ].join("; "),
  );
  return response;
};
