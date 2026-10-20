import { describe, expect, it } from "vitest";
import {
  calculateCaloriesBurned,
  calculateEstimatedOneRepMax,
  calculatePaceSecPerKm,
  calculateSpeedKmh,
  calculateWorkoutVolume,
  formatClock,
  formatPace,
  formatSetShort,
  parseDurationToMinutes,
  suggestProgression,
  topWorkingSet,
} from "./workout";

const done = (w: number | null, r: number | null, extra = {}) => ({ weight_kg: w, reps: r, is_completed: true, is_warmup: false, ...extra });

describe("calculateEstimatedOneRepMax (Epley)", () => {
  it("60 kg x 10 = 80", () => expect(calculateEstimatedOneRepMax(60, 10)).toBe(80));
  it("62.5 kg x 8 = 79.17", () => expect(calculateEstimatedOneRepMax(62.5, 8)).toBe(79.17));
  it("a single rep is the weight itself", () => expect(calculateEstimatedOneRepMax(100, 1)).toBe(100));
  it("is null for unusable input", () => {
    expect(calculateEstimatedOneRepMax(0, 5)).toBeNull();
    expect(calculateEstimatedOneRepMax(50, null)).toBeNull();
    expect(calculateEstimatedOneRepMax(-5, 5)).toBeNull();
  });
});

describe("calculateWorkoutVolume", () => {
  it("sums finished working sets only", () => {
    const sets = [done(60, 10), done(62.5, 8), done(20, 15, { is_warmup: true }), { weight_kg: 70, reps: 5, is_completed: false }, done(null, 12)];
    expect(calculateWorkoutVolume(sets)).toBe(1100); // 600 + 500
  });
  it("is 0 for an empty workout", () => expect(calculateWorkoutVolume([])).toBe(0));
});

describe("topWorkingSet", () => {
  it("picks the heaviest set, then most reps", () => {
    expect(topWorkingSet([done(60, 10), done(65, 6), done(65, 7), done(100, 5, { is_warmup: true })])).toMatchObject({ weight_kg: 65, reps: 7 });
  });
  it("is null with no working sets", () => expect(topWorkingSet([done(20, 10, { is_warmup: true })])).toBeNull());
});

describe("suggestProgression", () => {
  it("60 x 10 -> 62.5 x 10 (spec example)", () => {
    expect(suggestProgression([done(60, 10)])).toEqual({ weightKg: 62.5, reps: 10, reason: "add_weight" });
  });
  it("adds a rep when below the target", () => {
    expect(suggestProgression([done(60, 8)])).toEqual({ weightKg: 60, reps: 9, reason: "add_rep" });
  });
  it("respects the plan's rep target and plate size", () => {
    expect(suggestProgression([done(40, 12)], { targetReps: 12, incrementKg: 1 })).toEqual({ weightKg: 41, reps: 12, reason: "add_weight" });
    expect(suggestProgression([done(40, 8)], { targetReps: 12 })?.reason).toBe("add_rep");
  });
  it("returns null with no history", () => expect(suggestProgression([])).toBeNull());
  it("ignores warm-ups when choosing the base set", () => {
    expect(suggestProgression([done(100, 3, { is_warmup: true }), done(60, 10)])?.weightKg).toBe(62.5);
  });
});

describe("formatting", () => {
  it("formats sets", () => {
    expect(formatSetShort({ weight_kg: 60, reps: 10 })).toBe("60 × 10");
    expect(formatSetShort({ weight_kg: null, reps: 12 })).toBe("12 reps");
    expect(formatSetShort({ weight_kg: null, reps: null, duration_sec: 45 })).toBe("0:45");
    expect(formatSetShort({ weight_kg: null, reps: null, duration_sec: 600, distance_m: 2000 })).toBe("2 km · 10:00");
    expect(formatSetShort({ weight_kg: null, reps: null })).toBe("–");
  });
  it("formats clocks", () => {
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("cardio", () => {
  it("5 km in 28 minutes = 5:36 /km", () => {
    expect(calculatePaceSecPerKm(28, 5)).toBe(336);
    expect(formatPace(336)).toBe("5:36 /km");
  });
  it("pace and speed need distance and time", () => {
    expect(calculatePaceSecPerKm(30, 0)).toBeNull();
    expect(calculatePaceSecPerKm(0, 5)).toBeNull();
    expect(calculateSpeedKmh(30, 5)).toBe(10);
    expect(formatPace(null)).toBe("–");
  });
  it("estimates calories from MET, weight and time", () => {
    expect(calculateCaloriesBurned(9.8, 70, 30)).toBe(343);
    expect(calculateCaloriesBurned(9.8, null, 30)).toBeNull();
  });
  it("parses durations", () => {
    expect(parseDurationToMinutes("45")).toBe(45);
    expect(parseDurationToMinutes("28:30")).toBe(28.5);
    expect(parseDurationToMinutes("1:05:00")).toBe(65);
    expect(parseDurationToMinutes("28:75")).toBeNull();
    expect(parseDurationToMinutes("abc")).toBeNull();
  });
});
