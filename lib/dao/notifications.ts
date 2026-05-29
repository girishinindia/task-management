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
  /** Restrict to these notification types (e.g. a category's types). */
  types?: string[] | null;
  /** Case-insensitive match against title OR body. */
  search?: string | null;
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
  const types = opts.types && opts.types.length > 0 ? opts.types : null;
  const search = opts.search?.trim();
  const like = search ? `%${search.toLowerCase()}%` : null;
  return sql<NotificationRow[]>`
    select id, user_id, type, title, body, link, is_read, created_at
      from task.notifications
     where user_id = ${userId}::uuid
       and (${onlyUnread}::bool = false or is_read = false)
       and (${types}::text[] is null or type = any(${types}::text[]))
       and (${like}::text is null
            or lower(title) like ${like}::text
            or lower(coalesce(body, '')) like ${like}::text)
     order by created_at desc, id desc
     limit ${limit} offset ${offset}
  `;
}

/** Per-type counts for the current user, honouring scope + search but NOT the
 *  type filter (so category chips can show their totals). Returns a map of
 *  notification type → count. */
export async function notificationCountsByType(
  userId: string,
  opts: { scope?: "all" | "unread"; search?: string | null } = {}
): Promise<Record<string, number>> {
  const onlyUnread = opts.scope === "unread";
  const search = opts.search?.trim();
  const like = search ? `%${search.toLowerCase()}%` : null;
  const rows = await sql<{ type: string; n: number }[]>`
    select type, count(*)::int as n
      from task.notifications
     where user_id = ${userId}::uuid
       and (${onlyUnread}::bool = false or is_read = false)
       and (${like}::text is null
            or lower(title) like ${like}::text
            or lower(coalesce(body, '')) like ${like}::text)
     group by type
  `;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.type] = Number(r.n);
  return out;
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

/**
 * Generate due-soon / overdue reminders for a user, idempotently. Called on
 * demand (when the user fetches notifications) so no cron job is required:
 * at most one reminder per task per type per calendar day. A reminder targets
 * tasks the user created or is assigned to that are still open.
 */
export async function ensureDueReminders(userId: string): Promise<void> {
  // Overdue (due_date strictly before today).
  await sql`
    insert into task.notifications (user_id, type, title, body, link)
    select ${userId}::uuid, 'task_overdue',
           'Overdue: ' || t.title,
           'Was due ' || to_char(t.due_date, 'Mon DD') || '.',
           '/dashboard/tasks/' || t.id::text
      from task.tasks t
     where t.is_active = true
       and t.due_date is not null
       and t.due_date < current_date
       and t.status not in ('done','cancelled')
       and (t.created_by = ${userId}::uuid
            or exists (select 1 from task.task_assignments a
                        where a.task_id = t.id and a.user_id = ${userId}::uuid))
       and not exists (
         select 1 from task.notifications n
          where n.user_id = ${userId}::uuid
            and n.type = 'task_overdue'
            and n.link = '/dashboard/tasks/' || t.id::text
            and n.created_at >= current_date
       )
  `;
  // Due today.
  await sql`
    insert into task.notifications (user_id, type, title, body, link)
    select ${userId}::uuid, 'task_due_soon',
           'Due today: ' || t.title,
           null,
           '/dashboard/tasks/' || t.id::text
      from task.tasks t
     where t.is_active = true
       and t.due_date = current_date
       and t.status not in ('done','cancelled')
       and (t.created_by = ${userId}::uuid
            or exists (select 1 from task.task_assignments a
                        where a.task_id = t.id and a.user_id = ${userId}::uuid))
       and not exists (
         select 1 from task.notifications n
          where n.user_id = ${userId}::uuid
            and n.type = 'task_due_soon'
            and n.link = '/dashboard/tasks/' || t.id::text
            and n.created_at >= current_date
       )
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
