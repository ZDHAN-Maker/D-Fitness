import { describe, expect, it } from "vitest";
import { calculateGoalProgress, calculateProgressPct, calculateRemaining, calculateWaterProgress } from "./progress";

describe("calculateProgressPct", () => {
  it("computes a percentage", () => expect(calculateProgressPct(1840, 2300)).toBeCloseTo(80, 0));
  it("clamps to 100", () => expect(calculateProgressPct(3000, 2300)).toBe(100));
  it("never returns NaN for a zero target", () => expect(calculateProgressPct(10, 0)).toBe(0));
  it("clamps negatives to 0", () => expect(calculateProgressPct(-5, 10)).toBe(0));
});

describe("calculateRemaining", () => {
  it("returns the gap", () => expect(calculateRemaining(112, 150)).toBe(38));
  it("is never negative", () => expect(calculateRemaining(200, 150)).toBe(0));
});

describe("calculateWaterProgress", () => {
  it("matches the 1.8L / 2.5L example", () => {
    expect(calculateWaterProgress(1800, 2500)).toEqual({ currentMl: 1800, targetMl: 2500, remainingMl: 700, pct: 72 });
  });
});

describe("calculateGoalProgress", () => {
  it("handles decreasing goals", () => expect(calculateGoalProgress(80, 75.4, 70)).toBeCloseTo(46, 0));
  it("handles increasing goals", () => expect(calculateGoalProgress(60, 70, 80)).toBe(50));
  it("is 0 when moving the wrong way", () => expect(calculateGoalProgress(80, 82, 70)).toBe(0));
  it("caps at 100", () => expect(calculateGoalProgress(80, 65, 70)).toBe(100));
});
