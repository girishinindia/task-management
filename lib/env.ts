/**
 * Centralised, validated env access.
 * Importing `env` anywhere guarantees the required keys exist at boot,
 * otherwise the process throws with a clear list of what's missing.
 */
import { z } from "zod";

const schema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DB_SCHEMA: z.string().min(1).default("task"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Redis
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_SESSION_TTL: z.coerce.number().default(1800),
  REDIS_CACHE_TTL: z.coerce.number().default(300),
  REDIS_OTP_TTL: z.coerce.number().default(600),

  // Bunny
  BUNNY_STORAGE_ZONE: z.string().min(1),
  BUNNY_STORAGE_KEY: z.string().min(1),
  BUNNY_STORAGE_URL: z.string().url(),
  BUNNY_CDN_URL: z.string().url(),

  // reCAPTCHA (server)
  RECAPTCHA_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  RECAPTCHA_SECRET_KEY: z.string().optional(),
  RECAPTCHA_API_KEY: z.string().optional(),
  RECAPTCHA_PROJECT_ID: z.string().optional(),
  RECAPTCHA_MIN_SCORE: z.coerce.number().default(0.5),

  // reCAPTCHA (client, mirrored as NEXT_PUBLIC_*)
  NEXT_PUBLIC_RECAPTCHA_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_NAME: z.string().default("Task Portal"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Phase 12 hardening: invite-only by default. Flip to "true" to allow
  // anyone with the signup URL to create an account.
  ALLOW_PUBLIC_SIGNUP: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  throw new Error("Invalid environment variables. See log above.");
}

export const env = parsed.data;
export type Env = typeof env;
