import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { deleteActivity, updateActivity } from "@/features/activity/service";
import { activitySchema } from "@/lib/validations/activity";

type Ctx = { params: Promise<{ id: string }> };
const refresh = () => {
  revalidatePath("/activity", "layout");
  revalidatePath("/dashboard");
};

/** PATCH /api/activities/:id */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const id = z.string().uuid().parse((await params).id);
    await updateActivity({ ...activitySchema.parse({ ...((await request.json()) as object), id }), id });
    refresh();
    return jsonOk({ updated: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/activities/:id */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deleteActivity(z.string().uuid().parse((await params).id));
    refresh();
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
