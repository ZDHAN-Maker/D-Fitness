import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomFoodForm } from "@/components/nutrition/custom-food-form";
import { getCustomFoodForEdit } from "@/features/nutrition/library";
import { z } from "zod";

export const metadata: Metadata = { title: "Edit custom food" };

export default async function EditCustomFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const food = await getCustomFoodForEdit(parsed.data);
  if (!food) notFound();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Edit “{food.name}”</h2>
      <CustomFoodForm initial={food} />
    </section>
  );
}
