import { cookies } from "next/headers";
import { verifyRefresh } from "@/lib/jwt";
import { getRefresh, revokeRefresh } from "@/lib/redis";
import { findUserById } from "@/lib/dao/users";
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  revokeAllForUser,
} from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Generous cap — legitimate clients may rotate frequently — but a runaway
  // loop can't melt Redis.
  const ip = clientIp(req);
  const limit = await rateLimit({
    bucket: "auth:refresh",
    id: ip,
    max: 30,
    windowSec: 60,
  });
  if (!limit.ok) {
    return apiError(
      "rate_limited",
      "Too many refresh attempts.",
      429,
      { retry_after: limit.retryAfter }
    );
  }

  const token = cookies().get(REFRESH_COOKIE)?.value;
  if (!token) {
    return apiError("no_refresh_token", "Not signed in", 401);
  }

  let claims;
  try {
    claims = await verifyRefresh(token);
  } catch {
    await clearAuthCookies();
    return apiError("refresh_invalid", "Refresh token is invalid", 401);
  }

  const stored = await getRefresh(claims.jti);
  if (!stored) {
    // Phase 12: the JWT signed correctly and the jti is missing from Redis.
    // Two innocent explanations (user logged out; jti expired naturally) and
    // one bad one (rotated jti is being replayed — a leaked refresh token).
    // We can't tell them apart, so we take the safe path: revoke EVERY active
    // session + refresh token for this user. Honest user re-logs once.
    // Attacker is locked out of the entire family across every device.
    await revokeAllForUser(claims.sub);
    await clearAuthCookies();
    return apiError(
      "refresh_revoked",
      "Session has been revoked. Please sign in again.",
      401
    );
  }

  const user = await findUserById(claims.sub);
  if (!user || !user.is_active) {
    await clearAuthCookies();
    return apiError("user_inactive", "Account is inactive", 401);
  }

  // Rotate: invalidate the old refresh-token jti and issue a new pair.
  await revokeRefresh(claims.jti, claims.sub);
  await setAuthCookies({
    userId: user.id,
    email: user.email,
    role: user.role,
    refreshFamily: claims.family,
  });

  return apiOk({});
}
