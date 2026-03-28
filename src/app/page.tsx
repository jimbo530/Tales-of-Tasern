"use client";

import { useState, useMemo } from "react";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Avatar, Name, Address } from "@coinbase/onchainkit/identity";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { useNftStats, type NftCharacter } from "@/hooks/useNftStats";
import { CharacterCard } from "@/components/CharacterCard";
import { BattleView } from "@/components/BattleView";
import { CardBattleBoard } from "@/components/CardBattleBoard";
import { Matchmaking } from "@/components/Matchmaking";
import { AdventureMode } from "@/components/AdventureMode";
import { Marketplace } from "@/components/Marketplace";
import { PowerUp } from "@/components/PowerUp";

const PAGE_SIZE = 10;

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { characters, assetTotals, tokenBreakdown, loading, error } = useNftStats();
  const [pieCategory, setPieCategory] = useState<"traditional" | "game" | "impact" | null>(null);
  const wrongChain = isConnected && chainId !== base.id;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  // Battle mode
  const [battleMode, setBattleMode] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState<NftCharacter[]>([]);
  const [activeBattle, setActiveBattle] = useState<{ fighter1: NftCharacter; fighter2: NftCharacter } | null>(null);
  const [cardBattleMode, setCardBattleMode] = useState(false);
  const [matchmakingMode, setMatchmakingMode] = useState(false);
  const [castleSiegeMenu, setCastleSiegeMenu] = useState(false);
  const [adventureMode, setAdventureMode] = useState(false);
  const [marketplaceMode, setMarketplaceMode] = useState(false);
  const [powerUpMode, setPowerUpMode] = useState(false);

  const totalStats = (c: NftCharacter) => {
    const s = c.stats;
    return s.attack + s.mAtk + s.fAtk + s.def + s.mDef + s.hp + s.mana +
      s.charMultiplier * 100 + s.magicMultiplier * 100;
  };
  const filtered = search.trim()
    ? characters.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contractAddress.toLowerCase().includes(search.toLowerCase()))
    : characters;
  const sorted = [...filtered].sort((a, b) => {
    const ownDiff = (b.owned ? 1 : 0) - (a.owned ? 1 : 0);
    if (ownDiff !== 0) return ownDiff;
    return totalStats(a) - totalStats(b);
  });
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageChars = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const maxStats = useMemo(() => ({
    attack: Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * c.stats.attack), 1),
    mAtk:   Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * (1 + c.stats.magicMultiplier) * c.stats.mAtk), 1),
    fAtk:   Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * c.stats.fAtk), 1),
    def:    Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * c.stats.def), 1),
    mDef:   Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * (1 + c.stats.magicMultiplier) * c.stats.mDef), 1),
    hp:     Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * c.stats.hp), 1),
    mana:   Math.max(...characters.map(c => (1 + c.stats.charMultiplier) * c.stats.mana), 1),
  }), [characters]);

  function toggleFighter(char: NftCharacter) {
    setSelectedFighters((prev) => {
      const idx = prev.findIndex(f => f.contractAddress === char.contractAddress);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= 2) return prev;
      return [...prev, char];
    });
  }

  function startBattle() {
    if (selectedFighters.length === 2) {
      setActiveBattle({ fighter1: selectedFighters[0], fighter2: selectedFighters[1] });
    }
  }

  function exitBattle() {
    setActiveBattle(null);
    setBattleMode(false);
    setSelectedFighters([]);
  }

  // Power Up
  if (powerUpMode) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Power Up</p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6">
          <PowerUp characters={characters} onBack={() => setPowerUpMode(false)} />
        </div>
      </main>
    );
  }

  // Marketplace
  if (marketplaceMode) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Marketplace</p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6">
          <Marketplace characters={characters} onBack={() => setMarketplaceMode(false)} />
        </div>
      </main>
    );
  }

  // Adventure mode
  if (adventureMode) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Adventure</p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6">
          <AdventureMode characters={characters} onExit={() => setAdventureMode(false)} />
        </div>
      </main>
    );
  }

  // Castle Siege menu
  if (castleSiegeMenu) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Castle Siege</p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center gap-6 mt-16 px-4">
          <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            🏰 Castle Siege 🏰
          </h2>
          <p className="text-sm text-center" style={{ color: 'rgba(201,168,76,0.5)' }}>
            Build your deck. Destroy the enemy fortress.
          </p>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button onClick={() => { setCastleSiegeMenu(false); setCardBattleMode(true); }}
              className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest"
              style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(201,168,76,0.1)' }}>
              🤖 vs AI — Solo Play
            </button>
            <button onClick={() => { setCastleSiegeMenu(false); setMatchmakingMode(true); }}
              className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest"
              style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)', boxShadow: '0 0 15px rgba(220,38,38,0.1)' }}>
              🌐 Online — Find Opponent
            </button>
            <button onClick={() => setCastleSiegeMenu(false)}
              className="w-full px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
              ← Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Online matchmaking
  if (matchmakingMode) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Online Arena</p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6">
          <Matchmaking
            characters={characters}
            onMatchFound={(lobby, myDeck, opponentDeck, isHost) => {
              setMatchmakingMode(false);
              setCardBattleMode(true);
            }}
            onBack={() => setMatchmakingMode(false)}
          />
        </div>
      </main>
    );
  }

  // Card battle mode
  if (cardBattleMode) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>Card Battle</p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-6">
          <CardBattleBoard characters={characters} onExit={() => setCardBattleMode(false)} />
        </div>
      </main>
    );
  }

  // 1v1 Battle view
  if (activeBattle) {
    return (
      <main className="flex flex-col min-h-screen fantasy-bg">
        <header className="header-fantasy flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">
                Tales of Tasern
              </h1>
              <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
                ◆ Arena ◆
              </p>
            </div>
          </div>
        </header>
        <div className="flex-1 px-6 py-8">
          <BattleView fighter1={activeBattle.fighter1} fighter2={activeBattle.fighter2} onExit={exitBattle} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen fantasy-bg">
      {/* Header */}
      <header className="header-fantasy flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">
              Tales of Tasern
            </h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              ◆ Champions of the Realm ◆
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!battleMode ? (
            <>
              <button
                onClick={() => {
                  const url = window.location.href;
                  const text = "Tales of Tasern — NFT card battle game powered by real impact assets on Base ⚔️🏰";
                  if (navigator.share) {
                    navigator.share({ title: "Tales of Tasern", text, url });
                  } else {
                    navigator.clipboard.writeText(`${text}\n${url}`);
                    alert("Link copied!");
                  }
                }}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.9)', border: '1px solid rgba(139,92,246,0.4)' }}>
                📤 Share
              </button>
              <button
                onClick={() => setPowerUpMode(true)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.9)', border: '1px solid rgba(139,92,246,0.4)' }}>
                ⬆️ Power Up
              </button>
              <button
                onClick={() => setMarketplaceMode(true)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(251,191,36,0.2)', color: 'rgba(251,191,36,0.9)', border: '1px solid rgba(251,191,36,0.4)' }}>
                🛒 Shop
              </button>
              <button
                onClick={() => setAdventureMode(true)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(34,197,94,0.2)', color: 'rgba(74,222,128,0.9)', border: '1px solid rgba(34,197,94,0.4)' }}>
                📖 Adventure
              </button>
              <button
                onClick={() => setCastleSiegeMenu(true)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                🏰 Castle Siege
              </button>
              <button
                onClick={() => { setBattleMode(true); setSelectedFighters([]); }}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                ⚔️ 1v1
              </button>
            </>
          ) : (
            <button
              onClick={() => { setBattleMode(false); setSelectedFighters([]); }}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.15)' }}>
              Cancel
            </button>
          )}
          <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Address />
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
        </div>
      </header>

      {/* Battle selection bar */}
      {battleMode && (
        <div className="flex items-center justify-center gap-4 px-6 py-3"
          style={{ background: 'rgba(220,38,38,0.1)', borderBottom: '1px solid rgba(220,38,38,0.3)' }}>
          <span className="text-sm tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.8)' }}>
            {selectedFighters.length === 0 && "Select two champions to battle"}
            {selectedFighters.length === 1 && `${selectedFighters[0].name} selected — pick an opponent`}
            {selectedFighters.length === 2 && `${selectedFighters[0].name} vs ${selectedFighters[1].name}`}
          </span>
          {selectedFighters.length === 2 && (
            <button onClick={startBattle}
              className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest animate-pulse"
              style={{ background: 'rgba(220,38,38,0.4)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.6)', boxShadow: '0 0 15px rgba(220,38,38,0.2)' }}>
              Fight!
            </button>
          )}
        </div>
      )}

      {/* Asset totals */}
      {(assetTotals.traditional > 0 || assetTotals.game > 0 || assetTotals.impact > 0) && (
        <div className="flex items-center justify-center gap-4 px-6 py-2 flex-wrap"
          style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>🔒 Forever Locked Liquidity</span>
          <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "traditional" ? null : "traditional")}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(251,191,36,0.6)' }}>💰</span>
            <span className="text-xs font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>
              ${assetTotals.traditional >= 1000 ? `${(assetTotals.traditional / 1000).toFixed(1)}K` : assetTotals.traditional.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(251,191,36,0.4)' }}>Traditional</span>
          </button>
          <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "game" ? null : "game")}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.6)' }}>🎮</span>
            <span className="text-xs font-bold" style={{ color: 'rgba(167,139,250,0.8)' }}>
              ${assetTotals.game >= 1000 ? `${(assetTotals.game / 1000).toFixed(1)}K` : assetTotals.game.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(167,139,250,0.4)' }}>Game Tokens</span>
          </button>
          <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "impact" ? null : "impact")}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(74,222,128,0.6)' }}>🌱</span>
            <span className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>
              ${assetTotals.impact >= 1000 ? `${(assetTotals.impact / 1000).toFixed(1)}K` : assetTotals.impact.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(74,222,128,0.4)' }}>Impact Assets</span>
          </button>
        </div>
      )}

      {/* Pie chart breakdown */}
      {pieCategory && (() => {
        const items = tokenBreakdown
          .filter(t => t.category === pieCategory)
          .sort((a, b) => b.usd - a.usd);
        const total = items.reduce((s, t) => s + t.usd, 0);
        if (total <= 0 || items.length === 0) return null;
        const catColor = pieCategory === "traditional" ? "rgba(251,191,36" : pieCategory === "game" ? "rgba(167,139,250" : "rgba(74,222,128";
        const catLabel = pieCategory === "traditional" ? "Traditional" : pieCategory === "game" ? "Game Tokens" : "Impact Assets";
        const sliceColors = items.map((_, i) => {
          const h = pieCategory === "traditional" ? 45 : pieCategory === "game" ? 260 : 145;
          const l = 70 - (i / Math.max(items.length, 1)) * 40;
          const s = 70 + (i % 2) * 15;
          return `hsl(${h + i * 17}, ${s}%, ${l}%)`;
        });
        // Build SVG pie slices
        let cumAngle = -Math.PI / 2;
        const slices = items.map((item, i) => {
          const angle = (item.usd / total) * Math.PI * 2;
          const startAngle = cumAngle;
          cumAngle += angle;
          const endAngle = cumAngle;
          const largeArc = angle > Math.PI ? 1 : 0;
          const x1 = 50 + 45 * Math.cos(startAngle);
          const y1 = 50 + 45 * Math.sin(startAngle);
          const x2 = 50 + 45 * Math.cos(endAngle);
          const y2 = 50 + 45 * Math.sin(endAngle);
          const d = items.length === 1
            ? `M50,50 L${x1},${y1} A45,45 0 1,1 ${x1 - 0.001},${y1} Z`
            : `M50,50 L${x1},${y1} A45,45 0 ${largeArc},1 ${x2},${y2} Z`;
          return <path key={i} d={d} fill={sliceColors[i]} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />;
        });
        return (
          <div className="flex items-center justify-center gap-6 px-6 py-4 flex-wrap"
            style={{ borderBottom: `1px solid ${catColor},0.2)`, background: `${catColor},0.03)` }}>
            <svg viewBox="0 0 100 100" width="120" height="120">{slices}</svg>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: `${catColor},0.8)` }}>{catLabel}</span>
              {items.map((item, i) => (
                <div key={item.symbol} className="flex items-center gap-2 text-xs">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: sliceColors[i] }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.symbol}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                    ${item.usd >= 1000 ? `${(item.usd / 1000).toFixed(1)}K` : item.usd.toFixed(2)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>({((item.usd / total) * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Wrong network banner */}
      {wrongChain && (
        <div className="flex items-center justify-center gap-4 px-6 py-3 text-sm"
          style={{ background: 'rgba(139,26,26,0.4)', borderBottom: '1px solid rgba(139,26,26,0.6)' }}>
          <span style={{ color: '#fca5a5' }}>Switch to Base to see your champions</span>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
            Switch to Base
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col items-center flex-1 px-6 py-12">
        {loading ? (
          <div className="flex flex-col items-center gap-4 mt-24">
            <div className="text-4xl animate-pulse">🔮</div>
            <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>
              Consulting the Oracle...
            </p>
          </div>
        ) : error ? (
          <div className="mt-24 text-center">
            <div className="text-4xl mb-3">💀</div>
            <p className="font-bold tracking-wide uppercase" style={{ color: '#8b1a1a' }}>The Realm is Shrouded</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(232,213,176,0.4)' }}>{error}</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8">
            {/* Connect prompt */}
            {!isConnected && (
              <div className="flex items-center gap-4 px-5 py-3 rounded-lg text-sm"
                style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <span style={{ color: 'rgba(201,168,76,0.7)' }}>Connect wallet to see which champions you own</span>
                <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Address />
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
              </div>
            )}

            {/* Search */}
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search heroes by name or address..."
              className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }}
            />

            {/* Count + page info */}
            <p className="text-center text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length} Owned · {sorted.length}{search ? ` matching` : ''} of {characters.length} · Page {page + 1} of {totalPages}
              {'\n'}Tap a card to flip it and see the real tokens inside
            </p>

            {/* Cards */}
            <div className="flex flex-wrap gap-4 justify-center">
              {pageChars.map((char) => {
                const selectedIdx = selectedFighters.findIndex(f => f.contractAddress === char.contractAddress);
                return (
                  <CharacterCard
                    key={`${char.contractAddress}-${char.tokenId}`}
                    character={char}
                    maxStats={maxStats}
                    selectable={battleMode}
                    selected={selectedIdx >= 0 ? (selectedIdx + 1) as 1 | 2 : null}
                    onSelect={() => toggleFighter(char)}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30 transition-opacity"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  ← Prev
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className="w-7 h-7 rounded text-xs font-bold transition-all"
                      style={i === page
                        ? { background: 'rgba(201,168,76,0.4)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }
                        : { background: 'rgba(201,168,76,0.05)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.15)' }}>
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30 transition-opacity"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
