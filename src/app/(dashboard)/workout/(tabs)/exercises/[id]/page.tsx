import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExercise } from "@/features/workout/exercises";
import { RECORD_LABEL, getExerciseHistory, listRecords } from "@/features/workout/records";
import { calculateEstimatedOneRepMax, formatSetShort, topWorkingSet } from "@/lib/calculations/workout";

export const metadata: Metadata = { title: "Exercise" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.coerce.number().int().positive().safeParse((await params).id);
  if (!id.success) notFound();
  const [exercise, history, records] = await Promise.all([getExercise(id.data), getExerciseHistory(id.data, 6), listRecords()]);
  if (!exercise) notFound();
  const mine = records.filter((r) => r.subject.kind === "exercise" && r.subject.id === exercise.id);

  return (
    <article className="flex flex-col gap-5">
      <Link href="/workout/exercises" className="flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Library
      </Link>
      <header>
        <h2 className="text-3xl font-bold">{exercise.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {exercise.primary_muscle ? <Badge>{cap(exercise.primary_muscle)}</Badge> : null}
          {exercise.equipment ? <Badge variant="muted">{cap(exercise.equipment)}</Badge> : null}
          {exercise.difficulty ? <Badge variant="muted">{cap(exercise.difficulty)}</Badge> : null}
          {exercise.movement_type ? <Badge variant="outline">{cap(exercise.movement_type)}</Badge> : null}
        </div>
        {exercise.secondary_muscles.length ? <p className="mt-2 text-sm text-muted-foreground">Also works: {exercise.secondary_muscles.map(cap).join(", ")}</p> : null}
      </header>

      {exercise.image_url ? (
        // External dataset URL: a plain <img> avoids whitelisting unknown hosts in next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.image_url} alt={`${exercise.name} demonstration`} loading="lazy" className="max-h-72 w-full rounded-lg border object-contain" />
      ) : null}

      <Card>
        <CardHeader><CardTitle>How to</CardTitle></CardHeader>
        <CardContent>
          {exercise.instructions ? <p className="whitespace-pre-line text-sm leading-relaxed">{exercise.instructions}</p> : <p className="text-sm text-muted-foreground">No instructions in the dataset for this exercise yet.</p>}
          {exercise.video_url ? <a href={exercise.video_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Watch video</a> : null}
        </CardContent>
      </Card>

      {mine.length ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-carbs" aria-hidden="true" /> Your records</CardTitle></CardHeader>
          <CardContent>
            <dl className="tabular grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {mine.map((r) => (
                <div key={r.record_type}>
                  <dd className="text-lg font-semibold">{r.value} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></dd>
                  <dt className="text-xs text-muted-foreground">{RECORD_LABEL[r.record_type] ?? r.record_type}</dt>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have not logged this exercise yet.</p>
          ) : (
            <ul className="divide-y">
              {history.map((h) => {
                const top = topWorkingSet(h.sets.map((s) => ({ ...s, is_completed: true })));
                const e1rm = top ? calculateEstimatedOneRepMax(top.weight_kg, top.reps) : null;
                return (
                  <li key={h.session_id} className="py-2">
                    <Link href={`/workout/session/${h.session_id}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm hover:underline">
                      <span className="tabular text-muted-foreground">{h.date}</span>
                      <span className="tabular">{h.sets.filter((s) => !s.is_warmup).map(formatSetShort).join(" · ")}</span>
                      {e1rm ? <span className="tabular text-xs text-muted-foreground">e1RM {e1rm}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </article>
  );
}
