import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireApiUser } from "@/lib/api/guard";
import { searchExercises } from "@/features/workout/exercises";
import { exerciseSearchSchema } from "@/lib/validations/workout";

export const dynamic = "force-dynamic";

/** GET /api/exercises?q=&category=&muscle=&equipment=&difficulty=&movement=&offset=&limit= */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const sp = Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== ""));
    return jsonOk(await searchExercises(exerciseSearchSchema.parse(sp)));
  } catch (err) {
    return jsonError(err);
  }
}
