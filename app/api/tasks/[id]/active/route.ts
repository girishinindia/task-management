import { requireUser } from "@/lib/auth";
import { getTask, setTaskActive } from "@/lib/dao/tasks";
import { canManageProject } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Deactivate (archive) or reactivate a task. Project admin / super admin.
 *  Body: { active: boolean } — defaults to deactivating. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canManageProject(me.userId, me.role, task.project_id))) {
    return apiError(
      "forbidden",
      "Only a project admin (or super admin) can deactivate this task.",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const active =
    typeof body === "object" &&
    body !== null &&
    (body as { active?: unknown }).active === true;

  const updated = await setTaskActive(params.id, active);

  await recordAudit({
    action: active ? "task.reactivated" : "task.deactivated",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `${active ? "Reactivated" : "Deactivated"} task "${task.title}"`,
    ip: clientIp(req),
  });

  return apiOk({ task: updated });
}
