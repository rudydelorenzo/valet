import { db } from "@/lib/db";
import { oidcProviders } from "@/lib/db/schema";
import { getOrGenerateSetupCode, verifySetupCode } from "@/lib/setup";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set");
    }
    return new TextEncoder().encode("valet-dev-secret-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
};

/**
 * GET — check setup status.
 * - { configured: true }                → providers exist, go to /
 * - { configured: false, verified: true } → setup cookie valid, go to /admin/settings
 * - { configured: false, verified: false } → need to enter the code
 */
export const GET = async () => {
  try {
    const providers = await db.select().from(oidcProviders).limit(1);
    if (providers.length > 0) {
      return Response.json({ configured: true });
    }
  } catch {
    // DB not reachable — treat as unconfigured
  }

  // Check if the user already verified via setup cookie
  const store = await cookies();
  const setupToken = store.get("valet.setup")?.value;
  if (setupToken) {
    try {
      await jwtVerify(setupToken, getSecret(), { issuer: "valet" });
      // Verified but no provider — let the frontend show the provider step
      return Response.json({ configured: false, verified: true });
    } catch {
      // Expired or invalid — fall through
    }
  }

  getOrGenerateSetupCode();
  return Response.json({ configured: false, verified: false });
};

/**
 * POST — verify the setup code and set a signed, short-lived JWT cookie
 * that grants access to /admin during initial configuration.
 */
export const POST = async (request: Request) => {
  const { code } = (await request.json()) as { code?: string };

  if (!code || !verifySetupCode(code)) {
    return Response.json({ error: "Invalid code" }, { status: 403 });
  }

  const jwt = await new SignJWT({ setup: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setIssuer("valet")
    .sign(getSecret());

  const response = Response.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    [
      `valet.setup=${jwt}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=3600",
    ].join("; "),
  );
  return response;
};