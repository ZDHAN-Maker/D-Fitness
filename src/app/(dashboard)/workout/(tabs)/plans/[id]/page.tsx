import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanBuilder } from "@/components/workout/plan-builder";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";
import { getPlanForEdit } from "@/features/workout/plans";

export const metadata: Metadata = { title: "Edit workout plan" };

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [plan, facets, categories] = await Promise.all([getPlanForEdit(id.data), getFacets(), getExerciseCategories()]);
  if (!plan) notFound();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Edit “{plan.name}”</h2>
      <PlanBuilder initial={plan} facets={facets} categories={categories} />
    </section>
  );
}
