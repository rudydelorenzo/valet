import { db } from "@/lib/db";
import { oidcProviders, type OidcProvider as OidcProviderRow } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// ── Read ──────────────────────────────────────────────────────────

/**
 * Fetch a provider by ID (full row, including the client secret —
 * needed for the OIDC token exchange). Pass through `toPublicProvider`
 * (lib/helpers) before returning one over the API.
 */
export const getProvider = async (id: OidcProviderRow["id"]) => {
  const [provider] = await db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.id, id))
    .limit(1);
  return provider ?? null;
};

/** List all providers, newest first. */
export const listProviders = async () => {
  return db
    .select()
    .from(oidcProviders)
    .orderBy(desc(oidcProviders.createdAt));
};

/** List enabled providers (used by the login flow). */
export const listEnabledProviders = async () => {
  return db
    .select()
    .from(oidcProviders)
    .where(eq(oidcProviders.enabled, true));
};

// ── Write ─────────────────────────────────────────────────────────

/** Insert a provider row. */
export const insertOidcProvider = async (
  values: typeof oidcProviders.$inferInsert,
) => {
  const [provider] = await db.insert(oidcProviders).values(values).returning();
  return provider;
};

/** Patch a provider row. */
export const updateOidcProviderRow = async (
  id: OidcProviderRow["id"],
  updates: {
    name?: OidcProviderRow["name"];
    issuer?: OidcProviderRow["issuer"];
    clientId?: OidcProviderRow["clientId"];
    clientSecret?: OidcProviderRow["clientSecret"];
    scopes?: OidcProviderRow["scopes"];
    skipEmailVerification?: OidcProviderRow["skipEmailVerification"];
    enabled?: OidcProviderRow["enabled"];
  },
): Promise<OidcProviderRow | null> => {
  const [updated] = await db
    .update(oidcProviders)
    .set(updates)
    .where(eq(oidcProviders.id, id))
    .returning();
  return updated ?? null;
};

/** Delete a provider by ID. */
export const deleteProvider = async (id: OidcProviderRow["id"]) => {
  const [deleted] = await db
    .delete(oidcProviders)
    .where(eq(oidcProviders.id, id))
    .returning();
  return deleted ?? null;
};
