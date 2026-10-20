import { calculateGoalProgress } from "@/lib/calculations/progress";
import { addDays } from "@/utils/date";

const DAY_MS = 86_400_000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS);

export type GoalLike = {
  direction: "increase" | "decrease";
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  start_date: string;
  target_date: string | null;
  status: string;
};

/** 0–100. Completed goals are always 100; a goal with no data yet is 0. */
export function goalProgressPct(g: GoalLike): number {
  if (g.status === "completed") return 100;
  if (g.current_value === null) return 0;
  const start = g.start_value ?? g.current_value;
  return Math.round(calculateGoalProgress(start, g.current_value, g.target_value, g.direction));
}

export type Pace = "ahead" | "on_track" | "behind" | "overdue" | "no_deadline" | "done";

/** Compares actual progress with straight-line progress between the start and target dates (±10 points = on track). */
export function goalPace(g: GoalLike, today: string): Pace {
  if (g.status === "completed") return "done";
  if (!g.target_date) return "no_deadline";
  const total = daysBetween(g.start_date, g.target_date);
  if (total <= 0) return "no_deadline";
  const actual = goalProgressPct(g);
  if (today > g.target_date) return actual >= 100 ? "done" : "overdue";
  const elapsed = Math.min(Math.max(daysBetween(g.start_date, today), 0), total);
  const diff = actual - (elapsed / total) * 100;
  return diff >= 10 ? "ahead" : diff >= -10 ? "on_track" : "behind";
}

export const daysLeft = (targetDate: string | null, today: string) => (targetDate ? daysBetween(today, targetDate) : null);

export const PACE_LABEL: Record<Pace, string> = { ahead: "Ahead of pace", on_track: "On track", behind: "Behind pace", overdue: "Past due date", no_deadline: "No deadline", done: "Reached" };

/** Does the target make sense relative to the start? (A "decrease" goal needs a target below the start.) */
export function validateGoalDirection(direction: "increase" | "decrease", start: number | null | undefined, target: number): string | null {
  if (start === null || start === undefined || Number.isNaN(start)) return null;
  if (direction === "decrease" && target >= start) return "For a goal to go down, the target must be lower than the start value.";
  if (direction === "increase" && target <= start) return "For a goal to go up, the target must be higher than the start value.";
  return null;
}

// ── Streaks ──────────────────────────────────────────────────────────────────────

export type StreakRow = { current_count: number; longest_count: number; last_activity_date: string | null };
export type StreakState = "done_today" | "at_risk" | "broken" | "none";

/**
 * Streaks are maintained incrementally in the database; whether one is still alive is decided at READ time:
 * active if you acted today or yesterday (yesterday = today still saves it), otherwise it is broken.
 */
export function effectiveStreak(row: StreakRow | undefined, today: string): { current: number; longest: number; state: StreakState } {
  if (!row || !row.last_activity_date) return { current: 0, longest: row?.longest_count ?? 0, state: "none" };
  const gap = daysBetween(row.last_activity_date, today);
  if (gap <= 0) return { current: row.current_count, longest: row.longest_count, state: "done_today" };
  if (gap === 1) return { current: row.current_count, longest: row.longest_count, state: "at_risk" };
  return { current: 0, longest: row.longest_count, state: "broken" };
}

export const isYesterday = (date: string | null, today: string) => date !== null && date === addDays(today, -1);
