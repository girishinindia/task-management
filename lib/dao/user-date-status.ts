/**
 * Per-date activation overrides for users.
 *
 *   Absence of a row for (user_id, date) → user is active on that date.
 *   A row with is_active = false → admin has explicitly deactivated them.
 *   A row with is_active = true  → explicit "active" marker (mostly cosmetic,
 *     but useful if you ever want to flip the default behaviour).
 */
import { sql } from "@/lib/db";

export interface UserDateStatusRow {
  id: number;
  user_id: string;
  date: string; // ISO YYYY-MM-DD
  is_active: boolean;
  note: string | null;
  created_at: Date;
}

export async function listDateStatusForUser(
  userId: string,
  opts?: { from?: string; to?: string }
): Promise<UserDateStatusRow[]> {
  const from = opts?.from ?? null;
  const to = opts?.to ?? null;
  return sql<UserDateStatusRow[]>`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           is_active, note, created_at
      from task.user_date_status
     where user_id = ${userId}
       and (${from}::date is null or date >= ${from}::date)
       and (${to}::date is null or date <= ${to}::date)
     order by date desc
  `;
}

export async function upsertDateStatus(input: {
  user_id: string;
  date: string;
  is_active: boolean;
  note?: string | null;
}): Promise<UserDateStatusRow> {
  const rows = await sql<UserDateStatusRow[]>`
    insert into task.user_date_status (user_id, date, is_active, note)
    values (${input.user_id}, ${input.date}::date, ${input.is_active}, ${input.note ?? null})
    on conflict (user_id, date)
      do update set is_active = excluded.is_active,
                    note      = excluded.note
    returning id, user_id, to_char(date, 'YYYY-MM-DD') as date,
              is_active, note, created_at
  `;
  return rows[0];
}

export async function deleteDateStatus(
  userId: string,
  date: string
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    delete from task.user_date_status
     where user_id = ${userId} and date = ${date}::date
    returning id
  `;
  return rows.length > 0;
}

/** Convenience: is the given user active on the given date? */
export async function isUserActiveOn(
  userId: string,
  date: string
): Promise<boolean> {
  const rows = await sql<{ is_active: boolean }[]>`
    select is_active
      from task.user_date_status
     where user_id = ${userId} and date = ${date}::date
     limit 1
  `;
  return rows[0]?.is_active ?? true;
}
