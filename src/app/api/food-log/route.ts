import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { addLogItem, afterFoodLogged, getDiary } from "@/features/nutrition/diary";
import { getProfileAndSettings } from "@/features/profile/queries";
import { isoDate, logFoodSchema } from "@/lib/validations/nutrition";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/food-log?date=YYYY-MM-DD — the day's meals, items and totals. */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const date = isoDate.parse(request.nextUrl.searchParams.get("date"));
    return jsonOk(await getDiary(date));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/food-log — add an item. Body: { date, mealType, ref, portion }. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = logFoodSchema.parse(await request.json());
    const result = await addLogItem(user.id, input);
    const { profile } = await getProfileAndSettings(user.id);
    await afterFoodLogged(input.date, todayInTimeZone(profile?.timezone ?? "UTC"));
    revalidatePath("/nutrition", "layout");
    revalidatePath("/dashboard");
    return jsonOk(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
