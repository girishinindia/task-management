import Link from "next/link";
import { LayoutGrid, List, ListTree, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  listTasksForUser,
  type TaskScope,
  type TaskSort,
} from "@/lib/dao/tasks";
import { listAssigneesForTasks } from "@/lib/dao/assignments";
import {
  isSuperAdmin,
  listManageableProjects,
  listProjectsForUser,
} from "@/lib/dao/projects";
import { listActiveAssignableUsers } from "@/lib/dao/users";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TasksTable } from "./tasks-table";
import { TasksBoard } from "./tasks-board";
import { TasksTree, type TreeGroupBy } from "./tasks-tree";
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
  /** Filter to a single project / a single assignee. */
  project_id?: string;
  assignee_id?: string;
  /** Archive filter: active (default) | archived | all. */
  archived?: "active" | "archived" | "all";
  /** Result ordering. */
  sort?: TaskSort;
  /** Which view template to render. */
  view?: "list" | "board" | "tree";
  /** Tree-view grouping dimension. */
  tree_group?: TreeGroupBy;
};

const TREE_GROUPS: { value: TreeGroupBy; label: string }[] = [
  { value: "assignee", label: "Assignee" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Build a tasks URL that keeps the current filters but switches the view
 *  (and, for the tree view, the grouping dimension). */
function withView(
  sp: SP,
  view: "list" | "board" | "tree",
  treeGroup?: TreeGroupBy
): string {
  const p = new URLSearchParams();
  if (sp.q) p.set("q", sp.q);
  if (sp.status) p.set("status", sp.status);
  if (sp.priority) p.set("priority", sp.priority);
  if (sp.scope) p.set("scope", sp.scope);
  if (sp.from) p.set("from", sp.from);
  if (sp.to) p.set("to", sp.to);
  if (sp.date_filter) p.set("date_filter", sp.date_filter);
  if (sp.project_id) p.set("project_id", sp.project_id);
  if (sp.assignee_id) p.set("assignee_id", sp.assignee_id);
  if (sp.archived) p.set("archived", sp.archived);
  if (sp.sort) p.set("sort", sp.sort);
  if (view === "board") p.set("view", "board");
  else if (view === "tree") {
    p.set("view", "tree");
    const g = treeGroup ?? sp.tree_group;
    if (g && g !== "assignee") p.set("tree_group", g);
  }
  const s = p.toString();
  return s ? `/dashboard/tasks?${s}` : "/dashboard/tasks";
}

function safeTreeGroup(v?: string): TreeGroupBy {
  return v === "day" || v === "week" || v === "month" ? v : "assignee";
}

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
function safeUuid(v?: string): string | null {
  return v && /^[0-9a-fA-F-]{36}$/.test(v) ? v : null;
}
function safeArchived(v?: string): "active" | "archived" | "all" {
  return v === "archived" || v === "all" ? v : "active";
}
function safeSort(v?: string): TaskSort {
  const allowed: TaskSort[] = [
    "due_asc",
    "due_desc",
    "created_desc",
    "created_asc",
    "priority_desc",
    "title_asc",
  ];
  return allowed.includes(v as TaskSort) ? (v as TaskSort) : "due_asc";
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
  const projectId = safeUuid(searchParams.project_id);
  const assigneeId = safeUuid(searchParams.assignee_id);
  const archived = safeArchived(searchParams.archived);
  const sort = safeSort(searchParams.sort);

  const [rows, projects, users, manageable, isSuper] = await Promise.all([
    listTasksForUser(me.userId, me.role, {
      search: searchParams.q,
      status,
      priority,
      scope,
      project_id: projectId,
      assignee_id: assigneeId,
      from: resolved.from,
      to: resolved.to,
      no_date: resolved.no_date,
      overdue: resolved.overdue,
      archived,
      sort,
    }),
    listProjectsForUser(me.userId, me.role),
    listActiveAssignableUsers(),
    listManageableProjects(me.userId, me.role),
    isSuperAdmin(me.userId),
  ]);
  const assigneesByTask = await listAssigneesForTasks(rows.map((r) => r.id));
  const view =
    searchParams.view === "board"
      ? "board"
      : searchParams.view === "tree"
        ? "tree"
        : "list";
  const treeGroup = safeTreeGroup(searchParams.tree_group);
  const manageableIds = manageable.map((p) => p.id);
  const canCreate = manageable.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Tasks"
        description={
          isSuper
            ? "Every task in the workspace."
            : "Tasks in your projects."
        }
      >
        <div className="inline-flex rounded-lg border bg-card p-0.5">
          <Button
            asChild
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-7 px-2.5"
          >
            <Link href={withView(searchParams, "list")}>
              <List className="h-4 w-4" /> List
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={view === "board" ? "secondary" : "ghost"}
            className="h-7 px-2.5"
          >
            <Link href={withView(searchParams, "board")}>
              <LayoutGrid className="h-4 w-4" /> Board
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={view === "tree" ? "secondary" : "ghost"}
            className="h-7 px-2.5"
          >
            <Link href={withView(searchParams, "tree")}>
              <ListTree className="h-4 w-4" /> Tree
            </Link>
          </Button>
        </div>
        {canCreate ? (
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
        defaultProject={projectId ?? ""}
        defaultAssignee={assigneeId ?? ""}
        defaultArchived={archived}
        defaultSort={sort}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        users={users.map((u) => ({ id: u.id, full_name: u.full_name }))}
        showScope={!isSuper}
      />

      {view === "tree" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Group by:
          </span>
          {TREE_GROUPS.map((g) => (
            <Button
              key={g.value}
              asChild
              size="sm"
              variant={treeGroup === g.value ? "secondary" : "ghost"}
              className="h-7 px-2.5"
            >
              <Link href={withView(searchParams, "tree", g.value)}>
                {g.label}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}

      {view === "board" ? (
        <TasksBoard
          rows={rows}
          assigneesByTask={assigneesByTask}
          manageableProjectIds={manageableIds}
          meId={me.userId}
        />
      ) : view === "tree" ? (
        <TasksTree
          rows={rows}
          assigneesByTask={assigneesByTask}
          manageableProjectIds={manageableIds}
          meId={me.userId}
          groupBy={treeGroup}
        />
      ) : (
        <TasksTable
          rows={rows}
          assigneesByTask={assigneesByTask}
          manageableProjectIds={manageableIds}
          meId={me.userId}
        />
      )}
    </div>
  );
}
