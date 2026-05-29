"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TaskRow } from "@/lib/dao/tasks";
import type { AssigneeRow } from "@/lib/dao/assignments";
import { AvatarStack } from "@/components/users/avatar-stack";
import {
  PRIORITY_LABEL,
  isOverdue,
  localDate,
  priorityVariant,
} from "./task-meta";
import { RowStatusMenu } from "./row-status-menu";

export function TasksTable({
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
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
        <p className="text-sm font-medium">No tasks yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
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
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/tasks/${t.id}`}
                    className="hover:underline"
                  >
                    {t.title}
                  </Link>
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
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant(t.priority)}>
                    {PRIORITY_LABEL[t.priority]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.due_date ? format(localDate(t.due_date), "PP") : "—"}
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
  );
}
