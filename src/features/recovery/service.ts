import { createClient } from "@/lib/supabase/server";
import { calculateRecoveryScore, type RecoveryScore } from "@/lib/calculations/body";
import { addDays } from "@/utils/date";
import type { CheckInInput } from "@/lib/validations/body";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export type DayRecovery = {
  date: string;
  sleep: { id: string; minutes: number; quality: number | null } | null;
  recovery: { id: string; energy: number | null; stress: number | null; soreness: number | null; overall: number | null } | null;
  score: RecoveryScore | null;
};

type SleepRow = { id: string; sleep_date: string; duration_minutes: number; quality: number | null };
type RecRow = { id: string; log_date: string; energy: number | null; stress: number | null; soreness: number | null; overall: number | null };

const toDay = (date: string, sleep: SleepRow | undefined, rec: RecRow | undefined, sleepTarget: number): DayRecovery => ({
  date,
  sleep: sleep ? { id: sleep.id, minutes: Number(sleep.duration_minutes), quality: num(sleep.quality) } : null,
  recovery: rec ? { id: rec.id, energy: num(rec.energy), stress: num(rec.stress), soreness: num(rec.soreness), overall: num(rec.overall) } : null,
  // Always computed from the latest sleep + check-in, so logging sleep after the check-in is never stale.
  score: calculateRecoveryScore({ sleepMinutes: sleep ? Number(sleep.duration_minutes) : null, sleepTargetMinutes: sleepTarget, sleepQuality: num(sleep?.quality), energy: num(rec?.energy), stress: num(rec?.stress), soreness: num(rec?.soreness), overall: num(rec?.overall) }),
});

async function sleepTarget(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_settings").select("sleep_target_minutes").maybeSingle();
  if (error) throw error;
  return Number(data?.sleep_target_minutes ?? 480);
}

/** Sleep + check-in + score for each day in [from, to] (days without any data are omitted). Two queries. */
export async function listRecovery(from: string, to: string): Promise<DayRecovery[]> {
  const supabase = await createClient();
  const [sleeps, recs, target] = await Promise.all([
    supabase.from("sleep_logs").select("id, sleep_date, duration_minutes, quality").gte("sleep_date", from).lte("sleep_date", to),
    supabase.from("recovery_logs").select("id, log_date, energy, stress, soreness, overall").gte("log_date", from).lte("log_date", to),
    sleepTarget(),
  ]);
  if (sleeps.error) throw sleeps.error;
  if (recs.error) throw recs.error;
  const sl = new Map((sleeps.data as SleepRow[]).map((r) => [String(r.sleep_date).slice(0, 10), r]));
  const rc = new Map((recs.data as RecRow[]).map((r) => [String(r.log_date).slice(0, 10), r]));
  const dates = [...new Set([...sl.keys(), ...rc.keys()])].sort();
  return dates.map((d) => toDay(d, sl.get(d), rc.get(d), target));
}

export async function getDay(date: string): Promise<DayRecovery> {
  return (await listRecovery(date, date))[0] ?? { date, sleep: null, recovery: null, score: null };
}

/** Saves what was entered (sleep and/or check-in) and keeps the cached score on the recovery row current. */
export async function saveCheckIn(userId: string, v: CheckInInput) {
  const supabase = await createClient();

  if (v.sleep) {
    const { error } = await supabase.from("sleep_logs").upsert({ user_id: userId, sleep_date: v.date, duration_minutes: v.sleep.durationMinutes, quality: v.sleep.quality ?? null }, { onConflict: "user_id,sleep_date" });
    if (error) throw error;
  }
  const r = v.recovery;
  if (r && Object.values(r).some((x) => x !== undefined)) {
    const row = { user_id: userId, log_date: v.date, energy: r.energy ?? null, stress: r.stress ?? null, soreness: r.soreness ?? null, overall: r.overall ?? null };
    const { error } = await supabase.from("recovery_logs").upsert(row, { onConflict: "user_id,log_date" });
    if (error) throw error;
  }

  // Refresh the cached score (used later by analytics) from the combined data for that day.
  const day = await getDay(v.date);
  if (day.recovery && day.score) {
    const { error } = await supabase.from("recovery_logs").update({ recovery_score: day.score.score }).eq("id", day.recovery.id);
    if (error) throw error;
  }
}

export async function clearDay(date: string) {
  const supabase = await createClient();
  const [a, b] = await Promise.all([supabase.from("sleep_logs").delete().eq("sleep_date", date), supabase.from("recovery_logs").delete().eq("log_date", date)]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
}

export const lastDays = (today: string, n: number) => ({ from: addDays(today, -(n - 1)), to: today });
