"use client";

import { useEffect, useRef, useState } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useCardBattle } from "@/hooks/useCardBattle";
import { useNftImage } from "@/hooks/useNftImage";
import { buildDeck } from "@/lib/deckBuilder";
import type { BoardCard, GameState, PlayerID } from "@/lib/cardBattleTypes";
import { BOARD_COLS, FORTRESS_HP } from "@/lib/cardBattleTypes";

type Props = {
  characters: NftCharacter[];
  onExit: () => void;
};

function FortressBar({ hp, player }: { hp: number; player: PlayerID }) {
  const pct = Math.max(0, (hp / FORTRESS_HP) * 100);
  const critical = pct < 25;
  return (
    <div className={`w-full fortress-bar ${critical ? 'fortress-critical' : ''}`}>
      <div className="flex justify-between text-xs font-mono mb-1" style={{ color: 'rgba(232,213,176,0.8)' }}>
        <span className="tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>P{player} Fortress</span>
        <span>{hp.toFixed(0)} / {FORTRESS_HP}</span>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: critical ? 'linear-gradient(90deg, #dc2626, #f87171)' : 'linear-gradient(90deg, #c9a84c, #f0d070)',
            boxShadow: critical ? '0 0 8px #dc2626' : '0 0 6px #c9a84c',
          }} />
      </div>
    </div>
  );
}

function TinyPortrait({ metadataUri, name, size = 48 }: { metadataUri?: string; name: string; size?: number }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(metadataUri);
  return (
    <div className="rounded overflow-hidden mx-auto" style={{ width: size, height: size, background: '#0a0810', flexShrink: 0 }}>
      {imgFailed || !imageUrl ? (
        <div className="w-full h-full flex items-center justify-center opacity-20">
          <span style={{ fontSize: size * 0.4 }}>🛡️</span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={imageUrl} alt={name} className="w-full h-full object-contain"
          onError={() => setImgFailed(true)} />
      )}
    </div>
  );
}

function MiniCard({ card, onClick, highlight }: { card: BoardCard; onClick?: () => void; highlight?: boolean }) {
  const hpPct = card.maxHp > 0 ? Math.max(0, (card.currentHp / card.maxHp) * 100) : 0;
  return (
    <div onClick={onClick}
      className="rounded-lg p-1.5 text-center cursor-pointer transition-all"
      style={{
        background: highlight ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
        minHeight: '80px',
      }}>
      <TinyPortrait metadataUri={card.character.metadataUri} name={card.character.name} size={40} />
      <p className="text-xs font-bold tracking-wider uppercase truncate text-gold-shimmer mt-0.5" style={{ fontSize: '0.5rem' }}>
        {card.character.name}
      </p>
      {/* HP bar */}
      <div className="h-1 w-full rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${hpPct}%`, background: hpPct < 30 ? '#dc2626' : '#16a34a' }} />
      </div>
      <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(232,213,176,0.6)', fontSize: '0.5rem' }}>
        {card.currentHp.toFixed(0)} HP {card.burns.length > 0 ? `🔥×${card.burns.length}` : ''}
      </p>
      <div className="flex justify-center gap-1 mt-0.5 flex-wrap" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
        {card.stats.attack > 0 && <span>⚔️{card.stats.attack.toFixed(0)}</span>}
        {card.stats.mAtk > 0 && <span>⚡{card.stats.mAtk.toFixed(0)}</span>}
        {card.stats.fAtk > 0 && <span>🔥{card.stats.fAtk.toFixed(0)}</span>}
        {card.stats.def > 0 && <span>🛡️{card.stats.def.toFixed(0)}</span>}
      </div>
    </div>
  );
}

function EmptySlot({ onClick, active, label, onDrop }: { onClick?: () => void; active: boolean; label: string; onDrop?: (handIndex: number) => void }) {
  return (
    <div onClick={active ? onClick : undefined}
      className="rounded-lg flex items-center justify-center transition-all"
      onDragOver={(e) => { if (active) { e.preventDefault(); e.currentTarget.style.background = 'rgba(201,168,76,0.2)'; } }}
      onDragLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)'; }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.style.background = active ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)';
        if (!active || !onDrop) return;
        const idx = parseInt(e.dataTransfer.getData("handIndex"), 10);
        if (!isNaN(idx)) onDrop(idx);
      }}
      style={{
        background: active ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px dashed ${active ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.06)'}`,
        minHeight: '80px',
        cursor: active ? 'pointer' : 'default',
      }}>
      <span style={{ color: active ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.1)', fontSize: '0.5rem' }}
        className="tracking-widest uppercase">{label}</span>
    </div>
  );
}

function HandCard({ character, selected, onClick, handIndex }: { character: NftCharacter; selected: boolean; onClick: () => void; handIndex: number }) {
  return (
    <div onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("handIndex", String(handIndex));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="rounded-lg p-2 cursor-grab active:cursor-grabbing transition-all flex-shrink-0"
      style={{
        width: '100px',
        background: selected ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)',
        border: `2px solid ${selected ? 'rgba(201,168,76,0.7)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: selected ? '0 0 15px rgba(201,168,76,0.3)' : 'none',
        transform: selected ? 'translateY(-8px)' : 'none',
      }}>
      <TinyPortrait metadataUri={character.metadataUri} name={character.name} size={56} />
      <p className="text-xs font-bold tracking-wider uppercase truncate text-gold-shimmer mt-1" style={{ fontSize: '0.55rem' }}>
        {character.name}
      </p>
      <div className="flex flex-col gap-0.5 mt-1" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
        {character.stats.attack > 0 && <span>⚔️ ATK {character.stats.attack.toFixed(1)}</span>}
        {character.stats.hp > 0 && <span>❤️ HP {character.stats.hp.toFixed(1)}</span>}
        {character.stats.def > 0 && <span>🛡️ DEF {character.stats.def.toFixed(1)}</span>}
      </div>
    </div>
  );
}

function BoardRow({ board, playerBoard, row, phase, selectedHandIndex, onSlotClick, onSlotDrop }:
  { board: (BoardCard | null)[][]; playerBoard: PlayerID; row: number;
    phase: GameState["phase"]; selectedHandIndex: number | null;
    onSlotClick: (col: number) => void; onSlotDrop: (col: number, handIndex: number) => void }) {
  const isActive = (phase === "p1Place" && playerBoard === 1) || (phase === "p2Place" && playerBoard === 2);
  const canClick = isActive && selectedHandIndex !== null;
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: BOARD_COLS }, (_, col) => {
        const card = board[col][row];
        if (card) return <MiniCard key={col} card={card} />;
        return (
          <EmptySlot key={col}
            active={isActive}
            label={row === 1 ? "FRONT" : "BACK"}
            onClick={canClick ? () => onSlotClick(col) : undefined}
            onDrop={(handIndex) => onSlotDrop(col, handIndex)} />
        );
      })}
    </div>
  );
}

export function CardBattleBoard({ characters, onExit }: Props) {
  const { state, initGame, selectCard, placeCard, dragPlaceCard, endPlacement, passDone, aiTurn, resolveCombat, reset } = useCardBattle();
  const logRef = useRef<HTMLDivElement>(null);
  const [chosenCards, setChosenCards] = useState<NftCharacter[]>([]);

  // Auto-play AI when it's P2's turn (passToP2 → AI plays → combat)
  useEffect(() => {
    if (state.phase === "passToP2") {
      // Small delay so player sees the transition
      const t = setTimeout(() => {
        passDone(); // advance to p2Place
        setTimeout(() => aiTurn(), 500); // AI places a card → combat
      }, 800);
      return () => clearTimeout(t);
    }
  }, [state.phase, passDone, aiTurn]);

  // Auto-resolve combat after a brief pause
  useEffect(() => {
    if (state.phase === "combat") {
      const t = setTimeout(() => resolveCombat(), 1000);
      return () => clearTimeout(t);
    }
  }, [state.phase, resolveCombat]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.combatLog.length]);

  const ownedCards = characters.filter((c) => c.owned);
  const chosenAddrs = new Set(chosenCards.map((c) => c.contractAddress));

  const toggleChosen = (card: NftCharacter) => {
    if (chosenAddrs.has(card.contractAddress)) {
      setChosenCards((prev) => prev.filter((c) => c.contractAddress !== card.contractAddress));
    } else if (chosenCards.length < 60) {
      setChosenCards((prev) => [...prev, card]);
    }
  };

  const startGame = () => {
    const d1 = buildDeck(characters, chosenCards);
    const d2 = buildDeck(characters);
    initGame(d1, d2);
  };

  const activePlayer: PlayerID = state.phase === "p2Place" ? 2 : 1;
  const activeHand = state.phase === "p1Place"
    ? state.players[0].hand
    : state.phase === "p2Place"
    ? state.players[1].hand
    : [];

  const handleSlotClick = (col: number, row: number) => {
    placeCard(col, row);
  };

  const handleSlotDrop = (col: number, row: number, handIndex: number) => {
    dragPlaceCard(handIndex, col, row);
  };

  // Setup / Deck Builder screen
  if (state.phase === "setup") {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Muster Your Forces ⚜
        </h2>
        <p className="text-sm" style={{ color: 'rgba(201,168,76,0.5)' }}>
          Select up to 60 champions you own. Remaining ranks filled with conscripts.
        </p>

        {/* Chosen count + actions */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold" style={{ color: 'rgba(201,168,76,0.8)' }}>
            {chosenCards.length} / 60 chosen
          </span>
          {chosenCards.length > 0 && (
            <button onClick={() => setChosenCards([])}
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>
              Clear
            </button>
          )}
          <button onClick={startGame}
            className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)', boxShadow: '0 0 15px rgba(201,168,76,0.15)' }}>
            {chosenCards.length === 0 ? "Random Deck — Fight!" : "Fight!"}
          </button>
          <button onClick={onExit}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            Back
          </button>
        </div>

        {/* Card grid — owned only */}
        <div className="w-full max-h-[50vh] overflow-y-auto rounded-lg p-3"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
          <p className="text-center text-xs tracking-widest uppercase mb-2" style={{ color: 'rgba(201,168,76,0.4)' }}>
            Your NFTs ({ownedCards.length})
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {ownedCards.map((card) => {
              const isChosen = chosenAddrs.has(card.contractAddress);
              return (
                <div key={card.contractAddress}
                  onClick={() => toggleChosen(card)}
                  className="rounded-lg p-1.5 cursor-pointer transition-all text-center"
                  style={{
                    background: isChosen ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isChosen ? 'rgba(201,168,76,0.7)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: isChosen ? '0 0 10px rgba(201,168,76,0.2)' : 'none',
                  }}>
                  <TinyPortrait metadataUri={card.metadataUri} name={card.name} size={48} />
                  <p className="text-xs font-bold truncate mt-1" style={{
                    color: isChosen ? 'rgba(201,168,76,0.9)' : 'rgba(232,213,176,0.6)',
                    fontSize: '0.5rem',
                  }}>{card.name}</p>
                  {isChosen && (
                    <span className="text-xs font-black" style={{ color: '#f0d070', fontSize: '0.5rem' }}>CHOSEN</span>
                  )}
                </div>
              );
            })}
          </div>
          {ownedCards.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(201,168,76,0.4)' }}>
              Connect wallet to see your NFTs
            </p>
          )}
        </div>
      </div>
    );
  }

  // AI thinking interstitial
  if (state.phase === "passToP2" || state.phase === "p2Place") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 mt-24">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(220,38,38,0.3)', borderTopColor: 'rgba(220,38,38,0.9)' }} />
        <h2 className="text-lg font-black tracking-widest uppercase" style={{ color: 'rgba(220,38,38,0.7)' }}>
          Opponent is thinking...
        </h2>
      </div>
    );
  }

  // Game over
  if (state.phase === "gameOver") {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="w-full max-w-3xl">
          <FortressBar hp={state.players[1].fortressHp} player={2} />
          <div className="my-4" />
          <FortressBar hp={state.players[0].fortressHp} player={1} />
        </div>
        <div className="text-center mt-4">
          <div className="text-5xl mb-2">👑</div>
          <h2 className="text-3xl font-black tracking-widest text-gold-shimmer uppercase" style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            Player {state.winner} Conquers!
          </h2>
          <p className="text-sm mt-2" style={{ color: 'rgba(201,168,76,0.5)' }}>
            Victory in {state.turnNumber} turns — {state.combatLog.length} blows struck
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { reset(); startGame(); }}
            className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
            Rematch
          </button>
          <button onClick={onExit}
            className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.15)' }}>
            Back to Grid
          </button>
        </div>
      </div>
    );
  }

  // Combat phase — auto-resolve
  const isCombat = state.phase === "combat";

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto gap-3">
      {/* Header with medieval flair */}
      <div className="flex items-center justify-between w-full">
        <button onClick={onExit}
          className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.7)', border: '1px solid rgba(201,168,76,0.2)' }}>
          ← Retreat
        </button>
        <div className="text-center">
          <span className="text-xs tracking-widest uppercase font-bold" style={{ color: 'rgba(201,168,76,0.8)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            {isCombat ? "⚔️ Battle! ⚔️" : `🏰 Turn ${state.turnNumber} — Your Move 🏰`}
          </span>
        </div>
        <div className="text-xs font-mono" style={{ color: 'rgba(201,168,76,0.4)' }}>
          📦 P1: {state.players[0].deck.length} | P2: {state.players[1].deck.length}
        </div>
      </div>

      {/* P2 Fortress */}
      <FortressBar hp={state.players[1].fortressHp} player={2} />

      {/* Arena */}
      <div className="battle-arena medieval-corners w-full rounded-xl p-3">

      {/* P2 Board (mirrored: back row on top, front row below) */}
      <div className="w-full rounded-lg p-2" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
        <p className="text-center mb-1 tracking-widest uppercase lane-marker" style={{ color: 'rgba(96,165,250,0.5)' }}>
          ⚜ Player 2 — Rear Guard ⚜
        </p>
        <BoardRow board={state.players[1].board} playerBoard={2} row={0}          phase={state.phase} selectedHandIndex={state.selectedHandIndex} onSlotClick={(col) => handleSlotClick(col, 0)} onSlotDrop={(col, hi) => handleSlotDrop(col, 0, hi)} />
        <div className="my-1" />
        <BoardRow board={state.players[1].board} playerBoard={2} row={1}          phase={state.phase} selectedHandIndex={state.selectedHandIndex} onSlotClick={(col) => handleSlotClick(col, 1)} onSlotDrop={(col, hi) => handleSlotDrop(col, 1, hi)} />
        <p className="text-center mt-1 tracking-widest uppercase lane-marker" style={{ color: 'rgba(96,165,250,0.5)' }}>⚔ Vanguard ⚔</p>
      </div>

      {/* Center divider — battlefield */}
      <div className="flex items-center gap-3 w-full px-4 py-2">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.4))' }} />
        <div className="flex items-center gap-2">
          <span style={{ color: 'rgba(201,168,76,0.3)' }}>🗡️</span>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.4)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif", fontSize: '0.65rem' }}>
            No Man's Land
          </span>
          <span style={{ color: 'rgba(201,168,76,0.3)' }}>🗡️</span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.4))' }} />
      </div>

      {/* P1 Board (front row on top, back row below) */}
      <div className="w-full rounded-lg p-2" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <p className="text-center mb-1 tracking-widest uppercase lane-marker" style={{ color: 'rgba(251,191,36,0.5)' }}>⚔ Vanguard ⚔</p>
        <BoardRow board={state.players[0].board} playerBoard={1} row={1}          phase={state.phase} selectedHandIndex={state.selectedHandIndex} onSlotClick={(col) => handleSlotClick(col, 1)} onSlotDrop={(col, hi) => handleSlotDrop(col, 1, hi)} />
        <div className="my-1" />
        <BoardRow board={state.players[0].board} playerBoard={1} row={0}          phase={state.phase} selectedHandIndex={state.selectedHandIndex} onSlotClick={(col) => handleSlotClick(col, 0)} onSlotDrop={(col, hi) => handleSlotDrop(col, 0, hi)} />
        <p className="text-center mt-1 tracking-widest uppercase lane-marker" style={{ color: 'rgba(251,191,36,0.5)' }}>
          ⚜ Player 1 — Rear Guard ⚜
        </p>
      </div>

      </div>{/* end battle-arena */}

      {/* P1 Fortress */}
      <FortressBar hp={state.players[0].fortressHp} player={1} />

      {/* Active hand */}
      {state.phase === "p1Place" && (
        <div className="w-full">
          <p className="text-center text-xs tracking-widest uppercase mb-2" style={{ color: 'rgba(201,168,76,0.5)' }}>
            🃏 Your Arsenal — {activeHand.length} cards
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {activeHand.map((char, i) => (
              <HandCard key={`${char.contractAddress}-${i}`} character={char}
                selected={state.selectedHandIndex === i}
                onClick={() => selectCard(i)}
                handIndex={i} />
            ))}
          </div>
          <div className="flex justify-center mt-3 gap-3">
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)', alignSelf: 'center' }}>
              Place 1 card or
            </p>
            <button onClick={endPlacement}
              className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.2)' }}>
              Skip Turn
            </button>
          </div>
        </div>
      )}

      {/* Combat resolving indicator */}
      {isCombat && (
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(220,38,38,0.3)', borderTopColor: 'rgba(220,38,38,0.9)' }} />
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(220,38,38,0.7)' }}>
            ⚔️ Combat! ⚔️
          </span>
        </div>
      )}

      {/* Combat log */}
      {state.combatLog.length > 0 && (
        <div ref={logRef} className="w-full battle-log p-2 max-h-32 overflow-y-auto">
          {state.combatLog.slice(-20).map((e, i) => (
            <div key={i} className="text-xs py-0.5 font-mono" style={{ color: e.targetName === "Fortress" ? '#f87171' : 'rgba(232,213,176,0.5)' }}>
              <span style={{ color: 'rgba(201,168,76,0.3)' }}>[C{e.col + 1}]</span>{' '}
              <span style={{ color: e.attackerPlayer === 1 ? 'rgba(251,191,36,0.7)' : 'rgba(96,165,250,0.7)' }}>{e.attackerName}</span>
              {' → '}
              <span style={{ color: '#f87171' }}>{e.totalDmg.toFixed(1)}</span>
              {' dmg → '}
              <span>{e.targetName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
