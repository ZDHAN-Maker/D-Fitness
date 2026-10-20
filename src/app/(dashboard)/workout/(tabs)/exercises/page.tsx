import type { Metadata } from "next";
import { ExerciseBrowser } from "@/components/workout/exercise-browser";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";

export const metadata: Metadata = { title: "Exercise library" };

export default async function ExerciseLibraryPage() {
  const [facets, categories] = await Promise.all([getFacets(), getExerciseCategories()]);
  return <ExerciseBrowser facets={facets} categories={categories} />;
}
