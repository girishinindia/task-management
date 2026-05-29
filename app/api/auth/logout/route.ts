import { revokeCurrentSession } from "@/lib/auth";
import { apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST() {
  await revokeCurrentSession();
  return apiOk({});
}
