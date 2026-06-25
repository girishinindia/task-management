"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CalendarClock,
  CheckCheck,
  FolderPlus,
  Inbox,
  KeyRound,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  UserPlus2,
  RefreshCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_MS = 30 * 1000;

// Long-lived SSE pins a DB connection per open tab, which exhausts a shared,
// connection-limited database. OFF by default — the bell polls instead. Set
// NEXT_PUBLIC_ENABLE_SSE=true only on infra that can hold persistent streams.
const SSE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SSE === "true";

function iconForType(type: string) {
  if (type === "task_assigned") return UserPlus2;
  if (type === "task_transferred") return ArrowRightLeft;
  if (type === "status_changed") return RefreshCcw;
  if (type === "task_updated") return Pencil;
  if (type === "attachment_added") return Paperclip;
  if (type === "project_requested") return FolderPlus;
  if (type === "comment_added") return MessageSquare;
  if (type === "task_overdue") return AlertTriangle;
  if (type === "task_due_soon") return CalendarClock;
  if (type === "password_reset_requested") return KeyRound;
  if (type === "password_changed") return KeyRound;
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
    case "comment_added":
      return "bg-indigo-100 text-indigo-700";
    case "task_due_soon":
      return "bg-amber-100 text-amber-700";
    case "task_overdue":
      return "bg-red-100 text-red-700";
    case "password_reset_requested":
    case "password_changed":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=20", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: NotificationRow[];
        unread_count: number;
      };
      setRows(data.notifications ?? []);
      setUnread(data.unread_count ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // First load, then either poll (default) or — when explicitly enabled —
  // subscribe via SSE with polling fallback.
  useEffect(() => {
    refresh();

    let es: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;

    function startFallback() {
      if (fallback) return;
      fallback = setInterval(refresh, POLL_MS);
    }
    function stopFallback() {
      if (fallback) {
        clearInterval(fallback);
        fallback = null;
      }
    }

    // Default: poll only. Avoids pinning a DB connection per open tab via SSE.
    if (!SSE_ENABLED) {
      startFallback();
      return () => stopFallback();
    }

    try {
      es = new EventSource("/api/notifications/stream");

      es.addEventListener("init", (ev) => {
        stopFallback(); // SSE is live, no need to poll.
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (typeof data?.unread_count === "number") {
            setUnread(data.unread_count);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("notification", (ev) => {
        try {
          const n = JSON.parse((ev as MessageEvent).data) as NotificationRow;
          setRows((rs) => [n, ...rs].slice(0, 20));
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("unread_count", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (typeof data?.unread_count === "number") {
            setUnread(data.unread_count);
          }
        } catch {
          /* ignore */
        }
      });

      es.onerror = () => {
        // Browser auto-reconnects on transient errors. If it's gone for good
        // (4xx etc.), start the polling fallback so the bell stays live.
        startFallback();
      };
    } catch {
      startFallback();
    }

    return () => {
      es?.close();
      stopFallback();
    };
  }, [refresh]);

  async function markAll() {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (res.ok) {
        setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
        setUnread(0);
      }
    } finally {
      setMarking(false);
    }
  }

  async function onItemClick(n: NotificationRow) {
    // Optimistic mark + best-effort POST
    if (!n.is_read) {
      setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
      setUnread((u) => Math.max(0, u - 1));
      fetch(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 px-0"
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Notifications
              {unread > 0 ? (
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                  {unread} unread
                </span>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              Assignments, transfers, and status changes for your tasks.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={markAll}
              disabled={marking || unread === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                <Inbox className="mx-auto mb-1 h-5 w-5" />
                Nothing here yet.
              </div>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((n) => {
                  const Icon = iconForType(n.type);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onItemClick(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40",
                          !n.is_read && "bg-primary/10"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md",
                            colorForType(n.type)
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "truncate text-xs",
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
                            <p className="line-clamp-2 text-[11px] italic text-muted-foreground">
                              {n.body}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-3 border-t pt-3">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
                View all notifications
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
