import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { createGoal, listGoals, syncProgress } from "@/features/goals/service";
import { getProfileAndSettings } from "@/features/profile/queries";
import { goalProgressPct } from "@/lib/calculations/goals";
import { goalSchema } from "@/lib/validations/goals";
import { todayInTimeZone } from "@/utils/date";

export const dynamic = "force-dynamic";

/** GET /api/goals — all goals with their progress percentage. */
export async function GET() {
  try {
    await requireApiUser();
    return jsonOk((await listGoals()).map((g) => ({ ...g, progress_pct: goalProgressPct(g) })));
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/goals — create a goal; progress is computed straight away from your existing data. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = goalSchema.parse({ ...((await request.json()) as object), id: undefined });
    const id = await createGoal(user.id, input);
    const { profile } = await getProfileAndSettings(user.id);
    const sync = await syncProgress(todayInTimeZone(profile?.timezone ?? "UTC"));
    revalidatePath("/goals", "layout");
    revalidatePath("/dashboard");
    return jsonOk({ id, sync }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
