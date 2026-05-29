import { requireUser } from "@/lib/auth";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { insertFileAttachment } from "@/lib/dao/attachments";
import {
  MAX_ATTACHMENT_BYTES,
  buildAttachmentPath,
  cdnUrl,
  isAllowedAttachment,
  uploadToBunny,
} from "@/lib/bunny";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Upload a file attachment.
 *
 *  multipart/form-data
 *    file: <binary>   (required)
 *
 *  Permission: anyone who can read the task. The file goes to Bunny first;
 *  only after a successful upload do we insert the DB row, so we never end
 *  up with a DB row pointing at a non-existent object. (The reverse — a
 *  Bunny object without a DB row — can happen if the DB insert fails after
 *  upload; that's an orphan, cleanable later.)
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't attach to this task", 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(
      "invalid_form",
      "Request must be multipart/form-data",
      400
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("missing_file", "A file is required (field name 'file')", 400);
  }

  if (file.size === 0) {
    return apiError("empty_file", "File is empty", 400);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return apiError(
      "file_too_large",
      `File exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB limit`,
      413,
      { size: file.size, max: MAX_ATTACHMENT_BYTES }
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedAttachment(file.name, mime)) {
    return apiError(
      "mime_not_allowed",
      `"${file.name}" (${mime}) is not an allowed attachment type`,
      415,
      { mime, name: file.name }
    );
  }

  const originalName = (file.name || "upload").slice(0, 200);
  const path = buildAttachmentPath(params.id, originalName);

  // Upload to Bunny. If this fails, we surface a 502 and the DB stays clean.
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return apiError("read_failed", "Couldn't read the uploaded file", 400);
  }

  try {
    await uploadToBunny({
      path,
      body: buffer,
      contentType: mime,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bunny upload failed";
    return apiError("upload_failed", message, 502);
  }

  // DB insert. On failure, we'd leave an orphan object in Bunny — log and
  // surface a 500 so the user can retry.
  try {
    const row = await insertFileAttachment({
      task_id: params.id,
      bunny_path: path,
      cdn_url: cdnUrl(path),
      original_name: originalName,
      mime_type: mime,
      size_bytes: file.size,
      uploaded_by: me.userId,
    });
    await recordAudit({
      action: "attachment.added",
      entityType: "attachment",
      entityId: row.id,
      actorId: me.userId,
      actorEmail: me.email,
      summary: `Attached file "${originalName}"`,
      metadata: { task_id: params.id, kind: "file", mime, size_bytes: file.size },
      ip: clientIp(req),
    });
    return apiOk({ attachment: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "DB insert failed";
    return apiError("db_failed", message, 500, { orphan_path: path });
  }
}
