import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { getProfileAndSettings } from "@/features/profile/queries";
import { plansScheduledFor } from "@/features/workout/plans";
import { recentTotals } from "@/features/hydration/service";
import { goalProgressPct } from "@/lib/calculations/goals";
import { average } from "@/lib/calculations/analytics";
import { isQuietHours, planNotifications, type NotificationContext, type NotificationPrefs } from "@/lib/notifications/rules";
import { addDays, minutesInTimeZone, todayInTimeZone, weekdayOf } from "@/utils/date";
import type { NotificationPrefsInput } from "@/lib/validations/goals";

type Row = Record<string, unknown>;

export type NotificationItem = { id: string; type: string; title: string; body: string | null; readAt: string | null; createdAt: string; data: Record<string, unknown> };

export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("id, type, title, body, data, read_at, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, type: r.type as string, title: r.title as string, body: (r.body as string) ?? null, readAt: (r.read_at as string) ?? null, createdAt: r.created_at as string, data: (r.data as Record<string, unknown>) ?? {} }));
}

export async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

export async function markAllRead() {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

const DEFAULT_PREFS: NotificationPrefs = { enabled: true, workout_reminders: true, nutrition_reminders: true, hydration_reminders: true, recovery_alerts: true, quiet_hours_start: "22:00", quiet_hours_end: "07:00", max_per_day: 3 };

export async function getPrefs(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_preferences").select("*").maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFS;
  return {
    enabled: Boolean(data.enabled),
    workout_reminders: Boolean(data.workout_reminders),
    nutrition_reminders: Boolean(data.nutrition_reminders),
    hydration_reminders: Boolean(data.hydration_reminders),
    recovery_alerts: Boolean(data.recovery_alerts),
    quiet_hours_start: String(data.quiet_hours_start).slice(0, 5),
    quiet_hours_end: String(data.quiet_hours_end).slice(0, 5),
    max_per_day: Number(data.max_per_day),
  };
}

export async function savePrefs(userId: string, v: NotificationPrefsInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, ...v }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Topics that count against the daily cap. Achievement / goal-reached messages are events, not reminders. */
const REMINDER_TYPES = new Set(["workout_reminder", "protein_gap", "hydration", "recovery", "streak_risk", "goal_due"]);

export type GenerateResult = { created: number; skipped?: "disabled" | "quiet_hours" | "not_configured" | "no_profile" };

/**
 * Builds a snapshot of the user's OWN data, asks the pure rule engine what (if anything) to say, and stores it.
 * Reads run as the user (RLS). The insert uses the service-role client because clients have no INSERT privilege on
 * `notifications` (so messages cannot be forged); it is scoped to the already-verified `userId`.
 */
export async function generateNotifications(userId: string): Promise<GenerateResult> {
  const { profile, settings } = await getProfileAndSettings(userId);
  if (!profile || !settings) return { created: 0, skipped: "no_profile" };

  const tz = profile.timezone;
  const date = todayInTimeZone(tz);
  const minutes = minutesInTimeZone(tz);
  const prefs = await getPrefs();
  if (!prefs.enabled) return { created: 0, skipped: "disabled" };
  if (isQuietHours(minutes, prefs.quiet_hours_start, prefs.quiet_hours_end)) return { created: 0, skipped: "quiet_hours" };

  const supabase = await createClient();
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [plans, sessions, nutrition, water, sleep, streak, goals, recent] = await Promise.all([
    plansScheduledFor(weekdayOf(date)),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("logged_on", date).in("status", ["in_progress", "completed"]),
    supabase.rpc("daily_nutrition_totals", { p_date: date }),
    recentTotals(date, 7),
    supabase.from("sleep_logs").select("duration_minutes").eq("sleep_date", date).maybeSingle(),
    supabase.from("streaks").select("current_count, last_activity_date").eq("streak_type", "workout").maybeSingle(),
    supabase.from("goals").select("id, title, direction, start_value, current_value, target_value, start_date, target_date, status").eq("status", "active").gte("target_date", date).lte("target_date", addDays(date, 7)),
    supabase.from("notifications").select("dedupe_key, type, created_at").gte("created_at", since),
  ]);
  for (const r of [sessions, nutrition, sleep, streak, goals, recent]) if (r.error) throw r.error;

  const n = ((nutrition.data as Row[] | null) ?? [])[0];
  const prior = water.slice(0, 6).filter((d) => d.totalMl > 0).map((d) => d.totalMl);
  const usual = prior.length >= 2 ? average(prior) : null;
  const recentRows = (recent.data ?? []) as { dedupe_key: string | null; type: string; created_at: string }[];

  const ctx: NotificationContext = {
    date,
    minutes,
    prefs,
    sentToday: recentRows.filter((r) => REMINDER_TYPES.has(r.type) && todayInTimeZone(tz, new Date(r.created_at)) === date).length,
    existingKeys: new Set(recentRows.map((r) => r.dedupe_key).filter((k): k is string => Boolean(k))),
    scheduledPlan: plans[0] ? { name: plans[0].name } : null,
    workoutDoneOrActive: (sessions.count ?? 0) > 0,
    nutrition: { itemsCount: Number(n?.items_count ?? 0), proteinG: Number(n?.protein_g ?? 0), proteinTargetG: settings.protein_target_g },
    water: { todayMl: water.at(-1)?.totalMl ?? 0, targetMl: settings.water_target_ml, usualDailyMl: usual },
    sleepMinutes: sleep.data ? Number(sleep.data.duration_minutes) : null,
    workoutStreak: { current: Number(streak.data?.current_count ?? 0), lastActivityDate: streak.data?.last_activity_date ? String(streak.data.last_activity_date).slice(0, 10) : null },
    goalsDue: ((goals.data ?? []) as Row[]).map((g) => ({
      id: String(g.id),
      title: String(g.title),
      daysLeft: Math.round((Date.parse(String(g.target_date) + "T00:00:00Z") - Date.parse(date + "T00:00:00Z")) / 86_400_000),
      progressPct: goalProgressPct({ direction: g.direction as "increase" | "decrease", start_value: g.start_value === null ? null : Number(g.start_value), current_value: g.current_value === null ? null : Number(g.current_value), target_value: Number(g.target_value), start_date: String(g.start_date).slice(0, 10), target_date: String(g.target_date).slice(0, 10), status: String(g.status) }),
    })),
  };

  const drafts = planNotifications(ctx);
  if (drafts.length === 0) return { created: 0 };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.warn("[notifications] SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY is not configured; contextual notifications are disabled.");
    return { created: 0, skipped: "not_configured" };
  }
  const { data, error } = await admin
    .from("notifications")
    .upsert(drafts.map((d) => ({ user_id: userId, type: d.type, title: d.title, body: d.body, dedupe_key: d.dedupeKey })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new AppError("unknown", "Could not save notifications.", 500);
  return { created: data?.length ?? 0 };
}
