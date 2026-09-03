// session.ts — SERVER-ONLY signed session for "Sign in with X → Monkey Town Wallet".
//
// The session holds the X account we VERIFIED at OAuth callback time (handle + numeric id).
// It is a signed, httpOnly, tamper-proof cookie. Every wallet endpoint reads the handle from
// HERE (verified) and NEVER from a request body/query/header. This is the auth boundary the
// Coordinator reviews: one user can only ever resolve their OWN Monkey Town wallet.
//
// Signing: HMAC-SHA256 over the base64url(JSON payload), using SESSION_SECRET. No new deps —
// Node's built-in crypto only. If the signature does not verify, the session is rejected.
//
// House laws honored: no secrets hardcoded (SESSION_SECRET from env), loud failures (a missing
// secret throws — we never silently sign with a weak/empty key), no silent catches.
//
// NOTE: this module is imported ONLY by server-side route handlers. It never reaches the client
// bundle (the wallet page talks to it via fetch). Keeping it dependency-light (Node crypto only).
import crypto from "node:crypto";

export const SESSION_COOKIE = "mt_session";
// 7 days. Short enough to bound a stolen cookie, long enough to feel like a normal login.
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

export type Session = {
  handle: string; // X username, sanitized lowercase, no leading @ (the mt-<handle> key)
  xid: string;    // X numeric user id (stable even if the handle is renamed)
  iat: number;    // issued-at (unix seconds)
};

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Loud failure — never sign/verify with a missing or trivially weak key.
    throw new Error(
      "SESSION_SECRET missing or too short (need >=16 chars). Set it in the environment."
    );
  }
  return Buffer.from(s, "utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payloadB64: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

// Serialize + sign a session into the cookie string "<payload>.<sig>".
export function sealSession(sess: Session): string {
  const payloadB64 = b64url(Buffer.from(JSON.stringify(sess), "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Verify + parse a cookie value. Returns the Session ONLY if the signature checks out and it
// hasn't expired. Any tampering, bad format, or expiry -> null (treated as logged out). Never throws
// for a bad cookie (only for a missing secret, which is a deploy misconfig we DO want loud).
export function openSession(cookieValue: string | undefined | null): Session | null {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);

  const expected = sign(payloadB64);
  // constant-time compare; guard length first (timingSafeEqual throws on length mismatch)
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromB64url(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  const p = parsed as Partial<Session>;
  if (typeof p.handle !== "string" || typeof p.xid !== "string" || typeof p.iat !== "number") {
    return null;
  }
  if (Date.now() / 1000 - p.iat > SESSION_MAX_AGE_SEC) return null; // expired
  return { handle: p.handle, xid: p.xid, iat: p.iat };
}

// Cookie attributes for the session (Set-Cookie). httpOnly (JS can't read it), Secure in prod,
// SameSite=Lax so the OAuth top-level redirect back from X still carries it.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
