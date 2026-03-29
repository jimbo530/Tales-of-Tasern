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

  // Navigation
  const [view, setView] = useState<"menu" | "heroes" | "army" | "adventure" | "castleSiege" | "castleAI" | "matchmaking" | "marketplace" | "powerUp" | "1v1">("menu");

  // Cycling background images
  const BG_IMAGES = ["/bg-plains-1.webp", "/bg-plains-2.webp", "/bg-plains-3.webp", "/bg-plains-4.webp", "/bg-desert-1.webp", "/bg-desert-2.webp", "/bg-desert-3.webp", "/bg-desert-4.webp"];
  const [bgIndex, setBgIndex] = useState(0);
  const cycleView = (v: typeof view) => { setBgIndex(i => (i + 1) % BG_IMAGES.length); setView(v); };

  // Battle mode (for 1v1)
  const [battleMode, setBattleMode] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState<NftCharacter[]>([]);
  const [activeBattle, setActiveBattle] = useState<{ fighter1: NftCharacter; fighter2: NftCharacter } | null>(null);

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

  // Sub-page wrapper with consistent header
  const subPage = (subtitle: string, content: React.ReactNode) => (
    <main className="flex flex-col min-h-screen fantasy-bg relative" style={{ isolation: 'isolate' }}>
      <div className="fixed inset-0" style={{
        backgroundImage: `url(${BG_IMAGES[bgIndex]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.12,
        filter: 'blur(2px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />
      <header className="header-fantasy flex items-center justify-between px-6 py-4 relative" style={{ zIndex: 1 }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => cycleView("menu")}>
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>{subtitle}</p>
          </div>
        </div>
        <Wallet>
          <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
          <WalletDropdown><Address /><WalletDropdownDisconnect /></WalletDropdown>
        </Wallet>
      </header>
      <div className="flex-1 px-4 py-6">{content}</div>
    </main>
  );

  if (view === "powerUp") return subPage("Power Up", <PowerUp characters={characters} onBack={() => cycleView("menu")} />);
  if (view === "marketplace") return subPage("Marketplace", <Marketplace characters={characters} onBack={() => cycleView("menu")} />);
  if (view === "adventure") return subPage("Adventure", <AdventureMode characters={characters} onExit={() => cycleView("menu")} />);

  // My Army page
  if (view === "army") {
    const myNfts = characters.filter(c => c.owned);
    const totalCopies = myNfts.reduce((sum, c) => sum + c.ownedCount, 0);
    const baseArmy = myNfts.filter(c => c.chain === "base");
    const polyArmy = myNfts.filter(c => c.chain === "polygon");
    const totalBacking = myNfts.reduce((sum, c) => sum + c.usdBacking * c.ownedCount, 0);

    return subPage("My Army", (
      <div className="flex flex-col items-center gap-6 px-2">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ ← Back ⚜
        </button>

        {/* Army stats banner */}
        <div className="w-full max-w-lg rounded-xl p-5 text-center"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <h2 className="text-xl font-black tracking-widest text-gold-shimmer uppercase mb-3"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            ⚜ My Heroes ⚜
          </h2>
          {myNfts.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(220,38,38,0.7)' }}>Connect wallet to see your army</p>
          ) : (
            <div className="flex justify-center gap-6 flex-wrap">
              <div>
                <p className="text-2xl font-black" style={{ color: '#f0d070' }}>{myNfts.length}</p>
                <p style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.5)' }}>Unique Heroes</p>
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: '#f0d070' }}>{totalCopies}</p>
                <p style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.5)' }}>Total NFTs</p>
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
                  ${totalBacking >= 1000 ? `${(totalBacking / 1000).toFixed(1)}K` : totalBacking.toFixed(2)}
                </p>
                <p style={{ fontSize: '0.5rem', color: 'rgba(74,222,128,0.4)' }}>Total LP Backing</p>
              </div>
              <div className="flex gap-3">
                <div>
                  <p className="text-lg font-black" style={{ color: 'rgba(96,165,250,0.9)' }}>{baseArmy.length}</p>
                  <p style={{ fontSize: '0.5rem', color: 'rgba(96,165,250,0.4)' }}>Base</p>
                </div>
                <div>
                  <p className="text-lg font-black" style={{ color: 'rgba(167,139,250,0.9)' }}>{polyArmy.length}</p>
                  <p style={{ fontSize: '0.5rem', color: 'rgba(167,139,250,0.4)' }}>Polygon</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Army grid */}
        {myNfts.length > 0 && (
          <div className="w-full max-w-2xl">
            {[{ label: "Base Forces", chain: "base" as const, army: baseArmy, color: "rgba(96,165,250" },
              { label: "Polygon Forces", chain: "polygon" as const, army: polyArmy, color: "rgba(167,139,250" }]
              .filter(g => g.army.length > 0)
              .map(group => (
              <div key={group.chain} className="mb-6">
                <h3 className="text-sm font-black tracking-widest uppercase mb-3 text-center"
                  style={{ color: `${group.color},0.8)` }}>
                  ⬡ {group.label} ({group.army.reduce((s, c) => s + c.ownedCount, 0)} NFTs)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.army.map(card => (
                    <div key={card.contractAddress}
                      className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${group.color},0.3)` }}>
                      <div className="relative" style={{ height: 100, background: '#0a0810' }}>
                        {card.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={`/api/images?url=${encodeURIComponent(card.imageUrl)}`} alt={card.name}
                            className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-20">
                            <span className="text-2xl">🛡️</span>
                          </div>
                        )}
                        {card.ownedCount > 1 && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full font-black text-xs"
                            style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0608', fontSize: '0.6rem' }}>
                            x{card.ownedCount}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-black text-xs truncate" style={{ color: 'rgba(232,213,176,0.8)', fontSize: '0.55rem' }}>
                          {card.name}
                        </p>
                        {card.usdBacking > 0 && (
                          <p style={{ color: 'rgba(74,222,128,0.7)', fontSize: '0.45rem' }}>
                            ${(card.usdBacking * card.ownedCount).toFixed(2)} backing
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1" style={{ fontSize: '0.4rem', color: 'rgba(232,213,176,0.4)' }}>
                          {card.stats.attack > 0 && <span>⚔️{card.stats.attack.toFixed(1)}</span>}
                          {card.stats.hp > 0 && <span>❤️{card.stats.hp.toFixed(1)}</span>}
                          {card.stats.def > 0 && <span>🛡️{card.stats.def.toFixed(1)}</span>}
                          {card.stats.mAtk > 0 && <span>⚡{card.stats.mAtk.toFixed(1)}</span>}
                          {card.stats.fAtk > 0 && <span>🔥{card.stats.fAtk.toFixed(1)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  }

  if (view === "castleSiege") return subPage("Castle Siege", (
    <div className="flex flex-col items-center gap-6 mt-12">
      <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
        style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        🏰 Castle Siege 🏰
      </h2>
      <p className="text-sm text-center" style={{ color: 'rgba(201,168,76,0.5)' }}>
        Build your deck. Destroy the enemy fortress.
      </p>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button onClick={() => cycleView("castleAI")}
          className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(201,168,76,0.1)' }}>
          🤖 vs AI — Solo Play
        </button>
        <button onClick={() => cycleView("matchmaking")}
          className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)', boxShadow: '0 0 15px rgba(220,38,38,0.1)' }}>
          🌐 Online — Find Opponent
        </button>
        <button onClick={() => cycleView("menu")}
          className="w-full px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
          ← Back
        </button>
      </div>
    </div>
  ));

  if (view === "matchmaking") return subPage("Online Arena", (
    <Matchmaking
      characters={characters}
      onMatchFound={() => cycleView("castleAI")}
      onBack={() => cycleView("castleSiege")}
    />
  ));

  if (view === "castleAI") return subPage("Card Battle", <CardBattleBoard characters={characters} onExit={() => cycleView("menu")} />);

  // 1v1 Battle view
  if (activeBattle) return subPage("◆ Arena ◆", (
    <div className="px-2 py-4">
      <BattleView fighter1={activeBattle.fighter1} fighter2={activeBattle.fighter2} onExit={exitBattle} />
    </div>
  ));

  // 1v1 mode — hero gallery with battle selection
  if (view === "1v1") {
    battleMode || setBattleMode(true);
    return subPage("◆ 1v1 Arena ◆", (
      <div className="flex flex-col items-center gap-6 px-2">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ ← Back ⚜
        </button>
        <div className="flex items-center justify-center gap-4 px-6 py-3 w-full rounded-lg"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <span className="text-sm tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.8)' }}>
            {selectedFighters.length === 0 && "Select two champions to battle"}
            {selectedFighters.length === 1 && `${selectedFighters[0].name} selected — pick an opponent`}
            {selectedFighters.length === 2 && `${selectedFighters[0].name} vs ${selectedFighters[1].name}`}
          </span>
          {selectedFighters.length === 2 && (
            <button onClick={startBattle}
              className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest animate-pulse"
              style={{ background: 'rgba(220,38,38,0.4)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.6)' }}>
              Fight!
            </button>
          )}
        </div>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search heroes..." className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }} />
        <div className="flex flex-wrap gap-4 justify-center">
          {pageChars.map((char) => {
            const selectedIdx = selectedFighters.findIndex(f => f.contractAddress === char.contractAddress);
            return (
              <CharacterCard key={`${char.contractAddress}-${char.tokenId}`} character={char} maxStats={maxStats}
                selectable={true} selected={selectedIdx >= 0 ? (selectedIdx + 1) as 1 | 2 : null}
                onSelect={() => toggleFighter(char)} />
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
              style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>← Prev</button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className="w-7 h-7 rounded text-xs font-bold"
                  style={i === page ? { background: 'rgba(201,168,76,0.4)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }
                    : { background: 'rgba(201,168,76,0.05)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.15)' }}>{i + 1}</button>
              ))}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
              style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>Next →</button>
          </div>
        )}
      </div>
    ));
  }

  // Heroes gallery page
  if (view === "heroes") {
    return subPage("◆ Champions of the Realm ◆", (
      <div className="flex flex-col items-center gap-6 px-2 relative">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ ← Back ⚜
        </button>

        {/* Asset totals */}
        {(assetTotals.traditional > 0 || assetTotals.game > 0 || assetTotals.impact > 0) && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 flex-wrap rounded-lg"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
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

        {/* Pie chart */}
        {pieCategory && (() => {
          const items = tokenBreakdown.filter(t => t.category === pieCategory).sort((a, b) => b.usd - a.usd);
          const total = items.reduce((s, t) => s + t.usd, 0);
          if (total <= 0 || items.length === 0) return null;
          const catColor = pieCategory === "traditional" ? "rgba(251,191,36" : pieCategory === "game" ? "rgba(167,139,250" : "rgba(74,222,128";
          const catLabel = pieCategory === "traditional" ? "Traditional" : pieCategory === "game" ? "Game Tokens" : "Impact Assets";
          const sliceColors = items.map((_, i) => {
            const h = pieCategory === "traditional" ? 45 : pieCategory === "game" ? 260 : 145;
            return `hsl(${h + i * 17}, ${70 + (i % 2) * 15}%, ${70 - (i / Math.max(items.length, 1)) * 40}%)`;
          });
          let cumAngle = -Math.PI / 2;
          const slices = items.map((item, i) => {
            const angle = (item.usd / total) * Math.PI * 2;
            const sa = cumAngle; cumAngle += angle;
            const x1 = 50 + 45 * Math.cos(sa), y1 = 50 + 45 * Math.sin(sa);
            const x2 = 50 + 45 * Math.cos(cumAngle), y2 = 50 + 45 * Math.sin(cumAngle);
            const d = items.length === 1 ? `M50,50 L${x1},${y1} A45,45 0 1,1 ${x1 - 0.001},${y1} Z`
              : `M50,50 L${x1},${y1} A45,45 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} Z`;
            return <path key={i} d={d} fill={sliceColors[i]} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />;
          });
          return (
            <div className="flex items-center justify-center gap-6 px-4 py-4 flex-wrap rounded-lg"
              style={{ background: `${catColor},0.03)`, border: `1px solid ${catColor},0.2)` }}>
              <svg viewBox="0 0 100 100" width="120" height="120">{slices}</svg>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: `${catColor},0.8)` }}>{catLabel}</span>
                {items.map((item, i) => (
                  <div key={item.symbol} className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: sliceColors[i] }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.symbol}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>${item.usd >= 1000 ? `${(item.usd / 1000).toFixed(1)}K` : item.usd.toFixed(2)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>({((item.usd / total) * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {loading ? (
          <div className="flex flex-col items-center gap-4 mt-12">
            <div className="text-4xl animate-pulse">🔮</div>
            <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>Consulting the Oracle...</p>
          </div>
        ) : (
          <>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search heroes by name or address..." className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }} />
            <p className="text-center text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length} Owned · {sorted.length}{search ? ' matching' : ''} of {characters.length} · Page {page + 1} of {totalPages}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {pageChars.map((char) => (
                <CharacterCard key={`${char.contractAddress}-${char.tokenId}`} character={char} maxStats={maxStats} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>← Prev</button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)} className="w-7 h-7 rounded text-xs font-bold"
                      style={i === page ? { background: 'rgba(201,168,76,0.4)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }
                        : { background: 'rgba(201,168,76,0.05)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.15)' }}>{i + 1}</button>
                  ))}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    ));
  }

  // Main Menu
  const totalLocked = assetTotals.traditional + assetTotals.game + assetTotals.impact;
  return (
    <main className="flex flex-col min-h-screen relative">
      {/* Tavern background */}
      <div className="fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tavern-bg.webp" alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(10,6,8,0.8) 80%)' }} />
      </div>

      <header className="header-fantasy flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>◆ The Realm Awaits ◆</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            const url = window.location.href;
            const text = "Tales of Tasern — NFT card battle game powered by real impact assets on Base";
            if (navigator.share) navigator.share({ title: "Tales of Tasern", text, url });
            else { navigator.clipboard.writeText(`${text}\n${url}`); alert("Link copied!"); }
          }} className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.9)', border: '1px solid rgba(139,92,246,0.4)' }}>
            📤
          </button>
          <Wallet>
            <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
            <WalletDropdown><Address /><WalletDropdownDisconnect /></WalletDropdown>
          </Wallet>
        </div>
      </header>

      {wrongChain && (
        <div className="flex items-center justify-center gap-4 px-6 py-3 text-sm relative z-10"
          style={{ background: 'rgba(139,26,26,0.4)', borderBottom: '1px solid rgba(139,26,26,0.6)' }}>
          <span style={{ color: '#fca5a5' }}>Switch to Base to see your champions</span>
          <button onClick={() => switchChain({ chainId: base.id })}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
            Switch to Base
          </button>
        </div>
      )}

      <div className="flex flex-col items-center flex-1 px-6 py-10 gap-8 relative z-10">
        {/* Locked liquidity summary */}
        {totalLocked > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>
              🔒 ${totalLocked >= 1000 ? `${(totalLocked / 1000).toFixed(1)}K` : totalLocked.toFixed(0)} Forever Locked
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.3)' }}>·</span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.4)' }}>{characters.length} Heroes</span>
          </div>
        )}

        {/* Main menu buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-lg">
          {/* My Heroes */}
          <button onClick={() => cycleView("army")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.3)', boxShadow: '0 0 25px rgba(201,168,76,0.05)' }}>
            <span className="text-4xl">⚔️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: '#f0d070' }}>My Heroes</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length > 0
                ? `${characters.filter(c => c.owned).length} heroes in your army`
                : 'Connect wallet to view your army'}
            </span>
          </button>

          {/* All Heroes */}
          <button onClick={() => cycleView("heroes")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(201,168,76,0.06)', border: '2px solid rgba(201,168,76,0.15)', boxShadow: '0 0 25px rgba(201,168,76,0.03)' }}>
            <span className="text-4xl">🛡️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>Heroes of the Realm</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(201,168,76,0.4)' }}>Browse all {characters.length} champions</span>
          </button>

          {/* Adventure */}
          <button onClick={() => cycleView("adventure")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 25px rgba(34,197,94,0.05)' }}>
            <span className="text-4xl">📖</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(74,222,128,0.9)' }}>Adventure</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(34,197,94,0.5)' }}>6 levels of story-driven combat</span>
          </button>

          {/* Castle Siege */}
          <button onClick={() => cycleView("castleSiege")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(220,38,38,0.1)', border: '2px solid rgba(220,38,38,0.3)', boxShadow: '0 0 25px rgba(220,38,38,0.05)' }}>
            <span className="text-4xl">🏰</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: '#fca5a5' }}>Castle Siege</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(220,38,38,0.5)' }}>Card battle vs AI or online</span>
          </button>

          {/* Marketplace */}
          <button onClick={() => cycleView("marketplace")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)', boxShadow: '0 0 25px rgba(251,191,36,0.05)' }}>
            <span className="text-4xl">🛒</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.9)' }}>Marketplace</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(251,191,36,0.5)' }}>Buy and sell hero NFTs</span>
          </button>

          {/* 1v1 */}
          <button onClick={() => { cycleView("1v1"); setBattleMode(true); setSelectedFighters([]); }}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)', boxShadow: '0 0 25px rgba(139,92,246,0.05)' }}>
            <span className="text-4xl">⚔️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(167,139,250,0.9)' }}>1v1 Arena</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(139,92,246,0.5)' }}>Pick two heroes and watch them fight</span>
          </button>

          {/* Power Up */}
          <button onClick={() => cycleView("powerUp")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(96,165,250,0.1)', border: '2px solid rgba(96,165,250,0.3)', boxShadow: '0 0 25px rgba(96,165,250,0.05)' }}>
            <span className="text-4xl">⬆️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(96,165,250,0.9)' }}>Power Up</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(96,165,250,0.5)' }}>Boost hero stats with ETH</span>
          </button>
        </div>

        {/* Connect prompt */}
        {!isConnected && (
          <div className="flex items-center gap-4 px-5 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <span style={{ color: 'rgba(201,168,76,0.7)' }}>Connect wallet to see your champions</span>
            <Wallet>
              <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
              <WalletDropdown><Address /><WalletDropdownDisconnect /></WalletDropdown>
            </Wallet>
          </div>
        )}

      </div>
    </main>
  );
}
