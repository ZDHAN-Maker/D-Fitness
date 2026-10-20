import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { GoalForm } from "@/components/goals/goal-form";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { getGoal, listTemplates } from "@/features/goals/service";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";
import { todayInTimeZone } from "@/utils/date";
import type { GoalType } from "@/types/domain";

export const metadata: Metadata = { title: "Edit goal" };

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { profile } = await getProfileAndSettings(user.id);
  const [goal, templates, facets, categories] = await Promise.all([getGoal(id.data), listTemplates(), getFacets(), getExerciseCategories()]);
  if (!goal) notFound();
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Edit goal</h1>
      <p className="text-sm text-muted-foreground">Saving re-activates the goal and recalculates its progress.</p>
      <GoalForm
        templates={templates}
        facets={facets}
        categories={categories}
        today={todayInTimeZone(profile?.timezone ?? "UTC")}
        initial={{
          id: goal.id,
          type: goal.goal_type as GoalType,
          title: goal.title,
          metric: goal.metric,
          direction: goal.direction,
          target: String(goal.target_value),
          start: goal.start_value === null ? "" : String(goal.start_value),
          unit: goal.metric === "custom" ? (goal.unit ?? "") : "",
          startDate: goal.start_date,
          targetDate: goal.target_date ?? "",
          exercise: goal.exercise_id && goal.exercise_name ? { id: goal.exercise_id, name: goal.exercise_name } : null,
          distanceKm: goal.config.distance_km ? String(goal.config.distance_km) : "",
        }}
      />
    </section>
  );
}
