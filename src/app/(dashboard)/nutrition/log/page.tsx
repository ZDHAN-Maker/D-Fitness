import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getCategories } from "@/features/nutrition/refs";
import { getFavoriteRefs, getRecentRefs } from "@/features/nutrition/refs";
import { defaultMealForHour, isMealType } from "@/features/nutrition/meals";
import Link from "next/link";
import { Camera } from "lucide-react";
import { FoodExplorer } from "@/components/nutrition/food-explorer";
import { isoDate } from "@/lib/validations/nutrition";
import { formatLongDate, hourInTimeZone, todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "Add food" };

type SP = { date?: string; meal?: string; q?: string };

export default async function AddFoodPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const tz = profile?.timezone ?? "UTC";
  const sp = await searchParams;

  const parsedDate = isoDate.safeParse(sp.date);
  const date = parsedDate.success ? parsedDate.data : todayInTimeZone(tz);
  const meal = isMealType(sp.meal) ? sp.meal : defaultMealForHour(hourInTimeZone(tz));

  const [categories, recent, favorites] = await Promise.all([getCategories(), getRecentRefs(10), getFavoriteRefs()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Logging for {formatLongDate(date)}</p>
        <Link href="/coach/scan" className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"><Camera className="size-4" aria-hidden="true" /> Scan a meal with AI</Link>
      </div>
      <FoodExplorer date={date} defaultMeal={meal} categories={categories} recent={recent} favorites={favorites} initialQuery={(sp.q ?? "").slice(0, 80)} />
    </div>
  );
}
