"use client";

import { useState } from "react";
import { ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface UISubtask {
  id: number;
  title: string;
  is_done: boolean;
}

export function SubtasksSection({
  taskId,
  initial,
}: {
  taskId: string;
  initial: UISubtask[];
}) {
  const [items, setItems] = useState<UISubtask[]>(initial);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const done = items.filter((i) => i.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function add() {
    const text = title.trim();
    if (!text) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to add item");
        return;
      }
      const j = (await res.json()) as { subtask: UISubtask };
      setItems((prev) => [...prev, { ...j.subtask }]);
      setTitle("");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(item: UISubtask) {
    setBusy(item.id);
    // optimistic
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_done: !item.is_done }),
      });
      if (!res.ok) {
        // revert
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_done: item.is_done } : i
          )
        );
        toast.error("Failed to update item");
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete item");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Checklist
          {items.length > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">
              {done}/{items.length}
            </span>
          ) : null}
        </h2>
        {items.length > 0 ? (
          <span className="text-xs text-muted-foreground">{pct}%</span>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <ul className="space-y-1">
        {items.map((i) => (
          <li
            key={i.id}
            className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40"
          >
            <input
              type="checkbox"
              checked={i.is_done}
              disabled={busy === i.id}
              onChange={() => toggle(i)}
              className="h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
            />
            <span
              className={cn(
                "flex-1 text-sm",
                i.is_done && "text-muted-foreground line-through"
              )}
            >
              {i.title}
            </span>
            <button
              type="button"
              onClick={() => remove(i.id)}
              disabled={busy === i.id}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label="Delete item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t pt-3">
        <Input
          value={title}
          placeholder="Add a checklist item…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={adding || !title.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>
    </section>
  );
}
