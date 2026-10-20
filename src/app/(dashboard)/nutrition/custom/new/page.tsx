import type { Metadata } from "next";
import { CustomFoodForm } from "@/components/nutrition/custom-food-form";

export const metadata: Metadata = { title: "New custom food" };

export default function NewCustomFoodPage() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">New custom food</h2>
      <CustomFoodForm />
    </section>
  );
}
