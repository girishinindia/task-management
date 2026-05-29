import { requireAdmin } from "@/lib/auth";
import { listAuditLog } from "@/lib/dao/audit";
import { PageHeader } from "@/components/page-header";
import { AuditLogView } from "@/components/audit-log-view";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

type SP = { q?: string; action?: string; offset?: string };

const LIMIT = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireAdmin();

  const offset = Math.max(0, Number(searchParams.offset) || 0);
  const q = searchParams.q?.trim() || null;
  const action = searchParams.action?.trim() || null;

  const { rows, total } = await listAuditLog({
    action,
    search: q,
    limit: LIMIT,
    offset,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Audit log"
        description="Every action across the workspace — sign-ins, task changes, attachments, and admin operations."
      />
      <AuditLogView
        rows={rows}
        total={total}
        limit={LIMIT}
        offset={offset}
        q={searchParams.q ?? ""}
        action={searchParams.action ?? ""}
        basePath="/admin/audit"
        showActor
      />
    </div>
  );
}
