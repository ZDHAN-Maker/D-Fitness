import type { Metadata } from "next";
import { MealAssistant } from "@/components/ai/meal-assistant";
import { requireUser } from "@/lib/auth/session";
import { tryGetAiConfig } from "@/lib/ai/config";
import { getProfileAndSettings } from "@/features/profile/queries";
import { defaultMealForHour } from "@/features/nutrition/meals";
import { hourInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "AI meal assistant" };

export default async function MealPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  return <MealAssistant defaultMeal={defaultMealForHour(hourInTimeZone(profile?.timezone ?? "UTC"))} disabled={!tryGetAiConfig().configured} />;
}
