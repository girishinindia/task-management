/**
 * Tasks data access.
 *
 * Phase 5 scope: a user sees tasks they CREATED. Phase 6 will widen reads to
 * include tasks they're assigned to. Permission checks live in app code
 * (mutation helpers take an actor + role and decide).
 */
import { sql, tx } from "@/lib/db";
import { insertAssignments, listAssigneesForTask } from "@/lib/dao/assignments";
import { insertSubtasks } from "@/lib/dao/subtasks";
import { nextOccurrenceDates, type RecurRule } from "@/lib/recurrence";
import type {
  TaskCreateInput,
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
} from "@/lib/schemas/tasks";
import type { UserRole } from "@/lib/jwt";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:MM (24h), optional time-of-day
  due_time: string | null; // HH:MM (24h), optional time-of-day
  project_id: string;
  is_active: boolean;
  /** daily | weekly | monthly, or null for a one-off task. */
  recur_rule: RecurRule | null;
  /** Joined in list/detail reads; absent on insert/update RETURNING. */
  project_name?: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLS = sql`
  id, title, description, status, priority,
  to_char(start_date, 'YYYY-MM-DD') as start_date,
  to_char(due_date,   'YYYY-MM-DD') as due_date,
  to_char(start_time, 'HH24:MI') as start_time,
  to_char(due_time,   'HH24:MI') as due_time,
  project_id, is_active, recur_rule, created_by, created_at, updated_at
`;

// ── Reads ───────────────────────────────────────────────────────────────────

export type TaskScope = "all" | "created" | "assigned";

export interface ListTasksOptions {
  scope?: TaskScope;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  /** Restrict to a single project. */
  project_id?: string | null;
  /** Restrict to tasks assigned to this user. */
  assignee_id?: string | null;
  search?: string;
  /** ISO YYYY-MM-DD. Filters to tasks whose [effective_from, effective_to]
   *  overlaps [from, to]. effective_from = coalesce(start_date, due_date),
   *  effective_to = coalesce(due_date, start_date). */
  from?: string | null;
  to?: string | null;
  /** When true, returns ONLY tasks with no start_date AND no due_date.
   *  Overrides from/to/overdue. */
  no_date?: boolean;
  /** When true, returns ONLY tasks where due_date < current_date AND
   *  status NOT IN ('done','cancelled'). Combines with other filters. */
  overdue?: boolean;
  /** Archive filter. "active" (default) hides archived tasks; "archived"
   *  shows only archived; "all" shows both. */
  archived?: "active" | "archived" | "all";
  /** Result ordering. Defaults to "due_asc" (nulls last). */
  sort?: TaskSort;
  limit?: number;
  offset?: number;
}

export type TaskSort =
  | "due_asc"
  | "due_desc"
  | "created_desc"
  | "created_asc"
  | "priority_desc"
  | "title_asc";

/** SQL predicate over the tasks alias `t` for which tasks a user may SEE:
 *   - super admin                                  → every task
 *   - a project admin, or a workspace admin who is
 *     a member of the task's project               → all tasks in that project
 *   - otherwise (a plain project member)           → only tasks they created
 *                                                    or are assigned to
 *  This is the single source of truth for task visibility; every list/count
 *  query (and canReadTask + analytics) uses it so they stay consistent. */
export function visibleTasksPredicate(
  userId: string,
  isWorkspaceAdmin: boolean
) {
  return sql`(
    coalesce((select su.is_super_admin from task.users su
               where su.id = ${userId}::uuid), false)
    or exists (select 1 from task.project_members pm
                where pm.project_id = t.project_id
                  and pm.user_id = ${userId}::uuid
                  and (pm.role = 'admin' or ${isWorkspaceAdmin}::bool))
    or t.created_by = ${userId}::uuid
    or exists (select 1 from task.task_assignments a
                where a.task_id = t.id and a.user_id = ${userId}::uuid)
  )`;
}

/** Tasks visible to a user.
 *
 *   scope "all"      → created OR assigned (default for non-admins)
 *   scope "created"  → created_by = me
 *   scope "assigned" → me in task_assignments
 *
 * Admins always see every task regardless of scope filter (scope is treated
 * as a personal view filter, not a permission filter).
 */
export async function listTasksForUser(
  userId: string,
  role: UserRole,
  opts: ListTasksOptions = {}
): Promise<TaskRow[]> {
  const scope: TaskScope = opts.scope ?? "all";
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  const priority =
    opts.priority && opts.priority !== "all" ? opts.priority : null;
  const search = opts.search?.trim();
  const like = search ? `%${search.toLowerCase()}%` : null;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const scopeAll = scope === "all";
  const scopeCreated = scope === "created";
  const scopeAssigned = scope === "assigned";
  const projectId = opts.project_id ?? null;
  const assigneeId = opts.assignee_id ?? null;
  const archived = opts.archived ?? "active";
  const sort: TaskSort = opts.sort ?? "due_asc";

  // Date filters: no_date overrides from/to. Overdue is a separate boolean
  // and combines with the rest.
  const noDate = opts.no_date === true;
  const from = !noDate && opts.from ? opts.from : null;
  const to = !noDate && opts.to ? opts.to : null;
  const overdue = opts.overdue === true;

  const orderBy =
    sort === "due_desc"
      ? sql`case when t.due_date is null then 1 else 0 end, t.due_date desc, t.created_at desc`
      : sort === "created_desc"
        ? sql`t.created_at desc`
        : sort === "created_asc"
          ? sql`t.created_at asc`
          : sort === "priority_desc"
            ? sql`case t.priority when 'high' then 0 when 'medium' then 1 else 2 end, t.due_date asc nulls last, t.created_at desc`
            : sort === "title_asc"
              ? sql`lower(t.title) asc`
              : sql`case when t.due_date is null then 1 else 0 end, t.due_date asc, t.created_at desc`;

  return sql<TaskRow[]>`
    select ${SELECT_COLS},
           (select pr.name from task.projects pr where pr.id = t.project_id) as project_name
      from task.tasks t
     where
       -- Visibility: super admin / project admin → all project tasks; a plain
       -- member → only tasks they created or are assigned to.
       ${visibleTasksPredicate(userId, role === "admin")}
       -- Personal scope filter (narrows within the visible set).
       and (
         ${scopeAll}::bool
         or (${scopeCreated}::bool and t.created_by = ${userId}::uuid)
         or (${scopeAssigned}::bool
             and exists (select 1 from task.task_assignments a
                          where a.task_id = t.id and a.user_id = ${userId}::uuid))
       )
       and (${projectId}::uuid is null or t.project_id = ${projectId}::uuid)
       and (${assigneeId}::uuid is null
            or exists (select 1 from task.task_assignments a2
                        where a2.task_id = t.id and a2.user_id = ${assigneeId}::uuid))
       and (${status}::task.task_status is null or t.status = ${status}::task.task_status)
       and (${priority}::task.task_priority is null or t.priority = ${priority}::task.task_priority)
       and (${like}::text is null
            or lower(t.title) like ${like}::text
            or lower(coalesce(t.description, '')) like ${like}::text)
       and (${noDate}::bool = false
            or (t.start_date is null and t.due_date is null))
       and (${from}::date is null
            or coalesce(t.due_date, t.start_date) >= ${from}::date)
       and (${to}::date is null
            or coalesce(t.start_date, t.due_date) <= ${to}::date)
       and (${overdue}::bool = false
            or (t.due_date < current_date
                and t.status not in ('done','cancelled')))
       and (${archived}::text = 'all'
            or (${archived}::text = 'active' and t.is_active = true)
            or (${archived}::text = 'archived' and t.is_active = false))
     order by ${orderBy}
     limit ${limit} offset ${offset}
  `;
}

/** Tasks visible to the user that occupy the given ISO date. Same overlap
 *  semantics as the calendar grid: a task occupies day d when
 *  coalesce(start_date, due_date) <= d <= coalesce(due_date, start_date). */
export async function listTasksForDate(
  userId: string,
  role: UserRole,
  iso: string
): Promise<TaskRow[]> {
  return listTasksForUser(userId, role, { from: iso, to: iso, limit: 500 });
}

/** Per-day task counts in [from, to] for the calendar grid. Wraps the
 *  task.task_day_counts RPC. Returns a map of ISO day -> count. */
export async function dayCounts(
  userId: string,
  role: UserRole,
  from: string,
  to: string
): Promise<Record<string, number>> {
  const rows = await sql<{ day: string; n: number }[]>`
    select to_char(d::date, 'YYYY-MM-DD') as day, count(*)::int as n
      from task.tasks t
      cross join lateral generate_series(
        greatest(coalesce(t.start_date, t.due_date), ${from}::date),
        least(coalesce(t.due_date, t.start_date), ${to}::date),
        interval '1 day'
      ) as d
     where t.is_active = true
       and (t.start_date is not null or t.due_date is not null)
       and ${visibleTasksPredicate(userId, role === "admin")}
     group by d
  `;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.day] = Number(r.n);
  return out;
}

/** Count of tasks visible to the user with NO dates at all. Used by the
 *  "No date" sidebar/chip count. */
export async function countNoDateTasks(
  userId: string,
  role: UserRole
): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    select count(*)::text as n
      from task.tasks t
     where t.is_active = true
       and t.start_date is null
       and t.due_date is null
       and ${visibleTasksPredicate(userId, role === "admin")}
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const rows = await sql<TaskRow[]>`
    select ${SELECT_COLS},
           (select pr.name from task.projects pr where pr.id = project_id) as project_name
      from task.tasks where id = ${id}::uuid limit 1
  `;
  return rows[0] ?? null;
}

/** Used by the dashboard cards. Counts tasks the user can see (created OR
 *  assigned, or all for admins). */
export async function countTasksForUser(
  userId: string,
  role: UserRole
): Promise<{
  open: number;
  due_today: number;
  overdue: number;
  done_recently: number;
}> {
  const rows = await sql<
    {
      open: string;
      due_today: string;
      overdue: string;
      done_recently: string;
    }[]
  >`
    select
      count(*) filter (where t.status not in ('done','cancelled'))::text                  as open,
      count(*) filter (where t.due_date = current_date
                         and t.status not in ('done','cancelled'))::text                  as due_today,
      count(*) filter (where t.due_date < current_date
                         and t.status not in ('done','cancelled'))::text                  as overdue,
      count(*) filter (where t.status = 'done'
                         and t.updated_at >= current_date - interval '7 days')::text      as done_recently
    from task.tasks t
    where t.is_active = true
      and ${visibleTasksPredicate(userId, role === "admin")}
  `;
  const r = rows[0];
  return {
    open: Number(r.open),
    due_today: Number(r.due_today),
    overdue: Number(r.overdue),
    done_recently: Number(r.done_recently),
  };
}

/** Can a user READ this task?
 *   - super admin / project admin (or workspace-admin member) → yes
 *   - the creator or an assignee → yes
 *   - a plain project member who is neither → no
 *  Mirrors visibleTasksPredicate so the detail page matches the list.
 */
export async function canReadTask(
  taskId: string,
  actorId: string,
  role: UserRole
): Promise<boolean> {
  const rows = await sql<{ ok: boolean }[]>`
    select ${visibleTasksPredicate(actorId, role === "admin")} as ok
      from task.tasks t
     where t.id = ${taskId}::uuid
     limit 1
  `;
  return rows[0]?.ok ?? false;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function createTask(
  createdBy: string,
  input: TaskCreateInput
): Promise<TaskRow> {
  const assigneeIds = input.assignee_ids ?? [];
  const subtaskTitles = (input.subtasks ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

  if (assigneeIds.length === 0 && subtaskTitles.length === 0) {
    const rows = await sql<TaskRow[]>`
      insert into task.tasks (
        title, description, status, priority, start_date, due_date,
        start_time, due_time, project_id, recur_rule, created_by
      ) values (
        ${input.title},
        ${input.description ?? null},
        ${input.status},
        ${input.priority},
        ${input.start_date ?? null}::date,
        ${input.due_date ?? null}::date,
        ${input.start_time ?? null}::time,
        ${input.due_time ?? null}::time,
        ${input.project_id}::uuid,
        ${input.recur_rule ?? null}::text,
        ${createdBy}::uuid
      )
      returning ${SELECT_COLS}
    `;
    return rows[0];
  }

  // Task + initial assignees + initial checklist in one transaction.
  return tx<TaskRow>(async (t) => {
    const inserted = await t<TaskRow[]>`
      insert into task.tasks (
        title, description, status, priority, start_date, due_date,
        start_time, due_time, project_id, recur_rule, created_by
      ) values (
        ${input.title},
        ${input.description ?? null},
        ${input.status},
        ${input.priority},
        ${input.start_date ?? null}::date,
        ${input.due_date ?? null}::date,
        ${input.start_time ?? null}::time,
        ${input.due_time ?? null}::time,
        ${input.project_id}::uuid,
        ${input.recur_rule ?? null}::text,
        ${createdBy}::uuid
      )
      returning ${SELECT_COLS}
    `;
    const task = inserted[0]!;
    if (assigneeIds.length > 0) {
      await insertAssignments(t, task.id, assigneeIds, createdBy);
    }
    if (subtaskTitles.length > 0) {
      await insertSubtasks(t, task.id, subtaskTitles, createdBy);
    }
    return task;
  });
}

/** Whether the actor can mutate this task. Phase 5: creator or admin. */
export function canMutate(
  _task: TaskRow,
  _actorId: string,
  role: UserRole
): boolean {
  // Workspace rule: only admins may create, edit, delete, reassign, or
  // transfer tasks. Regular users can view their tasks, submit status reports,
  // and add their own attachments — but never mutate the task itself.
  return role === "admin";
}

/** Update task fields. Phase 8: status is INTENTIONALLY not writable here —
 *  status changes must route through changeTaskStatus() so they're atomic
 *  with task_status_history. */
export async function updateTask(
  id: string,
  input: Omit<TaskUpdateInput, "status">
): Promise<TaskRow | null> {
  const rows = await sql<TaskRow[]>`
    update task.tasks
       set title       = coalesce(${input.title ?? null}::text, title),
           description = case
                           when ${input.description === undefined}::bool then description
                           else ${input.description ?? null}::text
                         end,
           priority    = coalesce(${input.priority ?? null}::task.task_priority, priority),
           start_date  = case
                           when ${input.start_date === undefined}::bool then start_date
                           else ${input.start_date ?? null}::date
                         end,
           due_date    = case
                           when ${input.due_date === undefined}::bool then due_date
                           else ${input.due_date ?? null}::date
                         end,
           start_time  = case
                           when ${input.start_time === undefined}::bool then start_time
                           else ${input.start_time ?? null}::time
                         end,
           due_time    = case
                           when ${input.due_time === undefined}::bool then due_time
                           else ${input.due_time ?? null}::time
                         end,
           recur_rule  = case
                           when ${input.recur_rule === undefined}::bool then recur_rule
                           else ${input.recur_rule ?? null}::text
                         end
     where id = ${id}::uuid
    returning ${SELECT_COLS}
  `;
  return rows[0] ?? null;
}

/** When a recurring task is completed, create its next occurrence: a fresh
 *  pending task with dates shifted by the rule and the same assignees. Returns
 *  the new task, or null if the task isn't recurring. */
export async function regenerateRecurring(
  task: TaskRow
): Promise<TaskRow | null> {
  if (!task.recur_rule) return null;
  const { start, due } = nextOccurrenceDates(
    task.start_date,
    task.due_date,
    task.recur_rule
  );
  const assignees = await listAssigneesForTask(task.id);
  return createTask(task.created_by, {
    project_id: task.project_id,
    title: task.title,
    description: task.description ?? undefined,
    priority: task.priority,
    status: "pending",
    start_date: start ?? undefined,
    due_date: due ?? undefined,
    start_time: task.start_time ?? undefined,
    due_time: task.due_time ?? undefined,
    recur_rule: task.recur_rule,
    assignee_ids: assignees.map((a) => a.user_id),
    subtasks: [],
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    delete from task.tasks where id = ${id}::uuid returning id
  `;
  return rows.length > 0;
}

/** Archive (deactivate) or restore a task. */
export async function setTaskActive(
  id: string,
  isActive: boolean
): Promise<TaskRow | null> {
  const rows = await sql<TaskRow[]>`
    update task.tasks set is_active = ${isActive}
     where id = ${id}::uuid
    returning ${SELECT_COLS}
  `;
  return rows[0] ?? null;
}

// ── Status workflow ────────────────────────────────────────────────────────

/** Legal status transitions matrix (mirrors the SQL function). Defined in
 *  `@/lib/schemas/status` — a client-safe module — so UI menus can import it
 *  without pulling this server-only file (and postgres) into the browser
 *  bundle. Re-exported here for server-side callers. */
export { LEGAL_TRANSITIONS } from "@/lib/schemas/status";

export type ChangeStatusResult =
  | {
      ok: true;
      history: {
        id: number;
        task_id: string;
        from_status: TaskStatus | null;
        to_status: TaskStatus;
        changed_by: string | null;
        changed_at: Date;
        note: string | null;
      };
      task: TaskRow;
    }
  | { ok: false; reason: "not_found" | "illegal_transition"; message: string };

/** Change a task's status via task.change_task_status RPC. Atomic with
 *  task_status_history insert + notification fan-out trigger. Returns a typed
 *  result so callers can map Postgres errors to API error codes. */
export async function changeTaskStatus(opts: {
  task_id: string;
  to_status: TaskStatus;
  actor_id: string;
  note?: string | null;
}): Promise<ChangeStatusResult> {
  try {
    const rows = await sql<
      {
        id: number;
        task_id: string;
        from_status: TaskStatus | null;
        to_status: TaskStatus;
        changed_by: string | null;
        changed_at: Date;
        note: string | null;
      }[]
    >`
      select * from task.change_task_status(
        ${opts.task_id}::uuid,
        ${opts.to_status}::task.task_status,
        ${opts.actor_id}::uuid,
        ${opts.note ?? null}::text
      )
    `;
    const history = rows[0]!;
    const refreshed = await getTask(opts.task_id);
    if (!refreshed) {
      return {
        ok: false,
        reason: "not_found",
        message: "Task disappeared after status change",
      };
    }
    return { ok: true, history, task: refreshed };
  } catch (e) {
    // postgres.js surfaces SQLSTATE on err.code
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code?: string }).code
        : undefined;
    if (code === "P0002") {
      return { ok: false, reason: "not_found", message: "Task not found" };
    }
    if (code === "22023") {
      const msg =
        e instanceof Error ? e.message : "Illegal status transition";
      return { ok: false, reason: "illegal_transition", message: msg };
    }
    throw e;
  }
}

export interface StatusHistoryRow {
  id: number;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_by: string | null;
  changed_at: Date;
  note: string | null;
  /** Joined: human display for the actor. */
  actor_full_name: string | null;
  actor_email: string | null;
}

// ── Transfers ──────────────────────────────────────────────────────────────

export type TransferResult =
  | {
      ok: true;
      transfer: {
        id: number;
        task_id: string;
        from_user_id: string | null;
        to_user_id: string;
        transferred_by: string | null;
        transferred_at: Date;
        reason: string | null;
      };
      task: TaskRow;
    }
  | {
      ok: false;
      reason:
        | "target_inactive"
        | "target_inactive_on_date"
        | "from_not_assigned"
        | "not_found";
      message: string;
    };

/** Atomically reassign a task via task.transfer_task RPC.
 *  - p_from_user: optional. If provided, must currently be assigned (else
 *    'from_not_assigned'). If null, just adds the new assignment.
 *  - p_to_user: required. Must be globally active and active on due_date (if set). */
export async function transferTask(opts: {
  task_id: string;
  from_user_id: string | null;
  to_user_id: string;
  actor_id: string;
  reason?: string | null;
}): Promise<TransferResult> {
  try {
    const rows = await sql<
      {
        id: number;
        task_id: string;
        from_user_id: string | null;
        to_user_id: string;
        transferred_by: string | null;
        transferred_at: Date;
        reason: string | null;
      }[]
    >`
      select * from task.transfer_task(
        ${opts.task_id}::uuid,
        ${opts.from_user_id}::uuid,
        ${opts.to_user_id}::uuid,
        ${opts.actor_id}::uuid,
        ${opts.reason ?? null}::text
      )
    `;
    const transfer = rows[0]!;
    const refreshed = await getTask(opts.task_id);
    if (!refreshed) {
      return {
        ok: false,
        reason: "not_found",
        message: "Task disappeared after transfer",
      };
    }
    return { ok: true, transfer, task: refreshed };
  } catch (e) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code?: string }).code
        : undefined;
    const message = e instanceof Error ? e.message : "Transfer failed";

    // Both target-active checks use SQLSTATE 22023 in the RPC; tell them apart
    // by the message text. P0002 surfaces only from "from_user not assigned".
    if (code === "P0002") {
      return {
        ok: false,
        reason: "from_not_assigned",
        message: "Source user is not currently assigned to this task",
      };
    }
    if (code === "22023") {
      if (message.toLowerCase().includes("due date")) {
        return {
          ok: false,
          reason: "target_inactive_on_date",
          message,
        };
      }
      return { ok: false, reason: "target_inactive", message };
    }
    throw e;
  }
}

export interface TransferRow {
  id: number;
  task_id: string;
  from_user_id: string | null;
  to_user_id: string;
  transferred_by: string | null;
  transferred_at: Date;
  reason: string | null;
  from_full_name: string | null;
  from_email: string | null;
  to_full_name: string | null;
  to_email: string | null;
  actor_full_name: string | null;
  actor_email: string | null;
}

/** Transfer history for a task, newest first. Joins users 3x (from/to/actor). */
export async function listTransferHistory(
  taskId: string
): Promise<TransferRow[]> {
  return sql<TransferRow[]>`
    select t.id, t.task_id, t.from_user_id, t.to_user_id,
           t.transferred_by, t.transferred_at, t.reason,
           uf.full_name   as from_full_name,
           uf.email::text as from_email,
           ut.full_name   as to_full_name,
           ut.email::text as to_email,
           ua.full_name   as actor_full_name,
           ua.email::text as actor_email
      from task.task_transfers t
      left join task.users uf on uf.id = t.from_user_id
      left join task.users ut on ut.id = t.to_user_id
      left join task.users ua on ua.id = t.transferred_by
     where t.task_id = ${taskId}::uuid
     order by t.transferred_at desc, t.id desc
  `;
}

/** Chronological status history for a task, newest first. */
export async function listStatusHistory(
  taskId: string
): Promise<StatusHistoryRow[]> {
  return sql<StatusHistoryRow[]>`
    select h.id, h.task_id, h.from_status, h.to_status,
           h.changed_by, h.changed_at, h.note,
           u.full_name        as actor_full_name,
           u.email::text      as actor_email
      from task.task_status_history h
      left join task.users u on u.id = h.changed_by
     where h.task_id = ${taskId}::uuid
     order by h.changed_at desc, h.id desc
  `;
}
