"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postAi } from "@/components/ai/ai-client";
import { formatWeekMetrics, type WeekMetrics } from "@/lib/ai/review";
import type { WeeklyReview } from "@/features/ai/review";
import { formatLongDate } from "@/utils/date";

const short = (iso: string) => formatLongDate(iso).replace(/^\w+, /, "");

function Section({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={title} className="rounded-lg border bg-card p-4">
      <h3 className={`font-display text-base font-semibold ${tone ?? ""}`}>{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </section>
  );
}

/** Facts (computed from your data) are shown first and kept visually separate from the AI's written review. */
export function ReviewPanel({ weekStart, metrics, initial, empty, disabled }: { weekStart: string; metrics: WeekMetrics; initial: WeeklyReview | null; empty: boolean; disabled: boolean }) {
  const [review, setReview] = useState<WeeklyReview | null>(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const shown = review?.metrics ?? metrics;

  const generate = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await postAi<WeeklyReview>("/api/ai/weekly-review", { weekStart });
      if (!res.ok) return setError(res.error);
      setReview(res.data);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">{short(weekStart)} – {short(shown.weekEnd)}</h2>
        {shown.daysCovered < 7 ? <p className="text-xs text-muted-foreground">Week in progress: {shown.daysCovered} of 7 days</p> : null}
      </header>

      <section aria-label="Your numbers" className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your numbers (from your logs)</p>
        {empty ? (
          <p className="text-sm text-muted-foreground">Nothing logged in this week yet.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {formatWeekMetrics(shown).map((r) => (
              <div key={r.label}><dt className="text-xs text-muted-foreground">{r.label}</dt><dd className="tabular text-lg font-semibold">{r.value}</dd></div>
            ))}
          </dl>
        )}
      </section>

      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {review ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI review · {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          <Section title="What went well" items={review.wentWell} tone="text-fiber" />
          <Section title="What needs improvement" items={review.needsImprovement} tone="text-carbs" />
          <Section title="Recommendations for next week" items={review.recommendations} />
          {review.missing.length ? (
            <section aria-label="Data not available" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <p className="text-xs font-semibold uppercase tracking-wide">Data not available</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{review.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </section>
          ) : null}
        </>
      ) : null}

      <Button type="button" onClick={generate} disabled={disabled || pending || empty} className="w-fit">
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {review ? "Regenerate review" : "Generate review"}
      </Button>
    </div>
  );
}
