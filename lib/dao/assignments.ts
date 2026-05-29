/**
 * Assignment DAO.
 *
 * Permissions for write operations are enforced by the API routes (creator or
 * admin). Date-activation validation lives here because it's a data-layer
 * concern (we don't want a bad row sneaking in via direct DAO use from a
 * server action elsewhere).
 */
import { sql, tx } from "@/lib/db";

export interface AssigneeRow {
  task_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: "admin" | "user";
  assigned_at: Date;
  assigned_by: string | null;
}

/** Assignees for one task. */
export async function listAssigneesForTask(
  taskId: string
): Promise<AssigneeRow[]> {
  return sql<AssigneeRow[]>`
    select a.task_id, a.user_id, u.full_name, u.email::text as email, u.role,
           a.assigned_at, a.assigned_by
      from task.task_assignments a
      join task.users u on u.id = a.user_id
     where a.task_id = ${taskId}::uuid
     order by a.assigned_at asc
  `;
}

/** Assignees for many tasks at once, returned grouped by task_id. */
export async function listAssigneesForTasks(
  taskIds: string[]
): Promise<Record<string, AssigneeRow[]>> {
  if (taskIds.length === 0) return {};
  const rows = await sql<AssigneeRow[]>`
    select a.task_id, a.user_id, u.full_name, u.email::text as email, u.role,
           a.assigned_at, a.assigned_by
      from task.task_assignments a
      join task.users u on u.id = a.user_id
     where a.task_id = any(${taskIds}::uuid[])
     order by a.assigned_at asc
  `;
  const out: Record<string, AssigneeRow[]> = {};
  for (const r of rows) {
    (out[r.task_id] ??= []).push(r);
  }
  return out;
}

/** Validates target users for assignment to a task: globally active + active
 *  on the task's due_date if one exists. Returns the user_ids that FAILED. */
export async function findInvalidAssignees(opts: {
  user_ids: string[];
  due_date: string | null;
}): Promise<{ inactive: string[]; inactive_on_date: string[] }> {
  if (opts.user_ids.length === 0) {
    return { inactive: [], inactive_on_date: [] };
  }

  const inactive = await sql<{ id: string }[]>`
    select id
      from task.users
     where id = any(${opts.user_ids}::uuid[])
       and is_active = false
  `;

  let inactiveOnDate: { id: string }[] = [];
  if (opts.due_date) {
    inactiveOnDate = await sql<{ id: string }[]>`
      select user_id as id
        from task.user_date_status
       where user_id = any(${opts.user_ids}::uuid[])
         and date = ${opts.due_date}::date
         and is_active = false
    `;
  }

  return {
    inactive: inactive.map((r) => r.id),
    inactive_on_date: inactiveOnDate.map((r) => r.id),
  };
}

/** Replace the task's assignees with `user_ids`. Wrapped in a transaction.
 *  Returns the resulting set of assignees. */
export async function setAssignments(opts: {
  task_id: string;
  user_ids: string[];
  assigned_by: string;
}): Promise<AssigneeRow[]> {
  await tx(async (t) => {
    await t`delete from task.task_assignments where task_id = ${opts.task_id}::uuid`;
    if (opts.user_ids.length > 0) {
      const values = opts.user_ids.map((uid) => ({
        task_id: opts.task_id,
        user_id: uid,
        assigned_by: opts.assigned_by,
      }));
      await t`
        insert into task.task_assignments ${t(values, "task_id", "user_id", "assigned_by")}
      `;
    }
  });
  return listAssigneesForTask(opts.task_id);
}

/** Insert assignments inside an existing transaction (used by createTask). */
export async function insertAssignments(
  t: typeof sql,
  task_id: string,
  user_ids: string[],
  assigned_by: string
): Promise<void> {
  if (user_ids.length === 0) return;
  const values = user_ids.map((uid) => ({
    task_id,
    user_id: uid,
    assigned_by,
  }));
  await t`
    insert into task.task_assignments ${t(values, "task_id", "user_id", "assigned_by")}
    on conflict (task_id, user_id) do nothing
  `;
}

/** Remove a single assignment. Returns true if a row was removed. */
export async function removeAssignment(
  taskId: string,
  userId: string
): Promise<boolean> {
  const rows = await sql<{ task_id: string }[]>`
    delete from task.task_assignments
     where task_id = ${taskId}::uuid and user_id = ${userId}::uuid
    returning task_id
  `;
  return rows.length > 0;
}
