import { requireUser } from "@/lib/auth";
import { createProjectSchema } from "@/lib/schemas/projects";
import { createProject, isSuperAdmin } from "@/lib/dao/projects";
import { recordAudit } from "@/lib/dao/audit";
import { clientIp } from "@/lib/ratelimit";
import { apiError, apiOk } from "@/lib/api-response";

export const runtime = "nodejs";

/** Create a project. Workspace-admin only; the creator becomes a project admin. */
export async function POST(req: Request) {
  const me = await requireUser();
  if (!(await isSuperAdmin(me.userId))) {
    return apiError(
      "forbidden",
      "Only a super admin can create projects.",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON", 400);
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "validation",
      "Some fields are invalid",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const project = await createProject({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: me.userId,
  });

  await recordAudit({
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    actorId: me.userId,
    actorEmail: me.email,
    summary: `Created project "${project.name}"`,
    ip: clientIp(req),
  });

  return apiOk({ project });
}
