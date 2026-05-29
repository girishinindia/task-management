/**
 * Zod schemas for task CRUD. Shared by the form, the API routes, and the DAO.
 */
import { z } from "zod";

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** Treat "" as undefined so empty date inputs don't trip the regex. */
const optionalDate = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    isoDate.optional()
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
    assignee_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  })
  .refine(
    (v) => !v.start_date || !v.due_date || v.due_date >= v.start_date,
    {
      message: "Due date must be on or after the start date",
      path: ["due_date"],
    }
  );

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: optionalText(4000),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    start_date: optionalDate,
    due_date: optionalDate,
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

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
