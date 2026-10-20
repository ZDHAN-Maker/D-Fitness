import { formatDecimal, formatInt } from "@/utils/format";
import type { MacroNutrients } from "@/types/domain";

export function TotalsCard({ title, n, note }: { title: string; n: MacroNutrients; note?: string }) {
  return (
    <div className="rounded-lg bg-muted p-4" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="tabular font-display text-3xl font-bold leading-none">
        {formatInt(n.calories)} <span className="text-base font-medium text-muted-foreground">kcal</span>
      </p>
      <dl className="tabular mt-3 grid grid-cols-4 gap-2 text-center text-sm">
        {[
          ["Protein", n.protein_g, "text-protein"],
          ["Carbs", n.carbs_g, "text-carbs"],
          ["Fat", n.fat_g, "text-fat"],
          ["Fibre", n.fiber_g, "text-fiber"],
        ].map(([label, v, cls]) => (
          <div key={label as string}>
            <dd className={`font-semibold ${cls}`}>{formatDecimal(v as number)} g</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
