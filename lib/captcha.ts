/**
 * Server-side reCAPTCHA verification (classic v3, score-based).
 *
 * Calls Google's siteverify endpoint:
 *   POST https://www.google.com/recaptcha/api/siteverify
 *   body: secret=<RECAPTCHA_SECRET_KEY>&response=<token>
 *
 * Returns `{ ok: true }` when:
 *   - RECAPTCHA_ENABLED is false (feature flag off → all tokens pass through), OR
 *   - the token is valid, the action matches (v3), and the risk score >=
 *     RECAPTCHA_MIN_SCORE (v3). For v2 keys (no score/action in the response)
 *     a successful verification alone is accepted.
 */
import { env } from "@/lib/env";

export interface CaptchaResult {
  ok: boolean;
  score?: number;
  reason?: string;
}

const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export async function verifyRecaptchaToken(
  token: string | undefined,
  expectedAction: string
): Promise<CaptchaResult> {
  if (!env.RECAPTCHA_ENABLED) return { ok: true };

  if (!token) return { ok: false, reason: "missing_token" };
  if (!env.RECAPTCHA_SECRET_KEY || !env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    return { ok: false, reason: "captcha_not_configured" };
  }

  const body = new URLSearchParams();
  body.set("secret", env.RECAPTCHA_SECRET_KEY);
  body.set("response", token);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) return { ok: false, reason: `http_${res.status}` };

  const data = (await res.json()) as {
    success?: boolean;
    score?: number;
    action?: string;
    "error-codes"?: string[];
  };

  if (!data.success) {
    const codes = data["error-codes"];
    return {
      ok: false,
      reason: `invalid_token:${codes && codes.length ? codes.join(",") : "unknown"}`,
    };
  }

  // v3 keys return an action + score; v2 keys do not. Only enforce each check
  // when the field is actually present so this works for either key type.
  const score = typeof data.score === "number" ? data.score : undefined;

  if (typeof data.action === "string" && data.action !== expectedAction) {
    return { ok: false, reason: "action_mismatch", score };
  }
  if (typeof score === "number" && score < env.RECAPTCHA_MIN_SCORE) {
    return { ok: false, reason: "low_score", score };
  }

  return { ok: true, score };
}
