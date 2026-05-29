"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UsersFilters({
  defaultQ,
  defaultRole,
  defaultStatus,
}: {
  defaultQ: string;
  defaultRole: "all" | "admin" | "user";
  defaultStatus: "all" | "active" | "inactive";
}) {
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
      router.replace(`/admin/users?${next.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search by name or email…"
        defaultValue={defaultQ}
        className="max-w-xs"
        onChange={(e) => update({ q: e.target.value })}
      />
      <Select
        defaultValue={defaultRole}
        onValueChange={(v) => update({ role: v })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="user">User</SelectItem>
        </SelectContent>
      </Select>
      <Select
        defaultValue={defaultStatus}
        onValueChange={(v) => update({ status: v })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      {pending ? (
        <span className="text-xs text-muted-foreground">Updating…</span>
      ) : null}
    </div>
  );
}
