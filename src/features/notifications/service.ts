import { cache } from "react";
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
import { sendPushToUser } from "@/features/notifications/push-service";

type Row = Record<string, unknown>;

export type NotificationItem = { id: string; type: string; title: string; body: string | null; readAt: string | null; createdAt: string; data: Record<string, unknown> };

export async function listNotifications(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("id, type, title, body, data, read_at, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, type: r.type as string, title: r.title as string, body: (r.body as string) ?? null, readAt: (r.read_at as string) ?? null, createdAt: r.created_at as string, data: (r.data as Record<string, unknown>) ?? {} }));
}

export const unreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
});

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

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  workout_reminders: true,
  nutrition_reminders: true,
  hydration_reminders: true,
  recovery_alerts: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  max_per_day: 3,
  workout_time: "07:00",
  nutrition_time: "17:00",
  hydration_time: "14:00",
  min_sleep_hours: 6.0,
  min_streak_days: 3,
};

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
    workout_time: data.workout_time ? String(data.workout_time).slice(0, 5) : "07:00",
    nutrition_time: data.nutrition_time ? String(data.nutrition_time).slice(0, 5) : "17:00",
    hydration_time: data.hydration_time ? String(data.hydration_time).slice(0, 5) : "14:00",
    min_sleep_hours:
      data.min_sleep_hours !== undefined && data.min_sleep_hours !== null ? Number(data.min_sleep_hours) : 6.0,
    min_streak_days:
      data.min_streak_days !== undefined && data.min_streak_days !== null ? Number(data.min_streak_days) : 3,
  };
}

export async function savePrefs(userId: string, v: NotificationPrefsInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...v }, { onConflict: "user_id" });

  if (error) {
    if (error.code === "42703" || error.message.includes("column")) {
      const base = {
        enabled: v.enabled,
        workout_reminders: v.workout_reminders,
        nutrition_reminders: v.nutrition_reminders,
        hydration_reminders: v.hydration_reminders,
        recovery_alerts: v.recovery_alerts,
        quiet_hours_start: v.quiet_hours_start,
        quiet_hours_end: v.quiet_hours_end,
        max_per_day: v.max_per_day,
      };
      const { error: retryErr } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...base }, { onConflict: "user_id" });
      if (retryErr) throw retryErr;
      return;
    }
    throw error;
  }
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

  if (data && data.length > 0) {
    for (const d of drafts) {
      void sendPushToUser(userId, {
        title: d.title,
        body: d.body,
        url: "/notifications",
        tag: d.type,
      }).catch((err) => console.error("[notifications] Push dispatch error:", err));
    }
  }

  return { created: data?.length ?? 0 };
}

export type BackgroundNotificationResult = {
  ok: boolean;
  usersProcessed: number;
  notificationsCreated: number;
  pushesSent: number;
  pushesFailed: number;
  timestamp: string;
};

/**
 * Background cron job processor.
 * Runs with service-role admin privileges (bypassing RLS).
 * Scans active push subscribers, evaluates contextual rules per user,
 * inserts notifications into DB, and fires Web Push alarms to their devices.
 */
export async function processBackgroundNotifications(
  targetUserId?: string
): Promise<BackgroundNotificationResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.warn("[notifications-cron] Service role client unavailable:", err);
    return {
      ok: false,
      usersProcessed: 0,
      notificationsCreated: 0,
      pushesSent: 0,
      pushesFailed: 0,
      timestamp: new Date().toISOString(),
    };
  }

  let userIds: string[] = [];

  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("user_id");

    if (subsErr) {
      console.error("[notifications-cron] Failed to query subscriptions:", subsErr);
      return {
        ok: false,
        usersProcessed: 0,
        notificationsCreated: 0,
        pushesSent: 0,
        pushesFailed: 0,
        timestamp: new Date().toISOString(),
      };
    }

    if (!subs || subs.length === 0) {
      return {
        ok: true,
        usersProcessed: 0,
        notificationsCreated: 0,
        pushesSent: 0,
        pushesFailed: 0,
        timestamp: new Date().toISOString(),
      };
    }

    userIds = Array.from(new Set(subs.map((s) => s.user_id as string)));
  }

  let totalNotifications = 0;
  let totalPushesSent = 0;
  let totalPushesFailed = 0;
  let processedCount = 0;

  for (const uid of userIds) {
    try {
      const [profileRes, settingsRes, prefsRes] = await Promise.all([
        admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
        admin.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
        admin.from("notification_preferences").select("*").eq("user_id", uid).maybeSingle(),
      ]);

      const profile = profileRes.data;
      const settings = settingsRes.data;
      if (!profile || !settings) continue;

      const tz = profile.timezone || "Asia/Jakarta";
      const date = todayInTimeZone(tz);
      const minutes = minutesInTimeZone(tz);

      const rawPrefs = prefsRes.data;
      const prefs: NotificationPrefs = rawPrefs
        ? {
            enabled: Boolean(rawPrefs.enabled),
            workout_reminders: Boolean(rawPrefs.workout_reminders),
            nutrition_reminders: Boolean(rawPrefs.nutrition_reminders),
            hydration_reminders: Boolean(rawPrefs.hydration_reminders),
            recovery_alerts: Boolean(rawPrefs.recovery_alerts),
            quiet_hours_start: String(rawPrefs.quiet_hours_start).slice(0, 5),
            quiet_hours_end: String(rawPrefs.quiet_hours_end).slice(0, 5),
            max_per_day: Number(rawPrefs.max_per_day),
            workout_time: rawPrefs.workout_time ? String(rawPrefs.workout_time).slice(0, 5) : "07:00",
            nutrition_time: rawPrefs.nutrition_time ? String(rawPrefs.nutrition_time).slice(0, 5) : "17:00",
            hydration_time: rawPrefs.hydration_time ? String(rawPrefs.hydration_time).slice(0, 5) : "14:00",
            min_sleep_hours:
              rawPrefs.min_sleep_hours !== null && rawPrefs.min_sleep_hours !== undefined
                ? Number(rawPrefs.min_sleep_hours)
                : 6.0,
            min_streak_days:
              rawPrefs.min_streak_days !== null && rawPrefs.min_streak_days !== undefined
                ? Number(rawPrefs.min_streak_days)
                : 3,
          }
        : DEFAULT_PREFS;

      if (!prefs.enabled) continue;
      if (isQuietHours(minutes, prefs.quiet_hours_start, prefs.quiet_hours_end)) continue;

      const since = new Date(Date.now() - 36 * 3600_000).toISOString();
      const { data: recentRowsData } = await admin
        .from("notifications")
        .select("dedupe_key, type, created_at")
        .eq("user_id", uid)
        .gte("created_at", since);

      const recentRows = (recentRowsData ?? []) as { dedupe_key: string | null; type: string; created_at: string }[];
      const sentToday = recentRows.filter(
        (r) => REMINDER_TYPES.has(r.type) && todayInTimeZone(tz, new Date(r.created_at)) === date
      ).length;

      if (prefs.max_per_day - sentToday <= 0) continue;

      const fromDateWater = addDays(date, -6);
      const [plansRes, sessionsRes, foodLogsRes, waterRes, sleepRes, streakRes, goalsRes] = await Promise.all([
        admin
          .from("workout_plans")
          .select("id, name")
          .eq("user_id", uid)
          .eq("is_archived", false)
          .contains("scheduled_days", [weekdayOf(date)]),
        admin
          .from("workout_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("logged_on", date)
          .in("status", ["in_progress", "completed"]),
        admin
          .from("food_logs")
          .select("id, food_log_items(id, protein_g)")
          .eq("user_id", uid)
          .eq("logged_on", date),
        admin
          .from("water_logs")
          .select("amount_ml, logged_on")
          .eq("user_id", uid)
          .gte("logged_on", fromDateWater)
          .lte("logged_on", date),
        admin
          .from("sleep_logs")
          .select("duration_minutes")
          .eq("user_id", uid)
          .eq("sleep_date", date)
          .maybeSingle(),
        admin
          .from("streaks")
          .select("current_count, last_activity_date")
          .eq("user_id", uid)
          .eq("streak_type", "workout")
          .maybeSingle(),
        admin
          .from("goals")
          .select("id, title, direction, start_value, current_value, target_value, start_date, target_date, status")
          .eq("user_id", uid)
          .eq("status", "active")
          .gte("target_date", date)
          .lte("target_date", addDays(date, 7)),
      ]);

      let foodItemsCount = 0;
      let foodProteinG = 0;
      for (const log of (foodLogsRes.data ?? []) as Array<{ food_log_items: Array<{ protein_g: number | null }> }>) {
        const items = log.food_log_items ?? [];
        foodItemsCount += items.length;
        for (const it of items) {
          foodProteinG += Number(it.protein_g ?? 0);
        }
      }

      const waterMap = new Map<string, number>();
      for (const w of (waterRes.data ?? []) as Array<{ amount_ml: number; logged_on: string }>) {
        const dStr = String(w.logged_on).slice(0, 10);
        waterMap.set(dStr, (waterMap.get(dStr) ?? 0) + Number(w.amount_ml));
      }
      const todayWaterMl = waterMap.get(date) ?? 0;
      const priorDaysWater: number[] = [];
      for (let i = 1; i <= 6; i++) {
        const d = addDays(date, -i);
        const val = waterMap.get(d) ?? 0;
        if (val > 0) priorDaysWater.push(val);
      }
      const usualWaterMl = priorDaysWater.length >= 2 ? average(priorDaysWater) : null;

      const ctx: NotificationContext = {
        date,
        minutes,
        prefs,
        sentToday,
        existingKeys: new Set(recentRows.map((r) => r.dedupe_key).filter((k): k is string => Boolean(k))),
        scheduledPlan: plansRes.data?.[0] ? { name: (plansRes.data[0] as { name: string }).name } : null,
        workoutDoneOrActive: (sessionsRes.count ?? 0) > 0,
        nutrition: {
          itemsCount: foodItemsCount,
          proteinG: foodProteinG,
          proteinTargetG: Number(settings.protein_target_g ?? 120),
        },
        water: {
          todayMl: todayWaterMl,
          targetMl: Number(settings.water_target_ml ?? 2500),
          usualDailyMl: usualWaterMl,
        },
        sleepMinutes: sleepRes.data?.duration_minutes ? Number(sleepRes.data.duration_minutes) : null,
        workoutStreak: {
          current: Number(streakRes.data?.current_count ?? 0),
          lastActivityDate: streakRes.data?.last_activity_date
            ? String(streakRes.data.last_activity_date).slice(0, 10)
            : null,
        },
        goalsDue: ((goalsRes.data ?? []) as Row[]).map((g) => ({
          id: String(g.id),
          title: String(g.title),
          daysLeft: Math.round(
            (Date.parse(String(g.target_date) + "T00:00:00Z") - Date.parse(date + "T00:00:00Z")) / 86_400_000
          ),
          progressPct: goalProgressPct({
            direction: g.direction as "increase" | "decrease",
            start_value: g.start_value === null ? null : Number(g.start_value),
            current_value: g.current_value === null ? null : Number(g.current_value),
            target_value: Number(g.target_value),
            start_date: String(g.start_date).slice(0, 10),
            target_date: String(g.target_date).slice(0, 10),
            status: String(g.status),
          }),
        })),
      };

      const drafts = planNotifications(ctx);
      processedCount++;

      if (drafts.length === 0) continue;

      const { data: insertedRows, error: insertError } = await admin
        .from("notifications")
        .upsert(
          drafts.map((d) => ({
            user_id: uid,
            type: d.type,
            title: d.title,
            body: d.body,
            dedupe_key: d.dedupeKey,
          })),
          { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
        )
        .select("id");

      if (insertError) {
        console.error(`[notifications-cron] Failed to insert notifications for ${uid}:`, insertError);
        continue;
      }

      const createdCount = insertedRows?.length ?? 0;
      totalNotifications += createdCount;

      if (createdCount > 0) {
        for (const d of drafts) {
          const pushRes = await sendPushToUser(uid, {
            title: d.title,
            body: d.body,
            url: "/notifications",
            tag: d.type,
          });
          totalPushesSent += pushRes.sent;
          totalPushesFailed += pushRes.failed;
        }
      }
    } catch (userErr) {
      console.error(`[notifications-cron] Error processing user ${uid}:`, userErr);
    }
  }

  return {
    ok: true,
    usersProcessed: processedCount,
    notificationsCreated: totalNotifications,
    pushesSent: totalPushesSent,
    pushesFailed: totalPushesFailed,
    timestamp: new Date().toISOString(),
  };
}
