import { requireUser } from "@/lib/auth";
import { dayCounts } from "@/lib/dao/tasks";
import { todayIso } from "@/lib/date";
import { CalendarShell } from "./calendar-shell";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

type SP = { month?: string };

/** Parse YYYY-MM into { year, month } (month is 1-12). Defaults to today. */
function parseMonth(input?: string): { year: number; month: number } {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y!, month: m! };
  }
  const t = new Date();
  return { year: t.getFullYear(), month: t.getMonth() + 1 };
}

/** Build the 6×7 grid (42 days) covering the given month, starting on Sunday. */
function buildGrid(year: number, month: number): string[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const dow = firstOfMonth.getUTCDay(); // 0 = Sun
  const start = new Date(firstOfMonth);
  start.setUTCDate(firstOfMonth.getUTCDate() - dow);

  const out: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requireUser();
  const { year, month } = parseMonth(searchParams.month);
  const grid = buildGrid(year, month);
  const from = grid[0]!;
  const to = grid[grid.length - 1]!;

  const counts = await dayCounts(me.userId, me.role, from, to);
  const today = todayIso();

  // Prev / next month strings
  const prevDate = new Date(Date.UTC(year, month - 2, 1));
  const nextDate = new Date(Date.UTC(year, month, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(
    prevDate.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const nextMonth = `${nextDate.getUTCFullYear()}-${String(
    nextDate.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const thisMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  return (
    <CalendarShell
      year={year}
      month={month}
      grid={grid}
      counts={counts}
      today={today}
      monthLabel={monthLabel}
      prevMonth={prevMonth}
      nextMonth={nextMonth}
      thisMonth={thisMonth}
    />
  );
}
