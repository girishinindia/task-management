import { requireUser } from "@/lib/auth";
import {
  bulkTaskActionSchema,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/schemas/tasks";
import { MEMBER_STATUSES } from "@/lib/schemas/status";
import {
  canReadTask,
  changeTaskStatus,
  getTask,
  setTaskActive,
  updateTask,
} from "@/lib/dao/tasks";
import { canManageProject } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Apply one action to many tasks. Permission is checked per task; tasks the
 *  user can't act on are skipped (not an error). Returns applied/skipped counts. */
export async function POST(req: Request) {
  const me = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = bulkTaskActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const { ids, action, value } = parsed.data;

  let applied = 0;
  let skipped = 0;

  for (const id of ids) {
    const task = await getTask(id);
    if (!task) {
      skipped += 1;
      continue;
    }
    const canManage = await canManageProject(me.userId, me.role, task.project_id);

    if (action === "status") {
      const to = value as TaskStatus;
      const canRead = await canReadTask(id, me.userId, me.role);
      if (!canRead || (!canManage && !MEMBER_STATUSES.includes(to))) {
        skipped += 1;
        continue;
      }
      const result = await changeTaskStatus({
        task_id: id,
        to_status: to,
        actor_id: me.userId,
      });
      if (result.ok) applied += 1;
      else skipped += 1;
    } else if (action === "priority") {
      if (!canManage) {
        skipped += 1;
        continue;
      }
      await updateTask(id, { priority: value as TaskPriority });
      applied += 1;
    } else {
      // archive | restore
      if (!canManage) {
        skipped += 1;
        continue;
      }
      await setTaskActive(id, action === "restore");
      applied += 1;
    }
  }

  await recordAudit({
    action: "task.bulk_action",
    entityType: "task",
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Bulk ${action} on ${applied} task(s)`,
    metadata: { action, value: value ?? null, applied, skipped, requested: ids.length },
    ip: clientIp(req),
  });

  return apiOk({ applied, skipped });
}
