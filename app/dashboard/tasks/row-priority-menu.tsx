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
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/schemas/tasks";
import { PRIORITY_LABEL, priorityVariant } from "./task-meta";

/** Compact priority dropdown for tasks-list rows. A "task admin" (someone who
 *  can manage the task's project) can change priority inline — mirroring the
 *  status quick-change. Everyone else sees a read-only badge.
 *
 *  Goes through PATCH /api/tasks/[id] { priority }, which already enforces the
 *  canManageProject permission server-side. */
export function RowPriorityMenu({
  taskId,
  currentPriority,
  canChange = true,
}: {
  taskId: string;
  currentPriority: TaskPriority;
  /** May this user change priority? (Task admins only.) */
  canChange?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const badge = (
    <Badge variant={priorityVariant(currentPriority)}>
      {PRIORITY_LABEL[currentPriority]}
    </Badge>
  );

  if (!canChange) return badge;

  async function change(to: TaskPriority) {
    if (to === currentPriority) return;
    setPending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priority: to }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to change priority");
        return;
      }
      toast.success(`Priority: ${PRIORITY_LABEL[to]}`);
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
          aria-label={`Change priority from ${PRIORITY_LABEL[currentPriority]}`}
          disabled={pending}
        >
          {badge}
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Set priority
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TASK_PRIORITIES.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={(e) => {
              e.preventDefault();
              change(p);
            }}
            className="cursor-pointer"
          >
            <Badge variant={priorityVariant(p)} className="pointer-events-none">
              {PRIORITY_LABEL[p]}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
