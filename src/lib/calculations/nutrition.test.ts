import { describe, expect, it } from "vitest";
import {
  buildPortionOptions,
  calculateCaloriesFromServing,
  calculateMacroTotals,
  calculateNutrition,
  calculateRecipeNutrition,
  calculateRemainingMacros,
  defaultOption,
  matchStoredOption,
  recipeAsNutritionPer,
  resolvePortion,
  toBaseAmount,
  type NutritionPer,
  type ServingDef,
  type UnitDef,
} from "./nutrition";

const units: UnitDef[] = [
  { code: "g", name: "Gram", kind: "mass", to_base_factor: 1 },
  { code: "kg", name: "Kilogram", kind: "mass", to_base_factor: 1000 },
  { code: "oz", name: "Ounce", kind: "mass", to_base_factor: 28.3495 },
  { code: "ml", name: "Milliliter", kind: "volume", to_base_factor: 1 },
  { code: "l", name: "Liter", kind: "volume", to_base_factor: 1000 },
  { code: "tbsp", name: "Tablespoon", kind: "volume", to_base_factor: 15 },
  { code: "bowl", name: "Bowl", kind: "portion", to_base_factor: null },
  { code: "egg", name: "Egg", kind: "portion", to_base_factor: null },
];

const rice: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4 };
const riceServings: ServingDef[] = [{ id: 1, label: "1 bowl", unit_code: "bowl", quantity: 1, base_amount: 160, is_default: true }];

describe("calculateNutrition", () => {
  it("200 g of nasi putih = 260 kcal (spec example)", () => {
    const n = calculateNutrition(rice, 200);
    expect(n.calories).toBe(260);
    expect(n.protein_g).toBe(5.4);
    expect(n.carbs_g).toBe(56.4);
  });
  it("scales when the base quantity is not 100", () => {
    expect(calculateNutrition({ ...rice, base_quantity: 50, calories: 100 }, 100).calories).toBe(200);
  });
  it("returns zeros for non-positive or invalid amounts", () => {
    expect(calculateNutrition(rice, 0).calories).toBe(0);
    expect(calculateNutrition(rice, -5).calories).toBe(0);
    expect(calculateNutrition(rice, Number.NaN).calories).toBe(0);
  });
});

describe("portion options", () => {
  const opts = buildPortionOptions(rice, riceServings, units);
  it("lists the default household serving first, then mass units", () => {
    expect(opts[0]).toMatchObject({ label: "bowl", baseAmountPerUnit: 160, isDefault: true });
    expect(opts.map((o) => o.unitCode)).toEqual(["bowl", "g", "kg", "oz"]);
  });
  it("never offers volume units for a gram-based food", () => {
    expect(opts.some((o) => o.unitCode === "ml" || o.unitCode === "tbsp")).toBe(false);
  });
  it("offers volume units for a ml-based food", () => {
    const milk = buildPortionOptions({ base_unit: "ml" }, [], units);
    expect(milk.map((o) => o.unitCode)).toEqual(["ml", "l", "tbsp"]);
    expect(defaultOption(milk)?.unitCode).toBe("ml");
  });
  it("falls back to grams as default when no default serving", () => {
    expect(defaultOption(buildPortionOptions(rice, [], units))?.unitCode).toBe("g");
  });
  it("1 bowl = 160 g = 208 kcal", () => {
    const bowl = resolvePortion(opts, "bowl", 1);
    expect(toBaseAmount(1, bowl)).toBe(160);
    expect(calculateCaloriesFromServing(rice, bowl, 1).calories).toBe(208);
    expect(calculateCaloriesFromServing(rice, bowl, 1.5).calories).toBe(312);
  });
  it("converts kilograms and ounces", () => {
    expect(toBaseAmount(0.2, resolvePortion(opts, "kg"))).toBe(200);
    expect(toBaseAmount(2, resolvePortion(opts, "oz"))).toBe(56.7);
  });
  it("rejects a unit the food does not offer", () => {
    expect(() => resolvePortion(opts, "tbsp")).toThrow(/not available/);
    expect(() => resolvePortion(opts, "bowl", 999)).toThrow();
  });
  it("whole portion is offered for custom foods and recipes", () => {
    const o = buildPortionOptions(rice, [], units, { label: "1 portion (350 g)", baseAmount: 350 });
    expect(defaultOption(o)).toMatchObject({ key: "whole", baseAmountPerUnit: 350 });
  });
  it("re-selects the stored option when editing", () => {
    expect(matchStoredOption(opts, "bowl", 2, 320)?.servingId).toBe(1);
    expect(matchStoredOption(opts, "g", 200, 200)?.unitCode).toBe("g");
  });
});

describe("custom food: Indomie + 2 eggs + sausage", () => {
  const noodle: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 440, protein_g: 8.8, carbs_g: 62, fat_g: 17, fiber_g: 2 };
  const egg: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 155, protein_g: 12.6, carbs_g: 1.1, fat_g: 10.6, fiber_g: 0 };
  const sausage: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 250, protein_g: 12, carbs_g: 6, fat_g: 20, fiber_g: 0.3 };
  const r = calculateRecipeNutrition(
    [
      { baseAmount: 85, nutrition: calculateNutrition(noodle, 85) },
      { baseAmount: 100, nutrition: calculateNutrition(egg, 100) }, // 2 eggs x 50 g
      { baseAmount: 40, nutrition: calculateNutrition(sausage, 40) },
    ],
    1,
  );
  it("sums calories and macros", () => {
    expect(r.total.calories).toBe(629);
    expect(r.total.protein_g).toBe(24.88);
    expect(r.totalWeight).toBe(225);
  });
});

describe("recipe: My Breakfast (spec example)", () => {
  const oats: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5, fiber_g: 10.1 };
  const banana: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6 };
  const milk: NutritionPer = { base_quantity: 100, base_unit: "ml", calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, fiber_g: 0 };
  const pb: NutritionPer = { base_quantity: 100, base_unit: "g", calories: 588, protein_g: 25, carbs_g: 20, fat_g: 50, fiber_g: 6 };
  const r = calculateRecipeNutrition(
    [
      { baseAmount: 50, nutrition: calculateNutrition(oats, 50) },
      { baseAmount: 100, nutrition: calculateNutrition(banana, 100) },
      { baseAmount: 250, nutrition: calculateNutrition(milk, 250) },
      { baseAmount: 16, nutrition: calculateNutrition(pb, 16) },
    ],
    2,
  );
  it("totals", () => {
    // oats 189.5 + banana 89 + milk 152.5 + peanut butter 94.08
    expect(r.total.calories).toBe(525.08);
    expect(r.totalWeight).toBe(416);
  });
  it("per serving divides by servings", () => expect(r.perServing.calories).toBe(262.54));
  it("can be logged by gram like any food", () => {
    const per = recipeAsNutritionPer(r);
    expect(calculateNutrition(per, r.weightPerServing).calories).toBeCloseTo(r.perServing.calories, 1);
  });
  it("guards a zero serving count", () => expect(calculateRecipeNutrition([], 0).perServing.calories).toBe(0));
});

describe("totals and remaining", () => {
  const a = { calories: 100.1, protein_g: 1, carbs_g: 2, fat_g: 3, fiber_g: 4 };
  it("sums without float drift", () => expect(calculateMacroTotals([a, a, a]).calories).toBe(300.3));
  it("remaining is never negative", () => {
    const left = calculateRemainingMacros(
      { calories: 1840, protein_g: 112, carbs_g: 210, fat_g: 58, fiber_g: 20 },
      { calories: 2300, protein_g: 150, carbs_g: 280, fat_g: 75, fiber_g: 18 },
    );
    expect(left).toEqual({ calories: 460, protein_g: 38, carbs_g: 70, fat_g: 17, fiber_g: 0 });
  });
});
