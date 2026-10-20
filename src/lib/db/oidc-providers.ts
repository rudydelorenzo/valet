import { db } from "@/lib/db";
import { oidcProviders, type OidcProvider as OidcProviderRow } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DEFAULT_OIDC_SCOPES } from "@/lib/constants";
import { normalizeScopes } from "@/lib/oidc-scopes";
import type { OidcProvider } from "./types";

// ── Public shape ───────────────────────────────────────────────────

/**
 * Whitelist projection that strips the client secret and serializes the
 * provider into its application shape (see ./types) before it is returned
 * over the API. Compile-checked: when the schema gains a column, this
 * must be updated or the build fails.
 */
export const toPublicProvider = (provider: OidcProviderRow): OidcProvider => ({
  id: provider.id,
  name: provider.name,
  issuer: provider.issuer,
  clientId: provider.clientId,
  scopes: provider.scopes,
  skipEmailVerification: provider.skipEmailVerification,
  enabled: provider.enabled,
  createdAt: provider.createdAt.toISOString(),
});

// ── Read ──────────────────────────────────────────────────────────

/**
 * Fetch a provider by ID (full row, including the client secret —
 * needed for the OIDC token exchange). Pass through `toPublicProvider`
 * before returning one over the API.
 */
export const getProvider = async (id: string) => {
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

/** Whether any provider has been configured yet (setup flow). */
export const hasAnyProvider = async (): Promise<boolean> => {
  const [row] = await db
    .select({ id: oidcProviders.id })
    .from(oidcProviders)
    .limit(1);
  return row !== undefined;
};

// ── Write ─────────────────────────────────────────────────────────

/** Create a new provider. Scopes are normalized before storing. */
export const createProvider = async (data: {
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
  skipEmailVerification?: boolean;
}) => {
  const [provider] = await db
    .insert(oidcProviders)
    .values({
      ...data,
      scopes: normalizeScopes(data.scopes || DEFAULT_OIDC_SCOPES),
    })
    .returning();
  return provider;
};

/** Patch a provider. Scopes are normalized before storing. */
export const updateProvider = async (
  id: string,
  updates: {
    name?: string;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
    skipEmailVerification?: boolean;
    enabled?: boolean;
  },
) => {
  const [updated] = await db
    .update(oidcProviders)
    .set(
      updates.scopes !== undefined
        ? { ...updates, scopes: normalizeScopes(updates.scopes) }
        : updates,
    )
    .where(eq(oidcProviders.id, id))
    .returning();
  return updated ?? null;
};

/** Delete a provider by ID. */
export const deleteProvider = async (id: string) => {
  const [deleted] = await db
    .delete(oidcProviders)
    .where(eq(oidcProviders.id, id))
    .returning();
  return deleted ?? null;
};
