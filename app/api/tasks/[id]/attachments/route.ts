import { requireUser } from "@/lib/auth";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { listAttachmentsForTask } from "@/lib/dao/attachments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** List attachments visible to the current user. Anyone who can read the
 *  task can read its attachments. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't view this task", 403);
  }
  const attachments = await listAttachmentsForTask(params.id);
  return apiOk({ attachments });
}
