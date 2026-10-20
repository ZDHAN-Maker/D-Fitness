"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { postAi } from "@/components/ai/ai-client";
import { MacroLine } from "@/components/nutrition/macro-line";
import { logMealAction } from "@/features/ai/actions";
import { MEAL_LABEL, MEAL_ORDER } from "@/features/nutrition/meals";
import type { MealSuggestion } from "@/features/ai/meal";
import { formatDecimal, formatInt } from "@/utils/format";
import type { MealType } from "@/types/domain";

export function MealAssistant({ defaultMeal, disabled }: { defaultMeal: MealType; disabled: boolean }) {
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<MealSuggestion>();
  const [error, setError] = useState<string>();
  const [logged, setLogged] = useState<number | null>(null);
  const [logging, setLogging] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startLog] = useTransition();

  const ask = () => {
    setError(undefined);
    setLogged(null);
    startTransition(async () => {
      const res = await postAi<MealSuggestion>("/api/ai/meal-assistant", { mealType: meal, note });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
    });
  };

  const log = (idx: number) => {
    if (!result) return;
    const o = result.options[idx]!;
    setError(undefined);
    setLogging(idx);
    startLog(async () => {
      const res = await logMealAction({ date: result.date, mealType: meal, items: o.items.map((i) => ({ foodId: i.foodId, amount: i.amount })) });
      setLogging(null);
      if (!res.ok) return setError(res.error);
      setLogged(idx);
    });
  };

  const r = result?.remaining;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Suggests meals from foods in the database that fit what you have left today. Nutrition is calculated by the app, not by the AI.</p>

      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field id="meal-type" label="Meal">
          <Select {...fieldAria("meal-type")} value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
            {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
          </Select>
        </Field>
        <Field id="meal-note" label="Anything else? (optional)">
          <Input {...fieldAria("meal-note")} maxLength={200} placeholder="e.g. something quick, no rice" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button type="button" onClick={ask} disabled={disabled || pending} className="sm:mb-[1.4rem]">
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest
        </Button>
      </div>

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {result && r ? (
        <section aria-label="Suggestions" className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Remaining today">
            {[["Calories left", `${formatInt(r.calories)} kcal`], ["Protein left", `${formatDecimal(r.protein_g)} g`], ["Carbs left", `${formatDecimal(r.carbs_g)} g`], ["Fat left", `${formatDecimal(r.fat_g)} g`]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>
            ))}
          </dl>

          {result.skipped === "target_reached" ? <p className="rounded-lg border bg-card p-4 text-sm">{result.note}</p> : null}

          {result.options.map((o, i) => (
            <article key={i} className="rounded-lg border bg-card p-4">
              <h3 className="font-display text-lg font-semibold">{o.title}</h3>
              {o.rationale ? <p className="mt-0.5 text-sm text-muted-foreground">{o.rationale}</p> : null}
              <ul className="mt-3 divide-y text-sm">
                {o.items.map((it) => (
                  <li key={it.foodId} className="flex items-center justify-between gap-3 py-1.5">
                    <span>{it.name}</span>
                    <span className="tabular text-muted-foreground">{formatDecimal(it.amount)} {it.unit} · {formatInt(it.nutrition.calories)} kcal</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <div>
                  <p className="tabular font-display text-2xl font-bold leading-none">{formatInt(o.totals.calories)} <span className="text-sm font-medium text-muted-foreground">kcal</span></p>
                  <MacroLine m={o.totals} />
                  {o.proteinShare > 0 ? <p className="tabular mt-0.5 text-xs text-muted-foreground">Covers about {Math.round(o.proteinShare * 100)}% of your remaining protein</p> : null}
                </div>
                {logged === i ? (
                  <Link href={`/nutrition?date=${result.date}`} className="flex items-center gap-1.5 text-sm font-medium text-fiber"><Check className="size-4" aria-hidden="true" /> Logged. View diary</Link>
                ) : (
                  <Button type="button" variant="secondary" disabled={logging !== null || logged !== null} onClick={() => log(i)}>
                    {logging === i ? <Loader2 className="animate-spin" /> : null} Log as {MEAL_LABEL[meal].toLowerCase()}
                  </Button>
                )}
              </div>
            </article>
          ))}
          {result.options.length ? <p className="text-xs text-muted-foreground">{result.note ? `${result.note} ` : ""}Check ingredients against your allergies and dietary needs before eating.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
