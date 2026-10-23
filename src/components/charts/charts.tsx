"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Datum = Record<string, string | number | null>;
type Series = { key: string; label: string; color: string; dashed?: boolean };

type Common = {
  data: Datum[];
  xKey: string;
  unit: string;
  ariaLabel: string;
  height?: number;
  /** Format an x value (ISO date) for axis ticks, e.g. "Oct 8". */
  xFormat?: (v: string) => string;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  reference?: { y: number; label: string };
};

const AXIS = { stroke: "hsl(var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false } as const;

function defaultDateFormat(v: unknown): string {
  if (typeof v !== "string") return String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
  try {
    const [y, m, d] = v.slice(0, 10).split("-").map(Number);
    const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(date);
  } catch {
    return v;
  }
}

function Frame({ data, xKey, series, unit, ariaLabel, children }: { data: Datum[]; xKey: string; series: Series[]; unit: string; ariaLabel: string; children: React.ReactNode }) {
  return (
    <figure role="img" aria-label={ariaLabel} className="m-0">
      {children}
      {/* The same numbers as a table, for screen readers (the SVG itself is not navigable). */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.key}>{`${s.label} (${unit})`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={String(d[xKey])}>
              <td>{String(d[xKey])}</td>
              {series.map((s) => (
                <td key={s.key}>{d[s.key] ?? "no data"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13, color: "hsl(var(--foreground))" };

export function TrendChart({ lines, data, xKey, unit, ariaLabel, height = 260, xFormat, yDomain, reference }: Common & { lines: Series[] }) {
  const formatTick = xFormat ?? defaultDateFormat;
  return (
    <Frame data={data} xKey={xKey} series={lines} unit={unit} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={formatTick} minTickGap={24} {...AXIS} />
          <YAxis domain={yDomain ?? ["auto", "auto"]} width={44} {...AXIS} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatTick(String(l))} formatter={(v, n) => [`${v} ${unit}`, n]} />
          {lines.length > 1 ? <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} /> : null}
          {reference ? <ReferenceLine y={reference.y} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: reference.label, fill: "hsl(var(--muted-foreground))", fontSize: 11, position: "insideTopRight" }} /> : null}
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={l.dashed ? 2 : 2.5} strokeDasharray={l.dashed ? "5 4" : undefined} dot={data.length <= 31 ? { r: 3 } : false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function BarsChart({ bars, data, xKey, unit, ariaLabel, height = 220, xFormat, yDomain, reference }: Common & { bars: Series[] }) {
  const formatTick = xFormat ?? defaultDateFormat;
  return (
    <Frame data={data} xKey={xKey} series={bars} unit={unit} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={formatTick} minTickGap={12} {...AXIS} />
          <YAxis domain={yDomain ?? [0, "auto"]} width={44} {...AXIS} />
          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} labelFormatter={(l) => formatTick(String(l))} formatter={(v, n) => [`${v} ${unit}`, n]} />
          {reference ? <ReferenceLine y={reference.y} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: reference.label, fill: "hsl(var(--muted-foreground))", fontSize: 11, position: "insideTopRight" }} /> : null}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
