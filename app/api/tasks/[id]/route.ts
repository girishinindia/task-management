import { requireUser } from "@/lib/auth";
import { taskUpdateSchema } from "@/lib/schemas/tasks";
import {
  canMutate,
  canReadTask,
  deleteTask,
  getTask,
  updateTask,
} from "@/lib/dao/tasks";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  // Phase 6 read rule: creator, assignee, or admin.
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't view this task", 403);
  }
  return apiOk({ task });
}

export async function PATCH(
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

  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  // Phase 8: status changes MUST route through POST /api/tasks/[id]/status
  // so they're atomic with the audit log + notification fan-out trigger.
  if (parsed.data.status !== undefined) {
    return apiError(
      "use_status_endpoint",
      "Status changes must go through POST /api/tasks/[id]/status",
      400
    );
  }

  const current = await getTask(params.id);
  if (!current) return apiError("not_found", "Task not found", 404);
  if (!canMutate(current, me.userId, me.role)) {
    return apiError("forbidden", "You can't update this task", 403);
  }

  // Strip status defensively even though we already rejected when it was set.
  const { status: _ignored, ...patch } = parsed.data;
  const updated = await updateTask(params.id, patch);
  if (!updated) return apiError("not_found", "Task not found", 404);

  await recordAudit({
    action: "task.updated",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Updated task "${updated.title}"`,
    metadata: { fields: Object.keys(patch) },
    ip: clientIp(req),
  });

  return apiOk({ task: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const current = await getTask(params.id);
  if (!current) return apiError("not_found", "Task not found", 404);
  if (!canMutate(current, me.userId, me.role)) {
    return apiError("forbidden", "You can't delete this task", 403);
  }
  await deleteTask(params.id);

  await recordAudit({
    action: "task.deleted",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Deleted task "${current.title}"`,
    ip: clientIp(req),
  });

  return apiOk({});
}
