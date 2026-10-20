import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { getDay, listRecovery } from "@/features/recovery/service";
import { saveCheckIn } from "@/features/recovery/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { checkInSchema } from "@/lib/validations/body";
import { isoDate } from "@/lib/validations/nutrition";
import { addDays, todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

const query = z.object({ date: isoDate.optional(), days: z.coerce.number().int().min(1).max(120).optional() });

/** GET /api/recovery?date=YYYY-MM-DD (one day) or ?days=14 (history, newest last). Includes the computed score. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const q = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { profile } = await getProfileAndSettings(user.id);
    const today = todayInTimeZone(profile?.timezone ?? "UTC");
    if (q.days) return jsonOk(await listRecovery(addDays(today, -(q.days - 1)), today));
    return jsonOk(await getDay(q.date ?? today));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/recovery — { date, sleep?: { durationMinutes, quality? }, recovery?: { energy?, stress?, soreness?, overall? } } */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const v = checkInSchema.parse(await request.json());
    await saveCheckIn(user.id, v);
    revalidatePath("/recovery", "layout");
    revalidatePath("/dashboard");
    return jsonOk(await getDay(v.date), { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
