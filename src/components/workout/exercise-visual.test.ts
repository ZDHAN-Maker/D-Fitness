import { describe, expect, it } from "vitest";
import { normalizeMuscle, resolveExerciseMuscles, resolveStudioArchetype } from "./exercise-visual";

describe("normalizeMuscle", () => {
  it("normalizes muscle strings correctly", () => {
    expect(normalizeMuscle("Chest")).toBe("chest");
    expect(normalizeMuscle("pectoralis")).toBe("chest");
    expect(normalizeMuscle("Lats")).toBe("lats");
    expect(normalizeMuscle("Mid Back")).toBe("lats");
    expect(normalizeMuscle("Trapezius")).toBe("traps");
    expect(normalizeMuscle("Deltoids")).toBe("shoulders");
    expect(normalizeMuscle("Shoulders")).toBe("shoulders");
    expect(normalizeMuscle("Biceps")).toBe("biceps");
    expect(normalizeMuscle("Triceps")).toBe("triceps");
    expect(normalizeMuscle("Forearms")).toBe("forearms");
    expect(normalizeMuscle("Abs")).toBe("abs");
    expect(normalizeMuscle("Core")).toBe("abs");
    expect(normalizeMuscle("Obliques")).toBe("obliques");
    expect(normalizeMuscle("Quadriceps")).toBe("quads");
    expect(normalizeMuscle("Hamstrings")).toBe("hamstrings");
    expect(normalizeMuscle("Glutes")).toBe("glutes");
    expect(normalizeMuscle("Calves")).toBe("calves");
    expect(normalizeMuscle("Cardiovascular")).toBe("cardio");
    expect(normalizeMuscle(null)).toBe("full-body");
    expect(normalizeMuscle("unknown")).toBe("full-body");
  });
});

describe("resolveExerciseMuscles", () => {
  it("resolves muscles for chest exercises", () => {
    const res = resolveExerciseMuscles("Barbell Bench Press", "chest", ["triceps", "shoulders"]);
    expect(res.primary).toBe("chest");
    expect(res.secondary).toContain("triceps");
    expect(res.secondary).toContain("shoulders");
  });

  it("resolves muscles for back exercises", () => {
    const res = resolveExerciseMuscles("Pull-up", "lats");
    expect(res.primary).toBe("lats");
    expect(res.secondary).toContain("biceps");
  });

  it("resolves muscles for leg exercises", () => {
    const res = resolveExerciseMuscles("Back Squat", "quadriceps");
    expect(res.primary).toBe("quads");
    expect(res.secondary).toContain("glutes");
  });

  it("infers muscles from exercise name when primary is full-body or null", () => {
    expect(resolveExerciseMuscles("Dumbbell Bicep Curl").primary).toBe("biceps");
    expect(resolveExerciseMuscles("Skull Crusher").primary).toBe("triceps");
    expect(resolveExerciseMuscles("Overhead Dumbbell Triceps Extension").primary).toBe("triceps");
    expect(resolveExerciseMuscles("Dumbbell Tricep Kickback").primary).toBe("triceps");
    expect(resolveExerciseMuscles("Romanian Deadlift").primary).toBe("hamstrings");
    expect(resolveExerciseMuscles("Trap Bar / Hex Bar Deadlift").primary).toBe("hamstrings");
    expect(resolveExerciseMuscles("Overhead Press").primary).toBe("shoulders");
    expect(resolveExerciseMuscles("Plank Hold").primary).toBe("abs");
    expect(resolveExerciseMuscles("Ab Wheel Rollout").primary).toBe("abs");
    expect(resolveExerciseMuscles("Cable Woodchoppers").primary).toBe("abs");
    expect(resolveExerciseMuscles("Standing Calf Raise").primary).toBe("calves");
    expect(resolveExerciseMuscles("Hip Thrust").primary).toBe("glutes");
    expect(resolveExerciseMuscles("Treadmill Run").primary).toBe("cardio");
  });
});

describe("resolveStudioArchetype", () => {
  it("resolves bench and press movements", () => {
    expect(resolveStudioArchetype("Barbell Bench Press", "chest", "barbell", "push")).toBe("bench-press");
    expect(resolveStudioArchetype("Push-up", "chest", "bodyweight", "push")).toBe("bench-press");
    expect(resolveStudioArchetype("Incline Dumbbell Press", "chest", "dumbbell", "push")).toBe("incline-press");
    expect(resolveStudioArchetype("Close-Grip Barbell Bench Press", "triceps", "barbell", "push")).toBe("bench-press");
  });

  it("resolves squat and hinge movements", () => {
    expect(resolveStudioArchetype("Back Squat", "quads", "barbell", "squat")).toBe("squat");
    expect(resolveStudioArchetype("Romanian Deadlift", "hamstrings", "barbell", "hinge")).toBe("deadlift");
    expect(resolveStudioArchetype("Sumo Deadlift", "glutes", "barbell", "hinge")).toBe("deadlift");
    expect(resolveStudioArchetype("Trap Bar / Hex Bar Deadlift", "quadriceps", "barbell", "hinge")).toBe("deadlift");
    expect(resolveStudioArchetype("Rack Pulls", "traps", "barbell", "hinge")).toBe("deadlift");
    expect(resolveStudioArchetype("Barbell Hip Thrust", "glutes", "barbell", "hinge")).toBe("hip-thrust");
    expect(resolveStudioArchetype("Walking Lunge", "quads", "dumbbell", "lunge")).toBe("lunge");
  });

  it("resolves pull and upper body movements", () => {
    expect(resolveStudioArchetype("Pull-up", "lats", "bodyweight", "pull")).toBe("pull-up");
    expect(resolveStudioArchetype("Bent-Over Barbell Row", "lats", "barbell", "pull")).toBe("row");
    expect(resolveStudioArchetype("Overhead Press", "shoulders", "barbell", "push")).toBe("overhead-press");
    expect(resolveStudioArchetype("Arnold Press", "shoulders", "dumbbell", "push")).toBe("overhead-press");
    expect(resolveStudioArchetype("Dumbbell Lateral Raise", "shoulders", "dumbbell", "push")).toBe("lateral-raise");
    expect(resolveStudioArchetype("Dumbbell Bicep Curl", "biceps", "dumbbell", "pull")).toBe("bicep-curl");
    expect(resolveStudioArchetype("Tricep Pushdown", "triceps", "cable", "push")).toBe("tricep-extension");
    expect(resolveStudioArchetype("Dumbbell Tricep Kickback", "triceps", "dumbbell", "push")).toBe("tricep-extension");
    expect(resolveStudioArchetype("Overhead Cable Triceps Extension", "triceps", "cable", "push")).toBe("tricep-extension");
  });

  it("resolves core and cardio movements", () => {
    expect(resolveStudioArchetype("Forearm Plank", "abs", "bodyweight", "core")).toBe("plank");
    expect(resolveStudioArchetype("Ab Wheel Rollout", "abs", "bodyweight", "core")).toBe("plank");
    expect(resolveStudioArchetype("Cable Rope Crunch", "abs", "cable", "core")).toBe("plank");
    expect(resolveStudioArchetype("Cable Woodchoppers", "obliques", "cable", "core")).toBe("plank");
    expect(resolveStudioArchetype("Treadmill Running", "cardio", "machine", "cardio")).toBe("cardio");
  });
});
