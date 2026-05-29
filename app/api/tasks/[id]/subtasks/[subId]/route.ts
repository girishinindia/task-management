import { requireUser } from "@/lib/auth";
import { subtaskUpdateSchema } from "@/lib/schemas/subtasks";
import { deleteSubtask, getSubtask, setSubtaskDone } from "@/lib/dao/subtasks";
import { canReadTask } from "@/lib/dao/tasks";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Toggle a checklist item done/undone. Anyone who can read the task. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; subId: string } }
) {
  const me = await requireUser();
  const subId = Number(params.subId);
  if (!Number.isInteger(subId)) {
    return apiError("validation", "Invalid subtask id", 400);
  }
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't edit this task", 403);
  }

  const existing = await getSubtask(subId);
  if (!existing || existing.task_id !== params.id) {
    return apiError("not_found", "Checklist item not found", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = subtaskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("validation", "Some fields are invalid", 400);
  }

  const subtask = await setSubtaskDone(subId, parsed.data.is_done, me.userId);
  return apiOk({ subtask });
}

/** Delete a checklist item. Anyone who can read the task. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; subId: string } }
) {
  const me = await requireUser();
  const subId = Number(params.subId);
  if (!Number.isInteger(subId)) {
    return apiError("validation", "Invalid subtask id", 400);
  }
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't edit this task", 403);
  }

  const existing = await getSubtask(subId);
  if (!existing || existing.task_id !== params.id) {
    return apiError("not_found", "Checklist item not found", 404);
  }

  await deleteSubtask(subId);
  return apiOk({});
}
