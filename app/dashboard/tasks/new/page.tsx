import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listManageableProjects } from "@/lib/dao/projects";
import { Button } from "@/components/ui/button";
import { TaskForm } from "../task-form";

export const metadata = { title: "New task" };
export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  // Anyone signed in may reach this, but you can only create tasks in a
  // project you administer (workspace admins administer every project).
  const me = await requireUser();
  const projects = await listManageableProjects(me.userId, me.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/tasks">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to tasks
        </Link>
      </Button>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New task</h1>
        <p className="text-sm text-muted-foreground">
          Capture what needs doing — you can refine the details later.
        </p>
      </header>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center shadow-soft">
          <p className="text-sm font-medium">No project to add tasks to.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You can only create tasks in a project you administer. Ask a
            workspace admin to add you as a project admin, or to create a
            project.
          </p>
        </div>
      ) : (
        <TaskForm
          mode="create"
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
