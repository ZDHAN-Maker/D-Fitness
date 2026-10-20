import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { completeWorkout } from "@/features/workout/sessions";
import { completeWorkoutSchema } from "@/lib/validations/workout";

/**
 * POST /api/workouts/:sessionId/complete — finish an in-progress session.
 * Body (optional): { effort?: 1-10, notes?: string }. Records PRs, streak and achievements.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const v = completeWorkoutSchema.parse({ ...body, sessionId: (await params).id });
    const result = await completeWorkout(v.sessionId, v.effort, v.notes);
    revalidatePath("/workout", "layout");
    revalidatePath("/dashboard");
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
