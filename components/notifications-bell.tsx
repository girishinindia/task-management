"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
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

function iconForType(type: string) {
  if (type === "task_assigned") return UserPlus2;
  if (type === "task_transferred") return ArrowRightLeft;
  if (type === "status_changed") return RefreshCcw;
  return Bell;
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

  // First load + SSE subscription. Falls back to 30s polling if SSE drops.
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
                            !n.is_read
                              ? "bg-brand-100 text-brand-700"
                              : "bg-muted text-muted-foreground"
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
