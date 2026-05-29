import { getCurrentUser, revokeCurrentSession } from "@/lib/auth";
import { apiOk } from "@/lib/api-response";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  await revokeCurrentSession();
  if (me) {
    await recordAudit({
      action: "auth.logout",
      entityType: "auth",
      actorId: me.userId,
      actorEmail: me.email,
      summary: `${me.email} signed out`,
      ip: clientIp(req),
    });
  }
  return apiOk({});
}
