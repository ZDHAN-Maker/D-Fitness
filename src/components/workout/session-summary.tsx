import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calculateEstimatedOneRepMax, calculateWorkoutVolume, formatClock, formatSetShort, topWorkingSet } from "@/lib/calculations/workout";
import { RECORD_LABEL } from "@/features/workout/records";
import type { SessionView } from "@/features/workout/types";
import { formatInt } from "@/utils/format";

type PR = { exercise_id: number; record_type: string; value: number; unit: string };

/** Read-only view of a finished workout, with the records it set. */
export function SessionSummary({ session, prs }: { session: SessionView; prs: PR[] }) {
  const sets = session.exercises.flatMap((e) => e.sets);
  const volume = session.total_volume_kg ?? calculateWorkoutVolume(sets);
  const seconds = session.ended_at ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000) : null;
  const stat = (label: string, value: string) => (
    <div className="rounded-lg bg-muted p-3 text-center">
      <dd className="tabular text-lg font-semibold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Duration", seconds ? formatClock(seconds) : "–")}
        {stat("Volume", `${formatInt(volume)} kg`)}
        {stat("Exercises", String(session.exercises.length))}
        {stat("Effort", session.perceived_effort ? `${session.perceived_effort} / 10` : "–")}
      </dl>
      {session.notes ? <p className="rounded-lg border bg-card p-3 text-sm">{session.notes}</p> : null}

      <ol className="flex flex-col gap-3">
        {session.exercises.map((e) => {
          const working = e.sets.filter((s) => s.is_completed);
          const top = topWorkingSet(working);
          const e1rm = top ? calculateEstimatedOneRepMax(top.weight_kg, top.reps) : null;
          const myPrs = prs.filter((p) => p.exercise_id === e.exercise.id);
          return (
            <li key={e.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold">{e.exercise.name}</h3>
                {myPrs.length ? (
                  <Badge className="gap-1"><Trophy className="size-3" aria-hidden="true" /> {myPrs.map((p) => RECORD_LABEL[p.record_type] ?? p.record_type).join(", ")}</Badge>
                ) : null}
              </div>
              <ol className="tabular mt-2 flex flex-col gap-1 text-sm">
                {working.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="w-6 text-muted-foreground">{s.is_warmup ? "W" : i + 1}</span>
                    <span>{formatSetShort(s)}</span>
                    {s.rpe ? <span className="text-xs text-muted-foreground">RPE {s.rpe}</span> : null}
                  </li>
                ))}
              </ol>
              {e1rm ? <p className="tabular mt-2 text-xs text-muted-foreground">Estimated 1RM {e1rm} kg</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
