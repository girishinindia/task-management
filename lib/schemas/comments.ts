import { z } from "zod";

export const commentCreateSchema = z
  .object({
    body: z
      .string()
      .trim()
      .max(4000, "Comment is too long")
      .optional()
      .default(""),
    attachment_url: z.string().url().optional().nullable(),
    attachment_name: z.string().max(255).optional().nullable(),
    attachment_mime: z.string().max(255).optional().nullable(),
  })
  .refine((v) => (v.body && v.body.trim().length > 0) || !!v.attachment_url, {
    message: "Write a comment or attach a file",
    path: ["body"],
  });

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
