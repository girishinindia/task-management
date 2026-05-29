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

/** Build the storage path used inside the zone for a comment attachment. */
export function buildCommentAttachmentPath(taskId: string, originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  return `tasks/${taskId}/comments/${randomUUID()}-${safeName}`;
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
  // ZIP variants browsers actually send (Windows often uses x-zip-compressed)
  "application/x-zip-compressed",
  "application/x-zip",
  "multipart/x-zip",
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

/**
 * Allowed file extensions — a fallback for when the browser reports a vague or
 * wrong MIME type (e.g. a ZIP sent as application/octet-stream, or a CSV sent
 * as application/vnd.ms-excel). Mirrors ALLOWED_ATTACHMENT_MIME.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set<string>([
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  "mp4", "webm", "mov",
  "pdf", "zip", "txt", "csv",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
]);

/**
 * Accept an upload if its MIME type is allowed OR its file extension is —
 * browsers are inconsistent about MIME types, so the extension is a reliable
 * fallback (this is what makes .zip uploads work everywhere).
 */
export function isAllowedAttachment(fileName: string, mime: string): boolean {
  if (ALLOWED_ATTACHMENT_MIME.has(mime)) return true;
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  return ext.length > 0 && ALLOWED_ATTACHMENT_EXTENSIONS.has(ext);
}

// ── Comment attachments (a stricter subset: images, PDF, Word only) ──────────
export const COMMENT_ATTACHMENT_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const COMMENT_ATTACHMENT_EXTENSIONS = new Set<string>([
  "png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx",
]);

export const MAX_COMMENT_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/** Comment attachments allow images, PDF, and Word docs only. */
export function isAllowedCommentAttachment(
  fileName: string,
  mime: string
): boolean {
  if (COMMENT_ATTACHMENT_MIME.has(mime)) return true;
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  return ext.length > 0 && COMMENT_ATTACHMENT_EXTENSIONS.has(ext);
}
