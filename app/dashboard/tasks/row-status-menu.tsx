"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { LEGAL_TRANSITIONS, MEMBER_STATUSES } from "@/lib/schemas/status";
import type { TaskStatus } from "@/lib/schemas/tasks";
import { STATUS_DOT, STATUS_LABEL, statusVariant } from "./task-meta";
import { cn } from "@/lib/utils";

/** Compact status dropdown for tasks-list rows. No note prompt — pure quick
 *  action. The detail page's StatusMenu still supports notes. */
export function RowStatusMenu({
  taskId,
  currentStatus,
  canManage = true,
  canChange = true,
  subtle = false,
}: {
  taskId: string;
  currentStatus: TaskStatus;
  /** Managers get every legal transition; members only In progress / Done. */
  canManage?: boolean;
  /** May this user change the status at all? Only the task's assignee(s) or a
   *  project admin / super admin can — everyone else sees a read-only badge. */
  canChange?: boolean;
  /** Low-chrome look (dot + label) for dense views like the tree. */
  subtle?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // The visible status chip: a solid badge by default, or a soft dot + label
  // in `subtle` mode (keeps dense views light).
  const chip = subtle ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[currentStatus])}
      />
      {STATUS_LABEL[currentStatus]}
    </span>
  ) : (
    <Badge variant={statusVariant(currentStatus)}>
      {STATUS_LABEL[currentStatus]}
    </Badge>
  );

  // Not the assignee and not a manager → status is read-only.
  if (!canChange) {
    return chip;
  }

  const legal = canManage
    ? LEGAL_TRANSITIONS[currentStatus]
    : LEGAL_TRANSITIONS[currentStatus].filter((s) =>
        MEMBER_STATUSES.includes(s)
      );

  async function change(to: TaskStatus) {
    setPending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to_status: to }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to change status");
        return;
      }
      toast.success(`Status: ${STATUS_LABEL[to]}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1"
          aria-label={`Change status from ${STATUS_LABEL[currentStatus]}`}
          disabled={pending}
        >
          {chip}
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Quick status change
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
              onClick={(e) => {
                e.preventDefault();
                change(s);
              }}
              className="cursor-pointer"
            >
              <Badge variant={statusVariant(s)} className="pointer-events-none">
                {STATUS_LABEL[s]}
              </Badge>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
