/**
 * Zod schema for the status-change endpoint. Shared by client and server.
 */
import { z } from "zod";
import { TASK_STATUSES, type TaskStatus } from "./tasks";

export const statusChangeSchema = z.object({
  to_status: z.enum(TASK_STATUSES),
  note: z.string().trim().max(500).optional().nullable(),
});

export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

/**
 * Legal status transitions matrix (mirrors the SQL function). It lives in this
 * client-safe module so UI menus can import it without pulling in the
 * server-only DAO (and the postgres driver, which needs Node built-ins).
 */
export const LEGAL_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["done", "blocked", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  done: ["in_progress"], // re-open
  cancelled: ["pending"], // re-open
};
