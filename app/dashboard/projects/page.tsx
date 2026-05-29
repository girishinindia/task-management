import Link from "next/link";
import { FolderKanban, ListChecks, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isSuperAdmin, listProjectsForUser } from "@/lib/dao/projects";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { RequestProjectDialog } from "@/components/projects/request-project-dialog";

export const metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const me = await requireUser();
  const [projects, isSuper] = await Promise.all([
    listProjectsForUser(me.userId, me.role),
    isSuperAdmin(me.userId),
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
          {projects.map((p) => (
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
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {p.member_count} member
                  {p.member_count === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" /> {p.task_count} task
                  {p.task_count === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
