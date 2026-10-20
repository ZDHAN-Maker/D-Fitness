import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/guard";
import { searchFoodRefs } from "@/features/nutrition/refs";
import { searchQuerySchema } from "@/lib/validations/nutrition";

export const dynamic = "force-dynamic";

/** GET /api/foods/search?q=nasi&category=1&offset=0&limit=20 — database-driven, paginated. */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const p = searchQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return jsonOk(await searchFoodRefs({ q: p.q, categoryId: p.category, offset: p.offset, limit: p.limit }));
  } catch (err) {
    return jsonError(err);
  }
}
