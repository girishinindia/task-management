import { requireUser } from "@/lib/auth";
import { canMutate, getTask } from "@/lib/dao/tasks";
import {
  findInvalidAssignees,
  listAssigneesForTask,
  setAssignments,
} from "@/lib/dao/assignments";
import { setAssignmentsSchema } from "@/lib/schemas/assignments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);

  const assignees = await listAssigneesForTask(params.id);
  // Read rule for Phase 6: creator, assignee, or admin.
  const isAssignee = assignees.some((a) => a.user_id === me.userId);
  if (
    me.role !== "admin" &&
    task.created_by !== me.userId &&
    !isAssignee
  ) {
    return apiError("forbidden", "You can't view this task", 403);
  }
  return apiOk({ assignees });
}

/** Replace the task's assignee set with the provided user_ids. */
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

  const parsed = setAssignmentsSchema.safeParse(body);
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
  if (!canMutate(task, me.userId, me.role)) {
    return apiError(
      "forbidden",
      "Only the task creator or an admin can change assignees.",
      403
    );
  }

  const invalid = await findInvalidAssignees({
    user_ids: parsed.data.user_ids,
    due_date: task.due_date,
  });
  if (invalid.inactive.length > 0) {
    return apiError(
      "user_inactive",
      "Some selected users are deactivated and can't be assigned.",
      400,
      invalid
    );
  }
  if (invalid.inactive_on_date.length > 0) {
    return apiError(
      "user_inactive_on_date",
      `Some selected users are marked inactive on ${task.due_date}.`,
      400,
      invalid
    );
  }

  const assignees = await setAssignments({
    task_id: task.id,
    user_ids: parsed.data.user_ids,
    assigned_by: me.userId,
  });
  return apiOk({ assignees });
}
