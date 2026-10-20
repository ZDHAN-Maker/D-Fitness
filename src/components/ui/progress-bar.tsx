import { cn } from "@/lib/utils";

type Props = {
  value: number;
  max: number;
  /** Tailwind background class for the fill, e.g. "bg-protein". */
  colorClass?: string;
  label: string;
  className?: string;
};

/** Accessible, server-renderable progress bar. Overshoot is clamped visually but exposed to AT. */
export function ProgressBar({ value, max, colorClass = "bg-primary", label, className }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
