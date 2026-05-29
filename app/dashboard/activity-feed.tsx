import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  ArrowRightLeft,
  Clock,
  History,
  RefreshCcw,
  UserPlus2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/users/user-avatar";
import type { ActivityRow } from "@/lib/dao/activity";
import {
  STATUS_LABEL,
  statusVariant,
} from "../dashboard/tasks/task-meta";
import type { TaskStatus } from "@/lib/schemas/tasks";

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent activity
        </h2>
        <span className="text-xs text-muted-foreground">
          last {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
          No activity yet. Create or assign a task to see things move here.
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={`${r.kind}-${r.task_id}-${r.occurred_at}-${i}`}
              className="flex items-start gap-3 rounded-md border bg-background px-3 py-2"
            >
              <Avatar row={r} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <Headline row={r} />
                {r.note ? (
                  <p className="text-xs italic text-muted-foreground">
                    &ldquo;{r.note}&rdquo;
                  </p>
                ) : null}
                <div
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={format(new Date(r.occurred_at), "PP p")}
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(r.occurred_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Avatar({ row }: { row: ActivityRow }) {
  const Icon =
    row.kind === "status_changed"
      ? RefreshCcw
      : row.kind === "transferred"
        ? ArrowRightLeft
        : UserPlus2;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <UserAvatar
        fullName={row.actor_full_name}
        email={row.actor_email}
        size="sm"
      />
      <span className="grid h-6 w-6 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function Headline({ row }: { row: ActivityRow }) {
  const link = `/dashboard/tasks/${row.task_id}`;
  const actor = row.actor_full_name ?? row.actor_email ?? "Someone";

  if (row.kind === "status_changed") {
    const from = row.from_status as TaskStatus | null;
    const to = row.to_status as TaskStatus | null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium">{actor}</span>
        <span className="text-muted-foreground">moved</span>
        <Link
          href={link}
          className="font-medium text-foreground hover:underline"
        >
          {row.task_title}
        </Link>
        {from ? (
          <Badge variant={statusVariant(from)} className="text-[10px]">
            {STATUS_LABEL[from]}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">(initial)</span>
        )}
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        {to ? (
          <Badge variant={statusVariant(to)} className="text-[10px]">
            {STATUS_LABEL[to]}
          </Badge>
        ) : null}
      </div>
    );
  }

  if (row.kind === "transferred") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-medium">{actor}</span>
        <span className="text-muted-foreground">transferred</span>
        <Link
          href={link}
          className="font-medium text-foreground hover:underline"
        >
          {row.task_title}
        </Link>
        <span className="text-muted-foreground">from</span>
        <span className="font-medium">
          {row.from_user_full_name ?? (
            <span className="italic text-muted-foreground">(unassigned)</span>
          )}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">
          {row.to_user_full_name ?? "(someone)"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium">{actor}</span>
      <span className="text-muted-foreground">assigned</span>
      <Link
        href={link}
        className="font-medium text-foreground hover:underline"
      >
        {row.task_title}
      </Link>
      <span className="text-muted-foreground">to</span>
      <span className="font-medium">
        {row.assigned_user_full_name ?? "(someone)"}
      </span>
    </div>
  );
}
