import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assertSameOrigin, requireApiUser } from "@/lib/api/guard";
import { deleteMeasurement } from "@/features/body/service";

/** DELETE /api/body/measurements/:id */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    await deleteMeasurement(z.string().uuid().parse((await params).id));
    revalidatePath("/body", "layout");
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
