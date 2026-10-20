import { z } from "zod";
import { isValidTimeZone } from "@/utils/date";

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)
    .optional();

const requiredInt = (min: number, max: number, label: string) =>
  z
    .number({ invalid_type_error: `Enter ${label}`, required_error: `Enter ${label}` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());

/** Limits mirror the CHECK constraints in 003_user_tables.sql. The server re-validates every save. */
export const settingsSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(60),
  birthDate: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
      .refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Enter a valid birth date")
      .optional(),
  ),
  sex: optionalEnum(["male", "female"]),
  heightCm: optionalNumber(50, 260, "Height"),
  activityLevel: optionalEnum(["sedentary", "light", "moderate", "active", "very_active"]),
  experienceLevel: optionalEnum(["beginner", "intermediate", "advanced"]),
  primaryGoal: optionalEnum(["lose_fat", "build_muscle", "maintain", "improve_endurance", "general_health"]),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
  calorieTarget: requiredInt(1200, 8000, "a calorie target"),
  proteinTargetG: requiredInt(0, 600, "a protein target"),
  carbsTargetG: requiredInt(0, 1200, "a carbs target"),
  fatTargetG: requiredInt(0, 400, "a fat target"),
  fiberTargetG: requiredInt(0, 200, "a fibre target"),
  waterTargetMl: requiredInt(500, 10000, "a water target"),
  sleepTargetHours: z.number({ invalid_type_error: "Enter a sleep target" }).min(4, "At least 4 hours").max(14, "At most 14 hours"),
  weeklyWorkoutTarget: requiredInt(0, 14, "a weekly workout target"),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
