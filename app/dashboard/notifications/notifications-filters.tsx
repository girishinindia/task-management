"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  Inbox,
  ListTodo,
  MessageSquare,
  Paperclip,
  Search,
  Shield,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTIFICATION_TYPE_LABEL } from "@/lib/notification-types";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  all: <Inbox className="h-3.5 w-3.5" />,
  tasks: <ListTodo className="h-3.5 w-3.5" />,
  reminders: <AlarmClock className="h-3.5 w-3.5" />,
  comments: <MessageSquare className="h-3.5 w-3.5" />,
  files: <Paperclip className="h-3.5 w-3.5" />,
  admin: <Shield className="h-3.5 w-3.5" />,
};

export interface NotificationsFiltersProps {
  defaultQ: string;
  defaultCategory: string; // "all" or a category key
  defaultType: string; // "all" or a specific type
  /** Category chips with their counts (excluding the leading "All"). */
  categories: { key: string; label: string; count: number }[];
  /** "All" chip count (total in the current scope/search). */
  totalCount: number;
  /** Precise type options with counts. */
  typeOptions: { value: string; label: string; count: number }[];
}

export function NotificationsFilters({
  defaultQ,
  defaultCategory,
  defaultType,
  categories,
  totalCount,
  typeOptions,
}: NotificationsFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all" || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.replace(`/dashboard/notifications?${next.toString()}`);
    });
  }

  const hasFilters =
    !!defaultQ || defaultCategory !== "all" || defaultType !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications…"
            defaultValue={defaultQ}
            className="pl-8"
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>

        {/* Precise type filter — clears the category chip when used. */}
        <Select
          value={defaultType}
          onValueChange={(v) => update({ type: v, category: undefined })}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
                {t.count > 0 ? ` (${t.count})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => update({ q: undefined, category: undefined, type: undefined })}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}

        {pending ? (
          <span className="text-xs text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {/* Smart category chips — clear the precise type when used. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          active={defaultCategory === "all" && defaultType === "all"}
          icon={CATEGORY_ICON.all}
          label="All"
          count={totalCount}
          onClick={() => update({ category: undefined, type: undefined })}
        />
        {categories.map((c) => (
          <Chip
            key={c.key}
            active={defaultCategory === c.key}
            icon={CATEGORY_ICON[c.key]}
            label={c.label}
            count={c.count}
            onClick={() => update({ category: c.key, type: undefined })}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-semibold",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}
