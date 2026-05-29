import { requireUser } from "@/lib/auth";
import { taskCreateSchema } from "@/lib/schemas/tasks";
import { createTask } from "@/lib/dao/tasks";
import { findInvalidAssignees } from "@/lib/dao/assignments";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await requireUser();
  if (me.role !== "admin") {
    return apiError("forbidden", "Only an admin can create tasks.", 403);
  }

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
  return apiOk({ task });
}
