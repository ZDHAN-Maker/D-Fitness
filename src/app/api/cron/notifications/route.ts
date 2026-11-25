import { NextResponse, type NextRequest } from "next/server";
import { processBackgroundNotifications } from "@/features/notifications/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/notifications
 * POST /api/cron/notifications
 *
 * Endpoint cron latar belakang untuk mengirimkan push notification & alarm secara otomatis
 * tanpa mengharuskan pengguna membuka aplikasi terlebih dahulu.
 *
 * Dapat dipicu oleh:
 * - Vercel Cron (Authorization: Bearer ${CRON_SECRET})
 * - External cron provider seperti cron-job.org / EasyCron (?key=${CRON_SECRET})
 * - Panggilan API internal / uji coba
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const targetUserId = request.nextUrl.searchParams.get("user_id") || undefined;

  // Bila CRON_SECRET diatur di environment, amankan endpoint
  if (secret) {
    const isBearerValid = authHeader === `Bearer ${secret}`;
    const isQueryValid = queryKey === secret;

    if (!isBearerValid && !isQueryValid) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Token CRON_SECRET tidak valid." },
        { status: 401 }
      );
    }
  }

  try {
    const result = await processBackgroundNotifications(targetUserId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[cron-notifications] Error processing notifications:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
