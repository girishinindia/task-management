import { requireUser } from "@/lib/auth";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import {
  MAX_COMMENT_ATTACHMENT_BYTES,
  buildCommentAttachmentPath,
  cdnUrl,
  isAllowedCommentAttachment,
  uploadToBunny,
} from "@/lib/bunny";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Upload a single image / PDF / Word file for a comment. Returns the public
 *  URL + metadata; the comment itself is created in a follow-up JSON POST.
 *  Permission: anyone who can read the task. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't comment on this task", 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("invalid_form", "Request must be multipart/form-data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("missing_file", "A file is required (field name 'file')", 400);
  }
  if (file.size === 0) return apiError("empty_file", "File is empty", 400);
  if (file.size > MAX_COMMENT_ATTACHMENT_BYTES) {
    return apiError(
      "file_too_large",
      `File exceeds the ${Math.round(
        MAX_COMMENT_ATTACHMENT_BYTES / (1024 * 1024)
      )} MB limit`,
      413
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedCommentAttachment(file.name, mime)) {
    return apiError(
      "mime_not_allowed",
      `"${file.name}" isn't allowed. Comments accept images, PDF, and Word files only.`,
      415,
      { mime, name: file.name }
    );
  }

  const originalName = (file.name || "upload").slice(0, 200);
  const path = buildCommentAttachmentPath(params.id, originalName);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return apiError("read_failed", "Couldn't read the uploaded file", 400);
  }

  try {
    await uploadToBunny({ path, body: buffer, contentType: mime });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bunny upload failed";
    return apiError("upload_failed", message, 502);
  }

  return apiOk({
    url: cdnUrl(path),
    name: originalName,
    mime,
    size: file.size,
  });
}
