import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listWater, recentTotals } from "@/features/hydration/service";
import { deleteWaterAction } from "@/features/hydration/actions";
import { WaterQuickAdd } from "@/components/hydration/water-quick-add";
import { BarsChart } from "@/components/charts/lazy-charts";
import { DeleteButton } from "@/components/ui/delete-button";
import { formatLongDate, todayInTimeZone } from "@/utils/date";
import { formatWater } from "@/utils/format";

export const metadata: Metadata = { title: "Hydration" };

export default async function HydrationPage() {
  const user = await requireUser();
  const { profile, settings } = await getProfileAndSettings(user.id);
  const tz = profile?.timezone ?? "UTC";
  const today = todayInTimeZone(tz);
  const target = settings?.water_target_ml ?? 2500;
  const [logs, week] = await Promise.all([listWater(today), recentTotals(today, 7)]);
  const total = logs.reduce((a, l) => a + l.amountMl, 0);

  const daysHit = week.filter((d) => d.totalMl >= target).length;
  const daysWithData = week.filter((d) => d.totalMl > 0);
  const avg = daysWithData.length ? Math.round(daysWithData.reduce((a, d) => a + d.totalMl, 0) / daysWithData.length) : null;
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold md:text-4xl">Hydration</h1>
      <WaterQuickAdd date={today} totalMl={total} targetMl={target} />

      <section aria-labelledby="log-h" className="flex flex-col gap-2">
        <h2 id="log-h" className="text-lg font-semibold">Today&apos;s log</h2>
        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing logged yet today.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {[...logs].reverse().map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
                <span className="tabular w-14 text-sm text-muted-foreground">{time(l.at)}</span>
                <span className="tabular flex-1 font-medium">{l.amountMl} ml</span>
                <DeleteButton label={`${l.amountMl} ml entry`} action={deleteWaterAction.bind(null, l.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="week-h" className="flex flex-col gap-3">
        <h2 id="week-h" className="text-lg font-semibold">Last 7 days</h2>
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{avg ? formatWater(avg) : "–"}</dd><dt className="text-xs text-muted-foreground">Average on logged days</dt></div>
          <div className="rounded-lg bg-muted p-3 text-center"><dd className="tabular text-lg font-semibold">{daysHit} / 7</dd><dt className="text-xs text-muted-foreground">Days at target</dt></div>
        </dl>
        <div className="rounded-lg border bg-card p-3">
          <BarsChart data={week.map((d) => ({ date: d.date, ml: d.totalMl }))} xKey="date" unit="ml" ariaLabel="Water intake per day over the last 7 days" reference={{ y: target, label: `target ${formatWater(target)}` }} bars={[{ key: "ml", label: "Water", color: "hsl(var(--water))" }]} />
        </div>
      </section>
    </div>
  );
}
