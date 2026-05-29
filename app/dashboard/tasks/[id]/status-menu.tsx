"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEGAL_TRANSITIONS } from "@/lib/schemas/status";
import type { TaskStatus } from "@/lib/schemas/tasks";
import {
  STATUS_LABEL,
  statusVariant,
} from "../task-meta";

export function StatusMenu({
  taskId,
  currentStatus,
  canChange,
}: {
  taskId: string;
  currentStatus: TaskStatus;
  canChange: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<TaskStatus | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const legal = LEGAL_TRANSITIONS[currentStatus];

  if (!canChange) {
    return (
      <Badge variant={statusVariant(currentStatus)}>
        {STATUS_LABEL[currentStatus]}
      </Badge>
    );
  }

  async function submit() {
    if (!target) return;
    setPending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to_status: target,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to change status");
        return;
      }
      toast.success(`Status set to ${STATUS_LABEL[target]}`);
      setTarget(null);
      setNote("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group inline-flex items-center gap-1"
            aria-label={`Change status from ${STATUS_LABEL[currentStatus]}`}
          >
            <Badge variant={statusVariant(currentStatus)}>
              {STATUS_LABEL[currentStatus]}
            </Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Change status
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {legal.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs">
              No transitions available
            </DropdownMenuItem>
          ) : (
            legal.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => setTarget(s)}
                className="cursor-pointer"
              >
                <Badge
                  variant={statusVariant(s)}
                  className="pointer-events-none"
                >
                  {STATUS_LABEL[s]}
                </Badge>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={target !== null}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {STATUS_LABEL[currentStatus]} → {target ? STATUS_LABEL[target] : ""}
            </DialogTitle>
            <DialogDescription>
              Add an optional note explaining the change. It will appear on the
              activity timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="status-note">Note (optional)</Label>
            <Textarea
              id="status-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. waiting on customer feedback"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground">
              {note.length}/500
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
