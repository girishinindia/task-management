"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  FolderKanban,
  History,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Sun,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
  adminOnly?: boolean;
}

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/dashboard/today",
    label: "Today",
    icon: <Sun className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/today"),
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: <CalendarDays className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/calendar"),
  },
  {
    href: "/dashboard/tasks",
    label: "All tasks",
    icon: <ListTodo className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/tasks"),
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    icon: <FolderKanban className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/projects"),
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/analytics"),
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/notifications"),
  },
  {
    href: "/dashboard/activity",
    label: "My activity",
    icon: <History className="h-4 w-4" />,
    match: (p) => p.startsWith("/dashboard/activity"),
  },
  {
    href: "/admin/users",
    label: "Admin",
    icon: <Shield className="h-4 w-4" />,
    match: (p) => p.startsWith("/admin/users"),
    adminOnly: true,
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: <ScrollText className="h-4 w-4" />,
    match: (p) => p.startsWith("/admin/audit"),
    adminOnly: true,
  },
];

export interface DashboardSidebarProps {
  role: "admin" | "user";
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname() ?? "/dashboard";
  const items = ITEMS.filter((i) => !i.adminOnly || role === "admin");

  return (
    <aside
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm md:flex",
        "w-16 lg:w-60",
        "flex-col"
      )}
    >
      <div className="hidden px-4 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:block">
        Menu
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2 lg:px-3">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              // Don't prefetch every section on load — each prefetch is a full
              // server render that opens DB connections; firing them all at once
              // strains a shared, connection-limited database.
              prefetch={false}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-all lg:px-3",
                active
                  ? "bg-secondary text-secondary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {active ? (
                <span className="absolute inset-y-1.5 left-0 hidden w-1 rounded-full bg-primary lg:block" />
              ) : null}
              <span
                className={cn(
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-transparent text-current group-hover:bg-background/70"
                )}
              >
                {it.icon}
              </span>
              <span className="hidden lg:inline">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-4 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="hidden lg:inline">© Task Portal</span>
        <span className="lg:hidden">·</span>
      </div>
    </aside>
  );
}
