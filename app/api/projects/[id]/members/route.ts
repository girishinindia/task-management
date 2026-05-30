import { requireUser } from "@/lib/auth";
import { addMemberSchema } from "@/lib/schemas/projects";
import { addMember, canModifyMember, getProject } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Add a member (or change their role). Project admin or workspace admin —
 *  but only the project creator or a super admin may grant/revoke the Admin
 *  role or touch an existing admin. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const project = await getProject(params.id);
  if (!project) return apiError("not_found", "Project not found", 404);

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

  const guard = await canModifyMember({
    actorId: me.userId,
    role: me.role,
    project,
    targetUserId: parsed.data.user_id,
    nextRole: parsed.data.role,
  });
  if (!guard.ok) return apiError("forbidden", guard.message, 403);

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
