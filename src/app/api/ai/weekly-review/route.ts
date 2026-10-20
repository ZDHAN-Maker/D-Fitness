import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { generateWeeklyReview, getReview, listReviews } from "@/features/ai/review";
import { isoDate } from "@/lib/validations/nutrition";
import { reviewInputSchema } from "@/lib/validations/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/ai/weekly-review — saved reviews (list), or one with ?week=YYYY-MM-DD. */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const week = request.nextUrl.searchParams.get("week");
    return jsonOk(week ? await getReview(isoDate.parse(week)) : await listReviews(12));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/ai/weekly-review — { weekStart? | which?: "current"|"last" }. Generates and stores the review. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = z.object({}).passthrough().parse(await request.json().catch(() => ({})));
    return jsonOk(await generateWeeklyReview(user.id, reviewInputSchema.parse(body)));
  } catch (err) {
    return jsonError(err);
  }
}
