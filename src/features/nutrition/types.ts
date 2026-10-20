import type { MealType, MacroNutrients } from "@/types/domain";
import type { NutritionPer, PortionOption } from "@/lib/calculations/nutrition";

export type FoodKind = "food" | "custom" | "recipe";
export type FoodRef = { kind: FoodKind; id: string };

/** A loggable thing (database food, custom food or recipe) with everything the UI needs to preview a portion. */
export type FoodResult = {
  kind: FoodKind;
  id: string;
  name: string;
  brand: string | null;
  /** Authoritative nutrition basis used by calculateNutrition(). */
  per: NutritionPer;
  options: PortionOption[];
  /** Human summary, e.g. "130 kcal / 100 g" or "265 kcal / serving". */
  summary: { label: string; nutrition: MacroNutrients };
  isFavorite?: boolean;
};

export const refKey = (r: FoodRef) => `${r.kind}:${r.id}`;

export type DiaryItem = MacroNutrients & {
  id: string;
  source: string;
  name_snapshot: string;
  quantity: number;
  unit_code: string;
  base_amount: number;
  /** null when the source food was deleted: the item is then read-only (it can still be removed). */
  ref: FoodResult | null;
};

export type DiaryMeal = { meal: MealType; items: DiaryItem[]; totals: MacroNutrients };

/** A saved ingredient line as the builder UI edits it. */
export type IngredientDraft = { ref: FoodResult; quantity: number; optionKey: string };
