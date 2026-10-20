import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { listPlans, savePlan } from "@/features/workout/plans";
import { planSchema } from "@/lib/validations/workout";

export const dynamic = "force-dynamic";

/** GET /api/workouts — your workout plans. */
export async function GET() {
  try {
    await requireApiUser();
    return jsonOk(await listPlans());
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/workouts — create a plan. Body: { name, description?, scheduledDays, exercises[] }. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const body = (await request.json()) as Record<string, unknown>;
    const id = await savePlan(planSchema.parse({ ...body, id: undefined }));
    revalidatePath("/workout", "layout");
    return jsonOk({ id }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
