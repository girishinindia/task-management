"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { TaskRow } from "@/lib/dao/tasks";
import type { AssigneeRow } from "@/lib/dao/assignments";
import { type TaskStatus } from "@/lib/schemas/tasks";
import { MEMBER_STATUSES } from "@/lib/schemas/status";
import { AvatarStack } from "@/components/users/avatar-stack";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  localDate,
  priorityVariant,
  statusVariant,
} from "./task-meta";
import { formatTime12 } from "@/lib/date";
import { RowStatusMenu } from "./row-status-menu";
import { cn } from "@/lib/utils";

/** Kanban column order — mirrors the workflow left → right. */
const COLUMN_ORDER: TaskStatus[] = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
];

export function TasksBoard({
  rows,
  assigneesByTask,
  manageableProjectIds = [],
}: {
  rows: TaskRow[];
  assigneesByTask: Record<string, AssigneeRow[]>;
  /** Projects the viewer manages — drives which status transitions they get. */
  manageableProjectIds?: string[];
}) {
  const router = useRouter();
  const canManageSet = new Set(manageableProjectIds);
  const [items, setItems] = useState<TaskRow[]>(rows);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  // Keep local state in sync when the server data changes (filters, refresh).
  useEffect(() => setItems(rows), [rows]);

  async function moveTask(id: string, to: TaskStatus) {
    const task = items.find((t) => t.id === id);
    if (!task || task.status === to) return;

    const canManage = canManageSet.has(task.project_id);
    if (!canManage && !MEMBER_STATUSES.includes(to)) {
      toast.error("Members can only move tasks to In progress or Done.");
      return;
    }

    const prev = task.status;
    // optimistic
    setItems((list) =>
      list.map((t) => (t.id === id ? { ...t, status: to } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to_status: to }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // revert
        setItems((list) =>
          list.map((t) => (t.id === id ? { ...t, status: prev } : t))
        );
        toast.error(j?.error?.message ?? "Couldn't move that task.");
        return;
      }
      router.refresh();
    } catch {
      setItems((list) =>
        list.map((t) => (t.id === id ? { ...t, status: prev } : t))
      );
      toast.error("Couldn't move that task.");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center shadow-soft">
        <p className="text-sm font-medium">No tasks match.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust the filters above, or switch back to the list view.
        </p>
      </div>
    );
  }

  const columns = COLUMN_ORDER.map((status) => ({
    status,
    items: items.filter((r) => r.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map(({ status, items: colItems }) => (
        <section
          key={status}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(status);
          }}
          onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setOverCol(null);
            const id = e.dataTransfer.getData("text/plain") || dragId;
            setDragId(null);
            if (id) moveTask(id, status);
          }}
          className={cn(
            "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
            overCol === status && "border-primary bg-primary/5"
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {colItems.length}
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-2 p-2">
            {colItems.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                Drop here.
              </p>
            ) : (
              colItems.map((t) => {
                const assignees = (assigneesByTask[t.id] ?? []).map((a) => ({
                  id: a.user_id,
                  full_name: a.full_name,
                  email: a.email,
                }));
                const overdue = isOverdue(t.due_date, t.status);
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      "group rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-soft-lg",
                      dragId === t.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground" />
                        <Link
                          href={`/dashboard/tasks/${t.id}`}
                          className="text-sm font-medium leading-snug hover:underline"
                        >
                          {t.title}
                        </Link>
                      </div>
                      <Badge
                        variant={priorityVariant(t.priority)}
                        className="shrink-0 text-[10px]"
                      >
                        {PRIORITY_LABEL[t.priority]}
                      </Badge>
                    </div>

                    {t.project_name ? (
                      <p className="mt-1 truncate text-[11px] font-medium text-brand-600">
                        {t.project_name}
                      </p>
                    ) : null}

                    {t.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={
                          overdue
                            ? "inline-flex items-center gap-0.5 text-[11px] font-medium text-destructive"
                            : "text-[11px] text-muted-foreground"
                        }
                      >
                        {overdue ? <AlertCircle className="h-3 w-3" /> : null}
                        {t.due_date
                          ? `${format(localDate(t.due_date), "dd MMM")}${
                              t.due_time ? `, ${formatTime12(t.due_time)}` : ""
                            }`
                          : "No date"}
                      </span>
                      <AvatarStack users={assignees} max={3} size="sm" />
                    </div>

                    <div className="mt-2 border-t pt-2">
                      <RowStatusMenu
                        taskId={t.id}
                        currentStatus={t.status}
                        canManage={canManageSet.has(t.project_id)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
