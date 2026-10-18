import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "valet.session";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set");
    }
    return new TextEncoder().encode("valet-dev-secret-do-not-use-in-prod");
  }
  return new TextEncoder().encode(secret);
}

const PUBLIC_PREFIXES = [
  "/api/hooks/",   // inbound webhook receiver
  "/api/auth/",    // login / callback / logout / session
  "/_next/",       // Next.js internals
  "/favicon",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.match(/\.(svg|png|jpg|ico|css|js|woff2?)$/)) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret(), { issuer: "valet" });
    return NextResponse.next();
  } catch {
    // Invalid or expired — clear and redirect to login
    const res = NextResponse.redirect(new URL("/api/auth/login", request.url));
    res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};