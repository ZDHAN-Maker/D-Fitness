import { calculateCaloriesFromServing, calculateRecipeNutrition, type PortionOption } from "@/lib/calculations/nutrition";
import type { FoodResult, IngredientDraft } from "@/features/nutrition/types";
import type { RecipeInput } from "@/lib/validations/nutrition";

/** Client-safe helpers shared by the custom-food and recipe forms (pure; no server imports). */

export const optionOf = (d: IngredientDraft): PortionOption => d.ref.options.find((o) => o.key === d.optionKey) ?? d.ref.options[0]!;

/** A sensible starting amount: 100 for g/ml, otherwise 1 of the serving. */
export const startingQuantity = (o: PortionOption) => (o.servingId === null && (o.unitCode === "g" || o.unitCode === "ml") ? 100 : 1);

export function newDraft(ref: FoodResult): IngredientDraft | null {
  const opt = ref.options.find((o) => o.isDefault) ?? ref.options[0];
  return opt ? { ref, quantity: startingQuantity(opt), optionKey: opt.key } : null;
}

export function draftNutrition(d: IngredientDraft) {
  const q = Number.isFinite(d.quantity) && d.quantity > 0 ? d.quantity : 0;
  return calculateCaloriesFromServing(d.ref.per, optionOf(d), q);
}

export function draftTotals(drafts: IngredientDraft[], servings = 1) {
  return calculateRecipeNutrition(
    drafts.map((d) => ({ baseAmount: (Number.isFinite(d.quantity) ? d.quantity : 0) * optionOf(d).baseAmountPerUnit, nutrition: draftNutrition(d) })),
    servings,
  );
}

export function toIngredientInput(d: IngredientDraft): RecipeInput["ingredients"][number] {
  const o = optionOf(d);
  return { kind: d.ref.kind === "custom" ? "custom" : "food", id: d.ref.id, portion: { quantity: d.quantity, unitCode: o.unitCode, servingId: o.servingId } };
}
