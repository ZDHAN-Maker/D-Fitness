"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { checkInSchema } from "@/lib/validations/body";
import { isoDate } from "@/lib/validations/nutrition";
import { clearDay, saveCheckIn } from "@/features/recovery/service";

const refresh = () => {
  revalidatePath("/recovery", "layout");
  revalidatePath("/dashboard");
};

export async function saveCheckInAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await saveCheckIn(user.id, checkInSchema.parse(input));
    refresh();
  });
}

export async function clearDayAction(date: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await clearDay(isoDate.parse(date));
    refresh();
  });
}
