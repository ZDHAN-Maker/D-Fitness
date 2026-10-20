/**
 * Nutrition calculation engine. Pure functions: no I/O, no React.
 * The SAME code runs on the server (authoritative values that get stored) and in the browser
 * (live preview), so what the user sees is what gets saved.
 *
 * Model
 *  - Every food states its nutrition per `base_quantity` of `base_unit` (g or ml), e.g. 130 kcal / 100 g.
 *  - Any portion the user picks (grams, ounces, a bowl, an egg, a tablespoon...) is first normalised
 *    to a base amount in g/ml; nutrition is then base_amount / base_quantity x per-base values.
 */
import { AppError } from "@/lib/errors";
import type { MacroNutrients } from "@/types/domain";

export type BaseUnit = "g" | "ml";

/** What a food row must provide to be calculated. */
export type NutritionPer = MacroNutrients & { base_quantity: number; base_unit: BaseUnit };

export type UnitDef = { code: string; name: string; kind: string; to_base_factor: number | null };

export type ServingDef = {
  id: number;
  label: string;
  unit_code: string;
  quantity: number;
  /** grams/ml equivalent of `quantity` x `unit_code` */
  base_amount: number;
  is_default: boolean;
};

/** One selectable way of entering an amount. `baseAmountPerUnit` is how many g/ml ONE unit is. */
export type PortionOption = {
  key: string;
  label: string;
  unitCode: string;
  servingId: number | null;
  baseAmountPerUnit: number;
  isDefault: boolean;
};

export const ZERO_NUTRITION: MacroNutrients = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

const MASS_UNITS_SHOWN = ["g", "kg", "oz"];
const VOLUME_UNITS_SHOWN = ["ml", "l", "tsp", "tbsp", "cup", "glass"];

/** "1 bowl" -> "bowl", "1 serving (150 g)" -> "serving (150 g)"; other forms are kept as-is. */
function servingLabel(s: ServingDef): string {
  return s.label.replace(/^\s*1\s+/, "").trim() || s.unit_code;
}

/**
 * Build the list of portion choices for one food.
 *  - the food's own household servings (bowl, egg, slice...) from `food_servings`
 *  - physically valid standard units (mass units for g-foods, volume units for ml-foods)
 *  - optionally one "whole portion" (custom foods and recipes)
 * The default option is listed first.
 */
export function buildPortionOptions(
  food: { base_unit: BaseUnit },
  servings: ServingDef[],
  units: UnitDef[],
  whole?: { label: string; baseAmount: number },
): PortionOption[] {
  const options: PortionOption[] = [];
  const hasDefaultServing = servings.some((s) => s.is_default);

  for (const s of servings) {
    if (s.quantity <= 0 || s.base_amount <= 0) continue;
    options.push({
      key: `s:${s.id}`,
      label: servingLabel(s),
      unitCode: s.unit_code,
      servingId: s.id,
      baseAmountPerUnit: s.base_amount / s.quantity,
      isDefault: s.is_default,
    });
  }

  if (whole && whole.baseAmount > 0) {
    options.push({
      key: "whole",
      label: whole.label,
      unitCode: "serving",
      servingId: null,
      baseAmountPerUnit: whole.baseAmount,
      isDefault: !hasDefaultServing,
    });
  }

  const shown = food.base_unit === "g" ? MASS_UNITS_SHOWN : VOLUME_UNITS_SHOWN;
  for (const code of shown) {
    const u = units.find((x) => x.code === code);
    if (!u || !u.to_base_factor) continue;
    options.push({
      key: `u:${u.code}`,
      label: u.code,
      unitCode: u.code,
      servingId: null,
      baseAmountPerUnit: u.to_base_factor,
      isDefault: false,
    });
  }

  // Nothing marked default (no default serving, no whole portion): fall back to the base unit.
  if (!options.some((o) => o.isDefault)) {
    const base = options.find((o) => o.unitCode === food.base_unit && o.servingId === null);
    if (base) base.isDefault = true;
  }
  return options.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export function defaultOption(options: PortionOption[]): PortionOption | undefined {
  return options.find((o) => o.isDefault) ?? options[0];
}

/** Find the option that matches what the client sent. Anything else is rejected, never guessed. */
export function resolvePortion(options: PortionOption[], unitCode: string, servingId?: number | null): PortionOption {
  const match = servingId
    ? options.find((o) => o.servingId === servingId)
    : options.find((o) => o.servingId === null && o.unitCode === unitCode);
  if (!match) throw new AppError("validation", "That unit is not available for this food. Pick another portion.");
  return match;
}

/** Re-select the option that best matches stored data (used when editing saved items). */
export function matchStoredOption(options: PortionOption[], unitCode: string, quantity: number, baseAmount: number): PortionOption | undefined {
  const perUnit = quantity > 0 ? baseAmount / quantity : 0;
  return (
    options.find((o) => o.unitCode === unitCode && Math.abs(o.baseAmountPerUnit - perUnit) < 0.01) ??
    options.find((o) => o.unitCode === unitCode) ??
    defaultOption(options)
  );
}

/** Quantity of an option -> base amount (g/ml). */
export function toBaseAmount(quantity: number, option: PortionOption): number {
  return round2(quantity * option.baseAmountPerUnit);
}

/** Core: nutrition for `baseAmount` g/ml of a food. 200 g of 130 kcal/100 g rice -> 260 kcal. */
export function calculateNutrition(per: NutritionPer, baseAmount: number): MacroNutrients {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0 || per.base_quantity <= 0) return { ...ZERO_NUTRITION };
  const f = baseAmount / per.base_quantity;
  return {
    calories: round2(per.calories * f),
    protein_g: round2(per.protein_g * f),
    carbs_g: round2(per.carbs_g * f),
    fat_g: round2(per.fat_g * f),
    fiber_g: round2(per.fiber_g * f),
  };
}

/** Convenience: quantity of a serving/unit -> nutrition. */
export function calculateCaloriesFromServing(per: NutritionPer, option: PortionOption, quantity: number): MacroNutrients {
  return calculateNutrition(per, toBaseAmount(quantity, option));
}

export function calculateMacroTotals(items: MacroNutrients[]): MacroNutrients {
  const t = items.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein_g: a.protein_g + i.protein_g,
      carbs_g: a.carbs_g + i.carbs_g,
      fat_g: a.fat_g + i.fat_g,
      fiber_g: a.fiber_g + i.fiber_g,
    }),
    { ...ZERO_NUTRITION },
  );
  return { calories: round2(t.calories), protein_g: round2(t.protein_g), carbs_g: round2(t.carbs_g), fat_g: round2(t.fat_g), fiber_g: round2(t.fiber_g) };
}

export type ResolvedIngredient = { baseAmount: number; nutrition: MacroNutrients };

/**
 * Total + per-serving nutrition for a recipe or composite custom food.
 * `totalWeight` is the sum of ingredient amounts in g/ml (ml counted 1:1 — a documented approximation).
 */
export function calculateRecipeNutrition(ingredients: ResolvedIngredient[], servings = 1) {
  const total = calculateMacroTotals(ingredients.map((i) => i.nutrition));
  const totalWeight = round2(ingredients.reduce((a, i) => a + i.baseAmount, 0));
  const n = servings > 0 ? servings : 1;
  const perServing: MacroNutrients = {
    calories: round2(total.calories / n),
    protein_g: round2(total.protein_g / n),
    carbs_g: round2(total.carbs_g / n),
    fat_g: round2(total.fat_g / n),
    fiber_g: round2(total.fiber_g / n),
  };
  return { total, perServing, totalWeight, weightPerServing: round2(totalWeight / n) };
}

/** Express a recipe as a "food" so it can be logged by gram or by serving like anything else. */
export function recipeAsNutritionPer(r: { total: MacroNutrients; totalWeight: number }): NutritionPer {
  return { ...r.total, base_quantity: Math.max(r.totalWeight, 0.01), base_unit: "g" };
}

export type MacroTargets = { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };

/** Remaining against targets (never negative) — feeds the meal assistant and notifications. */
export function calculateRemainingMacros(consumed: MacroNutrients, targets: MacroTargets): MacroNutrients {
  const left = (t: number, c: number) => Math.max(0, round2(t - c));
  return {
    calories: left(targets.calories, consumed.calories),
    protein_g: left(targets.protein_g, consumed.protein_g),
    carbs_g: left(targets.carbs_g, consumed.carbs_g),
    fat_g: left(targets.fat_g, consumed.fat_g),
    fiber_g: left(targets.fiber_g, consumed.fiber_g),
  };
}
