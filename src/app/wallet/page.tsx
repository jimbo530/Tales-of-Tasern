"use client";

// /wallet — the Monkey Town Wallet view. After "Sign in with X", the user sees THEIR wallet in a
// familiar "regular wallet" layout: address (copyable), avatar/handle, and a clean token-balance
// list (Gold, Bananas, USDC, MfT, RWI, ETH). Not signed in -> a "Sign in with X" CTA.
//
// This is Phase 1 (LOGIN + VIEW). Actions (buy gold / swap) are Phase 2 — a clean hook is left at
// the bottom (disabled buttons + a comment) but nothing is wired.
//
// Everything sensitive happens server-side: this page only calls our own /api/* endpoints, which
// read the VERIFIED session cookie. The browser never sees CDP creds or a private key.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Token = { symbol: string; label: string; address: string; decimals: number; amount: string; game: boolean };
type Balances = { handle: string; address: string; eth: string; tokens: Token[] };

const C = {
  green: "#3fb950",
  gold: "#d29922",
  panel: "rgba(21,26,33,.82)",
  border: "rgba(55,65,81,.5)",
  sub: "#8b949e",
  text: "#c9d1d9",
  head: "#e6edf3",
};

function trim(amount: string, max = 4): string {
  if (!amount.includes(".")) return Number(amount).toLocaleString();
  const [w, f] = amount.split(".");
  const whole = Number(w).toLocaleString();
  const frac = f.slice(0, max).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

const ERR_MSG: Record<string, string> = {
  denied: "You cancelled the X sign-in.",
  bad_state: "Sign-in expired or was tampered with. Try again.",
  missing_code: "X sign-in didn't complete. Try again.",
  token_exchange: "Couldn't finish sign-in with X. Try again.",
  me_failed: "Couldn't read your X account. Try again.",
  not_configured: "X sign-in isn't set up yet on this deployment.",
};

export default function WalletPage() {
  const [handle, setHandle] = useState<string | null | undefined>(undefined); // undefined = loading
  const [bal, setBal] = useState<Balances | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // surface an ?auth_error=... from the callback redirect
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get("auth_error");
    if (e) {
      setAuthError(ERR_MSG[e] || "Sign-in failed. Try again.");
      window.history.replaceState({}, "", "/wallet");
    }
  }, []);

  // who's logged in?
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { handle: string | null }) => setHandle(d.handle))
      .catch(() => setHandle(null));
  }, []);

  const loadWallet = useCallback(async () => {
    setLoadingBal(true);
    setError(null);
    try {
      const r = await fetch("/api/wallet/balances");
      if (r.status === 401) {
        setHandle(null);
        return;
      }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "failed");
      setBal(await r.json());
    } catch (e) {
      setError("Couldn't load your wallet. Please refresh.");
      console.error(e);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  useEffect(() => {
    if (handle) loadWallet();
  }, [handle, loadWallet]);

  const copy = async () => {
    if (!bal?.address) return;
    await navigator.clipboard.writeText(bal.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setHandle(null);
    setBal(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e11", color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.25rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: C.head }}>
            <span style={{ color: C.green }}>Monkey Town</span> Wallet
          </div>
          <div style={{ fontSize: ".82rem", color: C.sub, marginTop: ".25rem" }}>
            Your in-game wallet on Base. Unrugable by design.
          </div>
        </div>

        {authError && (
          <div style={{ background: "rgba(210,60,60,.12)", border: "1px solid rgba(210,60,60,.4)", color: "#f0a", borderRadius: 10, padding: ".8rem 1rem", marginBottom: "1rem", fontSize: ".85rem" }}>
            {authError}
          </div>
        )}

        {/* Loading auth state */}
        {handle === undefined && <div style={{ textAlign: "center", color: C.sub }}>Loading…</div>}

        {/* Signed OUT */}
        {handle === null && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "2.5rem 1.5rem", textAlign: "center", backdropFilter: "blur(16px)" }}>
            <div style={{ fontSize: "2.4rem", marginBottom: ".5rem" }}>{"\u{1F411}"}</div>
            <div style={{ fontSize: "1.05rem", color: C.head, fontWeight: 600, marginBottom: ".4rem" }}>
              Sign in to see your wallet
            </div>
            <p style={{ fontSize: ".85rem", color: C.sub, maxWidth: 360, margin: "0 auto 1.5rem" }}>
              Your Monkey Town wallet is tied to your X account. Sign in and it's ready — no seed phrase, no extension.
            </p>
            <a href="/api/auth/x/login" style={{ display: "inline-block", background: C.green, color: "#04240c", fontWeight: 700, padding: ".8rem 1.4rem", borderRadius: 10, textDecoration: "none", fontSize: ".95rem" }}>
              Sign in with X · Monkey Town Wallet
            </a>
            <div style={{ marginTop: "1.25rem", fontSize: ".78rem", color: C.sub }}>
              Bringing your own wallet?{" "}
              <Link href="/vaults" style={{ color: C.green }}>Connect Wallet</Link>
            </div>
          </div>
        )}

        {/* Signed IN */}
        {handle && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", backdropFilter: "blur(16px)" }}>
            {/* Identity row */}
            <div style={{ display: "flex", alignItems: "center", gap: ".8rem", marginBottom: "1.25rem" }}>
              <img
                src={`https://unavatar.io/twitter/${handle}`}
                alt={handle}
                width={44}
                height={44}
                style={{ borderRadius: "50%", background: "#222", flexShrink: 0 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: C.head }}>@{handle}</div>
                <button
                  onClick={copy}
                  title="Copy address"
                  style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontFamily: "'SF Mono','Cascadia Code',monospace", fontSize: ".78rem", padding: 0 }}
                >
                  {bal?.address ? shortAddr(bal.address) : "…"} {copied ? "✓ copied" : "⧉"}
                </button>
              </div>
              <button onClick={signOut} style={{ background: "none", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 8, padding: ".35rem .7rem", cursor: "pointer", fontSize: ".78rem" }}>
                Sign out
              </button>
            </div>

            {error && <div style={{ color: "#f0a", fontSize: ".85rem", marginBottom: ".8rem" }}>{error}</div>}

            {/* Balances */}
            <div style={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".12em", color: C.sub, marginBottom: ".6rem" }}>
              Balances
            </div>

            {loadingBal && !bal && <div style={{ color: C.sub, fontSize: ".85rem" }}>Loading balances…</div>}

            {bal && (
              <div style={{ display: "flex", flexDirection: "column", gap: ".1rem" }}>
                <Row label="ETH" sub="Base" amount={trim(bal.eth, 5)} color={C.text} />
                {bal.tokens.map((t) => (
                  <Row
                    key={t.symbol}
                    label={t.label}
                    sub={t.game ? "game credit" : t.symbol}
                    amount={trim(t.amount)}
                    color={t.game ? C.gold : C.text}
                  />
                ))}
              </div>
            )}

            {/* Phase 2 hook — actions (buy gold / swap) are intentionally NOT wired yet. */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: ".6rem" }}>
              <button disabled style={ph2Btn}>Buy Gold</button>
              <button disabled style={ph2Btn}>Swap</button>
            </div>
            <div style={{ fontSize: ".72rem", color: C.sub, marginTop: ".5rem", textAlign: "center" }}>
              Actions coming soon.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ph2Btn: React.CSSProperties = {
  flex: 1,
  background: "rgba(63,185,80,.08)",
  border: "1px solid rgba(63,185,80,.25)",
  color: "#6b7280",
  borderRadius: 10,
  padding: ".7rem",
  fontSize: ".9rem",
  fontWeight: 600,
  cursor: "not-allowed",
};

function Row({ label, sub, amount, color }: { label: string; sub: string; amount: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".7rem 0", borderBottom: "1px solid rgba(55,65,81,.3)" }}>
      <div>
        <div style={{ fontWeight: 600, color: "#e6edf3", fontSize: ".95rem" }}>{label}</div>
        <div style={{ fontSize: ".72rem", color: "#8b949e" }}>{sub}</div>
      </div>
      <div style={{ fontFamily: "'SF Mono','Cascadia Code',monospace", fontSize: ".95rem", color, fontWeight: 600 }}>
        {amount}
      </div>
    </div>
  );
}
