import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { PlanEdit, PlanSummary } from "@/features/workout/types";
import type { PlanInput } from "@/lib/validations/workout";

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .select("id, name, description, scheduled_days, workout_plan_exercises(count)")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string) ?? null,
    scheduled_days: ((p.scheduled_days as number[]) ?? []).map(Number),
    exercise_count: ((p.workout_plan_exercises as { count: number }[])?.[0]?.count ?? 0) as number,
  }));
}

export async function getPlanForEdit(id: string): Promise<PlanEdit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*, workout_plan_exercises(*, exercises(id, name, primary_muscle, equipment, tracking_mode))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type PE = Record<string, unknown> & { position: number; exercises: Record<string, unknown> | null };
  const rows = ((data.workout_plan_exercises ?? []) as PE[]).filter((r) => r.exercises).sort((a, b) => a.position - b.position);
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) ?? "",
    scheduledDays: ((data.scheduled_days as number[]) ?? []).map(Number),
    exercises: rows.map((r) => ({
      exercise: {
        id: Number(r.exercises!.id),
        name: String(r.exercises!.name),
        primary_muscle: (r.exercises!.primary_muscle as string) ?? null,
        equipment: (r.exercises!.equipment as string) ?? null,
        tracking_mode: r.exercises!.tracking_mode as PlanEdit["exercises"][number]["exercise"]["tracking_mode"],
      },
      targetSets: Number(r.target_sets),
      targetRepsMin: n(r.target_reps_min),
      targetRepsMax: n(r.target_reps_max),
      targetDurationSec: n(r.target_duration_sec),
      targetWeightKg: n(r.target_weight_kg),
      restSeconds: n(r.rest_seconds),
      notes: (r.notes as string) ?? "",
    })),
  };
}

/** Plans scheduled for a weekday (0 = Sunday ... 6 = Saturday). */
export async function plansScheduledFor(weekday: number): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_plans").select("id, name").eq("is_archived", false).contains("scheduled_days", [weekday]);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function savePlan(input: PlanInput): Promise<string> {
  const supabase = await createClient();
  const plan = { name: input.name, description: input.description ?? "", scheduled_days: input.scheduledDays };
  const exercises = input.exercises.map((e) => ({
    exercise_id: e.exerciseId,
    target_sets: e.targetSets,
    target_reps_min: e.targetRepsMin ?? "",
    target_reps_max: e.targetRepsMax ?? "",
    target_duration_sec: e.targetDurationSec ?? "",
    target_weight_kg: e.targetWeightKg ?? "",
    rest_seconds: e.restSeconds ?? "",
    notes: e.notes ?? "",
  }));
  const { data, error } = await supabase.rpc("save_workout_plan", { p_id: input.id ?? null, p_plan: plan, p_exercises: exercises });
  if (error) throw error;
  return data as string;
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_plans").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that workout plan.", 404);
}
