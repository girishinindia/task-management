/**
 * Zod schemas for admin operations. Reused by client dialogs and server routes.
 */
import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[0-9]/, "Password must contain at least one number");

export const adminCreateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password,
  role: z.enum(["admin", "user"]).default("user"),
});

export const adminUpdateUserSchema = z
  .object({
    full_name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(["admin", "user"]).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.full_name !== undefined ||
      v.role !== undefined ||
      v.is_active !== undefined,
    { message: "Nothing to update" }
  );

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const dateStatusSchema = z.object({
  date: dateOnly,
  is_active: z.boolean(),
  note: z.string().max(500).optional().nullable(),
});

export const dateStatusDeleteSchema = z.object({
  date: dateOnly,
});

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type DateStatusInput = z.infer<typeof dateStatusSchema>;
