/**
 * Body, sleep and recovery calculations. Pure functions (no I/O, no React).
 * These are tracking aids, not medical measurements.
 */
import { round1, round2 } from "@/lib/calculations/nutrition";

export type DatedValue = { date: string; value: number };

/** Trailing moving average over the last `window` ENTRIES (not calendar days). Smooths day-to-day water-weight noise. */
export function calculateMovingAverage(series: DatedValue[], window = 7): DatedValue[] {
  const w = Math.max(1, Math.floor(window));
  return series.map((p, i) => {
    const slice = series.slice(Math.max(0, i - w + 1), i + 1);
    return { date: p.date, value: round2(slice.reduce((a, x) => a + x.value, 0) / slice.length) };
  });
}

export type Trend = { latest: number; first: number; change: number; changePct: number; direction: "up" | "down" | "flat"; days: number };

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);

/** Change from the first to the latest point of a (date-ascending) series. Null with fewer than 2 points. */
export function calculateTrend(series: DatedValue[], flatThreshold = 0.1): Trend | null {
  if (series.length < 2) return null;
  const first = series[0]!;
  const latest = series[series.length - 1]!;
  const change = round2(latest.value - first.value);
  return {
    latest: latest.value,
    first: first.value,
    change,
    changePct: first.value !== 0 ? round1((change / first.value) * 100) : 0,
    direction: Math.abs(change) < flatThreshold ? "flat" : change > 0 ? "up" : "down",
    days: daysBetween(first.date, latest.date),
  };
}

/** Average weekly change (kg/week) over the series; null when the span is under 3 days (too noisy to quote). */
export function calculateWeeklyRate(series: DatedValue[]): number | null {
  const t = calculateTrend(series);
  if (!t || t.days < 3) return null;
  return round2((t.change / t.days) * 7);
}

/** "+0.4" / "−0.7" / "0.0". Rounds half away from zero (toFixed alone turns 0.35 into "0.3") and never prints "+0.0". */
export function formatSigned(n: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
  return `${r === 0 ? "" : n > 0 ? "+" : "−"}${r.toFixed(digits)}`;
}

// ── Sleep ─────────────────────────────────────────────────────────────────────────

/** hours + minutes (as typed) -> total minutes, or null when out of range. */
export function toMinutes(hours: number | null | undefined, minutes: number | null | undefined): number | null {
  const h = hours ?? 0;
  const m = minutes ?? 0;
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) return null;
  const total = Math.round(h * 60 + m);
  return total > 0 && total <= 1440 ? total : null;
}

export const splitMinutes = (total: number) => ({ hours: Math.floor(total / 60), minutes: Math.round(total % 60) });

export function calculateSleepAverage(minutesList: number[]): number | null {
  return minutesList.length ? Math.round(minutesList.reduce((a, b) => a + b, 0) / minutesList.length) : null;
}

// ── Recovery score ─────────────────────────────────────────────────────────────────

export type RecoveryInputs = {
  sleepMinutes?: number | null;
  sleepTargetMinutes?: number | null;
  sleepQuality?: number | null; // 1 (poor) .. 5 (great)
  energy?: number | null; // 1 (drained) .. 5 (energised)
  stress?: number | null; // 1 (calm) .. 5 (very stressed)
  soreness?: number | null; // 1 (fresh) .. 5 (very sore)
  overall?: number | null; // 1 (bad) .. 5 (great)
};

export type RecoveryComponent = { key: string; label: string; score: number; weight: number };
export type RecoveryScore = { score: number; band: "high" | "moderate" | "low"; components: RecoveryComponent[]; coverage: number };

const scale = (v: number) => ((v - 1) / 4) * 100;
const inverted = (v: number) => ((5 - v) / 4) * 100;
const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5;

/**
 * 0–100 from whatever was recorded. Weights: sleep duration 25, sleep quality 10, energy 20,
 * stress 15 (lower is better), soreness 15 (lower is better), overall feeling 15.
 * Missing inputs are left out and the remaining weights are re-normalised, so a partial
 * check-in still gives a score; `coverage` says how much of the full picture it is based on.
 */
export function calculateRecoveryScore(i: RecoveryInputs): RecoveryScore | null {
  const parts: RecoveryComponent[] = [];
  if (i.sleepMinutes && i.sleepMinutes > 0) {
    const target = i.sleepTargetMinutes && i.sleepTargetMinutes > 0 ? i.sleepTargetMinutes : 480;
    parts.push({ key: "sleep", label: "Sleep duration", score: Math.min(100, (i.sleepMinutes / target) * 100), weight: 25 });
  }
  if (valid(i.sleepQuality)) parts.push({ key: "quality", label: "Sleep quality", score: scale(i.sleepQuality), weight: 10 });
  if (valid(i.energy)) parts.push({ key: "energy", label: "Energy", score: scale(i.energy), weight: 20 });
  if (valid(i.stress)) parts.push({ key: "stress", label: "Stress", score: inverted(i.stress), weight: 15 });
  if (valid(i.soreness)) parts.push({ key: "soreness", label: "Soreness", score: inverted(i.soreness), weight: 15 });
  if (valid(i.overall)) parts.push({ key: "overall", label: "Overall", score: scale(i.overall), weight: 15 });
  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);
  return { score, band: score >= 75 ? "high" : score >= 50 ? "moderate" : "low", components: parts.map((p) => ({ ...p, score: Math.round(p.score) })), coverage: totalWeight / 100 };
}

export const RECOVERY_ADVICE: Record<RecoveryScore["band"], string> = {
  high: "You look well recovered. A normal training day is reasonable.",
  moderate: "Recovery is middling. Train as planned but listen to your body, and consider keeping the hard sets honest.",
  low: "Recovery looks low today. Consider an easier session, a walk or mobility work. This is a tracking aid, not medical advice; if you feel unwell, talk to a healthcare professional.",
};
