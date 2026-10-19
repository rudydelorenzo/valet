import { REQUIRED_OIDC_SCOPES } from "@/lib/constants";

// ── OIDC scope helpers ─────────────────────────────────────────────
// Scopes are stored as a space-delimited string end-to-end. These helpers
// are shared by the client (scope picker) and the API routes so the
// required scopes can never be dropped.

/** Split a space- or comma-delimited scope string into individual scopes. */
export const parseScopes = (scopes: string): string[] =>
  scopes.split(/[\s,]+/).filter(Boolean);

/**
 * Canonicalize a scope string: required scopes are always present and come
 * first, extras follow in their original order without duplicates.
 */
export const normalizeScopes = (scopes: string): string => {
  const extras = Array.from(
    new Set(
      parseScopes(scopes).filter(
        (scope) => !REQUIRED_OIDC_SCOPES.includes(scope),
      ),
    ),
  );
  return [...REQUIRED_OIDC_SCOPES, ...extras].join(" ");
};
