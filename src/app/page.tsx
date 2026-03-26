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

const PAGE_SIZE = 10;

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { characters, loading, error } = useNftStats();
  const wrongChain = isConnected && chainId !== base.id;
  const [page, setPage] = useState(0);

  // Battle mode
  const [battleMode, setBattleMode] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState<NftCharacter[]>([]);
  const [activeBattle, setActiveBattle] = useState<{ fighter1: NftCharacter; fighter2: NftCharacter } | null>(null);
  const [cardBattleMode, setCardBattleMode] = useState(false);

  const sorted = [...characters].sort((a, b) => (b.owned ? 1 : 0) - (a.owned ? 1 : 0));
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
                onClick={() => setCardBattleMode(true)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                🃏 Card Battle
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

            {/* Count + page info */}
            <p className="text-center text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length} Owned · {characters.length} Total · Page {page + 1} of {totalPages}
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
