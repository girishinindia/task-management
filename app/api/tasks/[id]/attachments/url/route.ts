import { requireUser } from "@/lib/auth";
import { canReadTask, getTask } from "@/lib/dao/tasks";
import { insertUrlAttachment } from "@/lib/dao/attachments";
import { urlAttachmentSchema } from "@/lib/schemas/attachments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Add a URL link attachment. Permission: anyone who can read the task. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) return apiError("not_found", "Task not found", 404);
  if (!(await canReadTask(params.id, me.userId, me.role))) {
    return apiError("forbidden", "You can't attach to this task", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = urlAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const row = await insertUrlAttachment({
    task_id: params.id,
    link_url: parsed.data.link_url,
    original_name: parsed.data.original_name ?? null,
    uploaded_by: me.userId,
  });
  return apiOk({ attachment: row });
}
