import { createClient } from "@/lib/supabase/server";
import { calculateEstimatedOneRepMax, topWorkingSet } from "@/lib/calculations/workout";
import type { DailyNutrition, WeeklyRow } from "@/lib/calculations/analytics";

type Row = Record<string, unknown>;

export type WorkoutAnalytics = {
  weekly: WeeklyRow[];
  muscles: { muscle: string; sets: number }[];
  topExercises: { exerciseId: number; name: string; sessions: number }[];
};

export async function getWorkoutAnalytics(from: string, to: string, weekStartsOn: number): Promise<WorkoutAnalytics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_workout", { p_from: from, p_to: to, p_week_start: weekStartsOn });
  if (error) throw error;
  const d = (data ?? {}) as { weekly?: Row[]; muscles?: Row[]; top_exercises?: Row[] };
  return {
    weekly: (d.weekly ?? []).map((w) => ({ week: String(w.week).slice(0, 10), workouts: Number(w.workouts), volume_kg: Number(w.volume_kg) })),
    muscles: (d.muscles ?? []).map((m) => ({ muscle: String(m.muscle), sets: Number(m.sets) })),
    topExercises: (d.top_exercises ?? []).map((e) => ({ exerciseId: Number(e.exercise_id), name: String(e.name), sessions: Number(e.sessions) })),
  };
}

/** Per-session top-set estimated 1RM for one exercise (last ~30 sessions), oldest first. */
export async function getExerciseProgression(exerciseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exercise_history", { p_exercise_id: exerciseId, p_limit: 30 });
  if (error) throw error;
  type S = { weight_kg: number | null; reps: number | null; is_warmup: boolean };
  return ((data ?? []) as Row[])
    .map((r) => {
      const sets = ((r.sets as S[]) ?? []).map((s) => ({ ...s, is_completed: true }));
      const top = topWorkingSet(sets);
      return { date: String(r.session_date).slice(0, 10), e1rm: top ? calculateEstimatedOneRepMax(top.weight_kg, top.reps) : null, topWeight: top?.weight_kg ?? null };
    })
    .filter((p) => p.e1rm !== null)
    .reverse();
}

/** Every time the estimated-1RM record was broken for one exercise (history is kept, so this is the PR timeline). */
export async function getPRTimeline(exerciseId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("personal_records").select("value, achieved_on").eq("exercise_id", exerciseId).eq("record_type", "estimated_1rm").order("achieved_on", { ascending: true }).limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({ date: String(r.achieved_on).slice(0, 10), value: Number(r.value) }));
}

export type NutritionAnalytics = { daily: DailyNutrition[]; topFoods: { name: string; count: number; calories: number }[] };

export async function getNutritionAnalytics(from: string, to: string): Promise<NutritionAnalytics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_nutrition", { p_from: from, p_to: to });
  if (error) throw error;
  const d = (data ?? {}) as { daily?: Row[]; top_foods?: Row[] };
  return {
    daily: (d.daily ?? []).map((r) => ({ date: String(r.date).slice(0, 10), calories: Number(r.calories), protein_g: Number(r.protein_g), carbs_g: Number(r.carbs_g), fat_g: Number(r.fat_g), fiber_g: Number(r.fiber_g) })),
    topFoods: (d.top_foods ?? []).map((f) => ({ name: String(f.name), count: Number(f.count), calories: Math.round(Number(f.calories)) })),
  };
}
