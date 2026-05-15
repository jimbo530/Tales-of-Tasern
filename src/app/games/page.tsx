"use client";

import Link from "next/link";

interface GameEntry {
  title: string;
  description: string;
  genre: string;
  href: string;
  ready: boolean;
  color: string;
  icon: string;
  external?: boolean;
}

const games: GameEntry[] = [
  {
    title: "Baselings",
    description: "Hatch eggs, raise creatures, grow your POOP garden. Tamagotchi meets DeFi.",
    genre: "Virtual Pet / DeFi",
    href: "/baselings",
    ready: true,
    color: "#a855f7",
    icon: "🥚",
  },
  {
    title: "Tales of Tasern",
    description: "D20 hex exploration RPG. Fight monsters, loot dungeons, build your party.",
    genre: "RPG / Strategy",
    href: "/tot",
    ready: true,
    color: "#c9a84c",
    icon: "⚔️",
  },
  {
    title: "World of War",
    description: "Strategic kingdoms and armies. Castles, supply lines, conquest.",
    genre: "Strategy / RTS",
    href: "https://tot-world-of-war.vercel.app",
    ready: false,
    color: "#ef4444",
    icon: "🏰",
    external: true,
  },
  {
    title: "Tunnel Bug",
    description: "Dig tunnels, drop rocks, squash bugs. How deep can you go?",
    genre: "Action / Puzzle",
    href: "/games/tunnel-bug.html",
    ready: true,
    color: "#4ecdc4",
    icon: "🪲",
  },
  {
    title: "Jumpy Bros",
    description: "Run, jump, stomp enemies, collect coins. Classic side-scrolling platformer.",
    genre: "Platformer",
    href: "/games/jumpy-bros.html",
    ready: true,
    color: "#ff6b6b",
    icon: "🍄",
  },
  {
    title: "Meme City",
    description: "Pick your meme fighter. Punch, kick, combo, K.O. Best of 3 rounds.",
    genre: "Fighting",
    href: "/games/meme-city.html",
    ready: true,
    color: "#ffd93d",
    icon: "🥊",
  },
  {
    title: "Maze Runner",
    description: "Chomp pellets, dodge ghosts, eat power-ups. Classic maze chase action.",
    genre: "Arcade / Chase",
    href: "/games/maze-runner.html",
    ready: true,
    color: "#ffff00",
    icon: "👻",
  },
  {
    title: "Rodeo Toad",
    description: "Ride the bulls, dodge the bears. A toad's guide to surviving the crypto market.",
    genre: "Arcade / Frogger",
    href: "/games/rodeo-toad.html",
    ready: true,
    color: "#22c55e",
    icon: "🐸",
  },
  {
    title: "Chess",
    description: "Classic chess. Checkmate your opponent on the timeless 8x8 battlefield.",
    genre: "Board / Strategy",
    href: "/games/chess.html",
    ready: true,
    color: "#94a3b8",
    icon: "♟️",
  },
  {
    title: "Checkers",
    description: "Jump, king, and dominate the board. Simple rules, deep strategy.",
    genre: "Board / Strategy",
    href: "/games/checkers.html",
    ready: true,
    color: "#dc2626",
    icon: "⚫",
  },
  {
    title: "Blocks Burg",
    description: "Draw cards, race down the rainbow road. First to the castle wins!",
    genre: "Board / Party",
    href: "/games/blocks-burg.html",
    ready: true,
    color: "#f472b6",
    icon: "🏰",
  },
  {
    title: "Whodunit",
    description: "Clue on chain. Deduce the suspect, weapon, and room. Accusations are final.",
    genre: "Board / Mystery",
    href: "/games/whodunit.html",
    ready: true,
    color: "#7c3aed",
    icon: "🔍",
  },
];

interface ToolEntry {
  title: string;
  description: string;
  href: string;
  ready: boolean;
  color: string;
  icon: string;
}

const tools: ToolEntry[] = [
  {
    title: "Dice Roller",
    description: "D4 to D100. Roll any dice, track history, share results with your party.",
    href: "/games/dice-roller.html",
    ready: true,
    color: "#f59e0b",
    icon: "🎲",
  },
  {
    title: "TTRPG Notepad",
    description: "Notes, character sheets, homebrew rules. Save templates, share with friends.",
    href: "/games/ttrpg-notepad.html",
    ready: true,
    color: "#8b5cf6",
    icon: "📝",
  },
];

export default function GamesPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
      <Link href="/" className="text-xs tracking-widest uppercase opacity-40 hover:opacity-70 transition-opacity">
        ← Home
      </Link>

      <h1
        className="text-3xl sm:text-4xl font-black tracking-widest uppercase"
        style={{ color: "#c9a84c" }}
      >
        Games
      </h1>
      <p className="text-xs tracking-widest uppercase opacity-40">
        Play for impact
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
        {games.map((g) => {
          const Wrapper = g.ready
            ? g.external
              ? ({ children, className, style }: { children: React.ReactNode; className: string; style: React.CSSProperties }) => (
                  <a href={g.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>
                )
              : ({ children, className, style }: { children: React.ReactNode; className: string; style: React.CSSProperties }) => (
                  <Link href={g.href} className={className} style={style}>{children}</Link>
                )
            : ({ children, className, style }: { children: React.ReactNode; className: string; style: React.CSSProperties }) => (
                <div className={className} style={style}>{children}</div>
              );

          return (
            <Wrapper
              key={g.title}
              className={`flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all ${
                g.ready ? "hover:scale-[1.03] cursor-pointer" : "cursor-default"
              }`}
              style={{
                background: g.ready ? `${g.color}15` : "rgba(100,100,100,0.05)",
                border: `2px solid ${g.ready ? `${g.color}50` : "rgba(100,100,100,0.15)"}`,
                opacity: g.ready ? 1 : 0.4,
              }}
            >
              <span className="text-4xl">{g.icon}</span>
              <span
                className="text-sm font-black tracking-widest uppercase"
                style={{ color: g.ready ? g.color : "#666" }}
              >
                {g.title}
              </span>
              <span
                className="text-[0.6rem] tracking-wider uppercase font-bold"
                style={{ color: g.ready ? `${g.color}99` : "#555" }}
              >
                {g.genre}
              </span>
              <span className="text-xs text-center leading-relaxed" style={{ color: g.ready ? "#aaa" : "#555" }}>
                {g.description}
              </span>
              {!g.ready && (
                <span className="text-[0.55rem] tracking-widest uppercase font-bold" style={{ color: "#555" }}>
                  Coming Soon
                </span>
              )}
            </Wrapper>
          );
        })}
      </div>

      {/* TTRPG Tools */}
      <h2
        className="text-xl font-black tracking-widest uppercase mt-4"
        style={{ color: "#8b5cf6" }}
      >
        TTRPG Tools
      </h2>
      <p className="text-xs tracking-widest uppercase opacity-40 -mt-4">
        Dice, notes & homebrew
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {tools.map((t) => {
          const Wrapper = t.ready
            ? ({ children, className, style }: { children: React.ReactNode; className: string; style: React.CSSProperties }) => (
                <Link href={t.href} className={className} style={style}>{children}</Link>
              )
            : ({ children, className, style }: { children: React.ReactNode; className: string; style: React.CSSProperties }) => (
                <div className={className} style={style}>{children}</div>
              );
          return (
            <Wrapper
              key={t.title}
              className={`flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all ${
                t.ready ? "hover:scale-[1.03] cursor-pointer" : "cursor-default"
              }`}
              style={{
                background: t.ready ? `${t.color}15` : "rgba(100,100,100,0.05)",
                border: `2px solid ${t.ready ? `${t.color}50` : "rgba(100,100,100,0.15)"}`,
                opacity: t.ready ? 1 : 0.4,
              }}
            >
              <span className="text-4xl">{t.icon}</span>
              <span
                className="text-sm font-black tracking-widest uppercase"
                style={{ color: t.ready ? t.color : "#666" }}
              >
                {t.title}
              </span>
              <span className="text-xs text-center leading-relaxed" style={{ color: t.ready ? "#aaa" : "#555" }}>
                {t.description}
              </span>
              {!t.ready && (
                <span className="text-[0.55rem] tracking-widest uppercase font-bold" style={{ color: "#555" }}>
                  Coming Soon
                </span>
              )}
            </Wrapper>
          );
        })}
      </div>

      {/* Launchpad link */}
      <Link
        href="/launch"
        className="flex flex-col items-center gap-2 px-8 py-6 rounded-2xl transition-all hover:scale-[1.02] mt-4"
        style={{
          background: "rgba(16,185,129,0.1)",
          border: "2px solid rgba(16,185,129,0.3)",
        }}
      >
        <span className="text-3xl">🚀</span>
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(16,185,129,0.9)" }}>
          Unruggable Launchpad
        </span>
        <span className="text-xs" style={{ color: "rgba(16,185,129,0.5)" }}>
          Launch a token in one click
        </span>
      </Link>
    </div>
  );
}
