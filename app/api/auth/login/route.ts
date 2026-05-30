import { loginSchema } from "@/lib/schemas/auth";
import { verifyRecaptchaToken } from "@/lib/captcha";
import { authenticate, toPublic, updateLastLogin } from "@/lib/dao/users";
import { setAuthCookies } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { recordAudit } from "@/lib/dao/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Phase 12: brute-force guard. 5 attempts per minute per IP catches the
  // crude case; a second 5/min per email bucket catches the slow-scan case
  // where someone rotates IPs but targets one account.
  const ip = clientIp(req);
  const ipLimit = await rateLimit({
    bucket: "auth:login:ip",
    id: ip,
    max: 5,
    windowSec: 60,
  });
  if (!ipLimit.ok) {
    return apiError(
      "rate_limited",
      "Too many login attempts. Try again in a moment.",
      429,
      { retry_after: ipLimit.retryAfter }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const { email, password, captcha_token } = parsed.data;

  const emailLimit = await rateLimit({
    bucket: "auth:login:email",
    id: email,
    max: 5,
    windowSec: 60,
  });
  if (!emailLimit.ok) {
    return apiError(
      "rate_limited",
      "Too many login attempts for this email. Try again in a moment.",
      429,
      { retry_after: emailLimit.retryAfter }
    );
  }

  const captcha = await verifyRecaptchaToken(captcha_token, "login");
  if (!captcha.ok) {
    return apiError(
      "captcha_failed",
      "Captcha verification failed. Please try again.",
      400,
      { reason: captcha.reason }
    );
  }

  const result = await authenticate(email, password);
  if (!result.ok) {
    await recordAudit({
      action: result.reason === "inactive"
        ? "auth.login_inactive"
        : "auth.login_failed",
      entityType: "auth",
      actorEmail: email,
      summary:
        result.reason === "inactive"
          ? `Deactivated account tried to sign in: ${email}`
          : `Failed login attempt for ${email}`,
      metadata: { reason: result.reason },
      ip,
    });

    // Only a deactivated account that supplied the CORRECT password reaches
    // reason="inactive" — so it's safe to tell them plainly without leaking
    // which emails exist. Wrong password / unknown email stay collapsed into
    // one generic message so probes can't enumerate accounts.
    if (result.reason === "inactive") {
      return apiError(
        "account_inactive",
        "Your account has been deactivated. Please contact an administrator to regain access.",
        403
      );
    }
    return apiError(
      "invalid_credentials",
      "Email or password is incorrect.",
      401
    );
  }

  await setAuthCookies({
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
  });
  await updateLastLogin(result.user.id);

  await recordAudit({
    action: "auth.login",
    entityType: "auth",
    actorId: result.user.id,
    actorEmail: result.user.email,
    summary: `${result.user.email} signed in`,
    ip,
  });

  return apiOk({ user: toPublic(result.user) });
}
