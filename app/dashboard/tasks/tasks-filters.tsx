"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "./task-meta";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";
import { SavedViews } from "./saved-views";

export type DateChip = "today" | "tomorrow" | "week" | "overdue" | "no_date";
export type TaskSort =
  | "due_asc"
  | "due_desc"
  | "created_desc"
  | "created_asc"
  | "priority_desc"
  | "title_asc";

const CHIPS: { value: DateChip; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This week" },
  { value: "overdue", label: "Overdue" },
  { value: "no_date", label: "No date" },
];

const SORT_LABEL: Record<TaskSort, string> = {
  due_asc: "Due date ↑",
  due_desc: "Due date ↓",
  created_desc: "Newest first",
  created_asc: "Oldest first",
  priority_desc: "Priority",
  title_asc: "Title A–Z",
};

export function TasksFilters({
  defaultQ,
  defaultStatus,
  defaultPriority,
  defaultScope,
  defaultFrom,
  defaultTo,
  defaultChip,
  defaultProject = "",
  defaultAssignee = "",
  defaultArchived = "active",
  defaultSort = "due_asc",
  projects = [],
  users = [],
  showScope = true,
}: {
  defaultQ: string;
  defaultStatus: string;
  defaultPriority: string;
  defaultScope?: "all" | "created" | "assigned";
  defaultFrom: string;
  defaultTo: string;
  defaultChip: DateChip | "none";
  defaultProject?: string;
  defaultAssignee?: string;
  defaultArchived?: "active" | "archived" | "all";
  defaultSort?: TaskSort;
  projects?: { id: string; name: string }[];
  users?: { id: string; full_name: string }[];
  showScope?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all" || v === "" || v === "none") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.replace(`/dashboard/tasks?${next.toString()}`);
    });
  }

  /** Like update(), but only clears the key when the value equals its default
   *  (so meaningful values like archived="all" are preserved in the URL). */
  function updateParam(key: string, value: string, clearWhen: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === clearWhen) next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.replace(`/dashboard/tasks?${next.toString()}`);
    });
  }

  function pickChip(value: DateChip) {
    // Selecting a chip clears the explicit from/to range and vice versa.
    if (defaultChip === value) {
      update({ date_filter: undefined });
    } else {
      update({ date_filter: value, from: undefined, to: undefined });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search title or description…  ( / )"
          defaultValue={defaultQ}
          className="max-w-xs"
          data-hotkey="search"
          onChange={(e) => update({ q: e.target.value })}
        />
        {showScope ? (
          <Select
            defaultValue={defaultScope ?? "all"}
            onValueChange={(v) => update({ scope: v })}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my tasks</SelectItem>
              <SelectItem value="created">Created by me</SelectItem>
              <SelectItem value="assigned">Assigned to me</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Select
          defaultValue={defaultStatus}
          onValueChange={(v) => update({ status: v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          defaultValue={defaultPriority}
          onValueChange={(v) => update({ priority: v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() =>
            update({ priority: defaultPriority === "high" ? "all" : "high" })
          }
          aria-pressed={defaultPriority === "high"}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            defaultPriority === "high"
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          ★ Important
        </button>
        {projects.length > 0 ? (
          <Select
            defaultValue={defaultProject || "all"}
            onValueChange={(v) => update({ project_id: v })}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select
          defaultValue={defaultAssignee || "all"}
          onValueChange={(v) => update({ assignee_id: v })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone assigned</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          defaultValue={defaultSort}
          onValueChange={(v) => updateParam("sort", v, "due_asc")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABEL) as TaskSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          defaultValue={defaultArchived}
          onValueChange={(v) => updateParam("archived", v, "active")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">Active + archived</SelectItem>
          </SelectContent>
        </Select>
        {pending ? (
          <span className="text-xs text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Date:
        </span>
        {CHIPS.map((c) => {
          const active = defaultChip === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => pickChip(c.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-brand-300 hover:text-foreground"
              )}
              aria-pressed={active}
            >
              {c.label}
            </button>
          );
        })}

        <span className="mx-2 hidden text-xs text-muted-foreground md:inline">
          or
        </span>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={defaultFrom}
            onChange={(e) =>
              update({
                from: e.target.value,
                date_filter: undefined,
              })
            }
            className="h-8 w-[148px]"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={defaultTo}
            onChange={(e) =>
              update({
                to: e.target.value,
                date_filter: undefined,
              })
            }
            className="h-8 w-[148px]"
            aria-label="To date"
          />
        </div>

        {(defaultChip !== "none" || defaultFrom || defaultTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              update({
                date_filter: undefined,
                from: undefined,
                to: undefined,
              })
            }
          >
            Clear dates
          </Button>
        )}
      </div>

      <SavedViews />
    </div>
  );
}
