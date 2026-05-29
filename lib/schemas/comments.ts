import { z } from "zod";

export const commentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(4000, "Comment is too long"),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
