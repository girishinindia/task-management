"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssigneePicker } from "@/components/users/assignee-picker";
import { UserAvatar } from "@/components/users/user-avatar";

export interface AssigneeLite {
  user_id: string;
  full_name: string;
  email: string;
}

export function AssigneesSection({
  taskId,
  dueDate,
  initialAssignees,
  editable,
}: {
  taskId: string;
  dueDate: string | null;
  initialAssignees: AssigneeLite[];
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(
    initialAssignees.map((a) => a.user_id)
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_ids: draftIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to update assignees");
        return;
      }
      toast.success("Assignees updated");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">
          <Users className="mr-1.5 inline-block h-4 w-4 -translate-y-0.5" />
          Assignees
          <span className="ml-1.5 text-muted-foreground">
            ({initialAssignees.length})
          </span>
        </h2>
        {editable ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftIds(initialAssignees.map((a) => a.user_id));
              setOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Manage
          </Button>
        ) : null}
      </header>

      {initialAssignees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No one is assigned yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {initialAssignees.map((a) => (
            <li
              key={a.user_id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <UserAvatar
                fullName={a.full_name}
                email={a.email}
                size="sm"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{a.full_name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {a.email}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage assignees</DialogTitle>
            <DialogDescription>
              Pick everyone responsible for this task. Users marked inactive on
              the due date are disabled.
            </DialogDescription>
          </DialogHeader>
          <AssigneePicker
            value={draftIds}
            onChange={setDraftIds}
            dueDate={dueDate}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
