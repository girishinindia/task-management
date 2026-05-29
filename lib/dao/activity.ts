/**
 * Unified activity feed across status history, transfers, and assignments,
 * scoped to tasks the user can see. Used by the dashboard "Recent activity"
 * panel.
 *
 * Implemented as a single SQL UNION ALL so we can order across event types
 * by timestamp in one round trip.
 */
import { sql } from "@/lib/db";
import type { UserRole } from "@/lib/jwt";

export type ActivityKind =
  | "status_changed"
  | "transferred"
  | "assigned";

export interface ActivityRow {
  kind: ActivityKind;
  occurred_at: Date;
  task_id: string;
  task_title: string;
  actor_full_name: string | null;
  actor_email: string | null;
  /** For status_changed: from/to status names. */
  from_status: string | null;
  to_status: string | null;
  /** For transferred: from/to user display. */
  from_user_full_name: string | null;
  to_user_full_name: string | null;
  /** For assigned: who became an assignee. */
  assigned_user_full_name: string | null;
  /** Free-text note (status note) or reason (transfer). */
  note: string | null;
}

/** Recent events for tasks the user can see. Defaults to the last 20. */
export async function listRecentActivity(
  userId: string,
  role: UserRole,
  limit = 20
): Promise<ActivityRow[]> {
  const isAdmin = role === "admin";
  const cap = Math.min(Math.max(limit, 1), 100);

  return sql<ActivityRow[]>`
    with visible_tasks as (
      select t.id, t.title
        from task.tasks t
       where ${isAdmin}::bool
          or t.created_by = ${userId}::uuid
          or exists (
            select 1 from task.task_assignments a
             where a.task_id = t.id and a.user_id = ${userId}::uuid
          )
    )
    select * from (
      select
        'status_changed'::text                       as kind,
        h.changed_at                                  as occurred_at,
        v.id                                          as task_id,
        v.title                                       as task_title,
        ua.full_name                                  as actor_full_name,
        ua.email::text                                as actor_email,
        h.from_status::text                           as from_status,
        h.to_status::text                             as to_status,
        null::text                                    as from_user_full_name,
        null::text                                    as to_user_full_name,
        null::text                                    as assigned_user_full_name,
        h.note                                        as note
      from task.task_status_history h
      join visible_tasks v on v.id = h.task_id
      left join task.users ua on ua.id = h.changed_by

      union all

      select
        'transferred'::text                           as kind,
        t.transferred_at                              as occurred_at,
        v.id                                          as task_id,
        v.title                                       as task_title,
        ua.full_name                                  as actor_full_name,
        ua.email::text                                as actor_email,
        null::text                                    as from_status,
        null::text                                    as to_status,
        uf.full_name                                  as from_user_full_name,
        ut.full_name                                  as to_user_full_name,
        null::text                                    as assigned_user_full_name,
        t.reason                                      as note
      from task.task_transfers t
      join visible_tasks v on v.id = t.task_id
      left join task.users ua on ua.id = t.transferred_by
      left join task.users uf on uf.id = t.from_user_id
      left join task.users ut on ut.id = t.to_user_id

      union all

      select
        'assigned'::text                              as kind,
        a.assigned_at                                 as occurred_at,
        v.id                                          as task_id,
        v.title                                       as task_title,
        ua.full_name                                  as actor_full_name,
        ua.email::text                                as actor_email,
        null::text                                    as from_status,
        null::text                                    as to_status,
        null::text                                    as from_user_full_name,
        null::text                                    as to_user_full_name,
        uu.full_name                                  as assigned_user_full_name,
        null::text                                    as note
      from task.task_assignments a
      join visible_tasks v on v.id = a.task_id
      left join task.users ua on ua.id = a.assigned_by
      left join task.users uu on uu.id = a.user_id
    ) all_events
    order by occurred_at desc
    limit ${cap}
  `;
}
