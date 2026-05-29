"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminUpdateUserSchema,
  type AdminUpdateUserInput,
} from "@/lib/schemas/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicUser } from "@/lib/dao/users";

export function EditUserDialog({
  user,
  resetRequested = false,
  onOpenChange,
}: {
  user: PublicUser;
  resetRequested?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [settingPw, setSettingPw] = useState(false);

  async function setPassword() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSettingPw(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to set password");
        return;
      }
      toast.success("Temporary password set — share it with the user");
      setNewPassword("");
      router.refresh();
    } finally {
      setSettingPw(false);
    }
  }

  const form = useForm<AdminUpdateUserInput>({
    resolver: zodResolver(adminUpdateUserSchema),
    defaultValues: {
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    },
  });

  async function onSubmit(data: AdminUpdateUserInput) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error?.message ?? "Failed to update");
      return;
    }
    toast.success("User updated");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit {user.full_name}</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          {resetRequested ? (
            <p className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
              This user requested a password reset. Set a temporary password
              below and share it with them.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" {...form.register("full_name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) =>
                  form.setValue("role", v as "admin" | "user")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch("is_active") ? "active" : "inactive"}
                onValueChange={(v) =>
                  form.setValue("is_active", v === "active")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
            <Label htmlFor="temp-password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Set temporary password
            </Label>
            <div className="flex items-center gap-2">
              <PasswordInput
                id="temp-password"
                placeholder="Min 8 chars, 1 number"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={setPassword}
                disabled={settingPw || newPassword.length < 8}
              >
                {settingPw ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Set
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The user is signed out of all sessions and must use this password
              to sign in.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
