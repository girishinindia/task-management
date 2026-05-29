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
import { LEGAL_TRANSITIONS } from "@/lib/schemas/status";
import type { TaskStatus } from "@/lib/schemas/tasks";
import { STATUS_LABEL, statusVariant } from "./task-meta";

/** Compact status dropdown for tasks-list rows. No note prompt — pure quick
 *  action. The detail page's StatusMenu still supports notes. */
export function RowStatusMenu({
  taskId,
  currentStatus,
}: {
  taskId: string;
  currentStatus: TaskStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const legal = LEGAL_TRANSITIONS[currentStatus];

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
          <Badge variant={statusVariant(currentStatus)}>
            {STATUS_LABEL[currentStatus]}
          </Badge>
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
