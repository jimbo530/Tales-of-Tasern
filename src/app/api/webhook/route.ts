import { NextResponse } from "next/server";

/**
 * POST /api/webhook
 *
 * Receives mini app notification proxy requests from MiniKitProvider.
 * Farcaster sends notification payloads here when triggered via
 * the useNotification hook.
 *
 * TODO:
 *  - Validate the incoming request body
 *  - Forward notification to the Farcaster notification service
 *  - Store notification details in Supabase if needed
 */
export async function POST(request: Request) {
  // TODO: implement notification forwarding
  const body = await request.json().catch(() => ({}));

  return NextResponse.json(
    { ok: true, message: "webhook stub -- not yet implemented", received: body },
    { status: 200 }
  );
}
