import { z } from "zod";

export const subtaskCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a checklist item")
    .max(200, "Too long"),
});

export const subtaskUpdateSchema = z.object({
  is_done: z.boolean(),
});

export type SubtaskCreateInput = z.infer<typeof subtaskCreateSchema>;
export type SubtaskUpdateInput = z.infer<typeof subtaskUpdateSchema>;
