import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { addDays } from "@/utils/date";

export type WaterAdd = { totalMl: number; targetMl: number; reached: boolean };

export async function addWater(date: string, amountMl: number): Promise<WaterAdd> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_water", { p_date: date, p_amount_ml: amountMl });
  if (error) {
    if (error.code === "22023") throw new AppError("validation", "You can add water for today or the last 7 days.");
    throw error;
  }
  const r = data as { total_ml: number; target_ml: number; reached: boolean };
  return { totalMl: Number(r.total_ml), targetMl: Number(r.target_ml), reached: Boolean(r.reached) };
}

export type WaterLog = { id: string; amountMl: number; at: string };

export async function listWater(date: string): Promise<WaterLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("water_logs").select("id, amount_ml, logged_at").eq("logged_on", date).order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, amountMl: Number(r.amount_ml), at: r.logged_at as string }));
}

export async function deleteWater(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("water_logs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that entry.", 404);
}

/** Removes the most recent entry for a date (the "Undo" button). */
export async function undoLastWater(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("water_logs").select("id").eq("logged_on", date).order("logged_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("not_found", "There is nothing to undo.", 404);
  await deleteWater(data.id as string);
}

/** Per-day totals for the last `days` days, zero-filled so charts have no gaps. */
export async function recentTotals(today: string, days = 7): Promise<{ date: string; totalMl: number }[]> {
  const from = addDays(today, -(days - 1));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("water_totals", { p_from: from, p_to: today });
  if (error) throw error;
  const map = new Map((data as { logged_on: string; total_ml: number }[] | null)?.map((r) => [String(r.logged_on).slice(0, 10), Number(r.total_ml)]) ?? []);
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { date: d, totalMl: map.get(d) ?? 0 };
  });
}
