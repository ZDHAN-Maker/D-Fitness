"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { measurementSchema, photoMetaSchema, weightSchema } from "@/lib/validations/body";
import { deleteMeasurement, deletePhoto, deleteWeight, registerPhoto, saveMeasurement, saveWeight } from "@/features/body/service";

const uuid = z.string().uuid();
const refresh = () => {
  revalidatePath("/body", "layout");
  revalidatePath("/dashboard");
};

export async function saveWeightAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await saveWeight(user.id, weightSchema.parse(input));
    refresh();
  });
}

export async function deleteWeightAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteWeight(uuid.parse(id));
    refresh();
  });
}

export async function saveMeasurementAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await saveMeasurement(user.id, measurementSchema.parse(input));
    refresh();
  });
}

export async function deleteMeasurementAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteMeasurement(uuid.parse(id));
    refresh();
  });
}

/** Called after the browser has uploaded the resized image to the private bucket. */
export async function registerPhotoAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const id = await registerPhoto(user.id, photoMetaSchema.parse(input));
    refresh();
    return { id };
  });
}

export async function deletePhotoAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deletePhoto(uuid.parse(id));
    refresh();
  });
}
