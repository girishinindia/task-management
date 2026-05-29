import { requireUser } from "@/lib/auth";
import { transferSchema } from "@/lib/schemas/transfer";
import {
  canReadTask,
  getTask,
  transferTask,
} from "@/lib/dao/tasks";
import { listAssigneesForTask } from "@/lib/dao/assignments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Reassign a task. Atomic via task.transfer_task RPC.
 *
 *  Permission (Phase 9 rule): creator, any current assignee, or admin.
 *  Body: { from_user_id?, to_user_id, reason? }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);

  // Permission: creator, any current assignee, or admin (matches the dialog
  // visibility on the detail page).
  if (me.role !== "admin" && task.created_by !== me.userId) {
    const assignees = await listAssigneesForTask(params.id);
    const isAssignee = assignees.some((a) => a.user_id === me.userId);
    if (!isAssignee) {
      return apiError(
        "forbidden",
        "Only the creator, an assignee, or an admin can transfer this task.",
        403
      );
    }
  }

  // Re-check via canReadTask is redundant with the block above (creator OR
  // assignee OR admin) but kept for defensive symmetry.
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't transfer this task", 403);
  }

  const result = await transferTask({
    task_id: params.id,
    from_user_id: parsed.data.from_user_id ?? null,
    to_user_id: parsed.data.to_user_id,
    actor_id: me.userId,
    reason: parsed.data.reason ?? null,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError("not_found", result.message, 404);
    }
    if (result.reason === "target_inactive") {
      return apiError(
        "target_inactive",
        "The target user is deactivated and can't receive transfers.",
        400
      );
    }
    if (result.reason === "target_inactive_on_date") {
      return apiError(
        "target_inactive_on_date",
        `The target user is marked inactive on ${task.due_date ?? "the task's due date"}.`,
        400
      );
    }
    if (result.reason === "from_not_assigned") {
      return apiError(
        "from_not_assigned",
        "The source user is not currently assigned to this task.",
        400
      );
    }
    return apiError("server_error", result.message, 500);
  }

  // Return refreshed assignee list so the UI can re-render without a second
  // round trip.
  const assignees = await listAssigneesForTask(params.id);
  return apiOk({
    task: result.task,
    transfer: result.transfer,
    assignees,
  });
}
