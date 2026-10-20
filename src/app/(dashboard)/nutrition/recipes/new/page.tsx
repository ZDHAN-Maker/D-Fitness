import type { Metadata } from "next";
import { RecipeForm } from "@/components/nutrition/recipe-form";

export const metadata: Metadata = { title: "New recipe" };

export default function NewRecipePage() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">New recipe</h2>
      <RecipeForm />
    </section>
  );
}
