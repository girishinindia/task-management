"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import type { PublicUser } from "@/lib/dao/users";
import { localDate, todayIso } from "@/lib/date";

interface DateRow {
  id: number;
  user_id: string;
  date: string;
  is_active: boolean;
  note: string | null;
}

const today = todayIso;

export function DateActivationDialog({
  user,
  onOpenChange,
}: {
  user: PublicUser;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<"active" | "inactive">("inactive");
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/date-status`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch {
      toast.error("Failed to load date overrides");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!date) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/date-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          is_active: status === "active",
          note: note || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message ?? "Failed to save");
        return;
      }
      setNote("");
      await load();
      toast.success("Date override saved");
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: string) {
    const res = await fetch(`/api/admin/users/${user.id}/date-status`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: d }),
    });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    await load();
    toast.success("Override removed");
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Date activation — {user.full_name}</DialogTitle>
          <DialogDescription>
            Mark specific dates as active or inactive for this user. By
            default, every date is active. Inactive dates block new
            assignments on that day.
          </DialogDescription>
        </DialogHeader>

        {/* Add form */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-[160px_140px_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "inactive")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="e.g. Annual leave"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={saving || !date}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Existing overrides */}
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No date overrides yet — this user is active by default.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {format(localDate(r.date), "PP")}
                    </td>
                    <td className="px-3 py-2">
                      {r.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="muted">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.note ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(r.date)}
                        aria-label="Remove override"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
