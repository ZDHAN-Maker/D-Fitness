import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { addWater, listWater } from "@/features/hydration/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { isoDate } from "@/lib/validations/nutrition";
import { waterSchema } from "@/lib/validations/body";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/water?date= — the day's entries, total and target. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const { profile, settings } = await getProfileAndSettings(user.id);
    const date = isoDate.parse(request.nextUrl.searchParams.get("date") ?? todayInTimeZone(profile?.timezone ?? "UTC"));
    const logs = await listWater(date);
    return jsonOk({ date, logs, totalMl: logs.reduce((a, l) => a + l.amountMl, 0), targetMl: settings?.water_target_ml ?? 2500 });
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/water — { date, amountMl }. Presets in the UI: 250, 500, 750, 1000. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const v = waterSchema.parse(await request.json());
    const result = await addWater(v.date, v.amountMl);
    revalidatePath("/hydration", "layout");
    revalidatePath("/dashboard");
    return jsonOk(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
