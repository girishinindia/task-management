"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/users/user-avatar";
import { cn } from "@/lib/utils";
import type { AttachmentRow } from "@/lib/dao/attachments";

export interface AttachmentsSectionProps {
  taskId: string;
  initial: AttachmentRow[];
  meId: string;
  /** Did the current user create the task? Needed for delete permission. */
  isCreator: boolean;
  isAdmin: boolean;
}

const MAX_BYTES = 50 * 1024 * 1024;

function humanBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(att: AttachmentRow) {
  if (att.kind === "url") return Link2;
  const mime = att.mime_type ?? "";
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (
    mime.startsWith("text/") ||
    mime === "application/pdf" ||
    mime.includes("word")
  )
    return FileText;
  return FileIcon;
}

export function AttachmentsSection(props: AttachmentsSectionProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(
    null
  );
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadOne(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is over the 50 MB limit`);
      return;
    }
    setUploading(true);
    setProgress({ name: file.name, pct: 0 });

    // XHR for upload progress events (fetch doesn't expose progress).
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      xhr.open("POST", `/api/tasks/${props.taskId}/attachments/file`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress({
            name: file.name,
            pct: Math.round((e.loaded / e.total) * 100),
          });
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          try {
            const j = JSON.parse(xhr.responseText);
            toast.error(j?.error?.message ?? `Upload failed (${xhr.status})`);
          } catch {
            toast.error(`Upload failed (${xhr.status})`);
          }
          resolve(false);
        }
      };
      xhr.onerror = () => {
        toast.error("Network error during upload");
        resolve(false);
      };
      xhr.send(form);
    });

    setUploading(false);
    setProgress(null);
    if (ok) {
      toast.success(`Uploaded ${file.name}`);
      router.refresh();
    }
  }

  async function uploadMany(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(f);
    }
  }

  async function addUrl() {
    if (!linkUrl.trim()) {
      toast.error("Enter a URL");
      return;
    }
    setAddingUrl(true);
    try {
      const res = await fetch(`/api/tasks/${props.taskId}/attachments/url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          link_url: linkUrl.trim(),
          original_name: linkLabel.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to add URL");
        return;
      }
      toast.success("Link added");
      setUrlDialogOpen(false);
      setLinkUrl("");
      setLinkLabel("");
      router.refresh();
    } finally {
      setAddingUrl(false);
    }
  }

  async function remove(att: AttachmentRow) {
    if (!confirm(`Delete "${att.original_name ?? att.link_url ?? att.id}"?`))
      return;
    setDeletingId(att.id);
    try {
      const res = await fetch(
        `/api/tasks/${props.taskId}/attachments/${att.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to delete");
        return;
      }
      toast.success("Attachment removed");
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function canDelete(att: AttachmentRow) {
    return (
      props.isAdmin ||
      props.isCreator ||
      att.uploaded_by === props.meId
    );
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          <Paperclip className="mr-1.5 inline-block h-4 w-4 -translate-y-0.5" />
          Attachments
          <span className="ml-1.5 text-muted-foreground">
            ({props.initial.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUrlDialogOpen(true)}
          >
            <Link2 className="h-3.5 w-3.5" /> Add URL
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadMany(e.target.files);
            e.target.value = "";
          }}
        />
      </header>

      {/* Drag-and-drop zone */}
      <div
        className={cn(
          "rounded-md border-2 border-dashed px-4 py-6 text-center text-xs transition-colors",
          dragOver
            ? "border-primary bg-brand-50 text-brand-700"
            : "border-border text-muted-foreground"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadMany(e.dataTransfer.files);
        }}
      >
        {progress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-medium">{progress.name}</span>
              <span className="text-muted-foreground">{progress.pct}%</span>
            </div>
            <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            Drag files here or click Upload. Max 50 MB · images, video,
            PDF, Office docs, ZIP, plain text.
          </>
        )}
      </div>

      {/* List */}
      {props.initial.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No attachments yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {props.initial.map((att) => {
            const Icon = iconFor(att);
            const href =
              att.kind === "file" ? att.cdn_url ?? "#" : att.link_url ?? "#";
            const label =
              att.original_name ?? att.link_url ?? "(unnamed attachment)";
            const isImg =
              att.kind === "file" && att.mime_type?.startsWith("image/");
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                {isImg ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={href}
                      alt={label}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  </a>
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-medium hover:underline"
                  >
                    {label}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted px-1 py-px font-semibold uppercase">
                      {att.kind}
                    </span>
                    {att.mime_type ? <span>{att.mime_type}</span> : null}
                    {att.size_bytes != null ? (
                      <span>· {humanBytes(att.size_bytes)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <UserAvatar
                    fullName={att.uploader_full_name}
                    email={att.uploader_email}
                    size="xs"
                  />
                  <span
                    className="text-[10px] text-muted-foreground"
                    title={format(new Date(att.uploaded_at), "PP p")}
                  >
                    {formatDistanceToNow(new Date(att.uploaded_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {canDelete(att) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(att)}
                    disabled={deletingId === att.id}
                    aria-label="Delete attachment"
                  >
                    {deletingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a URL</DialogTitle>
            <DialogDescription>
              Link to an external resource — Figma, Notion, a Google Doc, a
              video, anything reachable by http(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-label">Label (optional)</Label>
              <Input
                id="link-label"
                placeholder="e.g. Figma — Design v3"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUrlDialogOpen(false)}
              disabled={addingUrl}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button onClick={addUrl} disabled={addingUrl}>
              {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
