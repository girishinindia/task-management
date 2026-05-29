import { forgotPasswordSchema } from "@/lib/schemas/admin";
import { findUserByEmail, listAdminRecipientIds } from "@/lib/dao/users";
import { createResetRequest } from "@/lib/dao/password-reset";
import { notifyUsers } from "@/lib/dao/notifications";
import { recordAudit } from "@/lib/dao/audit";
import { apiError, apiOk } from "@/lib/api-response";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Public endpoint: a signed-out user requests a password reset. We record an
 *  open request and notify admins (who set a temporary password). The response
 *  is always the same so it can't be used to enumerate accounts. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit({
    bucket: "auth:forgot:ip",
    id: ip,
    max: 5,
    windowSec: 60,
  });
  if (!limit.ok) {
    return apiError(
      "rate_limited",
      "Too many requests. Try again in a moment.",
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation", "Enter a valid email address", 400);
  }

  const user = await findUserByEmail(parsed.data.email);
  if (user && user.is_active) {
    await createResetRequest(user.id);
    const admins = await listAdminRecipientIds();
    if (admins.length > 0) {
      await notifyUsers(admins, {
        type: "password_reset_requested",
        title: "Password reset requested",
        body: `${user.full_name} (${user.email}) asked to reset their password. Set a temporary password from the Users page.`,
        link: "/admin/users",
      });
    }
    await recordAudit({
      action: "auth.password_reset_requested",
      entityType: "user",
      entityId: user.id,
      actorEmail: user.email,
      summary: `Password reset requested for ${user.email}`,
      ip,
    });
  }

  // Identical response whether or not the email exists.
  return apiOk({
    message:
      "If that email belongs to an account, an admin has been notified to reset it.",
  });
}
