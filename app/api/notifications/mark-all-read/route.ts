import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/lib/dao/notifications";
import { apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** POST /api/notifications/mark-all-read */
export async function POST() {
  const me = await requireUser();
  const n = await markAllRead(me.userId);
  return apiOk({ updated: n });
}
