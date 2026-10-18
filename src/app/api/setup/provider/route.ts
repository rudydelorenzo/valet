import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { discover } from "@/lib/auth/oidc";
import { getSecret } from "@/lib/auth/secret";
import { SETUP_COOKIE, JWT_ISSUER, DEFAULT_OIDC_SCOPES } from "@/lib/constants";

/**
 * POST — add the first OIDC provider during initial setup.
 *
 * Security:
 * - Requires a valid, unexpired valet.setup JWT cookie.
 * - Rejects if any provider already exists (one-time-only operation).
 */
export const POST = async (request: Request) => {
  // 1. Verify setup cookie
  const store = await cookies();
  const setupToken = store.get(SETUP_COOKIE)?.value;
  if (!setupToken) {
    return Response.json(
      { error: "Setup token required" },
      { status: 401 },
    );
  }

  try {
    await jwtVerify(setupToken, getSecret(), { issuer: JWT_ISSUER });
  } catch {
    return Response.json(
      { error: "Invalid or expired setup token" },
      { status: 401 },
    );
  }

  // 2. Ensure no providers exist yet
  const existing = await db.select().from(oidcProviders).limit(1);
  if (existing.length > 0) {
    return Response.json(
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
  };

  const { name, issuer, clientId, clientSecret, scopes } = body;

  if (!name || !issuer || !clientId || !clientSecret) {
    return Response.json(
      { error: "name, issuer, clientId, and clientSecret are required" },
      { status: 400 },
    );
  }

  // 4. Validate OIDC discovery
  try {
    await discover(issuer);
  } catch {
    return Response.json(
      { error: "Could not discover OIDC endpoints at the given issuer URL" },
      { status: 400 },
    );
  }

  // 5. Create provider
  const [provider] = await db
    .insert(oidcProviders)
    .values({
      name,
      issuer,
      clientId,
      clientSecret,
      scopes: scopes || DEFAULT_OIDC_SCOPES,
    })
    .returning();

  return Response.json(provider, { status: 201 });
};