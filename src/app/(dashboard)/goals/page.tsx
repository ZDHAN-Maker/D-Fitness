import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listGoals, trySyncProgress } from "@/features/goals/service";
import { GoalCard } from "@/components/goals/goal-card";
import { buttonVariants } from "@/components/ui/button";
import { todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  await trySyncProgress(today); // progress is recomputed from your data before listing
  const goals = await listGoals();

  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "completed");
  const other = goals.filter((g) => g.status === "paused" || g.status === "abandoned");

  const section = (title: string, list: typeof goals) =>
    list.length ? (
      <section aria-label={title} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
        <div className="grid gap-3 sm:grid-cols-2">{list.map((g) => <GoalCard key={g.id} goal={g} today={today} />)}</div>
      </section>
    ) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold md:text-4xl">Goals</h1>
        <Link href="/goals/new" className={cn(buttonVariants())}><Plus /> New goal</Link>
      </header>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Target className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-medium">No goals yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Pick a target like 75.4 → 70 kg, a bench press of 80 kg, a sub-28-minute 5K, 150 g of protein a day, or 4 workouts a week. Progress updates itself from what you log.</p>
          <Link href="/goals/new" className={cn(buttonVariants(), "mt-4")}>Set your first goal</Link>
        </div>
      ) : null}

      {section("Active", active)}
      {section("Reached", done)}
      {section("Paused or stopped", other)}
    </div>
  );
}
