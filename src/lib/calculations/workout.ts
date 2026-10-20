/**
 * Workout & activity calculations. Pure functions (no I/O, no React) shared by server and client.
 * Formulas intentionally mirror the SQL in 009/014 (Epley e1RM, volume = weight x reps).
 */
import { round1, round2 } from "@/lib/calculations/nutrition";

export type SetLike = {
  weight_kg: number | null;
  reps: number | null;
  duration_sec?: number | null;
  distance_m?: number | null;
  is_warmup?: boolean;
  is_completed?: boolean;
};

/** Epley: w x (1 + reps/30); a single rep IS the 1RM. Null when weight or reps are unusable. */
export function calculateEstimatedOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return null;
  return round2(reps === 1 ? weightKg : weightKg * (1 + reps / 30));
}

/** A set counts toward training volume only when finished, not a warm-up, and it has weight and reps. */
export const countsTowardVolume = (s: SetLike) => Boolean(s.is_completed) && !s.is_warmup && (s.weight_kg ?? 0) > 0 && (s.reps ?? 0) > 0;

export function calculateWorkoutVolume(sets: SetLike[]): number {
  return round2(sets.filter(countsTowardVolume).reduce((a, s) => a + (s.weight_kg as number) * (s.reps as number), 0));
}

/** Heaviest finished working set; ties broken by reps. */
export function topWorkingSet(sets: SetLike[]): SetLike | null {
  const work = sets.filter((s) => (s.is_completed ?? true) && !s.is_warmup && (s.reps ?? 0) > 0 && (s.weight_kg ?? 0) > 0);
  if (!work.length) return null;
  return work.reduce((best, s) => ((s.weight_kg as number) > (best.weight_kg as number) || (s.weight_kg === best.weight_kg && (s.reps as number) > (best.reps as number)) ? s : best));
}

export type Suggestion = { weightKg: number; reps: number; reason: "add_weight" | "add_rep" };

export type ProgressionOptions = {
  /** Reps at which the user should move up in weight. Defaults to the plan's upper rep target, else 10. */
  targetReps?: number | null;
  /** Smallest plate jump. Defaults to 2.5 kg. */
  incrementKg?: number;
};

/**
 * Double-progression style suggestion based on the last session's top working set:
 *  - reached the target reps  -> same reps, one increment heavier   (60 x 10 -> 62.5 x 10)
 *  - otherwise                -> same weight, one more rep          (60 x 8  -> 60 x 9)
 * It is only a suggestion: the UI offers it, it never fills anything in by itself.
 */
export function suggestProgression(lastSets: SetLike[], opts: ProgressionOptions = {}): Suggestion | null {
  const top = topWorkingSet(lastSets);
  if (!top) return null;
  const target = opts.targetReps && opts.targetReps > 0 ? opts.targetReps : 10;
  const inc = opts.incrementKg && opts.incrementKg > 0 ? opts.incrementKg : 2.5;
  const w = top.weight_kg as number;
  const r = top.reps as number;
  return r >= target ? { weightKg: round1(w + inc), reps: r, reason: "add_weight" } : { weightKg: w, reps: r + 1, reason: "add_rep" };
}

/** "60 x 10" / "BW x 12" / "45 s" — compact text for a previous-performance column. */
export function formatSetShort(s: SetLike): string {
  if (s.weight_kg && s.reps) return `${trim(s.weight_kg)} × ${s.reps}`;
  if (s.reps) return `${s.reps} reps`;
  if (s.duration_sec) return s.distance_m ? `${trim(s.distance_m / 1000)} km · ${formatClock(s.duration_sec)}` : formatClock(s.duration_sec);
  return "–";
}

const trim = (n: number) => String(round2(n));

/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

// ── Cardio / activity ──────────────────────────────────────────────────────────────

/** Seconds per kilometre, or null when it cannot be computed. */
export function calculatePaceSecPerKm(durationMinutes: number, distanceKm: number | null | undefined): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationMinutes || durationMinutes <= 0) return null;
  return Math.round((durationMinutes * 60) / distanceKm);
}

/** 360 -> "6:00 /km" */
export function formatPace(secPerKm: number | null | undefined): string {
  return secPerKm && secPerKm > 0 ? `${formatClock(secPerKm)} /km` : "–";
}

export function calculateSpeedKmh(durationMinutes: number, distanceKm: number | null | undefined): number | null {
  if (!distanceKm || distanceKm <= 0 || !durationMinutes || durationMinutes <= 0) return null;
  return round1(distanceKm / (durationMinutes / 60));
}

/** kcal = MET x body weight (kg) x hours. A rough estimate; null when body weight is unknown. */
export function calculateCaloriesBurned(met: number | null | undefined, weightKg: number | null | undefined, durationMinutes: number): number | null {
  if (!met || !weightKg || met <= 0 || weightKg <= 0 || durationMinutes <= 0) return null;
  return Math.round(met * weightKg * (durationMinutes / 60));
}

/** Parse "h:mm:ss", "mm:ss" or plain minutes into minutes. Returns null for anything else. */
export function parseDurationToMinutes(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, h, min, sec] = m;
  if (Number(sec) > 59) return null;
  return round2(Number(h ?? 0) * 60 + Number(min) + Number(sec) / 60);
}
