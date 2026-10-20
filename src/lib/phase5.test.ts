import { describe, expect, it } from "vitest";
import { GOAL_METRICS, findMetric, metricsFor } from "@/lib/goals/metrics";
import { daysLeft, effectiveStreak, goalPace, goalProgressPct, validateGoalDirection, type GoalLike } from "@/lib/calculations/goals";
import { consistencyPct, macroDistribution, summarizeNutrition, weeksOnTarget, zeroFillWeeks } from "@/lib/calculations/analytics";
import { buildMonthGrid, isMonthKey, lastOfMonth, shiftMonth, weekdayLabels } from "@/lib/calendar/grid";
import { THRESHOLDS, isQuietHours, planNotifications, type NotificationContext } from "@/lib/notifications/rules";

const goal = (o: Partial<GoalLike> = {}): GoalLike => ({ direction: "decrease", start_value: 80, current_value: 75, target_value: 70, start_date: "2026-09-01", target_date: "2026-11-01", status: "active", ...o });

describe("goal metrics catalogue", () => {
  it("has unique keys and every type has metrics plus a custom option", () => {
    const keys = GOAL_METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of ["body", "strength", "running", "nutrition", "habit"] as const) expect(metricsFor(t).at(-1)?.key).toBe("custom");
  });
  it("strength metrics need an exercise, run time needs a distance", () => {
    expect(findMetric("one_rep_max_kg")?.needsExercise).toBe(true);
    expect(findMetric("run_time_min")?.needsDistance).toBe(true);
  });
  it("only the SQL-known rate metrics are flagged as rates", () => {
    expect(GOAL_METRICS.filter((m) => m.rate).map((m) => m.key).sort()).toEqual(["daily_fiber_g", "daily_protein_g", "daily_water_ml", "monthly_run_km", "sleep_hours", "workouts_per_week"]);
  });
});

describe("goalProgressPct", () => {
  it("80 → 70 kg, now 75 = 50% (spec: 75.4 → 70 style)", () => expect(goalProgressPct(goal())).toBe(50));
  it("75.4 from 80 toward 70 is 46%", () => expect(goalProgressPct(goal({ current_value: 75.4 }))).toBe(46));
  it("bench 60 → 80, now 70 = 50%", () => expect(goalProgressPct(goal({ direction: "increase", start_value: 60, current_value: 70, target_value: 80 }))).toBe(50));
  it("completed is always 100, no data is 0, wrong direction is 0", () => {
    expect(goalProgressPct(goal({ status: "completed", current_value: 90 }))).toBe(100);
    expect(goalProgressPct(goal({ current_value: null }))).toBe(0);
    expect(goalProgressPct(goal({ current_value: 82 }))).toBe(0);
  });
});

describe("goalPace", () => {
  it("compares actual with straight-line progress", () => {
    // 61-day window; on 2026-10-01 (30 days in) expected ≈ 49%
    expect(goalPace(goal({ current_value: 75 }), "2026-10-01")).toBe("on_track"); // 50% actual
    expect(goalPace(goal({ current_value: 72 }), "2026-10-01")).toBe("ahead"); // 80%
    expect(goalPace(goal({ current_value: 79 }), "2026-10-01")).toBe("behind"); // 10%
  });
  it("handles no deadline, done and overdue", () => {
    expect(goalPace(goal({ target_date: null }), "2026-10-01")).toBe("no_deadline");
    expect(goalPace(goal({ status: "completed" }), "2026-10-01")).toBe("done");
    expect(goalPace(goal({ current_value: 76 }), "2026-12-01")).toBe("overdue");
  });
  it("days left", () => {
    expect(daysLeft("2026-10-10", "2026-10-08")).toBe(2);
    expect(daysLeft(null, "2026-10-08")).toBeNull();
  });
});

describe("validateGoalDirection", () => {
  it("rejects targets on the wrong side of the start", () => {
    expect(validateGoalDirection("decrease", 80, 85)).toMatch(/lower/);
    expect(validateGoalDirection("increase", 60, 50)).toMatch(/higher/);
  });
  it("accepts sensible goals and unknown starts", () => {
    expect(validateGoalDirection("decrease", 80, 70)).toBeNull();
    expect(validateGoalDirection("increase", null, 100)).toBeNull();
  });
});

describe("effectiveStreak (decided at read time)", () => {
  const row = { current_count: 5, longest_count: 9, last_activity_date: "2026-10-08" };
  it("done today / at risk yesterday / broken after a missed day", () => {
    expect(effectiveStreak(row, "2026-10-08")).toEqual({ current: 5, longest: 9, state: "done_today" });
    expect(effectiveStreak(row, "2026-10-09")).toEqual({ current: 5, longest: 9, state: "at_risk" });
    expect(effectiveStreak(row, "2026-10-10")).toEqual({ current: 0, longest: 9, state: "broken" });
  });
  it("no activity yet", () => expect(effectiveStreak(undefined, "2026-10-08")).toEqual({ current: 0, longest: 0, state: "none" }));
});

describe("analytics helpers", () => {
  it("zero-fills missing weeks", () => {
    const out = zeroFillWeeks([{ week: "2026-10-05", workouts: 3, volume_kg: 5000 }], "2026-09-21", "2026-10-08", 1);
    expect(out.map((r) => r.week)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(out.map((r) => r.workouts)).toEqual([0, 0, 3]);
  });
  it("macro distribution sums to exactly 100", () => {
    const d = macroDistribution({ protein_g: 150, carbs_g: 280, fat_g: 75 })!;
    expect(d.protein + d.carbs + d.fat).toBe(100);
    expect(d.protein).toBe(25); // 600 of 2395 kcal
    expect(macroDistribution({ protein_g: 0, carbs_g: 0, fat_g: 0 })).toBeNull();
  });
  it("averages only over days that were logged", () => {
    const s = summarizeNutrition([
      { date: "a", calories: 2000, protein_g: 100, carbs_g: 200, fat_g: 60, fiber_g: 20 },
      { date: "b", calories: 2400, protein_g: 140, carbs_g: 260, fat_g: 80, fiber_g: 30 },
    ])!;
    expect(s).toMatchObject({ daysLogged: 2, calories: 2200, protein_g: 120, fiber_g: 25 });
    expect(summarizeNutrition([])).toBeNull();
  });
  it("consistency and weeks on target", () => {
    expect(consistencyPct(5, 7)).toBe(71);
    expect(consistencyPct(0, 0)).toBe(0);
    expect(weeksOnTarget([{ week: "a", workouts: 4, volume_kg: 0 }, { week: "b", workouts: 2, volume_kg: 0 }], 3)).toEqual({ hit: 1, total: 2 });
  });
});

describe("calendar grid", () => {
  it("validates month keys and shifts across years", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("finds month ends, including leap years", () => {
    expect(lastOfMonth("2026-10")).toBe("2026-10-31");
    expect(lastOfMonth("2028-02")).toBe("2028-02-29");
    expect(lastOfMonth("2026-02")).toBe("2026-02-28");
  });
  it("builds full Monday-first weeks (Oct 2026 starts on a Thursday)", () => {
    const g = buildMonthGrid("2026-10", 1);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0]![0]!.date).toBe("2026-09-28");
    expect(g[0]![3]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(g.at(-1)!.at(-1)!.date).toBe("2026-11-01");
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(31);
  });
  it("supports Sunday-first weeks", () => {
    expect(buildMonthGrid("2026-10", 0)[0]![0]!.date).toBe("2026-09-27");
    expect(weekdayLabels(0)[0]).toBe("Sun");
    expect(weekdayLabels(1)[0]).toBe("Mon");
  });
});

describe("quiet hours", () => {
  it("handles windows that wrap midnight", () => {
    expect(isQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(isQuietHours(3 * 60, "22:00:00", "07:00:00")).toBe(true);
    expect(isQuietHours(7 * 60, "22:00", "07:00")).toBe(false); // end exclusive
    expect(isQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
  });
  it("handles same-day windows and an empty window", () => {
    expect(isQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
    expect(isQuietHours(15 * 60, "12:00", "14:00")).toBe(false);
    expect(isQuietHours(5 * 60, "08:00", "08:00")).toBe(false);
  });
});

const ctx = (o: Partial<NotificationContext> = {}): NotificationContext => ({
  date: "2026-10-08",
  minutes: 18 * 60,
  prefs: { enabled: true, workout_reminders: true, nutrition_reminders: true, hydration_reminders: true, recovery_alerts: true, quiet_hours_start: "22:00", quiet_hours_end: "07:00", max_per_day: 3 },
  sentToday: 0,
  existingKeys: new Set(),
  scheduledPlan: null,
  workoutDoneOrActive: false,
  nutrition: { itemsCount: 0, proteinG: 0, proteinTargetG: 150 },
  water: { todayMl: 2500, targetMl: 2500, usualDailyMl: null }, // on pace by default so each test isolates one rule
  sleepMinutes: null,
  workoutStreak: { current: 0, lastActivityDate: null },
  goalsDue: [],
  ...o,
});
const types = (c: NotificationContext) => planNotifications(c).map((d) => d.type);

describe("planNotifications", () => {
  it("says nothing when there is nothing to say", () => expect(planNotifications(ctx())).toEqual([]));

  it("workout reminder uses the plan name (spec example)", () => {
    const [d] = planNotifications(ctx({ minutes: 9 * 60, scheduledPlan: { name: "Push Day" } }));
    expect(d).toMatchObject({ type: "workout_reminder", body: "Push Day is scheduled today.", dedupeKey: "workout:2026-10-08" });
  });
  it("no workout reminder once you trained, or too early/late", () => {
    expect(types(ctx({ minutes: 9 * 60, scheduledPlan: { name: "Push" }, workoutDoneOrActive: true }))).toEqual([]);
    expect(types(ctx({ minutes: 6 * 60 + 30, scheduledPlan: { name: "Push" } }))).toEqual([]);
    expect(types(ctx({ minutes: 20 * 60 + 30, scheduledPlan: { name: "Push" } }))).toEqual([]);
  });

  it("protein gap (spec example wording, rounded to 5 g)", () => {
    const [d] = planNotifications(ctx({ minutes: 18 * 60, nutrition: { itemsCount: 4, proteinG: 115, proteinTargetG: 150 } }));
    expect(d).toMatchObject({ type: "protein_gap", body: "You still need approximately 35g protein to hit today's target." });
  });
  it("protein gap needs real logging, a big enough gap and the evening", () => {
    expect(types(ctx({ nutrition: { itemsCount: 0, proteinG: 0, proteinTargetG: 150 } }))).toEqual([]); // not tracking: never nag
    expect(types(ctx({ nutrition: { itemsCount: 3, proteinG: 140, proteinTargetG: 150 } }))).toEqual([]); // 10 g left
    expect(types(ctx({ minutes: 12 * 60, nutrition: { itemsCount: 3, proteinG: 20, proteinTargetG: 150 } }))).toEqual([]); // too early
  });

  it("hydration compares with usual intake, rounded to 50 ml (spec example)", () => {
    // 17:00 → 2/3 of the waking day; usual 3000 ml → expected 2000; drank 1400 → gap 600
    const [d] = planNotifications(ctx({ minutes: 17 * 60, water: { todayMl: 1400, targetMl: 2500, usualDailyMl: 3000 } }));
    expect(d).toMatchObject({ type: "hydration", body: "You're about 600ml below your usual water intake so far." });
  });
  it("hydration falls back to the target and stays quiet when on pace", () => {
    expect(planNotifications(ctx({ minutes: 17 * 60, water: { todayMl: 500, targetMl: 2500, usualDailyMl: null } }))[0]?.body).toMatch(/target pace/);
    expect(types(ctx({ minutes: 17 * 60, water: { todayMl: 1800, targetMl: 2500, usualDailyMl: 2500 } }))).toEqual([]);
  });

  it("short sleep warns in the morning only (spec example wording)", () => {
    const [d] = planNotifications(ctx({ minutes: 8 * 60, sleepMinutes: 340 }));
    expect(d).toMatchObject({ type: "recovery", body: "You only slept 5h 40m. Consider reducing today's training intensity." });
    expect(types(ctx({ minutes: 15 * 60, sleepMinutes: 340 }))).toEqual([]);
    expect(types(ctx({ minutes: 8 * 60, sleepMinutes: THRESHOLDS.shortSleepMinutes }))).toEqual([]);
    expect(types(ctx({ minutes: 8 * 60, sleepMinutes: null }))).toEqual([]);
  });

  it("streak at risk only for real streaks that end tonight", () => {
    const base = { minutes: 19 * 60, workoutStreak: { current: 5, lastActivityDate: "2026-10-07" } };
    expect(planNotifications(ctx(base))[0]).toMatchObject({ type: "streak_risk", body: "Your 5-day workout streak ends today unless you train." });
    expect(types(ctx({ ...base, workoutStreak: { current: 2, lastActivityDate: "2026-10-07" } }))).toEqual([]);
    expect(types(ctx({ ...base, workoutStreak: { current: 5, lastActivityDate: "2026-10-06" } }))).toEqual([]);
    expect(types(ctx({ ...base, workoutDoneOrActive: true }))).toEqual([]);
  });

  it("goal check-in picks the nearest due goal that is behind", () => {
    const [d] = planNotifications(ctx({ goalsDue: [{ id: "a", title: "Far", progressPct: 10, daysLeft: 6 }, { id: "b", title: "Near", progressPct: 40, daysLeft: 2 }, { id: "c", title: "Fine", progressPct: 90, daysLeft: 1 }] }));
    expect(d).toMatchObject({ type: "goal_due", dedupeKey: "goal_due:b" });
    expect(d!.body).toBe('"Near" is due in 2 days and you\'re at 40%.');
  });
});

describe("planNotifications: not spamming", () => {
  const busy = () =>
    ctx({
      minutes: 18 * 60,
      scheduledPlan: { name: "Push Day" },
      sleepMinutes: 300,
      nutrition: { itemsCount: 3, proteinG: 40, proteinTargetG: 150 },
      water: { todayMl: 300, targetMl: 2500, usualDailyMl: 2500 },
      workoutStreak: { current: 6, lastActivityDate: "2026-10-07" },
    });

  it("a busy day is capped by max_per_day and ordered by priority", () => {
    const t = types(busy());
    expect(t).toHaveLength(3);
    expect(t).toEqual(["workout_reminder", "streak_risk", "protein_gap"]); // sleep alert is morning-only here
  });
  it("respects what was already sent today", () => {
    expect(planNotifications({ ...busy(), sentToday: 2 })).toHaveLength(1);
    expect(planNotifications({ ...busy(), sentToday: 3 })).toEqual([]);
  });
  it("never repeats a topic that already exists for the day", () => {
    const c = { ...busy(), existingKeys: new Set(["workout:2026-10-08", "protein:2026-10-08"]) };
    expect(types(c)).toEqual(["streak_risk", "hydration"]);
  });
  it("is silent in quiet hours and when disabled", () => {
    expect(planNotifications({ ...busy(), minutes: 23 * 60 })).toEqual([]);
    expect(planNotifications({ ...busy(), prefs: { ...busy().prefs, enabled: false } })).toEqual([]);
  });
  it("each category toggle switches only its own rule", () => {
    const off = (k: "workout_reminders" | "nutrition_reminders" | "hydration_reminders" | "recovery_alerts") => ({ ...busy(), minutes: 18 * 60, prefs: { ...busy().prefs, max_per_day: 10, [k]: false } });
    expect(types(off("workout_reminders"))).not.toContain("workout_reminder");
    expect(types(off("workout_reminders"))).not.toContain("streak_risk");
    expect(types(off("nutrition_reminders"))).not.toContain("protein_gap");
    expect(types(off("hydration_reminders"))).not.toContain("hydration");
    expect(types(off("nutrition_reminders"))).toContain("hydration");
  });
  it("a daily cap of 0 means nothing is ever sent", () => {
    expect(planNotifications({ ...busy(), prefs: { ...busy().prefs, max_per_day: 0 } })).toEqual([]);
  });
});
