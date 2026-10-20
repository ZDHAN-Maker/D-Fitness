import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { deleteWater } from "@/features/hydration/service";

/** DELETE /api/water/:id */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deleteWater(z.string().uuid().parse((await params).id));
    revalidatePath("/hydration", "layout");
    revalidatePath("/dashboard");
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
