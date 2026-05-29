import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Repeat } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { RECUR_LABEL } from "@/lib/recurrence";
import { formatTime12 } from "@/lib/date";
import {
  canReadTask,
  getTask,
  listStatusHistory,
  listTransferHistory,
} from "@/lib/dao/tasks";
import { canManageProject, isSuperAdmin } from "@/lib/dao/projects";
import { listAssigneesForTask } from "@/lib/dao/assignments";
import { listAttachmentsForTask } from "@/lib/dao/attachments";
import { listComments } from "@/lib/dao/comments";
import { listSubtasks } from "@/lib/dao/subtasks";
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
import { DeactivateTaskButton } from "./deactivate-task-button";
import { CommentsSection } from "./comments-section";
import { SubtasksSection } from "./subtasks-section";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const task = await getTask(params.id);
  if (!task) notFound();

  const assignees = await listAssigneesForTask(task.id);

  // Read rule: workspace admin or a member of the task's project.
  const canChangeStatus = await canReadTask(task.id, me.userId, me.role);
  if (!canChangeStatus) {
    notFound();
  }

  // Manage rule: workspace admin or a project admin of the task's project.
  const editable = await canManageProject(me.userId, me.role, task.project_id);
  const isSuper = await isSuperAdmin(me.userId);
  const canTransfer = editable;
  const [creator, history, transfers, attachments, comments, subtasks] =
    await Promise.all([
      findUserById(task.created_by),
      listStatusHistory(task.id),
      listTransferHistory(task.id),
      listAttachmentsForTask(task.id),
      listComments(task.id),
      listSubtasks(task.id),
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
              projectId={task.project_id}
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
            <DeactivateTaskButton
              taskId={task.id}
              isActive={task.is_active}
              title={task.title}
            />
          ) : null}
          {isSuper ? (
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
            canManage={editable}
          />
          <Badge variant={priorityVariant(task.priority)}>
            {PRIORITY_LABEL[task.priority]} priority
          </Badge>
          {task.project_name ? (
            <Link href={`/dashboard/projects/${task.project_id}`}>
              <Badge variant="secondary" className="hover:bg-secondary/80">
                {task.project_name}
              </Badge>
            </Link>
          ) : null}
          {isOverdue(task.due_date, task.status) ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : null}
          {task.recur_rule ? (
            <Badge variant="secondary" className="gap-1">
              <Repeat className="h-3 w-3" /> Repeats {RECUR_LABEL[task.recur_rule].toLowerCase()}
            </Badge>
          ) : null}
          {!task.is_active ? <Badge variant="muted">Archived</Badge> : null}
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
            project_id: task.project_id,
            title: task.title,
            description: task.description ?? "",
            status: task.status,
            priority: task.priority,
            start_date: task.start_date ?? "",
            due_date: task.due_date ?? "",
            start_time: task.start_time ?? "",
            due_time: task.due_time ?? "",
            recur_rule: task.recur_rule,
          }}
        />
      ) : (
        <ReadOnlyView
          description={task.description}
          startDate={task.start_date}
          dueDate={task.due_date}
          startTime={task.start_time}
          dueTime={task.due_time}
        />
      )}

      <AssigneesSection
        taskId={task.id}
        projectId={task.project_id}
        dueDate={task.due_date}
        editable={editable}
        initialAssignees={assignees.map((a) => ({
          user_id: a.user_id,
          full_name: a.full_name,
          email: a.email,
        }))}
      />

      <SubtasksSection
        taskId={task.id}
        initial={subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          is_done: s.is_done,
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

      <CommentsSection
        taskId={task.id}
        meId={me.userId}
        canModerate={isSuper}
        initial={comments.map((c) => ({
          id: c.id,
          author_id: c.author_id,
          author_name: c.author_full_name ?? "Unknown",
          body: c.body,
          attachment_url: c.attachment_url,
          attachment_name: c.attachment_name,
          attachment_mime: c.attachment_mime,
          created_at: new Date(c.created_at).toISOString(),
        }))}
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
  startTime,
  dueTime,
}: {
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  startTime: string | null;
  dueTime: string | null;
}) {
  const start = startDate
    ? `${format(localDate(startDate), "PP")}${
        startTime ? ` · ${formatTime12(startTime)}` : ""
      }`
    : "—";
  const due = dueDate
    ? `${format(localDate(dueDate), "PP")}${
        dueTime ? ` · ${formatTime12(dueTime)}` : ""
      }`
    : "—";
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
            Start
          </h2>
          <p className="mt-1">{start}</p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Due
          </h2>
          <p className="mt-1">{due}</p>
        </div>
      </div>
    </section>
  );
}
