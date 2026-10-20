import { formatDecimal } from "@/utils/format";

type M = { protein_g: number; carbs_g: number; fat_g: number };

/** "P 12 · C 30 · F 5" with the fixed metric colours. */
export function MacroLine({ m, className }: { m: M; className?: string }) {
  return (
    <span className={"tabular text-xs text-muted-foreground " + (className ?? "")}>
      <span className="text-protein">P</span> {formatDecimal(m.protein_g)} · <span className="text-carbs">C</span> {formatDecimal(m.carbs_g)} ·{" "}
      <span className="text-fat">F</span> {formatDecimal(m.fat_g)} g
    </span>
  );
}
