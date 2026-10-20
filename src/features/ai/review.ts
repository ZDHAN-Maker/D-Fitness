import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { reviewGemini, reviewZod } from "@/lib/ai/schemas";
import { REVIEW_SYSTEM, dataBlock } from "@/lib/ai/prompts";
import { dropUnsafeBullets } from "@/lib/ai/safety";
import { isEmptyWeek, normalizeWeekStart, weekBounds, weekMissing, type WeekMetrics } from "@/lib/ai/review";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getNutritionAnalytics, getWorkoutAnalytics } from "@/features/analytics/service";
import { listRecovery } from "@/features/recovery/service";
import { recentTotals } from "@/features/hydration/service";
import { listWeights } from "@/features/body/service";
import { average, summarizeNutrition } from "@/lib/calculations/analytics";
import { addDays, todayInTimeZone } from "@/utils/date";
import type { UserSettings } from "@/types/domain";

const diffDays = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

/** All numbers for one week, computed from the database. The current week is partial: it ends today. */
export async function computeWeekMetrics(start: string, today: string, settings: UserSettings): Promise<WeekMetrics> {
  const fullEnd = addDays(start, 6);
  const end = fullEnd < today ? fullEnd : today;
  const days = Math.max(1, diffDays(start, end) + 1);

  const [wk, nut, recovery, water, weights] = await Promise.all([
    getWorkoutAnalytics(start, end, settings.week_starts_on),
    getNutritionAnalytics(start, end),
    listRecovery(start, end),
    recentTotals(end, days),
    listWeights(start),
  ]);
  const n = summarizeNutrition(nut.daily);
  const sleepMins = recovery.flatMap((r) => (r.sleep ? [r.sleep.minutes] : []));
  const scores = recovery.flatMap((r) => (r.score ? [r.score.score] : []));
  const waterDays = water.filter((d) => d.totalMl > 0);
  const inWeek = weights.filter((w) => w.date >= start && w.date <= end);

  return {
    weekStart: start,
    weekEnd: fullEnd,
    daysCovered: days,
    workouts: { done: wk.weekly.reduce((a, w) => a + w.workouts, 0), target: settings.weekly_workout_target },
    calories: n ? { avg: n.calories, daysLogged: n.daysLogged } : null,
    protein: n ? { avg: n.protein_g, target: settings.protein_target_g } : null,
    water: waterDays.length ? { avgMl: Math.round(average(waterDays.map((d) => d.totalMl)) ?? 0), daysLogged: waterDays.length } : null,
    sleep: sleepMins.length ? { avgMinutes: Math.round(average(sleepMins) ?? 0), nights: sleepMins.length } : null,
    recovery: scores.length ? { avg: Math.round(average(scores) ?? 0) } : null,
    weight: inWeek.length >= 2 ? { from: inWeek[0]!.weightKg, to: inWeek.at(-1)!.weightKg, change: Math.round((inWeek.at(-1)!.weightKg - inWeek[0]!.weightKg) * 100) / 100 } : null,
  };
}

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  metrics: WeekMetrics;
  previous: WeekMetrics | null;
  wentWell: string[];
  needsImprovement: string[];
  recommendations: string[];
  missing: string[];
  createdAt: string;
};

const lines = (t: unknown) => String(t ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

/** Resolve which week to review (an explicit date snaps to its week; otherwise current/last). */
export async function resolveWeek(userId: string, input: { weekStart?: string; which?: "current" | "last" }) {
  const { profile, settings } = await getProfileAndSettings(userId);
  if (!profile || !settings) throw new AppError("conflict", "Your profile is still being created.", 409);
  const today = todayInTimeZone(profile.timezone);
  let start: string;
  if (input.weekStart) {
    const s = normalizeWeekStart(input.weekStart, today, settings.week_starts_on);
    if (!s) throw new AppError("validation", "You can only review weeks that have started.");
    start = s;
  } else {
    start = weekBounds(today, settings.week_starts_on, input.which ?? "last").start;
  }
  return { start, today, settings };
}

export async function generateWeeklyReview(userId: string, input: { weekStart?: string; which?: "current" | "last" }): Promise<WeeklyReview> {
  const { start, today, settings } = await resolveWeek(userId, input);
  const [metrics, prev] = await Promise.all([computeWeekMetrics(start, today, settings), computeWeekMetrics(addDays(start, -7), today, settings)]);
  if (isEmptyWeek(metrics)) throw new AppError("validation", "There isn't enough data for that week yet. Log a workout, a meal or some sleep first.", 422);

  const previous = isEmptyWeek(prev) ? null : prev;
  const missing = weekMissing(metrics);
  const { data, model } = await runAi({
    userId,
    feature: "weekly_review",
    system: REVIEW_SYSTEM,
    contents: [{ role: "user", parts: [{ text: dataBlock(JSON.stringify({ week: metrics, previous_week: previous, targets: { calories: settings.calorie_target, protein_g: settings.protein_target_g, water_ml: settings.water_target_ml, sleep_minutes: settings.sleep_target_minutes, workouts_per_week: settings.weekly_workout_target }, missing })) }] }],
    schema: reviewGemini,
    validate: (raw) => reviewZod.parse(raw),
  });

  const wentWell = dropUnsafeBullets(data.went_well);
  const needsImprovement = dropUnsafeBullets(data.needs_improvement);
  const recommendations = dropUnsafeBullets(data.recommendations);
  const supabase = await createClient();
  const createdAt = new Date().toISOString();
  const { error } = await supabase.from("ai_weekly_reviews").upsert(
    { user_id: userId, week_start: start, week_end: metrics.weekEnd, metrics: { week: metrics, previous, missing: [...missing, ...data.missing_data] }, went_well: wentWell.join("\n"), needs_improvement: needsImprovement.join("\n"), recommendations: recommendations.join("\n"), model, created_at: createdAt },
    { onConflict: "user_id,week_start" },
  );
  if (error) throw error;
  return { weekStart: start, weekEnd: metrics.weekEnd, metrics, previous, wentWell, needsImprovement, recommendations, missing: [...missing, ...data.missing_data], createdAt };
}

export async function getReview(weekStart: string): Promise<WeeklyReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_weekly_reviews").select("*").eq("week_start", weekStart).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const m = data.metrics as { week: WeekMetrics; previous: WeekMetrics | null; missing?: string[] };
  return { weekStart: String(data.week_start).slice(0, 10), weekEnd: String(data.week_end).slice(0, 10), metrics: m.week, previous: m.previous ?? null, wentWell: lines(data.went_well), needsImprovement: lines(data.needs_improvement), recommendations: lines(data.recommendations), missing: m.missing ?? [], createdAt: String(data.created_at) };
}

export async function listReviews(limit = 12): Promise<{ weekStart: string; weekEnd: string; createdAt: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_weekly_reviews").select("week_start, week_end, created_at").order("week_start", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ weekStart: String(r.week_start).slice(0, 10), weekEnd: String(r.week_end).slice(0, 10), createdAt: String(r.created_at) }));
}
