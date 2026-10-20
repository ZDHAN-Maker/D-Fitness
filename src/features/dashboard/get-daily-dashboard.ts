import { createClient } from "@/lib/supabase/server";
import { plansScheduledFor } from "@/features/workout/plans";
import { getRecentPR } from "@/features/workout/records";
import { getLatestWeight, listWeights } from "@/features/body/service";
import { getDay } from "@/features/recovery/service";
import { listGoals, type GoalItem } from "@/features/goals/service";
import { listStreaks, type StreakItem } from "@/features/achievements/service";
import { getTodayInsight, type Insight } from "@/features/ai/coach";
import { calculateTrend, type RecoveryScore } from "@/lib/calculations/body";
import { addDays, weekdayOf } from "@/utils/date";
import type { MacroNutrients, UserSettings } from "@/types/domain";

export type TodayWorkout =
  | { state: "active"; id: string; name: string }
  | { state: "done"; id: string; name: string; volumeKg: number | null }
  | { state: "scheduled"; planId: string; name: string }
  | { state: "rest" };

export type WeightSummary = { latestKg: number; date: string; change: number | null; changeDays: number | null };
export type SleepSummary = { minutes: number; targetMinutes: number };

export type RecentPR = { name: string; record_type: string; value: number; unit: string; achieved_on: string };

export type DailyDashboard = {
  date: string;
  targets: Pick<
    UserSettings,
    "calorie_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g" | "fiber_target_g" | "water_target_ml"
  >;
  nutrition: MacroNutrients & { items_count: number };
  waterMl: number;
  workout: TodayWorkout;
  recentPR: RecentPR | null;
  weight: WeightSummary | null;
  sleep: SleepSummary | null;
  recovery: Pick<RecoveryScore, "score" | "band"> | null;
  goals: GoalItem[];
  streaks: StreakItem[];
  insight: Insight | null;
};

type NutritionRow = {
  calories: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string;
  items_count: number;
};

/**
 * One server-side call that assembles the whole dashboard, so the browser never fans out into
 * many requests. Aggregation happens in Postgres (daily_nutrition_totals / daily_water_total);
 * both run as the signed-in user, so RLS applies.
 */
export async function getDailyDashboard(settings: UserSettings, date: string): Promise<DailyDashboard> {
  const supabase = await createClient();

  const [nutritionRes, waterRes, sessions, scheduled, recentPR, weights, day, goals, streaks, insight] = await Promise.all([
    supabase.rpc("daily_nutrition_totals", { p_date: date }),
    supabase.rpc("daily_water_total", { p_date: date }),
    // today's session (in progress or completed), newest first
    supabase.from("workout_sessions").select("id, name, status, total_volume_kg").eq("logged_on", date).in("status", ["in_progress", "completed"]).order("started_at", { ascending: false }),
    plansScheduledFor(weekdayOf(date)),
    getRecentPR(),
    listWeights(addDays(date, -14)),
    getDay(date),
    listGoals(),
    listStreaks(date),
    getTodayInsight(date).catch(() => null), // a failing insight lookup must never break the dashboard
  ]);
  if (nutritionRes.error) throw nutritionRes.error;
  if (waterRes.error) throw waterRes.error;
  if (sessions.error) throw sessions.error;

  // Weight: latest entry (even if older than 14 days) and the change across the last 14 days.
  const trend = calculateTrend(weights.map((w) => ({ date: w.date, value: w.weightKg })));
  const latestW = weights.at(-1) ?? (await getLatestWeight().then((w) => (w ? { date: w.date, weightKg: w.weightKg } : null)));
  const weight: WeightSummary | null = latestW ? { latestKg: latestW.weightKg, date: latestW.date, change: trend?.change ?? null, changeDays: trend?.days ?? null } : null;

  const rows = sessions.data ?? [];
  const active = rows.find((r) => r.status === "in_progress");
  const done = rows.find((r) => r.status === "completed");
  const workout: TodayWorkout = active
    ? { state: "active", id: active.id as string, name: active.name as string }
    : done
      ? { state: "done", id: done.id as string, name: done.name as string, volumeKg: done.total_volume_kg === null ? null : Number(done.total_volume_kg) }
      : scheduled[0]
        ? { state: "scheduled", planId: scheduled[0].id, name: scheduled[0].name }
        : { state: "rest" };

  const row = ((nutritionRes.data as NutritionRow[] | null) ?? [])[0];

  return {
    date,
    targets: {
      calorie_target: settings.calorie_target,
      protein_target_g: settings.protein_target_g,
      carbs_target_g: settings.carbs_target_g,
      fat_target_g: settings.fat_target_g,
      fiber_target_g: settings.fiber_target_g,
      water_target_ml: settings.water_target_ml,
    },
    nutrition: {
      calories: Number(row?.calories ?? 0),
      protein_g: Number(row?.protein_g ?? 0),
      carbs_g: Number(row?.carbs_g ?? 0),
      fat_g: Number(row?.fat_g ?? 0),
      fiber_g: Number(row?.fiber_g ?? 0),
      items_count: row?.items_count ?? 0,
    },
    waterMl: Number(waterRes.data ?? 0),
    workout,
    recentPR,
    weight,
    sleep: day.sleep ? { minutes: day.sleep.minutes, targetMinutes: settings.sleep_target_minutes } : null,
    recovery: day.score ? { score: day.score.score, band: day.score.band } : null,
    goals: goals.filter((g) => g.status === "active"),
    streaks,
    insight,
  };
}
