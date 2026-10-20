import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { findMetric } from "@/lib/goals/metrics";
import type { GoalInput } from "@/lib/validations/goals";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type GoalItem = {
  id: string;
  goal_type: string;
  title: string;
  metric: string;
  direction: "increase" | "decrease";
  exercise_id: number | null;
  exercise_name: string | null;
  start_date: string;
  target_date: string | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  unit: string | null;
  status: "active" | "completed" | "paused" | "abandoned";
  completed_at: string | null;
  config: { distance_km?: number };
};

const toGoal = (r: Row): GoalItem => ({
  id: String(r.id),
  goal_type: String(r.goal_type),
  title: String(r.title),
  metric: String(r.metric),
  direction: r.direction as GoalItem["direction"],
  exercise_id: num(r.exercise_id),
  exercise_name: ((r.exercises as Row | null)?.name as string) ?? null,
  start_date: String(r.start_date).slice(0, 10),
  target_date: r.target_date ? String(r.target_date).slice(0, 10) : null,
  start_value: num(r.start_value),
  current_value: num(r.current_value),
  target_value: Number(r.target_value),
  unit: (r.unit as string) ?? null,
  status: r.status as GoalItem["status"],
  completed_at: (r.completed_at as string) ?? null,
  config: (r.config as GoalItem["config"]) ?? {},
});

const SELECT = "*, exercises(name)";
const ORDER = { active: 0, paused: 1, completed: 2, abandoned: 3 } as const;

export async function listGoals(): Promise<GoalItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select(SELECT).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map(toGoal).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

export async function getGoal(id: string): Promise<(GoalItem & { history: { date: string; value: number }[] }) | null> {
  const supabase = await createClient();
  const [g, h] = await Promise.all([
    supabase.from("goals").select(SELECT).eq("id", id).maybeSingle(),
    supabase.from("goal_progress").select("recorded_on, value").eq("goal_id", id).order("recorded_on", { ascending: true }).limit(400),
  ]);
  if (g.error) throw g.error;
  if (h.error) throw h.error;
  if (!g.data) return null;
  return { ...toGoal(g.data), history: (h.data ?? []).map((p) => ({ date: String(p.recorded_on).slice(0, 10), value: Number(p.value) })) };
}

export type GoalTemplate = {
  id: number;
  type: string;
  title: string;
  description: string;
  metric: string;
  direction: "increase" | "decrease";
  unit: string;
  target: number | null;
  durationDays: number | null;
  distanceKm: number | null;
  exercise: { id: number; name: string } | null;
};

export async function listTemplates(): Promise<GoalTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goal_templates").select("id, goal_type, title, description, metric, direction, default_unit, default_target, default_duration_days, config").order("goal_type").order("title");
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  // Strength templates name an exercise by slug; resolve it (best effort) against the exercise library.
  const slugs = [...new Set(rows.map((r) => (r.config as { exercise_slug?: string })?.exercise_slug).filter((s): s is string => Boolean(s)))];
  const bySlug = new Map<string, { id: number; name: string }>();
  if (slugs.length) {
    const { data: ex, error: exErr } = await supabase.from("exercises").select("id, name, source_id").in("source_id", slugs.map((s) => `seed:${s}`));
    if (exErr) throw exErr;
    for (const e of ex ?? []) bySlug.set(String(e.source_id).replace(/^seed:/, ""), { id: Number(e.id), name: String(e.name) });
  }
  return rows.map((r) => {
    const cfg = (r.config as { exercise_slug?: string; distance_km?: number }) ?? {};
    return {
      id: Number(r.id),
      type: String(r.goal_type),
      title: String(r.title),
      description: (r.description as string) ?? "",
      metric: String(r.metric),
      direction: r.direction as "increase" | "decrease",
      unit: (r.default_unit as string) ?? "",
      target: num(r.default_target),
      durationDays: num(r.default_duration_days),
      distanceKm: cfg.distance_km ?? null,
      exercise: cfg.exercise_slug ? (bySlug.get(cfg.exercise_slug) ?? null) : null,
    };
  });
}

export type SyncResult = { goalsUpdated: number; goalsCompleted: string[]; achievements: string[] };

/** Recomputes goal progress from your data, advances the habit streak and unlocks achievements (one RPC). */
export async function syncProgress(today: string): Promise<SyncResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_progress", { p_today: today });
  if (error) {
    if (error.code === "22023") throw new AppError("validation", "Your date does not match the server date. Check your time zone in Settings.");
    throw error;
  }
  const r = (data ?? {}) as { goals_updated?: number; goals_completed?: string[]; achievements?: string[] };
  return { goalsUpdated: Number(r.goals_updated ?? 0), goalsCompleted: r.goals_completed ?? [], achievements: r.achievements ?? [] };
}

function rowFor(userId: string, v: GoalInput) {
  const metric = findMetric(v.metric)!;
  return {
    user_id: userId,
    template_id: v.templateId ?? null,
    goal_type: v.type,
    title: v.title,
    metric: v.metric,
    direction: v.direction,
    exercise_id: metric.needsExercise ? (v.exerciseId ?? null) : null,
    start_date: v.startDate,
    target_date: v.targetDate ?? null,
    start_value: v.startValue ?? null,
    target_value: v.targetValue,
    unit: metric.key === "custom" ? (v.unit ?? null) : metric.unit,
    config: metric.needsDistance && v.distanceKm ? { distance_km: v.distanceKm } : {},
  };
}

export async function createGoal(userId: string, v: GoalInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").insert(rowFor(userId, v)).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateGoal(userId: string, v: GoalInput & { id: string }) {
  const supabase = await createClient();
  const { user_id: _owner, ...patch } = rowFor(userId, v);
  void _owner;
  const { data, error } = await supabase.from("goals").update({ ...patch, status: "active", completed_at: null }).eq("id", v.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "We could not find that goal.", 404);
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that goal.", 404);
}

export async function setGoalStatus(id: string, status: "active" | "paused" | "abandoned") {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").update({ status, completed_at: null }).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "We could not find that goal.", 404);
}

/** Manual update for custom goals. Auto goals follow your data and cannot be overridden. */
export async function addManualProgress(userId: string, goalId: string, date: string, value: number) {
  const g = await getGoal(goalId);
  if (!g) throw new AppError("not_found", "We could not find that goal.", 404);
  if (g.metric !== "custom") throw new AppError("conflict", "This goal updates itself from your data.", 409);
  if (g.status !== "active") throw new AppError("conflict", "Resume the goal before updating it.", 409);

  const supabase = await createClient();
  const { error } = await supabase.from("goal_progress").upsert({ goal_id: goalId, user_id: userId, recorded_on: date, value }, { onConflict: "goal_id,recorded_on" });
  if (error) throw error;

  const reached = g.direction === "increase" ? value >= g.target_value : value <= g.target_value;
  const { error: upErr } = await supabase
    .from("goals")
    .update({ current_value: value, start_value: g.start_value ?? value, ...(reached ? { status: "completed", completed_at: new Date().toISOString() } : {}) })
    .eq("id", goalId);
  if (upErr) throw upErr;
}

/** Page-load refresh. A sync failure (e.g. clock skew) must never break the page that shows the goals. */
export async function trySyncProgress(today: string): Promise<SyncResult | null> {
  try {
    return await syncProgress(today);
  } catch (e) {
    console.error("[sync-progress]", e);
    return null;
  }
}
