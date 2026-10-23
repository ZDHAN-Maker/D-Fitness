import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getProfileAndSettings } from "@/features/profile/queries";
import { listMeasurements, rangeStart, type MeasurementEntry } from "@/features/body/service";
import { deleteMeasurementAction } from "@/features/body/actions";
import { MeasurementForm } from "@/components/body/measurement-form";
import { RangeTabs } from "@/components/body/range-tabs";
import { TrendChart } from "@/components/charts/lazy-charts";
import { DeleteButton } from "@/components/ui/delete-button";
import { calculateTrend, formatSigned } from "@/lib/calculations/body";
import { rangeSchema } from "@/lib/validations/body";
import { formatLongDate, todayInTimeZone } from "@/utils/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Measurements" };

const METRICS = [
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "armCm", label: "Arm", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
  { key: "hipCm", label: "Hip", unit: "cm" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const short = (iso: string) => formatLongDate(iso).replace(/^\w+, /, "");

export default async function MeasurementsPage({ searchParams }: { searchParams: Promise<{ range?: string; metric?: string }> }) {
  const user = await requireUser();
  const { profile } = await getProfileAndSettings(user.id);
  const today = todayInTimeZone(profile?.timezone ?? "UTC");
  const sp = await searchParams;
  const range = rangeSchema.safeParse({ range: sp.range }).data?.range ?? "180d";
  const metric = METRICS.find((m) => m.key === sp.metric) ?? METRICS[0];
  const entries = await listMeasurements(rangeStart(today, range));

  const pointsFor = (key: MetricKey) => entries.filter((e) => e[key] !== null).map((e) => ({ date: e.date, value: e[key] as number }));
  const series = pointsFor(metric.key);
  const trend = calculateTrend(series);
  const latestOf = (key: MetricKey) => pointsFor(key).at(-1);

  return (
    <div className="flex flex-col gap-5">
      <MeasurementForm today={today} />

      <section aria-label="Latest measurements" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {METRICS.map((m) => {
          const l = latestOf(m.key);
          return (
            <Link key={m.key} href={`/body/measurements?range=${range}&metric=${m.key}`} aria-current={m.key === metric.key ? "true" : undefined} className={cn("rounded-lg border p-2 text-center hover:bg-accent/50", m.key === metric.key ? "border-primary bg-accent" : "bg-card")}>
              <p className="tabular text-base font-semibold">{l ? l.value : "–"}<span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{l ? m.unit : ""}</span></p>
              <p className="text-[11px] text-muted-foreground">{m.label}</p>
            </Link>
          );
        })}
      </section>

      <RangeTabs basePath="/body/measurements" active={range} extra={`&metric=${metric.key}`} />

      {series.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No {metric.label.toLowerCase()} entries in this period.</p>
      ) : (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-1 flex flex-wrap items-baseline justify-between gap-2 px-1 text-sm">
            <span className="font-medium">{metric.label} ({metric.unit})</span>
            {trend ? <span className="tabular text-muted-foreground">{formatSigned(trend.change)} {metric.unit} over {trend.days} days</span> : <span className="text-muted-foreground">Add another entry to see a trend</span>}
          </p>
          <TrendChart data={series.map((p) => ({ date: p.date, value: p.value }))} xKey="date" unit={metric.unit} ariaLabel={`${metric.label} over time`} yDomain={["dataMin", "dataMax"]} lines={[{ key: "value", label: metric.label, color: "hsl(var(--primary))" }]} />
        </div>
      )}

      {entries.length > 0 ? (
        <section aria-labelledby="m-entries" className="flex flex-col gap-2">
          <h2 id="m-entries" className="text-lg font-semibold">Entries</h2>
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {[...entries].reverse().slice(0, 15).map((e: MeasurementEntry) => (
              <li key={e.id} className="flex items-center gap-2 py-2 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{short(e.date)}</p>
                  <p className="tabular text-xs text-muted-foreground">{METRICS.filter((m) => e[m.key] !== null).map((m) => `${m.label} ${e[m.key]}${m.unit}`).join(" · ")}</p>
                </div>
                <DeleteButton label={`measurements from ${e.date}`} action={deleteMeasurementAction.bind(null, e.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
