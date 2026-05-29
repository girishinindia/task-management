"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/users/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  user_id: string;
  full_name: string;
  email: string;
  role: "admin" | "member";
}
interface UserOpt {
  id: string;
  full_name: string;
  email: string;
}

export function ProjectMembers({
  projectId,
  initialMembers,
  allUsers,
  canManage,
  meId,
}: {
  projectId: string;
  initialMembers: Member[];
  allUsers: UserOpt[];
  canManage: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [addUser, setAddUser] = useState("");
  const [addRole, setAddRole] = useState<"admin" | "member">("member");

  const memberIds = useMemo(
    () => new Set(initialMembers.map((m) => m.user_id)),
    [initialMembers]
  );
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  async function post(body: { user_id: string; role: "admin" | "member" }) {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function add() {
    if (!addUser) {
      toast.error("Pick a user to add");
      return;
    }
    setBusy(true);
    try {
      const res = await post({ user_id: addUser, role: addRole });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error?.message ?? "Failed to add member");
        return;
      }
      toast.success("Member added");
      setAddUser("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, role: "admin" | "member") {
    setBusy(true);
    try {
      const res = await post({ user_id: userId, role });
      if (!res.ok) {
        toast.error("Failed to update role");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to remove member");
        return;
      }
      toast.success("Member removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-6 shadow-soft">
      <h2 className="text-sm font-semibold tracking-tight">
        Team ({initialMembers.length})
      </h2>

      {canManage ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-[200px] flex-1">
            <Select value={addUser} onValueChange={setAddUser}>
              <SelectTrigger>
                <SelectValue placeholder="Add a user…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Everyone is already a member
                  </SelectItem>
                ) : (
                  candidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} · {u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Select
            value={addRole}
            onValueChange={(v) => setAddRole(v as "admin" | "member")}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={busy || !addUser}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {initialMembers.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
            <UserAvatar fullName={m.full_name} email={m.email} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {m.email}
              </div>
            </div>
            {canManage ? (
              <Select
                value={m.role}
                onValueChange={(v) =>
                  changeRole(m.user_id, v as "admin" | "member")
                }
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant={m.role === "admin" ? "default" : "secondary"}
                className="capitalize"
              >
                {m.role}
              </Badge>
            )}
            {canManage && m.user_id !== meId ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(m.user_id)}
                disabled={busy}
                aria-label="Remove member"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
