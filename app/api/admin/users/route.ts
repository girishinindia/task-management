import { requireAdmin } from "@/lib/auth";
import { adminCreateUserSchema } from "@/lib/schemas/admin";
import { createUser, findUserByEmail, toPublic } from "@/lib/dao/users";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = adminCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return apiError(
      "email_taken",
      "An account with that email already exists.",
      409
    );
  }

  const user = await createUser(parsed.data);

  await recordAudit({
    action: "admin.user_created",
    entityType: "user",
    entityId: user.id,
    actorId: admin.userId,
    actorEmail: admin.email,
    summary: `Created ${parsed.data.role} account ${user.email}`,
    metadata: { role: parsed.data.role },
    ip: clientIp(req),
  });

  return apiOk({ user: toPublic(user) });
}
