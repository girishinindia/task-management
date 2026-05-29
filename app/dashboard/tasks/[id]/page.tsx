import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  canMutate,
  canReadTask,
  getTask,
  listStatusHistory,
  listTransferHistory,
} from "@/lib/dao/tasks";
import { listAssigneesForTask } from "@/lib/dao/assignments";
import { listAttachmentsForTask } from "@/lib/dao/attachments";
import { findUserById } from "@/lib/dao/users";
import { cdnUrl } from "@/lib/bunny";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "../task-form";
import { AssigneesSection } from "./assignees-section";
import { StatusMenu } from "./status-menu";
import { ActivityTimeline } from "./activity-timeline";
import { TransferDialog } from "./transfer-dialog";
import { TransferTimeline } from "./transfer-timeline";
import { AttachmentsSection } from "./attachments-section";
import {
  PRIORITY_LABEL,
  isOverdue,
  localDate,
  priorityVariant,
} from "../task-meta";
import { DeleteTaskButton } from "./delete-task-button";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) notFound();

  // Phase 6 read rule: creator, assignee, or admin.
  const assignees = await listAssigneesForTask(task.id);
  const isAssignee = assignees.some((a) => a.user_id === me.userId);
  if (me.role !== "admin" && task.created_by !== me.userId && !isAssignee) {
    notFound();
  }

  const editable = canMutate(task, me.userId, me.role);
  const canChangeStatus = await canReadTask(task.id, me.userId, me.role);
  // Transfer visibility matches the API permission rule: creator, current
  // assignee, or admin.
  const canTransfer =
    me.role === "admin" ||
    task.created_by === me.userId ||
    isAssignee;
  const [creator, history, transfers, attachments] = await Promise.all([
    findUserById(task.created_by),
    listStatusHistory(task.id),
    listTransferHistory(task.id),
    listAttachmentsForTask(task.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to tasks
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {canTransfer ? (
            <TransferDialog
              taskId={task.id}
              dueDate={task.due_date}
              currentAssignees={assignees.map((a) => ({
                user_id: a.user_id,
                full_name: a.full_name,
                email: a.email,
              }))}
              meId={me.userId}
            />
          ) : null}
          {editable ? (
            <DeleteTaskButton taskId={task.id} title={task.title} />
          ) : null}
        </div>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu
            taskId={task.id}
            currentStatus={task.status}
            canChange={canChangeStatus}
          />
          <Badge variant={priorityVariant(task.priority)}>
            {PRIORITY_LABEL[task.priority]} priority
          </Badge>
          {isOverdue(task.due_date, task.status) ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Created by{" "}
            <span className="font-medium text-foreground">
              {creator?.full_name ?? "Unknown"}
            </span>{" "}
            on {format(new Date(task.created_at), "PP")}
          </span>
          <span>
            Last updated {format(new Date(task.updated_at), "PP p")}
          </span>
        </div>
      </header>

      {editable ? (
        <TaskForm
          mode="edit"
          initial={{
            id: task.id,
            title: task.title,
            description: task.description ?? "",
            status: task.status,
            priority: task.priority,
            start_date: task.start_date ?? "",
            due_date: task.due_date ?? "",
          }}
        />
      ) : (
        <ReadOnlyView
          description={task.description}
          startDate={task.start_date}
          dueDate={task.due_date}
        />
      )}

      <AssigneesSection
        taskId={task.id}
        dueDate={task.due_date}
        editable={editable}
        initialAssignees={assignees.map((a) => ({
          user_id: a.user_id,
          full_name: a.full_name,
          email: a.email,
        }))}
      />

      <AttachmentsSection
        taskId={task.id}
        initial={attachments.map((a) =>
          a.kind === "file" && a.bunny_path
            ? { ...a, cdn_url: cdnUrl(a.bunny_path) }
            : a
        )}
        meId={me.userId}
        isCreator={task.created_by === me.userId}
        isAdmin={me.role === "admin"}
      />

      <ActivityTimeline rows={history} />

      <TransferTimeline rows={transfers} />
    </div>
  );
}

function ReadOnlyView({
  description,
  startDate,
  dueDate,
}: {
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Description
        </h2>
        <p className="mt-1 whitespace-pre-wrap text-sm">
          {description?.trim() ? description : "—"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Start date
          </h2>
          <p className="mt-1">
            {startDate ? format(localDate(startDate), "PP") : "—"}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Due date
          </h2>
          <p className="mt-1">
            {dueDate ? format(localDate(dueDate), "PP") : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}
