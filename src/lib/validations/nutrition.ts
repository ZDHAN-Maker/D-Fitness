import { z } from "zod";

const MEALS = ["breakfast", "lunch", "dinner", "snack", "other"] as const;

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(d + "T00:00:00Z")), "Enter a valid date")
  .refine((d) => d >= "2000-01-01", "That date is too far in the past")
  .refine((d) => d <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), "That date is too far in the future");

export const mealType = z.enum(MEALS);

export const foodRefSchema = z.object({
  kind: z.enum(["food", "custom", "recipe"]),
  id: z.string().min(1).max(40),
});

/** What the user typed: an amount and which unit/serving it is in. Nutrition is NEVER taken from the client. */
export const portionSchema = z.object({
  quantity: z.number({ invalid_type_error: "Enter an amount" }).positive("Amount must be greater than 0").max(100000, "That amount is too large"),
  unitCode: z.string().min(1).max(20),
  servingId: z.number().int().positive().nullable().optional(),
});

export const logFoodSchema = z.object({ date: isoDate, mealType, ref: foodRefSchema, portion: portionSchema });

export const updateLogItemSchema = z
  .object({ itemId: z.string().uuid(), mealType: mealType.optional(), portion: portionSchema.optional() })
  .refine((v) => v.mealType || v.portion, "Nothing to update");

const name = z.string().trim().min(1, "Enter a name").max(80, "Keep the name under 80 characters");
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const ingredientSchema = z.object({
  kind: z.enum(["food", "custom"]),
  id: z.string().min(1).max(40),
  portion: portionSchema,
});

const macro = (label: string, max: number) =>
  z.number({ invalid_type_error: `Enter ${label}`, required_error: `Enter ${label}` }).min(0, `${label} cannot be negative`).max(max, `${label} is too large`);

export const customFoodSchema = z
  .object({
    id: z.string().uuid().optional(),
    name,
    brand: optionalText(60),
    description: optionalText(300),
    mode: z.enum(["manual", "ingredients"]),
    manual: z
      .object({
        baseQuantity: z.number().positive("Must be greater than 0").max(10000),
        baseUnit: z.enum(["g", "ml"]),
        calories: macro("calories", 10000),
        protein_g: macro("protein", 1000),
        carbs_g: macro("carbs", 1000),
        fat_g: macro("fat", 1000),
        fiber_g: macro("fibre", 1000),
      })
      .optional(),
    ingredients: z.array(ingredientSchema.extend({ kind: z.literal("food") })).max(40).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "manual" && !v.manual) ctx.addIssue({ code: "custom", path: ["manual"], message: "Enter the nutrition values" });
    if (v.mode === "ingredients" && !v.ingredients?.length) ctx.addIssue({ code: "custom", path: ["ingredients"], message: "Add at least one ingredient" });
  });

export const recipeSchema = z.object({
  id: z.string().uuid().optional(),
  name,
  description: optionalText(300),
  instructions: optionalText(4000),
  servings: z.number({ invalid_type_error: "Enter servings" }).positive("Servings must be greater than 0").max(100),
  ingredients: z.array(ingredientSchema).min(1, "Add at least one ingredient").max(50),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  category: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

export type FoodRefInput = z.infer<typeof foodRefSchema>;
export type PortionInput = z.infer<typeof portionSchema>;
export type LogFoodInput = z.infer<typeof logFoodSchema>;
export type UpdateLogItemInput = z.infer<typeof updateLogItemSchema>;
export type CustomFoodInput = z.infer<typeof customFoodSchema>;
export type RecipeInput = z.infer<typeof recipeSchema>;
