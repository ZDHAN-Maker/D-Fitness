import Link from "next/link";
import { Check, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PACE_LABEL, daysLeft, goalPace, goalProgressPct } from "@/lib/calculations/goals";
import { formatGoalValue } from "@/lib/goals/format";
import { cn } from "@/lib/utils";
import type { GoalItem } from "@/features/goals/service";

const PACE_COLOR = { ahead: "text-fiber", on_track: "text-primary", behind: "text-fat", overdue: "text-fat", no_deadline: "text-muted-foreground", done: "text-fiber" } as const;
const BAR = { ahead: "bg-fiber", on_track: "bg-primary", behind: "bg-fat", overdue: "bg-fat", no_deadline: "bg-primary", done: "bg-fiber" } as const;

export function GoalCard({ goal, today }: { goal: GoalItem; today: string }) {
  const pct = goalProgressPct(goal);
  const pace = goalPace(goal, today);
  const left = daysLeft(goal.target_date, today);
  const inactive = goal.status === "paused" || goal.status === "abandoned";

  return (
    <Link href={`/goals/${goal.id}`} className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40", inactive && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{goal.title}</p>
          <p className="text-xs text-muted-foreground">{goal.exercise_name ? `${goal.exercise_name} · ` : ""}{goal.goal_type}</p>
        </div>
        {goal.status === "completed" ? (
          <Badge className="gap-1"><Check className="size-3" aria-hidden="true" /> Reached</Badge>
        ) : goal.status === "paused" ? (
          <Badge variant="muted" className="gap-1"><Pause className="size-3" aria-hidden="true" /> Paused</Badge>
        ) : goal.status === "abandoned" ? (
          <Badge variant="muted">Stopped</Badge>
        ) : (
          <span className="tabular font-display text-2xl font-bold leading-none">{pct}%</span>
        )}
      </div>

      <ProgressBar value={pct} max={100} colorClass={BAR[pace]} label={`${goal.title} progress`} />

      <p className="tabular flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span>
          <span className="font-medium">{formatGoalValue(goal.metric, goal.current_value, goal.unit)}</span>
          <span className="text-muted-foreground"> → {formatGoalValue(goal.metric, goal.target_value, goal.unit)}</span>
        </span>
        {goal.status === "active" ? (
          <span className={cn("text-xs", PACE_COLOR[pace])}>
            {PACE_LABEL[pace]}
            {left !== null && left >= 0 ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}
          </span>
        ) : null}
      </p>
    </Link>
  );
}
