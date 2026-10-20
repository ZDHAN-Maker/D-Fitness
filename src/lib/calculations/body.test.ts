import { describe, expect, it } from "vitest";
import { RECOVERY_ADVICE, calculateMovingAverage, calculateRecoveryScore, calculateSleepAverage, calculateTrend, calculateWeeklyRate, formatSigned, splitMinutes, toMinutes } from "./body";

const s = (pairs: [string, number][]) => pairs.map(([date, value]) => ({ date, value }));

describe("calculateMovingAverage", () => {
  it("averages the trailing window and handles the start of the series", () => {
    const out = calculateMovingAverage(s([["2026-10-01", 76], ["2026-10-02", 75], ["2026-10-03", 77]]), 2);
    expect(out.map((p) => p.value)).toEqual([76, 75.5, 76]);
  });
  it("is the identity for a window of 1 and empty-safe", () => {
    expect(calculateMovingAverage(s([["2026-10-01", 76]]), 1)[0]?.value).toBe(76);
    expect(calculateMovingAverage([], 7)).toEqual([]);
  });
});

describe("calculateTrend", () => {
  it("76.1 -> 75.4 is -0.7 kg (spec example)", () => {
    const t = calculateTrend(s([["2026-09-30", 76.1], ["2026-10-07", 75.4]]));
    expect(t).toMatchObject({ change: -0.7, direction: "down", days: 7, latest: 75.4, first: 76.1 });
    expect(t?.changePct).toBe(-0.9);
  });
  it("is flat for tiny changes and null with one point", () => {
    expect(calculateTrend(s([["2026-10-01", 75], ["2026-10-08", 75.05]]))?.direction).toBe("flat");
    expect(calculateTrend(s([["2026-10-01", 75]]))).toBeNull();
  });
  it("weekly rate needs at least 3 days of data", () => {
    expect(calculateWeeklyRate(s([["2026-10-01", 76], ["2026-10-15", 75]]))).toBe(-0.5);
    expect(calculateWeeklyRate(s([["2026-10-01", 76], ["2026-10-02", 75]]))).toBeNull();
  });
  it("formats signed numbers", () => {
    expect(formatSigned(-0.7)).toBe("−0.7");
    expect(formatSigned(0.35)).toBe("+0.4");
    expect(formatSigned(0)).toBe("0.0");
    expect(formatSigned(0.04)).toBe("0.0"); // rounds to zero: no sign
    expect(formatSigned(-0.04)).toBe("0.0");
  });
});

describe("sleep helpers", () => {
  it("combines hours and minutes", () => {
    expect(toMinutes(7, 24)).toBe(444);
    expect(toMinutes(0, 45)).toBe(45);
    expect(toMinutes(null, 30)).toBe(30);
  });
  it("rejects impossible durations", () => {
    expect(toMinutes(0, 0)).toBeNull();
    expect(toMinutes(25, 0)).toBeNull();
    expect(toMinutes(7, 75)).toBeNull();
    expect(toMinutes(-1, 10)).toBeNull();
  });
  it("splits and averages", () => {
    expect(splitMinutes(444)).toEqual({ hours: 7, minutes: 24 });
    expect(calculateSleepAverage([444, 420, 480])).toBe(448);
    expect(calculateSleepAverage([])).toBeNull();
  });
});

describe("calculateRecoveryScore", () => {
  it("scores a great day high and a rough day low", () => {
    const great = calculateRecoveryScore({ sleepMinutes: 480, sleepTargetMinutes: 480, sleepQuality: 5, energy: 5, stress: 1, soreness: 1, overall: 5 });
    const rough = calculateRecoveryScore({ sleepMinutes: 240, sleepTargetMinutes: 480, sleepQuality: 1, energy: 1, stress: 5, soreness: 5, overall: 1 });
    expect(great).toMatchObject({ score: 100, band: "high", coverage: 1 });
    expect(rough?.band).toBe("low");
    expect(rough!.score).toBeLessThan(25);
  });
  it("stress and soreness count against you (inverted scales)", () => {
    const calm = calculateRecoveryScore({ stress: 1, soreness: 1 })!.score;
    const strained = calculateRecoveryScore({ stress: 5, soreness: 5 })!.score;
    expect(calm).toBe(100);
    expect(strained).toBe(0);
  });
  it("5h 40m of sleep against an 8h target is about 71% on that component", () => {
    const r = calculateRecoveryScore({ sleepMinutes: 340, sleepTargetMinutes: 480 })!;
    expect(r.components[0]).toMatchObject({ key: "sleep", score: 71 });
    expect(r.coverage).toBe(0.25);
  });
  it("re-normalises when inputs are missing and caps over-sleeping at 100", () => {
    expect(calculateRecoveryScore({ sleepMinutes: 600, sleepTargetMinutes: 480 })!.score).toBe(100);
    expect(calculateRecoveryScore({ energy: 3 })!.score).toBe(50);
  });
  it("returns null with nothing recorded, ignores out-of-range answers, defaults the sleep target", () => {
    expect(calculateRecoveryScore({})).toBeNull();
    expect(calculateRecoveryScore({ energy: 9, stress: 0 })).toBeNull();
    expect(calculateRecoveryScore({ sleepMinutes: 480 })!.score).toBe(100);
  });
  it("low-recovery advice is cautious and non-medical", () => {
    expect(RECOVERY_ADVICE.low).toMatch(/not medical advice/i);
  });
});
