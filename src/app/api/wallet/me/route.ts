// GET /api/wallet/me — resolve the caller's Monkey Town wallet ADDRESS.
//
// SECURITY BOUNDARY: the handle is taken ONLY from the verified session cookie. This route accepts
// NO body/query/header identity. It can therefore only ever return the caller's own wallet.
import { NextRequest, NextResponse } from "next/server";
import { openSession, SESSION_COOKIE } from "@/lib/session";
import { addressForHandle } from "@/lib/mt-wallet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sess = openSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!sess) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  try {
    const address = await addressForHandle(sess.handle); // sess.handle is X-verified
    return NextResponse.json({ handle: sess.handle, address });
  } catch (e) {
    console.error("wallet/me resolve failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "wallet_unavailable" }, { status: 502 });
  }
}
