import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { plansScheduledFor } from "@/features/workout/plans";
import { countCompletedSince, getActiveSession, listHistory } from "@/features/workout/sessions";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDuration, formatInt } from "@/utils/format";
import { startOfWeek, todayInTimeZone, weekdayOf } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutOverviewPage() {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile || !settings) return <p role="status">Your profile is still being created. Refresh in a few seconds.</p>;

  const today = todayInTimeZone(profile.timezone);
  const weekStart = startOfWeek(today, settings.week_starts_on);
  const [active, scheduled, recent, doneThisWeek] = await Promise.all([getActiveSession(), plansScheduledFor(weekdayOf(today)), listHistory(1, 3), countCompletedSince(weekStart)]);
  const target = settings.weekly_workout_target;

  return (
    <div className="flex flex-col gap-6">
      {active ? (
        <Card className="border-primary/50 bg-accent">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-accent-foreground">In progress</p>
              <p className="font-display text-xl font-semibold">{active.name}</p>
            </div>
            <Link href={`/workout/session/${active.id}`} className={cn(buttonVariants())}>
              Resume <ArrowRight />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {scheduled.length > 0 ? (
              scheduled.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Scheduled for today</p>
                  </div>
                  <StartWorkoutButton date={today} planId={p.id} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled today. Pick a plan or start an empty workout.</p>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <StartWorkoutButton date={today} label="Empty workout" variant="secondary" />
              <Link href="/workout/start" className={cn(buttonVariants({ variant: "outline" }))}>
                <Play /> Choose a plan
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="tabular font-display text-3xl font-bold leading-none">
            {doneThisWeek}
            <span className="ml-2 text-base font-medium text-muted-foreground">/ {target} workouts</span>
          </p>
          <ProgressBar value={doneThisWeek} max={Math.max(target, 1)} label="Workouts this week" />
        </CardContent>
      </Card>

      <section aria-labelledby="recent-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent-h" className="text-lg font-semibold">Recent workouts</h2>
          <Link href="/workout/history" className="text-sm font-medium text-primary underline-offset-4 hover:underline">All history</Link>
        </div>
        {recent.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Finished workouts show up here.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {recent.items.map((s) => (
              <li key={s.id}>
                <Link href={`/workout/session/${s.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-accent/50">
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="tabular text-xs text-muted-foreground">{s.logged_on} · {s.exercise_count} exercises{s.total_volume_kg ? ` · ${formatInt(s.total_volume_kg)} kg` : ""}</span>
                  </span>
                  {s.ended_at ? <span className="tabular text-xs text-muted-foreground">{formatDuration((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
