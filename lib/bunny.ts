/**
 * Bunny Storage helper — minimal client for upload / download / delete.
 *
 * Bunny exposes a plain HTTP API: PUT / GET / DELETE on
 *   `${BUNNY_STORAGE_URL}/<path>`
 * authenticated with the access key in the `AccessKey` header.
 *
 * Public reads happen via the CDN at `${BUNNY_CDN_URL}/<path>`.
 */
import { randomUUID } from "crypto";
import { env } from "@/lib/env";

function authHeaders() {
  return {
    AccessKey: env.BUNNY_STORAGE_KEY,
    accept: "application/json",
  };
}

/** Build the storage path used inside the zone for a task's attachment. */
export function buildAttachmentPath(taskId: string, originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return `tasks/${taskId}/${randomUUID()}-${safeName}`;
}

/** Public CDN URL for a stored object path. */
export function cdnUrl(path: string) {
  return `${env.BUNNY_CDN_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/** Upload an in-memory buffer to Bunny Storage. */
export async function uploadToBunny(opts: {
  path: string;
  body: ArrayBuffer | Buffer | Uint8Array;
  contentType?: string;
}): Promise<{ path: string; url: string }> {
  const url = `${env.BUNNY_STORAGE_URL.replace(/\/$/, "")}/${opts.path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "content-type": opts.contentType ?? "application/octet-stream",
    },
    body: opts.body as BodyInit,
  });
  if (!res.ok) {
    throw new Error(
      `Bunny upload failed (${res.status}): ${await res.text().catch(() => "")}`
    );
  }
  return { path: opts.path, url: cdnUrl(opts.path) };
}

/** Delete a stored object. Returns true if deleted, false if it didn't exist. */
export async function deleteFromBunny(path: string): Promise<boolean> {
  const url = `${env.BUNNY_STORAGE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(
      `Bunny delete failed (${res.status}): ${await res.text().catch(() => "")}`
    );
  }
  return true;
}

/** Allowed MIME types for attachments. Adjust as your product evolves. */
export const ALLOWED_ATTACHMENT_MIME = new Set<string>([
  // images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // documents
  "application/pdf",
  "application/zip",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB
