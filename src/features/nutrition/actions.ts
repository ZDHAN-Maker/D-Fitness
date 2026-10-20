"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { getProfileAndSettings } from "@/features/profile/queries";
import { todayInTimeZone } from "@/utils/date";
import { addLogItem, afterFoodLogged, deleteLogItem, updateLogItem } from "@/features/nutrition/diary";
import { deleteCustomFood, deleteRecipe, saveCustomFood, saveRecipe, toggleFavorite } from "@/features/nutrition/library";
import {
  customFoodSchema,
  foodRefSchema,
  logFoodSchema,
  recipeSchema,
  updateLogItemSchema,
} from "@/lib/validations/nutrition";
import { z } from "zod";

/** Server Actions are thin: authenticate -> validate (Zod) -> call the service -> revalidate. */
const refresh = () => {
  revalidatePath("/nutrition", "layout");
  revalidatePath("/dashboard");
};

export async function logFoodAction(input: unknown): Promise<ActionResult<{ itemId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const v = logFoodSchema.parse(input);
    const { itemId } = await addLogItem(user.id, v);
    const { profile } = await getProfileAndSettings(user.id);
    await afterFoodLogged(v.date, todayInTimeZone(profile?.timezone ?? "UTC"));
    refresh();
    return { itemId };
  });
}

export async function updateLogItemAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await updateLogItem(user.id, updateLogItemSchema.parse(input));
    refresh();
  });
}

export async function deleteLogItemAction(itemId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteLogItem(z.string().uuid().parse(itemId));
    refresh();
  });
}

export async function saveCustomFoodAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireUser();
    const id = await saveCustomFood(customFoodSchema.parse(input));
    refresh();
    return { id };
  });
}

export async function deleteCustomFoodAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteCustomFood(z.string().uuid().parse(id));
    refresh();
  });
}

export async function saveRecipeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireUser();
    const id = await saveRecipe(recipeSchema.parse(input));
    refresh();
    return { id };
  });
}

export async function deleteRecipeAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteRecipe(z.string().uuid().parse(id));
    refresh();
  });
}

export async function toggleFavoriteAction(ref: unknown): Promise<ActionResult<{ isFavorite: boolean }>> {
  return runAction(async () => {
    const user = await requireUser();
    const result = await toggleFavorite(user.id, foodRefSchema.parse(ref));
    revalidatePath("/nutrition", "layout");
    return result;
  });
}
