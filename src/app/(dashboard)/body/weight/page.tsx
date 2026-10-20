import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listWeights, rangeStart } from "@/features/body/service";
import { deleteWeightAction } from "@/features/body/actions";
import { WeightForm } from "@/components/body/weight-form";
import { RangeTabs } from "@/components/body/range-tabs";
import { TrendChart } from "@/components/charts/lazy-charts";
import { DeleteButton } from "@/components/ui/delete-button";
import { calculateMovingAverage, calculateTrend, calculateWeeklyRate, formatSigned } from "@/lib/calculations/body";
import { rangeSchema } from "@/lib/validations/body";
import { formatLongDate, todayInTimeZone } from "@/utils/date";

export const metadata: Metadata = { title: "Weight" };

const short = (iso: string) => formatLongDate(iso).replace(/^\w+, /, "");

export default async function WeightPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const range = rangeSchema.safeParse({ range: (await searchParams).range }).data?.range ?? "90d";
  const entries = await listWeights(rangeStart(today, range));

  const series = entries.map((e) => ({ date: e.date, value: e.weightKg }));
  const avg = calculateMovingAverage(series, 7);
  const trend = calculateTrend(series);
  const weekly = calculateWeeklyRate(series);
  const latest = entries.at(-1);
  const chart = entries.map((e, i) => ({ date: e.date, weight: e.weightKg, average: avg[i]!.value }));

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg bg-muted p-3 text-center">
      <dd className="tabular text-lg font-semibold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {sub ? <p className="tabular text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <WeightForm today={today} lastWeightKg={latest?.weightKg ?? null} />

      <RangeTabs basePath="/body/weight" active={range} />

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No weight logged in this period. Add today&apos;s weight above to start your trend line.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat("Latest", `${latest!.weightKg} kg`, short(latest!.date))}
            {stat("Change", trend ? `${formatSigned(trend.change)} kg` : "–", trend ? `over ${trend.days} days` : "need 2 entries")}
            {stat("7-entry average", `${avg.at(-1)!.value} kg`)}
            {stat("Weekly rate", weekly === null ? "–" : `${formatSigned(weekly, 2)} kg`, weekly === null ? "needs 3+ days" : "per week")}
          </dl>
          <div className="rounded-lg border bg-card p-3">
            <TrendChart
              data={chart}
              xKey="date"
              xFormat={short}
              unit="kg"
              ariaLabel={`Weight over time, latest ${latest!.weightKg} kilograms`}
              yDomain={["dataMin", "dataMax"]}
              lines={[
                { key: "weight", label: "Weight", color: "hsl(var(--muted-foreground))" },
                { key: "average", label: "7-entry average", color: "hsl(var(--primary))" },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">Day-to-day weight moves with water, food and sleep. Watch the trend line, not a single reading.</p>

          <section aria-labelledby="entries-h" className="flex flex-col gap-2">
            <h2 id="entries-h" className="text-lg font-semibold">Entries</h2>
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {[...entries].reverse().slice(0, 20).map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
                  <div className="min-w-0 flex-1">
                    <p className="tabular font-medium">{e.weightKg} kg</p>
                    <p className="truncate text-xs text-muted-foreground">{short(e.date)}{e.note ? ` · ${e.note}` : ""}</p>
                  </div>
                  <DeleteButton label={`weight from ${e.date}`} action={deleteWeightAction.bind(null, e.id)} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
