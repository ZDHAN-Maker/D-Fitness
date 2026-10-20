import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { workoutGemini, workoutZod } from "@/lib/ai/schemas";
import { WORKOUT_SYSTEM, dataBlock } from "@/lib/ai/prompts";
import { CANNED, classifyMessage } from "@/lib/ai/safety";
import { validateWorkout, type CandidateExercise, type ValidatedWorkout } from "@/lib/ai/validate";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getWorkoutAnalytics } from "@/features/analytics/service";
import { getDay } from "@/features/recovery/service";
import { savePlan } from "@/features/workout/plans";
import { toExercise } from "@/features/workout/exercises";
import { addDays, todayInTimeZone } from "@/utils/date";
import type { TrackingMode } from "@/types/domain";
import type { WorkoutGenInput } from "@/lib/validations/ai";

export type GeneratedWorkout = { id: string; workout: ValidatedWorkout; params: WorkoutGenInput; recoveryScore: number | null };

const LOW_RECOVERY = 50;

export async function generateWorkout(userId: string, input: WorkoutGenInput): Promise<GeneratedWorkout> {
  if (input.note) {
    const c = classifyMessage(input.note);
    if (c === "emergency" || c === "eating_disorder" || c === "extreme_restriction") throw new AppError("validation", CANNED[c]);
  }
  const { profile, settings } = await getProfileAndSettings(userId);
  if (!profile || !settings) throw new AppError("conflict", "Your profile is still being created.", 409);
  const today = todayInTimeZone(profile.timezone);
  const supabase = await createClient();

  const [cand, recovery, wk] = await Promise.all([
    supabase.rpc("exercise_candidates", { p_equipment: input.equipment.length ? input.equipment : null, p_experience: profile.experience_level, p_per_muscle: 6, p_limit: 90 }),
    getDay(today),
    getWorkoutAnalytics(addDays(today, -6), today, settings.week_starts_on),
  ]);
  if (cand.error) throw cand.error;

  const exercises = ((cand.data ?? []) as Record<string, unknown>[]).map(toExercise);
  if (exercises.length < 3) throw new AppError("conflict", "Not enough exercises match your equipment. Pick more equipment (bodyweight is always allowed).", 409);
  const candidates = new Map<number, CandidateExercise>(exercises.map((e) => [e.id, { id: e.id, name: e.name, tracking_mode: e.tracking_mode as TrackingMode, primary_muscle: e.primary_muscle, equipment: e.equipment }]));

  const score = recovery.score?.score ?? null;
  const data = {
    available_minutes: input.minutes,
    goal: input.goal,
    focus: input.focus,
    equipment: input.equipment.length ? input.equipment : "any (bodyweight always allowed)",
    experience: profile.experience_level ?? "unknown",
    recovery: score === null ? null : { score, level: score < LOW_RECOVERY ? "low" : score < 75 ? "moderate" : "high" },
    recently_trained_muscles: wk.muscles.map((m) => ({ muscle: m.muscle, sets_last_7_days: m.sets })),
    candidates: exercises.map((e) => ({ exercise_id: e.id, name: e.name, muscle: e.primary_muscle, equipment: e.equipment, mode: e.tracking_mode, difficulty: e.difficulty })),
  };

  const { data: raw, model } = await runAi({
    userId,
    feature: "workout_generator",
    system: WORKOUT_SYSTEM,
    contents: [{ role: "user", parts: [{ text: dataBlock(JSON.stringify(data), input.note ?? "") }] }],
    schema: workoutGemini,
    validate: (r) => workoutZod.parse(r),
  });

  const workout = validateWorkout(raw, candidates, { minutes: input.minutes, recoveryLow: score !== null && score < LOW_RECOVERY });
  const prompt = `${input.minutes} min · ${input.goal} · ${input.focus}${input.note ? ` · ${input.note}` : ""}`;
  const { data: saved, error } = await supabase.from("ai_generated_workouts").insert({ user_id: userId, prompt, params: input, result: workout, model }).select("id").single();
  if (error) throw error;
  return { id: saved.id as string, workout, params: input, recoveryScore: score };
}

/** "Add to Workout Plan": turns an already-validated generated workout into a normal, editable plan. */
export async function addGeneratedToPlan(userId: string, generatedId: string, name: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_generated_workouts").select("result, plan_id").eq("id", generatedId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "We could not find that generated workout.", 404);
  if (data.plan_id) throw new AppError("conflict", "This workout was already added to your plans.", 409);

  const w = data.result as ValidatedWorkout;
  const planId = await savePlan({
    name,
    description: "Generated with the AI workout generator",
    scheduledDays: [],
    exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, targetSets: e.sets, targetRepsMin: e.repsMin ?? undefined, targetRepsMax: e.repsMax ?? undefined, targetDurationSec: e.durationSec ?? undefined, targetWeightKg: undefined, restSeconds: e.restSeconds, notes: e.note || undefined })),
  });
  const { error: upErr } = await supabase.from("ai_generated_workouts").update({ plan_id: planId }).eq("id", generatedId).eq("user_id", userId);
  if (upErr) throw upErr;
  void userId;
  return planId;
}
