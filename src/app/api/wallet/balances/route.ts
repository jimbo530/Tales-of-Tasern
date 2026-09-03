// GET /api/wallet/balances — the caller's Monkey Town wallet balances (read-only).
//
// SECURITY BOUNDARY: handle comes ONLY from the verified session cookie. No client-supplied
// identity is ever read. Returns ETH + GOLD/NANA/USDC/MfT/RWI for the caller's own wallet only.
import { NextRequest, NextResponse } from "next/server";
import { openSession, SESSION_COOKIE } from "@/lib/session";
import { balancesForHandle } from "@/lib/mt-wallet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sess = openSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!sess) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  try {
    const balances = await balancesForHandle(sess.handle); // sess.handle is X-verified
    return NextResponse.json({ handle: sess.handle, ...balances });
  } catch (e) {
    console.error("wallet/balances failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "balances_unavailable" }, { status: 502 });
  }
}
