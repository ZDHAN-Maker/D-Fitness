import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { getProfileAndSettings } from "@/features/profile/queries";
import { startWorkout } from "@/features/workout/sessions";
import { todayInTimeZone } from "@/utils/date";

/** POST /api/workouts/:planId/start — begin a session from a plan. Returns { sessionId }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const planId = z.string().uuid().parse((await params).id);
    const { profile } = await getProfileAndSettings(user.id);
    const sessionId = await startWorkout({ planId, date: todayInTimeZone(profile?.timezone ?? "UTC") });
    revalidatePath("/workout", "layout");
    return jsonOk({ sessionId }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
