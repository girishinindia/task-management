import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TaskForm } from "../task-form";

export const metadata = { title: "New task" };
export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  await requireUser();
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
      <TaskForm mode="create" />
    </div>
  );
}
