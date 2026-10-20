import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listPlans } from "@/features/workout/plans";
import { deletePlanAction } from "@/features/workout/actions";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workout plans" };
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function PlansPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const plans = await listPlans();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Templates you can start in one tap.</p>
        <Link href="/workout/plans/new" className={cn(buttonVariants())}>
          <Plus /> New plan
        </Link>
      </div>
      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No workout plans yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Build “Push Day”: bench press, incline press, shoulder press, lateral raise, triceps pushdown.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-3 pl-4 pr-2">
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.exercise_count} exercises{p.scheduled_days.length ? ` · ${p.scheduled_days.map((d) => DAY[d]).join(", ")}` : ""}
                </p>
              </div>
              <StartWorkoutButton date={today} planId={p.id} size="sm" />
              <Link href={`/workout/plans/${p.id}`} aria-label={`Edit ${p.name}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                <Pencil />
              </Link>
              <DeleteButton label={p.name} action={deletePlanAction.bind(null, p.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
