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
import { json, parseBody } from "@/lib/http";
import { OidcProviderSchema } from "@/types";
import {
  ApiErrorSchema,
  CreateProviderSchema,
  type ApiError,
} from "@/types/api";
import { NextResponse } from "next/server";
import type { OidcProvider } from "@/types";

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
    return json(ApiErrorSchema, { error: "Setup token required" }, { status: 401 });
  }

  try {
    await jwtVerify(setupToken, getSecret(), { issuer: JWT_ISSUER });
  } catch {
    return json(
      ApiErrorSchema,
      { error: "Invalid or expired setup token" },
      { status: 401 },
    );
  }

  // 2. Ensure no providers exist yet
  if (await hasAnyProvider()) {
    return json(
      ApiErrorSchema,
      { error: "An identity provider is already configured" },
      { status: 409 },
    );
  }

  // 3. Parse and validate body
  const parsed = await parseBody(request, CreateProviderSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { name, issuer, clientId, clientSecret, scopes, skipEmailVerification } = parsed;

  // 4. Validate OIDC discovery
  try {
    await discover(issuer);
  } catch {
    return json(
      ApiErrorSchema,
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

  // Never expose the client secret — the schema strips it at the boundary
  return json(OidcProviderSchema, toPublicProvider(provider), { status: 201 });
};