import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import type { SettingsInput } from "@/lib/validations/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile || !settings) {
    return <p role="status">Your profile is still being created. Refresh in a few seconds.</p>;
  }

  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(profile.timezone)) zones.unshift(profile.timezone);

  const defaults: SettingsInput = {
    displayName: profile.display_name ?? "",
    birthDate: profile.birth_date ?? undefined,
    sex: profile.sex ?? undefined,
    heightCm: profile.height_cm ?? undefined,
    activityLevel: profile.activity_level ?? undefined,
    experienceLevel: profile.experience_level ?? undefined,
    primaryGoal: profile.primary_goal ?? undefined,
    timezone: profile.timezone,
    calorieTarget: settings.calorie_target,
    proteinTargetG: settings.protein_target_g,
    carbsTargetG: settings.carbs_target_g,
    fatTargetG: settings.fat_target_g,
    fiberTargetG: settings.fiber_target_g,
    waterTargetMl: settings.water_target_ml,
    sleepTargetHours: settings.sleep_target_minutes / 60,
    weeklyWorkoutTarget: settings.weekly_workout_target,
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold md:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </header>
      <SettingsForm defaults={defaults} timeZones={zones} />
    </div>
  );
}
