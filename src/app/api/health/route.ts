import { jsonOk } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/** Liveness probe for deployment checks. Exposes no configuration or secrets. */
export function GET() {
  return jsonOk({ status: "ok", time: new Date().toISOString() });
}
