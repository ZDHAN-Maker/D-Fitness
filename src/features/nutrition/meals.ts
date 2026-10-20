import type { MealType } from "@/types/domain";

/** Client-safe meal metadata (diary.ts is server-only). */
export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", other: "Other" };
export const isMealType = (v: unknown): v is MealType => typeof v === "string" && (MEAL_ORDER as string[]).includes(v);

export function defaultMealForHour(hour: number): MealType {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
