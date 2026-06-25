"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";
import { isValidDateString } from "@/lib/date";

export interface AssigneeOption {
  id: string;
  full_name: string;
  email: string;
  inactive_on_date: boolean;
}

export interface AssigneePickerProps {
  /** Currently selected user IDs */
  value: string[];
  /** Called whenever the selection changes */
  onChange: (next: string[]) => void;
  /** Optional: a YYYY-MM-DD date used to flag users who are inactive on it. */
  dueDate?: string | null;
  /** Optional: restrict the list to members of this project. */
  projectId?: string | null;
  /** Optional: pre-fetched users. If omitted, fetched from /api/users. */
  initialUsers?: AssigneeOption[];
  /** Subset of `value` that are admins (project admins). */
  adminIds?: string[];
  /** Toggle a selected user's admin flag. */
  onToggleAdmin?: (id: string) => void;
  /** Show the per-assignee Admin toggle on selected chips. */
  showAdmin?: boolean;
  disabled?: boolean;
  /** Optional class for the outer wrapper */
  className?: string;
}

export function AssigneePicker({
  value,
  onChange,
  dueDate,
  projectId,
  initialUsers,
  adminIds,
  onToggleAdmin,
  showAdmin = false,
  disabled,
  className,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AssigneeOption[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(!initialUsers);
  const [search, setSearch] = useState("");

  // Re-fetch when the relevant date changes so we have fresh inactive flags.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Build the query: a valid date flags users inactive that day; a
        // project scopes the list to that project's members.
        const params = new URLSearchParams();
        if (isValidDateString(dueDate)) params.set("date", dueDate);
        if (projectId) params.set("project_id", projectId);
        const qs = params.toString();
        const res = await fetch(qs ? `/api/users?${qs}` : `/api/users`);
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!cancelled) setUsers(data?.users ?? []);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dueDate, projectId]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const adminSet = useMemo(() => new Set(adminIds ?? []), [adminIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedSet.has(u.id)),
    [users, selectedSet]
  );

  function toggle(id: string, disabledRow?: boolean) {
    if (disabledRow && !selectedSet.has(id)) return;
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="text-muted-foreground">
              {value.length === 0
                ? "Select assignees…"
                : `${value.length} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="h-8 pl-7"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading users…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No users match.
              </div>
            ) : (
              filtered.map((u) => {
                const isSelected = selectedSet.has(u.id);
                const isDisabled = u.inactive_on_date && !isSelected;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id, isDisabled)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-accent"
                    )}
                    aria-disabled={isDisabled}
                    title={
                      isDisabled
                        ? `Inactive on ${dueDate}`
                        : `${u.full_name} · ${u.email}`
                    }
                  >
                    <UserAvatar
                      fullName={u.full_name}
                      email={u.email}
                      size="sm"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {u.full_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </span>
                    {u.inactive_on_date ? (
                      <Badge variant="muted" className="text-[10px]">
                        inactive {dueDate}
                      </Badge>
                    ) : null}
                    {isSelected ? (
                      <Check className="ml-1 h-4 w-4 text-primary" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs"
            >
              <UserAvatar
                fullName={u.full_name}
                email={u.email}
                size="xs"
              />
              <span className="font-medium">{u.full_name}</span>
              {showAdmin && onToggleAdmin ? (
                <button
                  type="button"
                  onClick={() => onToggleAdmin(u.id)}
                  aria-pressed={adminSet.has(u.id)}
                  title={
                    adminSet.has(u.id)
                      ? "Project admin — click to make member"
                      : "Member — click to make admin"
                  }
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                    adminSet.has(u.id)
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {adminSet.has(u.id) ? "Admin" : "Member"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${u.full_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
