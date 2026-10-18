/**
 * Lightweight OIDC client — no heavy dependencies.
 * Handles discovery, PKCE auth URL generation, and code → token exchange.
 */

const PKCE_COOKIE = "valet.pkce";
const PKCE_MAX_AGE = 300; // 5 minutes

// ── OIDC discovery ──────────────────────────────────────────────────

export interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}

export const discover = async (issuer: string): Promise<OIDCDiscovery> => {
  const wellKnown = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(wellKnown, { cache: "no-store" });
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  return res.json() as Promise<OIDCDiscovery>;
};

// ── PKCE helpers ────────────────────────────────────────────────────

const BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const randomBase64Url = (len: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => BASE64URL[b % 64]).join("");
};

export const generateCodeVerifier = (): string => randomBase64Url(32);

export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// ── Authorization URL ───────────────────────────────────────────────

export const buildAuthorizationUrl = (params: {
  discovery: OIDCDiscovery;
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
}): string => {
  const url = new URL(params.discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
};

// ── Token exchange + userinfo ────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  [key: string]: unknown;
}

export const exchangeCode = async (params: {
  discovery: OIDCDiscovery;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ tokens: TokenResponse; userinfo: UserInfo }> => {
  // Exchange code for tokens
  const tokenRes = await fetch(params.discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
  }

  const tokens = (await tokenRes.json()) as TokenResponse;

  // Fetch userinfo
  let userinfo: UserInfo = { sub: "unknown" };
  try {
    const infoRes = await fetch(params.discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) {
      userinfo = (await infoRes.json()) as UserInfo;
    }
  } catch {
    // userinfo is optional — fall back to id_token claims if available
  }

  return { tokens, userinfo };
};

// ── PKCE cookie helpers ─────────────────────────────────────────────

export interface PKCEData {
  codeVerifier: string;
  state: string;
  providerId: string;
}

export const setPKCECookie = async (data: PKCEData): Promise<void> => {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(PKCE_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PKCE_MAX_AGE,
  });
};

export const getPKCEData = async (): Promise<PKCEData | null> => {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(PKCE_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PKCEData;
  } catch {
    return null;
  }
};

export const clearPKCECookie = async (): Promise<void> => {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(PKCE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
};