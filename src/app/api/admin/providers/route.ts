import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { id } from "@/lib/ids";
import { discover } from "@/lib/auth/oidc";

export async function GET() {
  const providers = await db
    .select({
      id: oidcProviders.id,
      name: oidcProviders.name,
      issuer: oidcProviders.issuer,
      clientId: oidcProviders.clientId,
      scopes: oidcProviders.scopes,
      enabled: oidcProviders.enabled,
      createdAt: oidcProviders.createdAt,
    })
    .from(oidcProviders)
    .orderBy(desc(oidcProviders.createdAt));

  return Response.json(providers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, issuer, clientId, clientSecret, scopes } = body as {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
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
      id: id("prov"),
      name,
      issuer,
      clientId,
      clientSecret,
      scopes: scopes || "openid email profile",
    })
    .returning();

  return Response.json(provider, { status: 201 });
}