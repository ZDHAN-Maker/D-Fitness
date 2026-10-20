import { z } from "zod";
import { PHOTO_MAX_BYTES, PHOTO_MIME } from "@/lib/images/photo";
import { isoDate } from "@/lib/validations/nutrition";

const blank = (v: unknown) => v === "" || v === null || (typeof v === "number" && Number.isNaN(v));
const optNum = (min: number, max: number, label: string) =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).optional());
const optScale = (label: string) =>
  z.preprocess((v) => (blank(v) ? undefined : v), z.number({ invalid_type_error: `${label}: pick 1–5` }).int().min(1, `${label}: pick 1–5`).max(5, `${label}: pick 1–5`).optional());
const optNote = (max = 200) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const weightSchema = z.object({
  date: isoDate,
  weightKg: z.number({ invalid_type_error: "Enter your weight", required_error: "Enter your weight" }).min(20, "That looks too low (minimum 20 kg)").max(500, "That looks too high (maximum 500 kg)"),
  note: optNote(),
});

export const measurementSchema = z
  .object({
    date: isoDate,
    waistCm: optNum(10, 300, "Waist"),
    chestCm: optNum(10, 300, "Chest"),
    armCm: optNum(5, 150, "Arm"),
    thighCm: optNum(10, 200, "Thigh"),
    hipCm: optNum(10, 300, "Hip"),
    bodyFatPct: optNum(1, 70, "Body fat"),
  })
  .refine((m) => [m.waistCm, m.chestCm, m.armCm, m.thighCm, m.hipCm, m.bodyFatPct].some((v) => v !== undefined), { message: "Enter at least one measurement", path: ["waistCm"] });

export const photoMetaSchema = z.object({
  path: z.string().min(10).max(200),
  takenOn: isoDate,
  pose: z.enum(["front", "side", "back", "other"]),
  note: optNote(),
  mimeType: z.enum(PHOTO_MIME),
  sizeBytes: z.number().int().positive().max(PHOTO_MAX_BYTES, "That photo is too large (max 8 MB)"),
});

export const checkInSchema = z
  .object({
    date: isoDate,
    sleep: z
      .object({
        durationMinutes: z.number({ invalid_type_error: "Enter your sleep" }).int().min(1, "Sleep must be at least 1 minute").max(1440, "Sleep cannot exceed 24 hours"),
        quality: optScale("Sleep quality"),
      })
      .optional(),
    recovery: z
      .object({ energy: optScale("Energy"), stress: optScale("Stress"), soreness: optScale("Soreness"), overall: optScale("Overall") })
      .optional(),
  })
  .refine((c) => c.sleep !== undefined || (c.recovery !== undefined && Object.values(c.recovery).some((v) => v !== undefined)), { message: "Fill in sleep or at least one recovery question", path: ["sleep"] });

export const waterSchema = z.object({ date: isoDate, amountMl: z.number({ invalid_type_error: "Enter an amount" }).int("Whole millilitres").min(1, "Amount must be greater than 0").max(5000, "At most 5 L at a time") });

export const rangeSchema = z.object({ range: z.enum(["30d", "90d", "180d", "1y", "all"]).default("90d") });
export type RangeKey = z.infer<typeof rangeSchema>["range"];

export type WeightInput = z.infer<typeof weightSchema>;
export type MeasurementInput = z.infer<typeof measurementSchema>;
export type PhotoMetaInput = z.infer<typeof photoMetaSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
