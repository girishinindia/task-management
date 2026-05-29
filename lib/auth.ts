/**
 * Server-side auth helpers — used by API routes, server components, and
 * layouts that need to know who's making the request.
 *
 * Two-cookie pattern:
 *   access_token   (15m, sent on every request)
 *   refresh_token  (7d,  sent on every request — kept simple; can be path-scoped later)
 *
 * Both are httpOnly + Lax + Secure-in-production. Every token has a `jti`
 * and is mirrored in Redis so we can revoke individual sessions and "log
 * out everywhere".
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
  type UserRole,
} from "@/lib/jwt";
import {
  setSession,
  setRefresh,
  getSession,
  revokeSession,
  revokeRefresh,
  revokeAllRefreshTokens,
  revokeAllSessions,
} from "@/lib/redis";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const ACCESS_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Issues a new access + refresh token pair, stores them in Redis, and writes
 *  both cookies. Call this from login / signup / refresh. */
export async function setAuthCookies(input: {
  userId: string;
  email: string;
  role: UserRole;
  refreshFamily?: string; // pass through during rotation
}) {
  const access = await signAccessToken({
    userId: input.userId,
    email: input.email,
    role: input.role,
  });
  const refresh = await signRefreshToken({
    userId: input.userId,
    family: input.refreshFamily,
  });

  await setSession(access.jti, input.userId, input.role);
  await setRefresh(refresh.jti, input.userId, refresh.family);

  const jar = cookies();
  jar.set(ACCESS_COOKIE, access.token, cookieOptions(ACCESS_MAX_AGE));
  jar.set(REFRESH_COOKIE, refresh.token, cookieOptions(REFRESH_MAX_AGE));

  return { access, refresh };
}

export async function clearAuthCookies() {
  const jar = cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
  jti: string;
}

/** Returns the current user from cookies or null. Validates BOTH the JWT
 *  signature/expiry AND the Redis session record. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  let claims;
  try {
    claims = await verifyAccess(token);
  } catch {
    return null;
  }

  const session = await getSession(claims.jti);
  if (!session) return null;

  return {
    userId: claims.sub,
    email: claims.email,
    role: claims.role,
    jti: claims.jti,
  };
}

/** Redirects to /login if there's no current user. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** Redirects to /dashboard if not admin (or /login if not signed in). */
export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/dashboard");
  return u;
}

/** Revoke the current session: drop both cookies and remove the session row
 *  + refresh-token jti from Redis.
 *
 *  Phase 12: now actually revokes the refresh-token jti (the comment in this
 *  function used to admit we didn't). A leaked refresh token can no longer
 *  resume a session after the user logs out. */
export async function revokeCurrentSession() {
  const jar = cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      const claims = await verifyAccess(accessToken);
      await revokeSession(claims.jti, claims.sub);
    } catch {
      // ignore — token was bad, cookie will be cleared anyway
    }
  }

  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const claims = await verifyRefresh(refreshToken);
      await revokeRefresh(claims.jti, claims.sub);
    } catch {
      // ignore — token was bad, cookie will be cleared anyway
    }
  }

  await clearAuthCookies();
}

/** Used by the refresh endpoint to drop a specific refresh-token jti. */
export async function revokeRefreshJti(jti: string, userId?: string) {
  await revokeRefresh(jti, userId);
}

/** Family-reuse signal: nuke every active refresh + session for the user. */
export async function revokeAllForUser(userId: string) {
  await Promise.all([
    revokeAllRefreshTokens(userId),
    revokeAllSessions(userId),
  ]);
}
