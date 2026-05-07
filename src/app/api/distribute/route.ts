import { NextResponse } from "next/server";

/**
 * GET /api/distribute
 *
 * POOP distribution keeper cron.
 * Called on a schedule (Vercel Cron or external) to distribute
 * pending POOP rewards to baseling owners.
 *
 * TODO:
 *  - Query Supabase for baselings with pending POOP to claim
 *  - Calculate accrued POOP per baseling based on last distribution
 *  - Batch-mint or mark claimable in DB
 *  - Respect the ~4hr block delay before minted POOP is claimable
 */
export async function GET() {
  // TODO: implement POOP distribution logic
  return NextResponse.json(
    { ok: true, message: "distribute cron stub -- not yet implemented" },
    { status: 200 }
  );
}
