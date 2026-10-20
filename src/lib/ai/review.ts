/** Weekly-review facts and their plain-language presentation. PURE (no I/O). */
import { addDays, startOfWeek } from "@/utils/date";
import { formatDuration, formatInt, formatWater } from "@/utils/format";

export type WeekMetrics = {
  weekStart: string;
  weekEnd: string;
  /** Days of the week that have already happened (the current week is partial). */
  daysCovered: number;
  workouts: { done: number; target: number };
  calories: { avg: number; daysLogged: number } | null;
  protein: { avg: number; target: number } | null;
  water: { avgMl: number; daysLogged: number } | null;
  sleep: { avgMinutes: number; nights: number } | null;
  recovery: { avg: number } | null;
  weight: { from: number; to: number; change: number } | null;
};

export function weekBounds(today: string, weekStartsOn: number, which: "current" | "last" = "current"): { start: string; end: string } {
  const thisStart = startOfWeek(today, weekStartsOn);
  const start = which === "last" ? addDays(thisStart, -7) : thisStart;
  return { start, end: addDays(start, 6) };
}

/** Snap any date to the first day of its week; future weeks are not reviewable. */
export function normalizeWeekStart(date: string, today: string, weekStartsOn: number): string | null {
  const start = startOfWeek(date, weekStartsOn);
  return start > today ? null : start;
}

/** True when the week holds nothing to review. */
export const isEmptyWeek = (m: WeekMetrics) => m.workouts.done === 0 && !m.calories && !m.water && !m.sleep && !m.recovery && !m.weight;

/** Areas with no data this week (server-computed, handed to the model as the "missing" list). */
export function weekMissing(m: WeekMetrics): string[] {
  const out: string[] = [];
  if (!m.calories) out.push("Nutrition: no food logged this week");
  if (!m.water) out.push("Water: no water logged this week");
  if (!m.sleep) out.push("Sleep: no sleep logged this week");
  if (!m.recovery) out.push("Recovery: no check-ins this week");
  if (!m.weight) out.push("Weight: fewer than two weigh-ins this week");
  return out;
}

/** The headline figures in the format of the product brief (these are DATABASE FACTS, not AI output). */
export function formatWeekMetrics(m: WeekMetrics): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [{ label: "Workout", value: `${m.workouts.done} / ${m.workouts.target}` }];
  if (m.calories) rows.push({ label: "Calories", value: `${formatInt(m.calories.avg)} average` });
  if (m.protein) rows.push({ label: "Protein", value: `${m.protein.avg}g average` });
  if (m.water) rows.push({ label: "Water", value: `${formatWater(m.water.avgMl)} average` });
  if (m.sleep) rows.push({ label: "Sleep", value: `${formatDuration(m.sleep.avgMinutes)} average` });
  if (m.recovery) rows.push({ label: "Recovery", value: `${m.recovery.avg} / 100 average` });
  if (m.weight) rows.push({ label: "Weight", value: `${m.weight.from} → ${m.weight.to}kg` });
  return rows;
}
