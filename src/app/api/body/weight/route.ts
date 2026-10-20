import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { listWeights, rangeStart, saveWeight } from "@/features/body/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { rangeSchema, weightSchema } from "@/lib/validations/body";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/body/weight?range=30d|90d|180d|1y|all — ascending by date. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const { range } = rangeSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { profile } = await getProfileAndSettings(user.id);
    return jsonOk(await listWeights(rangeStart(todayInTimeZone(profile?.timezone ?? "UTC"), range)));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/body/weight — { date, weightKg, note? }. One entry per day: same date replaces it. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await saveWeight(user.id, weightSchema.parse(await request.json()));
    revalidatePath("/body", "layout");
    revalidatePath("/dashboard");
    return jsonOk({ saved: true }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
