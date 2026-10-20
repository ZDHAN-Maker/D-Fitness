import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { deleteLogItem, updateLogItem } from "@/features/nutrition/diary";
import { updateLogItemSchema } from "@/lib/validations/nutrition";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };
const refresh = () => {
  revalidatePath("/nutrition", "layout");
  revalidatePath("/dashboard");
};

/** PATCH /api/food-log/:id — change amount and/or meal. */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    await updateLogItem(user.id, updateLogItemSchema.parse({ ...body, itemId: id }));
    refresh();
    return jsonOk({ updated: true });
  } catch (err) {
    return jsonError(err);
  }
}

/** DELETE /api/food-log/:id */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deleteLogItem(z.string().uuid().parse((await params).id));
    refresh();
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
