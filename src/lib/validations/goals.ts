import { z } from "zod";
import { findMetric, RUN_DISTANCES } from "@/lib/goals/metrics";
import { validateGoalDirection } from "@/lib/calculations/goals";
import { isoDate } from "@/lib/validations/nutrition";

const blank = (v: unknown) => v === "" || v === null || (typeof v === "number" && Number.isNaN(v));
const optNum = (label: string) => z.preprocess((v) => (blank(v) ? undefined : v), z.number({ invalid_type_error: `${label} must be a number` }).finite().optional());
/** A deadline is legitimately in the future (unlike a daily log date), so it gets its own bounds: up to 10 years ahead. */
const deadline = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(d + "T00:00:00Z")), "Enter a valid date")
  .refine((d) => d >= "2000-01-01", "That date is too far in the past")
  .refine((d) => d <= new Date(Date.now() + 3660 * 864e5).toISOString().slice(0, 10), "Pick a date within the next 10 years");
const optDate = z.preprocess((v) => (blank(v) ? undefined : v), deadline.optional());

export const goalSchema = z
  .object({
    id: z.string().uuid().optional(),
    templateId: z.number().int().positive().optional(),
    type: z.enum(["body", "strength", "running", "nutrition", "habit"]),
    title: z.string().trim().min(1, "Name your goal").max(80, "Keep the title under 80 characters"),
    metric: z.string().min(1, "Choose what to track"),
    direction: z.enum(["increase", "decrease"]),
    targetValue: z.number({ invalid_type_error: "Enter a target", required_error: "Enter a target" }).finite().min(0, "Target cannot be negative").max(1_000_000, "That target is too large"),
    startValue: optNum("Start value"),
    unit: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(20).optional()),
    startDate: isoDate,
    targetDate: optDate,
    exerciseId: z.preprocess((v) => (blank(v) ? undefined : v), z.number().int().positive().optional()),
    distanceKm: z.preprocess((v) => (blank(v) ? undefined : v), z.number().positive().max(100).optional()),
  })
  .superRefine((g, ctx) => {
    const metric = findMetric(g.metric);
    if (!metric) return ctx.addIssue({ code: "custom", path: ["metric"], message: "Choose what to track" });
    if (metric.key !== "custom" && metric.type !== g.type) ctx.addIssue({ code: "custom", path: ["metric"], message: "That metric does not belong to this goal type" });
    if (metric.needsExercise && !g.exerciseId) ctx.addIssue({ code: "custom", path: ["exerciseId"], message: "Choose an exercise" });
    if (metric.needsDistance && (!g.distanceKm || !RUN_DISTANCES.some((d) => d.km === g.distanceKm))) ctx.addIssue({ code: "custom", path: ["distanceKm"], message: "Choose a distance" });
    if (g.targetValue <= 0 && metric.key !== "custom") ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Target must be greater than 0" });
    if (g.targetDate && g.targetDate < g.startDate) ctx.addIssue({ code: "custom", path: ["targetDate"], message: "The target date must be on or after the start date" });
    const dirErr = validateGoalDirection(g.direction, g.startValue, g.targetValue);
    if (dirErr) ctx.addIssue({ code: "custom", path: ["targetValue"], message: dirErr });
  });

export const goalStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["active", "paused", "abandoned"]) });

export const manualProgressSchema = z.object({
  goalId: z.string().uuid(),
  date: isoDate,
  value: z.number({ invalid_type_error: "Enter a value", required_error: "Enter a value" }).finite().min(-1_000_000).max(1_000_000),
});

export const notificationPrefsSchema = z.object({
  enabled: z.boolean(),
  workout_reminders: z.boolean(),
  nutrition_reminders: z.boolean(),
  hydration_reminders: z.boolean(),
  recovery_alerts: z.boolean(),
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  max_per_day: z.number().int("Whole number").min(0, "At least 0").max(10, "At most 10"),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
