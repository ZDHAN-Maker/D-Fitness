import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { runAi } from "@/lib/ai/run";
import { scanGemini, scanZod } from "@/lib/ai/schemas";
import { SCAN_SYSTEM } from "@/lib/ai/prompts";
import { normalizeScan, type DetectedItem } from "@/lib/ai/validate";
import { mergeCandidates } from "@/lib/ai/scan-match";
import { PHOTO_MIME, isOwnPhotoPath } from "@/lib/images/photo";
import { getProfileAndSettings } from "@/features/profile/queries";
import { addLogItem, afterFoodLogged } from "@/features/nutrition/diary";
import { loadFoodRefs, searchFoodRefs } from "@/features/nutrition/refs";
import type { FoodResult } from "@/features/nutrition/types";
import { todayInTimeZone } from "@/utils/date";
import type { MealType } from "@/types/domain";

export const SCAN_BUCKET = "food-scans";
const MAX_BYTES = 4 * 1024 * 1024;

export type ScanItem = DetectedItem & { candidates: FoodResult[] };
export type ScanResult = { scanId: string; isFood: boolean; notes: string; items: ScanItem[] };

async function removeImage(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(SCAN_BUCKET).remove([path]);
  if (error) console.error("[scan] could not remove image", error.message);
}

/**
 * Photo -> AI detection -> match against the REAL food database -> proposals for the user to review.
 * Nothing here is logged. The AI's guess is untrusted input: it only chooses what to search for and a starting portion.
 */
export async function analyzeFoodPhoto(userId: string, path: string): Promise<ScanResult> {
  if (!isOwnPhotoPath(userId, path)) throw new AppError("forbidden", "That upload path is not allowed.", 403);
  const supabase = await createClient();
  const fileName = path.split("/")[1]!;

  const { data: found, error: listErr } = await supabase.storage.from(SCAN_BUCKET).list(userId, { search: fileName, limit: 5 });
  if (listErr) throw listErr;
  const obj = found?.find((o) => o.name === fileName);
  if (!obj) throw new AppError("not_found", "The uploaded photo could not be found. Please try again.", 404);
  const meta = (obj.metadata ?? {}) as { mimetype?: string; size?: number };
  if ((meta.mimetype && !(PHOTO_MIME as readonly string[]).includes(meta.mimetype)) || (meta.size && meta.size > MAX_BYTES)) {
    await removeImage(path);
    throw new AppError("validation", "That file is not an allowed photo (JPEG, PNG or WebP under 4 MB).");
  }

  const { data: scan, error: insErr } = await supabase.from("ai_food_scans").insert({ user_id: userId, storage_path: path, status: "pending" }).select("id").single();
  if (insErr) throw insErr;
  const scanId = scan.id as string;

  try {
    const { data: blob, error: dlErr } = await supabase.storage.from(SCAN_BUCKET).download(path);
    if (dlErr || !blob) throw new AppError("not_found", "Could not read the uploaded photo.", 404);
    if (blob.size > MAX_BYTES) throw new AppError("validation", "That photo is too large.");
    const mime = (PHOTO_MIME as readonly string[]).includes(blob.type) ? blob.type : "image/jpeg";
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

    const { data: detected, model } = await runAi({
      userId,
      feature: "food_scan",
      vision: true,
      system: SCAN_SYSTEM,
      contents: [{ role: "user", parts: [{ text: "Identify the food in this photo." }, { inline_data: { mime_type: mime, data: base64 } }] }],
      schema: scanGemini,
      validate: (raw) => normalizeScan(scanZod.parse(raw)),
    });

    // Match every detected item against the database (own custom foods and recipes first, then master foods).
    const items: ScanItem[] = await Promise.all(
      detected.items.map(async (it) => {
        const lists = await Promise.all(it.searchTerms.slice(0, 3).map((t) => searchFoodRefs({ q: t, limit: 4 }).then((r) => r.items).catch(() => [] as FoodResult[])));
        return { ...it, candidates: mergeCandidates(lists, 4) };
      }),
    );

    const { error: upErr } = await supabase
      .from("ai_food_scans")
      .update({ status: "analyzed", model, detected_items: detected.items, matched_items: items.map((i) => ({ name: i.name, candidates: i.candidates.map((c) => ({ kind: c.kind, id: c.id })) })) })
      .eq("id", scanId);
    if (upErr) throw upErr;
    if (!detected.isFood) await removeImage(path); // nothing to review: do not keep the photo

    return { scanId, isFood: detected.isFood, notes: detected.notes, items };
  } catch (e) {
    await supabase.from("ai_food_scans").update({ status: "failed" }).eq("id", scanId);
    await removeImage(path);
    throw e;
  }
}

/** The ONLY way a scan becomes food-log entries: after the user reviewed and confirmed each item. */
export async function confirmScan(userId: string, input: { scanId: string; date: string; mealType: MealType; items: { kind: "food" | "custom" | "recipe"; id: string; amount: number }[] }) {
  const supabase = await createClient();
  const { data: scan, error } = await supabase.from("ai_food_scans").select("id, status, storage_path").eq("id", input.scanId).maybeSingle();
  if (error) throw error;
  if (!scan) throw new AppError("not_found", "We could not find that scan.", 404);
  if (scan.status !== "analyzed") throw new AppError("conflict", "This scan was already used or discarded.", 409);

  const loaded = await loadFoodRefs(input.items.map((i) => ({ kind: i.kind, id: i.id })));
  const byKey = new Map(loaded.map((f) => [`${f.kind}:${f.id}`, f]));
  for (const it of input.items) {
    const food = byKey.get(`${it.kind}:${it.id}`);
    if (!food) throw new AppError("not_found", "One of the foods could not be found.", 404);
    await addLogItem(userId, { date: input.date, mealType: input.mealType, ref: { kind: it.kind, id: it.id }, portion: { quantity: it.amount, unitCode: food.per.base_unit, servingId: null } }, { source: "ai_scan", scanId: input.scanId });
  }

  const { error: upErr } = await supabase.from("ai_food_scans").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", input.scanId);
  if (upErr) throw upErr;
  await removeImage(String(scan.storage_path)); // privacy: the photo is not kept once it has been used
  const { profile } = await getProfileAndSettings(userId);
  await afterFoodLogged(input.date, todayInTimeZone(profile?.timezone ?? "UTC"));
}

export async function discardScan(scanId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_food_scans").update({ status: "discarded" }).eq("id", scanId).in("status", ["pending", "analyzed"]).select("storage_path").maybeSingle();
  if (error) throw error;
  if (data) await removeImage(String(data.storage_path));
}
