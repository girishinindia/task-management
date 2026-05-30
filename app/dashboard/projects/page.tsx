import Link from "next/link";
import { FolderKanban, ListChecks, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  isSuperAdmin,
  listProjectsForUser,
  membersByProject,
  tasksByProject,
} from "@/lib/dao/projects";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { RequestProjectDialog } from "@/components/projects/request-project-dialog";
import { STATUS_LABEL } from "../tasks/task-meta";
import type { TaskStatus } from "@/lib/schemas/tasks";
import { pct } from "@/lib/analytics-util";
import { cn } from "@/lib/utils";

/** Order + dot colour for the status pills on each project card. */
const STATUS_ORDER: TaskStatus[] = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
];
const STATUS_DOT: Record<TaskStatus, string> = {
  pending: "bg-slate-400",
  in_progress: "bg-sky-500",
  blocked: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-zinc-400",
};

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const me = await requireUser();
  const [projects, isSuper] = await Promise.all([
    listProjectsForUser(me.userId, me.role),
    isSuperAdmin(me.userId),
  ]);
  const projectIds = projects.map((p) => p.id);
  const [memberMap, taskMap] = await Promise.all([
    membersByProject(projectIds),
    tasksByProject(projectIds),
  ]);
  const canRequest = !isSuper && me.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Projects"
        description="Projects group tasks and have their own team and admins."
      >
        {isSuper ? <CreateProjectDialog /> : null}
        {canRequest ? <RequestProjectDialog /> : null}
      </PageHeader>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-16 text-center shadow-soft">
          <p className="text-sm font-medium">No projects yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuper
              ? "Create one to start organizing tasks by team."
              : "You're not a member of any project yet — ask a super admin to add you."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const members = memberMap[p.id] ?? [];
            const tasks = taskMap[p.id] ?? [];
            return (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group rounded-2xl border border-brand-100/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 text-brand-600 ring-1 ring-brand-100">
                  <FolderKanban className="h-5 w-5" />
                </div>
                {p.my_role ? (
                  <Badge
                    variant={p.my_role === "admin" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {p.my_role}
                  </Badge>
                ) : null}
              </div>
              <h3 className="mt-3 font-semibold tracking-tight">{p.name}</h3>
              {p.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {p.description}
                </p>
              ) : null}
              <div className="mt-4 space-y-2.5">
                {p.task_count > 0 ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {p.done}/{p.task_count} done
                        </span>
                        <span className="font-medium">
                          {pct(p.done, p.task_count)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct(p.done, p.task_count)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_ORDER.filter((s) => p[s] > 0).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_DOT[s]
                            )}
                          />
                          {STATUS_LABEL[s]} {p[s]}
                        </span>
                      ))}
                      {p.overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Overdue {p.overdue}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No active tasks yet.</p>
                )}

                <div className="flex items-center gap-4 pt-0.5 text-xs text-muted-foreground">
                  <span className="group/members relative inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {p.member_count} member
                    {p.member_count === 1 ? "" : "s"}
                    {members.length > 0 ? (
                      <span className="absolute bottom-full left-0 z-20 mb-2 hidden w-60 rounded-lg border bg-popover p-2 text-left shadow-soft-lg group-hover/members:block">
                        <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Team
                        </span>
                        <span className="block max-h-56 space-y-0.5 overflow-y-auto">
                          {members.map((u) => (
                            <span
                              key={u.user_id}
                              className="flex items-center gap-2 rounded-md px-1 py-1"
                            >
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {memberInitials(u.full_name)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                                {u.full_name}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                                  u.role === "admin"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {u.role}
                              </span>
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="group/tasks relative inline-flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" /> {p.task_count} task
                    {p.task_count === 1 ? "" : "s"}
                    {p.task_count > 0 ? (
                      <span className="absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg border bg-popover p-2 text-left shadow-soft-lg group-hover/tasks:block">
                        {/* Full status counts — Blocked & Cancelled always shown. */}
                        <span className="mb-1.5 flex flex-wrap gap-1">
                          {STATUS_ORDER.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  STATUS_DOT[s]
                                )}
                              />
                              {STATUS_LABEL[s]} {p[s]}
                            </span>
                          ))}
                          {p.overdue > 0 ? (
                            <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              Overdue {p.overdue}
                            </span>
                          ) : null}
                        </span>
                        {/* Quick task list */}
                        <span className="block max-h-52 space-y-0.5 overflow-y-auto border-t pt-1">
                          {tasks.map((t) => (
                            <span
                              key={t.id}
                              className="flex items-center gap-2 rounded-md px-1 py-1"
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  STATUS_DOT[t.status]
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                                {t.title}
                              </span>
                              <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                                {STATUS_LABEL[t.status]}
                              </span>
                            </span>
                          ))}
                          {p.task_count > tasks.length ? (
                            <span className="block px-1 pt-0.5 text-[10px] text-muted-foreground">
                              +{p.task_count - tasks.length} more
                            </span>
                          ) : null}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
