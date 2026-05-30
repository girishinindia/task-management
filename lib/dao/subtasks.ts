/**
 * Subtasks (checklist) DAO. A task can have an ordered list of checklist items.
 * Permission is enforced in the API routes (anyone who can read the task).
 */
import { sql } from "@/lib/db";

/** Insert an ordered set of checklist items within an existing transaction
 *  (used by createTask so a task + its initial checklist are atomic). */
export async function insertSubtasks(
  t: typeof sql,
  taskId: string,
  titles: string[],
  createdBy: string
): Promise<void> {
  const clean = titles.map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (clean.length === 0) return;
  const values = clean.map((title, i) => ({
    task_id: taskId,
    title: title.slice(0, 200),
    position: i,
    created_by: createdBy,
  }));
  await t`
    insert into task.task_subtasks ${t(
      values,
      "task_id",
      "title",
      "position",
      "created_by"
    )}
  `;
}

export interface SubtaskRow {
  id: number;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_by: string | null;
  done_by: string | null;
  done_at: Date | null;
  created_at: Date;
}

export async function listSubtasks(taskId: string): Promise<SubtaskRow[]> {
  return sql<SubtaskRow[]>`
    select id, task_id, title, is_done, position, created_by, done_by, done_at, created_at
      from task.task_subtasks
     where task_id = ${taskId}::uuid
     order by position asc, id asc
  `;
}

export async function addSubtask(
  taskId: string,
  title: string,
  createdBy: string
): Promise<SubtaskRow> {
  const rows = await sql<SubtaskRow[]>`
    insert into task.task_subtasks (task_id, title, created_by, position)
    values (
      ${taskId}::uuid,
      ${title},
      ${createdBy}::uuid,
      coalesce((select max(position) + 1 from task.task_subtasks where task_id = ${taskId}::uuid), 0)
    )
    returning id, task_id, title, is_done, position, created_by, done_by, done_at, created_at
  `;
  return rows[0]!;
}

/** Fetch one subtask (used for permission/ownership checks). */
export async function getSubtask(id: number): Promise<SubtaskRow | null> {
  const rows = await sql<SubtaskRow[]>`
    select id, task_id, title, is_done, position, created_by, done_by, done_at, created_at
      from task.task_subtasks where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function setSubtaskDone(
  id: number,
  isDone: boolean,
  actorId: string
): Promise<SubtaskRow | null> {
  const rows = await sql<SubtaskRow[]>`
    update task.task_subtasks
       set is_done = ${isDone},
           done_by = case when ${isDone} then ${actorId}::uuid else null end,
           done_at = case when ${isDone} then now() else null end
     where id = ${id}
    returning id, task_id, title, is_done, position, created_by, done_by, done_at, created_at
  `;
  return rows[0] ?? null;
}

export async function deleteSubtask(id: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    delete from task.task_subtasks where id = ${id} returning id
  `;
  return rows.length > 0;
}
