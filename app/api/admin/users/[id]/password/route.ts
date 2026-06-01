import { requireAdmin } from "@/lib/auth";
import { adminSetPasswordSchema } from "@/lib/schemas/admin";
import { findUserById, setUserPassword } from "@/lib/dao/users";
import { markResetHandled } from "@/lib/dao/password-reset";
import { notifyUsers } from "@/lib/dao/notifications";
import { revokeAllSessions } from "@/lib/redis";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Admin sets a new (temporary) password for a user, fulfilling a reset
 *  request. Marks any open request handled and revokes the user's sessions. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = adminSetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Password must be at least 8 characters and include a number.",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const user = await findUserById(params.id);
  if (!user) return apiError("not_found", "User not found", 404);

  const ok = await setUserPassword(params.id, parsed.data.password);
  if (!ok) return apiError("not_found", "User not found", 404);

  await markResetHandled(params.id, admin.userId);
  // Force re-login everywhere with the new credentials.
  await revokeAllSessions(params.id);

  // Let the user know (shows next time they sign in). Uses its own type so it
  // doesn't get grouped under the admin-only "Password reset" category.
  await notifyUsers([params.id], {
    type: "password_changed",
    title: "Your password was reset",
    body: "An admin set a new temporary password for your account. Please change it after signing in.",
    link: "/dashboard",
  });

  await recordAudit({
    action: "admin.password_set",
    entityType: "user",
    entityId: params.id,
    actorId: admin.userId,
    actorEmail: admin.email,
    summary: `Set a temporary password for ${user.email}`,
    ip: clientIp(req),
  });

  return apiOk({});
}
