import { requireUser } from "@/lib/auth";
import { updateProjectSchema } from "@/lib/schemas/projects";
import {
  canManageProject,
  getProject,
  updateProject,
} from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Rename / edit a project. Project admin or super admin. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const project = await getProject(params.id);
  if (!project) return apiError("not_found", "Project not found", 404);
  if (!(await canManageProject(me.userId, me.role, params.id))) {
    return apiError(
      "forbidden",
      "Only a project admin (or super admin) can edit this project.",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const after = await updateProject(params.id, parsed.data);
  if (!after) return apiError("not_found", "Project not found", 404);

  await recordAudit({
    action: "project.updated",
    entityType: "project",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Updated project "${after.name}"`,
    metadata: { changes: parsed.data, previous_name: project.name },
    ip: clientIp(req),
  });

  return apiOk({ project: after });
}
