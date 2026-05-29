import { requireUser } from "@/lib/auth";
import { canMutate, getTask } from "@/lib/dao/tasks";
import { removeAssignment } from "@/lib/dao/assignments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!canMutate(task, me.userId, me.role)) {
    return apiError(
      "forbidden",
      "Only the task creator or an admin can change assignees.",
      403
    );
  }
  const removed = await removeAssignment(params.id, params.userId);
  return apiOk({ removed });
}
