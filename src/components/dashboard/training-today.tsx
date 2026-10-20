import Link from "next/link";
import { ArrowRight, Check, Dumbbell, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { RECORD_LABEL } from "@/features/workout/records";
import { formatPace } from "@/lib/calculations/workout";
import { formatInt } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { RecentPR, TodayWorkout } from "@/features/dashboard/get-daily-dashboard";

export function TrainingToday({ workout, pr, today }: { workout: TodayWorkout; pr: RecentPR | null; today: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Workout</CardTitle>
        <Dumbbell className="size-5 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {workout.state === "done" ? (
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-fiber text-background"><Check className="size-5" aria-hidden="true" /></span>
            <div>
              <p className="font-display text-xl font-semibold">{workout.name} ✓</p>
              <Link href={`/workout/session/${workout.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                {workout.volumeKg ? `${formatInt(workout.volumeKg)} kg volume · ` : ""}View summary
              </Link>
            </div>
          </div>
        ) : workout.state === "active" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">In progress</p>
              <p className="font-display text-xl font-semibold">{workout.name}</p>
            </div>
            <Link href={`/workout/session/${workout.id}`} className={cn(buttonVariants())}>Resume <ArrowRight /></Link>
          </div>
        ) : workout.state === "scheduled" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled today</p>
              <p className="font-display text-xl font-semibold">{workout.name}</p>
            </div>
            <StartWorkoutButton date={today} planId={workout.planId} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
            <StartWorkoutButton date={today} label="Empty workout" variant="secondary" size="sm" />
          </div>
        )}

        {pr ? (
          <p className="tabular flex items-center gap-2 border-t pt-3 text-sm">
            <Trophy className="size-4 shrink-0 text-carbs" aria-hidden="true" />
            <span className="text-muted-foreground">Latest record:</span>
            <span className="font-medium">
              {pr.name} · {RECORD_LABEL[pr.record_type] ?? pr.record_type} {pr.record_type === "fastest_time" ? formatPace(pr.value) : `${pr.value} ${pr.unit}`}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
