import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { AppError } from "@/lib/errors";
import { addManualProgress, deleteGoal, getGoal, setGoalStatus } from "@/features/goals/service";
import { goalProgressPct } from "@/lib/calculations/goals";
import { goalStatusSchema, manualProgressSchema } from "@/lib/validations/goals";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (c: Ctx) => z.string().uuid().parse((await c.params).id);
const refresh = () => {
  revalidatePath("/goals", "layout");
  revalidatePath("/dashboard");
};

/** GET /api/goals/:id — the goal plus its progress history. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireApiUser();
    const g = await getGoal(await idOf(ctx));
    if (!g) throw new AppError("not_found", "We could not find that goal.", 404);
    return jsonOk({ ...g, progress_pct: goalProgressPct(g) });
  } catch (err) {
    return jsonError(err);
  }
}

/** PATCH /api/goals/:id — { status } to pause/resume/abandon, or { value, date } to update a custom goal by hand. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const id = await idOf(ctx);
    const body = (await request.json()) as Record<string, unknown>;
    if ("status" in body) await setGoalStatus(id, goalStatusSchema.parse({ id, status: body.status }).status);
    else {
      const v = manualProgressSchema.parse({ goalId: id, date: body.date, value: body.value });
      await addManualProgress(user.id, id, v.date, v.value);
    }
    refresh();
    return jsonOk({ updated: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/goals/:id */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deleteGoal(await idOf(ctx));
    refresh();
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
