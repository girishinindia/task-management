import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/users/user-avatar";
import type { StatusHistoryRow } from "@/lib/dao/tasks";
import { STATUS_LABEL, statusVariant } from "../task-meta";

export function ActivityTimeline({ rows }: { rows: StatusHistoryRow[] }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0
            ? "no status changes yet"
            : `${rows.length} status change${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          The activity log fills in once someone moves this task between
          statuses.
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-md border bg-background px-3 py-2"
            >
              <UserAvatar
                fullName={r.actor_full_name}
                email={r.actor_email}
                size="sm"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium">
                    {r.actor_full_name ?? r.actor_email ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    changed status
                  </span>
                  {r.from_status ? (
                    <Badge
                      variant={statusVariant(r.from_status)}
                      className="text-[10px]"
                    >
                      {STATUS_LABEL[r.from_status]}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      (initial)
                    </span>
                  )}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge
                    variant={statusVariant(r.to_status)}
                    className="text-[10px]"
                  >
                    {STATUS_LABEL[r.to_status]}
                  </Badge>
                </div>
                {r.note ? (
                  <p className="text-xs italic text-muted-foreground">
                    &ldquo;{r.note}&rdquo;
                  </p>
                ) : null}
                <div
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={format(new Date(r.changed_at), "PP p")}
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(r.changed_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>·</span>
                  <span>{format(new Date(r.changed_at), "PP p")}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
