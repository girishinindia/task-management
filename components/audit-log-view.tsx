import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AuditRow } from "@/lib/dao/audit";

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "auth.login", label: "Login" },
  { value: "auth.login_failed", label: "Login failed" },
  { value: "auth.logout", label: "Logout" },
  { value: "auth.signup", label: "Signup" },
  { value: "task.created", label: "Task created" },
  { value: "task.updated", label: "Task updated" },
  { value: "task.deleted", label: "Task deleted" },
  { value: "task.status_changed", label: "Status changed" },
  { value: "task.transferred", label: "Task transferred" },
  { value: "task.assignees_set", label: "Assignees set" },
  { value: "task.assignee_removed", label: "Assignee removed" },
  { value: "attachment.added", label: "Attachment added" },
  { value: "attachment.removed", label: "Attachment removed" },
  { value: "admin.user_created", label: "User created" },
  { value: "admin.user_updated", label: "User updated" },
  { value: "admin.date_status_set", label: "Date override set" },
  { value: "admin.date_status_removed", label: "Date override removed" },
  { value: "project.created", label: "Project created" },
  { value: "project.member_added", label: "Project member added" },
  { value: "project.member_removed", label: "Project member removed" },
];

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

function actionVariant(action: string): BadgeVariant {
  if (
    action.endsWith("_failed") ||
    action.endsWith(".deleted") ||
    action.endsWith(".removed")
  )
    return "destructive";
  if (action.startsWith("auth.")) return "secondary";
  if (action.startsWith("admin.")) return "warning";
  if (action.startsWith("attachment.")) return "muted";
  return "default";
}

export interface AuditLogViewProps {
  rows: AuditRow[];
  total: number;
  limit: number;
  offset: number;
  q?: string;
  action?: string;
  /** Base path for the filter form + pagination links. */
  basePath: string;
  /** Show the actor column (admin report). Hide it on the per-user view. */
  showActor?: boolean;
}

export function AuditLogView({
  rows,
  total,
  limit,
  offset,
  q = "",
  action = "",
  basePath,
  showActor = true,
}: AuditLogViewProps) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const linkFor = (newOffset: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (action) sp.set("action", action);
    if (newOffset > 0) sp.set("offset", String(newOffset));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="space-y-4">
      {/* Filters (native GET form — no client JS needed) */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-soft"
      >
        <div className="min-w-[180px] flex-1 space-y-1">
          <label
            htmlFor="q"
            className="text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Summary or email…"
            className="h-9"
          />
        </div>
        <div className="min-w-[180px] space-y-1">
          <label
            htmlFor="action"
            className="text-xs font-medium text-muted-foreground"
          >
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={action}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="h-9">
          Apply
        </Button>
        {q || action ? (
          <Button asChild variant="ghost" className="h-9">
            <Link href={basePath}>Clear</Link>
          </Button>
        ) : null}
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center shadow-soft">
          <p className="text-sm font-medium">No activity found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing matches these filters yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                {showActor ? (
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                ) : null}
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0">
                  <td
                    className="whitespace-nowrap px-4 py-2.5 text-muted-foreground"
                    title={format(new Date(r.created_at), "PP p")}
                  >
                    {format(new Date(r.created_at), "dd MMM, HH:mm")}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={actionVariant(r.action)}
                      className="font-mono text-[10px]"
                    >
                      {r.action}
                    </Badge>
                  </td>
                  {showActor ? (
                    <td className="px-4 py-2.5">
                      {r.actor_email ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-2.5">{r.summary}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} {total === 1 ? "entry" : "entries"} · page {page} of {pages}
        </span>
        <div className="flex items-center gap-2">
          {offset > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={linkFor(Math.max(0, offset - limit))}>← Newer</Link>
            </Button>
          ) : null}
          {offset + limit < total ? (
            <Button asChild variant="outline" size="sm">
              <Link href={linkFor(offset + limit)}>Older →</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
