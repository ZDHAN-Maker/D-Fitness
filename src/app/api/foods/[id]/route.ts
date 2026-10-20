import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/guard";
import { AppError } from "@/lib/errors";
import { loadFoodRefs, withFavorites } from "@/features/nutrition/refs";
import { foodRefSchema } from "@/lib/validations/nutrition";

export const dynamic = "force-dynamic";

/** GET /api/foods/:id?kind=food|custom|recipe — one food with its portion options. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await params;
    const ref = foodRefSchema.parse({ kind: request.nextUrl.searchParams.get("kind") ?? "food", id });
    const [food] = await withFavorites(await loadFoodRefs([ref]));
    if (!food) throw new AppError("not_found", "We could not find that food.", 404);
    return jsonOk(food);
  } catch (err) {
    return jsonError(err);
  }
}
