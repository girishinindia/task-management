import { requireUser } from "@/lib/auth";
import { taskAnalytics } from "@/lib/dao/analytics";
import { pct } from "@/lib/analytics-util";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
} from "@/lib/schemas/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  statusVariant,
} from "../tasks/task-meta";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const PRIORITY_BAR: Record<TaskPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

export default async function AnalyticsPage() {
  const me = await requireUser();
  const a = await taskAnalytics(me.userId, me.role);

  const maxStatus = Math.max(1, ...TASK_STATUSES.map((s) => a.by_status[s]));
  const maxPriority = Math.max(
    1,
    ...TASK_PRIORITIES.map((p) => a.by_priority[p])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Analytics"
        description="A snapshot of the tasks you can see."
      />

      {a.total === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center text-sm text-muted-foreground">
          No tasks to report on yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total tasks" value={a.total} />
            <Stat label="Open" value={a.open} />
            <Stat
              label="Overdue"
              value={a.overdue}
              tone={a.overdue > 0 ? "danger" : "default"}
            />
            <Stat label="Completion rate" value={`${a.completion_rate}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold">By status</h2>
              <div className="space-y-3">
                {TASK_STATUSES.map((s) => (
                  <div key={s} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant={statusVariant(s)}>{STATUS_LABEL[s]}</Badge>
                      <span className="font-medium text-muted-foreground">
                        {a.by_status[s]}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct(a.by_status[s], maxStatus)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold">By priority</h2>
              <div className="space-y-3">
                {TASK_PRIORITIES.map((p) => (
                  <div key={p} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{PRIORITY_LABEL[p]}</span>
                      <span className="font-medium text-muted-foreground">
                        {a.by_priority[p]}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${PRIORITY_BAR[p]}`}
                        style={{ width: `${pct(a.by_priority[p], maxPriority)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold">By project</h2>
            {a.per_project.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects.</p>
            ) : (
              <div className="space-y-4">
                {a.per_project.map((p) => {
                  const donePct = pct(p.done, p.total);
                  return (
                    <div key={p.project_id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{p.project_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.done}/{p.total} done · {p.open} open
                          {p.overdue > 0 ? (
                            <span className="ml-1 font-medium text-destructive">
                              · {p.overdue} overdue
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${donePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
