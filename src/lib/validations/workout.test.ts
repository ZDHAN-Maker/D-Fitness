import { describe, expect, it } from "vitest";
import { activitySchema } from "./activity";
import { completeWorkoutSchema, exerciseSearchSchema, planSchema, setPatchSchema, startWorkoutSchema } from "./workout";

const ex = { exerciseId: 1, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8 };
const uuid = "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11";

describe("planSchema", () => {
  it("accepts the Push Day example", () => {
    const r = planSchema.safeParse({ name: "Push Day", scheduledDays: [4, 1, 1], exercises: [ex, { exerciseId: 2, targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scheduledDays).toEqual([1, 4]); // de-duplicated and sorted
  });
  it("needs a name and at least one exercise", () => {
    expect(planSchema.safeParse({ name: " ", scheduledDays: [], exercises: [ex] }).success).toBe(false);
    expect(planSchema.safeParse({ name: "x", scheduledDays: [], exercises: [] }).success).toBe(false);
  });
  it("rejects max reps below min reps and silly set counts", () => {
    expect(planSchema.safeParse({ name: "x", scheduledDays: [], exercises: [{ ...ex, targetRepsMin: 10, targetRepsMax: 5 }] }).success).toBe(false);
    expect(planSchema.safeParse({ name: "x", scheduledDays: [], exercises: [{ ...ex, targetSets: 0 }] }).success).toBe(false);
    expect(planSchema.safeParse({ name: "x", scheduledDays: [], exercises: [{ ...ex, targetSets: 50 }] }).success).toBe(false);
  });
  it("treats blank optional numbers as absent", () => {
    const r = planSchema.parse({ name: "x", scheduledDays: [], exercises: [{ exerciseId: 1, targetSets: 3, targetRepsMin: "", restSeconds: Number.NaN }] });
    expect(r.exercises[0]?.targetRepsMin).toBeUndefined();
    expect(r.exercises[0]?.restSeconds).toBeUndefined();
  });
  it("rejects an invalid weekday", () => {
    expect(planSchema.safeParse({ name: "x", scheduledDays: [7], exercises: [ex] }).success).toBe(false);
  });
});

describe("setPatchSchema", () => {
  it("accepts typical values, including clearing a field", () => {
    expect(setPatchSchema.safeParse({ setId: uuid, weightKg: 62.5, reps: 10, rpe: 8, isCompleted: true }).success).toBe(true);
    expect(setPatchSchema.safeParse({ setId: uuid, weightKg: null, reps: null }).success).toBe(true);
  });
  it.each([
    ["negative weight", { weightKg: -1 }],
    ["zero reps", { reps: 0 }],
    ["fractional reps", { reps: 2.5 }],
    ["RPE above 10", { rpe: 11 }],
    ["RPE below 1", { rpe: 0 }],
    ["absurd weight", { weightKg: 5000 }],
    ["zero distance", { distanceM: 0 }],
  ])("rejects %s", (_n, patch) => {
    expect(setPatchSchema.safeParse({ setId: uuid, ...patch }).success).toBe(false);
  });
  it("requires a real set id", () => expect(setPatchSchema.safeParse({ setId: "nope", reps: 5 }).success).toBe(false));
});

describe("start / complete / search", () => {
  it("start needs a valid date", () => {
    expect(startWorkoutSchema.safeParse({ date: "2026-10-08" }).success).toBe(true);
    expect(startWorkoutSchema.safeParse({ date: "08/10/2026" }).success).toBe(false);
  });
  it("complete bounds effort", () => {
    expect(completeWorkoutSchema.safeParse({ sessionId: uuid, effort: 8 }).success).toBe(true);
    expect(completeWorkoutSchema.safeParse({ sessionId: uuid, effort: 11 }).success).toBe(false);
    expect(completeWorkoutSchema.safeParse({ sessionId: uuid }).success).toBe(true);
  });
  it("exercise search caps page size and validates difficulty", () => {
    expect(exerciseSearchSchema.parse({})).toMatchObject({ q: "", offset: 0, limit: 24 });
    expect(exerciseSearchSchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(exerciseSearchSchema.safeParse({ difficulty: "godlike" }).success).toBe(false);
  });
});

describe("activitySchema", () => {
  const ok = { activityTypeId: 1, date: "2026-10-08", durationMinutes: 28.5 };
  it("accepts a run with distance", () => expect(activitySchema.safeParse({ ...ok, distanceKm: 5 }).success).toBe(true));
  it("treats blank distance and calories as absent", () => {
    const r = activitySchema.parse({ ...ok, distanceKm: "", caloriesBurned: Number.NaN });
    expect(r.distanceKm).toBeUndefined();
    expect(r.caloriesBurned).toBeUndefined();
  });
  it.each([
    ["zero duration", { durationMinutes: 0 }],
    ["more than 24h", { durationMinutes: 2000 }],
    ["negative distance", { distanceKm: -3 }],
    ["negative calories", { caloriesBurned: -1 }],
    ["no activity chosen", { activityTypeId: undefined }],
  ])("rejects %s", (_n, patch) => {
    expect(activitySchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});
