import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getDailyDashboard } from "@/features/dashboard/get-daily-dashboard";
import { NutritionToday } from "@/components/dashboard/nutrition-today";
import { WaterToday } from "@/components/dashboard/water-today";
import { TrainingToday } from "@/components/dashboard/training-today";
import { BodyToday } from "@/components/dashboard/body-today";
import { GoalsToday } from "@/components/dashboard/goals-today";
import { InsightCard } from "@/components/ai/insight-card";
import { tryGetAiConfig } from "@/lib/ai/config";
import { QuickActionsList } from "@/components/dashboard/quick-actions-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate, greetingForHour, hourInTimeZone, todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);

  if (!profile || !settings) {
    return (
      <div role="status" className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Setting up your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your profile is being created. Refresh in a few seconds.</p>
      </div>
    );
  }

  const tz = profile.timezone;
  const today = todayInTimeZone(tz);
  const data = await getDailyDashboard(settings, today);
  const name = profile.display_name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto grid max-w-6xl gap-8 xl:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold md:text-4xl">
            {greetingForHour(hourInTimeZone(tz))}, {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatLongDate(today)}</p>
        </header>

        {!profile.onboarding_completed ? (
          <Card className="border-primary/40 bg-accent">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium text-accent-foreground">Set your targets</p>
                <p className="text-sm text-muted-foreground">Calories, macros, water and time zone drive everything on this page.</p>
              </div>
              <Link href="/settings" className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
                Open settings
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <NutritionToday nutrition={data.nutrition} targets={data.targets} />
          <WaterToday currentMl={data.waterMl} targetMl={data.targets.water_target_ml} date={today} />
        </div>

        <TrainingToday workout={data.workout} pr={data.recentPR} today={today} />

        <BodyToday weight={data.weight} sleep={data.sleep} recovery={data.recovery} />

        <InsightCard initial={data.insight} configured={tryGetAiConfig().configured} />

        <GoalsToday goals={data.goals} streaks={data.streaks} today={today} />

      </div>

      <aside aria-label="Quick actions" className="hidden xl:block">
        <Card className="sticky top-8">
          <CardHeader>
            <CardTitle>Quick add</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActionsList />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
