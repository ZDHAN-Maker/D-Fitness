import Link from "next/link";
import { Flame, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { goalPace, goalProgressPct } from "@/lib/calculations/goals";
import { formatGoalValue } from "@/lib/goals/format";
import { cn } from "@/lib/utils";
import type { GoalItem } from "@/features/goals/service";
import type { StreakItem } from "@/features/achievements/service";

const LABEL: Record<StreakItem["type"], string> = { workout: "Workout", nutrition: "Food log", hydration: "Hydration", habit: "Daily habit" };

export function GoalsToday({ goals, streaks, today }: { goals: GoalItem[]; streaks: StreakItem[]; today: string }) {
  // Nearest deadline first (goals with no deadline last), top three.
  const top = [...goals].sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999")).slice(0, 3);
  const live = streaks.filter((s) => s.current > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Goals &amp; streaks</CardTitle>
        <Link href="/goals" className="text-sm font-medium text-primary underline-offset-4 hover:underline">All goals</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {top.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="size-4" aria-hidden="true" /> No active goals. <Link href="/goals/new" className="font-medium text-primary underline-offset-4 hover:underline">Set one</Link></p>
        ) : (
          <ul className="flex flex-col gap-3">
            {top.map((g) => {
              const pct = goalProgressPct(g);
              const pace = goalPace(g, today);
              return (
                <li key={g.id}>
                  <Link href={`/goals/${g.id}`} className="block">
                    <p className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{g.title}</span>
                      <span className="tabular shrink-0 text-muted-foreground">{formatGoalValue(g.metric, g.current_value, g.unit)} → {formatGoalValue(g.metric, g.target_value, g.unit)}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <ProgressBar className="flex-1" value={pct} max={100} colorClass={pace === "behind" || pace === "overdue" ? "bg-fat" : "bg-primary"} label={`${g.title} progress`} />
                      <span className="tabular w-10 text-right text-sm font-semibold">{pct}%</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <ul className="flex flex-wrap gap-2 border-t pt-3" aria-label="Streaks">
          {live.length === 0 ? (
            <li className="text-sm text-muted-foreground">Log a workout, a meal or some water today to start a streak.</li>
          ) : (
            live.map((s) => (
              <li key={s.type} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", s.state === "at_risk" ? "border-carbs/50 bg-carbs/10" : "bg-card")}>
                <Flame className="size-4 text-carbs" aria-hidden="true" />
                <span className="tabular font-semibold">{s.current}</span>
                <span className="text-muted-foreground">{LABEL[s.type]}</span>
                {s.state === "at_risk" ? <span className="text-xs text-carbs">· keep it today</span> : null}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
