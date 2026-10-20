import { describe, expect, it } from "vitest";
import { dropUnsafeBullets } from "./safety";
import { formatWeekMetrics, isEmptyWeek, normalizeWeekStart, weekBounds, weekMissing, type WeekMetrics } from "./review";
import { mergeCandidates } from "./scan-match";
import type { FoodResult } from "@/features/nutrition/types";

const week = (o: Partial<WeekMetrics> = {}): WeekMetrics => ({
  weekStart: "2026-10-05",
  weekEnd: "2026-10-11",
  daysCovered: 7,
  workouts: { done: 4, target: 5 },
  calories: { avg: 2210, daysLogged: 6 },
  protein: { avg: 138, target: 150 },
  water: { avgMl: 2200, daysLogged: 6 },
  sleep: { avgMinutes: 425, nights: 6 },
  recovery: { avg: 70 },
  weight: { from: 76.1, to: 75.4, change: -0.7 },
  ...o,
});

describe("formatWeekMetrics: the spec's weekly report, from database facts", () => {
  it("matches the product brief example", () => {
    expect(formatWeekMetrics(week())).toEqual([
      { label: "Workout", value: "4 / 5" },
      { label: "Calories", value: "2,210 average" },
      { label: "Protein", value: "138g average" },
      { label: "Water", value: "2.2 L average" },
      { label: "Sleep", value: "7h 05m average" },
      { label: "Recovery", value: "70 / 100 average" },
      { label: "Weight", value: "76.1 → 75.4kg" },
    ]);
  });
  it("leaves out everything that has no data", () => {
    const rows = formatWeekMetrics(week({ calories: null, protein: null, water: null, sleep: null, recovery: null, weight: null }));
    expect(rows).toEqual([{ label: "Workout", value: "4 / 5" }]);
  });
});

describe("week handling", () => {
  it("finds the current and previous week (Monday start)", () => {
    expect(weekBounds("2026-10-08", 1, "current")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(weekBounds("2026-10-08", 1, "last")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(weekBounds("2026-10-08", 0, "current").start).toBe("2026-10-04");
  });
  it("snaps any date to its week start and refuses future weeks", () => {
    expect(normalizeWeekStart("2026-10-08", "2026-10-08", 1)).toBe("2026-10-05");
    expect(normalizeWeekStart("2026-10-12", "2026-10-08", 1)).toBeNull();
  });
  it("detects an empty week and lists the gaps", () => {
    const empty = week({ workouts: { done: 0, target: 5 }, calories: null, protein: null, water: null, sleep: null, recovery: null, weight: null });
    expect(isEmptyWeek(empty)).toBe(true);
    expect(isEmptyWeek(week({ workouts: { done: 0, target: 5 }, calories: null, protein: null, water: null, sleep: null, recovery: null, weight: { from: 1, to: 1, change: 0 } }))).toBe(false);
    expect(weekMissing(empty)).toHaveLength(5);
    expect(weekMissing(week())).toEqual([]);
  });
});

describe("review safety", () => {
  it("drops bullets that recommend an intake below the floor, keeps the rest", () => {
    expect(dropUnsafeBullets(["Aim for 900 calories a day", "Add 20 g of protein at breakfast", "Eat no more than 1000 kcal"])).toEqual(["Add 20 g of protein at breakfast"]);
  });
});

const food = (id: string, name: string, kind: FoodResult["kind"] = "food"): FoodResult => ({ kind, id, name, brand: null, per: { base_quantity: 100, base_unit: "g", calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, options: [], summary: { label: "100 g", nutrition: { calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } } });

describe("mergeCandidates (scanner food matching)", () => {
  it("de-duplicates and gives each search term's best hit a chance first", () => {
    const merged = mergeCandidates([[food("1", "Rice"), food("2", "Rice flour")], [food("3", "Nasi putih"), food("1", "Rice")], [food("4", "Nasi goreng")]], 4);
    expect(merged.map((f) => f.id)).toEqual(["1", "3", "4", "2"]);
  });
  it("caps the list and copes with no results", () => {
    expect(mergeCandidates([[food("1", "a"), food("2", "b"), food("3", "c")]], 2)).toHaveLength(2);
    expect(mergeCandidates([[], []], 4)).toEqual([]);
    expect(mergeCandidates([], 4)).toEqual([]);
  });
  it("does not confuse a custom food with a database food that has the same id", () => {
    expect(mergeCandidates([[food("1", "Mine", "custom")], [food("1", "Theirs", "food")]], 4)).toHaveLength(2);
  });
});
