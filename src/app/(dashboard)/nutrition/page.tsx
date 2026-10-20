import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getDiary } from "@/features/nutrition/diary";
import { MEAL_LABEL } from "@/features/nutrition/meals";
import { DateNav } from "@/components/nutrition/date-nav";
import { DiaryItemRow } from "@/components/nutrition/diary-item-row";
import { NutritionToday } from "@/components/dashboard/nutrition-today";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isoDate } from "@/lib/validations/nutrition";
import { formatInt } from "@/utils/format";
import { todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Nutrition diary" };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile || !settings) return <p role="status">Your profile is still being created. Refresh in a few seconds.</p>;

  const today = todayInTimeZone(profile.timezone);
  const parsed = isoDate.safeParse((await searchParams).date);
  const date = parsed.success ? parsed.data : today;
  const diary = await getDiary(date);

  return (
    <div className="flex flex-col gap-6">
      <DateNav date={date} today={today} />
      <NutritionToday title="Daily total" nutrition={{ ...diary.totals, items_count: diary.itemCount }} targets={settings} />

      <div className="flex flex-col gap-4">
        {diary.meals.map((m) => (
          <Card key={m.meal} className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="font-display text-lg font-semibold">{MEAL_LABEL[m.meal]}</h2>
              <div className="flex items-center gap-3">
                <span className="tabular text-sm text-muted-foreground">{m.items.length ? `${formatInt(m.totals.calories)} kcal` : ""}</span>
                <Link href={`/nutrition/log?date=${date}&meal=${m.meal}`} aria-label={`Add food to ${MEAL_LABEL[m.meal]}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                  <Plus /> Add
                </Link>
              </div>
            </div>
            {m.items.length ? (
              <ul className="divide-y">
                {m.items.map((i) => (
                  <DiaryItemRow key={i.id} item={i} meal={m.meal} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">Nothing logged.</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
