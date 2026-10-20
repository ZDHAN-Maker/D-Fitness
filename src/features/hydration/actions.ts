"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { waterSchema } from "@/lib/validations/body";
import { isoDate } from "@/lib/validations/nutrition";
import { addWater, deleteWater, undoLastWater, type WaterAdd } from "@/features/hydration/service";

const refresh = () => {
  revalidatePath("/hydration", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
};

export async function addWaterAction(input: unknown): Promise<ActionResult<WaterAdd>> {
  return runAction(async () => {
    await requireUser();
    const v = waterSchema.parse(input);
    const r = await addWater(v.date, v.amountMl);
    refresh();
    return r;
  });
}

export async function deleteWaterAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteWater(z.string().uuid().parse(id));
    refresh();
  });
}

export async function undoWaterAction(date: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await undoLastWater(isoDate.parse(date));
    refresh();
  });
}
