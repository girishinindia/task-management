"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface UIComment {
  id: number;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

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

  async function post() {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
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
          created_at: j.comment.created_at,
        },
      ]);
      setBody("");
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
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                    {c.body}
                  </p>
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
        <div className="flex justify-end">
          <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
