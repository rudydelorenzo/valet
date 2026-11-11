import {
  insertOidcProvider,
  updateOidcProviderRow,
  listProviders,
} from "@/lib/db/oidc-providers";
import { DEFAULT_OIDC_SCOPES } from "@/lib/constants";
import { normalizeScopes } from "@/lib/oidc-scopes";
import type { OidcProvider as OidcProviderRow } from "@/lib/db/schema";
import type { OidcProvider } from "@/types";

/** Whether any provider has been configured yet (setup flow). */
export const hasAnyProvider = async (): Promise<boolean> =>
  (await listProviders()).length > 0;

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

/** Create a new provider. Scopes are normalized before storing. */
export const createProvider = async (data: {
  name: OidcProviderRow["name"];
  issuer: OidcProviderRow["issuer"];
  clientId: OidcProviderRow["clientId"];
  clientSecret: OidcProviderRow["clientSecret"];
  scopes?: OidcProviderRow["scopes"];
  skipEmailVerification?: OidcProviderRow["skipEmailVerification"];
}) => {
  return insertOidcProvider({
    ...data,
    scopes: normalizeScopes(data.scopes || DEFAULT_OIDC_SCOPES),
  });
};

/** Patch a provider. Scopes are normalized before storing. */
export const updateProvider = async (
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
) => {
  return updateOidcProviderRow(
    id,
    updates.scopes !== undefined
      ? { ...updates, scopes: normalizeScopes(updates.scopes) }
      : updates,
  );
};
