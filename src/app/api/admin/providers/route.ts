import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_OIDC_SCOPES } from "@/lib/constants";
import { normalizeScopes } from "@/lib/oidc-scopes";
import { discover } from "@/lib/auth/oidc";

export const GET = async () => {
  const providers = await db
    .select({
      id: oidcProviders.id,
      name: oidcProviders.name,
      issuer: oidcProviders.issuer,
      clientId: oidcProviders.clientId,
      scopes: oidcProviders.scopes,
      skipEmailVerification: oidcProviders.skipEmailVerification,
      enabled: oidcProviders.enabled,
      createdAt: oidcProviders.createdAt,
    })
    .from(oidcProviders)
    .orderBy(desc(oidcProviders.createdAt));

  return Response.json(providers);
};

export const POST = async (request: Request) => {
  const body = await request.json();
  const { name, issuer, clientId, clientSecret, scopes, skipEmailVerification } = body as {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
    skipEmailVerification?: boolean;
  };

  if (!name || !issuer || !clientId || !clientSecret) {
    return Response.json(
      { error: "name, issuer, clientId, and clientSecret are required" },
      { status: 400 },
    );
  }

  // Validate that the issuer is a real OIDC provider
  try {
    await discover(issuer);
  } catch {
    return Response.json(
      { error: "Could not discover OIDC endpoints at the given issuer URL" },
      { status: 400 },
    );
  }

  const [provider] = await db
    .insert(oidcProviders)
    .values({
      name,
      issuer,
      clientId,
      clientSecret,
      scopes: normalizeScopes(scopes || DEFAULT_OIDC_SCOPES),
      skipEmailVerification: skipEmailVerification ?? false,
    })
    .returning();

  return Response.json(provider, { status: 201 });
};