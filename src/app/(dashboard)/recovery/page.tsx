import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getDay, listRecovery, lastDays } from "@/features/recovery/service";
import { CheckInForm } from "@/components/recovery/check-in-form";
import { ScoreCard } from "@/components/recovery/score-card";
import { DateNav } from "@/components/nutrition/date-nav";
import { BarsChart, TrendChart } from "@/components/charts/lazy-charts";
import { calculateSleepAverage } from "@/lib/calculations/body";
import { isoDate } from "@/lib/validations/nutrition";
import { addDays, formatLongDate, todayInTimeZone } from "@/utils/date";
import { formatDuration } from "@/utils/format";

export const metadata: Metadata = { title: "Recovery" };

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const parsed = isoDate.safeParse((await searchParams).date);
  const date = parsed.success && parsed.data <= today ? parsed.data : today;
  const { from, to } = lastDays(today, 14);
  const [day, history] = await Promise.all([getDay(date), listRecovery(from, to)]);

  const byDate = new Map(history.map((h) => [h.date, h]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
  const sleepData = days.map((d) => ({ date: d, hours: byDate.get(d)?.sleep ? Math.round((byDate.get(d)!.sleep!.minutes / 60) * 10) / 10 : null }));
  const scoreData = days.map((d) => ({ date: d, score: byDate.get(d)?.score?.score ?? null }));
  const last7 = history.filter((h) => h.date > addDays(today, -7));
  const avgSleep = calculateSleepAverage(last7.flatMap((h) => (h.sleep ? [h.sleep.minutes] : [])));
  const scores = last7.flatMap((h) => (h.score ? [h.score.score] : []));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const targetH = (settings?.sleep_target_minutes ?? 480) / 60;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold md:text-4xl">Recovery</h1>
      <DateNav date={date} today={today} basePath="/recovery" />

      <ScoreCard score={day.score} />

      <CheckInForm
        key={date + (day.sleep?.minutes ?? "") + JSON.stringify(day.recovery ?? {})}
        date={date}
        hasData={Boolean(day.sleep || day.recovery)}
        initial={{ sleepMinutes: day.sleep?.minutes ?? null, sleepQuality: day.sleep?.quality ?? undefined, energy: day.recovery?.energy ?? undefined, stress: day.recovery?.stress ?? undefined, soreness: day.recovery?.soreness ?? undefined, overall: day.recovery?.overall ?? undefined }}
      />

      <section aria-labelledby="trends-h" className="flex flex-col gap-4">
        <h2 id="trends-h" className="text-lg font-semibold">Last 14 days</h2>
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{avgSleep ? formatDuration(avgSleep) : "–"}</dd><dt className="text-xs text-muted-foreground">Average sleep (7 days)</dt></div>
          <div className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{avgScore ?? "–"}</dd><dt className="text-xs text-muted-foreground">Average recovery (7 days)</dt></div>
        </dl>
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-1 px-1 text-sm font-medium">Sleep (hours)</p>
          <BarsChart data={sleepData} xKey="date" unit="h" ariaLabel="Hours slept per night over the last 14 days" reference={{ y: targetH, label: `target ${targetH}h` }} bars={[{ key: "hours", label: "Sleep", color: "hsl(var(--primary))" }]} />
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-1 px-1 text-sm font-medium">Recovery score</p>
          <TrendChart data={scoreData} xKey="date" unit="/100" ariaLabel="Recovery score over the last 14 days" yDomain={[0, 100]} lines={[{ key: "score", label: "Recovery", color: "hsl(var(--fiber))" }]} />
        </div>
      </section>
    </div>
  );
}
