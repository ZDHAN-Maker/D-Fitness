import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { generateWorkout } from "@/features/ai/workout-gen";
import { workoutGenInputSchema } from "@/lib/validations/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/ai/workout-generator — { minutes, goal, focus, equipment[], note? }. Exercises come only from your library. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    return jsonOk(await generateWorkout(user.id, workoutGenInputSchema.parse(await request.json())));
  } catch (err) {
    return jsonError(err);
  }
}
