import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  canAccessProject,
  canManageProject,
  getProject,
  isSuperAdmin,
  listProjectMembers,
} from "@/lib/dao/projects";
import { listActiveAssignableUsers } from "@/lib/dao/users";
import { Button } from "@/components/ui/button";
import { ProjectMembers } from "@/components/projects/project-members";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const project = await getProject(params.id);
  if (!project) notFound();
  if (!(await canAccessProject(me.userId, me.role, params.id))) notFound();

  const canManage = await canManageProject(me.userId, me.role, params.id);
  const [members, allUsers, isSuper] = await Promise.all([
    listProjectMembers(params.id),
    canManage ? listActiveAssignableUsers() : Promise.resolve([]),
    isSuperAdmin(me.userId),
  ]);
  const isCreator = project.created_by === me.userId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/projects">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to projects
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <EditProjectDialog
              projectId={project.id}
              initialName={project.name}
              initialDescription={project.description ?? ""}
            />
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/tasks?project_id=${project.id}`}>
              <ListChecks className="h-4 w-4" /> View tasks
            </Link>
          </Button>
        </div>
      </header>

      <ProjectMembers
        projectId={project.id}
        initialMembers={members.map((m) => ({
          user_id: m.user_id,
          full_name: m.full_name,
          email: m.email,
          role: m.role,
        }))}
        allUsers={allUsers.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
        }))}
        canManage={canManage}
        meId={me.userId}
        isSuper={isSuper}
        isCreator={isCreator}
        creatorId={project.created_by}
      />
    </div>
  );
}
