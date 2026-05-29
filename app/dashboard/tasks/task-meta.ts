/**
 * Tiny display helpers used by both the table and detail views.
 */
import type { TaskPriority, TaskStatus } from "@/lib/schemas/tasks";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function statusVariant(
  s: TaskStatus
): "default" | "secondary" | "success" | "warning" | "destructive" | "muted" {
  switch (s) {
    case "done":
      return "success";
    case "in_progress":
      return "default";
    case "blocked":
      return "warning";
    case "cancelled":
      return "muted";
    default:
      return "secondary";
  }
}

export function priorityVariant(
  p: TaskPriority
): "default" | "secondary" | "destructive" | "muted" {
  switch (p) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    default:
      return "muted";
  }
}

export function isOverdue(
  due: string | null,
  status: TaskStatus
): boolean {
  if (!due) return false;
  if (status === "done" || status === "cancelled") return false;
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

// Re-export so existing imports from "./task-meta" keep working.
export { localDate } from "@/lib/date";
