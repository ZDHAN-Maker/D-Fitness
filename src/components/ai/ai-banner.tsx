import { AlertTriangle, Info } from "lucide-react";
import { AiStatusCheck } from "@/components/ai/ai-status";

type Props = { configured: boolean; missing: string[]; hasKey: boolean; usage: { total: number; vision: number } | null; limits: { daily: number; vision: number } };

export function AiBanner({ configured, missing, hasKey, usage, limits }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {!configured ? (
        <div role="status" className="rounded-lg border border-carbs/50 bg-carbs/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-carbs" aria-hidden="true" /> AI is not switched on yet</p>
          <p className="mt-1 text-muted-foreground">The server still needs: <strong className="text-foreground">{missing.join(", ")}</strong>.</p>
          <p className="mt-2 text-muted-foreground">Add them as environment variables (Vercel → Project → Settings → Environment Variables, or <code>.env.local</code> when running locally), then redeploy. The service-role key is required so daily usage limits cannot be bypassed. Keep these values private: never paste them into code, chat or screenshots.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AiStatusCheck canCheck={hasKey} />
        {usage ? <p className="tabular text-xs text-muted-foreground">Today: {usage.total} / {limits.daily} requests · {usage.vision} / {limits.vision} food scans</p> : null}
      </div>
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
