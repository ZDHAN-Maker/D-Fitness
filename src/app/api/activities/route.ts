import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { afterActivityLogged, listActivities, logActivity } from "@/features/activity/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { activityListSchema, activitySchema } from "@/lib/validations/activity";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/activities?page=1 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const { page } = activityListSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return jsonOk(await listActivities(page));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/activities — body: { activityTypeId, date, durationMinutes, distanceKm?, caloriesBurned?, notes? } */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = activitySchema.parse({ ...((await request.json()) as object), id: undefined });
    const id = await logActivity(user.id, input);
    const { profile } = await getProfileAndSettings(user.id);
    await afterActivityLogged(id, input.date, todayInTimeZone(profile?.timezone ?? "UTC"));
    revalidatePath("/activity", "layout");
    revalidatePath("/dashboard");
    return jsonOk({ id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
