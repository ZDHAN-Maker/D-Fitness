import { jsonError, jsonOk } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/guard";
import { listAchievements, listStreaks } from "@/features/achievements/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/achievements — every achievement with your progress toward it, plus current streaks. Unlocking is server-side only. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { profile } = await getProfileAndSettings(user.id);
    const [achievements, streaks] = await Promise.all([listAchievements(), listStreaks(todayInTimeZone(profile?.timezone ?? "UTC"))]);
    return jsonOk({ achievements, streaks });
  } catch (err) {
    return jsonError(err);
  }
}
