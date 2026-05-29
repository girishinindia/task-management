import { requireUser } from "@/lib/auth";
import { commentCreateSchema } from "@/lib/schemas/comments";
import { addComment, listComments } from "@/lib/dao/comments";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { listAssigneesForTask } from "@/lib/dao/assignments";
import { notifyUsers } from "@/lib/dao/notifications";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** List comments for a task. Anyone who can read the task. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't view this task", 403);
  }
  const comments = await listComments(params.id);
  return apiOk({ comments });
}

/** Post a comment. Anyone who can read the task. Notifies the creator + other
 *  assignees (not the author). */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't comment on this task", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const attachment = parsed.data.attachment_url
    ? {
        url: parsed.data.attachment_url,
        name: parsed.data.attachment_name ?? "attachment",
        mime: parsed.data.attachment_mime ?? "application/octet-stream",
      }
    : null;

  const commentBody = parsed.data.body?.trim() ?? "";
  const comment = await addComment(params.id, me.userId, commentBody, attachment);

  // Notify the task creator + current assignees, excluding the author.
  const assignees = await listAssigneesForTask(params.id);
  const recipients = [
    task.created_by,
    ...assignees.map((a) => a.user_id),
  ].filter((uid) => uid && uid !== me.userId);
  if (recipients.length > 0) {
    const base = commentBody || (attachment ? `📎 ${attachment.name}` : "");
    const excerpt = base.length > 140 ? `${base.slice(0, 137)}…` : base;
    await notifyUsers(recipients, {
      type: "comment_added",
      title: `New comment on "${task.title}"`,
      body: excerpt,
      link: `/dashboard/tasks/${params.id}`,
    });
  }

  await recordAudit({
    action: "task.comment_added",
    entityType: "task",
    entityId: params.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Commented on "${task.title}"`,
    metadata: { comment_id: comment.id },
    ip: clientIp(req),
  });

  return apiOk({ comment });
}
