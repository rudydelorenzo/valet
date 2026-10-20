import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSecret } from "@/lib/auth/secret";
import { SESSION_COOKIE } from "@/lib/constants";

const PUBLIC_PREFIXES = [
  "/api/deploy/",    // inbound webhook receiver
  "/api/auth/",    // login / callback / logout / session / providers
  "/api/setup",    // setup flow
  "/setup",        // setup page
  "/login",        // login page
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "valet" });
    const session = payload as { isAdmin?: boolean };

    // Admin routes require isAdmin
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (!session.isAdmin) {
        return NextResponse.redirect(new URL("/?error=Admin+access+required", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired — clear and redirect to login
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};