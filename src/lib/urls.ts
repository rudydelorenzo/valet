// ── Navigation URLs ────────────────────────────────────────────────
// The auth endpoints redirect (302) to the external OIDC provider, so they
// must be loaded with full document navigations. Pushing them through the
// client router triggers an RSC fetch that can't follow the cross-origin
// redirect (CORS preflight failure) and only recovers via the browser-nav
// fallback — after double-hitting the login endpoint.

/** Absolute same-origin URL — required for window.location navigation. */
export const absoluteUrl = (path: string): string =>
  new URL(path, window.location.origin).toString();

/** Entry point that starts the OIDC login flow (optionally for one provider). */
export const loginUrl = (providerId?: string): string =>
  absoluteUrl(
    providerId
      ? `/api/auth/login?provider=${encodeURIComponent(providerId)}`
      : "/api/auth/login",
  );
