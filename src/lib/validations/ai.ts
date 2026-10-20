import { z } from "zod";
import { isoDate } from "@/lib/validations/nutrition";

const note = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(200, "Keep notes under 200 characters").optional());

export const coachInputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Type a question").max(1000, "Keep your question under 1,000 characters"),
});

export const mealInputSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
  note,
});

export const GOALS = ["strength", "hypertrophy", "endurance", "fat_loss", "general"] as const;
export const FOCUS = ["full_body", "upper", "lower", "push", "pull", "legs", "core"] as const;

export const workoutGenInputSchema = z.object({
  minutes: z.number({ invalid_type_error: "Enter the minutes you have" }).int("Whole minutes").min(10, "At least 10 minutes").max(120, "At most 120 minutes"),
  goal: z.enum(GOALS),
  focus: z.enum(FOCUS),
  equipment: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  note,
});

export const reviewInputSchema = z.object({ weekStart: isoDate.optional(), which: z.enum(["current", "last"]).optional() });

export const scanInputSchema = z.object({ path: z.string().min(10).max(200) });

export const confirmScanSchema = z.object({
  scanId: z.string().uuid(),
  date: isoDate,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
  items: z.array(z.object({ kind: z.enum(["food", "custom", "recipe"]), id: z.string().min(1).max(40), amount: z.number().positive("Amount must be greater than 0").max(3000, "That amount is too large") })).min(1, "Keep at least one item").max(12),
});

export const logMealSchema = z.object({
  date: isoDate,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
  items: z.array(z.object({ foodId: z.number().int().positive(), amount: z.number().positive().max(1000) })).min(1).max(10),
});

export const addGeneratedSchema = z.object({ generatedId: z.string().uuid(), name: z.string().trim().min(1, "Name the workout").max(60) });

export type CoachInput = z.infer<typeof coachInputSchema>;
export type MealInput = z.infer<typeof mealInputSchema>;
export type WorkoutGenInput = z.infer<typeof workoutGenInputSchema>;
