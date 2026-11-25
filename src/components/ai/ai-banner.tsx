import { Info, Zap } from "lucide-react";
import { AiStatusCheck } from "@/components/ai/ai-status";

type Props = { configured: boolean; missing: string[]; hasKey: boolean; usage: { total: number; vision: number } | null; limits: { daily: number; vision: number } };

export function AiBanner({ configured, hasKey, usage, limits }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
        <div className="flex items-center gap-3">
          <Zap className="size-5 text-primary shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Smart Algorithmic Engine Aktif</p>
            <p className="text-xs text-muted-foreground">Generator latihan dan rekomendasi nutrisi berjalan instan &amp; bebas biaya API.</p>
          </div>
        </div>
      </div>
      {configured && usage ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <AiStatusCheck canCheck={hasKey} />
          <p className="tabular text-xs text-muted-foreground">Today: {usage.total} / {limits.daily} requests · {usage.vision} / {limits.vision} food scans</p>
        </div>
      ) : null}
    </div>
  );
}

export function AiDisclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>The AI coach is a fitness assistant, not a doctor or dietitian. It can be wrong, so double-check anything important, especially around allergies, injuries, pain or medical conditions. For those, talk to a qualified professional.</span>
    </p>
  );
}
