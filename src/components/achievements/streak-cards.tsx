import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreakItem } from "@/features/achievements/service";

const META: Record<StreakItem["type"], { label: string; help: string }> = {
  workout: { label: "Workout", help: "Days in a row you trained" },
  nutrition: { label: "Food logging", help: "Days in a row you logged food" },
  hydration: { label: "Hydration", help: "Days in a row you hit your water target" },
  habit: { label: "Daily habit", help: "Days in a row you tracked anything" },
};

const STATE = {
  done_today: { text: "Done today", cls: "text-fiber" },
  at_risk: { text: "Do it today to keep it", cls: "text-carbs" },
  broken: { text: "Start again today", cls: "text-muted-foreground" },
  none: { text: "Not started", cls: "text-muted-foreground" },
} as const;

export function StreakCards({ streaks }: { streaks: StreakItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {streaks.map((s) => {
        const m = META[s.type];
        const st = STATE[s.state];
        return (
          <li key={s.type} className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Flame className={cn("size-4", s.current > 0 ? "text-carbs" : "")} aria-hidden="true" /> {m.label}
            </p>
            <p className="tabular mt-1 font-display text-4xl font-bold leading-none">{s.current}<span className="ml-1 text-sm font-medium text-muted-foreground">{s.current === 1 ? "day" : "days"}</span></p>
            <p className={cn("mt-1 text-xs font-medium", st.cls)}>{st.text}</p>
            <p className="tabular mt-2 text-xs text-muted-foreground">Longest: {s.longest}</p>
            <p className="sr-only">{m.help}</p>
          </li>
        );
      })}
    </ul>
  );
}
