import Link from "next/link";
import { Moon, Scale, HeartPulse } from "lucide-react";
import { formatSigned, type RecoveryScore } from "@/lib/calculations/body";
import { formatDuration } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { SleepSummary, WeightSummary } from "@/features/dashboard/get-daily-dashboard";

const BAND = { high: "text-fiber", moderate: "text-carbs", low: "text-fat" } as const;

function Tile({ href, icon: Icon, label, children }: { href: string; icon: typeof Scale; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" /> {label}
      </span>
      {children}
    </Link>
  );
}

export function BodyToday({ weight, sleep, recovery }: { weight: WeightSummary | null; sleep: SleepSummary | null; recovery: Pick<RecoveryScore, "score" | "band"> | null }) {
  const empty = <span className="text-sm text-muted-foreground">Not logged</span>;
  return (
    <section aria-label="Body and recovery" className="grid gap-3 sm:grid-cols-3">
      <Tile href="/body/weight" icon={Scale} label="Weight">
        {weight ? (
          <>
            <span className="tabular font-display text-2xl font-bold leading-none">{weight.latestKg} <span className="text-sm font-medium text-muted-foreground">kg</span></span>
            <span className="tabular text-xs text-muted-foreground">{weight.change !== null && weight.changeDays ? `${formatSigned(weight.change)} kg in ${weight.changeDays} days` : `logged ${weight.date}`}</span>
          </>
        ) : empty}
      </Tile>
      <Tile href="/recovery" icon={Moon} label="Sleep">
        {sleep ? (
          <>
            <span className="tabular font-display text-2xl font-bold leading-none">{formatDuration(sleep.minutes)}</span>
            <span className="tabular text-xs text-muted-foreground">target {formatDuration(sleep.targetMinutes)}</span>
          </>
        ) : empty}
      </Tile>
      <Tile href="/recovery" icon={HeartPulse} label="Recovery">
        {recovery ? (
          <>
            <span className="tabular font-display text-2xl font-bold leading-none">{recovery.score}<span className="text-sm font-medium text-muted-foreground"> / 100</span></span>
            <span className={cn("text-xs font-medium", BAND[recovery.band])}>{recovery.band === "high" ? "Well recovered" : recovery.band === "moderate" ? "Moderate" : "Low: go easy"}</span>
          </>
        ) : empty}
      </Tile>
    </section>
  );
}
