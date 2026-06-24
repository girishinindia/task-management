"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, Archive, ArchiveRestore, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskRow } from "@/lib/dao/tasks";
import type { AssigneeRow } from "@/lib/dao/assignments";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/schemas/tasks";
import { AvatarStack } from "@/components/users/avatar-stack";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  localDate,
} from "./task-meta";
import { formatTime12 } from "@/lib/date";
import { RowStatusMenu } from "./row-status-menu";
import { RowPriorityMenu } from "./row-priority-menu";

export function TasksTable({
  rows,
  assigneesByTask,
  manageableProjectIds = [],
  meId,
  archived = "active",
}: {
  rows: TaskRow[];
  assigneesByTask: Record<string, AssigneeRow[]>;
  /** Projects the viewer manages — drives which status transitions they get. */
  manageableProjectIds?: string[];
  /** Current user id — used to tell whether they're an assignee of a row. */
  meId: string;
  /** Current archive filter — drives which bulk action (Archive vs Restore)
   *  makes sense to show. */
  archived?: "active" | "archived" | "all";
}) {
  const router = useRouter();
  const canManageSet = new Set(manageableProjectIds);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
        <p className="text-sm font-medium">No tasks yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first one to get started.
        </p>
      </div>
    );
  }

  const allSelected = selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function applyBulk(
    action: "status" | "priority" | "archive" | "restore",
    value?: string
  ) {
    if (selected.size === 0) return;
    setWorking(true);
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Bulk action failed");
        return;
      }
      const j = (await res.json()) as { applied: number; skipped: number };
      toast.success(
        `Updated ${j.applied} task${j.applied === 1 ? "" : "s"}` +
          (j.skipped ? ` · ${j.skipped} skipped` : "")
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-soft">
          <span className="text-sm font-medium">
            {selected.size} selected
            {working ? (
              <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />
            ) : null}
          </span>
          <span className="mx-1 h-4 w-px bg-border" />
          <Select
            value=""
            onValueChange={(v) => applyBulk("status", v)}
            disabled={working}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s as TaskStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value=""
            onValueChange={(v) => applyBulk("priority", v)}
            disabled={working}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Set priority…" />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p as TaskPriority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Archive makes sense for active tasks; Restore only for archived
              ones. In the "all" view we keep both since the list is mixed. */}
          {archived !== "archived" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={working}
              onClick={() => applyBulk("archive")}
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          ) : null}
          {archived !== "active" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={working}
              onClick={() => applyBulk("restore")}
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={working}
            onClick={() => setSelected(new Set())}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Assignees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => {
              const assignees = (assigneesByTask[t.id] ?? []).map((a) => ({
                id: a.user_id,
                full_name: a.full_name,
                email: a.email,
              }));
              return (
                <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${t.title}`}
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/tasks/${t.id}`}
                      className="hover:underline"
                    >
                      {t.title}
                    </Link>
                    {!t.is_active ? (
                      <Badge variant="muted" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                    {isOverdue(t.due_date, t.status) ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" /> overdue
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <AvatarStack users={assignees} max={3} size="sm" />
                  </TableCell>
                  <TableCell>
                    <RowStatusMenu
                      taskId={t.id}
                      currentStatus={t.status}
                      canManage={canManageSet.has(t.project_id)}
                      canChange={
                        canManageSet.has(t.project_id) ||
                        (assigneesByTask[t.id] ?? []).some(
                          (a) => a.user_id === meId
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <RowPriorityMenu
                      taskId={t.id}
                      currentPriority={t.priority}
                      canChange={canManageSet.has(t.project_id)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.due_date ? format(localDate(t.due_date), "PP") : "—"}
                    {t.due_date && t.due_time ? (
                      <span className="block text-[11px]">
                        {formatTime12(t.due_time)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(t.updated_at), "PP")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
