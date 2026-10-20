import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { ActiveWorkout } from "@/components/workout/active-workout";
import { SessionSummary } from "@/components/workout/session-summary";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getExerciseCategories, getFacets } from "@/features/workout/exercises";
import { getSessionPRs } from "@/features/workout/records";
import { getPreviousPerformance, getSessionView } from "@/features/workout/sessions";
import { formatLongDate } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workout" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const session = await getSessionView(id.data);
  if (!session) notFound();

  const back = (
    <Link href="/workout" className="flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> Workout
    </Link>
  );

  if (session.status === "in_progress") {
    const [previous, facets, categories] = await Promise.all([
      getPreviousPerformance(session.exercises.map((e) => e.exercise.id), session.id),
      getFacets(),
      getExerciseCategories(),
    ]);
    return (
      <div className="mx-auto max-w-2xl">
        <ActiveWorkout session={session} previous={previous} facets={facets} categories={categories} />
      </div>
    );
  }

  if (session.status === "cancelled") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
        <h1 className="text-2xl font-bold">Workout discarded</h1>
        <p className="text-sm text-muted-foreground">This workout was discarded and is not part of your history.</p>
        <Link href="/workout" className={cn(buttonVariants())}>Back to workouts</Link>
      </div>
    );
  }

  const prs = await getSessionPRs(session.id);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {back}
      <header>
        <h1 className="text-3xl font-bold">{session.name}</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(session.logged_on)}</p>
      </header>
      <SessionSummary session={session} prs={prs} />
    </div>
  );
}
