"use client";

// WalletHeader — the two wallet entry points, shown in the site header/nav.
//
//   1. PRIMARY / SUGGESTED: "Sign in with X · Monkey Town Wallet" — the server-managed game wallet
//      tied to the user's X handle (the mt-<handle> CDP wallet the bot uses). When already signed
//      in, this becomes a compact "@handle · Wallet" chip linking to /wallet.
//   2. SECONDARY: "Connect Wallet" — the existing wagmi / OnchainKit external-wallet path, for
//      people bringing their own wallet.
//
// This renders inside <Providers> (Wagmi + OnchainKit) via the root layout, so ConnectWallet works.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";

export function WalletHeader() {
  const [handle, setHandle] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { handle: string | null }) => alive && setHandle(d.handle))
      .catch(() => alive && setHandle(null));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: ".75rem",
        padding: ".6rem 1rem",
        borderBottom: "1px solid rgba(55,65,81,.5)",
        background: "rgba(11,14,17,.85)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <Link href="/" style={{ fontWeight: 800, color: "#fff", textDecoration: "none", letterSpacing: ".05em" }}>
        <span style={{ color: "#3fb950" }}>M</span>f<span style={{ color: "#3fb950" }}>T</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
        {/* PRIMARY — Monkey Town / Sign in with X */}
        {handle ? (
          <Link
            href="/wallet"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".45rem",
              background: "rgba(63,185,80,.12)",
              border: "1px solid rgba(63,185,80,.4)",
              color: "#3fb950",
              fontWeight: 600,
              padding: ".45rem .8rem",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: ".85rem",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://unavatar.io/twitter/${handle}`}
              alt=""
              width={18}
              height={18}
              style={{ borderRadius: "50%" }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            @{handle} · Wallet
          </Link>
        ) : (
          <a
            href="/api/auth/x/login"
            style={{
              background: "#3fb950",
              color: "#04240c",
              fontWeight: 700,
              padding: ".45rem .85rem",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: ".85rem",
              whiteSpace: "nowrap",
            }}
            title="Sign in with X to open your Monkey Town game wallet"
          >
            Sign in with X · Monkey Town Wallet
          </a>
        )}

        {/* SECONDARY — bring your own wallet */}
        <div style={{ fontSize: ".8rem" }} className="mt-connect-secondary">
          <ConnectWallet className="!bg-transparent !border !border-[rgba(55,65,81,.6)] !text-[#8b949e] !rounded-[10px] !px-3 !py-[6px] !text-[.82rem]">
            <Avatar className="h-5 w-5" />
            <Name />
          </ConnectWallet>
        </div>
      </div>
    </header>
  );
}
