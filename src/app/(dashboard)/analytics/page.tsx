import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsNav, type AnalyticsTab } from "@/components/analytics/analytics-nav";
import { Empty, HBarList, MacroSplit, Panel, StatGrid } from "@/components/analytics/widgets";
import { BarsChart, TrendChart } from "@/components/charts/lazy-charts";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getExerciseProgression, getNutritionAnalytics, getPRTimeline, getWorkoutAnalytics } from "@/features/analytics/service";
import { listRecovery } from "@/features/recovery/service";
import { recentTotals } from "@/features/hydration/service";
import { listWeights } from "@/features/body/service";
import { RANGE_DAYS, average, consistencyPct, macroDistribution, summarizeNutrition, weeksOnTarget, zeroFillWeeks, type AnalyticsRange } from "@/lib/calculations/analytics";
import { calculateMovingAverage, calculateTrend, formatSigned } from "@/lib/calculations/body";
import { addDays, todayInTimeZone } from "@/utils/date";
import { formatDuration, formatInt, formatWater } from "@/utils/format";
import type { UserSettings } from "@/types/domain";

export const metadata: Metadata = { title: "Analytics" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Ctx = { from: string; to: string; days: number; settings: UserSettings; exercise?: number };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ tab?: string; range?: string; exercise?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile || !settings) return <p role="status">Your profile is still being created. Refresh in a few seconds.</p>;

  const sp = await searchParams;
  const tab: AnalyticsTab = sp.tab === "nutrition" || sp.tab === "lifestyle" ? sp.tab : "workout";
  const range: AnalyticsRange = sp.range === "30d" || sp.range === "180d" ? sp.range : "90d";
  const days = RANGE_DAYS[range];
  const to = todayInTimeZone(profile.timezone);
  const ctx: Ctx = { from: addDays(to, -(days - 1)), to, days, settings, exercise: Number.parseInt(sp.exercise ?? "", 10) || undefined };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-bold md:text-4xl">Analytics</h1>
      <AnalyticsNav tab={tab} range={range} />
      {/* Only the active tab's data is fetched. */}
      {tab === "workout" ? <WorkoutTab {...ctx} range={range} /> : tab === "nutrition" ? <NutritionTab {...ctx} /> : <LifestyleTab {...ctx} />}
    </div>
  );
}

async function WorkoutTab({ from, to, settings, exercise, range }: Ctx & { range: AnalyticsRange }) {
  const wa = await getWorkoutAnalytics(from, to, settings.week_starts_on);
  const weekly = zeroFillWeeks(wa.weekly, from, to, settings.week_starts_on);
  const total = weekly.reduce((a, w) => a + w.workouts, 0);
  if (total === 0) return <Empty>No finished workouts in this period yet. Complete a workout and its frequency, volume and muscle balance show up here.</Empty>;

  const volume = weekly.reduce((a, w) => a + w.volume_kg, 0);
  const target = settings.weekly_workout_target;
  const hit = weeksOnTarget(weekly, target);
  const setsTotal = wa.muscles.reduce((a, m) => a + m.sets, 0);
  const selected = exercise ?? wa.topExercises[0]?.exerciseId;
  const [progress, prs] = selected ? await Promise.all([getExerciseProgression(selected), getPRTimeline(selected)]) : [[], []];
  const selectedName = wa.topExercises.find((e) => e.exerciseId === selected)?.name ?? "Exercise";

  return (
    <div className="flex flex-col gap-4">
      <StatGrid stats={[
        { label: "Workouts", value: String(total), sub: `${range.replace("d", " days").replace("180 days", "6 months")}` },
        { label: "Per week", value: String(Math.round((total / weekly.length) * 10) / 10), sub: `target ${target}` },
        { label: "Total volume", value: `${formatInt(volume)} kg` },
        { label: "Weeks on target", value: `${hit.hit} / ${hit.total}` },
      ]} />
      <Panel title="Workout frequency" note="Workouts per week. The first and last bars may be partial weeks.">
        <BarsChart data={weekly.map((w) => ({ date: w.week, workouts: w.workouts }))} xKey="date" unit="workouts" ariaLabel="Workouts per week" reference={target > 0 ? { y: target, label: `target ${target}` } : undefined} bars={[{ key: "workouts", label: "Workouts", color: "hsl(var(--primary))" }]} />
      </Panel>
      <Panel title="Training volume" note="Total weight lifted (sets × reps × kg), per week.">
        <BarsChart data={weekly.map((w) => ({ date: w.week, volume: Math.round(w.volume_kg) }))} xKey="date" unit="kg" ariaLabel="Training volume per week" bars={[{ key: "volume", label: "Volume", color: "hsl(var(--protein))" }]} />
      </Panel>
      <Panel title="Muscle distribution" note="Share of your finished working sets by primary muscle.">
        <HBarList rows={wa.muscles.map((m) => ({ label: cap(m.muscle), value: m.sets, display: `${Math.round((m.sets / Math.max(setsTotal, 1)) * 100)}%` }))} />
      </Panel>

      {wa.topExercises.length ? (
        <Panel title="Exercise progression" note="Estimated 1RM from your top working set each session.">
          <ul className="mb-3 flex flex-wrap gap-2" aria-label="Choose an exercise">
            {wa.topExercises.map((e) => (
              <li key={e.exerciseId}>
                <Link href={`/analytics?tab=workout&range=${range}&exercise=${e.exerciseId}`} aria-current={e.exerciseId === selected ? "true" : undefined} className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium ${e.exerciseId === selected ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"}`}>
                  {e.name} <span className="ml-1.5 text-xs opacity-70">{e.sessions}×</span>
                </Link>
              </li>
            ))}
          </ul>
          {progress.length >= 2 ? (
            <TrendChart data={progress.map((p) => ({ date: p.date, e1rm: p.e1rm }))} xKey="date" unit="kg" ariaLabel={`${selectedName}: estimated one-rep max per session`} yDomain={["dataMin", "dataMax"]} lines={[{ key: "e1rm", label: "Estimated 1RM", color: "hsl(var(--primary))" }]} />
          ) : <p className="text-sm text-muted-foreground">Log {selectedName} in at least two workouts to see progression.</p>}
          {prs.length >= 2 ? (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium">PR progression</p>
              <TrendChart height={180} data={prs.map((p) => ({ date: p.date, pr: p.value }))} xKey="date" unit="kg" ariaLabel={`${selectedName}: personal record history`} yDomain={["dataMin", "dataMax"]} lines={[{ key: "pr", label: "1RM record", color: "hsl(var(--carbs))" }]} />
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

async function NutritionTab({ from, to, days, settings }: Ctx) {
  const na = await getNutritionAnalytics(from, to);
  const summary = summarizeNutrition(na.daily);
  if (!summary) return <Empty>No food logged in this period yet. Log meals and your averages, macro split and most-eaten foods appear here.</Empty>;

  const dist = macroDistribution(summary);
  const consistency = consistencyPct(summary.daysLogged, days);

  return (
    <div className="flex flex-col gap-4">
      <StatGrid stats={[
        { label: "Avg calories", value: `${formatInt(summary.calories)}`, sub: `target ${formatInt(settings.calorie_target)}` },
        { label: "Avg protein", value: `${summary.protein_g} g`, sub: `target ${settings.protein_target_g} g` },
        { label: "Days logged", value: `${summary.daysLogged} / ${days}` },
        { label: "Consistency", value: `${consistency}%` },
      ]} />
      <p className="-mt-2 text-xs text-muted-foreground">Averages cover only the days you logged food; a day without logs is unknown, not zero.</p>

      <Panel title="Calories per day">
        <TrendChart data={na.daily.map((d) => ({ date: d.date, kcal: Math.round(d.calories) }))} xKey="date" unit="kcal" ariaLabel="Calories logged per day" reference={{ y: settings.calorie_target, label: `target ${formatInt(settings.calorie_target)}` }} lines={[{ key: "kcal", label: "Calories", color: "hsl(var(--primary))" }]} />
      </Panel>
      <Panel title="Protein per day">
        <TrendChart data={na.daily.map((d) => ({ date: d.date, protein: Math.round(d.protein_g) }))} xKey="date" unit="g" ariaLabel="Protein logged per day" reference={{ y: settings.protein_target_g, label: `target ${settings.protein_target_g} g` }} lines={[{ key: "protein", label: "Protein", color: "hsl(var(--protein))" }]} />
      </Panel>
      {dist ? (
        <Panel title="Macro distribution" note={`Where your calories come from, on average (${summary.protein_g} g protein · ${summary.carbs_g} g carbs · ${summary.fat_g} g fat per day).`}>
          <MacroSplit {...dist} />
        </Panel>
      ) : null}
      <Panel title="Most eaten foods" note="By number of times logged.">
        <HBarList colorClass="bg-carbs" rows={na.topFoods.map((f) => ({ label: f.name, value: f.count, display: `${f.count}×` }))} />
      </Panel>
    </div>
  );
}

async function LifestyleTab({ from, to, days, settings }: Ctx) {
  const [recovery, water, weights, wa] = await Promise.all([
    listRecovery(from, to),
    recentTotals(to, days),
    listWeights(from),
    getWorkoutAnalytics(from, to, settings.week_starts_on),
  ]);

  const sleepMins = recovery.flatMap((r) => (r.sleep ? [r.sleep.minutes] : []));
  const scores = recovery.flatMap((r) => (r.score ? [r.score.score] : []));
  const waterDays = water.filter((d) => d.totalMl > 0);
  const avgSleep = average(sleepMins);
  const avgWater = average(waterDays.map((d) => d.totalMl));
  const avgRecovery = average(scores);
  const weekly = zeroFillWeeks(wa.weekly, from, to, settings.week_starts_on);
  const hit = weeksOnTarget(weekly, settings.weekly_workout_target);
  const wSeries = weights.map((w) => ({ date: w.date, value: w.weightKg }));
  const wTrend = calculateTrend(wSeries);
  const wAvg = calculateMovingAverage(wSeries, 7);

  const nothing = sleepMins.length === 0 && waterDays.length === 0 && scores.length === 0 && weights.length === 0;
  if (nothing) return <Empty>Log sleep, water, recovery or weight and your averages and trends appear here.</Empty>;

  const sleepByDate = new Map(recovery.map((r) => [r.date, r.sleep ? Math.round((r.sleep.minutes / 60) * 10) / 10 : null]));
  const scoreByDate = new Map(recovery.map((r) => [r.date, r.score?.score ?? null]));
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));

  return (
    <div className="flex flex-col gap-4">
      <StatGrid stats={[
        { label: "Avg sleep", value: avgSleep ? formatDuration(avgSleep) : "–", sub: `target ${formatDuration(settings.sleep_target_minutes)}` },
        { label: "Avg water", value: avgWater ? formatWater(Math.round(avgWater)) : "–", sub: `target ${formatWater(settings.water_target_ml)}` },
        { label: "Avg recovery", value: avgRecovery !== null ? String(Math.round(avgRecovery)) : "–", sub: "out of 100" },
        { label: "Workout weeks on target", value: `${hit.hit} / ${hit.total}`, sub: `${settings.weekly_workout_target} per week` },
      ]} />
      <p className="-mt-2 text-xs text-muted-foreground">Averages cover days with data only.</p>

      {weights.length ? (
        <Panel title="Weight trend" note={wTrend ? `${formatSigned(wTrend.change)} kg over ${wTrend.days} days` : "Add another weigh-in to see the change."}>
          <TrendChart data={weights.map((w, i) => ({ date: w.date, weight: w.weightKg, average: wAvg[i]!.value }))} xKey="date" unit="kg" ariaLabel="Weight over the selected period" yDomain={["dataMin", "dataMax"]} lines={[{ key: "weight", label: "Weight", color: "hsl(var(--muted-foreground))" }, { key: "average", label: "7-entry average", color: "hsl(var(--primary))" }]} />
        </Panel>
      ) : null}
      {sleepMins.length ? (
        <Panel title="Sleep">
          <BarsChart data={dates.map((d) => ({ date: d, hours: sleepByDate.get(d) ?? null }))} xKey="date" unit="h" ariaLabel="Hours slept per night" reference={{ y: settings.sleep_target_minutes / 60, label: `target ${settings.sleep_target_minutes / 60}h` }} bars={[{ key: "hours", label: "Sleep", color: "hsl(var(--primary))" }]} />
        </Panel>
      ) : null}
      {waterDays.length ? (
        <Panel title="Water">
          <BarsChart data={water.map((d) => ({ date: d.date, ml: d.totalMl }))} xKey="date" unit="ml" ariaLabel="Water intake per day" reference={{ y: settings.water_target_ml, label: `target ${formatWater(settings.water_target_ml)}` }} bars={[{ key: "ml", label: "Water", color: "hsl(var(--water))" }]} />
        </Panel>
      ) : null}
      {scores.length ? (
        <Panel title="Recovery score">
          <TrendChart data={dates.map((d) => ({ date: d, score: scoreByDate.get(d) ?? null }))} xKey="date" unit="/100" ariaLabel="Recovery score over time" yDomain={[0, 100]} lines={[{ key: "score", label: "Recovery", color: "hsl(var(--fiber))" }]} />
        </Panel>
      ) : null}
    </div>
  );
}
