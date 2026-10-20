import { describe, expect, it } from "vitest";
import { goalSchema, goalStatusSchema, manualProgressSchema, notificationPrefsSchema } from "./goals";

const base = { type: "body", title: "Reach 70 kg", metric: "weight_kg", direction: "decrease", targetValue: 70, startValue: 75.4, startDate: "2026-10-01", targetDate: "2026-12-01" } as const;

describe("goalSchema", () => {
  it("accepts the spec example (75.4 → 70 kg)", () => expect(goalSchema.safeParse(base).success).toBe(true));
  it("accepts a strength goal only with an exercise, and a run-time goal only with a distance", () => {
    const strength = { ...base, type: "strength", metric: "one_rep_max_kg", direction: "increase", startValue: 60, targetValue: 80 };
    expect(goalSchema.safeParse(strength).success).toBe(false);
    expect(goalSchema.safeParse({ ...strength, exerciseId: 12 }).success).toBe(true);
    const run = { ...base, type: "running", metric: "run_time_min", startValue: undefined, targetValue: 28 };
    expect(goalSchema.safeParse(run).success).toBe(false);
    expect(goalSchema.safeParse({ ...run, distanceKm: 5 }).success).toBe(true);
    expect(goalSchema.safeParse({ ...run, distanceKm: 4.2 }).success).toBe(false);
  });
  it("rejects a metric that does not belong to the goal type", () => {
    expect(goalSchema.safeParse({ ...base, type: "nutrition" }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, type: "nutrition", metric: "custom", targetValue: 5, startValue: undefined, direction: "increase" }).success).toBe(true);
  });
  it("rejects a target on the wrong side of the start", () => {
    expect(goalSchema.safeParse({ ...base, targetValue: 80 }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, direction: "increase", targetValue: 70 }).success).toBe(false);
  });
  it("rejects a target date before the start date and unknown metrics", () => {
    expect(goalSchema.safeParse({ ...base, targetDate: "2026-09-01" }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, metric: "bogus" }).success).toBe(false);
  });
  it("accepts a deadline months away but not an absurd one", () => {
    expect(goalSchema.safeParse({ ...base, targetDate: "2027-03-01" }).success).toBe(true);
    expect(goalSchema.safeParse({ ...base, targetDate: "2099-01-01" }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, targetDate: "not-a-date" }).success).toBe(false);
  });
  it("needs a title and a positive target; blanks are treated as absent", () => {
    expect(goalSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, targetValue: 0, startValue: undefined }).success).toBe(false);
    const r = goalSchema.parse({ ...base, startValue: "", targetDate: "" });
    expect(r.startValue).toBeUndefined();
    expect(r.targetDate).toBeUndefined();
  });
});

describe("other goal schemas", () => {
  it("only allows pause / resume / abandon from the client (completion is computed)", () => {
    const id = "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11";
    expect(goalStatusSchema.safeParse({ id, status: "paused" }).success).toBe(true);
    expect(goalStatusSchema.safeParse({ id, status: "completed" }).success).toBe(false);
  });
  it("manual progress needs a finite value", () => {
    const goalId = "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11";
    expect(manualProgressSchema.safeParse({ goalId, date: "2026-10-08", value: 3 }).success).toBe(true);
    expect(manualProgressSchema.safeParse({ goalId, date: "2026-10-08", value: Number.NaN }).success).toBe(false);
  });
  it("notification prefs validate times and the daily cap", () => {
    const ok = { enabled: true, workout_reminders: true, nutrition_reminders: true, hydration_reminders: true, recovery_alerts: true, quiet_hours_start: "22:00", quiet_hours_end: "07:00", max_per_day: 3 };
    expect(notificationPrefsSchema.safeParse(ok).success).toBe(true);
    expect(notificationPrefsSchema.safeParse({ ...ok, quiet_hours_start: "25:00" }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ ...ok, max_per_day: 11 }).success).toBe(false);
    expect(notificationPrefsSchema.safeParse({ ...ok, max_per_day: -1 }).success).toBe(false);
  });
});
