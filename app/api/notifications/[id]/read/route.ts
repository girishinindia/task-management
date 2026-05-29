import { requireUser } from "@/lib/auth";
import { markRead } from "@/lib/dao/notifications";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** POST /api/notifications/[id]/read — idempotent. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return apiError("invalid_id", "Notification id must be a positive integer", 400);
  }
  const ok = await markRead(id, me.userId);
  return apiOk({ marked: ok });
}
