import { requireUser } from "@/lib/auth";
import {
  canManageProject,
  getProject,
  removeMember,
} from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Remove a member from a project. Project admin or workspace admin. */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } }
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

  const removed = await removeMember(params.id, params.userId);

  await recordAudit({
    action: "project.member_removed",
    entityType: "project",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Removed a member from "${project.name}"`,
    metadata: { user_id: params.userId },
    ip: clientIp(req),
  });

  return apiOk({ removed });
}
