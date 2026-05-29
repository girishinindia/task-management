/**
 * Aggregate reporting over the tasks a user can see (super admin → all; others
 * → their projects). Mirrors the visibility rule used in lib/dao/tasks.ts.
 * Only active (non-archived) tasks are counted.
 */
import { sql } from "@/lib/db";
import type { UserRole } from "@/lib/jwt";
import type { TaskPriority, TaskStatus } from "@/lib/schemas/tasks";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/schemas/tasks";
import { completionRate } from "@/lib/analytics-util";

export interface ProjectStat {
  project_id: string;
  project_name: string;
  total: number;
  done: number;
  open: number;
  overdue: number;
}

export interface TaskAnalytics {
  total: number;
  open: number;
  done: number;
  overdue: number;
  due_today: number;
  completion_rate: number; // 0..100, done / total
  by_status: Record<TaskStatus, number>;
  by_priority: Record<TaskPriority, number>;
  per_project: ProjectStat[];
}

export async function taskAnalytics(
  userId: string,
  _role: UserRole
): Promise<TaskAnalytics> {
  const [summary, statusRows, priorityRows, projectRows] = await Promise.all([
    sql<
      {
        total: number;
        open: number;
        done: number;
        overdue: number;
        due_today: number;
      }[]
    >`
      select
        count(*)::int as total,
        count(*) filter (where t.status not in ('done','cancelled'))::int as open,
        count(*) filter (where t.status = 'done')::int as done,
        count(*) filter (where t.due_date < current_date
                           and t.status not in ('done','cancelled'))::int as overdue,
        count(*) filter (where t.due_date = current_date
                           and t.status not in ('done','cancelled'))::int as due_today
        from task.tasks t
       where t.is_active = true
         and (coalesce((select su.is_super_admin from task.users su
                         where su.id = ${userId}::uuid), false)
              or exists (select 1 from task.project_members pm
                          where pm.project_id = t.project_id
                            and pm.user_id = ${userId}::uuid))
    `,
    sql<{ k: string; n: number }[]>`
      select t.status::text as k, count(*)::int as n
        from task.tasks t
       where t.is_active = true
         and (coalesce((select su.is_super_admin from task.users su
                         where su.id = ${userId}::uuid), false)
              or exists (select 1 from task.project_members pm
                          where pm.project_id = t.project_id
                            and pm.user_id = ${userId}::uuid))
       group by t.status
    `,
    sql<{ k: string; n: number }[]>`
      select t.priority::text as k, count(*)::int as n
        from task.tasks t
       where t.is_active = true
         and (coalesce((select su.is_super_admin from task.users su
                         where su.id = ${userId}::uuid), false)
              or exists (select 1 from task.project_members pm
                          where pm.project_id = t.project_id
                            and pm.user_id = ${userId}::uuid))
       group by t.priority
    `,
    sql<ProjectStat[]>`
      select t.project_id,
             pr.name as project_name,
             count(*)::int as total,
             count(*) filter (where t.status = 'done')::int as done,
             count(*) filter (where t.status not in ('done','cancelled'))::int as open,
             count(*) filter (where t.due_date < current_date
                               and t.status not in ('done','cancelled'))::int as overdue
        from task.tasks t
        join task.projects pr on pr.id = t.project_id
       where t.is_active = true
         and (coalesce((select su.is_super_admin from task.users su
                         where su.id = ${userId}::uuid), false)
              or exists (select 1 from task.project_members pm
                          where pm.project_id = t.project_id
                            and pm.user_id = ${userId}::uuid))
       group by t.project_id, pr.name
       order by total desc, pr.name asc
    `,
  ]);

  const s = summary[0] ?? {
    total: 0,
    open: 0,
    done: 0,
    overdue: 0,
    due_today: 0,
  };

  const byStatus = Object.fromEntries(
    TASK_STATUSES.map((st) => [st, 0])
  ) as Record<TaskStatus, number>;
  for (const r of statusRows) {
    if (r.k in byStatus) byStatus[r.k as TaskStatus] = Number(r.n);
  }

  const byPriority = Object.fromEntries(
    TASK_PRIORITIES.map((p) => [p, 0])
  ) as Record<TaskPriority, number>;
  for (const r of priorityRows) {
    if (r.k in byPriority) byPriority[r.k as TaskPriority] = Number(r.n);
  }

  return {
    total: s.total,
    open: s.open,
    done: s.done,
    overdue: s.overdue,
    due_today: s.due_today,
    completion_rate: completionRate(s.done, s.total),
    by_status: byStatus,
    by_priority: byPriority,
    per_project: projectRows,
  };
}
