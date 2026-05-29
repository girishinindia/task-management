/**
 * Optional global wrapper for route handlers.
 *
 *   export const POST = withRoute(async (req, ctx) => { ... });
 *
 * Catches:
 *   - ZodError → 400 validation envelope (with field errors)
 *   - thrown apiError responses are returned as-is
 *   - everything else → 500 server_error
 *
 * Plays nicely with Next's redirect()/notFound() — they throw a special
 * NEXT_REDIRECT / NEXT_NOT_FOUND digest that this helper re-throws so the
 * runtime can handle them.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiError } from "@/lib/api-response";

type RouteCtx<P> = { params: P };
type RouteFn<P> = (
  req: Request,
  ctx: RouteCtx<P>
) => Promise<Response> | Response;

function isNextControlFlow(e: unknown): boolean {
  // Next.js signals redirect() / notFound() via thrown errors that have a
  // `digest` starting with NEXT_REDIRECT or NEXT_NOT_FOUND. Re-throw so the
  // framework can act on them.
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_NOT_FOUND"))
  );
}

export function withRoute<P = unknown>(fn: RouteFn<P>): RouteFn<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (isNextControlFlow(e)) throw e;

      if (e instanceof ZodError) {
        return apiError(
          "validation",
          "Some fields are invalid",
          400,
          e.flatten().fieldErrors
        );
      }

      // Already a Response (e.g. someone threw an apiError accidentally).
      if (e instanceof Response || e instanceof NextResponse) {
        return e;
      }

      const message = e instanceof Error ? e.message : "Unexpected error";
      // eslint-disable-next-line no-console
      console.error("[route]", message, e);
      return apiError("server_error", "Something went wrong", 500);
    }
  };
}
