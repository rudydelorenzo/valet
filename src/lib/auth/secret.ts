import { DEV_SECRET_FALLBACK } from "@/lib/constants";

/**
 * Shared secret resolver — reads AUTH_SECRET from the environment.
 * Falls back to a dev-only default outside production.
 */
export const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set");
    }
    return new TextEncoder().encode(DEV_SECRET_FALLBACK);
  }
  return new TextEncoder().encode(secret);
};