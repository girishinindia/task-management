/**
 * Auth middleware — Phase 1 stub.
 *
 * Verifies a JWT access token (read from the `access_token` cookie) before
 * letting requests through to /dashboard and /admin. Phase 3 wires the
 * full login flow that sets this cookie. For now, unauthenticated requests
 * are redirected to /login.
 *
 * Note: middleware runs in the Edge runtime; `jose` and Web Crypto are safe
 * there, but `postgres`, `@upstash/redis`, and bcryptjs are NOT — keep those
 * out of this file.
 */
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET ?? ""
);

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const ADMIN_PREFIX = "/admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("access_token")?.value;
  if (!token) return redirectToLogin(req);

  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      issuer: "task-portal",
      audience: "task-portal-app",
    });

    if (pathname.startsWith(ADMIN_PREFIX) && payload.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
