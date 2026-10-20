import { round1 } from "@/lib/calculations/nutrition";
import { addDays, startOfWeek } from "@/utils/date";

export type WeeklyRow = { week: string; workouts: number; volume_kg: number };

/** Every week between `from` and `to` (inclusive), with zeros where nothing happened, so charts have no gaps. */
export function zeroFillWeeks(rows: WeeklyRow[], from: string, to: string, weekStartsOn = 1): WeeklyRow[] {
  const byWeek = new Map(rows.map((r) => [r.week, r]));
  const out: WeeklyRow[] = [];
  for (let w = startOfWeek(from, weekStartsOn); w <= to && out.length < 120; w = addDays(w, 7)) {
    const r = byWeek.get(w);
    out.push({ week: w, workouts: r?.workouts ?? 0, volume_kg: r?.volume_kg ?? 0 });
  }
  return out;
}

export type MacroGrams = { protein_g: number; carbs_g: number; fat_g: number };

/** Share of calories from each macro (protein 4, carbs 4, fat 9 kcal/g), rounded to sum to exactly 100. */
export function macroDistribution(m: MacroGrams): { protein: number; carbs: number; fat: number } | null {
  const p = m.protein_g * 4;
  const c = m.carbs_g * 4;
  const f = m.fat_g * 9;
  const total = p + c + f;
  if (total <= 0) return null;
  const protein = Math.round((p / total) * 100);
  const carbs = Math.round((c / total) * 100);
  return { protein, carbs, fat: 100 - protein - carbs };
}

export type DailyNutrition = { date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

/** Averages over days that HAVE data: a day you did not log is unknown, not zero. */
export function summarizeNutrition(days: DailyNutrition[]) {
  const n = days.length;
  if (n === 0) return null;
  const avg = (k: keyof Omit<DailyNutrition, "date">) => round1(days.reduce((a, d) => a + Number(d[k]), 0) / n);
  return { daysLogged: n, calories: Math.round(avg("calories")), protein_g: avg("protein_g"), carbs_g: avg("carbs_g"), fat_g: avg("fat_g"), fiber_g: avg("fiber_g") };
}

export const consistencyPct = (daysWithData: number, totalDays: number) => (totalDays > 0 ? Math.min(100, Math.round((daysWithData / totalDays) * 100)) : 0);

export function average(values: number[]): number | null {
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** Weeks in which the weekly workout target was met. */
export function weeksOnTarget(rows: WeeklyRow[], target: number): { hit: number; total: number } {
  return { hit: rows.filter((r) => target > 0 && r.workouts >= target).length, total: rows.length };
}

export const RANGE_DAYS = { "30d": 30, "90d": 90, "180d": 180 } as const;
export type AnalyticsRange = keyof typeof RANGE_DAYS;
