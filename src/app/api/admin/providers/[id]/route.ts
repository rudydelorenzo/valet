import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { discover } from "@/lib/auth/oidc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [provider] = await db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.id, id))
    .limit(1);

  if (!provider) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Never expose the client secret
  const { clientSecret, ...safe } = provider;
  return Response.json(safe);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.issuer !== undefined) updates.issuer = body.issuer;
  if (body.clientId !== undefined) updates.clientId = body.clientId;
  if (body.clientSecret !== undefined) updates.clientSecret = body.clientSecret;
  if (body.scopes !== undefined) updates.scopes = body.scopes;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  // Validate issuer if changed
  if (updates.issuer) {
    try {
      await discover(updates.issuer as string);
    } catch {
      return Response.json(
        { error: "Could not discover OIDC endpoints at the given issuer URL" },
        { status: 400 },
      );
    }
  }

  const [updated] = await db
    .update(oidcProviders)
    .set(updates)
    .where(eq(oidcProviders.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deleted] = await db
    .delete(oidcProviders)
    .where(eq(oidcProviders.id, id))
    .returning();

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}