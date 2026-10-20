import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getCalendar } from "@/features/calendar/service";
import { CALENDAR_KINDS, MonthGrid } from "@/components/calendar/month-grid";
import { DayDetail } from "@/components/calendar/day-detail";
import { buttonVariants } from "@/components/ui/button";
import { isMonthKey, monthOf, shiftMonth } from "@/lib/calendar/grid";
import { isoDate } from "@/lib/validations/nutrition";
import { todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const sp = await searchParams;

  const thisMonth = monthOf(today);
  const requested = isMonthKey(sp.month) && sp.month >= "2000-01" && sp.month <= shiftMonth(thisMonth, 12) ? sp.month : thisMonth;
  const parsedDate = isoDate.safeParse(sp.date);
  const selected = parsedDate.success && monthOf(parsedDate.data) === requested ? parsedDate.data : requested === thisMonth ? today : null;

  const weekStartsOn = settings?.week_starts_on ?? 1;
  const { weeks, days } = await getCalendar(requested, weekStartsOn);
  const title = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${requested}-15T12:00:00Z`));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-3xl font-bold md:text-4xl">{title}</h1>
        <Link href={`/calendar?month=${shiftMonth(requested, -1)}`} aria-label="Previous month" className={cn(buttonVariants({ variant: "outline", size: "icon" }))}><ChevronLeft /></Link>
        {requested !== thisMonth ? <Link href="/calendar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Today</Link> : null}
        <Link href={`/calendar?month=${shiftMonth(requested, 1)}`} aria-label="Next month" className={cn(buttonVariants({ variant: "outline", size: "icon" }))}><ChevronRight /></Link>
      </header>

      <MonthGrid weeks={weeks} days={days} month={requested} today={today} selected={selected} weekStartsOn={weekStartsOn} />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {CALENDAR_KINDS.map((k) => <li key={k.key} className="flex items-center gap-1"><k.icon className="size-3.5 text-primary" aria-hidden="true" /> {k.label}</li>)}
      </ul>

      {selected ? <DayDetail date={selected} day={days.get(selected)} isToday={selected === today} /> : <p className="text-sm text-muted-foreground">Select a day to see everything you logged.</p>}
    </div>
  );
}
