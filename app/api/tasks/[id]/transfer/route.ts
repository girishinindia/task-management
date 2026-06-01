import { requireUser } from "@/lib/auth";
import { transferSchema } from "@/lib/schemas/transfer";
import { getTask, transferTask } from "@/lib/dao/tasks";
import { listAssigneesForTask } from "@/lib/dao/assignments";
import { canManageProject, findNonMembers } from "@/lib/dao/projects";
import { notifyUsers } from "@/lib/dao/notifications";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
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

  // You can't transfer a task to yourself.
  if (parsed.data.to_user_id === me.userId) {
    return apiError(
      "self_transfer",
      "You can't transfer a task to yourself.",
      400
    );
  }

  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);

  // Project admins (or workspace admin) can transfer within their project.
  if (!(await canManageProject(me.userId, me.role, task.project_id))) {
    return apiError(
      "forbidden",
      "Only a project admin (or workspace admin) can transfer this task.",
      403
    );
  }
  // The new assignee must belong to the task's project.
  const targetNonMembers = await findNonMembers(task.project_id, [
    parsed.data.to_user_id,
  ]);
  if (targetNonMembers.length > 0) {
    return apiError(
      "not_project_member",
      "The target user isn't a member of this project.",
      400
    );
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

  // Refreshed assignee list (also lets us resolve the new assignee's name).
  const assignees = await listAssigneesForTask(params.id);
  const toName =
    assignees.find((a) => a.user_id === parsed.data.to_user_id)?.full_name ??
    "another member";
  const fromId = parsed.data.from_user_id ?? null;
  const reason = parsed.data.reason?.trim() || null;

  await recordAudit({
    action: "task.transferred",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    // Include the reason (and recipient) so it's visible in the Audit log and
    // "My activity", not just buried in metadata.
    summary: `Transferred "${task.title}" to ${toName}${
      reason ? ` — ${reason}` : ""
    }`,
    metadata: {
      from_user_id: fromId,
      to_user_id: parsed.data.to_user_id,
      reason,
    },
    ip: clientIp(req),
  });

  // The receiver is already notified by the transfer trigger; also notify the
  // person it was moved away FROM (skip add-only transfers / self-unassign).
  if (fromId && fromId !== me.userId) {
    await notifyUsers([fromId], {
      type: "task_transferred",
      title: `Task reassigned: "${task.title}"`,
      body: `Moved from you to ${toName}${reason ? ` — ${reason}` : ""}`,
      link: `/dashboard/tasks/${params.id}`,
    });
  }

  return apiOk({
    task: result.task,
    transfer: result.transfer,
    assignees,
  });
}
