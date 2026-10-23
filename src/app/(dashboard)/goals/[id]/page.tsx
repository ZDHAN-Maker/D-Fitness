import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { z } from "zod";
import { GoalStatusControls, ManualProgressForm } from "@/components/goals/goal-controls";
import { TrendChart } from "@/components/charts/lazy-charts";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getGoal, trySyncProgress } from "@/features/goals/service";
import { PACE_LABEL, daysLeft, goalPace, goalProgressPct } from "@/lib/calculations/goals";
import { formatGoalValue } from "@/lib/goals/format";
import { formatLongDate, todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goal" };
const short = (iso: string) => formatLongDate(iso).replace(/^\w+, /, "");

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  await trySyncProgress(today);
  const goal = await getGoal(id.data);
  if (!goal) notFound();

  const pct = goalProgressPct(goal);
  const pace = goalPace(goal, today);
  const left = daysLeft(goal.target_date, today);
  const fmt = (v: number | null) => formatGoalValue(goal.metric, v, goal.unit);
  const chart = goal.history.map((h) => ({ date: h.date, value: h.value }));

  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{value}</dd><dt className="text-xs text-muted-foreground">{label}</dt></div>
  );

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/goals" className="flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" /> Goals</Link>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{goal.title}</h1>
          <Link href={`/goals/${goal.id}/edit`} aria-label="Edit goal" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}><Pencil /></Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{goal.goal_type}</Badge>
          {goal.exercise_name ? <Badge variant="muted">{goal.exercise_name}</Badge> : null}
          {goal.status !== "active" ? <Badge variant="outline">{goal.status === "completed" ? "Reached" : goal.status === "paused" ? "Paused" : "Stopped"}</Badge> : <Badge variant="outline">{PACE_LABEL[pace]}</Badge>}
        </div>
      </header>

      <div className="rounded-lg border bg-card p-5">
        <p className="tabular font-display text-5xl font-bold leading-none">{pct}%</p>
        <ProgressBar className="mt-4 h-3" value={pct} max={100} colorClass={pace === "behind" || pace === "overdue" ? "bg-fat" : pace === "done" || pace === "ahead" ? "bg-fiber" : "bg-primary"} label="Goal progress" />
        <p className="tabular mt-3 text-sm">
          <span className="font-semibold">{fmt(goal.current_value)}</span> <span className="text-muted-foreground">now · started at {fmt(goal.start_value)} · target {fmt(goal.target_value)}</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Started", short(goal.start_date))}
        {stat("Target date", goal.target_date ? short(goal.target_date) : "None")}
        {stat("Days left", left === null ? "–" : left < 0 ? "Past due" : String(left))}
        {stat("Tracking", goal.metric === "custom" ? "By hand" : "Automatic")}
      </dl>
      {goal.metric === "run_time_min" && goal.config.distance_km ? <p className="text-xs text-muted-foreground">Estimated from the pace of your runs of at least {goal.config.distance_km} km.</p> : null}

      {goal.metric === "custom" && goal.status === "active" ? <ManualProgressForm goalId={goal.id} today={today} unit={goal.unit} /> : null}

      <section aria-labelledby="hist-h" className="flex flex-col gap-2">
        <h2 id="hist-h" className="text-lg font-semibold">Progress history</h2>
        {chart.length < 2 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">The chart appears once there are two or more days of progress.</p>
        ) : (
          <div className="rounded-lg border bg-card p-3">
            <TrendChart data={chart} xKey="date" unit={goal.unit ?? ""} ariaLabel={`${goal.title}: progress over time`} yDomain={["dataMin", "dataMax"]} reference={{ y: goal.target_value, label: "target" }} lines={[{ key: "value", label: goal.title, color: "hsl(var(--primary))" }]} />
          </div>
        )}
      </section>

      <GoalStatusControls id={goal.id} status={goal.status} />
    </article>
  );
}
