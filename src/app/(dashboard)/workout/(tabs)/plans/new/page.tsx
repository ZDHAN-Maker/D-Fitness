import type { Metadata } from "next";
import { PlanBuilder } from "@/components/workout/plan-builder";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";

export const metadata: Metadata = { title: "New workout plan" };

export default async function NewPlanPage() {
  const [facets, categories] = await Promise.all([getFacets(), getExerciseCategories()]);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">New workout plan</h2>
      <PlanBuilder facets={facets} categories={categories} />
    </section>
  );
}
