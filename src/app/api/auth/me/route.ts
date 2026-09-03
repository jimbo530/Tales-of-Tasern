// GET /api/auth/me — who is logged in? Returns { handle } from the VERIFIED session cookie, or
// { handle: null } if not logged in. Used by the header/wallet UI to decide what to render.
// Reads ONLY the signed cookie — never any client-supplied identity.
import { NextRequest, NextResponse } from "next/server";
import { openSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sess = openSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!sess) return NextResponse.json({ handle: null });
  return NextResponse.json({ handle: sess.handle });
}
