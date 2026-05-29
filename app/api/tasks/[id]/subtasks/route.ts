import { requireUser } from "@/lib/auth";
import { subtaskCreateSchema } from "@/lib/schemas/subtasks";
import { addSubtask, listSubtasks } from "@/lib/dao/subtasks";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** List checklist items. Anyone who can read the task. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't view this task", 403);
  }
  const subtasks = await listSubtasks(params.id);
  return apiOk({ subtasks });
}

/** Add a checklist item. Anyone who can read the task. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't edit this task", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = subtaskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const subtask = await addSubtask(params.id, parsed.data.title, me.userId);
  return apiOk({ subtask });
}
