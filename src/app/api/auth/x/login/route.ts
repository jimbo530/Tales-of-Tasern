// GET /api/auth/x/login — begin "Sign in with X" (OAuth 2.0 Authorization Code + PKCE).
//
// Generates a PKCE code_verifier + a CSRF state, stashes both in short-lived httpOnly cookies,
// and redirects the browser to X's authorize endpoint. The callback verifies state + uses the
// verifier to exchange the code. No secrets in the URL; client secret is used only server-side
// at the token exchange (callback).
//
// Env required (documented for the founder — created on an X OAuth2 app):
//   X_OAUTH_CLIENT_ID      — the app's OAuth2 Client ID
//   X_OAUTH_CALLBACK_URL   — must EXACTLY match a Callback URI registered on the X app
//                            (e.g. http://localhost:3000/api/auth/x/callback for local dev)
import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic"; // never cache an auth redirect

const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
// Scopes: tweet.read + users.read let us read the verified handle/id; offline.access is harmless
// here (we don't refresh) but X requires users.read+tweet.read for /2/users/me.
const SCOPES = "tweet.read users.read";

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET() {
  const clientId = process.env.X_OAUTH_CLIENT_ID;
  const callback = process.env.X_OAUTH_CALLBACK_URL;
  if (!clientId || !callback) {
    return NextResponse.json(
      { error: "X OAuth is not configured (X_OAUTH_CLIENT_ID / X_OAUTH_CALLBACK_URL)." },
      { status: 500 }
    );
  }

  // PKCE: verifier (43-128 chars) + S256 challenge.
  const codeVerifier = b64url(crypto.randomBytes(64));
  const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = b64url(crypto.randomBytes(24)); // CSRF guard, echoed back by X

  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url.toString());
  const secure = process.env.NODE_ENV === "production";
  // 10-minute httpOnly cookies — read once at callback, then cleared.
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("x_pkce", codeVerifier, opts);
  res.cookies.set("x_state", state, opts);
  return res;
}
