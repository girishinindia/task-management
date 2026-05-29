import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, Plus, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  countNoDateTasks,
  listTasksForDate,
  listTasksForUser,
  type TaskRow,
} from "@/lib/dao/tasks";
import { listAssigneesForTasks } from "@/lib/dao/assignments";
import { todayIso } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/users/avatar-stack";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isOverdue,
  priorityVariant,
  statusVariant,
} from "../tasks/task-meta";
import type { TaskStatus } from "@/lib/schemas/tasks";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const STATUS_ORDER: TaskStatus[] = [
  "in_progress",
  "pending",
  "blocked",
  "done",
  "cancelled",
];

export default async function TodayPage() {
  const me = await requireUser();
  const today = todayIso();

  const [todayTasks, noDateCount, noDateTasks] = await Promise.all([
    listTasksForDate(me.userId, me.role, today),
    countNoDateTasks(me.userId, me.role),
    listTasksForUser(me.userId, me.role, { no_date: true, limit: 50 }),
  ]);

  const allIds = [
    ...todayTasks.map((t) => t.id),
    ...noDateTasks.map((t) => t.id),
  ];
  const assigneesByTask = await listAssigneesForTasks(allIds);

  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    rows: todayTasks.filter((t) => t.status === s),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Today · {format(new Date(`${today}T12:00:00`), "EEEE, PP")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {todayTasks.length === 0
              ? "Nothing scheduled for today."
              : `${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} on the plate today.`}
            {noDateCount > 0 ? (
              <>
                {" · "}
                <span className="text-foreground">
                  {noDateCount} with no date
                </span>
              </>
            ) : null}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <Plus className="h-4 w-4" /> New task
          </Link>
        </Button>
      </header>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center shadow-soft">
          <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nothing on today.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Either you're caught up, or no tasks overlap with today's date.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ status, rows }) => (
            <StatusSection
              key={status}
              status={status}
              rows={rows}
              assigneesByTask={assigneesByTask}
            />
          ))}
        </div>
      )}

      {noDateTasks.length > 0 ? (
        <section className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">
              No date — {noDateTasks.length}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            These tasks have neither a start nor a due date. Add dates to put
            them on the calendar.
          </p>
          <ul className="divide-y rounded-xl border bg-card shadow-soft">
            {noDateTasks.slice(0, 10).map((t) => (
              <TaskRowItem
                key={t.id}
                task={t}
                assignees={assigneesByTask[t.id] ?? []}
              />
            ))}
          </ul>
          {noDateTasks.length > 10 ? (
            <Link
              href="/dashboard/tasks?date_filter=no_date"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all {noDateTasks.length} no-date tasks →
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StatusSection({
  status,
  rows,
  assigneesByTask,
}: {
  status: TaskStatus;
  rows: TaskRow[];
  assigneesByTask: Record<string, { user_id: string; full_name: string; email: string }[]>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>
        <span className="text-xs text-muted-foreground">
          {rows.length} task{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="divide-y rounded-xl border bg-card shadow-soft">
        {rows.map((t) => (
          <TaskRowItem
            key={t.id}
            task={t}
            assignees={assigneesByTask[t.id] ?? []}
          />
        ))}
      </ul>
    </section>
  );
}

function TaskRowItem({
  task,
  assignees,
}: {
  task: TaskRow;
  assignees: { user_id: string; full_name: string; email: string }[];
}) {
  const overdue = isOverdue(task.due_date, task.status);
  return (
    <li>
      <Link
        href={`/dashboard/tasks/${task.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{task.title}</span>
            {overdue ? (
              <Badge variant="destructive" className="text-[10px]">
                overdue
              </Badge>
            ) : null}
          </div>
          {task.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {task.description}
            </p>
          ) : null}
        </div>
        <Badge variant={priorityVariant(task.priority)} className="shrink-0">
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        <div className="shrink-0">
          <AvatarStack
            users={assignees.map((a) => ({
              id: a.user_id,
              full_name: a.full_name,
              email: a.email,
            }))}
            max={3}
            size="sm"
          />
        </div>
      </Link>
    </li>
  );
}
