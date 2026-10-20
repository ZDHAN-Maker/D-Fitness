import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { calculateCaloriesBurned, calculatePaceSecPerKm } from "@/lib/calculations/workout";
import { round1 } from "@/lib/calculations/nutrition";
import type { ActivityInput } from "@/lib/validations/activity";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type ActivityTypeRow = { id: number; slug: string; name: string; category: string | null; met_value: number | null; tracks_distance: boolean; tracks_pace: boolean };

export const getActivityTypes = cache(async (): Promise<ActivityTypeRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_types").select("id, slug, name, category, met_value, tracks_distance, tracks_pace").order("category").order("name");
  if (error) throw error;
  return (data ?? []).map((a) => ({ id: Number(a.id), slug: a.slug as string, name: a.name as string, category: (a.category as string) ?? null, met_value: num(a.met_value), tracks_distance: Boolean(a.tracks_distance), tracks_pace: Boolean(a.tracks_pace) }));
});

export type ActivityItem = {
  id: string;
  activity_type_id: number;
  type_name: string;
  logged_on: string;
  duration_minutes: number;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
  calories_burned: number | null;
  notes: string | null;
};

const toItem = (r: Row): ActivityItem => ({
  id: String(r.id),
  activity_type_id: Number(r.activity_type_id),
  type_name: String((r.activity_types as Row | null)?.name ?? "Activity"),
  logged_on: String(r.logged_on).slice(0, 10),
  duration_minutes: Number(r.duration_minutes),
  distance_km: num(r.distance_km),
  avg_pace_sec_per_km: num(r.avg_pace_sec_per_km),
  calories_burned: num(r.calories_burned),
  notes: (r.notes as string) ?? null,
});

const SELECT = "id, activity_type_id, logged_on, duration_minutes, distance_km, avg_pace_sec_per_km, calories_burned, notes, activity_types(name)";

export async function listActivities(page: number, pageSize = 20) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase.from("activity_logs").select(SELECT, { count: "exact" }).order("logged_on", { ascending: false }).order("started_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { items: (data ?? []).map(toItem), total: count ?? 0, pageSize };
}

export async function getActivity(id: string): Promise<ActivityItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_logs").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toItem(data) : null;
}

/** Totals for a date range (inclusive), computed from one query. */
export async function activitySummary(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_logs").select("duration_minutes, distance_km, calories_burned").gte("logged_on", fromDate).lte("logged_on", toDate);
  if (error) throw error;
  const rows = data ?? [];
  return {
    count: rows.length,
    minutes: Math.round(rows.reduce((a, r) => a + Number(r.duration_minutes), 0)),
    km: round1(rows.reduce((a, r) => a + Number(r.distance_km ?? 0), 0)),
    kcal: Math.round(rows.reduce((a, r) => a + Number(r.calories_burned ?? 0), 0)),
  };
}

async function latestWeightKg(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weight_logs").select("weight_kg").order("logged_on", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? Number(data.weight_kg) : null;
}

/** Pace and (if not typed) estimated calories are derived server-side from the saved values. */
async function derive(input: ActivityInput) {
  const types = await getActivityTypes();
  const type = types.find((t) => t.id === input.activityTypeId);
  if (!type) throw new AppError("validation", "Choose a valid activity.");
  const distance = type.tracks_distance ? (input.distanceKm ?? null) : null;
  const pace = type.tracks_pace ? calculatePaceSecPerKm(input.durationMinutes, distance) : null;
  const kcal = input.caloriesBurned ?? calculateCaloriesBurned(type.met_value, await latestWeightKg(), input.durationMinutes);
  return { distance_km: distance, avg_pace_sec_per_km: pace, calories_burned: kcal };
}

export async function logActivity(userId: string, input: ActivityInput): Promise<string> {
  const supabase = await createClient();
  const d = await derive(input);
  const { data, error } = await supabase
    .from("activity_logs")
    .insert({ user_id: userId, activity_type_id: input.activityTypeId, logged_on: input.date, duration_minutes: input.durationMinutes, notes: input.notes ?? null, ...d })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateActivity(input: ActivityInput & { id: string }) {
  const supabase = await createClient();
  const d = await derive(input);
  const { data, error } = await supabase
    .from("activity_logs")
    .update({ activity_type_id: input.activityTypeId, logged_on: input.date, duration_minutes: input.durationMinutes, notes: input.notes ?? null, ...d })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "We could not find that activity.", 404);
}

export async function deleteActivity(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activity_logs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that activity.", 404);
}

/** Records, streak and achievements are best-effort: they must never fail a successful save. */
export async function afterActivityLogged(activityId: string, date: string, userToday: string) {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_activity_prs", { p_activity_log_id: activityId });
    if (date === userToday) await supabase.rpc("update_streak", { p_type: "workout", p_date: date });
    await supabase.rpc("evaluate_achievements");
  } catch (e) {
    console.error("[after-activity-logged]", e);
  }
}
