/**
 * Shared zod schemas for auth flows. Used by client forms (via
 * @hookform/resolvers/zod) and by the server route handlers.
 */
import { z } from "zod";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[0-9]/, "Password must contain at least one number");

/** A real person's name: starts with a letter; only letters, spaces, hyphens,
 *  apostrophes, and periods; at least two letters (\p{L} covers non-Latin). */
const fullName = z
  .string()
  .trim()
  .min(2, "Please enter your full name")
  .max(100, "Name is too long")
  .regex(
    /^[\p{L}][\p{L} .'-]*$/u,
    "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
  )
  .refine(
    (v) => (v.match(/\p{L}/gu)?.length ?? 0) >= 2,
    "Please enter a real name"
  );

export const signupSchema = z
  .object({
    full_name: fullName,
    email: z.string().trim().email("Enter a valid email").toLowerCase(),
    password,
    confirm_password: z.string(),
    captcha_token: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").toLowerCase(),
  password: z.string().min(1, "Password is required"),
  captcha_token: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
