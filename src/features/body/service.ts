import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MIME, isOwnPhotoPath } from "@/lib/images/photo";
import { addDays } from "@/utils/date";
import type { MeasurementInput, PhotoMetaInput, RangeKey, WeightInput } from "@/lib/validations/body";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = { "30d": 30, "90d": 90, "180d": 180, "1y": 365 };
export const rangeStart = (today: string, range: RangeKey): string | null => (range === "all" ? null : addDays(today, -RANGE_DAYS[range]));

// ── Weight ─────────────────────────────────────────────────────────────────────────

export type WeightEntry = { id: string; date: string; weightKg: number; note: string | null };

export async function listWeights(from: string | null): Promise<WeightEntry[]> {
  const supabase = await createClient();
  let q = supabase.from("weight_logs").select("id, logged_on, weight_kg, note").order("logged_on", { ascending: true }).limit(2000);
  if (from) q = q.gte("logged_on", from);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, date: String(r.logged_on).slice(0, 10), weightKg: Number(r.weight_kg), note: (r.note as string) ?? null }));
}

/** One weight per day: logging again on the same date replaces it. */
export async function saveWeight(userId: string, v: WeightInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("weight_logs").upsert({ user_id: userId, logged_on: v.date, weight_kg: v.weightKg, note: v.note ?? null }, { onConflict: "user_id,logged_on" });
  if (error) throw error;
}

export async function deleteWeight(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weight_logs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that entry.", 404);
}

export async function getLatestWeight(): Promise<{ date: string; weightKg: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weight_logs").select("logged_on, weight_kg").order("logged_on", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { date: String(data.logged_on).slice(0, 10), weightKg: Number(data.weight_kg) } : null;
}

// ── Measurements ─────────────────────────────────────────────────────────────────────

export type MeasurementEntry = { id: string; date: string; waistCm: number | null; chestCm: number | null; armCm: number | null; thighCm: number | null; hipCm: number | null; bodyFatPct: number | null };

export async function listMeasurements(from: string | null): Promise<MeasurementEntry[]> {
  const supabase = await createClient();
  let q = supabase.from("body_measurements").select("id, measured_on, waist_cm, chest_cm, arm_cm, thigh_cm, hip_cm, body_fat_pct").order("measured_on", { ascending: true }).limit(1000);
  if (from) q = q.gte("measured_on", from);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, date: String(r.measured_on).slice(0, 10), waistCm: num(r.waist_cm), chestCm: num(r.chest_cm), armCm: num(r.arm_cm), thighCm: num(r.thigh_cm), hipCm: num(r.hip_cm), bodyFatPct: num(r.body_fat_pct) }));
}

/** Only the fields you filled in are written, so a later entry on the same date MERGES into it. */
export async function saveMeasurement(userId: string, v: MeasurementInput) {
  const row: Record<string, unknown> = { user_id: userId, measured_on: v.date };
  if (v.waistCm !== undefined) row.waist_cm = v.waistCm;
  if (v.chestCm !== undefined) row.chest_cm = v.chestCm;
  if (v.armCm !== undefined) row.arm_cm = v.armCm;
  if (v.thighCm !== undefined) row.thigh_cm = v.thighCm;
  if (v.hipCm !== undefined) row.hip_cm = v.hipCm;
  if (v.bodyFatPct !== undefined) row.body_fat_pct = v.bodyFatPct;
  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").upsert(row, { onConflict: "user_id,measured_on" });
  if (error) throw error;
}

export async function deleteMeasurement(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("body_measurements").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that entry.", 404);
}

// ── Progress photos (private bucket; DB keeps path + metadata only) ─────────────────────────

export type PhotoEntry = { id: string; takenOn: string; pose: string; note: string | null; url: string | null };

export async function listPhotos(): Promise<PhotoEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("progress_photos").select("id, taken_on, pose, note, storage_path").order("taken_on", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const rows = data ?? [];
  // One batched call for all signed URLs (1 hour). Paths are never exposed to the browser.
  const urls = new Map<string, string>();
  if (rows.length) {
    const { data: signed, error: signErr } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path as string), 3600);
    if (signErr) throw signErr;
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({ id: r.id as string, takenOn: String(r.taken_on).slice(0, 10), pose: r.pose as string, note: (r.note as string) ?? null, url: urls.get(r.storage_path as string) ?? null }));
}

/**
 * The browser uploads the (resized) image straight to Storage; this verifies what actually landed there
 * (own folder, generated name, real MIME type and size) before it is recorded. Anything else is deleted.
 */
export async function registerPhoto(userId: string, v: PhotoMetaInput): Promise<string> {
  if (!isOwnPhotoPath(userId, v.path)) throw new AppError("forbidden", "That upload path is not allowed.", 403);
  const supabase = await createClient();
  const storage = supabase.storage.from(PHOTO_BUCKET);

  const fileName = v.path.split("/")[1]!;
  const { data: found, error: listErr } = await storage.list(userId, { search: fileName, limit: 5 });
  if (listErr) throw listErr;
  const obj = found?.find((o) => o.name === fileName);
  if (!obj) throw new AppError("not_found", "The uploaded photo could not be found. Please try again.", 404);

  const meta = (obj.metadata ?? {}) as { mimetype?: string; size?: number };
  const okType = !meta.mimetype || (PHOTO_MIME as readonly string[]).includes(meta.mimetype);
  const okSize = !meta.size || meta.size <= PHOTO_MAX_BYTES;
  if (!okType || !okSize) {
    await storage.remove([v.path]);
    throw new AppError("validation", "That file is not an allowed photo.");
  }

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({ user_id: userId, taken_on: v.takenOn, pose: v.pose, storage_path: v.path, mime_type: meta.mimetype ?? v.mimeType, size_bytes: meta.size ?? v.sizeBytes, note: v.note ?? null })
    .select("id")
    .single();
  if (error) {
    await storage.remove([v.path]); // do not leave an orphaned file behind
    throw error;
  }
  return data.id as string;
}

export async function deletePhoto(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("progress_photos").delete().eq("id", id).select("storage_path");
  if (error) throw error;
  if (!data?.length) throw new AppError("not_found", "We could not find that photo.", 404);
  const { error: rmErr } = await supabase.storage.from(PHOTO_BUCKET).remove([data[0]!.storage_path as string]);
  if (rmErr) console.error("[photo-delete] storage cleanup failed", rmErr.message); // row is gone; file cleanup is best-effort
}
