import { requireUser } from "@/lib/auth";
import { statusChangeSchema, MEMBER_STATUSES } from "@/lib/schemas/status";
import {
  canReadTask,
  changeTaskStatus,
  getTask,
} from "@/lib/dao/tasks";
import { canManageProject } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Change a task's status atomically via task.change_task_status() RPC.
 *  Permission: creator, any current assignee, or admin. */
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

  const parsed = statusChangeSchema.safeParse(body);
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

  // Status changes allowed for anyone who can READ the task (creator,
  // assignee, or admin). Read-permission already implies they have business
  // context to move the work forward.
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't change this task's status", 403);
  }

  // Members may only move a task to In progress or Done; blocking, cancelling,
  // and re-opening are manager-only (project admin / super admin).
  const canManage = await canManageProject(me.userId, me.role, task.project_id);
  if (!canManage && !MEMBER_STATUSES.includes(parsed.data.to_status)) {
    return apiError(
      "forbidden",
      "Members can only set a task to In progress or Done.",
      403
    );
  }

  const result = await changeTaskStatus({
    task_id: params.id,
    to_status: parsed.data.to_status,
    actor_id: me.userId,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError("not_found", result.message, 404);
    }
    if (result.reason === "illegal_transition") {
      return apiError(
        "illegal_transition",
        `Can't move ${task.status} → ${parsed.data.to_status} directly.`,
        409,
        { from: task.status, to: parsed.data.to_status }
      );
    }
    return apiError("server_error", result.message, 500);
  }

  await recordAudit({
    action: "task.status_changed",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Status of "${task.title}": ${task.status} → ${parsed.data.to_status}`,
    metadata: {
      from: task.status,
      to: parsed.data.to_status,
      note: parsed.data.note ?? null,
    },
    ip: clientIp(req),
  });

  return apiOk({ task: result.task, history: result.history });
}
