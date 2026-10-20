import { describe, expect, it } from "vitest";
import { classifyMessage } from "@/lib/ai/safety";
import { computeMissing, describeFacts, factsForModel, type CoachFacts } from "./facts";
import { addGeneratedSchema, coachInputSchema, confirmScanSchema, logMealSchema, mealInputSchema, workoutGenInputSchema } from "@/lib/validations/ai";

const facts = (o: Partial<CoachFacts> = {}): CoachFacts => ({
  date: "2026-10-08",
  profile: { experience: "intermediate", primaryGoal: "build_muscle", activityLevel: "moderate", ageYears: 30, heightCm: 175 },
  targets: { calories: 2300, protein_g: 150, carbs_g: 280, fat_g: 75, fiber_g: 30, water_ml: 2500, sleep_minutes: 480, workouts_per_week: 4 },
  window: { days: 14, from: "2026-09-25", to: "2026-10-08" },
  workouts: { count: 6, perWeek: 3, volumeKg: 18400, recent: [{ date: "2026-10-07", name: "Push Day" }] },
  nutrition: { daysLogged: 10, avgCalories: 2210, avgProtein: 138, avgCarbs: 250, avgFat: 70, avgFiber: 24 },
  sleep: { nights: 9, avgMinutes: 425 },
  water: { daysLogged: 11, avgMl: 2200 },
  recovery: { avg: 68, latest: 55, latestDate: "2026-10-08" },
  weight: { latestKg: 75.4, changeKg: -0.7, spanDays: 12 },
  today: { calories: 1840, protein_g: 112, waterMl: 1800, workout: "done" },
  goals: [{ title: "Reach 70 kg", progressPct: 46, current: 75.4, target: 70, unit: "kg", daysLeft: 40 }],
  streaks: { workout: 3, nutrition: 5, hydration: 2, habit: 8 },
  missing: [],
  ...o,
});

describe("describeFacts (what the user sees under an answer: computed by the server)", () => {
  it("states real numbers from the data", () => {
    const lines = describeFacts(facts());
    expect(lines).toContain("Workouts: 6 in the last 14 days (3/week, target 4/week), 18,400 kg total volume");
    expect(lines).toContain("Nutrition: 2,210 kcal and 138 g protein on average over 10 logged days (targets 2,300 kcal / 150 g)");
    expect(lines).toContain("Sleep: 7h 05m on average over 9 nights (target 8h 00m)");
    expect(lines).toContain("Water: 2.2 L on average over 11 days (target 2.5 L)");
    expect(lines).toContain("Weight: 75.4 kg (−0.7 kg over 12 days)");
    expect(lines.some((l) => l.startsWith("Today so far: 1,840 kcal, 112 g protein, 1.8 L water, workout done"))).toBe(true);
    expect(lines.some((l) => l.includes('Goal "Reach 70 kg": 46%, 40 days left'))).toBe(true);
  });
  it("never mentions an area that has no data", () => {
    const text = describeFacts(facts({ nutrition: null, sleep: null, water: null, recovery: null, weight: null, workouts: { count: 0, perWeek: 0, volumeKg: 0, recent: [] } })).join("\n");
    expect(text).not.toMatch(/Nutrition:|Sleep:|Water:|Recovery:|Weight:|Workouts:/);
  });
});

describe("computeMissing (so 'unavailable' does not rely on the model noticing)", () => {
  const { missing: _m, ...complete } = facts();
  void _m;
  it("is empty when everything is present", () => expect(computeMissing(complete)).toEqual([]));
  it("lists exactly the empty areas", () => {
    const m = computeMissing({ ...complete, nutrition: null, weight: null, goals: [], profile: { ...complete.profile, experience: null } });
    expect(m).toEqual(["Nutrition: no food logged in the last 14 days", "Body weight: no weight entries", "Goals: none set", "Profile: training experience not set"]);
  });
  it("flags zero finished workouts", () => {
    expect(computeMissing({ ...complete, workouts: { count: 0, perWeek: 0, volumeKg: 0, recent: [] } })[0]).toMatch(/Workouts: none finished/);
  });
});

describe("what is sent to the model", () => {
  it("contains no identity fields (no name, email or user id)", () => {
    const sent = factsForModel(facts());
    expect(sent).not.toMatch(/email|user_id|display_name|"id"/i);
    const parsed = JSON.parse(sent);
    expect(Object.keys(parsed.profile).sort()).toEqual(["activityLevel", "ageYears", "experience", "heightCm", "primaryGoal"]);
    expect(parsed.targets.protein_g).toBe(150);
  });
});

describe("AI input validation", () => {
  it("coach message bounds", () => {
    expect(coachInputSchema.safeParse({ message: "  Am I eating enough protein?  " }).success).toBe(true);
    expect(coachInputSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(coachInputSchema.safeParse({ message: "x".repeat(1001) }).success).toBe(false);
    expect(coachInputSchema.safeParse({ message: "hi", conversationId: "nope" }).success).toBe(false);
  });
  it("workout generator input (spec example: 30 minutes)", () => {
    expect(workoutGenInputSchema.safeParse({ minutes: 30, goal: "general", focus: "full_body", equipment: ["barbell", "dumbbell"] }).success).toBe(true);
    for (const minutes of [5, 200, 20.5]) expect(workoutGenInputSchema.safeParse({ minutes, goal: "general", focus: "full_body" }).success).toBe(false);
    expect(workoutGenInputSchema.safeParse({ minutes: 30, goal: "bulk", focus: "full_body" }).success).toBe(false);
    expect(workoutGenInputSchema.parse({ minutes: 30, goal: "general", focus: "core" }).equipment).toEqual([]);
  });
  it("meal request and notes", () => {
    expect(mealInputSchema.safeParse({ mealType: "dinner" }).success).toBe(true);
    expect(mealInputSchema.safeParse({ mealType: "brunch" }).success).toBe(false);
    expect(mealInputSchema.parse({ mealType: "dinner", note: "  " }).note).toBeUndefined();
    expect(mealInputSchema.safeParse({ mealType: "dinner", note: "x".repeat(201) }).success).toBe(false);
  });
  it("scan confirmation needs a scan id, items and sane amounts", () => {
    const ok = { scanId: "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11", date: "2026-10-08", mealType: "lunch", items: [{ kind: "food", id: "1", amount: 200 }] };
    expect(confirmScanSchema.safeParse(ok).success).toBe(true);
    expect(confirmScanSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(confirmScanSchema.safeParse({ ...ok, items: [{ kind: "food", id: "1", amount: 0 }] }).success).toBe(false);
    expect(confirmScanSchema.safeParse({ ...ok, items: [{ kind: "food", id: "1", amount: 99999 }] }).success).toBe(false);
  });
  it("logging a suggested meal and saving a generated workout", () => {
    expect(logMealSchema.safeParse({ date: "2026-10-08", mealType: "dinner", items: [{ foodId: 1, amount: 150 }] }).success).toBe(true);
    expect(logMealSchema.safeParse({ date: "2026-10-08", mealType: "dinner", items: [{ foodId: 1, amount: -1 }] }).success).toBe(false);
    expect(addGeneratedSchema.safeParse({ generatedId: "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11", name: "30 min full body" }).success).toBe(true);
    expect(addGeneratedSchema.safeParse({ generatedId: "7f1c0a52-4d57-4c0a-9e0b-0c6f6f5d9a11", name: " " }).success).toBe(false);
  });
  it("notes go through the same safety screen as chat messages", () => {
    expect(classifyMessage("only 500 calories a day please")).toBe("extreme_restriction");
  });
});
