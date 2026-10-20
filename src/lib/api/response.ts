import { NextResponse } from "next/server";
import { normalizeError } from "@/lib/errors";

/** Consistent JSON envelope for Route Handlers: { data } or { error: { code, message, fields? } }. */
export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonError(err: unknown) {
  const n = normalizeError(err);
  return NextResponse.json(
    { error: { code: n.code, message: n.message, ...(n.fieldErrors ? { fields: n.fieldErrors } : {}) } },
    { status: n.status },
  );
}
