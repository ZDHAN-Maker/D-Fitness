"use client";

import { useState } from "react";
import { Lightbulb, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { ExerciseVisual } from "@/components/workout/exercise-visual";
import { SetRow, type SetValues } from "@/components/workout/set-row";
import { formatSetShort, suggestProgression } from "@/lib/calculations/workout";
import { removeExerciseAction } from "@/features/workout/actions";
import type { PreviousPerformance, SessionExerciseView } from "@/features/workout/types";

type Props = {
  ex: SessionExerciseView;
  previous?: PreviousPerformance;
  errors: Record<string, string>;
  onSave: (setId: string, patch: SetValues) => void;
  onToggle: (setId: string, values: SetValues) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onRemoved: () => void;
  onUseSuggestion: (weightKg: number, reps: number) => void;
};

export function SessionExerciseCard({ ex, previous, errors, onSave, onToggle, onAddSet, onDeleteSet, onRemoved, onUseSuggestion }: Props) {
  const [details, setDetails] = useState(false);
  const mode = ex.exercise.tracking_mode;
  const prevWorking = previous?.sets.filter((s) => !s.is_warmup) ?? [];

  // Suggestions are offered, never applied automatically.
  const suggestion = mode === "weight_reps" && previous ? suggestProgression(previous.sets.map((s) => ({ ...s, is_completed: true })), { targetReps: ex.target?.repsMax }) : null;
  const canApply = suggestion && ex.sets.some((s) => !s.is_completed && s.weight_kg === null && s.reps === null);

  const target = ex.target;
  const targetText = [
    target?.repsMin && target?.repsMax ? `${target.repsMin}–${target.repsMax} reps` : target?.repsMax ? `${target.repsMax} reps` : null,
    target?.durationSec ? `${target.durationSec}s` : null,
    target?.weightKg ? `${target.weightKg} kg` : null,
    target?.restSeconds ? `rest ${target.restSeconds}s` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-label={ex.exercise.name} className="rounded-lg border bg-card p-3">
      <header className="flex items-center gap-2.5">
        <ExerciseVisual
          name={ex.exercise.name}
          primaryMuscle={ex.exercise.primary_muscle}
          equipment={ex.exercise.equipment}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold">{ex.exercise.name}</h2>
          <p className="text-xs text-muted-foreground">{[ex.exercise.primary_muscle, ex.exercise.equipment, targetText].filter(Boolean).join(" · ")}</p>
        </div>
        <Button type="button" variant={details ? "secondary" : "ghost"} size="icon" aria-pressed={details} aria-label="Show RPE, warm-up and remove-set options" onClick={() => setDetails((d) => !d)}>
          <SlidersHorizontal />
        </Button>
        <DeleteButton label={ex.exercise.name} verb="Remove" action={() => removeExerciseAction(ex.id)} onDone={onRemoved} />
      </header>

      {previous ? (
        <p className="tabular mt-2 text-xs text-muted-foreground">
          Last time ({previous.date}): {prevWorking.map(formatSetShort).join(" · ") || "warm-ups only"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">First time logging this exercise.</p>
      )}

      {suggestion ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
          <span className="tabular flex-1">
            Suggested: <strong>{suggestion.weightKg} kg × {suggestion.reps}</strong>
            <span className="text-xs opacity-80"> · {suggestion.reason === "add_weight" ? "you hit your reps last time" : "one more rep than last time"}</span>
          </span>
          {canApply ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onUseSuggestion(suggestion.weightKg, suggestion.reps)}>
              Use
            </Button>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-3 flex flex-col">
        {ex.sets.map((s, i) => (
          <SetRow
            key={s.id}
            index={i}
            set={s}
            mode={mode}
            prev={prevWorking[i]}
            showDetails={details}
            error={errors[s.id]}
            onSave={(patch) => onSave(s.id, patch)}
            onToggle={(values) => onToggle(s.id, values)}
            onDelete={() => onDeleteSet(s.id)}
          />
        ))}
      </ol>

      <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={onAddSet}>
        <Plus /> Add set
      </Button>
    </section>
  );
}
