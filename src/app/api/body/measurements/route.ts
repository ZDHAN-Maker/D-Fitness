import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { listMeasurements, rangeStart, saveMeasurement } from "@/features/body/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { measurementSchema, rangeSchema } from "@/lib/validations/body";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/body/measurements?range=… */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const { range } = rangeSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { profile } = await getProfileAndSettings(user.id);
    return jsonOk(await listMeasurements(rangeStart(todayInTimeZone(profile?.timezone ?? "UTC"), range)));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/body/measurements — { date, waistCm?, chestCm?, armCm?, thighCm?, hipCm?, bodyFatPct? }. Merges into the date's row. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await saveMeasurement(user.id, measurementSchema.parse(await request.json()));
    revalidatePath("/body", "layout");
    return jsonOk({ saved: true }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
