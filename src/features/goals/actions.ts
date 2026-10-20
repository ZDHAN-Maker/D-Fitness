"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { goalSchema, goalStatusSchema, manualProgressSchema } from "@/lib/validations/goals";
import { getProfileAndSettings } from "@/features/profile/queries";
import { addManualProgress, createGoal, deleteGoal, setGoalStatus, syncProgress, updateGoal, type SyncResult } from "@/features/goals/service";
import { todayInTimeZone } from "@/utils/date";

const refresh = () => {
  revalidatePath("/goals", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  revalidatePath("/notifications");
};

async function todayFor(userId: string) {
  const { profile } = await getProfileAndSettings(userId);
  return todayInTimeZone(profile?.timezone ?? "UTC");
}

/** Create or edit a goal, then immediately compute its progress from your existing data. */
export async function saveGoalAction(input: unknown): Promise<ActionResult<{ id: string; sync: SyncResult }>> {
  return runAction(async () => {
    const user = await requireUser();
    const v = goalSchema.parse(input);
    const id = v.id ? (await updateGoal(user.id, { ...v, id: v.id }), v.id) : await createGoal(user.id, v);
    const sync = await syncProgress(await todayFor(user.id));
    refresh();
    return { id, sync };
  });
}

export async function deleteGoalAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteGoal(z.string().uuid().parse(id));
    refresh();
  });
}

export async function setGoalStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const v = goalStatusSchema.parse(input);
    await setGoalStatus(v.id, v.status);
    if (v.status === "active") await syncProgress(await todayFor(user.id)); // resuming recomputes immediately
    refresh();
  });
}

export async function addGoalProgressAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const v = manualProgressSchema.parse(input);
    await addManualProgress(user.id, v.goalId, v.date, v.value);
    refresh();
  });
}
