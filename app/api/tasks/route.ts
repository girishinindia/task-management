import { requireUser } from "@/lib/auth";
import { taskCreateSchema } from "@/lib/schemas/tasks";
import { createTask } from "@/lib/dao/tasks";
import { findInvalidAssignees } from "@/lib/dao/assignments";
import {
  canCreateTasks,
  canManageProject,
  findNonMembers,
  getProject,
} from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  // Task creation is restricted to workspace admins and super admins.
  if (!(await canCreateTasks(me.userId, me.role))) {
    return apiError(
      "forbidden",
      "Only a workspace admin or super admin can create tasks.",
      403
    );
  }

  const project = await getProject(parsed.data.project_id);
  if (!project) return apiError("not_found", "Project not found", 404);
  // Workspace admins still create within a project they belong to.
  if (!(await canManageProject(me.userId, me.role, parsed.data.project_id))) {
    return apiError(
      "forbidden",
      "You can only create tasks in a project you belong to.",
      403
    );
  }

  // Initial assignees must be members of the project.
  if (parsed.data.assignee_ids.length > 0) {
    const nonMembers = await findNonMembers(
      parsed.data.project_id,
      parsed.data.assignee_ids
    );
    if (nonMembers.length > 0) {
      return apiError(
        "not_project_member",
        "Some selected users aren't members of this project.",
        400,
        { user_ids: nonMembers }
      );
    }
  }

  // Date-activation guard for initial assignees.
  if (parsed.data.assignee_ids.length > 0) {
    const invalid = await findInvalidAssignees({
      user_ids: parsed.data.assignee_ids,
      due_date: parsed.data.due_date ?? null,
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
        `Some selected users are marked inactive on ${parsed.data.due_date}.`,
        400,
        invalid
      );
    }
  }

  const task = await createTask(me.userId, parsed.data);

  await recordAudit({
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Created task "${task.title}"`,
    metadata: {
      priority: parsed.data.priority,
      due_date: parsed.data.due_date ?? null,
      assignees: parsed.data.assignee_ids.length,
    },
    ip: clientIp(req),
  });

  return apiOk({ task });
}
