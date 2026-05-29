import { requireUser } from "@/lib/auth";
import { deleteComment, getComment } from "@/lib/dao/comments";
import { isSuperAdmin } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Delete a comment. The author or a super admin only. */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const me = await requireUser();
  const commentId = Number(params.commentId);
  if (!Number.isInteger(commentId)) {
    return apiError("validation", "Invalid comment id", 400);
  }

  const comment = await getComment(commentId);
  if (!comment || comment.task_id !== params.id) {
    return apiError("not_found", "Comment not found", 404);
  }

  const isAuthor = comment.author_id === me.userId;
  const isSuper = await isSuperAdmin(me.userId);
  if (!isAuthor && !isSuper) {
    return apiError("forbidden", "You can't delete this comment", 403);
  }

  await deleteComment(commentId);

  await recordAudit({
    action: "task.comment_deleted",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Deleted a comment on task ${params.id}`,
    metadata: { comment_id: commentId, was_author: isAuthor },
    ip: clientIp(req),
  });

  return apiOk({});
}
