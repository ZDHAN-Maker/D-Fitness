import { createClient } from "@/lib/supabase/server";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getNutritionAnalytics, getWorkoutAnalytics } from "@/features/analytics/service";
import { listRecovery } from "@/features/recovery/service";
import { recentTotals } from "@/features/hydration/service";
import { listWeights } from "@/features/body/service";
import { listGoals } from "@/features/goals/service";
import { listStreaks } from "@/features/achievements/service";
import { average, summarizeNutrition } from "@/lib/calculations/analytics";
import { calculateTrend } from "@/lib/calculations/body";
import { daysLeft, goalProgressPct } from "@/lib/calculations/goals";
import { computeMissing, type CoachFacts } from "@/lib/ai/facts";
import { addDays, todayInTimeZone } from "@/utils/date";

const WINDOW_DAYS = 14;

const ageFrom = (birth: string | null, today: string): number | null => {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00Z");
  const t = new Date(today + "T00:00:00Z");
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  if (t.getUTCMonth() < b.getUTCMonth() || (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate())) age--;
  return age >= 10 && age <= 110 ? age : null;
};

/**
 * Snapshot of the user's last 14 days, assembled from the database in parallel. Everything here is a FACT:
 * the model comments on it but cannot add to it. Missing areas are listed explicitly in `missing`.
 */
export async function buildCoachFacts(userId: string): Promise<CoachFacts> {
  const { profile, settings } = await getProfileAndSettings(userId);
  if (!profile || !settings) throw new Error("Profile not ready");
  const to = todayInTimeZone(profile.timezone);
  const from = addDays(to, -(WINDOW_DAYS - 1));
  const supabase = await createClient();

  const [wk, recentSessions, nutri, recovery, water, weights, todayNut, todaySessions, goals, streaks] = await Promise.all([
    getWorkoutAnalytics(from, to, settings.week_starts_on),
    supabase.from("workout_sessions").select("logged_on, name").eq("status", "completed").gte("logged_on", from).order("logged_on", { ascending: false }).limit(5),
    getNutritionAnalytics(from, to),
    listRecovery(from, to),
    recentTotals(to, WINDOW_DAYS),
    listWeights(addDays(to, -45)),
    supabase.rpc("daily_nutrition_totals", { p_date: to }),
    supabase.from("workout_sessions").select("status").eq("logged_on", to).in("status", ["in_progress", "completed"]),
    listGoals(),
    listStreaks(to),
  ]);
  if (recentSessions.error) throw recentSessions.error;
  if (todayNut.error) throw todayNut.error;
  if (todaySessions.error) throw todaySessions.error;

  const count = wk.weekly.reduce((a, w) => a + w.workouts, 0);
  const n = summarizeNutrition(nutri.daily);
  const sleepMins = recovery.flatMap((r) => (r.sleep ? [r.sleep.minutes] : []));
  const scores = recovery.flatMap((r) => (r.score ? [{ date: r.date, score: r.score.score }] : []));
  const waterDays = water.filter((d) => d.totalMl > 0);
  const trend = calculateTrend(weights.map((w) => ({ date: w.date, value: w.weightKg })));
  const latestW = weights.at(-1);
  const nut = ((todayNut.data as { calories: number; protein_g: number }[] | null) ?? [])[0];
  const sessionStates = (todaySessions.data ?? []).map((s) => s.status as string);
  const stk = Object.fromEntries(streaks.map((s) => [s.type, s.current])) as Record<string, number>;

  const base: Omit<CoachFacts, "missing"> = {
    date: to,
    profile: { experience: profile.experience_level, primaryGoal: profile.primary_goal, activityLevel: profile.activity_level, ageYears: ageFrom(profile.birth_date, to), heightCm: profile.height_cm },
    targets: { calories: settings.calorie_target, protein_g: settings.protein_target_g, carbs_g: settings.carbs_target_g, fat_g: settings.fat_target_g, fiber_g: settings.fiber_target_g, water_ml: settings.water_target_ml, sleep_minutes: settings.sleep_target_minutes, workouts_per_week: settings.weekly_workout_target },
    window: { days: WINDOW_DAYS, from, to },
    workouts: { count, perWeek: Math.round((count / (WINDOW_DAYS / 7)) * 10) / 10, volumeKg: Math.round(wk.weekly.reduce((a, w) => a + w.volume_kg, 0)), recent: (recentSessions.data ?? []).map((s) => ({ date: String(s.logged_on).slice(0, 10), name: String(s.name) })) },
    nutrition: n ? { daysLogged: n.daysLogged, avgCalories: n.calories, avgProtein: n.protein_g, avgCarbs: n.carbs_g, avgFat: n.fat_g, avgFiber: n.fiber_g } : null,
    sleep: sleepMins.length ? { nights: sleepMins.length, avgMinutes: Math.round(average(sleepMins) ?? 0) } : null,
    water: waterDays.length ? { daysLogged: waterDays.length, avgMl: Math.round(average(waterDays.map((d) => d.totalMl)) ?? 0) } : null,
    recovery: scores.length ? { avg: Math.round(average(scores.map((s) => s.score)) ?? 0), latest: scores.at(-1)?.score ?? null, latestDate: scores.at(-1)?.date ?? null } : null,
    weight: latestW ? { latestKg: latestW.weightKg, changeKg: trend?.change ?? null, spanDays: trend?.days ?? null } : null,
    today: { calories: Math.round(Number(nut?.calories ?? 0)), protein_g: Math.round(Number(nut?.protein_g ?? 0)), waterMl: water.at(-1)?.totalMl ?? 0, workout: sessionStates.includes("completed") ? "done" : sessionStates.includes("in_progress") ? "in_progress" : "none" },
    goals: goals.filter((g) => g.status === "active").slice(0, 6).map((g) => ({ title: g.title, progressPct: goalProgressPct(g), current: g.current_value, target: g.target_value, unit: g.unit, daysLeft: daysLeft(g.target_date, to) })),
    streaks: { workout: stk.workout ?? 0, nutrition: stk.nutrition ?? 0, hydration: stk.hydration ?? 0, habit: stk.habit ?? 0 },
  };
  return { ...base, missing: computeMissing(base) };
}
