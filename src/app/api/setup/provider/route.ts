import { NextResponse } from "next/server";
import {
  createProvider,
  hasAnyProvider,
  toPublicProvider,
} from "@/lib/db/oidc-providers";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { discover } from "@/lib/auth/oidc";
import { getSecret } from "@/lib/auth/secret";
import { SETUP_COOKIE, JWT_ISSUER } from "@/lib/constants";
import type { OidcProvider } from "@/lib/db/types";
import type { ApiError } from "@/types/api";

/**
 * POST — add the first OIDC provider during initial setup.
 *
 * Security:
 * - Requires a valid, unexpired valet.setup JWT cookie.
 * - Rejects if any provider already exists (one-time-only operation).
 */
export const POST = async (
  request: Request,
): Promise<NextResponse<OidcProvider | ApiError>> => {
  // 1. Verify setup cookie
  const store = await cookies();
  const setupToken = store.get(SETUP_COOKIE)?.value;
  if (!setupToken) {
    return NextResponse.json(
      { error: "Setup token required" },
      { status: 401 },
    );
  }

  try {
    await jwtVerify(setupToken, getSecret(), { issuer: JWT_ISSUER });
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired setup token" },
      { status: 401 },
    );
  }

  // 2. Ensure no providers exist yet
  if (await hasAnyProvider()) {
    return NextResponse.json(
      { error: "An identity provider is already configured" },
      { status: 409 },
    );
  }

  // 3. Parse and validate body
  const body = (await request.json()) as {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
    skipEmailVerification?: boolean;
  };

  const { name, issuer, clientId, clientSecret, scopes, skipEmailVerification } = body;

  if (!name || !issuer || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "name, issuer, clientId, and clientSecret are required" },
      { status: 400 },
    );
  }

  // 4. Validate OIDC discovery
  try {
    await discover(issuer);
  } catch {
    return NextResponse.json(
      { error: "Could not discover OIDC endpoints at the given issuer URL" },
      { status: 400 },
    );
  }

  // 5. Create provider
  const provider = await createProvider({
    name,
    issuer,
    clientId,
    clientSecret,
    scopes,
    skipEmailVerification: skipEmailVerification ?? false,
  });

  // Never expose the client secret — the handler's return type enforces
  // the public shape
  return NextResponse.json(toPublicProvider(provider), { status: 201 });
};