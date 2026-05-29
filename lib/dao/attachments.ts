/**
 * Attachments data access — files (stored in Bunny) and URL links (DB-only)
 * share one polymorphic table with a CHECK constraint enforcing the right
 * payload columns for each kind.
 */
import { sql } from "@/lib/db";

export type AttachmentKind = "file" | "url";

export interface AttachmentRow {
  id: string;
  task_id: string;
  kind: AttachmentKind;
  bunny_path: string | null;
  cdn_url: string | null;
  link_url: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: Date;
  /** Joined: display name of uploader. */
  uploader_full_name: string | null;
  uploader_email: string | null;
}

/** All attachments on a task, newest first. */
export async function listAttachmentsForTask(
  taskId: string
): Promise<AttachmentRow[]> {
  return sql<AttachmentRow[]>`
    select a.id, a.task_id, a.kind,
           a.bunny_path, a.cdn_url, a.link_url,
           a.original_name, a.mime_type, a.size_bytes,
           a.uploaded_by, a.uploaded_at,
           u.full_name   as uploader_full_name,
           u.email::text as uploader_email
      from task.task_attachments a
      left join task.users u on u.id = a.uploaded_by
     where a.task_id = ${taskId}::uuid
     order by a.uploaded_at desc, a.id desc
  `;
}

/** Fetch a single attachment row (or null). Used by DELETE handler to find
 *  the bunny_path before doing the Bunny delete. */
export async function getAttachment(
  id: string
): Promise<AttachmentRow | null> {
  const rows = await sql<AttachmentRow[]>`
    select a.id, a.task_id, a.kind,
           a.bunny_path, a.cdn_url, a.link_url,
           a.original_name, a.mime_type, a.size_bytes,
           a.uploaded_by, a.uploaded_at,
           u.full_name   as uploader_full_name,
           u.email::text as uploader_email
      from task.task_attachments a
      left join task.users u on u.id = a.uploaded_by
     where a.id = ${id}::uuid
     limit 1
  `;
  return rows[0] ?? null;
}

/** Insert a file attachment row after a successful Bunny upload. */
export async function insertFileAttachment(opts: {
  task_id: string;
  bunny_path: string;
  cdn_url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
}): Promise<AttachmentRow> {
  const rows = await sql<AttachmentRow[]>`
    insert into task.task_attachments
      (task_id, kind, bunny_path, cdn_url, original_name, mime_type, size_bytes, uploaded_by)
    values
      (${opts.task_id}::uuid, 'file',
       ${opts.bunny_path}, ${opts.cdn_url},
       ${opts.original_name}, ${opts.mime_type}, ${opts.size_bytes},
       ${opts.uploaded_by}::uuid)
    returning id, task_id, kind, bunny_path, cdn_url, link_url,
              original_name, mime_type, size_bytes,
              uploaded_by, uploaded_at,
              null::text as uploader_full_name,
              null::text as uploader_email
  `;
  return rows[0]!;
}

/** Insert a URL link attachment. */
export async function insertUrlAttachment(opts: {
  task_id: string;
  link_url: string;
  original_name?: string | null;
  uploaded_by: string;
}): Promise<AttachmentRow> {
  const rows = await sql<AttachmentRow[]>`
    insert into task.task_attachments
      (task_id, kind, link_url, original_name, uploaded_by)
    values
      (${opts.task_id}::uuid, 'url',
       ${opts.link_url}, ${opts.original_name ?? null},
       ${opts.uploaded_by}::uuid)
    returning id, task_id, kind, bunny_path, cdn_url, link_url,
              original_name, mime_type, size_bytes,
              uploaded_by, uploaded_at,
              null::text as uploader_full_name,
              null::text as uploader_email
  `;
  return rows[0]!;
}

/** Delete an attachment row. Returns whether a row was removed. */
export async function deleteAttachment(id: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    delete from task.task_attachments
     where id = ${id}::uuid
    returning id
  `;
  return rows.length > 0;
}
