"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeactivateTaskButton({
  taskId,
  isActive,
  title,
}: {
  taskId: string;
  isActive: boolean;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !isActive;
    if (
      !next &&
      !confirm(
        `Deactivate "${title}"? It'll be hidden from task lists but kept — a super admin can hard-delete it later.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/active`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed");
        return;
      }
      toast.success(next ? "Task reactivated" : "Task deactivated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <Archive className="h-4 w-4" />
      ) : (
        <ArchiveRestore className="h-4 w-4" />
      )}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
