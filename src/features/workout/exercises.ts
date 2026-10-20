import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, Difficulty, TrackingMode } from "@/types/domain";
import type { ExerciseSearchInput } from "@/lib/validations/workout";

type Row = Record<string, unknown>;

export const toExercise = (r: Row): Exercise => ({
  id: Number(r.id),
  source_id: (r.source_id as string) ?? null,
  category_id: r.category_id === null || r.category_id === undefined ? null : Number(r.category_id),
  name: String(r.name),
  primary_muscle: (r.primary_muscle as string) ?? null,
  secondary_muscles: (r.secondary_muscles as string[]) ?? [],
  equipment: (r.equipment as string) ?? null,
  difficulty: (r.difficulty as Difficulty) ?? null,
  movement_type: (r.movement_type as string) ?? null,
  tracking_mode: (r.tracking_mode as TrackingMode) ?? "weight_reps",
  instructions: (r.instructions as string) ?? null,
  image_url: (r.image_url as string) ?? null,
  video_url: (r.video_url as string) ?? null,
});

export type ExerciseFacets = { muscles: string[]; equipment: string[]; difficulties: string[]; movements: string[] };

export const getFacets = cache(async (): Promise<ExerciseFacets> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exercise_facets");
  if (error) throw error;
  const f = (data ?? {}) as Partial<ExerciseFacets>;
  return { muscles: f.muscles ?? [], equipment: f.equipment ?? [], difficulties: f.difficulties ?? [], movements: f.movements ?? [] };
});

export const getExerciseCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercise_categories").select("id, name, slug").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as { id: number; name: string; slug: string }[];
});

/** Database-driven, paginated. Filters AND together; the text query is typo tolerant. */
export async function searchExercises(p: ExerciseSearchInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_exercises", {
    p_query: p.q,
    p_category_id: p.category ?? null,
    p_muscle: p.muscle ?? null,
    p_equipment: p.equipment ?? null,
    p_difficulty: p.difficulty ?? null,
    p_movement: p.movement ?? null,
    p_limit: p.limit + 1,
    p_offset: p.offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  return { items: rows.slice(0, p.limit).map(toExercise), hasMore: rows.length > p.limit };
}

export async function getExercise(id: number): Promise<Exercise | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toExercise(data) : null;
}
