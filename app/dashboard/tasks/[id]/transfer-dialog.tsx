"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TransferDialogProps {
  taskId: string;
  /** ISO YYYY-MM-DD if the task has a due_date. Drives the inactive-on-date guard. */
  dueDate: string | null;
  /** Current assignees — populate the "from" select. */
  currentAssignees: { user_id: string; full_name: string; email: string }[];
  /** Current user's id; pre-selects them as From if they're an assignee. */
  meId: string;
}

interface AssignableUser {
  id: string;
  full_name: string;
  email: string;
  inactive_on_date: boolean;
}

export function TransferDialog(props: TransferDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const initialFrom = props.currentAssignees.find(
    (a) => a.user_id === props.meId
  )
    ? props.meId
    : "__none__";

  const [fromId, setFromId] = useState<string>(initialFrom);
  const [toId, setToId] = useState<string>("");
  const [reason, setReason] = useState("");

  // Lazy-load users when the dialog opens (passes due_date so inactive flags
  // come back from the server).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const url = props.dueDate
          ? `/api/users?date=${props.dueDate}`
          : `/api/users`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) setUsers(data.users ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, props.dueDate]);

  async function submit() {
    if (!toId) {
      toast.error("Pick someone to transfer to.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/tasks/${props.taskId}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_user_id: fromId === "__none__" ? null : fromId,
          to_user_id: toId,
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to transfer task");
        return;
      }
      toast.success("Task transferred");
      setOpen(false);
      setToId("");
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
        Transfer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer task</DialogTitle>
            <DialogDescription>
              Reassign this task to someone else. The original creator stays
              the same; only the assignment moves. Everything is recorded in
              the transfer history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Transfer from</Label>
              <Select value={fromId} onValueChange={(v) => setFromId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Who is being unassigned?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    No one (just add the new assignee)
                  </SelectItem>
                  {props.currentAssignees.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Current assignees</SelectLabel>
                      {props.currentAssignees.map((a) => (
                        <SelectItem key={a.user_id} value={a.user_id}>
                          {a.full_name} — {a.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Pick &ldquo;No one&rdquo; if you just want to add a new
                assignee without removing anyone.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Transfer to</Label>
              <Select value={toId} onValueChange={(v) => setToId(v)}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={loading ? "Loading users…" : "Pick the new assignee"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : users.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No active users.
                    </div>
                  ) : (
                    users.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        disabled={u.inactive_on_date}
                      >
                        {u.full_name} — {u.email}
                        {u.inactive_on_date
                          ? ` · inactive on ${props.dueDate}`
                          : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {props.dueDate ? (
                <p className="text-[10px] text-muted-foreground">
                  Users marked inactive on the task&apos;s due date (
                  {props.dueDate}) can&apos;t receive this task.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transfer-reason">Reason (optional)</Label>
              <Textarea
                id="transfer-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. moving to backup engineer while Ada is on leave"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground">
                {reason.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !toId}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
