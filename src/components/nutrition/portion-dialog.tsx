"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { calculateCaloriesFromServing, defaultOption, toBaseAmount } from "@/lib/calculations/nutrition";
import { logFoodAction, updateLogItemAction } from "@/features/nutrition/actions";
import { MEAL_LABEL, MEAL_ORDER } from "@/features/nutrition/meals";
import type { FoodResult } from "@/features/nutrition/types";
import { formatDecimal, formatInt } from "@/utils/format";
import type { MealType } from "@/types/domain";

type Base = { food: FoodResult | null; onClose: () => void; initialMeal: MealType };
type Props =
  | (Base & { mode: "add"; date: string; onDone: (msg: string) => void })
  | (Base & { mode: "edit"; itemId: string; initial: { quantity: number; optionKey: string }; onDone: () => void });

/** Pick an amount in any available unit, see the nutrition update live, then save. */
export function PortionDialog(props: Props) {
  const { food, onClose, initialMeal } = props;
  const [qty, setQty] = useState("1");
  const [optionKey, setOptionKey] = useState("");
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!food) return;
    setError(undefined);
    setMeal(initialMeal);
    if (props.mode === "edit") {
      setQty(String(props.initial.quantity));
      setOptionKey(props.initial.optionKey);
    } else {
      const opt = defaultOption(food.options);
      setOptionKey(opt?.key ?? "");
      setQty(opt && opt.servingId === null && (opt.unitCode === "g" || opt.unitCode === "ml") ? "100" : "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food?.kind, food?.id]);

  if (!food) return null;
  const option = food.options.find((o) => o.key === optionKey) ?? food.options[0];
  const quantity = Number(qty);
  const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= 100000 && Boolean(option);
  const n = valid && option ? calculateCaloriesFromServing(food.per, option, quantity) : null;

  const submit = () => {
    if (!valid || !option) return;
    setError(undefined);
    const portion = { quantity, unitCode: option.unitCode, servingId: option.servingId };
    startTransition(async () => {
      if (props.mode === "add") {
        const res = await logFoodAction({ date: props.date, mealType: meal, ref: { kind: food.kind, id: food.id }, portion });
        if (!res.ok) return setError(res.error);
        props.onDone(`Added ${food.name} to ${MEAL_LABEL[meal]}`);
      } else {
        const res = await updateLogItemAction({ itemId: props.itemId, mealType: meal, portion });
        if (!res.ok) return setError(res.error);
        props.onDone();
      }
    });
  };

  return (
    <BottomSheet open onClose={onClose} title={food.name}>
      <div className="flex flex-col gap-4">
        <p className="-mt-1 text-sm text-muted-foreground">
          {food.brand ? `${food.brand} · ` : ""}
          {formatInt(food.summary.nutrition.calories)} kcal / {food.summary.label}
        </p>

        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portion-qty">Amount</Label>
            <Input id="portion-qty" type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={!valid} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="portion-unit">Unit</Label>
            <Select id="portion-unit" value={option?.key} onChange={(e) => setOptionKey(e.target.value)}>
              {food.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portion-meal">Meal</Label>
          <Select id="portion-meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
            {MEAL_ORDER.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>

        <div className="rounded-lg bg-muted p-4" aria-live="polite">
          <p className="tabular font-display text-3xl font-bold leading-none">
            {n ? formatInt(n.calories) : "–"} <span className="text-base font-medium text-muted-foreground">kcal</span>
          </p>
          <p className="tabular mt-1 text-xs text-muted-foreground">{valid && option ? `${formatDecimal(toBaseAmount(quantity, option))} ${food.per.base_unit}` : "Enter an amount"}</p>
          {n ? (
            <dl className="tabular mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              {[
                ["Protein", n.protein_g, "text-protein"],
                ["Carbs", n.carbs_g, "text-carbs"],
                ["Fat", n.fat_g, "text-fat"],
                ["Fibre", n.fiber_g, "text-fiber"],
              ].map(([label, v, cls]) => (
                <div key={label as string}>
                  <dd className={`font-semibold ${cls}`}>{formatDecimal(v as number)} g</dd>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <Button onClick={submit} disabled={!valid || pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {props.mode === "add" ? "Add to diary" : "Save changes"}
        </Button>
      </div>
    </BottomSheet>
  );
}
