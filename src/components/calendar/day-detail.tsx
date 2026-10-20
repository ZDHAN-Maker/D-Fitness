import Link from "next/link";
import { Activity, Dumbbell, Droplets, HeartPulse, Moon, Scale, Utensils, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate } from "@/utils/date";
import { formatDuration, formatInt, formatWater } from "@/utils/format";
import type { CalendarDay } from "@/features/calendar/service";

function Row({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: string; href?: string }) {
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="tabular min-w-0 flex-1 text-sm font-medium">{value}</span>
    </>
  );
  return href ? <Link href={href} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent/50">{body}</Link> : <div className="flex items-center gap-3 px-1 py-2">{body}</div>;
}

export function DayDetail({ date, day, isToday }: { date: string; day: CalendarDay | undefined; isToday: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>{formatLongDate(date)}{isToday ? " · Today" : ""}</CardTitle></CardHeader>
      <CardContent className="flex flex-col divide-y">
        {day ? (
          <>
            {day.workouts.length ? <Row icon={Dumbbell} label="Workout" value={day.workouts.join(", ")} href="/workout/history" /> : null}
            {day.activities.length ? <Row icon={Activity} label="Activity" value={day.activities.join(", ")} href="/activity" /> : null}
            {day.kcal !== null ? <Row icon={Utensils} label="Nutrition" value={`${formatInt(day.kcal)} kcal`} href={`/nutrition?date=${date}`} /> : null}
            {day.waterMl !== null ? <Row icon={Droplets} label="Water" value={formatWater(day.waterMl)} href={isToday ? "/hydration" : undefined} /> : null}
            {day.sleepMinutes !== null ? <Row icon={Moon} label="Sleep" value={formatDuration(day.sleepMinutes)} href={`/recovery?date=${date}`} /> : null}
            {day.weightKg !== null ? <Row icon={Scale} label="Weight" value={`${day.weightKg} kg`} href="/body/weight" /> : null}
            {day.recoveryScore !== null ? <Row icon={HeartPulse} label="Recovery" value={`${Math.round(day.recoveryScore)} / 100`} href={`/recovery?date=${date}`} /> : null}
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Nothing logged on this day.</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm">
          <Link href={`/nutrition/log?date=${date}`} className="font-medium text-primary underline-offset-4 hover:underline">Add food</Link>
          <Link href={`/recovery?date=${date}`} className="font-medium text-primary underline-offset-4 hover:underline">Sleep &amp; recovery</Link>
        </div>
      </CardContent>
    </Card>
  );
}
