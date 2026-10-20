import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { analyzeFoodPhoto } from "@/features/ai/scan";
import { scanInputSchema } from "@/lib/validations/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/food-scan — { path } of a photo the browser already uploaded to the PRIVATE food-scans bucket.
 * Returns detected items with database matches for the user to REVIEW. Nothing is logged here: the AI result is
 * never trusted as nutrition data (confirmation happens through the confirmScan server action).
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    return jsonOk(await analyzeFoodPhoto(user.id, scanInputSchema.parse(await request.json()).path));
  } catch (err) {
    return jsonError(err);
  }
}
