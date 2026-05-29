import { format, formatDistanceToNow } from "date-fns";
import { ArrowRightLeft, Clock } from "lucide-react";
import { UserAvatar } from "@/components/users/user-avatar";
import type { TransferRow } from "@/lib/dao/tasks";

export function TransferTimeline({ rows }: { rows: TransferRow[] }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Transfers</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0
            ? "no transfers yet"
            : `${rows.length} transfer${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
          This task has never been transferred.
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-md border bg-background px-3 py-2"
            >
              <div className="flex shrink-0 items-center gap-1">
                <UserAvatar
                  fullName={r.from_full_name}
                  email={r.from_email}
                  size="sm"
                  title={
                    r.from_full_name ?? r.from_email ?? "Previously unassigned"
                  }
                />
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                <UserAvatar
                  fullName={r.to_full_name}
                  email={r.to_email}
                  size="sm"
                  title={r.to_full_name ?? r.to_email ?? "New assignee"}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="font-medium">
                    {r.from_full_name ?? (
                      <span className="text-muted-foreground italic">
                        (unassigned)
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">
                    {r.to_full_name ?? r.to_email ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground">
                    by {r.actor_full_name ?? r.actor_email ?? "unknown"}
                  </span>
                </div>
                {r.reason ? (
                  <p className="text-xs italic text-muted-foreground">
                    &ldquo;{r.reason}&rdquo;
                  </p>
                ) : null}
                <div
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={format(new Date(r.transferred_at), "PP p")}
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(r.transferred_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>·</span>
                  <span>{format(new Date(r.transferred_at), "PP p")}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
