"use client";

import { useState } from "react";
import Link from "next/link";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  AlertCircle,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  User2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskRow } from "@/lib/dao/tasks";
import type { AssigneeRow } from "@/lib/dao/assignments";
import { AvatarStack } from "@/components/users/avatar-stack";
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  isOverdue,
  localDate,
} from "./task-meta";
import { RowStatusMenu } from "./row-status-menu";
import { cn } from "@/lib/utils";

export type TreeGroupBy = "assignee" | "day" | "week" | "month";

/** Shared column template so the header strip and every leaf row line up:
 *  Task (flex) · Status · Priority · Due · Team. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_150px_88px_84px_96px] items-center gap-3";

interface TreeGroup {
  key: string;
  label: string;
  sortKey: string;
  /** Sort to the bottom (Unassigned / No date). */
  tail: boolean;
  tasks: TaskRow[];
}

function buildGroups(
  rows: TaskRow[],
  assigneesByTask: Record<string, AssigneeRow[]>,
  groupBy: TreeGroupBy
): TreeGroup[] {
  const map = new Map<string, TreeGroup>();
  const ensure = (key: string, label: string, sortKey: string, tail = false) => {
    let g = map.get(key);
    if (!g) {
      g = { key, label, sortKey, tail, tasks: [] };
      map.set(key, g);
    }
    return g;
  };

  for (const t of rows) {
    if (groupBy === "assignee") {
      const assignees = assigneesByTask[t.id] ?? [];
      if (assignees.length === 0) {
        ensure("__unassigned", "Unassigned", "~", true).tasks.push(t);
      } else {
        for (const a of assignees) {
          ensure(a.user_id, a.full_name, a.full_name.toLowerCase()).tasks.push(t);
        }
      }
      continue;
    }

    // date-based groupings
    const due = t.due_date;
    if (!due) {
      ensure("__nodate", "No date", "~", true).tasks.push(t);
      continue;
    }
    const d = localDate(due);
    if (groupBy === "day") {
      ensure(due, format(d, "EEE, PP"), due).tasks.push(t);
    } else if (groupBy === "week") {
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const we = endOfWeek(d, { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      ensure(
        key,
        `Week of ${format(ws, "MMM d")} – ${format(we, "MMM d")}`,
        key
      ).tasks.push(t);
    } else {
      const key = format(d, "yyyy-MM");
      ensure(key, format(d, "MMMM yyyy"), key).tasks.push(t);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.tail !== b.tail) return a.tail ? 1 : -1;
    return a.sortKey.localeCompare(b.sortKey);
  });
}

export function TasksTree({
  rows,
  assigneesByTask,
  manageableProjectIds = [],
  meId,
  groupBy,
}: {
  rows: TaskRow[];
  assigneesByTask: Record<string, AssigneeRow[]>;
  manageableProjectIds?: string[];
  meId: string;
  groupBy: TreeGroupBy;
}) {
  const canManageSet = new Set(manageableProjectIds);
  const groups = buildGroups(rows, assigneesByTask, groupBy);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setCollapsed(new Set())}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setCollapsed(new Set(groups.map((g) => g.key)))}
        >
          <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
        <div
          className={cn(
            ROW_GRID,
            "border-b bg-muted/40 py-2 pl-10 pr-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          )}
        >
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span className="text-right">Due</span>
          <span className="text-right">Team</span>
        </div>
        {groups.map((g) => {
          const open = !collapsed.has(g.key);
          const done = g.tasks.filter((t) => t.status === "done").length;
          return (
            <section key={g.key} className="border-b last:border-0">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70"
                aria-expanded={open}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90"
                  )}
                />
                {groupBy === "assignee" ? (
                  <User2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="truncate text-sm font-semibold">{g.label}</span>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {done}/{g.tasks.length} done
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {g.tasks.length}
                  </Badge>
                </span>
              </button>

              {open ? (
                <ul className="divide-y divide-border/50 border-t border-border/60">
                  {g.tasks.map((t) => {
                    const assignees = (assigneesByTask[t.id] ?? []).map((a) => ({
                      id: a.user_id,
                      full_name: a.full_name,
                      email: a.email,
                    }));
                    const canManage = canManageSet.has(t.project_id);
                    const canChange =
                      canManage ||
                      (assigneesByTask[t.id] ?? []).some(
                        (a) => a.user_id === meId
                      );
                    const overdue = isOverdue(t.due_date, t.status);
                    return (
                      <li
                        key={`${g.key}-${t.id}`}
                        className={cn(
                          ROW_GRID,
                          "py-2 pl-10 pr-3 text-[13px] hover:bg-accent/20"
                        )}
                      >
                        <Link
                          href={`/dashboard/tasks/${t.id}`}
                          title={t.title}
                          className="truncate text-foreground hover:underline"
                        >
                          {t.title}
                        </Link>
                        <div className="min-w-0">
                          <RowStatusMenu
                            taskId={t.id}
                            currentStatus={t.status}
                            canManage={canManage}
                            canChange={canChange}
                            subtle
                          />
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              PRIORITY_DOT[t.priority]
                            )}
                          />
                          {PRIORITY_LABEL[t.priority]}
                        </div>
                        <div
                          className={cn(
                            "flex items-center justify-end gap-1 whitespace-nowrap text-xs",
                            overdue
                              ? "font-medium text-destructive"
                              : "text-muted-foreground"
                          )}
                          title={overdue ? "Overdue" : undefined}
                        >
                          {overdue ? <AlertCircle className="h-3 w-3" /> : null}
                          {t.due_date
                            ? format(localDate(t.due_date), "dd MMM")
                            : "—"}
                        </div>
                        <div className="flex justify-end">
                          <AvatarStack users={assignees} max={3} size="sm" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
