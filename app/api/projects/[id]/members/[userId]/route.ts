import { requireUser } from "@/lib/auth";
import {
  canModifyMember,
  getProject,
  removeMember,
} from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Remove a member from a project. Project admin or workspace admin — but an
 *  admin can only be removed by the project creator or a super admin. */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const me = await requireUser();
  const project = await getProject(params.id);
  if (!project) return apiError("not_found", "Project not found", 404);

  const guard = await canModifyMember({
    actorId: me.userId,
    role: me.role,
    project,
    targetUserId: params.userId,
  });
  if (!guard.ok) return apiError("forbidden", guard.message, 403);

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
