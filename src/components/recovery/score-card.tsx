import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RECOVERY_ADVICE, type RecoveryScore } from "@/lib/calculations/body";
import { cn } from "@/lib/utils";

const BAND = { high: { label: "Well recovered", cls: "text-fiber", bar: "bg-fiber" }, moderate: { label: "Moderate", cls: "text-carbs", bar: "bg-carbs" }, low: { label: "Low", cls: "text-fat", bar: "bg-fat" } } as const;

export function ScoreCard({ score }: { score: RecoveryScore | null }) {
  if (!score) {
    return (
      <Card>
        <CardHeader><CardTitle>Recovery score</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Log your sleep or answer a few questions below to get today&apos;s score.</p></CardContent>
      </Card>
    );
  }
  const b = BAND[score.band];
  return (
    <Card>
      <CardHeader><CardTitle>Recovery score</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <p className="tabular font-display text-6xl font-bold leading-none">{score.score}</p>
          <p className={cn("pb-1 text-lg font-semibold", b.cls)}>{b.label}</p>
        </div>
        <p className="text-sm">{RECOVERY_ADVICE[score.band]}</p>
        <dl className="grid gap-2">
          {score.components.map((c) => (
            <div key={c.key} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
              <dt className="text-sm">{c.label}</dt>
              <ProgressBar value={c.score} max={100} colorClass={b.bar} label={c.label} />
              <dd className="tabular text-right text-sm text-muted-foreground">{c.score}</dd>
            </div>
          ))}
        </dl>
        {score.coverage < 1 ? <p className="text-xs text-muted-foreground">Based on {score.components.length} of 6 inputs. Answer the rest for a fuller picture.</p> : null}
      </CardContent>
    </Card>
  );
}
