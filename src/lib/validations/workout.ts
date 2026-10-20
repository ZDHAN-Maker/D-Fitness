import { z } from "zod";
import { isoDate } from "@/lib/validations/nutrition";

const optText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optNum = (min: number, max: number, label: string) =>
  z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v), z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).optional());

export const exerciseSearchSchema = z.object({
  q: z.string().trim().max(80).default(""),
  category: z.coerce.number().int().positive().optional(),
  muscle: z.string().trim().max(40).optional(),
  equipment: z.string().trim().max(40).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  movement: z.string().trim().max(40).optional(),
  offset: z.coerce.number().int().min(0).max(2000).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const planExerciseSchema = z
  .object({
    exerciseId: z.number().int().positive(),
    targetSets: z.number({ invalid_type_error: "Enter sets" }).int("Whole number").min(1, "At least 1 set").max(20, "At most 20 sets"),
    targetRepsMin: optNum(1, 1000, "Reps"),
    targetRepsMax: optNum(1, 1000, "Reps"),
    targetDurationSec: optNum(1, 86400, "Duration"),
    targetWeightKg: optNum(0, 1000, "Weight"),
    restSeconds: optNum(0, 1800, "Rest"),
    notes: optText(200),
  })
  .refine((e) => e.targetRepsMin === undefined || e.targetRepsMax === undefined || e.targetRepsMax >= e.targetRepsMin, { message: "Max reps must be at least the minimum", path: ["targetRepsMax"] });

export const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name your workout").max(60, "Keep the name under 60 characters"),
  description: optText(300),
  scheduledDays: z.array(z.number().int().min(0).max(6)).max(7).transform((d) => [...new Set(d)].sort()),
  exercises: z.array(planExerciseSchema).min(1, "Add at least one exercise").max(40),
});

export const startWorkoutSchema = z.object({ planId: z.string().uuid().optional(), name: optText(60), date: isoDate });

/** Set values the user typed. Nullable = cleared. All range limits mirror the CHECK constraints in 004. */
export const setPatchSchema = z.object({
  setId: z.string().uuid(),
  weightKg: z.number().min(0, "Weight cannot be negative").max(1000, "That weight is too large").nullable().optional(),
  reps: z.number().int("Reps must be a whole number").min(1, "Reps must be at least 1").max(1000).nullable().optional(),
  durationSec: z.number().int().min(1).max(86400).nullable().optional(),
  distanceM: z.number().positive().max(1_000_000).nullable().optional(),
  rpe: z.number().min(1, "RPE is 1–10").max(10, "RPE is 1–10").nullable().optional(),
  isWarmup: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
});

export const completeWorkoutSchema = z.object({ sessionId: z.string().uuid(), effort: optNum(1, 10, "Effort"), notes: optText(500) });

export const addExerciseSchema = z.object({ sessionId: z.string().uuid(), exerciseId: z.number().int().positive() });

export type PlanInput = z.infer<typeof planSchema>;
export type StartWorkoutInput = z.infer<typeof startWorkoutSchema>;
export type SetPatchInput = z.infer<typeof setPatchSchema>;
export type ExerciseSearchInput = z.infer<typeof exerciseSearchSchema>;
