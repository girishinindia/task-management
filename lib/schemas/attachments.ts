/**
 * Zod schemas for attachment endpoints. The file upload route uses
 * multipart/form-data so it validates fields manually; this file covers the
 * JSON-bodied URL endpoint and shared helpers.
 */
import { z } from "zod";

const httpUrl = z
  .string()
  .trim()
  .max(2048, "URL too long")
  .url("Must be a valid URL")
  .refine(
    (v) => /^https?:\/\//i.test(v),
    "Only http(s) URLs are allowed"
  );

export const urlAttachmentSchema = z.object({
  link_url: httpUrl,
  original_name: z
    .string()
    .trim()
    .max(200, "Label too long")
    .optional()
    .nullable(),
});

export type UrlAttachmentInput = z.infer<typeof urlAttachmentSchema>;
