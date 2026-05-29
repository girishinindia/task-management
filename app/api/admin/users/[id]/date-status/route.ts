import { requireAdmin } from "@/lib/auth";
import {
  dateStatusSchema,
  dateStatusDeleteSchema,
} from "@/lib/schemas/admin";
import { findUserById } from "@/lib/dao/users";
import {
  deleteDateStatus,
  listDateStatusForUser,
  upsertDateStatus,
} from "@/lib/dao/user-date-status";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireAdmin();

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  const user = await findUserById(params.id);
  if (!user) return apiError("not_found", "User not found", 404);

  const rows = await listDateStatusForUser(params.id, { from, to });
  return apiOk({ rows });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = dateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const user = await findUserById(params.id);
  if (!user) return apiError("not_found", "User not found", 404);

  const row = await upsertDateStatus({
    user_id: params.id,
    date: parsed.data.date,
    is_active: parsed.data.is_active,
    note: parsed.data.note ?? null,
  });
  return apiOk({ row });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = dateStatusDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const removed = await deleteDateStatus(params.id, parsed.data.date);
  return apiOk({ removed });
}
