import { requireUser } from "@/lib/auth";
import { canMutate, getTask } from "@/lib/dao/tasks";
import { removeAssignment } from "@/lib/dao/assignments";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!canMutate(task, me.userId, me.role)) {
    return apiError(
      "forbidden",
      "Only an admin can change assignees.",
      403
    );
  }
  const removed = await removeAssignment(params.id, params.userId);

  await recordAudit({
    action: "task.assignee_removed",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Removed an assignee from "${task.title}"`,
    metadata: { user_id: params.userId },
    ip: clientIp(req),
  });

  return apiOk({ removed });
}
