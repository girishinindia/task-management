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

export const signupSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Please enter your full name")
      .max(100, "Name is too long"),
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
