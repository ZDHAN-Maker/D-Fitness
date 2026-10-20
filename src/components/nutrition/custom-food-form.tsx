"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, fieldAria } from "@/components/ui/field";
import { IngredientBuilder } from "@/components/nutrition/ingredient-builder";
import { TotalsCard } from "@/components/nutrition/totals-card";
import { saveCustomFoodAction } from "@/features/nutrition/actions";
import { draftTotals, toIngredientInput } from "@/features/nutrition/drafts";
import type { IngredientDraft } from "@/features/nutrition/types";
import { cn } from "@/lib/utils";

const num = (label: string, max: number) => z.number({ invalid_type_error: `Enter ${label}` }).min(0, "Cannot be negative").max(max, "Too large");

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(80),
    brand: z.string().trim().max(60).optional(),
    description: z.string().trim().max(300).optional(),
    mode: z.enum(["manual", "ingredients"]),
    baseQuantity: z.number({ invalid_type_error: "Enter an amount" }).positive("Must be greater than 0").max(10000),
    baseUnit: z.enum(["g", "ml"]),
    calories: num("calories", 10000),
    protein_g: num("protein", 1000),
    carbs_g: num("carbs", 1000),
    fat_g: num("fat", 1000),
    fiber_g: num("fibre", 1000),
  })
  .partial({ baseQuantity: true, calories: true, protein_g: true, carbs_g: true, fat_g: true, fiber_g: true });
type FormValues = z.infer<typeof formSchema>;

export type CustomFoodInitial = {
  id?: string;
  name: string;
  brand: string;
  description: string;
  isComposite: boolean;
  manual: { baseQuantity: number; baseUnit: "g" | "ml"; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  ingredients: IngredientDraft[];
};

const EMPTY: CustomFoodInitial = {
  name: "",
  brand: "",
  description: "",
  isComposite: false,
  manual: { baseQuantity: 100, baseUnit: "g", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  ingredients: [],
};

const n = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v)) } as const;

export function CustomFoodForm({ initial = EMPTY }: { initial?: CustomFoodInitial }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<IngredientDraft[]>(initial.ingredients);
  const [ingError, setIngError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: initial.name, brand: initial.brand, description: initial.description, mode: initial.isComposite ? "ingredients" : "manual", baseQuantity: initial.manual.baseQuantity, baseUnit: initial.manual.baseUnit, calories: initial.manual.calories, protein_g: initial.manual.protein_g, carbs_g: initial.manual.carbs_g, fat_g: initial.manual.fat_g, fiber_g: initial.manual.fiber_g },
  });
  const mode = watch("mode");
  const totals = draftTotals(drafts, 1);

  const onSubmit = handleSubmit((v) => {
    setServerError(undefined);
    setIngError(undefined);
    if (v.mode === "ingredients" && drafts.length === 0) return setIngError("Add at least one ingredient");
    if (v.mode === "ingredients" && drafts.some((d) => !(d.quantity > 0))) return setIngError("Every ingredient needs an amount greater than 0");
    if (v.mode === "manual" && (v.baseQuantity === undefined || v.calories === undefined)) return setServerError("Enter the amount and calories this nutrition applies to.");

    const payload = {
      id: initial.id,
      name: v.name,
      brand: v.brand,
      description: v.description,
      mode: v.mode,
      manual: v.mode === "manual" ? { baseQuantity: v.baseQuantity!, baseUnit: v.baseUnit, calories: v.calories!, protein_g: v.protein_g ?? 0, carbs_g: v.carbs_g ?? 0, fat_g: v.fat_g ?? 0, fiber_g: v.fiber_g ?? 0 } : undefined,
      ingredients: v.mode === "ingredients" ? drafts.map((d) => ({ ...toIngredientInput(d), kind: "food" as const })) : undefined,
    };
    startTransition(async () => {
      const res = await saveCustomFoodAction(payload);
      if (!res.ok) return setServerError(res.error);
      router.push("/nutrition/custom");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...fieldAria("name", errors.name?.message)} placeholder="e.g. Indomie + 2 eggs + sausage" {...register("name")} />
        </Field>
        <Field id="brand" label="Brand (optional)" error={errors.brand?.message}>
          <Input {...fieldAria("brand", errors.brand?.message)} {...register("brand")} />
        </Field>
        <Field id="description" label="Notes (optional)" error={errors.description?.message}>
          <Input {...fieldAria("description", errors.description?.message)} {...register("description")} />
        </Field>
      </div>

      <div role="radiogroup" aria-label="How do you want to define it?" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {([["manual", "Enter nutrition"], ["ingredients", "Build from ingredients"]] as const).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setValue("mode", value)} className={cn("h-10 rounded-md text-sm font-medium", mode === value ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {mode === "manual" ? (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm text-muted-foreground">Nutrition values apply to this amount:</legend>
          <Field id="baseQuantity" label="Amount" error={errors.baseQuantity?.message}>
            <Input {...fieldAria("baseQuantity", errors.baseQuantity?.message)} type="number" inputMode="decimal" step="any" {...register("baseQuantity", n)} />
          </Field>
          <Field id="baseUnit" label="Unit">
            <Select {...fieldAria("baseUnit")} {...register("baseUnit")}>
              <option value="g">grams (g)</option>
              <option value="ml">millilitres (ml)</option>
            </Select>
          </Field>
          <Field id="calories" label="Calories (kcal)" error={errors.calories?.message}>
            <Input {...fieldAria("calories", errors.calories?.message)} type="number" inputMode="decimal" step="any" {...register("calories", n)} />
          </Field>
          <Field id="protein_g" label="Protein (g)" error={errors.protein_g?.message}>
            <Input {...fieldAria("protein_g", errors.protein_g?.message)} type="number" inputMode="decimal" step="any" {...register("protein_g", n)} />
          </Field>
          <Field id="carbs_g" label="Carbs (g)" error={errors.carbs_g?.message}>
            <Input {...fieldAria("carbs_g", errors.carbs_g?.message)} type="number" inputMode="decimal" step="any" {...register("carbs_g", n)} />
          </Field>
          <Field id="fat_g" label="Fat (g)" error={errors.fat_g?.message}>
            <Input {...fieldAria("fat_g", errors.fat_g?.message)} type="number" inputMode="decimal" step="any" {...register("fat_g", n)} />
          </Field>
          <Field id="fiber_g" label="Fibre (g)" error={errors.fiber_g?.message}>
            <Input {...fieldAria("fiber_g", errors.fiber_g?.message)} type="number" inputMode="decimal" step="any" {...register("fiber_g", n)} />
          </Field>
        </fieldset>
      ) : (
        <div className="flex flex-col gap-4">
          <IngredientBuilder value={drafts} onChange={setDrafts} allowCustom={false} error={ingError} />
          <TotalsCard title="Total for this food" n={totals.total} note={`Total weight ${totals.totalWeight} g. When you log it, 1 portion = everything above; you can also log it by gram.`} />
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {initial.id ? "Save changes" : "Save food"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/nutrition/custom")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
