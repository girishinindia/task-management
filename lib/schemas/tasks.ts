/**
 * Zod schemas for task CRUD. Shared by the form, the API routes, and the DAO.
 */
import { z } from "zod";
import { isValidDateString, isValidTimeString } from "@/lib/date";

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isValidDateString, "Enter a real date between 2000 and 2100");

/** Treat "" as undefined so empty date inputs don't trip the regex. */
const optionalDate = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    isoDate.optional()
  )
  .nullable()
  .optional();

const isoTime = z
  .string()
  .refine(isValidTimeString, "Time must be HH:MM");

/** Treat "" as undefined so empty time inputs don't trip the regex. */
const optionalTime = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    isoTime.optional()
  )
  .nullable()
  .optional();

const optionalText = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().max(max).optional()
    )
    .nullable()
    .optional();

export const taskCreateSchema = z
  .object({
    project_id: z.string().uuid("Pick a project"),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title is too long"),
    description: optionalText(4000),
    priority: z.enum(TASK_PRIORITIES).default("medium"),
    status: z.enum(TASK_STATUSES).default("pending"),
    start_date: optionalDate,
    due_date: optionalDate,
    start_time: optionalTime,
    due_time: optionalTime,
    recur_rule: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
    assignee_ids: z.array(z.string().uuid()).max(50).optional().default([]),
    /** Optional checklist items to seed the task with, created in order. */
    subtasks: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .optional()
      .default([]),
  })
  .refine(
    (v) => !v.start_date || !v.due_date || v.due_date >= v.start_date,
    {
      message: "Due date must be on or after the start date",
      path: ["due_date"],
    }
  )
  .refine((v) => !v.start_time || !!v.start_date, {
    message: "Set a start date before a start time",
    path: ["start_time"],
  })
  .refine((v) => !v.due_time || !!v.due_date, {
    message: "Set a due date before a due time",
    path: ["due_time"],
  });

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: optionalText(4000),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    start_date: optionalDate,
    due_date: optionalDate,
    start_time: optionalTime,
    due_time: optionalTime,
    recur_rule: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Nothing to update",
  })
  .refine(
    (v) => !v.start_date || !v.due_date || v.due_date >= v.start_date,
    {
      message: "Due date must be on or after the start date",
      path: ["due_date"],
    }
  );

export const bulkTaskActionSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1, "Select at least one task").max(200),
    action: z.enum(["status", "priority", "archive", "restore"]),
    value: z.string().optional(),
  })
  .refine(
    (v) => {
      if (v.action === "status")
        return TASK_STATUSES.includes(v.value as TaskStatus);
      if (v.action === "priority")
        return TASK_PRIORITIES.includes(v.value as TaskPriority);
      return true;
    },
    { message: "Invalid value for this action", path: ["value"] }
  );

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type BulkTaskActionInput = z.infer<typeof bulkTaskActionSchema>;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
