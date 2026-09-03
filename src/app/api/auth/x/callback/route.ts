// GET /api/auth/x/callback — finish "Sign in with X" (OAuth 2.0 code exchange).
//
// Flow (all server-side):
//   1. Verify the `state` echoed by X matches the httpOnly `x_state` cookie (CSRF guard).
//   2. Exchange `code` + the httpOnly `x_pkce` verifier for an access token (client secret used
//      here ONLY, server-to-server, never exposed to the browser).
//   3. Call GET /2/users/me with that token to read the VERIFIED handle + numeric id from X.
//   4. Seal a signed httpOnly session cookie holding { handle, xid } and redirect to /wallet.
//
// This is the ONLY place a handle enters the system, and it is X-verified. Everything downstream
// (wallet resolution + balances) reads the handle from the sealed session, never from client input.
//
// Env required:
//   X_OAUTH_CLIENT_ID, X_OAUTH_CLIENT_SECRET, X_OAUTH_CALLBACK_URL, SESSION_SECRET
import { NextRequest, NextResponse } from "next/server";
import { sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";

// Redirect back to the wallet page with a short error code the UI can show (no sensitive detail).
function fail(req: NextRequest, code: string) {
  const to = new URL("/wallet", req.url);
  to.searchParams.set("auth_error", code);
  const res = NextResponse.redirect(to);
  // clear the transient PKCE/state cookies regardless
  res.cookies.set("x_pkce", "", { path: "/", maxAge: 0 });
  res.cookies.set("x_state", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.X_OAUTH_CLIENT_ID;
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET;
  const callback = process.env.X_OAUTH_CALLBACK_URL;
  if (!clientId || !clientSecret || !callback) return fail(req, "not_configured");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");
  if (oauthErr) return fail(req, "denied"); // user declined at X
  if (!code || !state) return fail(req, "missing_code");

  // 1) CSRF: state must match the cookie we set at /login.
  const stateCookie = req.cookies.get("x_state")?.value;
  const verifier = req.cookies.get("x_pkce")?.value;
  if (!stateCookie || !verifier || stateCookie !== state) return fail(req, "bad_state");

  // 2) Exchange code -> access token. X requires HTTP Basic auth (clientId:secret) for
  //    confidential clients, plus the PKCE code_verifier.
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callback,
    code_verifier: verifier,
  });

  let accessToken: string;
  try {
    const tokRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: form.toString(),
    });
    if (!tokRes.ok) {
      const detail = await tokRes.text();
      console.error("X token exchange failed:", tokRes.status, detail.slice(0, 300));
      return fail(req, "token_exchange");
    }
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail(req, "token_exchange");
    accessToken = tok.access_token;
  } catch (e) {
    console.error("X token exchange error:", e instanceof Error ? e.message : e);
    return fail(req, "token_exchange");
  }

  // 3) Read the VERIFIED identity from X.
  let handle: string;
  let xid: string;
  try {
    const meRes = await fetch(ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!meRes.ok) {
      const detail = await meRes.text();
      console.error("X /users/me failed:", meRes.status, detail.slice(0, 300));
      return fail(req, "me_failed");
    }
    const me = (await meRes.json()) as { data?: { id?: string; username?: string } };
    if (!me.data?.id || !me.data?.username) return fail(req, "me_failed");
    xid = me.data.id;
    // normalize exactly like the bot's mt-<handle> key: lowercase, no leading @
    handle = me.data.username.trim().toLowerCase().replace(/^@/, "");
    if (!handle) return fail(req, "me_failed");
  } catch (e) {
    console.error("X /users/me error:", e instanceof Error ? e.message : e);
    return fail(req, "me_failed");
  }

  // 4) Seal the session + redirect to the wallet view. Clear the transient PKCE/state cookies.
  const res = NextResponse.redirect(new URL("/wallet", req.url));
  res.cookies.set(SESSION_COOKIE, sealSession({ handle, xid, iat: Math.floor(Date.now() / 1000) }), sessionCookieOptions());
  res.cookies.set("x_pkce", "", { path: "/", maxAge: 0 });
  res.cookies.set("x_state", "", { path: "/", maxAge: 0 });
  return res;
}
