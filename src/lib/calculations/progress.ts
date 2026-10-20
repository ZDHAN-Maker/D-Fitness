/**
 * Pure progress helpers. No I/O, no React: safe to unit test and reuse on server and client.
 */

/** Percentage 0..100 (clamped). A zero/invalid target yields 0 rather than NaN/Infinity. */
export function calculateProgressPct(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.max(0, (value / target) * 100));
}

/** Remaining amount to reach target (never negative). */
export function calculateRemaining(value: number, target: number): number {
  return Math.max(0, target - value);
}

export type WaterProgress = { currentMl: number; targetMl: number; remainingMl: number; pct: number };

export function calculateWaterProgress(currentMl: number, targetMl: number): WaterProgress {
  return {
    currentMl,
    targetMl,
    remainingMl: calculateRemaining(currentMl, targetMl),
    pct: calculateProgressPct(currentMl, targetMl),
  };
}

/**
 * Goal progress that works in both directions.
 * 80 -> 70 kg (decrease), now 75.4: (80 - 75.4) / (80 - 70) = 46%.
 */
export function calculateGoalProgress(
  start: number,
  current: number,
  target: number,
  direction: "increase" | "decrease" = target >= start ? "increase" : "decrease",
): number {
  const span = direction === "increase" ? target - start : start - target;
  if (!Number.isFinite(span) || span <= 0) return 0;
  const done = direction === "increase" ? current - start : start - current;
  return Math.min(100, Math.max(0, (done / span) * 100));
}
