import type { Metadata } from "next";
import { GoalForm } from "@/components/goals/goal-form";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listTemplates } from "@/features/goals/service";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";
import { metricsFor } from "@/lib/goals/metrics";
import { todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const [templates, facets, categories] = await Promise.all([listTemplates(), getFacets(), getExerciseCategories()]);
  const first = metricsFor("body")[0]!;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-bold">New goal</h1>
      <GoalForm
        templates={templates}
        facets={facets}
        categories={categories}
        today={today}
        initial={{ type: "body", title: "", metric: first.key, direction: first.direction, target: "", start: "", unit: "", startDate: today, targetDate: "", exercise: null, distanceKm: "" }}
      />
    </section>
  );
}
