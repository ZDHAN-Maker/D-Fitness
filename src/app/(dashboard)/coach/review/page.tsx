import type { Metadata } from "next";
import Link from "next/link";
import { ReviewPanel } from "@/components/ai/review-panel";
import { requireUser } from "@/lib/auth/session";
import { tryGetAiConfig } from "@/lib/ai/config";
import { isEmptyWeek, weekBounds } from "@/lib/ai/review";
import { computeWeekMetrics, getReview, listReviews, resolveWeek } from "@/features/ai/review";
import { getProfileAndSettings } from "@/features/profile/queries";
import { todayInTimeZone } from "@/utils/date";
import { formatLongDate } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "AI weekly review" };
const short = (iso: string) => formatLongDate(iso).replace(/^\w+, /, "");

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  if (!profile || !settings) return <p role="status">Your profile is still being created. Refresh in a few seconds.</p>;
  const today = todayInTimeZone(profile.timezone);
  const sp = await searchParams;
  const thisWeek = weekBounds(today, settings.week_starts_on, "current").start;
  const lastWeek = weekBounds(today, settings.week_starts_on, "last").start;

  // An explicit ?week= snaps to that week; a future or invalid value falls back to last week.
  const start = await resolveWeek(user.id, sp.week ? { weekStart: sp.week } : { which: "last" }).then((r) => r.start).catch(() => lastWeek);
  const [metrics, review, history] = await Promise.all([computeWeekMetrics(start, today, settings), getReview(start), listReviews(12)]);

  const tab = (href: string, label: string, active: boolean) => <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center rounded-md px-3 text-sm font-medium", active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</Link></li>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex w-fit gap-1 rounded-lg bg-muted p-1" aria-label="Choose a week">
        {tab(`/coach/review?week=${lastWeek}`, "Last week", start === lastWeek)}
        {tab(`/coach/review?week=${thisWeek}`, "This week so far", start === thisWeek)}
      </ul>
      <ReviewPanel key={start} weekStart={start} metrics={metrics} initial={review} empty={isEmptyWeek(metrics)} disabled={!tryGetAiConfig().configured} />
      {history.length ? (
        <section aria-label="Saved reviews" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Saved reviews</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {history.map((h) => <li key={h.weekStart}><Link href={`/coach/review?week=${h.weekStart}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent/50"><span className="font-medium">{short(h.weekStart)} – {short(h.weekEnd)}</span><span className="text-xs text-muted-foreground">saved {new Date(h.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></Link></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
