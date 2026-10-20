import type { Metadata } from "next";
import { FoodScan } from "@/components/ai/food-scan";
import { requireUser } from "@/lib/auth/session";
import { tryGetAiConfig } from "@/lib/ai/config";
import { getProfileAndSettings } from "@/features/profile/queries";
import { defaultMealForHour } from "@/features/nutrition/meals";
import { hourInTimeZone, todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "AI food scanner" };

export default async function ScanPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const tz = profile?.timezone ?? "UTC";
  return <FoodScan userId={user.id} date={todayInTimeZone(tz)} defaultMeal={defaultMealForHour(hourInTimeZone(tz))} disabled={!tryGetAiConfig().configured} />;
}
