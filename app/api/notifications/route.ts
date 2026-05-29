import { requireUser } from "@/lib/auth";
import {
  countUnread,
  ensureDueReminders,
  listNotifications,
} from "@/lib/dao/notifications";
import { apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** GET /api/notifications?limit=20&scope=all|unread
 *  Returns the current user's notifications plus a fresh unread count. */
export async function GET(req: Request) {
  const me = await requireUser();
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 20;
  const scope = url.searchParams.get("scope") === "unread" ? "unread" : "all";

  // Surface due/overdue reminders (idempotent — once per task per day).
  try {
    await ensureDueReminders(me.userId);
  } catch {
    /* non-fatal — never block the bell on reminder generation */
  }

  const [rows, unread] = await Promise.all([
    listNotifications(me.userId, { scope, limit }),
    countUnread(me.userId),
  ]);
  return apiOk({ notifications: rows, unread_count: unread });
}
