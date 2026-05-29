import { requireUser } from "@/lib/auth";
import { listActiveAssignableUsers } from "@/lib/dao/users";
import { apiOk } from "@/lib/api-response";
import { isValidDateString } from "@/lib/date";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  // Only honor a well-formed, in-range date. Anything else (e.g. a mis-keyed
  // year like 0620 or 65120) is ignored so it never reaches the SQL `::date`
  // cast, which would otherwise throw "date/time field value out of range".
  const raw = url.searchParams.get("date");
  const date = isValidDateString(raw) ? raw : null;
  const projectRaw = url.searchParams.get("project_id");
  const projectId =
    projectRaw && /^[0-9a-fA-F-]{36}$/.test(projectRaw) ? projectRaw : null;
  const rows = await listActiveAssignableUsers(date, projectId);
  return apiOk({ users: rows });
}
