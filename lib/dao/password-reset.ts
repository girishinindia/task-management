/**
 * Admin-mediated password reset queue.
 *
 * A signed-out user asks for a reset → an "open" request is recorded and admins
 * are notified. An admin sets a new temporary password from the Users page,
 * which marks the request "handled". No email is involved.
 */
import { sql } from "@/lib/db";

export interface ResetRequestRow {
  id: number;
  user_id: string;
  status: "open" | "handled";
  requested_at: Date;
  handled_by: string | null;
  handled_at: Date | null;
}

/** Record an open reset request. No-op if one is already open for the user. */
export async function createResetRequest(userId: string): Promise<void> {
  await sql`
    insert into task.password_reset_requests (user_id, status)
    values (${userId}::uuid, 'open')
    on conflict (user_id) where status = 'open' do nothing
  `;
}

/** user_ids that currently have an open reset request (for the Users page). */
export async function listOpenResetUserIds(): Promise<string[]> {
  const rows = await sql<{ user_id: string }[]>`
    select user_id from task.password_reset_requests where status = 'open'
  `;
  return rows.map((r) => r.user_id);
}

/** Mark any open request for a user as handled. Returns true if one was open. */
export async function markResetHandled(
  userId: string,
  handledBy: string
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    update task.password_reset_requests
       set status = 'handled', handled_by = ${handledBy}::uuid, handled_at = now()
     where user_id = ${userId}::uuid and status = 'open'
    returning id
  `;
  return rows.length > 0;
}
