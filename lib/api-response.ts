/**
 * Standardised JSON error envelope for route handlers.
 *
 *   { error: { code, message, details? } }
 *
 * Use `apiError` for failures, return data directly for success.
 */
import { NextResponse } from "next/server";

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

export function apiOk<T extends Record<string, unknown>>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}
