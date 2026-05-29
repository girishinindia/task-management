import { requireUser } from "@/lib/auth";
import { listAuditLog } from "@/lib/dao/audit";
import { PageHeader } from "@/components/page-header";
import { AuditLogView } from "@/components/audit-log-view";

export const metadata = { title: "My activity" };
export const dynamic = "force-dynamic";

type SP = { q?: string; action?: string; offset?: string };

const LIMIT = 50;

export default async function MyActivityPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requireUser();

  const offset = Math.max(0, Number(searchParams.offset) || 0);
  const q = searchParams.q?.trim() || null;
  const action = searchParams.action?.trim() || null;

  const { rows, total } = await listAuditLog({
    actorId: me.userId,
    action,
    search: q,
    limit: LIMIT,
    offset,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="My activity"
        description="A log of everything you've done — sign-ins, status reports, attachments, and more."
      />
      <AuditLogView
        rows={rows}
        total={total}
        limit={LIMIT}
        offset={offset}
        q={searchParams.q ?? ""}
        action={searchParams.action ?? ""}
        basePath="/dashboard/activity"
        showActor={false}
      />
    </div>
  );
}
