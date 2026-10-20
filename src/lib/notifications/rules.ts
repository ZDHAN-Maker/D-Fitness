/**
 * Contextual notification rules. PURE: given a snapshot of the user's own data and preferences, decide
 * what (if anything) to say. Nothing here invents data and nothing talks to the database, which keeps the
 * "do not spam" guarantees (quiet hours, daily cap, one message per topic per day) unit-testable.
 */
import { formatDuration } from "@/utils/format";
import { addDays } from "@/utils/date";

export type NotificationPrefs = {
  enabled: boolean;
  workout_reminders: boolean;
  nutrition_reminders: boolean;
  hydration_reminders: boolean;
  recovery_alerts: boolean;
  quiet_hours_start: string; // "22:00" or "22:00:00"
  quiet_hours_end: string;
  max_per_day: number;
};

export type NotificationContext = {
  date: string; // user-local YYYY-MM-DD
  minutes: number; // user-local minutes since midnight
  prefs: NotificationPrefs;
  sentToday: number;
  existingKeys: ReadonlySet<string>;
  scheduledPlan: { name: string } | null;
  workoutDoneOrActive: boolean;
  nutrition: { itemsCount: number; proteinG: number; proteinTargetG: number };
  water: { todayMl: number; targetMl: number; usualDailyMl: number | null };
  sleepMinutes: number | null; // last night's sleep (wake date = today)
  workoutStreak: { current: number; lastActivityDate: string | null };
  goalsDue: { id: string; title: string; progressPct: number; daysLeft: number }[];
};

export type NotificationDraft = { type: string; title: string; body: string; dedupeKey: string; priority: number };

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Quiet hours may wrap midnight (22:00 → 07:00). Start is inclusive, end is exclusive. */
export function isQuietHours(minutes: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const between = (m: number, from: number, to: number) => m >= from && m <= to;

// Waking-day window used to turn a daily water target into "where you should be by now".
const DAY_START = 7 * 60;
const DAY_END = 22 * 60;

export const THRESHOLDS = {
  shortSleepMinutes: 360,
  proteinGapMinGrams: 25,
  proteinGapMinShare: 0.15,
  hydrationGapMl: 500,
  goalDueDays: 7,
  goalDueBelowPct: 70,
  streakMin: 3,
} as const;

export function planNotifications(ctx: NotificationContext): NotificationDraft[] {
  const { prefs, date, minutes } = ctx;
  if (!prefs.enabled) return [];
  if (isQuietHours(minutes, prefs.quiet_hours_start, prefs.quiet_hours_end)) return [];
  const room = prefs.max_per_day - ctx.sentToday;
  if (room <= 0) return [];

  const out: NotificationDraft[] = [];

  // 1. Short night: say it in the morning, before training.
  if (prefs.recovery_alerts && ctx.sleepMinutes !== null && ctx.sleepMinutes > 0 && ctx.sleepMinutes < THRESHOLDS.shortSleepMinutes && between(minutes, 6 * 60, 12 * 60)) {
    out.push({ type: "recovery", priority: 1, dedupeKey: `sleep:${date}`, title: "Short night", body: `You only slept ${formatDuration(ctx.sleepMinutes)}. Consider reducing today's training intensity.` });
  }

  // 2. Scheduled workout not started yet.
  if (prefs.workout_reminders && ctx.scheduledPlan && !ctx.workoutDoneOrActive && between(minutes, 7 * 60, 20 * 60)) {
    out.push({ type: "workout_reminder", priority: 2, dedupeKey: `workout:${date}`, title: "Workout today", body: `${ctx.scheduledPlan.name} is scheduled today.` });
  }

  // 3. A real streak that ends tonight.
  const s = ctx.workoutStreak;
  if (prefs.workout_reminders && !ctx.workoutDoneOrActive && s.current >= THRESHOLDS.streakMin && s.lastActivityDate === addDays(date, -1) && between(minutes, 18 * 60, 21 * 60)) {
    out.push({ type: "streak_risk", priority: 3, dedupeKey: `streak:${date}`, title: "Keep your streak", body: `Your ${s.current}-day workout streak ends today unless you train.` });
  }

  // 4. Protein gap: only for people who are logging food today (never nag someone who is not tracking).
  const n = ctx.nutrition;
  const proteinLeft = n.proteinTargetG - n.proteinG;
  if (prefs.nutrition_reminders && n.itemsCount > 0 && minutes >= 17 * 60 && proteinLeft >= THRESHOLDS.proteinGapMinGrams && proteinLeft >= n.proteinTargetG * THRESHOLDS.proteinGapMinShare) {
    out.push({ type: "protein_gap", priority: 4, dedupeKey: `protein:${date}`, title: "Protein check", body: `You still need approximately ${roundTo(proteinLeft, 5)}g protein to hit today's target.` });
  }

  // 5. Hydration behind pace: compare with your usual intake (or the target if there is no history).
  const w = ctx.water;
  if (prefs.hydration_reminders && minutes >= 14 * 60 && minutes <= 21 * 60) {
    const basis = w.usualDailyMl && w.usualDailyMl > 0 ? w.usualDailyMl : w.targetMl;
    const fraction = Math.min(1, Math.max(0, (minutes - DAY_START) / (DAY_END - DAY_START)));
    const gap = basis * fraction - w.todayMl;
    if (gap >= THRESHOLDS.hydrationGapMl) {
      out.push({ type: "hydration", priority: 5, dedupeKey: `hydration:${date}`, title: "Time for water", body: `You're about ${roundTo(gap, 50)}ml below your ${w.usualDailyMl ? "usual water intake" : "target pace"} so far.` });
    }
  }

  // 6. The nearest goal that is due soon and well short of the target.
  const due = ctx.goalsDue
    .filter((g) => g.daysLeft >= 0 && g.daysLeft <= THRESHOLDS.goalDueDays && g.progressPct < THRESHOLDS.goalDueBelowPct)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
  if (due) {
    out.push({ type: "goal_due", priority: 6, dedupeKey: `goal_due:${due.id}`, title: "Goal check-in", body: `"${due.title}" is due ${due.daysLeft === 0 ? "today" : `in ${due.daysLeft} day${due.daysLeft === 1 ? "" : "s"}`} and you're at ${due.progressPct}%.` });
  }

  return out
    .filter((d) => !ctx.existingKeys.has(d.dedupeKey))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, room);
}
