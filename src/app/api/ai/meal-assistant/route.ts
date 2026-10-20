import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { suggestMeals } from "@/features/ai/meal";
import { mealInputSchema } from "@/lib/validations/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/ai/meal-assistant — { mealType, note? }. Options use real database foods; nutrition is calculated by the app. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    return jsonOk(await suggestMeals(user.id, mealInputSchema.parse(await request.json())));
  } catch (err) {
    return jsonError(err);
  }
}
