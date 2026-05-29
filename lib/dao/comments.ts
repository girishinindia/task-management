/**
 * Task comments DAO — a simple per-task discussion thread.
 *
 * Read/write permission is enforced in the API routes (canReadTask to read or
 * post; author or super admin to delete).
 */
import { sql } from "@/lib/db";

export interface CommentRow {
  id: number;
  task_id: string;
  author_id: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  created_at: Date;
  updated_at: Date;
  author_full_name: string | null;
  author_email: string | null;
}

export interface CommentAttachment {
  url: string;
  name: string;
  mime: string;
}

/** Comments for a task, oldest first. */
export async function listComments(taskId: string): Promise<CommentRow[]> {
  return sql<CommentRow[]>`
    select c.id, c.task_id, c.author_id, c.body,
           c.attachment_url, c.attachment_name, c.attachment_mime,
           c.created_at, c.updated_at,
           u.full_name   as author_full_name,
           u.email::text as author_email
      from task.task_comments c
      left join task.users u on u.id = c.author_id
     where c.task_id = ${taskId}::uuid
     order by c.created_at asc, c.id asc
  `;
}

export async function addComment(
  taskId: string,
  authorId: string,
  body: string,
  attachment?: CommentAttachment | null
): Promise<CommentRow> {
  const rows = await sql<CommentRow[]>`
    with ins as (
      insert into task.task_comments
        (task_id, author_id, body, attachment_url, attachment_name, attachment_mime)
      values (
        ${taskId}::uuid, ${authorId}::uuid, ${body},
        ${attachment?.url ?? null}, ${attachment?.name ?? null}, ${attachment?.mime ?? null}
      )
      returning id, task_id, author_id, body,
                attachment_url, attachment_name, attachment_mime,
                created_at, updated_at
    )
    select ins.*, u.full_name as author_full_name, u.email::text as author_email
      from ins left join task.users u on u.id = ins.author_id
  `;
  return rows[0]!;
}

/** Fetch one comment (used for delete permission checks). */
export async function getComment(id: number): Promise<CommentRow | null> {
  const rows = await sql<CommentRow[]>`
    select c.id, c.task_id, c.author_id, c.body,
           c.attachment_url, c.attachment_name, c.attachment_mime,
           c.created_at, c.updated_at,
           u.full_name as author_full_name, u.email::text as author_email
      from task.task_comments c
      left join task.users u on u.id = c.author_id
     where c.id = ${id}
     limit 1
  `;
  return rows[0] ?? null;
}

export async function deleteComment(id: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    delete from task.task_comments where id = ${id} returning id
  `;
  return rows.length > 0;
}

export async function countComments(taskId: string): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    select count(*)::text as n from task.task_comments where task_id = ${taskId}::uuid
  `;
  return Number(rows[0]?.n ?? 0);
}
