import { ProgressBar } from "@/components/ui/progress-bar";

export function StatGrid({ stats }: { stats: { label: string; value: string; sub?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-muted p-3 text-center">
          <dd className="tabular text-lg font-semibold">{s.value}</dd>
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          {s.sub ? <p className="tabular text-[11px] text-muted-foreground">{s.sub}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border bg-card p-4">
      <h2 className="mb-1 font-display text-base font-semibold">{title}</h2>
      {note ? <p className="mb-2 text-xs text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Horizontal bars with a label and value, e.g. sets per muscle or most-eaten foods. */
export function HBarList({ rows, colorClass = "bg-primary" }: { rows: { label: string; value: number; display: string; href?: string }[]; colorClass?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm">{r.label}</span>
          <ProgressBar value={r.value} max={max} colorClass={colorClass} label={r.label} />
          <span className="tabular w-16 text-right text-sm text-muted-foreground">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** Share of calories from protein / carbs / fat as one stacked bar plus a legend (text, not colour alone). */
export function MacroSplit({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    { label: "Protein", pct: protein, cls: "bg-protein" },
    { label: "Carbs", pct: carbs, cls: "bg-carbs" },
    { label: "Fat", pct: fat, cls: "bg-fat" },
  ];
  return (
    <div>
      <div role="img" aria-label={`Calories from protein ${protein}%, carbs ${carbs}%, fat ${fat}%`} className="flex h-4 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => <div key={p.label} className={p.cls} style={{ width: `${p.pct}%` }} />)}
      </div>
      <ul className="tabular mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${p.cls}`} aria-hidden="true" />{p.label} <strong>{p.pct}%</strong></li>)}
      </ul>
    </div>
  );
}
