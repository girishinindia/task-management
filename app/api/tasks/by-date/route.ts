import { requireUser } from "@/lib/auth";
import { listTasksForDate } from "@/lib/dao/tasks";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tasks the current user can see that occupy the given ISO date. */
export async function GET(req: Request) {
  const me = await requireUser();
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";

  if (!ISO_DATE.test(date)) {
    return apiError(
      "invalid_date",
      "date must be a YYYY-MM-DD string",
      400
    );
  }

  const tasks = await listTasksForDate(me.userId, me.role, date);
  return apiOk({ tasks });
}
