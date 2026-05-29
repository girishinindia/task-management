"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskCreateSchema,
  type TaskCreateInput,
} from "@/lib/schemas/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneePicker } from "@/components/users/assignee-picker";
import { PRIORITY_LABEL, STATUS_LABEL } from "./task-meta";

export type TaskFormValues = TaskCreateInput;

export interface TaskFormProps {
  /** undefined → create mode. Provide initial values → edit mode. */
  initial?: Partial<TaskFormValues> & { id?: string };
  /** "create" submits POST /api/tasks; "edit" submits PATCH /api/tasks/[id] */
  mode: "create" | "edit";
  /** Where to navigate after success (default: /dashboard/tasks/[id] in create, refresh in edit). */
  onSuccessHref?: string;
  /** Show a status field in create mode? Defaults to false (new tasks start pending). */
  showStatusOnCreate?: boolean;
}

const emptyValues: TaskFormValues = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  start_date: "",
  due_date: "",
  assignee_ids: [],
};

export function TaskForm({
  initial,
  mode,
  onSuccessHref,
  showStatusOnCreate = false,
}: TaskFormProps) {
  const router = useRouter();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      ...emptyValues,
      ...(initial as Partial<TaskFormValues>),
      start_date: initial?.start_date ?? "",
      due_date: initial?.due_date ?? "",
      description: initial?.description ?? "",
    },
  });

  async function onSubmit(data: TaskFormValues) {
    const url =
      mode === "create" ? "/api/tasks" : `/api/tasks/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    // Normalize empty strings → null so the server treats them as cleared.
    // Phase 8: status is NEVER sent via this form — status changes route
    // through StatusMenu → POST /api/tasks/[id]/status to preserve audit.
    const { status: _statusIgnored, ...rest } = data;
    const payload = {
      ...rest,
      description: rest.description?.toString().trim() || null,
      start_date: rest.start_date || null,
      due_date: rest.due_date || null,
    };

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error?.message ?? "Failed to save task");
      return;
    }
    const data2 = await res.json();
    toast.success(mode === "create" ? "Task created" : "Task updated");

    if (onSuccessHref) {
      router.push(onSuccessHref);
    } else if (mode === "create") {
      router.push(`/dashboard/tasks/${data2.task.id}`);
    } else {
      router.refresh();
    }
  }

  // Phase 8: status is managed by StatusMenu on the detail page, never here.
  const showStatus = false;
  void showStatusOnCreate;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5 rounded-lg border bg-card p-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="What's this task about?"
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      <div className={`grid gap-4 ${showStatus ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={form.watch("priority")}
            onValueChange={(v) =>
              form.setValue("priority", v as TaskFormValues["priority"], {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showStatus ? (
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as TaskFormValues["status"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            type="date"
            {...form.register("start_date")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" type="date" {...form.register("due_date")} />
          {form.formState.errors.due_date ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.due_date.message}
            </p>
          ) : null}
        </div>
      </div>

      {mode === "create" ? (
        <div className="space-y-1.5">
          <Label>Assignees</Label>
          <Controller
            control={form.control}
            name="assignee_ids"
            render={({ field }) => (
              <AssigneePicker
                value={field.value ?? []}
                onChange={field.onChange}
                dueDate={form.watch("due_date") || null}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            You can change assignees on the task detail page after creating it.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {mode === "create" ? "Create task" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
