import { createClient } from "@/lib/supabase/server";
import { buildMonthGrid, type GridCell } from "@/lib/calendar/grid";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type CalendarDay = {
  date: string;
  workouts: string[];
  activities: string[];
  kcal: number | null;
  waterMl: number | null;
  sleepMinutes: number | null;
  weightKg: number | null;
  recoveryScore: number | null;
};

/** One RPC for the whole visible grid (up to 6 weeks); only days that have data come back. */
export async function getCalendar(month: string, weekStartsOn: number): Promise<{ weeks: GridCell[][]; days: Map<string, CalendarDay> }> {
  const weeks = buildMonthGrid(month, weekStartsOn);
  const from = weeks[0]![0]!.date;
  const to = weeks.at(-1)!.at(-1)!.date;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_days", { p_from: from, p_to: to });
  if (error) throw error;
  const days = new Map<string, CalendarDay>();
  for (const r of (data ?? []) as Row[]) {
    const date = String(r.day).slice(0, 10);
    days.set(date, {
      date,
      workouts: (r.workouts as string[]) ?? [],
      activities: (r.activities as string[]) ?? [],
      kcal: num(r.kcal),
      waterMl: num(r.water_ml),
      sleepMinutes: num(r.sleep_minutes),
      weightKg: num(r.weight_kg),
      recoveryScore: num(r.recovery_score),
    });
  }
  return { weeks, days };
}
