import Link from "next/link";
import { Activity, Dumbbell, Droplets, HeartPulse, Moon, Scale, Utensils } from "lucide-react";
import { weekdayLabels } from "@/lib/calendar/grid";
import { cn } from "@/lib/utils";
import type { CalendarDay } from "@/features/calendar/service";
import type { GridCell } from "@/lib/calendar/grid";

const KINDS = [
  { key: "workout", label: "Workout", icon: Dumbbell, has: (d: CalendarDay) => d.workouts.length > 0 },
  { key: "activity", label: "Activity", icon: Activity, has: (d: CalendarDay) => d.activities.length > 0 },
  { key: "nutrition", label: "Nutrition", icon: Utensils, has: (d: CalendarDay) => d.kcal !== null },
  { key: "water", label: "Water", icon: Droplets, has: (d: CalendarDay) => d.waterMl !== null },
  { key: "weight", label: "Weight", icon: Scale, has: (d: CalendarDay) => d.weightKg !== null },
  { key: "sleep", label: "Sleep", icon: Moon, has: (d: CalendarDay) => d.sleepMinutes !== null },
  { key: "recovery", label: "Recovery", icon: HeartPulse, has: (d: CalendarDay) => d.recoveryScore !== null },
] as const;

export const CALENDAR_KINDS = KINDS;

type Props = { weeks: GridCell[][]; days: Map<string, CalendarDay>; month: string; today: string; selected: string | null; weekStartsOn: number };

/** Month grid. Each day shows icons (shape, not just colour) for what was recorded; every cell is a link. */
export function MonthGrid({ weeks, days, month, today, selected, weekStartsOn }: Props) {
  return (
    <div role="grid" aria-label="Calendar" className="overflow-hidden rounded-lg border bg-card">
      <div role="row" className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
        {weekdayLabels(weekStartsOn).map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div role="row" key={wi} className="grid grid-cols-7">
          {week.map((cell) => {
            const day = days.get(cell.date);
            const present = day ? KINDS.filter((k) => k.has(day)) : [];
            const isToday = cell.date === today;
            const isSel = cell.date === selected;
            const dayNum = Number(cell.date.slice(8));
            return (
              <Link
                key={cell.date}
                role="gridcell"
                href={`/calendar?month=${month}&date=${cell.date}`}
                aria-current={isToday ? "date" : undefined}
                aria-selected={isSel}
                aria-label={`${cell.date}${present.length ? ": " + present.map((k) => k.label.toLowerCase()).join(", ") : ": nothing logged"}`}
                className={cn("flex min-h-[3.75rem] flex-col items-center gap-1 border-b border-r p-1 text-sm transition-colors last:border-r-0 hover:bg-accent/50 sm:min-h-20 sm:items-start sm:p-2", !cell.inMonth && "bg-muted/30 text-muted-foreground/60", isSel && "bg-accent ring-2 ring-inset ring-primary")}
              >
                <span className={cn("tabular grid size-6 place-items-center rounded-full text-xs font-medium", isToday && "bg-primary text-primary-foreground")}>{dayNum}</span>
                <span className="flex flex-wrap justify-center gap-0.5 sm:justify-start" aria-hidden="true">
                  {present.map((k) => <k.icon key={k.key} className="size-3 text-primary sm:size-3.5" />)}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
