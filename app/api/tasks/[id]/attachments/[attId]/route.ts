import { requireUser } from "@/lib/auth";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { deleteAttachment, getAttachment } from "@/lib/dao/attachments";
import { deleteFromBunny } from "@/lib/bunny";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Delete an attachment.
 *
 *  Permission: the uploader, the task creator, or an admin. Matches the
 *  phases-doc spec.
 *
 *  For file attachments we delete the Bunny object first, then the DB row.
 *  If Bunny returns 404 (object already gone) we still proceed with the DB
 *  delete so the row doesn't outlive the storage.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; attId: string } }
) {
  const me = await requireUser();

  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't view this task", 403);
  }

  const att = await getAttachment(params.attId);
  if (!att || att.task_id !== params.id) {
    return apiError("not_found", "Attachment not found", 404);
  }

  const isUploader = att.uploaded_by === me.userId;
  const isCreator = task.created_by === me.userId;
  const isAdmin = me.role === "admin";
  if (!isUploader && !isCreator && !isAdmin) {
    return apiError(
      "forbidden",
      "Only the uploader, the task creator, or an admin can delete attachments.",
      403
    );
  }

  if (att.kind === "file" && att.bunny_path) {
    try {
      await deleteFromBunny(att.bunny_path);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bunny delete failed";
      return apiError("storage_delete_failed", message, 502);
    }
  }

  const removed = await deleteAttachment(att.id);
  return apiOk({ removed });
}
