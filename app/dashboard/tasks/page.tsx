import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTasksForUser, type TaskScope } from "@/lib/dao/tasks";
import { listAssigneesForTasks } from "@/lib/dao/assignments";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TasksTable } from "./tasks-table";
import { TasksFilters, type DateChip } from "./tasks-filters";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/schemas/tasks";
import { todayIso } from "@/lib/date";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  scope?: TaskScope;
  from?: string;
  to?: string;
  /** Sugar chip: today | tomorrow | week | overdue | no_date */
  date_filter?: DateChip | "none";
};

function safeStatus(v?: string): TaskStatus | "all" {
  if (!v || v === "all") return "all";
  return TASK_STATUSES.includes(v as TaskStatus) ? (v as TaskStatus) : "all";
}
function safePriority(v?: string): TaskPriority | "all" {
  if (!v || v === "all") return "all";
  return TASK_PRIORITIES.includes(v as TaskPriority)
    ? (v as TaskPriority)
    : "all";
}
function safeScope(v?: string): TaskScope {
  if (v === "created" || v === "assigned") return v;
  return "all";
}
function safeIso(v?: string): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function safeChip(v?: string): DateChip | "none" {
  if (
    v === "today" ||
    v === "tomorrow" ||
    v === "week" ||
    v === "overdue" ||
    v === "no_date"
  )
    return v;
  return "none";
}

/** Resolve a quick chip into concrete (from, to, no_date, overdue) flags.
 *  When the explicit range is also present, the chip wins. */
function resolveDateFilter(
  chip: DateChip | "none",
  explicitFrom: string | null,
  explicitTo: string | null
): {
  from: string | null;
  to: string | null;
  no_date: boolean;
  overdue: boolean;
} {
  const today = todayIso();
  if (chip === "today") return { from: today, to: today, no_date: false, overdue: false };
  if (chip === "tomorrow") {
    const t = addDays(today, 1);
    return { from: t, to: t, no_date: false, overdue: false };
  }
  if (chip === "week") {
    // Week = today through today + 6 days (rolling 7-day window).
    return {
      from: today,
      to: addDays(today, 6),
      no_date: false,
      overdue: false,
    };
  }
  if (chip === "overdue")
    return { from: null, to: null, no_date: false, overdue: true };
  if (chip === "no_date")
    return { from: null, to: null, no_date: true, overdue: false };
  return {
    from: explicitFrom,
    to: explicitTo,
    no_date: false,
    overdue: false,
  };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requireUser();
  const status = safeStatus(searchParams.status);
  const priority = safePriority(searchParams.priority);
  const scope = safeScope(searchParams.scope);
  const explicitFrom = safeIso(searchParams.from);
  const explicitTo = safeIso(searchParams.to);
  const chip = safeChip(searchParams.date_filter);
  const resolved = resolveDateFilter(chip, explicitFrom, explicitTo);

  const rows = await listTasksForUser(me.userId, me.role, {
    search: searchParams.q,
    status,
    priority,
    scope,
    from: resolved.from,
    to: resolved.to,
    no_date: resolved.no_date,
    overdue: resolved.overdue,
  });
  const assigneesByTask = await listAssigneesForTasks(rows.map((r) => r.id));

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Tasks"
        description={
          me.role === "admin"
            ? "Every task in the workspace."
            : "Tasks you created or are assigned to."
        }
      >
        {me.role === "admin" ? (
          <Button asChild>
            <Link href="/dashboard/tasks/new">
              <Plus className="h-4 w-4" /> New task
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <TasksFilters
        defaultQ={searchParams.q ?? ""}
        defaultStatus={status}
        defaultPriority={priority}
        defaultScope={scope}
        defaultFrom={explicitFrom ?? ""}
        defaultTo={explicitTo ?? ""}
        defaultChip={chip}
        showScope={me.role !== "admin"}
      />

      <TasksTable rows={rows} assigneesByTask={assigneesByTask} />
    </div>
  );
}
