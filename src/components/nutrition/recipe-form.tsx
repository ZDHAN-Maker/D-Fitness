"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/ui/field";
import { IngredientBuilder } from "@/components/nutrition/ingredient-builder";
import { TotalsCard } from "@/components/nutrition/totals-card";
import { saveRecipeAction } from "@/features/nutrition/actions";
import { draftTotals, toIngredientInput } from "@/features/nutrition/drafts";
import type { IngredientDraft } from "@/features/nutrition/types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  description: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(4000).optional(),
  servings: z.number({ invalid_type_error: "Enter servings" }).positive("Must be greater than 0").max(100),
});
type FormValues = z.infer<typeof formSchema>;

export type RecipeInitial = { id?: string; name: string; description: string; instructions: string; servings: number; ingredients: IngredientDraft[] };

export function RecipeForm({ initial = { name: "", description: "", instructions: "", servings: 1, ingredients: [] } }: { initial?: RecipeInitial }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<IngredientDraft[]>(initial.ingredients);
  const [ingError, setIngError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { name: initial.name, description: initial.description, instructions: initial.instructions, servings: initial.servings } });

  const servingsRaw = watch("servings");
  const servings = Number.isFinite(servingsRaw) && servingsRaw > 0 ? servingsRaw : 1;
  const totals = draftTotals(drafts, servings);

  const onSubmit = handleSubmit((v) => {
    setServerError(undefined);
    setIngError(undefined);
    if (drafts.length === 0) return setIngError("Add at least one ingredient");
    if (drafts.some((d) => !(d.quantity > 0))) return setIngError("Every ingredient needs an amount greater than 0");
    startTransition(async () => {
      const res = await saveRecipeAction({ id: initial.id, ...v, ingredients: drafts.map(toIngredientInput) });
      if (!res.ok) return setServerError(res.error);
      router.push("/nutrition/recipes");
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
        <Field id="name" label="Recipe name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...fieldAria("name", errors.name?.message)} placeholder="e.g. My Breakfast" {...register("name")} />
        </Field>
        <Field id="servings" label="Servings this makes" error={errors.servings?.message}>
          <Input {...fieldAria("servings", errors.servings?.message)} type="number" inputMode="decimal" step="any" {...register("servings", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })} />
        </Field>
        <Field id="description" label="Description (optional)" error={errors.description?.message}>
          <Input {...fieldAria("description", errors.description?.message)} {...register("description")} />
        </Field>
      </div>

      <section aria-labelledby="ingredients-h" className="flex flex-col gap-3">
        <h2 id="ingredients-h" className="text-lg font-semibold">
          Ingredients
        </h2>
        <IngredientBuilder value={drafts} onChange={setDrafts} allowCustom error={ingError} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <TotalsCard title="Per serving" n={totals.perServing} note={`${totals.weightPerServing} g per serving`} />
        <TotalsCard title="Whole recipe" n={totals.total} note={`${totals.totalWeight} g in total`} />
      </div>

      <Field id="instructions" label="Instructions (optional)" error={errors.instructions?.message}>
        <textarea id="instructions" rows={4} className="w-full rounded-md border border-input bg-card px-3 py-2 text-base md:text-sm" {...register("instructions")} />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {initial.id ? "Save changes" : "Save recipe"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/nutrition/recipes")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
