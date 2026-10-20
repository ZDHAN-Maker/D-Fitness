import { formatClock } from "@/lib/calculations/workout";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Human text for a goal value: run times as mm:ss, everything else as "value unit". */
export function formatGoalValue(metric: string, value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) return "–";
  if (metric === "run_time_min") return formatClock(Math.round(value * 60));
  const u = unit ? ` ${unit}` : "";
  return `${r2(value)}${u}`;
}
