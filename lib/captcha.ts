/**
 * Server-side reCAPTCHA Enterprise verification.
 *
 * Calls the Google Cloud reCAPTCHA Enterprise REST API:
 *   POST https://recaptchaenterprise.googleapis.com/v1/projects/{PROJECT}/assessments?key={API_KEY}
 *
 * Returns `{ ok: true }` when:
 *   - RECAPTCHA_ENABLED is false (feature flag off → all tokens pass through), OR
 *   - the token is valid, the action matches, and the risk score >= RECAPTCHA_MIN_SCORE.
 */
import { env } from "@/lib/env";

export interface CaptchaResult {
  ok: boolean;
  score?: number;
  reason?: string;
}

export async function verifyRecaptchaToken(
  token: string | undefined,
  expectedAction: string
): Promise<CaptchaResult> {
  if (!env.RECAPTCHA_ENABLED) return { ok: true };

  if (!token) return { ok: false, reason: "missing_token" };
  if (
    !env.RECAPTCHA_API_KEY ||
    !env.RECAPTCHA_PROJECT_ID ||
    !env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  ) {
    return { ok: false, reason: "captcha_not_configured" };
  }

  const url =
    `https://recaptchaenterprise.googleapis.com/v1/projects/${env.RECAPTCHA_PROJECT_ID}` +
    `/assessments?key=${env.RECAPTCHA_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: {
          token,
          siteKey: env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          expectedAction,
        },
      }),
    });
  } catch (e) {
    return { ok: false, reason: "network_error" };
  }

  if (!res.ok) return { ok: false, reason: `http_${res.status}` };

  const data = (await res.json()) as {
    tokenProperties?: {
      valid?: boolean;
      action?: string;
      invalidReason?: string;
    };
    riskAnalysis?: { score?: number };
  };

  const valid = data.tokenProperties?.valid;
  const action = data.tokenProperties?.action;
  const score = data.riskAnalysis?.score ?? 0;

  if (!valid)
    return {
      ok: false,
      reason: `invalid_token:${data.tokenProperties?.invalidReason ?? "unknown"}`,
    };
  if (action !== expectedAction)
    return { ok: false, reason: "action_mismatch", score };
  if (score < env.RECAPTCHA_MIN_SCORE)
    return { ok: false, reason: "low_score", score };

  return { ok: true, score };
}
