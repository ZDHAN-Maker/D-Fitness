"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2, Plus, Timer, Trophy } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ExerciseBrowser } from "@/components/workout/exercise-browser";
import { RestTimer } from "@/components/workout/rest-timer";
import { SessionExerciseCard } from "@/components/workout/session-exercise-card";
import type { SetValues } from "@/components/workout/set-row";
import { addExerciseAction, addSetAction, cancelWorkoutAction, completeWorkoutAction, deleteSetAction, previousPerformanceAction, saveSetAction } from "@/features/workout/actions";
import type { CompletionResult } from "@/features/workout/sessions";
import type { ExerciseFacets } from "@/features/workout/exercises";
import type { PreviousPerformance, SessionExerciseView, SessionView, SetView } from "@/features/workout/types";
import { calculateWorkoutVolume, formatClock } from "@/lib/calculations/workout";
import { formatInt } from "@/utils/format";

const DEFAULT_REST = 90;

type Props = { session: SessionView; previous: Record<number, PreviousPerformance>; facets: ExerciseFacets; categories: { id: number; name: string }[] };

function useElapsed(startedAt: string) {
  const start = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - start) / 1000));
}

function WorkoutClock({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <span className="flex items-center gap-1">
      <Timer className="size-3.5" aria-hidden="true" /> {formatClock(elapsed)}
    </span>
  );
}

export function ActiveWorkout({ session, previous: initialPrevious, facets, categories }: Props) {
  const router = useRouter();
  const [exercises, setExercises] = useState<SessionExerciseView[]>(session.exercises);
  const [previous, setPrevious] = useState(initialPrevious);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [globalError, setGlobalError] = useState<string>();

  const allSets = exercises.flatMap((e) => e.sets);
  const doneCount = allSets.filter((s) => s.is_completed).length;
  const volume = calculateWorkoutVolume(allSets);

  const replaceSet = useCallback((setId: string, next: SetView) => setExercises((list) => list.map((e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? next : s)) }))), []);
  const mapLocal = (setId: string, patch: Partial<SetView>) => setExercises((list) => list.map((e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })));

  const toColumns = (p: SetValues): Partial<SetView> => ({
    ...(p.weightKg !== undefined ? { weight_kg: p.weightKg } : {}),
    ...(p.reps !== undefined ? { reps: p.reps } : {}),
    ...(p.durationSec !== undefined ? { duration_sec: p.durationSec } : {}),
    ...(p.distanceM !== undefined ? { distance_m: p.distanceM } : {}),
    ...(p.rpe !== undefined ? { rpe: p.rpe } : {}),
    ...(p.isWarmup !== undefined ? { is_warmup: p.isWarmup } : {}),
  });

  /** Optimistic: the UI updates instantly; the server's answer replaces it, or the change is rolled back. */
  async function persist(exId: string, setId: string, patch: SetValues & { isCompleted?: boolean }): Promise<boolean> {
    const before = exercises.find((e) => e.id === exId)?.sets.find((s) => s.id === setId);
    if (!before) return false;
    mapLocal(setId, { ...toColumns(patch), ...(patch.isCompleted !== undefined ? { is_completed: patch.isCompleted } : {}) });
    const res = await saveSetAction({ setId, ...patch });
    if (!res.ok) {
      replaceSet(setId, before);
      setErrors((e) => ({ ...e, [setId]: res.error }));
      return false;
    }
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([id]) => id !== setId)));
    replaceSet(setId, res.data);
    return true;
  }

  const onToggle = async (ex: SessionExerciseView, setId: string, values: SetValues) => {
    const set = ex.sets.find((s) => s.id === setId);
    if (!set) return;
    const completing = !set.is_completed;
    const ok = await persist(ex.id, setId, { ...values, isCompleted: completing });
    if (ok && completing) {
      const seconds = ex.target?.restSeconds ?? DEFAULT_REST;
      if (seconds > 0) setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
    }
  };

  const onAddSet = async (exId: string) => {
    const res = await addSetAction(exId);
    if (!res.ok) return setGlobalError(res.error);
    setExercises((l) => l.map((e) => (e.id === exId ? { ...e, sets: [...e.sets, res.data] } : e)));
  };

  const onDeleteSet = async (exId: string, setId: string) => {
    const res = await deleteSetAction(setId);
    if (!res.ok) return setGlobalError(res.error);
    setExercises((l) => l.map((e) => (e.id === exId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e)));
  };

  const onUseSuggestion = async (ex: SessionExerciseView, weightKg: number, reps: number) => {
    for (const s of ex.sets.filter((x) => !x.is_completed && x.weight_kg === null && x.reps === null)) {
      await persist(ex.id, s.id, { weightKg, reps });
    }
  };

  const addExercise = async (exerciseId: number) => {
    setAdding(false);
    const res = await addExerciseAction({ sessionId: session.id, exerciseId });
    if (!res.ok) return setGlobalError(res.error);
    setExercises((l) => [...l, res.data]);
    const prev = await previousPerformanceAction(exerciseId);
    if (prev.ok && prev.data) setPrevious((p) => ({ ...p, [exerciseId]: prev.data! }));
  };

  const handleCloseFinish = useCallback(() => {
    setFinishing(false);
    if (result) {
      router.push(`/workout/session/${session.id}`);
      router.refresh();
    }
  }, [result, router, session.id]);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:static md:top-auto md:mx-0 md:rounded-lg md:border md:bg-card">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold">{session.name}</h1>
          <p className="tabular flex items-center gap-3 text-xs text-muted-foreground">
            <WorkoutClock startedAt={session.started_at} />
            <span>{doneCount} sets</span>
            <span>{formatInt(volume)} kg volume</span>
          </p>
        </div>
        <Button onClick={() => setFinishing(true)}>Finish</Button>
      </header>

      {globalError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {globalError}
        </p>
      ) : null}

      {exercises.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Dumbbell className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-medium">Empty workout</p>
          <p className="text-sm text-muted-foreground">Add the first exercise to begin.</p>
        </div>
      ) : null}

      {exercises.map((ex) => (
        <SessionExerciseCard
          key={ex.id}
          ex={ex}
          previous={previous[ex.exercise.id]}
          errors={errors}
          onSave={(setId, patch) => void persist(ex.id, setId, patch)}
          onToggle={(setId, values) => void onToggle(ex, setId, values)}
          onAddSet={() => void onAddSet(ex.id)}
          onDeleteSet={(setId) => void onDeleteSet(ex.id, setId)}
          onRemoved={() => setExercises((l) => l.filter((e) => e.id !== ex.id))}
          onUseSuggestion={(w, r) => void onUseSuggestion(ex, w, r)}
        />
      ))}

      <Button variant="outline" onClick={() => setAdding(true)}>
        <Plus /> Add exercise
      </Button>

      <div className="flex justify-center">
        <DeleteButton label="workout" verb="Discard" action={() => cancelWorkoutAction(session.id)} onDone={() => { router.push("/workout"); router.refresh(); }} />
      </div>

      {rest ? <RestTimer endsAt={rest.endsAt} totalSeconds={rest.total} onAdjust={(d) => setRest((r) => (r ? { endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) } : r))} onDismiss={() => setRest(null)} /> : null}

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="Add exercise" wide>
        <ExerciseBrowser facets={facets} categories={categories} onSelect={(e) => void addExercise(e.id)} />
      </BottomSheet>

      <FinishSheet
        open={finishing}
        onClose={handleCloseFinish}
        sessionId={session.id}
        doneCount={doneCount}
        volume={volume}
        result={result}
        onDone={setResult}
      />
    </div>
  );
}

function FinishSheet({ open, onClose, sessionId, doneCount, volume, result, onDone }: { open: boolean; onClose: () => void; sessionId: string; doneCount: number; volume: number; result: CompletionResult | null; onDone: (r: CompletionResult) => void }) {
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const finish = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await completeWorkoutAction({ sessionId, effort: effort === "" ? undefined : Number(effort), notes });
      if (!res.ok) return setError(res.error);
      onDone(res.data);
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={result ? "Workout complete" : "Finish workout?"}>
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent p-4 text-accent-foreground">
            <Trophy className="size-8 shrink-0" aria-hidden="true" />
            <div>
              <p className="tabular text-2xl font-bold">{formatInt(result.total_volume_kg)} kg</p>
              <p className="text-sm">total volume{result.new_prs > 0 ? ` · ${result.new_prs} new record${result.new_prs > 1 ? "s" : ""}` : ""}</p>
            </div>
          </div>
          {result.achievements.length ? (
            <div>
              <p className="text-sm font-medium">Achievements unlocked</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{result.achievements.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          ) : null}
          <Button onClick={onClose}>View summary</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="tabular text-sm text-muted-foreground">
            {doneCount} finished set{doneCount === 1 ? "" : "s"} · {formatInt(volume)} kg. Sets you did not finish are dropped.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="effort">How hard was it? (optional)</Label>
            <Select id="effort" value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="">Skip</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} / 10{n <= 3 ? " · easy" : n >= 8 ? " · very hard" : ""}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wk-notes">Notes (optional)</Label>
            <textarea id="wk-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-card px-3 py-2 text-base md:text-sm" />
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button onClick={finish} disabled={pending || doneCount === 0}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {doneCount === 0 ? "Complete a set first" : "Finish workout"}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
