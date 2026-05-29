/**
 * Lightweight fixed-window rate limiter on top of the existing @upstash/redis
 * client. No new dependency required.
 *
 * Algorithm:
 *   key = rate:<bucket>:<id>:<floor(now / window)>
 *   INCR · if it returns 1, EXPIRE for the window.
 *   Allow if count <= max.
 *
 * Fixed windows can let through 2*max requests at a window boundary, which
 * is acceptable for the security-y use cases here (brute-force suppression,
 * spam suppression). For stricter guarantees swap to sliding window later.
 *
 * Returns the limit/remaining/retryAfter so callers can set the standard
 * X-RateLimit-* response headers.
 */
import { keys, redis } from "@/lib/redis";

export interface RateLimitOptions {
  /** Logical group (e.g. "auth:login"). */
  bucket: string;
  /** Identifier — usually an IP, an email, or a user id. */
  id: string;
  /** Max requests per window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

export async function rateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % opts.windowSec);
  const key = keys.rate(
    opts.bucket,
    `${opts.id}:${windowStart}`
  );

  const count = (await redis.incr(key)) as number;
  if (count === 1) {
    await redis.expire(key, opts.windowSec);
  }
  const remaining = Math.max(0, opts.max - count);
  const retryAfter = Math.max(0, windowStart + opts.windowSec - nowSec);
  return {
    ok: count <= opts.max,
    remaining,
    limit: opts.max,
    retryAfter,
  };
}

/** Extract a best-guess client IP for keying. Falls back to "unknown" so
 *  every unidentifiable request shares one bucket — which is fine, the
 *  legitimate ones won't trip it. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Builds the response headers describing limit state. */
export function rateLimitHeaders(r: RateLimitResult): Headers {
  const h = new Headers();
  h.set("X-RateLimit-Limit", String(r.limit));
  h.set("X-RateLimit-Remaining", String(r.remaining));
  if (!r.ok) h.set("Retry-After", String(r.retryAfter));
  return h;
}
