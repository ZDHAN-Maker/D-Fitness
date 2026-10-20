"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { settingsSchema } from "@/lib/validations/settings";

/**
 * Updates profile + targets for the signed-in user.
 * Validation is repeated here: client-side checks are a convenience, never the security boundary.
 * RLS guarantees the rows touched are the caller's own.
 */
export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const v = settingsSchema.parse(input);
    const supabase = await createClient();

    const profile = await supabase
      .from("profiles")
      .update({
        display_name: v.displayName,
        birth_date: v.birthDate ?? null,
        sex: v.sex ?? null,
        height_cm: v.heightCm ?? null,
        activity_level: v.activityLevel ?? null,
        experience_level: v.experienceLevel ?? null,
        primary_goal: v.primaryGoal ?? null,
        timezone: v.timezone,
        onboarding_completed: true,
      })
      .eq("id", user.id);
    if (profile.error) throw profile.error;

    const settings = await supabase
      .from("user_settings")
      .update({
        calorie_target: v.calorieTarget,
        protein_target_g: v.proteinTargetG,
        carbs_target_g: v.carbsTargetG,
        fat_target_g: v.fatTargetG,
        fiber_target_g: v.fiberTargetG,
        water_target_ml: v.waterTargetMl,
        sleep_target_minutes: Math.round(v.sleepTargetHours * 60),
        weekly_workout_target: v.weeklyWorkoutTarget,
      })
      .eq("user_id", user.id);
    if (settings.error) throw settings.error;

    revalidatePath("/dashboard");
    revalidatePath("/settings");
  });
}
