/**
 * Notifications data access — scoped to the calling user. No cross-user
 * reads or writes; every query carries user_id.
 *
 * Rows are populated by triggers under task.* (see migration 0004):
 *   - tg_notify_on_assignment    → type: 'task_assigned'
 *   - tg_notify_on_transfer      → type: 'task_transferred'
 *   - tg_notify_on_status_change → type: 'status_changed'
 */
import { sql } from "@/lib/db";

export interface NotificationRow {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

export interface ListNotificationsOptions {
  /** "all" returns everything, "unread" filters is_read = false. */
  scope?: "all" | "unread";
  limit?: number;
  offset?: number;
}

export async function listNotifications(
  userId: string,
  opts: ListNotificationsOptions = {}
): Promise<NotificationRow[]> {
  const onlyUnread = opts.scope === "unread";
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  return sql<NotificationRow[]>`
    select id, user_id, type, title, body, link, is_read, created_at
      from task.notifications
     where user_id = ${userId}::uuid
       and (${onlyUnread}::bool = false or is_read = false)
     order by created_at desc, id desc
     limit ${limit} offset ${offset}
  `;
}

/** App-level fan-out for events without a DB trigger (task edits, attachments,
 *  project requests). Inserts one notification per (de-duplicated) user. */
export async function notifyUsers(
  userIds: string[],
  n: { type: string; title: string; body?: string | null; link?: string | null }
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return;
  const values = unique.map((uid) => ({
    user_id: uid,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  }));
  await sql`
    insert into task.notifications ${sql(
      values,
      "user_id",
      "type",
      "title",
      "body",
      "link"
    )}
  `;
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    select count(*)::text as n
      from task.notifications
     where user_id = ${userId}::uuid
       and is_read = false
  `;
  return Number(rows[0]?.n ?? 0);
}

/** Mark a single notification as read. user_id check prevents cross-user
 *  mutation even if the id is leaked. Returns whether the row was updated. */
export async function markRead(
  id: number,
  userId: string
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    update task.notifications
       set is_read = true
     where id = ${id} and user_id = ${userId}::uuid and is_read = false
    returning id
  `;
  return rows.length > 0;
}

/** Mark every unread notification for a user as read. Returns the count. */
export async function markAllRead(userId: string): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    update task.notifications
       set is_read = true
     where user_id = ${userId}::uuid and is_read = false
    returning id
  `;
  return rows.length;
}
