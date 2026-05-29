import { requireAdmin } from "@/lib/auth";
import { adminUpdateUserSchema } from "@/lib/schemas/admin";
import { findUserById, toPublic, updateUser } from "@/lib/dao/users";
import { revokeAllSessions } from "@/lib/redis";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function PATCH(
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

  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  // Guard: admins must not lock themselves out.
  if (
    params.id === admin.userId &&
    (parsed.data.is_active === false ||
      (parsed.data.role && parsed.data.role !== "admin"))
  ) {
    return apiError(
      "self_lockout",
      "You can't deactivate or demote your own account.",
      400
    );
  }

  const before = await findUserById(params.id);
  if (!before) {
    return apiError("not_found", "User not found", 404);
  }

  const after = await updateUser(params.id, parsed.data);
  if (!after) {
    return apiError("not_found", "User not found", 404);
  }

  // If the user was just deactivated, revoke every session they have so they
  // can't keep using the app on an old cookie.
  if (before.is_active && after.is_active === false) {
    await revokeAllSessions(after.id);
  }

  return apiOk({ user: toPublic(after) });
}
