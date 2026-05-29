import { signupSchema } from "@/lib/schemas/auth";
import { verifyRecaptchaToken } from "@/lib/captcha";
import {
  createUser,
  findUserByEmail,
  toPublic,
  updateLastLogin,
} from "@/lib/dao/users";
import { setAuthCookies } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api-response";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Phase 12: in workspace mode (default), self-service signup is disabled.
  // Admins create users via /api/admin/users instead.
  if (!env.ALLOW_PUBLIC_SIGNUP) {
    return apiError(
      "signup_disabled",
      "This workspace is invite-only. Ask an admin to create your account.",
      403
    );
  }

  // Even with public signup enabled, throttle to 3/min/IP so the same IP
  // can't spam new accounts.
  const ip = clientIp(req);
  const limit = await rateLimit({
    bucket: "auth:signup",
    id: ip,
    max: 3,
    windowSec: 60,
  });
  if (!limit.ok) {
    return apiError(
      "rate_limited",
      "Too many signup attempts. Try again in a moment.",
      429,
      { retry_after: limit.retryAfter }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const { full_name, email, password, captcha_token } = parsed.data;

  const captcha = await verifyRecaptchaToken(captcha_token, "signup");
  if (!captcha.ok) {
    return apiError(
      "captcha_failed",
      "Captcha verification failed. Please try again.",
      400,
      { reason: captcha.reason }
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return apiError(
      "email_taken",
      "An account with that email already exists.",
      409
    );
  }

  const user = await createUser({ email, password, full_name });
  await setAuthCookies({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  await updateLastLogin(user.id);

  return apiOk({ user: toPublic(user) });
}
