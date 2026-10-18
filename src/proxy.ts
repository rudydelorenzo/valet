import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, JWT_ISSUER } from "@/lib/constants";
import { getSecret } from "@/lib/auth/secret";

const PUBLIC_PREFIXES = [
  "/api/hooks/",   // inbound webhook receiver
  "/api/auth/",    // login / callback / logout / session
  "/api/setup",    // setup code verification
  "/setup",        // setup page
  "/_next/",       // Next.js internals
  "/favicon",
];

export const proxy = async (request: NextRequest) => {
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
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret(), { issuer: JWT_ISSUER });
    return NextResponse.next();
  } catch {
    // Invalid or expired — clear and redirect to login
    const res = NextResponse.redirect(new URL("/api/auth/login", request.url));
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};