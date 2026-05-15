"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ── data ── */
const ecosystem = [
  { name: "Baselings", href: "/baselings", icon: "\u{1F95A}", desc: "Raise creatures, feed them LP, grow gardens, earn yield. Pet game meets DeFi.", live: true },
  { name: "Burn Stats", href: "/mft/", icon: "\u{1F525}", desc: "Live on-chain tracker. Every token burned by reactors, verified on Basescan.", live: true },
  { name: "Unruggable Launchpad", href: "/launch", icon: "\u{1F344}", desc: "Launch tokens with locked liquidity and autonomous reactors. Unruggable by design.", live: true },
  { name: "Token Index", href: "/tokens/", icon: "\u{1FA99}", desc: "All game and impact tokens across Base and Polygon. Addresses and on-chain links.", live: true },
  { name: "Impact", href: "/impact/", icon: "\u{1F333}", desc: "Token burns fund environmental partners. CHAR, TreeGens, and community donations.", live: true },
  { name: "Arcade", href: "/games", icon: "\u{1F3AE}", desc: "Puzzle battles, RPGs, card games, board games. 12 games and TTRPG tools.", live: true },
];

/* ── styles (inline to match dark theme) ── */
const s = {
  page: { margin: 0, minHeight: "100vh", background: "#0b0e11", color: "#c9d1d9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", lineHeight: 1.6 } as React.CSSProperties,
  bgImg: { position: "fixed" as const, inset: 0, zIndex: -2, backgroundImage: "url(/mft/bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" },
  bgOverlay: { position: "fixed" as const, inset: 0, zIndex: -1, background: "linear-gradient(180deg,rgba(5,10,5,.7) 0%,rgba(8,14,8,.88) 50%,rgba(5,10,5,.95) 100%)" },
  wrap: { maxWidth: 960, margin: "0 auto", padding: "0 1.5rem", position: "relative" as const, zIndex: 1 },
  hero: { textAlign: "center" as const, padding: "4rem 0 3rem" },
  logo: { fontSize: "5rem", fontWeight: 800, color: "#fff", letterSpacing: ".1em", marginBottom: ".2rem", textShadow: "0 0 60px rgba(63,185,80,.25),0 2px 12px rgba(0,0,0,.6)" },
  logoGreen: { color: "#3fb950" },
  tagline: { fontSize: "1.15rem", color: "#3fb950", fontWeight: 500, marginBottom: ".6rem", textShadow: "0 1px 6px rgba(0,0,0,.5)" },
  pitch: { fontSize: ".92rem", color: "#8b949e", maxWidth: 540, margin: "0 auto 2rem" },
  sectionTitle: { fontSize: ".72rem", textTransform: "uppercase" as const, letterSpacing: ".15em", color: "#8b949e", textAlign: "center" as const, marginBottom: "1.2rem" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "3rem" } as React.CSSProperties,
  statCard: { background: "rgba(21,26,33,.82)", border: "1px solid rgba(55,65,81,.5)", borderRadius: 12, backdropFilter: "blur(16px)", padding: "1.2rem", textAlign: "center" as const },
  statVal: { fontFamily: "'SF Mono','Cascadia Code','Fira Code',monospace", fontSize: "1.6rem", fontWeight: 700 },
  statLabel: { fontSize: ".68rem", textTransform: "uppercase" as const, letterSpacing: ".1em", color: "#8b949e", marginTop: ".3rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.2rem", marginBottom: "3rem" } as React.CSSProperties,
  card: { background: "rgba(21,26,33,.82)", border: "1px solid rgba(55,65,81,.5)", borderRadius: 14, backdropFilter: "blur(16px)", padding: "2rem 1.4rem", textDecoration: "none", color: "#c9d1d9", display: "block", transition: "border-color .2s,transform .15s,box-shadow .2s" } as React.CSSProperties,
  cardIcon: { fontSize: "2.4rem", marginBottom: ".6rem" },
  cardName: { fontSize: "1.15rem", fontWeight: 700, color: "#e6edf3", marginBottom: ".3rem" },
  cardDesc: { fontSize: ".82rem", color: "#8b949e", lineHeight: 1.5 },
  badge: { display: "inline-block", fontSize: ".6rem", padding: ".15rem .5rem", borderRadius: 99, marginTop: ".5rem", fontWeight: 600, letterSpacing: ".03em", background: "rgba(63,185,80,.15)", color: "#3fb950" },
  how: { background: "rgba(21,26,33,.82)", border: "1px solid rgba(55,65,81,.5)", borderRadius: 14, backdropFilter: "blur(16px)", padding: "2rem", marginBottom: "3rem" },
  howTitle: { fontSize: "1.1rem", color: "#e6edf3", marginBottom: "1.2rem", textAlign: "center" as const },
  steps: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.5rem" } as React.CSSProperties,
  stepNum: { fontFamily: "'SF Mono','Cascadia Code','Fira Code',monospace", fontSize: "2rem", fontWeight: 700, color: "#3fb950", marginBottom: ".3rem" },
  stepTitle: { fontSize: ".9rem", fontWeight: 600, color: "#e6edf3", marginBottom: ".3rem" },
  stepDesc: { fontSize: ".8rem", color: "#8b949e", lineHeight: 1.5 },
  agentCta: { textAlign: "center" as const, marginBottom: "3rem", padding: "2rem", background: "rgba(21,26,33,.82)", border: "1px solid rgba(55,65,81,.5)", borderRadius: 14, backdropFilter: "blur(16px)" },
  agentTitle: { fontSize: "1.1rem", color: "#e6edf3", marginBottom: ".5rem" },
  agentDesc: { fontSize: ".85rem", color: "#8b949e", marginBottom: "1rem", maxWidth: 500, marginLeft: "auto", marginRight: "auto" },
  agentCode: { fontFamily: "'SF Mono','Cascadia Code','Fira Code',monospace", fontSize: ".82rem", background: "rgba(63,185,80,.1)", color: "#3fb950", padding: ".3rem .8rem", borderRadius: 6, display: "inline-block" },
  footer: { textAlign: "center" as const, padding: "2rem 0 3rem", borderTop: "1px solid rgba(55,65,81,.5)" },
  footLink: { color: "#3fb950", textDecoration: "none", fontSize: ".82rem", margin: "0 .6rem" },
  footLegal: { color: "#8b949e", textDecoration: "none", fontSize: ".72rem", margin: "0 .5rem" },
  footChain: { fontSize: ".72rem", color: "#8b949e", marginTop: ".6rem" },
};

function formatBig(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
}

export default function LandingPage() {
  const [reactorCount, setReactorCount] = useState("21");
  const [tokensBurned, setTokensBurned] = useState("\u2014");
  const [totalValue, setTotalValue] = useState("\u2014");

  useEffect(() => {
    fetch("/mft/data.json")
      .then((r) => r.json())
      .then((d) => {
        const mft = d.tokens?.find((t: { sym: string }) => t.sym === "MfT");
        if (mft?.formatted > 0) setTokensBurned(formatBig(mft.formatted));
        if (d.totalBurnedUSD) {
          const v = d.totalBurnedUSD;
          setTotalValue(v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : v >= 0.01 ? "$" + v.toFixed(2) : "<$0.01");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <div style={s.bgImg} />
      <div style={s.bgOverlay} />
      <div style={s.wrap}>
        {/* Hero */}
        <div style={s.hero}>
          <div style={s.logo}>
            <span style={s.logoGreen}>M</span>f<span style={s.logoGreen}>T</span>
          </div>
          <div style={s.tagline}>meme for trees</div>
          <p style={s.pitch}>
            Deflationary tokens and impact games on Base. Autonomous reactors burn tokens permanently. Verify everything on-chain.
          </p>
        </div>

        {/* Live Stats */}
        <div className="landing-stats" style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: "#d29922" }}>{reactorCount}</div>
            <div style={s.statLabel}>Active Reactors</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: "#3fb950" }}>{tokensBurned}</div>
            <div style={s.statLabel}>MfT Burned</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: "#d29922" }}>{totalValue}</div>
            <div style={s.statLabel}>Value Burned</div>
          </div>
        </div>

        {/* Ecosystem */}
        <div style={s.sectionTitle}>Ecosystem</div>
        <div className="landing-grid" style={s.grid}>
          {ecosystem.map((p) => (
            <Link key={p.name} href={p.href} style={s.card}>
              <div style={s.cardIcon}>{p.icon}</div>
              <div style={s.cardName}>{p.name}</div>
              <div style={s.cardDesc}>{p.desc}</div>
              {p.live && <span style={s.badge}>Live</span>}
            </Link>
          ))}
        </div>

        {/* How Reactors Work */}
        <div style={s.how}>
          <h2 style={s.howTitle}>How Reactors Work</h2>
          <div className="landing-steps" style={s.steps}>
            <div>
              <div style={s.stepNum}>1</div>
              <div style={s.stepTitle}>Trade Anywhere</div>
              <div style={s.stepDesc}>Every swap through reactor pools generates fees. Normal trading, no special actions needed.</div>
            </div>
            <div>
              <div style={s.stepNum}>2</div>
              <div style={s.stepTitle}>Reactors Fire</div>
              <div style={s.stepDesc}>Every 2 hours, autonomous keepers call execute(). Fees are collected and tokens are burned permanently.</div>
            </div>
            <div>
              <div style={s.stepNum}>3</div>
              <div style={s.stepTitle}>Burn Forever</div>
              <div style={s.stepDesc}>Burned tokens go to an address with no private key. Gone forever. Verifiable on-chain.</div>
            </div>
          </div>
        </div>

        {/* Agent CTA */}
        <div style={s.agentCta}>
          <h2 style={s.agentTitle}>Built for AI Agents</h2>
          <p style={s.agentDesc}>
            35 MCP tools, REST API, and an agent SDK. Your agent can launch tokens, fire reactors, and interact with games programmatically.
          </p>
          <code style={s.agentCode}>npx baselings-mcp</code>
        </div>

        {/* Footer */}
        <footer style={s.footer}>
          <div style={{ marginBottom: ".8rem" }}>
            <a href="https://warpcast.com/jamesmagee" target="_blank" rel="noopener" style={s.footLink}>Farcaster</a>
            <a href="https://basescan.org/address/0xfd780B0aE569e15e514B819ecFDF46f804953a4B" target="_blank" rel="noopener" style={s.footLink}>Burn Address</a>
            <Link href="/llms.txt" style={s.footLink}>llms.txt</Link>
            <Link href="/mft/" style={s.footLink}>Burn Leaderboard</Link>
            <Link href="/earth/" style={s.footLink}>EARTH</Link>
            <Link href="/poop/" style={s.footLink}>POOP</Link>
          </div>
          <div style={{ marginBottom: ".8rem" }}>
            <Link href="/terms.html" style={s.footLegal}>Terms</Link>
            <Link href="/privacy.html" style={s.footLegal}>Privacy</Link>
            <Link href="/risk.html" style={s.footLegal}>Risk</Link>
          </div>
          <div style={s.footChain}>Base (8453) · Polygon (137) · Unruggable by code, not by promise</div>
        </footer>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media(max-width:700px) {
          .landing-stats { grid-template-columns: 1fr !important; }
          .landing-grid { grid-template-columns: 1fr !important; }
          .landing-steps { grid-template-columns: 1fr !important; }
        }
        @media(min-width:701px) and (max-width:900px) {
          .landing-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  );
}
