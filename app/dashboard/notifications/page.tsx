import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRightLeft,
  Bell,
  CheckCheck,
  FolderPlus,
  Inbox,
  Paperclip,
  Pencil,
  RefreshCcw,
  UserPlus2,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  countUnread,
  listNotifications,
  type NotificationRow,
} from "@/lib/dao/notifications";
import { MarkAllReadButton } from "./mark-all-read-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

type SP = { scope?: "all" | "unread" };

function iconForType(type: string) {
  if (type === "task_assigned") return UserPlus2;
  if (type === "task_transferred") return ArrowRightLeft;
  if (type === "status_changed") return RefreshCcw;
  if (type === "task_updated") return Pencil;
  if (type === "attachment_added") return Paperclip;
  if (type === "project_requested") return FolderPlus;
  return Bell;
}

/** Per-type color so notifications are scannable at a glance. */
function colorForType(type: string): string {
  switch (type) {
    case "task_assigned":
      return "bg-sky-100 text-sky-700";
    case "task_transferred":
      return "bg-violet-100 text-violet-700";
    case "status_changed":
      return "bg-emerald-100 text-emerald-700";
    case "task_updated":
      return "bg-amber-100 text-amber-700";
    case "attachment_added":
      return "bg-cyan-100 text-cyan-700";
    case "project_requested":
      return "bg-fuchsia-100 text-fuchsia-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Group an ordered list by ISO day (YYYY-MM-DD). */
function groupByDay(rows: NotificationRow[]) {
  const buckets = new Map<string, NotificationRow[]>();
  for (const r of rows) {
    const iso = new Date(r.created_at).toISOString().slice(0, 10);
    const cur = buckets.get(iso) ?? [];
    cur.push(r);
    buckets.set(iso, cur);
  }
  return Array.from(buckets.entries());
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requireUser();
  const scope = searchParams.scope === "unread" ? "unread" : "all";

  const [rows, unread] = await Promise.all([
    listNotifications(me.userId, { scope, limit: 100 }),
    countUnread(me.userId),
  ]);

  const groups = groupByDay(rows);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? scope === "unread"
                ? "No unread notifications."
                : "No notifications yet."
              : `${rows.length} in this view · ${unread} unread total`}
          </p>
        </div>
        <MarkAllReadButton disabled={unread === 0} />
      </header>

      <nav className="flex items-center gap-1 border-b">
        <TabLink href="/dashboard/notifications" active={scope === "all"}>
          All
        </TabLink>
        <TabLink
          href="/dashboard/notifications?scope=unread"
          active={scope === "unread"}
        >
          Unread{unread > 0 ? ` (${unread})` : ""}
        </TabLink>
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center shadow-soft">
          <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">All caught up.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you&apos;re assigned a task, receive a transfer, or a task you
            own changes status, it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([iso, day]) => (
            <section key={iso} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {format(new Date(`${iso}T12:00:00`), "EEEE, PP")}
              </h2>
              <ul className="divide-y rounded-xl border bg-card shadow-soft">
                {day.map((n) => {
                  const Icon = iconForType(n.type);
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.link ?? "#"}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40",
                          !n.is_read && "bg-primary/10"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                            colorForType(n.type)
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                !n.is_read ? "font-semibold" : "font-medium"
                              )}
                            >
                              {n.title}
                            </span>
                            {!n.is_read ? (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            ) : null}
                          </div>
                          {n.body ? (
                            <p className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">
                              {n.body}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {!n.is_read ? (
                          <CheckCheck className="mt-1 h-3.5 w-3.5 text-muted-foreground" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
