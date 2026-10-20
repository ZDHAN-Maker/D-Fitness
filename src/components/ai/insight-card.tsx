"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postAi } from "@/components/ai/ai-client";
import type { Insight } from "@/features/ai/coach";

/** Today's AI insight on the dashboard. One short note per day; generating costs one AI request. */
export function InsightCard({ initial, configured }: { initial: Insight | null; configured: boolean }) {
  const [insight, setInsight] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await postAi<Insight>("/api/ai/coach", { insight: true });
      if (!res.ok) return setError(res.error);
      setInsight(res.data);
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden="true" /> AI insight</CardTitle>
        <Link href="/coach" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Ask the coach</Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {insight ? (
          <>
            <p className="text-sm">{insight.text}</p>
            {insight.recommendations.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{insight.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
            {insight.missing.length ? <p className="text-xs text-muted-foreground">Not available: {insight.missing.join("; ")}</p> : null}
            {insight.factsSummary.length ? (
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Your data used</summary><ul className="mt-1 list-disc space-y-0.5 pl-5">{insight.factsSummary.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{configured ? "Get one short, specific observation from your last two weeks of data." : "AI is not switched on yet. Open the AI Coach page to see what is missing."}</p>
        )}
        {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={pending || !configured} onClick={generate}>
          {pending ? <Loader2 className="animate-spin" /> : insight ? <RefreshCw /> : <Sparkles />} {insight ? "Refresh" : "Get today's insight"}
        </Button>
      </CardContent>
    </Card>
  );
}
