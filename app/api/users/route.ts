import { requireUser } from "@/lib/auth";
import { listActiveAssignableUsers } from "@/lib/dao/users";
import { apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || null;
  const rows = await listActiveAssignableUsers(date);
  return apiOk({ users: rows });
}
