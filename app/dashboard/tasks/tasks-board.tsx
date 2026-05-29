"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskRow } from "@/lib/dao/tasks";
import type { AssigneeRow } from "@/lib/dao/assignments";
import { AvatarStack } from "@/components/users/avatar-stack";
import type { TaskStatus } from "@/lib/schemas/tasks";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  localDate,
  priorityVariant,
  statusVariant,
} from "./task-meta";
import { RowStatusMenu } from "./row-status-menu";

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
  const canManageSet = new Set(manageableProjectIds);
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
    items: rows.filter((r) => r.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map(({ status, items }) => (
        <section
          key={status}
          className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30"
        >
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <Badge variant={statusVariant(status)}>
              {STATUS_LABEL[status]}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          </header>

          <div className="flex flex-1 flex-col gap-2 p-2">
            {items.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                Nothing here.
              </p>
            ) : (
              items.map((t) => {
                const assignees = (assigneesByTask[t.id] ?? []).map((a) => ({
                  id: a.user_id,
                  full_name: a.full_name,
                  email: a.email,
                }));
                const overdue = isOverdue(t.due_date, t.status);
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-soft-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/tasks/${t.id}`}
                        className="text-sm font-medium leading-snug hover:underline"
                      >
                        {t.title}
                      </Link>
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
                          ? format(localDate(t.due_date), "dd MMM")
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
