import { z } from "zod";
import { isoDate } from "@/lib/validations/nutrition";

const opt = (schema: z.ZodTypeAny) => z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v), schema.optional());

export const activitySchema = z.object({
  id: z.string().uuid().optional(),
  activityTypeId: z.number({ invalid_type_error: "Choose an activity" }).int().positive("Choose an activity"),
  date: isoDate,
  durationMinutes: z.number({ invalid_type_error: "Enter the duration" }).positive("Duration must be greater than 0").max(1440, "At most 24 hours"),
  distanceKm: opt(z.number({ invalid_type_error: "Distance must be a number" }).positive("Distance must be greater than 0").max(1000, "That distance is too large")),
  caloriesBurned: opt(z.number().int("Whole number").min(0, "Cannot be negative").max(20000, "That is too many calories")),
  notes: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300).optional()),
});

export const activityListSchema = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) });

export type ActivityInput = z.infer<typeof activitySchema>;
