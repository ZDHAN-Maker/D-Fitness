import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/nutrition/recipe-form";
import { getRecipeForEdit } from "@/features/nutrition/library";
import { z } from "zod";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const recipe = await getRecipeForEdit(parsed.data);
  if (!recipe) notFound();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Edit “{recipe.name}”</h2>
      <RecipeForm initial={recipe} />
    </section>
  );
}
