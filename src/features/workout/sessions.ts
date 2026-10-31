import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import type { ExerciseTarget, PreviousPerformance, SessionExerciseView, SessionView, SetView } from "@/features/workout/types";
import type { SetPatchInput, StartWorkoutInput } from "@/lib/validations/workout";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const toSet = (r: Row): SetView => ({
  id: String(r.id),
  set_number: Number(r.set_number),
  weight_kg: num(r.weight_kg),
  reps: num(r.reps),
  duration_sec: num(r.duration_sec),
  distance_m: num(r.distance_m),
  rpe: num(r.rpe),
  is_warmup: Boolean(r.is_warmup),
  is_completed: Boolean(r.is_completed),
});

export async function startWorkout(input: StartWorkoutInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_workout", { p_plan_id: input.planId ?? null, p_name: input.name ?? null, p_date: input.date });
  if (error) {
    if (error.code === "23505") throw new AppError("conflict", "You already have a workout in progress. Finish or discard it first.", 409);
    if (error.code === "22023") throw new AppError("validation", "Workouts can only be started for today.");
    throw error;
  }
  return data as string;
}

export async function getActiveSession(): Promise<{ id: string; name: string; started_at: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_sessions").select("id, name, started_at").eq("status", "in_progress").maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; started_at: string } | null;
}

/** One query for the whole session (exercises + sets); plan targets are matched by position. */
export async function getSessionView(id: string): Promise<SessionView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*, workout_session_exercises(id, position, exercises(id, name, primary_muscle, equipment, tracking_mode, video_url), workout_sets(*))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const targets = new Map<number, ExerciseTarget>();
  if (data.plan_id) {
    const { data: pe, error: peErr } = await supabase.from("workout_plan_exercises").select("position, target_reps_min, target_reps_max, target_duration_sec, target_weight_kg, rest_seconds").eq("plan_id", data.plan_id);
    if (peErr) throw peErr;
    for (const t of pe ?? []) {
      targets.set(Number(t.position), { repsMin: num(t.target_reps_min), repsMax: num(t.target_reps_max), durationSec: num(t.target_duration_sec), weightKg: num(t.target_weight_kg), restSeconds: num(t.rest_seconds) });
    }
  }

  const exercises: SessionExerciseView[] = ((data.workout_session_exercises ?? []) as Row[])
    .filter((e) => e.exercises)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((e) => {
      const ex = e.exercises as Row;
      return {
        id: String(e.id),
        position: Number(e.position),
        exercise: {
          id: Number(ex.id),
          name: String(ex.name),
          primary_muscle: (ex.primary_muscle as string) ?? null,
          equipment: (ex.equipment as string) ?? null,
          tracking_mode: ex.tracking_mode as SessionExerciseView["exercise"]["tracking_mode"],
          video_url: (ex.video_url as string) ?? null,
        },
        sets: ((e.workout_sets ?? []) as Row[]).map(toSet).sort((a, b) => a.set_number - b.set_number),
        target: targets.get(Number(e.position)) ?? null,
      };
    });

  return {
    id: String(data.id),
    plan_id: (data.plan_id as string) ?? null,
    name: String(data.name),
    status: data.status as SessionView["status"],
    logged_on: String(data.logged_on),
    started_at: String(data.started_at),
    ended_at: (data.ended_at as string) ?? null,
    total_volume_kg: num(data.total_volume_kg),
    perceived_effort: num(data.perceived_effort),
    notes: (data.notes as string) ?? null,
    exercises,
  };
}

/** Last completed session's sets per exercise (one RPC for all exercises: no N+1). */
export async function getPreviousPerformance(exerciseIds: number[], excludeSessionId?: string): Promise<Record<number, PreviousPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("previous_performance", { p_exercise_ids: [...new Set(exerciseIds)], p_exclude_session: excludeSessionId ?? null });
  if (error) throw error;
  const out: Record<number, PreviousPerformance> = {};
  for (const r of (data ?? []) as Row[]) {
    const id = Number(r.exercise_id);
    const entry = (out[id] ??= { date: String(r.session_date).slice(0, 10), sets: [] });
    entry.sets.push({ weight_kg: num(r.weight_kg), reps: num(r.reps), duration_sec: num(r.duration_sec), distance_m: num(r.distance_m), is_warmup: Boolean(r.is_warmup) });
  }
  return out;
}

export async function addExerciseToSession(sessionId: string, exerciseId: number): Promise<SessionExerciseView> {
  const supabase = await createClient();
  const { data: last, error: lastErr } = await supabase.from("workout_session_exercises").select("position").eq("session_id", sessionId).order("position", { ascending: false }).limit(1);
  if (lastErr) throw lastErr;
  const position = last?.length ? Number(last[0]!.position) + 1 : 0;

  const { data: se, error } = await supabase
    .from("workout_session_exercises")
    .insert({ session_id: sessionId, exercise_id: exerciseId, position })
    .select("id, position, exercises(id, name, primary_muscle, equipment, tracking_mode, video_url)")
    .single();
  if (error) throw error;
  const { data: set, error: setErr } = await supabase.from("workout_sets").insert({ session_exercise_id: se.id, set_number: 1 }).select("*").single();
  if (setErr) throw setErr;

  const ex = se.exercises as unknown as Row;
  return {
    id: String(se.id),
    position,
    exercise: {
      id: Number(ex.id),
      name: String(ex.name),
      primary_muscle: (ex.primary_muscle as string) ?? null,
      equipment: (ex.equipment as string) ?? null,
      tracking_mode: ex.tracking_mode as SessionExerciseView["exercise"]["tracking_mode"],
      video_url: (ex.video_url as string) ?? null,
    },
    sets: [toSet(set)],
    target: null,
  };
}

export async function removeSessionExercise(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("workout_session_exercises").delete().eq("id", id);
  if (error) throw error;
}

export async function addSet(sessionExerciseId: string): Promise<SetView> {
  const supabase = await createClient();
  const { data: last, error: lastErr } = await supabase.from("workout_sets").select("set_number").eq("session_exercise_id", sessionExerciseId).order("set_number", { ascending: false }).limit(1);
  if (lastErr) throw lastErr;
  const { data, error } = await supabase.from("workout_sets").insert({ session_exercise_id: sessionExerciseId, set_number: last?.length ? Number(last[0]!.set_number) + 1 : 1 }).select("*").single();
  if (error) throw error;
  return toSet(data);
}

export async function updateSet(p: SetPatchInput): Promise<SetView> {
  const patch: Record<string, unknown> = {};
  if (p.weightKg !== undefined) patch.weight_kg = p.weightKg;
  if (p.reps !== undefined) patch.reps = p.reps;
  if (p.durationSec !== undefined) patch.duration_sec = p.durationSec;
  if (p.distanceM !== undefined) patch.distance_m = p.distanceM;
  if (p.rpe !== undefined) patch.rpe = p.rpe;
  if (p.isWarmup !== undefined) patch.is_warmup = p.isWarmup;
  if (p.isCompleted !== undefined) {
    patch.is_completed = p.isCompleted;
    patch.completed_at = p.isCompleted ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) throw new AppError("validation", "Nothing to update.");

  const supabase = await createClient();
  if (p.isCompleted) {
    // A finished set must say what was done: reps or time. Check against the values being saved + stored ones.
    const { data: cur, error: curErr } = await supabase.from("workout_sets").select("reps, duration_sec").eq("id", p.setId).maybeSingle();
    if (curErr) throw curErr;
    if (!cur) throw new AppError("not_found", "We could not find that set.", 404);
    const reps = p.reps !== undefined ? p.reps : (cur.reps as number | null);
    const dur = p.durationSec !== undefined ? p.durationSec : (cur.duration_sec as number | null);
    if (!reps && !dur) throw new AppError("validation", "Enter reps or time before completing the set.");
  }
  const { data, error } = await supabase.from("workout_sets").update(patch).eq("id", p.setId).select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "We could not find that set.", 404);
  return toSet(data);
}

export async function deleteSet(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sets").delete().eq("id", id);
  if (error) throw error;
}

export type CompletionResult = { total_volume_kg: number; new_prs: number; achievements: string[] };

export async function completeWorkout(sessionId: string, effort?: number, notes?: string): Promise<CompletionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_workout", { p_session_id: sessionId, p_effort: effort ?? null, p_notes: notes ?? null });
  if (error) {
    if (error.code === "P0001") throw new AppError("validation", "Complete at least one set before finishing the workout.");
    if (error.code === "P0002") throw new AppError("not_found", "This workout is no longer in progress.", 404);
    throw error;
  }
  const r = (data ?? {}) as Partial<CompletionResult>;
  return { total_volume_kg: Number(r.total_volume_kg ?? 0), new_prs: Number(r.new_prs ?? 0), achievements: r.achievements ?? [] };
}

export async function cancelWorkout(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_sessions").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", sessionId).eq("status", "in_progress").select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "This workout is no longer in progress.", 404);
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_sessions").delete().eq("id", sessionId).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that workout.", 404);
}

export async function listHistory(page: number, pageSize = 15) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("workout_sessions")
    .select("id, name, logged_on, started_at, ended_at, total_volume_kg, perceived_effort, workout_session_exercises(count)", { count: "exact" })
    .eq("status", "completed")
    .order("logged_on", { ascending: false })
    .order("started_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return {
    total: count ?? 0,
    pageSize,
    items: (data ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      logged_on: s.logged_on as string,
      started_at: s.started_at as string,
      ended_at: (s.ended_at as string) ?? null,
      total_volume_kg: num(s.total_volume_kg),
      perceived_effort: num(s.perceived_effort),
      exercise_count: ((s.workout_session_exercises as { count: number }[])?.[0]?.count ?? 0) as number,
    })),
  };
}

/** Completed workouts since a date (inclusive) — drives the weekly-target progress. */
export async function countCompletedSince(fromDate: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("status", "completed").gte("logged_on", fromDate);
  if (error) throw error;
  return count ?? 0;
}
