import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CurrentUser } from "@/lib/auth";

export function SiteHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="glass sticky top-0 z-30 border-b border-border/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Task Portal
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationsBell />
          <div className="mx-1 hidden items-center gap-2 rounded-full border border-border/70 bg-secondary/50 py-1 pl-3 pr-1.5 md:flex">
            <div className="text-right text-xs leading-tight">
              <div className="font-medium">{user.email}</div>
              <div className="capitalize text-muted-foreground">{user.role}</div>
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
              {user.email.charAt(0)}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
