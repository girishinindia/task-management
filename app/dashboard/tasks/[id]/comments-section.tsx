"use client";

import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface UIComment {
  id: number;
  author_id: string | null;
  author_name: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime: string | null;
  created_at: string;
}

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx";

export function CommentsSection({
  taskId,
  initial,
  meId,
  canModerate,
}: {
  taskId: string;
  initial: UIComment[];
  meId: string;
  canModerate: boolean;
}) {
  const [comments, setComments] = useState<UIComment[]>(initial);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    mime: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function pickFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/comments/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Upload failed");
        return;
      }
      const j = (await res.json()) as {
        url: string;
        name: string;
        mime: string;
      };
      setAttachment({ url: j.url, name: j.name, mime: j.mime });
    } finally {
      setUploading(false);
    }
  }

  async function post() {
    const text = body.trim();
    if (!text && !attachment) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: text,
          attachment_url: attachment?.url ?? null,
          attachment_name: attachment?.name ?? null,
          attachment_mime: attachment?.mime ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to post comment");
        return;
      }
      const j = (await res.json()) as {
        comment: {
          id: number;
          author_id: string | null;
          author_full_name: string | null;
          body: string;
          attachment_url: string | null;
          attachment_name: string | null;
          attachment_mime: string | null;
          created_at: string;
        };
      };
      setComments((prev) => [
        ...prev,
        {
          id: j.comment.id,
          author_id: j.comment.author_id,
          author_name: j.comment.author_full_name ?? "You",
          body: j.comment.body,
          attachment_url: j.comment.attachment_url,
          attachment_name: j.comment.attachment_name,
          attachment_mime: j.comment.attachment_mime,
          created_at: j.comment.created_at,
        },
      ]);
      setBody("");
      setAttachment(null);
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to delete comment");
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Comments
        <span className="text-xs font-normal text-muted-foreground">
          ({comments.length})
        </span>
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the discussion below.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const canDelete = canModerate || c.author_id === meId;
            return (
              <li key={c.id} className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(c.author_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.author_name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={deleting === c.id}
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                      >
                        {deleting === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  {c.body ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                      {c.body}
                    </p>
                  ) : null}
                  {c.attachment_url ? (
                    <CommentAttachment
                      url={c.attachment_url}
                      name={c.attachment_name ?? "attachment"}
                      mime={c.attachment_mime ?? ""}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t pt-3">
        <Textarea
          rows={2}
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post();
          }}
        />

        {attachment ? (
          <div className="flex items-center gap-2 self-start rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-[200px] truncate">{attachment.name}</span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || !!attachment}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            Attach
          </Button>
          <Button
            size="sm"
            onClick={post}
            disabled={posting || uploading || (!body.trim() && !attachment)}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Comment
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          You can attach one image, PDF, or Word file (max 10 MB).
        </p>
      </div>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function CommentAttachment({
  url,
  name,
  mime,
}: {
  url: string;
  name: string;
  mime: string;
}) {
  const isImage = mime.startsWith("image/");
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className="max-h-48 rounded-md border object-contain"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium hover:bg-accent/50"
    >
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="max-w-[220px] truncate">{name}</span>
    </a>
  );
}
