import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listPlans } from "@/features/workout/plans";
import { getActiveSession } from "@/features/workout/sessions";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { buttonVariants } from "@/components/ui/button";
import { todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Start workout" };

export default async function StartWorkoutPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const [plans, active] = await Promise.all([listPlans(), getActiveSession()]);

  if (active) {
    return (
      <div className="rounded-lg border bg-accent p-6 text-center">
        <p className="font-medium">You already have a workout in progress.</p>
        <Link href={`/workout/session/${active.id}`} className={cn(buttonVariants(), "mt-3")}>Resume {active.name}</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StartWorkoutButton date={today} label="Start an empty workout" variant="secondary" />
      <h2 className="text-lg font-semibold">Or start a plan</h2>
      {plans.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No plans yet. <Link href="/workout/plans/new" className="font-medium text-primary underline-offset-4 hover:underline">Build one</Link>.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.exercise_count} exercises</p>
              </div>
              <StartWorkoutButton date={today} planId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
