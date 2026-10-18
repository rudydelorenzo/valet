import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "valet.session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
      );
    }
    // Dev default — fine for local development, never use in production
    return new TextEncoder().encode("valet-dev-secret-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
};

export interface SessionPayload extends JWTPayload {
  sub: string; // provider user id
  email: string;
  name: string;
  providerId: string;
}

export const createSessionJwt = async (
  payload: Omit<SessionPayload, "iat" | "exp" | "iss">,
): Promise<string> => {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .setIssuer("valet")
    .sign(getSecret());
};

export const verifySessionJwt = async (
  token: string,
): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "valet",
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
};

/** Read the current session from the cookie. Returns null if absent or invalid. */
export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionJwt(token);
};

/** Set the session cookie (called after successful OIDC callback). */
export const setSessionCookie = async (jwt: string): Promise<void> => {
  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
};

/** Clear the session cookie. */
export const clearSessionCookie = async (): Promise<void> => {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
};