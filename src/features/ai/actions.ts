"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { addGeneratedSchema, confirmScanSchema, logMealSchema } from "@/lib/validations/ai";
import { logSuggestedMeal } from "@/features/ai/meal";
import { addGeneratedToPlan } from "@/features/ai/workout-gen";
import { confirmScan, discardScan } from "@/features/ai/scan";
import { z } from "zod";

const refreshFood = () => {
  revalidatePath("/nutrition", "layout");
  revalidatePath("/dashboard");
};

export async function logMealAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await logSuggestedMeal(user.id, logMealSchema.parse(input));
    refreshFood();
  });
}

export async function addGeneratedWorkoutToPlanAction(input: unknown): Promise<ActionResult<{ planId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const v = addGeneratedSchema.parse(input);
    const planId = await addGeneratedToPlan(user.id, v.generatedId, v.name);
    revalidatePath("/workout", "layout");
    return { planId };
  });
}

export async function confirmScanAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await confirmScan(user.id, confirmScanSchema.parse(input));
    refreshFood();
  });
}

export async function discardScanAction(scanId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await discardScan(z.string().uuid().parse(scanId));
  });
}
