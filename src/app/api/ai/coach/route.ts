import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { askCoach, generateInsight } from "@/features/ai/coach";
import { coachInputSchema } from "@/lib/validations/ai";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/coach
 *   { message, conversationId? }  -> chat reply { conversationId, messages: [user, assistant] }
 *   { insight: true }             -> today's short insight (replaces any earlier one for the day)
 * Server-side only: the AI key never reaches the browser. Emergencies, disordered-eating and crash-diet messages are
 * answered with a fixed safe reply and no model call.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = (await request.json()) as Record<string, unknown>;
    if (body.insight === true) {
      const insight = await generateInsight(user.id);
      revalidatePath("/dashboard");
      return jsonOk(insight);
    }
    return jsonOk(await askCoach(user.id, coachInputSchema.parse(body)));
  } catch (err) {
    return jsonError(err);
  }
}
