/**
 * Zod schemas for admin operations. Reused by client dialogs and server routes.
 */
import { z } from "zod";
import { isValidDateString } from "@/lib/date";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[0-9]/, "Password must contain at least one number");

/** A real person's name: starts with a letter; only letters, spaces, hyphens,
 *  apostrophes, and periods; at least two letters. \p{L} covers non-Latin
 *  scripts and accents. Rejects junk like "(*&^%^&*OP:" or "12345". */
const fullName = z
  .string()
  .trim()
  .min(2, "Please enter a real name")
  .max(100, "Name is too long")
  .regex(
    /^[\p{L}][\p{L} .'-]*$/u,
    "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
  )
  .refine(
    (v) => (v.match(/\p{L}/gu)?.length ?? 0) >= 2,
    "Please enter a real name"
  );

export const adminSetPasswordSchema = z.object({
  password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const adminCreateUserSchema = z.object({
  full_name: fullName,
  email: z.string().trim().email().toLowerCase(),
  password,
  role: z.enum(["admin", "user"]).default("user"),
});

export const adminUpdateUserSchema = z
  .object({
    full_name: fullName.optional(),
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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isValidDateString, "Enter a real date between 2000 and 2100");

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
