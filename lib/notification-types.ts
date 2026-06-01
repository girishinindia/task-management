/**
 * Notification taxonomy — client-safe (no server imports). Shared by the
 * notifications page, the filters component, and the bell so labels, smart
 * category groupings, and the known type list stay in one place.
 */

/** Friendly label for each notification `type`. */
export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  task_assigned: "Assigned to you",
  task_transferred: "Transferred",
  status_changed: "Status changed",
  task_updated: "Task edited",
  attachment_added: "Attachment added",
  comment_added: "New comment",
  task_due_soon: "Due today",
  task_overdue: "Overdue",
  project_requested: "Project requested",
  password_reset_requested: "Password reset",
  password_changed: "Password changed",
};

/** All known notification types (for the precise "type" dropdown). */
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABEL);

export interface NotificationCategory {
  key: string;
  label: string;
  types: string[];
}

/** Smart groupings used for the quick category chips. */
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "tasks",
    label: "Tasks",
    types: [
      "task_assigned",
      "task_transferred",
      "status_changed",
      "task_updated",
    ],
  },
  { key: "reminders", label: "Reminders", types: ["task_due_soon", "task_overdue"] },
  { key: "comments", label: "Comments", types: ["comment_added"] },
  { key: "files", label: "Files", types: ["attachment_added"] },
  {
    key: "admin",
    label: "Admin",
    types: ["project_requested", "password_reset_requested"],
  },
];

/** The set of types a category covers, or undefined for an unknown/"all" key. */
export function typesForCategory(key?: string | null): string[] | undefined {
  if (!key || key === "all") return undefined;
  return NOTIFICATION_CATEGORIES.find((c) => c.key === key)?.types;
}

/** Is this a valid category key? */
export function isNotificationCategory(key?: string | null): boolean {
  return !!key && NOTIFICATION_CATEGORIES.some((c) => c.key === key);
}
