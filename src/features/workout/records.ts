import { createClient } from "@/lib/supabase/server";
import type { RecordRow } from "@/features/workout/types";

type Row = Record<string, unknown>;

/** Current best per exercise/activity and record type, with display names (3 queries total). */
export async function listRecords(): Promise<RecordRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_personal_records");
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const exIds = [...new Set(rows.filter((r) => r.exercise_id).map((r) => Number(r.exercise_id)))];
  const actIds = [...new Set(rows.filter((r) => r.activity_type_id).map((r) => Number(r.activity_type_id)))];

  const [ex, act] = await Promise.all([
    exIds.length ? supabase.from("exercises").select("id, name").in("id", exIds) : Promise.resolve({ data: [], error: null }),
    actIds.length ? supabase.from("activity_types").select("id, name").in("id", actIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ex.error) throw ex.error;
  if (act.error) throw act.error;
  const exName = new Map((ex.data ?? []).map((e: Row) => [Number(e.id), String(e.name)]));
  const actName = new Map((act.data ?? []).map((a: Row) => [Number(a.id), String(a.name)]));

  return rows.map((r) => {
    const isEx = Boolean(r.exercise_id);
    const id = Number(isEx ? r.exercise_id : r.activity_type_id);
    return {
      subject: { kind: isEx ? "exercise" : "activity", id, name: (isEx ? exName.get(id) : actName.get(id)) ?? "Unknown" },
      record_type: String(r.record_type),
      value: Number(r.value),
      unit: String(r.unit),
      achieved_on: String(r.achieved_on).slice(0, 10),
    } as RecordRow;
  });
}

/** Most recent PR for the dashboard. */
export async function getRecentPR(): Promise<{ name: string; record_type: string; value: number; unit: string; achieved_on: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_records")
    .select("record_type, value, unit, achieved_on, exercises(name), activity_types(name)")
    .order("achieved_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ex = data.exercises as unknown as { name: string } | null;
  const act = data.activity_types as unknown as { name: string } | null;
  return { name: ex?.name ?? act?.name ?? "Record", record_type: data.record_type as string, value: Number(data.value), unit: data.unit as string, achieved_on: String(data.achieved_on).slice(0, 10) };
}

export async function getExerciseHistory(exerciseId: number, limit = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exercise_history", { p_exercise_id: exerciseId, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    session_id: String(r.session_id),
    date: String(r.session_date).slice(0, 10),
    sets: (r.sets as { weight_kg: number | null; reps: number | null; duration_sec: number | null; distance_m: number | null; is_warmup: boolean }[]) ?? [],
  }));
}

export const RECORD_LABEL: Record<string, string> = {
  max_weight: "Heaviest set",
  estimated_1rm: "Estimated 1RM",
  max_reps: "Most reps",
  max_volume: "Best set volume",
  longest_distance: "Longest distance",
  fastest_time: "Fastest pace",
};

/** PRs that were set during one workout (to badge them on the summary). */
export async function getSessionPRs(sessionId: string): Promise<{ exercise_id: number; record_type: string; value: number; unit: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("personal_records").select("exercise_id, record_type, value, unit").eq("workout_session_id", sessionId);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ exercise_id: Number(r.exercise_id), record_type: String(r.record_type), value: Number(r.value), unit: String(r.unit) }));
}
