"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHotkey } from "@/lib/hotkeys";

/** Global hotkey host. Mounted once inside the dashboard layout.
 *
 *   n  → /dashboard/tasks/new
 *   /  → focus [data-hotkey="search"]
 *   ?  → open shortcut help dialog
 *
 * Shortcuts auto-disable while the user is typing in an input/textarea/
 * contenteditable element. */
export function HotkeyHost({ canCreate = false }: { canCreate?: boolean }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  // Only admins can create tasks, so the "n" shortcut is a no-op for everyone
  // else (the /dashboard/tasks/new page redirects non-admins anyway).
  const goNew = useCallback(() => {
    if (canCreate) router.push("/dashboard/tasks/new");
  }, [router, canCreate]);

  const focusSearch = useCallback((e: KeyboardEvent) => {
    const el = document.querySelector<HTMLInputElement>(
      '[data-hotkey="search"]'
    );
    if (el) {
      e.preventDefault();
      el.focus();
      el.select();
    }
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  useHotkey("n", goNew);
  useHotkey("/", focusSearch);
  useHotkey("?", openHelp);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Press these anywhere outside a text field.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {canCreate ? (
            <ShortcutRow keys={["n"]} description="Create a new task" />
          ) : null}
          <ShortcutRow keys={["/"]} description="Focus the tasks search" />
          <ShortcutRow keys={["?"]} description="Show this list" />
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="text-foreground">{description}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}
