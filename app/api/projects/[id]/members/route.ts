import { requireUser } from "@/lib/auth";
import { addMemberSchema } from "@/lib/schemas/projects";
import { addMember, canManageProject, getProject } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Add a member (or change their role). Project admin or workspace admin. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const project = await getProject(params.id);
  if (!project) return apiError("not_found", "Project not found", 404);
  if (!(await canManageProject(me.userId, me.role, params.id))) {
    return apiError(
      "forbidden",
      "Only a project admin (or workspace admin) can manage members.",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  await addMember({
    project_id: params.id,
    user_id: parsed.data.user_id,
    role: parsed.data.role,
    added_by: me.userId,
  });

  await recordAudit({
    action: "project.member_added",
    entityType: "project",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Added a ${parsed.data.role} to "${project.name}"`,
    metadata: { user_id: parsed.data.user_id, role: parsed.data.role },
    ip: clientIp(req),
  });

  return apiOk({});
}
