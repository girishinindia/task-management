import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { listSuperAdminIds } from "@/lib/dao/projects";
import { notifyUsers } from "@/lib/dao/notifications";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

const requestSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name").max(120),
  reason: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().max(1000).optional()
    )
    .nullable()
    .optional(),
});

/** Any signed-in user can request a new project; it notifies all super admins. */
export async function POST(req: Request) {
  const me = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const supers = await listSuperAdminIds();
  await notifyUsers(supers, {
    type: "project_requested",
    title: `Project request: ${parsed.data.name}`,
    body: `${me.email} requested a new project${
      parsed.data.reason ? ` — ${parsed.data.reason}` : ""
    }`,
    link: "/dashboard/projects",
  });

  await recordAudit({
    action: "project.requested",
    entityType: "project",
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Requested a new project "${parsed.data.name}"`,
    metadata: { name: parsed.data.name, reason: parsed.data.reason ?? null },
    ip: clientIp(req),
  });

  return apiOk({});
}
