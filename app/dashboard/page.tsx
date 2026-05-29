import Link from "next/link";
import { CalendarDays, ListTodo, AlertOctagon, CheckCheck, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { findUserById } from "@/lib/dao/users";
import { countTasksForUser } from "@/lib/dao/tasks";
import { listRecentActivity } from "@/lib/dao/activity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ActivityFeed } from "./activity-feed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const u = await requireUser();
  const [profile, counts, activity] = await Promise.all([
    findUserById(u.userId),
    countTasksForUser(u.userId, u.role),
    listRecentActivity(u.userId, u.role, 20),
  ]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title={`Welcome back, ${firstName}.`}
        description={
          counts.open === 0
            ? "Nothing on your plate right now — quiet day."
            : `${counts.open} open task${counts.open === 1 ? "" : "s"} on your plate.`
        }
      >
        {u.role === "admin" ? (
          <Button asChild>
            <Link href="/dashboard/tasks/new">
              <Plus className="h-4 w-4" /> New task
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<ListTodo className="h-5 w-5" />}
          label="Open"
          value={counts.open}
          href="/dashboard/tasks?status=pending"
          description="Tasks not yet done or cancelled"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Due today"
          value={counts.due_today}
          href="/dashboard/tasks"
          description="Today's deadline"
        />
        <StatCard
          icon={<AlertOctagon className="h-5 w-5" />}
          label="Overdue"
          value={counts.overdue}
          href="/dashboard/tasks"
          description="Past due, still open"
          danger={counts.overdue > 0}
        />
        <StatCard
          icon={<CheckCheck className="h-5 w-5" />}
          label="Done this week"
          value={counts.done_recently}
          href="/dashboard/tasks?status=done"
          description="Completed in the last 7 days"
        />
      </div>

      <ActivityFeed rows={activity} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  description,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card
        className={`shadow-soft transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-soft-lg ${
          danger ? "border-destructive/30" : "border-brand-100/70"
        }`}
      >
        <CardHeader className="pb-2">
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              danger
                ? "bg-destructive/10 text-destructive"
                : "bg-gradient-to-br from-sky-50 to-sky-100 text-brand-600 ring-1 ring-brand-100"
            }`}
          >
            {icon}
          </div>
          <CardTitle className="pt-2 text-base">{label}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent
          className={`text-3xl font-semibold ${
            danger ? "text-destructive" : ""
          }`}
        >
          {value}
        </CardContent>
      </Card>
    </Link>
  );
}
