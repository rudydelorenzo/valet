import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  JWT_ISSUER,
  JWT_ALGORITHM,
} from "@/lib/constants";
import { getSecret } from "@/lib/auth/secret";

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
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer(JWT_ISSUER)
    .sign(getSecret());
};

export const verifySessionJwt = async (
  token: string,
): Promise<SessionPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: JWT_ISSUER,
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
};

/** Read the current session from the cookie. Returns null if absent or invalid. */
export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionJwt(token);
};

/** Set the session cookie (called after successful OIDC callback). */
export const setSessionCookie = async (jwt: string): Promise<void> => {
  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

/** Clear the session cookie. */
export const clearSessionCookie = async (): Promise<void> => {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
};