import type { Metadata } from "next";
import { WorkoutGenerator } from "@/components/ai/workout-generator";
import { requireUser } from "@/lib/auth/session";
import { tryGetAiConfig } from "@/lib/ai/config";
import { createClient } from "@/lib/supabase/server";
import { getFacets } from "@/features/workout/exercises";

export const metadata: Metadata = { title: "AI workout generator" };

export default async function WorkoutGeneratorPage() {
  await requireUser();
  const supabase = await createClient();
  const [facets, prefs] = await Promise.all([getFacets(), supabase.from("user_preferences").select("available_equipment").maybeSingle()]);
  return <WorkoutGenerator equipmentOptions={facets.equipment} defaultEquipment={(prefs.data?.available_equipment as string[]) ?? []} disabled={!tryGetAiConfig().configured} />;
}
