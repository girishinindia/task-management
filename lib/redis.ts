/**
 * Redis client for sessions, refresh tokens, OTP, and short-lived cache.
 *
 * Uses the @upstash/redis HTTP client which works in every Next.js runtime
 * (node, edge, serverless) without keeping a persistent socket.
 *
 * Required env:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * If you only have the rediss:// URL from Upstash, grab the matching REST URL +
 * token from the same database's "REST API" tab in the Upstash console.
 */
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn(
    "[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. " +
      "Redis-backed features (sessions, OTP, cache) will fail until they are."
  );
}

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL ?? "https://example.upstash.io",
  token: env.UPSTASH_REDIS_REST_TOKEN ?? "missing",
});

// ── Key conventions ────────────────────────────────────────────────────────
export const keys = {
  /** Per-user active access-token session. value = { userId, role, createdAt } */
  session: (jti: string) => `sess:${jti}`,
  /** Per-user refresh-token whitelist. value = { userId, family, createdAt } */
  refresh: (jti: string) => `refresh:${jti}`,
  /** All active session jtis for a user (set). Used for "log out everywhere". */
  userSessions: (userId: string) => `user:${userId}:sessions`,
  /** All active refresh-token jtis for a user (set). Used for family-reuse
   *  detection and "log out everywhere" on the refresh tier. */
  userRefreshTokens: (userId: string) => `user:${userId}:refreshes`,
  /** Email OTP / verification code. value = code, ttl = REDIS_OTP_TTL */
  otp: (email: string, purpose: string) => `otp:${purpose}:${email.toLowerCase()}`,
  /** Generic cache. */
  cache: (ns: string, key: string) => `cache:${ns}:${key}`,
  /** Rate limiter buckets. */
  rate: (bucket: string, id: string) => `rate:${bucket}:${id}`,
};

// ── High-level helpers ─────────────────────────────────────────────────────

export async function setSession(
  jti: string,
  userId: string,
  role: string
): Promise<void> {
  await redis.set(
    keys.session(jti),
    JSON.stringify({ userId, role, createdAt: Date.now() }),
    { ex: env.REDIS_SESSION_TTL }
  );
  await redis.sadd(keys.userSessions(userId), jti);
}

export async function getSession(jti: string) {
  const raw = await redis.get<string>(keys.session(jti));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function revokeSession(jti: string, userId?: string) {
  await redis.del(keys.session(jti));
  if (userId) await redis.srem(keys.userSessions(userId), jti);
}

export async function revokeAllSessions(userId: string) {
  const jtis = (await redis.smembers(keys.userSessions(userId))) as string[];
  if (jtis.length) {
    await redis.del(...jtis.map(keys.session));
  }
  await redis.del(keys.userSessions(userId));
}

// ── Refresh tokens ─────────────────────────────────────────────────────────
// Refresh tokens are whitelisted in Redis. If a refresh-token jti is missing
// from Redis, treat it as revoked even if the JWT signature is still valid.
//
// Phase 12: TTL derived from env so it can't drift from JWT_REFRESH_EXPIRES_IN.
function parseDurationSeconds(input: string, fallback: number): number {
  // "7d" / "12h" / "30m" / "60s" / "3600" (raw seconds)
  const m = input.trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] ?? "s").toLowerCase();
  const mult =
    unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  return n * mult;
}

const REFRESH_TTL_SECONDS = parseDurationSeconds(
  env.JWT_REFRESH_EXPIRES_IN,
  7 * 24 * 60 * 60
);

export async function setRefresh(
  jti: string,
  userId: string,
  family: string
): Promise<void> {
  await redis.set(
    keys.refresh(jti),
    JSON.stringify({ userId, family, createdAt: Date.now() }),
    { ex: REFRESH_TTL_SECONDS }
  );
  await redis.sadd(keys.userRefreshTokens(userId), jti);
}

export async function getRefresh(jti: string) {
  const raw = await redis.get<string>(keys.refresh(jti));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function revokeRefresh(
  jti: string,
  userId?: string
): Promise<void> {
  await redis.del(keys.refresh(jti));
  if (userId) await redis.srem(keys.userRefreshTokens(userId), jti);
}

/** Wipe every refresh token for a user. Use in family-reuse detection and
 *  in admin-driven deactivation. */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const jtis = (await redis.smembers(
    keys.userRefreshTokens(userId)
  )) as string[];
  if (jtis.length) {
    await redis.del(...jtis.map(keys.refresh));
  }
  await redis.del(keys.userRefreshTokens(userId));
}

export async function setOtp(email: string, purpose: string, code: string) {
  await redis.set(keys.otp(email, purpose), code, { ex: env.REDIS_OTP_TTL });
}

export async function consumeOtp(
  email: string,
  purpose: string,
  code: string
): Promise<boolean> {
  const stored = await redis.get<string>(keys.otp(email, purpose));
  if (!stored || stored !== code) return false;
  await redis.del(keys.otp(email, purpose));
  return true;
}
