"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ExerciseBrowser } from "@/components/workout/exercise-browser";
import { savePlanAction } from "@/features/workout/actions";
import type { ExerciseFacets } from "@/features/workout/exercises";
import type { ExerciseLite, PlanEdit } from "@/features/workout/types";
import { planSchema } from "@/lib/validations/workout";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Form state keeps numbers as strings so a field can be empty while typing. */
type Item = {
  uid: number;
  exercise: ExerciseLite;
  sets: string;
  repsMin: string;
  repsMax: string;
  duration: string;
  weight: string;
  rest: string;
  notes: string;
};

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
const isTimed = (m: string) => m === "duration" || m === "weight_duration";
const usesWeight = (m: string) => m === "weight_reps" || m === "weight_duration";
const usesReps = (m: string) => m === "weight_reps" || m === "reps_only";

let uidCounter = 0;
const nextUid = () => ++uidCounter;

function fromPlan(p: PlanEdit): Item[] {
  return p.exercises.map((e) => ({ uid: nextUid(), exercise: e.exercise, sets: s(e.targetSets), repsMin: s(e.targetRepsMin), repsMax: s(e.targetRepsMax), duration: s(e.targetDurationSec), weight: s(e.targetWeightKg), rest: s(e.restSeconds), notes: e.notes }));
}

const newItem = (e: ExerciseLite): Item => ({
  uid: nextUid(),
  exercise: e,
  sets: "3",
  repsMin: usesReps(e.tracking_mode) ? "8" : "",
  repsMax: usesReps(e.tracking_mode) ? "12" : "",
  duration: isTimed(e.tracking_mode) ? "45" : "",
  weight: "",
  rest: "90",
  notes: "",
});

type Props = { initial?: PlanEdit; facets: ExerciseFacets; categories: { id: number; name: string }[] };

export function PlanBuilder({ initial, facets, categories }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [days, setDays] = useState<number[]>(initial?.scheduledDays ?? []);
  const [items, setItems] = useState<Item[]>(initial ? fromPlan(initial) : []);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const patch = (uid: number, p: Partial<Item>) => setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...p } : i)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((list) => {
      const to = index + dir;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to]!, copy[index]!];
      return copy;
    });

  const submit = () => {
    setServerError(undefined);
    const payload = {
      id: initial?.id,
      name,
      description,
      scheduledDays: days,
      exercises: items.map((i) => ({
        exerciseId: i.exercise.id,
        targetSets: n(i.sets),
        targetRepsMin: n(i.repsMin),
        targetRepsMax: n(i.repsMax),
        targetDurationSec: n(i.duration),
        targetWeightKg: n(i.weight),
        restSeconds: n(i.rest),
        notes: i.notes,
      })),
    };
    const parsed = planSchema.safeParse(payload);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[issue.path.join(".")] ??= issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await savePlanAction(payload);
      if (!res.ok) return setServerError(res.error);
      router.push("/workout/plans");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {serverError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="plan-name" label="Workout name" error={errors.name} className="sm:col-span-2">
          <Input {...fieldAria("plan-name", errors.name)} placeholder="e.g. Push Day" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="plan-desc" label="Notes (optional)" error={errors.description} className="sm:col-span-2">
          <Input {...fieldAria("plan-desc", errors.description)} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Scheduled days (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])} className={cn("h-11 min-w-12 rounded-md border px-3 text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent")}>
                {d}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="plan-ex-h" className="flex flex-col gap-3">
        <h2 id="plan-ex-h" className="text-lg font-semibold">
          Exercises
        </h2>
        {errors.exercises ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.exercises}
          </p>
        ) : null}

        <ol className="flex flex-col gap-3">
          {items.map((it, idx) => {
            const mode = it.exercise.tracking_mode;
            const err = (f: string) => errors[`exercises.${idx}.${f}`];
            return (
              <li key={it.uid} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{idx + 1}</span>
                  <p className="min-w-0 flex-1 truncate font-medium">{it.exercise.name}</p>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Move ${it.exercise.name} up`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Move ${it.exercise.name} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${it.exercise.name}`} onClick={() => setItems((l) => l.filter((x) => x.uid !== it.uid))}>
                    <Trash2 />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field id={`sets-${it.uid}`} label="Sets" error={err("targetSets")}>
                    <Input {...fieldAria(`sets-${it.uid}`, err("targetSets"))} type="number" inputMode="numeric" min="1" value={it.sets} onChange={(e) => patch(it.uid, { sets: e.target.value })} />
                  </Field>
                  {usesReps(mode) ? (
                    <>
                      <Field id={`rmin-${it.uid}`} label="Reps min" error={err("targetRepsMin")}>
                        <Input {...fieldAria(`rmin-${it.uid}`, err("targetRepsMin"))} type="number" inputMode="numeric" min="1" value={it.repsMin} onChange={(e) => patch(it.uid, { repsMin: e.target.value })} />
                      </Field>
                      <Field id={`rmax-${it.uid}`} label="Reps max" error={err("targetRepsMax")}>
                        <Input {...fieldAria(`rmax-${it.uid}`, err("targetRepsMax"))} type="number" inputMode="numeric" min="1" value={it.repsMax} onChange={(e) => patch(it.uid, { repsMax: e.target.value })} />
                      </Field>
                    </>
                  ) : null}
                  {isTimed(mode) ? (
                    <Field id={`dur-${it.uid}`} label="Seconds" error={err("targetDurationSec")}>
                      <Input {...fieldAria(`dur-${it.uid}`, err("targetDurationSec"))} type="number" inputMode="numeric" min="1" value={it.duration} onChange={(e) => patch(it.uid, { duration: e.target.value })} />
                    </Field>
                  ) : null}
                  {usesWeight(mode) ? (
                    <Field id={`w-${it.uid}`} label="Weight (kg)" error={err("targetWeightKg")}>
                      <Input {...fieldAria(`w-${it.uid}`, err("targetWeightKg"))} type="number" inputMode="decimal" step="0.5" min="0" value={it.weight} onChange={(e) => patch(it.uid, { weight: e.target.value })} />
                    </Field>
                  ) : null}
                  <Field id={`rest-${it.uid}`} label="Rest (s)" error={err("restSeconds")}>
                    <Input {...fieldAria(`rest-${it.uid}`, err("restSeconds"))} type="number" inputMode="numeric" min="0" step="15" value={it.rest} onChange={(e) => patch(it.uid, { rest: e.target.value })} />
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>

        <Button type="button" variant="outline" onClick={() => setPicking(true)}>
          <Plus /> Add exercise
        </Button>
      </section>

      <div className="flex gap-3">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {initial ? "Save changes" : "Save workout"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/workout/plans")}>
          Cancel
        </Button>
      </div>

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Add exercise" wide>
        <ExerciseBrowser
          facets={facets}
          categories={categories}
          onSelect={(e) => {
            setItems((l) => [...l, newItem({ id: e.id, name: e.name, primary_muscle: e.primary_muscle, equipment: e.equipment, tracking_mode: e.tracking_mode })]);
            setPicking(false);
          }}
        />
      </BottomSheet>
    </div>
  );
}
