import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { AppError } from "@/lib/errors";
import { deletePlan, getPlanForEdit, savePlan } from "@/features/workout/plans";
import { planSchema } from "@/lib/validations/workout";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (c: Ctx) => z.string().uuid().parse((await c.params).id);

/** GET /api/workouts/:planId */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireApiUser();
    const plan = await getPlanForEdit(await idOf(ctx));
    if (!plan) throw new AppError("not_found", "We could not find that workout plan.", 404);
    return jsonOk(plan);
  } catch (err) {
    return jsonError(err);
  }
}

/** PUT /api/workouts/:planId — replace the plan and its (re-ordered) exercises atomically. */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const id = await idOf(ctx);
    const body = (await request.json()) as Record<string, unknown>;
    await savePlan(planSchema.parse({ ...body, id }));
    revalidatePath("/workout", "layout");
    return jsonOk({ id });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/workouts/:planId (past sessions keep their data; the link to the plan is cleared). */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deletePlan(await idOf(ctx));
    revalidatePath("/workout", "layout");
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
