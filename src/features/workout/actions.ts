"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { addExerciseSchema, completeWorkoutSchema, planSchema, setPatchSchema, startWorkoutSchema } from "@/lib/validations/workout";
import { deletePlan, savePlan } from "@/features/workout/plans";
import { addExerciseToSession, addSet, getPreviousPerformance, cancelWorkout, completeWorkout, deleteSession, deleteSet, removeSessionExercise, startWorkout, updateSet, type CompletionResult } from "@/features/workout/sessions";
import type { PreviousPerformance, SessionExerciseView, SetView } from "@/features/workout/types";

const uuid = z.string().uuid();
const refresh = () => {
  revalidatePath("/workout", "layout");
  revalidatePath("/dashboard");
};

export async function savePlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireUser();
    const id = await savePlan(planSchema.parse(input));
    refresh();
    return { id };
  });
}

export async function deletePlanAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deletePlan(uuid.parse(id));
    refresh();
  });
}

export async function startWorkoutAction(input: unknown): Promise<ActionResult<{ sessionId: string }>> {
  return runAction(async () => {
    await requireUser();
    const sessionId = await startWorkout(startWorkoutSchema.parse(input));
    refresh();
    return { sessionId };
  });
}

// Set-level actions deliberately do NOT revalidate: the active screen owns its state while training.

export async function addExerciseAction(input: unknown): Promise<ActionResult<SessionExerciseView>> {
  return runAction(async () => {
    await requireUser();
    const v = addExerciseSchema.parse(input);
    return addExerciseToSession(v.sessionId, v.exerciseId);
  });
}

export async function removeExerciseAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await removeSessionExercise(uuid.parse(id));
  });
}

export async function addSetAction(sessionExerciseId: unknown): Promise<ActionResult<SetView>> {
  return runAction(async () => {
    await requireUser();
    return addSet(uuid.parse(sessionExerciseId));
  });
}

export async function saveSetAction(input: unknown): Promise<ActionResult<SetView>> {
  return runAction(async () => {
    await requireUser();
    return updateSet(setPatchSchema.parse(input));
  });
}

export async function deleteSetAction(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteSet(uuid.parse(id));
  });
}

export async function completeWorkoutAction(input: unknown): Promise<ActionResult<CompletionResult>> {
  return runAction(async () => {
    await requireUser();
    const v = completeWorkoutSchema.parse(input);
    const result = await completeWorkout(v.sessionId, v.effort, v.notes);
    refresh();
    revalidatePath("/achievements");
    return result;
  });
}

export async function cancelWorkoutAction(sessionId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await cancelWorkout(uuid.parse(sessionId));
    refresh();
  });
}

export async function deleteSessionAction(sessionId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    await deleteSession(uuid.parse(sessionId));
    refresh();
  });
}

/** Previous-session sets for an exercise added mid-workout. */
export async function previousPerformanceAction(exerciseId: unknown): Promise<ActionResult<PreviousPerformance | null>> {
  return runAction(async () => {
    await requireUser();
    const id = z.number().int().positive().parse(exerciseId);
    return (await getPreviousPerformance([id]))[id] ?? null;
  });
}
