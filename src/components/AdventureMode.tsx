"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useAdventure } from "@/hooks/useAdventure";
import { useNftImage } from "@/hooks/useNftImage";
import type { NftCharacter } from "@/hooks/useNftStats";
import { makeUnit, resolveRound, generateEnemies, getValidMoves, canAttack, gridRow, gridCol, type CombatUnit, type CombatEvent } from "@/lib/adventureCombat";

const ADMIN_WALLET = "0x0780b1456d5e60cf26c8cd6541b85e805c8c05f2";
// LP Faucet — owner-funded, players pay only gas
const LP_FAUCET = "0x0000000000000000000000000000000000000000" as const; // UPDATE after deploying faucet
const FAUCET_ABI = [{ name: "rewardHero", type: "function", stateMutability: "nonpayable", inputs: [{ name: "nftContract", type: "address" }], outputs: [] }, { name: "canReward", type: "function", stateMutability: "view", inputs: [{ name: "nftContract", type: "address" }], outputs: [{ type: "bool" }] }] as const;

type Props = {
  characters: NftCharacter[];
  onExit: () => void;
};

function UnitPortrait({ unit, small }: { unit: CombatUnit; small?: boolean }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(unit.character.metadataUri, unit.character.contractAddress);
  const hpPct = unit.maxHp > 0 ? Math.max(0, (unit.currentHp / unit.maxHp) * 100) : 0;
  const dead = unit.currentHp <= 0;
  const size = small ? 50 : 70;

  return (
    <div className="flex flex-col items-center gap-1" style={{ opacity: dead ? 0.3 : 1 }}>
      <div className="rounded-lg overflow-hidden" style={{ width: size, height: size, background: '#0a0810' }}>
        {imgFailed || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <span style={{ fontSize: size * 0.4 }}>🛡️</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={unit.character.name} className="w-full h-full object-contain"
            onError={() => setImgFailed(true)} />
        )}
      </div>
      <p className="text-xs font-bold truncate text-center" style={{ color: dead ? 'rgba(220,38,38,0.5)' : 'rgba(232,213,176,0.8)', fontSize: '0.5rem', maxWidth: size + 20 }}>
        {dead ? "💀 " : ""}{unit.character.name}
      </p>
      {!dead && (
        <>
          <div className="rounded-full overflow-hidden" style={{ width: size, height: 4, background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${hpPct}%`, background: hpPct < 30 ? '#dc2626' : '#16a34a' }} />
          </div>
          <span className="font-mono" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
            {unit.currentHp.toFixed(0)}/{unit.maxHp.toFixed(0)}
            {unit.burns.length > 0 ? ` 🔥×${unit.burns.length}` : ""}
          </span>
        </>
      )}
    </div>
  );
}

function GridCellPortrait({ unit }: { unit: CombatUnit }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(unit.character.metadataUri, unit.character.contractAddress);
  if (imgFailed || !imageUrl) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={imageUrl} alt={unit.character.name} className="w-full h-full object-cover rounded"
      style={{ position: 'absolute', inset: 0, opacity: 0.4 }}
      onError={() => setImgFailed(true)} />
  );
}

function SlotPortrait({ character }: { character: NftCharacter }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri, character.contractAddress);
  if (imgFailed || !imageUrl) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={imageUrl} alt={character.name} className="w-full h-full object-cover rounded"
      style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
      onError={() => setImgFailed(true)} />
  );
}

function GridView({ units, label, color, onCellClick, selectedUnit, validMoves }: {
  units: CombatUnit[];
  label: string;
  color: string;
  onCellClick?: (pos: number, unit: CombatUnit | null) => void;
  selectedUnit?: number | null;
  validMoves?: Set<number>;
}) {
  const grid: (CombatUnit | null)[] = Array(9).fill(null);
  units.forEach(u => { if (u.gridPos >= 0 && u.gridPos < 9) grid[u.gridPos] = u; });

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs tracking-widest uppercase" style={{ color, fontSize: '0.5rem' }}>{label}</p>
      <div className="grid grid-cols-3 gap-1" style={{ width: 226 }}>
        {grid.map((unit, pos) => {
          const isSelected = selectedUnit !== null && unit?.index === selectedUnit;
          const isValidMove = validMoves?.has(pos) ?? false;
          const dead = unit && unit.currentHp <= 0;
          return (
            <div key={pos}
              onClick={() => onCellClick?.(pos, unit)}
              className="rounded-lg flex flex-col items-center justify-center transition-all relative overflow-hidden"
              style={{
                width: 72, height: 72,
                background: isSelected ? 'rgba(96,165,250,0.2)' : isValidMove ? 'rgba(74,222,128,0.1)' : unit ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                border: `2px solid ${isSelected ? 'rgba(96,165,250,0.7)' : isValidMove ? 'rgba(74,222,128,0.5)' : unit ? `${color}33` : 'rgba(255,255,255,0.05)'}`,
                cursor: onCellClick ? 'pointer' : 'default',
                opacity: dead ? 0.3 : 1,
              }}>
              {unit ? (
                <>
                  <GridCellPortrait unit={unit} />
                  <p className="font-bold truncate text-center px-0.5 relative z-10" style={{ color: dead ? 'rgba(220,38,38,0.5)' : '#fff', fontSize: '0.45rem', maxWidth: 68, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {dead ? "💀 " : ""}{unit.character.name}
                  </p>
                  {!dead && (
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="rounded-full overflow-hidden" style={{ width: 54, height: 3, background: 'rgba(255,255,255,0.2)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(0, (unit.currentHp / unit.maxHp) * 100)}%`, background: (unit.currentHp / unit.maxHp) < 0.3 ? '#dc2626' : '#16a34a' }} />
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.4rem', color: '#ccc', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {unit.currentHp.toFixed(0)}/{unit.maxHp.toFixed(0)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                isValidMove ? <span style={{ fontSize: '0.6rem', color: 'rgba(74,222,128,0.6)' }}>↵</span>
                : <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.08)' }}>·</span>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.15)' }}>Front ← → Back</p>
      {(() => {
        const reserves = units.filter(u => u.gridPos === -1 && u.currentHp > 0);
        return reserves.length > 0 ? (
          <p className="font-bold" style={{ fontSize: '0.5rem', color: 'rgba(220,38,38,0.6)' }}>
            +{reserves.length} in reserve
          </p>
        ) : null;
      })()}
    </div>
  );
}

function PartyCombat({ players: initPlayers, enemies: initEnemies, onWin, onLose }: {
  players: CombatUnit[];
  enemies: CombatUnit[];
  onWin: () => void;
  onLose: () => void;
}) {
  const [players, setPlayers] = useState(initPlayers);
  const [enemies, setEnemies] = useState(initEnemies);
  const [log, setLog] = useState<CombatEvent[]>([]);
  const [round, setRound] = useState(0);
  const [fighting, setFighting] = useState(false);
  const [done, setDone] = useState<"win" | "lose" | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"move" | "attack">("move");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [moved, setMoved] = useState<Set<number>>(new Set()); // indices that moved this turn

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  const occupied = new Set(players.filter(p => p.currentHp > 0).map(p => p.gridPos));
  const validMoves = selectedUnit !== null
    ? new Set(getValidMoves(players[selectedUnit]?.gridPos ?? -1, occupied))
    : new Set<number>();

  function handlePlayerGridClick(pos: number, unit: CombatUnit | null) {
    if (done || fighting) return;
    if (phase === "move") {
      if (unit && unit.currentHp > 0 && !moved.has(unit.index)) {
        setSelectedUnit(unit.index);
      } else if (selectedUnit !== null && validMoves.has(pos)) {
        // Move the selected unit
        setPlayers(prev => prev.map(p =>
          p.index === selectedUnit ? { ...p, gridPos: pos } : p
        ));
        setMoved(prev => new Set(prev).add(selectedUnit));
        setSelectedUnit(null);
      }
    }
  }

  function endMovePhase() {
    setPhase("attack");
    setSelectedUnit(null);
  }

  const doRound = useCallback(() => {
    if (done) return;
    const result = resolveRound(players, enemies);
    setPlayers(result.players);
    setEnemies(result.enemies);
    setLog(prev => [...prev, ...result.events]);
    setRound(r => r + 1);
    setPhase("move");
    setMoved(new Set());
    setSelectedUnit(null);

    // AI moves enemies forward if possible
    const enemyOccupied = new Set(result.enemies.filter(e => e.currentHp > 0).map(e => e.gridPos));
    const movedEnemies = result.enemies.map(e => {
      if (e.currentHp <= 0 || e.gridPos < 0) return e;
      const row = gridRow(e.gridPos);
      if (row === 0) return e; // already front
      const forwardPos = (row - 1) * 3 + gridCol(e.gridPos);
      if (!enemyOccupied.has(forwardPos)) {
        enemyOccupied.delete(e.gridPos);
        enemyOccupied.add(forwardPos);
        return { ...e, gridPos: forwardPos };
      }
      return e;
    });
    setEnemies(movedEnemies);

    const playersAlive = result.players.some(p => p.currentHp > 0);
    const enemiesAlive = result.enemies.some(e => e.currentHp > 0);
    if (!enemiesAlive) setDone("win");
    else if (!playersAlive) setDone("lose");
  }, [players, enemies, done]);

  // Auto-fight mode
  useEffect(() => {
    if (!fighting || done) return;
    const t = setInterval(doRound, 1500);
    return () => clearInterval(t);
  }, [fighting, done, doRound]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <div className="text-xs tracking-widest uppercase font-bold" style={{ color: 'rgba(201,168,76,0.6)' }}>
        Round {round} — {phase === "move" && !fighting && !done ? "Move Phase (tap hero, tap square)" : "Combat"}
      </div>

      {/* Two grids side by side */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <GridView units={players} label="Your Formation" color="rgba(201,168,76,0.6)"
          onCellClick={phase === "move" && !fighting && !done ? handlePlayerGridClick : undefined}
          selectedUnit={selectedUnit}
          validMoves={phase === "move" ? validMoves : undefined}
        />
        <div className="text-2xl" style={{ color: 'rgba(201,168,76,0.3)' }}>⚔️</div>
        <GridView units={enemies} label="Enemies" color="rgba(220,38,38,0.5)" />
      </div>

      {/* Controls */}
      {!done && (
        <div className="flex gap-3 flex-wrap justify-center">
          {!fighting ? (
            phase === "move" ? (
              <>
                <button onClick={endMovePhase}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                  ⚔️ {moved.size > 0 ? "Done Moving — Attack!" : "Skip Move — Attack!"}
                </button>
                <button onClick={() => setFighting(true)}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                  ⚡ Auto-Fight
                </button>
              </>
            ) : (
              <>
                <button onClick={doRound}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                  ⚔️ Attack!
                </button>
                <button onClick={() => { setPhase("move"); setMoved(new Set()); }}
                  className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  ← Back to Move
                </button>
                <button onClick={() => setFighting(true)}
                  className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                  ⚡ Auto-Fight
                </button>
              </>
            )
          ) : (
            <button onClick={() => setFighting(false)}
              className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.2)' }}>
              ⏸ Pause
            </button>
          )}
        </div>
      )}

      {/* Win/Lose */}
      {done && (
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="text-4xl">{done === "win" ? "🏆" : "💀"}</div>
          <h2 className="text-xl font-black tracking-widest uppercase text-gold-shimmer"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            {done === "win" ? "Victory!" : "Defeated..."}
          </h2>
          <button onClick={done === "win" ? onWin : onLose}
            className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
            {done === "win" ? "Claim Reward →" : "Try Again"}
          </button>
        </div>
      )}

      {/* Combat log */}
      {log.length > 0 && (
        <div ref={logRef} className="w-full battle-log p-2 max-h-32 overflow-y-auto">
          {log.slice(-30).map((e, i) => (
            <div key={i} className="text-xs py-0.5 font-mono" style={{
              color: e.killed ? '#f87171' : 'rgba(232,213,176,0.5)',
            }}>
              <span style={{ color: e.damageType === "burn" ? 'rgba(251,146,60,0.7)' : e.damageType === "electric" ? 'rgba(192,132,252,0.7)' : e.damageType === "fire" ? 'rgba(251,146,60,0.7)' : 'rgba(251,191,36,0.7)' }}>
                {e.attackerName}
              </span>
              {" → "}
              <span style={{ color: '#f87171' }}>{e.damage.toFixed(1)}</span>
              {e.damageType === "electric" ? " ⚡" : e.damageType === "fire" ? " 🔥" : e.damageType === "burn" ? " 🔥" : e.damageType === "mana" ? " 💧" : ""}
              {" → "}{e.targetName}
              {e.killed ? " 💀" : ` (${e.targetHpAfter.toFixed(0)} HP)`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FORMATION_LABELS = ["Front-L", "Front-C", "Front-R", "Mid-L", "Mid-C", "Mid-R", "Back-L", "Back-C", "Back-R"];

function PartyPicker({ characters, onStart, onBack, isAdmin }: {
  characters: NftCharacter[];
  onStart: (party: NftCharacter[], gridMap: Map<string, number>) => void;
  onBack: () => void;
  isAdmin?: boolean;
}) {
  // 9 formation slots (3x3 grid)
  const [slots, setSlots] = useState<(NftCharacter | null)[]>(Array(9).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const owned = characters.filter(c => c.owned);
  const pool = isAdmin ? (owned.length > 0 ? owned : characters) : owned;
  const partyAddrs = new Set(slots.filter(Boolean).map(c => c!.contractAddress));

  const [heroSearch, setHeroSearch] = useState("");
  const filteredPool = heroSearch.trim()
    ? pool.filter(c => c.name.toLowerCase().includes(heroSearch.toLowerCase()) || c.contractAddress.toLowerCase().includes(heroSearch.toLowerCase()))
    : pool;

  const party = slots.filter(Boolean) as NftCharacter[];

  function assignHero(card: NftCharacter) {
    if (selectedSlot === null) return;
    setSlots(prev => {
      const next = [...prev];
      // Remove from any existing slot
      for (let i = 0; i < next.length; i++) {
        if (next[i]?.contractAddress === card.contractAddress) next[i] = null;
      }
      // Check if already at max (4) and this is a new hero
      const currentCount = next.filter(Boolean).length;
      if (currentCount >= 4 && !prev.some(s => s?.contractAddress === card.contractAddress)) return prev;
      next[selectedSlot] = card;
      return next;
    });
    setSelectedSlot(null);
  }

  function clearSlot(i: number) {
    setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
  }

  return (
    <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
      <h3 className="text-lg font-black tracking-widest text-gold-shimmer uppercase">Formation</h3>
      <p className="text-sm" style={{ color: 'rgba(201,168,76,0.5)' }}>
        Place up to 4 heroes in a 3×3 grid. Tap a slot, then pick a hero. Front row takes hits first.
      </p>
      {owned.length === 0 && !isAdmin && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm font-bold" style={{ color: 'rgba(220,38,38,0.8)' }}>
            You need to own at least one NFT to play Adventure mode.
          </p>
          <p className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
            Connect your wallet and make sure you hold a Tales of Tasern hero.
          </p>
          <button onClick={onBack}
            className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Back
          </button>
        </div>
      )}

      {/* 3x3 Formation Grid */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.3)', fontSize: '0.5rem' }}>
          ← FRONT (enemies) &nbsp;&nbsp;&nbsp;&nbsp; BACK (safe) →
        </p>
        <div className="grid grid-cols-3 gap-2" style={{ width: 240 }}>
          {slots.map((hero, i) => {
            const isSelected = selectedSlot === i;
            const row = Math.floor(i / 3);
            const rowLabel = row === 0 ? "Front" : row === 1 ? "Mid" : "Back";
            return (
              <div key={i}
                onClick={() => hero ? clearSlot(i) : setSelectedSlot(isSelected ? null : i)}
                className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden"
                style={{
                  width: 74, height: 74,
                  background: hero ? 'rgba(201,168,76,0.15)' : isSelected ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${hero ? 'rgba(201,168,76,0.6)' : isSelected ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: isSelected ? '0 0 12px rgba(96,165,250,0.3)' : 'none',
                }}>
                {hero ? (
                  <>
                    <SlotPortrait character={hero} />
                    <p className="text-xs font-bold truncate text-center px-1 relative z-10" style={{ color: '#fff', fontSize: '0.5rem', maxWidth: 70, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                      {hero.name}
                    </p>
                    <span className="relative z-10" style={{ fontSize: '0.4rem', color: 'rgba(220,38,38,0.7)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>tap to remove</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.6rem', color: isSelected ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.2)' }}>
                      {isSelected ? '⬇ Pick' : '+'}
                    </span>
                    <span style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.15)' }}>{rowLabel}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {party.length > 0 && (
        <button onClick={() => {
          const gridMap = new Map<string, number>();
          slots.forEach((s, i) => { if (s) gridMap.set(s.contractAddress, i); });
          onStart(party, gridMap);
        }}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)' }}>
          ⚔️ Begin with {party.length} hero{party.length > 1 ? "es" : ""}!
        </button>
      )}

      {/* Hero selection panel (shows when a slot is selected) */}
      {selectedSlot !== null && pool.length > 0 && (
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs font-bold" style={{ color: 'rgba(96,165,250,0.7)' }}>
            Pick a hero for {FORMATION_LABELS[selectedSlot]}:
          </p>
          <input
            value={heroSearch}
            onChange={(e) => setHeroSearch(e.target.value)}
            placeholder="Search your heroes..."
            className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }}
          />
          <div className="w-full max-h-[35vh] overflow-y-auto rounded-lg p-3"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {filteredPool.map((card) => {
                const placed = partyAddrs.has(card.contractAddress);
                return (
                  <div key={card.contractAddress} onClick={() => assignHero(card)}
                    className="rounded-lg p-1.5 cursor-pointer transition-all text-center"
                    style={{
                      background: placed ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${placed ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      opacity: placed ? 0.5 : 1,
                    }}>
                    <p className="text-xs font-bold truncate" style={{
                      color: placed ? 'rgba(201,168,76,0.5)' : 'rgba(232,213,176,0.6)', fontSize: '0.5rem',
                    }}>{card.name}</p>
                    {placed && <span style={{ fontSize: '0.4rem', color: 'rgba(201,168,76,0.4)' }}>placed</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button onClick={onBack}
        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ← Back
      </button>
    </div>
  );
}

const INTRO_TEXT = "At the heart of a quiet crossroads village, where warm lanternlight spills across worn cobblestones and every path seems to lead somewhere important, your journey begins. Six humble homes ring the central well\u2014each belonging to a friend who has walked a different road, learned a different truth, and now waits to share what they know. Here, among creaking wood, soft laughter, and the scent of earth and fire, you will gather the pieces of what you need\u2014not just tools or directions, but perspective. For beyond this circle, the world grows wider, stranger, and far less forgiving\u2014and only by listening to those who know you best will you be ready to take your first real step into it.";

export function AdventureMode({ characters, onExit }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { state, loaded, introSeen, chapter, encounter, chapters, markIntroSeen, startChapter, startBattle, winBattle, loseBattle, nextEncounter, backToMap, resetAdventure, skipLevel, skipEncounter, isOnCooldown, cooldownRemaining, encounterOnCooldown, encounterCooldownRemaining } = useAdventure(address);
  const [, forceUpdate] = useState(0);
  // Tick timer every 10s to update cooldown displays
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET;
  const [party, setParty] = useState<NftCharacter[]>([]);
  const [partyGrid, setPartyGrid] = useState<Map<string, number>>(new Map());
  const [pickingParty, setPickingParty] = useState(false);
  const [lpStatus, setLpStatus] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPos, setMapPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, mx: 0, my: 0 });

  function handleMapWheel(e: React.WheelEvent) {
    e.preventDefault();
    setMapZoom(z => Math.min(5, Math.max(0.5, z - e.deltaY * 0.002)));
  }
  function handleMapPointerDown(e: React.PointerEvent) {
    setDragging(true);
    dragStart.current = { x: mapPos.x, y: mapPos.y, mx: e.clientX, my: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleMapPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setMapPos({
      x: dragStart.current.x + (e.clientX - dragStart.current.mx),
      y: dragStart.current.y + (e.clientY - dragStart.current.my),
    });
  }
  function handleMapPointerUp() { setDragging(false); }

  // Send LP reward to each party member's NFT via faucet (player pays gas only)
  async function sendLpRewards() {
    if (!walletClient || party.length === 0 || LP_FAUCET === "0x0000000000000000000000000000000000000000") return;
    const baseHeroes = party.filter(h => h.chain === "base");
    if (baseHeroes.length === 0) { setLpStatus("No Base heroes to reward"); setTimeout(() => setLpStatus(null), 3000); return; }
    setLpStatus("Claiming LP rewards for Base heroes...");
    let sent = 0;
    for (const hero of baseHeroes) {
      try {
        await walletClient.writeContract({
          address: LP_FAUCET,
          abi: FAUCET_ABI,
          functionName: "rewardHero",
          args: [hero.contractAddress as `0x${string}`],
        });
        sent++;
        setLpStatus(`LP claimed for ${sent}/${baseHeroes.length} Base heroes...`);
      } catch (e: any) {
        console.warn("LP reward failed for", hero.name, e.message);
      }
    }
    setLpStatus(sent > 0 ? `LP rewards claimed for ${sent} Base hero${sent > 1 ? "es" : ""}!` : "LP rewards skipped (cooldown or faucet empty)");
    setTimeout(() => setLpStatus(null), 5000);
  }

  // Find current player position (first incomplete level)
  const playerLevel = chapters.findIndex(ch => !state.completedChapters.includes(ch.id));
  const playerPos = playerLevel === -1 ? chapters.length : playerLevel;

  const floatingBack = (
    <button onClick={onExit}
      className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
      style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
      ⚜ ← Back ⚜
    </button>
  );

  // Loading cloud save
  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-4 mt-20">
        <p className="text-sm animate-pulse" style={{ color: 'rgba(201,168,76,0.6)' }}>Loading adventure...</p>
      </div>
    );
  }

  // First-time intro screen
  if (!introSeen) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto mt-10 px-4">
        {floatingBack}
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase text-center"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Tales of Tasern ⚜
        </h2>
        <div className="rounded-xl p-6" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
          <p className="text-sm leading-relaxed text-center" style={{ color: 'rgba(232,213,176,0.7)', lineHeight: '1.8' }}>
            {INTRO_TEXT}
          </p>
        </div>
        <button onClick={markIntroSeen}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 20px rgba(201,168,76,0.15)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Begin Your Journey ⚜
        </button>
      </div>
    );
  }

  // Map screen — world map with location markers
  if (state.phase === "map") {
    return (
      <div className="fixed inset-0" style={{ background: '#0a0608' }}>
        {floatingBack}

        {/* Zoomable world map */}
        <div className="absolute inset-0 overflow-hidden touch-none"
          onWheel={handleMapWheel}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={handleMapPointerUp}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${mapPos.x}px), calc(-50% + ${mapPos.y}px)) scale(${mapZoom})`,
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
            width: '90vmin',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/world-map.jpg" alt="Tasern" draggable={false}
              style={{ width: '100%', display: 'block' }} />

            {/* Meta marker — World 1 */}
            <button onClick={(e) => { e.stopPropagation(); startChapter(0); setPickingParty(true); }}
              className="absolute animate-pulse"
              style={{
                left: '52%', top: '68%',
                transform: 'translate(-50%, -50%)',
                width: 24, height: 24,
                borderRadius: '50%',
                background: 'rgba(201,168,76,0.9)',
                border: '3px solid #f0d070',
                boxShadow: '0 0 15px rgba(201,168,76,0.6), 0 0 30px rgba(201,168,76,0.3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.4rem', fontWeight: 900, color: '#0a0608',
              }}>
              1
            </button>
            <span className="absolute font-black uppercase pointer-events-none"
              style={{
                left: '52%', top: '72%',
                transform: 'translateX(-50%)',
                fontSize: '0.5rem', color: '#f0d070',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}>
              Meta
            </span>
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4" style={{ zIndex: 10 }}>
          <h2 className="text-lg font-black tracking-widest text-gold-shimmer uppercase"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
            ⚜ Tasern ⚜
          </h2>
          <span className="text-xs font-bold px-2 py-1 rounded"
            style={{ color: 'rgba(201,168,76,0.8)', background: 'rgba(10,6,8,0.8)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            💰 {state.mftEarned.toLocaleString()} MfT
          </span>
        </div>

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex gap-2" style={{ zIndex: 10 }}>
          <button onClick={() => setMapZoom(z => Math.min(5, z + 0.5))}
            className="px-3 py-2 rounded-lg font-black text-lg"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>+</button>
          <button onClick={() => setMapZoom(z => Math.max(0.5, z - 0.5))}
            className="px-3 py-2 rounded-lg font-black text-lg"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>−</button>
          <button onClick={() => { setMapZoom(1); setMapPos({ x: 0, y: 0 }); }}
            className="px-3 py-2 rounded-lg font-bold text-xs"
            style={{ background: 'rgba(10,6,8,0.9)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }}>Reset</button>
        </div>

        {/* Bottom hint */}
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs" style={{ zIndex: 10, color: 'rgba(201,168,76,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
          Pinch or scroll to zoom · Drag to pan · Tap a location to begin
        </p>

        {state.mftEarned > 0 && (
          <button onClick={resetAdventure} className="absolute bottom-4 right-4 px-3 py-1 rounded text-xs font-bold"
            style={{ background: 'rgba(220,38,38,0.2)', color: 'rgba(220,38,38,0.5)', border: '1px solid rgba(220,38,38,0.2)', zIndex: 10 }}>
            Reset
          </button>
        )}
      </div>
    );
  }

  // Party picker
  if (pickingParty) {
    return (
      <PartyPicker characters={characters} isAdmin={isAdmin}
        onStart={(p, gridMap) => { setParty(p); setPartyGrid(gridMap); setPickingParty(false); }}
        onBack={() => { setPickingParty(false); backToMap(); }}
      />
    );
  }

  // Story
  // Level 1 encounter positions on the village image (clockwise from top-left, % based)
  const level1Positions = [
    { x: 20, y: 10, label: "1" },  // Merchant's Hut — top-left teal roof
    { x: 68, y: 8,  label: "2" },  // Woodcutter's Cabin — top-right
    { x: 85, y: 48, label: "3" },  // Herbalist's Tent — right side
    { x: 70, y: 82, label: "4" },  // Blacksmith's Forge — bottom-right
    { x: 18, y: 82, label: "5" },  // Elder's Lodge — bottom-left
    { x: 5,  y: 45, label: "6" },  // Village Square — left side
  ];

  if (state.phase === "story" && chapter && encounter) {
    const isLevel1 = state.currentChapter === 0;
    return (
      <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto mt-8">
        {floatingBack}
        <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.4)' }}>
          Level {state.currentChapter + 1}: {chapter.title} — Encounter {state.currentEncounter + 1}/{chapter.encounters.length}
        </p>

        {/* Level 1: Village map with encounter markers */}
        {isLevel1 && chapter.image && (
          <div className="w-full relative rounded-xl overflow-hidden" style={{ maxWidth: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chapter.image} alt={chapter.title} className="w-full" style={{ filter: 'brightness(0.6)' }} />
            {/* Path connecting encounters */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {level1Positions.map((pos, i) => {
                const next = level1Positions[(i + 1) % level1Positions.length];
                return (
                  <line key={i} x1={pos.x + 4} y1={pos.y + 4} x2={next.x + 4} y2={next.y + 4}
                    stroke={i < state.currentEncounter ? 'rgba(74,222,128,0.5)' : 'rgba(201,168,76,0.2)'}
                    strokeWidth="0.5" strokeDasharray={i < state.currentEncounter ? "none" : "2 1"} />
                );
              })}
            </svg>
            {/* Encounter markers */}
            {level1Positions.map((pos, i) => {
              const done = i < state.currentEncounter;
              const current = i === state.currentEncounter;
              const future = i > state.currentEncounter;
              return (
                <div key={i} className="absolute flex items-center justify-center"
                  style={{
                    left: `${pos.x}%`, top: `${pos.y}%`, width: 28, height: 28,
                    transform: 'translate(-50%, -50%)',
                  }}>
                  <div className={`rounded-full flex items-center justify-center font-black text-xs ${current ? 'animate-pulse' : ''}`}
                    style={{
                      width: current ? 28 : 22, height: current ? 28 : 22,
                      background: done ? 'rgba(34,197,94,0.8)' : current ? 'rgba(201,168,76,0.9)' : 'rgba(0,0,0,0.6)',
                      border: `2px solid ${done ? 'rgba(74,222,128,0.9)' : current ? '#f0d070' : 'rgba(255,255,255,0.2)'}`,
                      color: done ? '#0a0608' : current ? '#0a0608' : 'rgba(255,255,255,0.4)',
                      boxShadow: current ? '0 0 12px rgba(201,168,76,0.6)' : 'none',
                    }}>
                    {done ? '✓' : pos.label}
                  </div>
                  {current && <span className="absolute -top-3 text-sm animate-bounce">⚔️</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="w-full rounded-xl p-6 battle-arena medieval-corners">
          <h3 className="text-xl font-black tracking-widest text-gold-shimmer uppercase text-center mb-4"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            {encounter.name}
          </h3>
          {state.currentEncounter === 0 && (
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(232,213,176,0.6)' }}>{chapter.intro}</p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,176,0.8)' }}>{encounter.description}</p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <span className="text-xs" style={{ color: 'rgba(201,168,76,0.5)' }}>💰 {encounter.mftReward.toLocaleString()} MfT</span>
            <span className="text-xs" style={{ color: 'rgba(220,38,38,0.5)' }}>{"⚔️".repeat(Math.ceil(encounter.aiStrength * 3))}</span>
            <span className="text-xs" style={{ color: 'rgba(96,165,250,0.5)' }}>Party: {party.length} heroes</span>
          </div>
        </div>
        {(() => {
          const encCd = chapter ? encounterOnCooldown(chapter.id, state.currentEncounter) : false;
          const encCdMs = chapter ? encounterCooldownRemaining(chapter.id, state.currentEncounter) : 0;
          const cdMins = Math.floor(encCdMs / 60000);
          const cdSecs = Math.floor((encCdMs % 60000) / 1000);
          return (
            <div className="flex flex-col items-center gap-3">
              {encCd && (
                <p className="text-sm font-bold" style={{ color: 'rgba(150,150,150,0.8)' }}>
                  ⏳ Cooldown: {cdMins}m {cdSecs}s
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={startBattle} disabled={encCd}
                  className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
                  style={{ background: encCd ? 'rgba(100,100,100,0.2)' : 'rgba(220,38,38,0.3)', color: encCd ? 'rgba(150,150,150,0.5)' : '#fca5a5', border: `1px solid ${encCd ? 'rgba(100,100,100,0.3)' : 'rgba(220,38,38,0.6)'}`, boxShadow: encCd ? 'none' : '0 0 20px rgba(220,38,38,0.15)', cursor: encCd ? 'not-allowed' : 'pointer' }}>
                  {encCd ? `⏳ ${cdMins}m ${cdSecs}s` : '⚔️ Fight!'}
                </button>
                <button onClick={backToMap}
                  className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  ← Retreat
                </button>
                {isAdmin && (
                  <button onClick={skipEncounter}
                    className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
                    style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.8)', border: '1px solid rgba(139,92,246,0.4)' }}>
                    ⏭ Skip
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Battle
  if (state.phase === "battle" && encounter) {
    const playerUnits = party.map((c, i) => {
      const unit = makeUnit(c, true, i);
      unit.gridPos = partyGrid.get(c.contractAddress) ?? i;
      return unit;
    });
    const enemyUnits = generateEnemies(characters, party.length, encounter.aiStrength, encounter.aiDeckBias, encounter.npcAddress, encounter.npcAddresses);

    return (
      <>{floatingBack}
      <PartyCombat
        players={playerUnits}
        enemies={enemyUnits}
        onWin={() => {
          // Check if NPC joins party
          if (encounter.joinsParty && party.length < 4) {
            const npc = characters.find(c => c.contractAddress.toLowerCase() === encounter.joinsParty!.toLowerCase());
            if (npc && !party.some(p => p.contractAddress.toLowerCase() === npc.contractAddress.toLowerCase())) {
              setParty(prev => [...prev, npc]);
              const usedPositions = new Set(partyGrid.values());
              const emptySlot = [4, 3, 5, 7, 6, 8, 1, 0, 2].find(s => !usedPositions.has(s)) ?? 4;
              setPartyGrid(prev => new Map(prev).set(npc.contractAddress, emptySlot));
            }
          }
          // Auto LP reward for World 1 levels
          if (state.currentChapter === 0) {
            sendLpRewards();
          }
          winBattle();
        }}
        onLose={loseBattle}
      />
      </>
    );
  }

  // Reward
  if (state.phase === "reward" && encounter) {
    // Check if an NPC just joined from the previous encounter
    const prevEncounterIdx = state.currentEncounter - 1;
    const prevEncounter = prevEncounterIdx >= 0 ? chapter?.encounters[prevEncounterIdx] : null;
    const npcJoined = prevEncounter?.joinsParty
      ? characters.find(c => c.contractAddress.toLowerCase() === prevEncounter.joinsParty!.toLowerCase())
      : null;
    // Also check current encounter for joinsParty (reward shows after win)
    const currentNpcJoined = encounter.joinsParty
      ? characters.find(c => c.contractAddress.toLowerCase() === encounter.joinsParty!.toLowerCase())
      : null;
    const joinedNpc = currentNpcJoined || npcJoined;
    const didJoin = joinedNpc && party.some(p => p.contractAddress.toLowerCase() === joinedNpc.contractAddress.toLowerCase());

    return (
      <div className="flex flex-col items-center gap-6 mt-16">
        {floatingBack}
        <div className="text-5xl">🏆</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Victory!</h2>
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-lg font-black" style={{ color: '#f0d070' }}>+{encounter.mftReward.toLocaleString()} MfT</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(201,168,76,0.5)' }}>Total: {state.mftEarned.toLocaleString()} MfT</p>
        </div>
        {didJoin && joinedNpc && (
          <div className="rounded-xl p-5 text-center"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <p className="text-lg font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
              {joinedNpc.name} joined your party!
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(74,222,128,0.5)' }}>
              They&apos;ll fight alongside you for the rest of this adventure.
            </p>
          </div>
        )}
        {lpStatus && (
          <p className="text-xs font-bold animate-pulse" style={{ color: lpStatus.includes("sent") ? 'rgba(74,222,128,0.8)' : 'rgba(201,168,76,0.7)' }}>
            {lpStatus}
          </p>
        )}
        <button onClick={nextEncounter}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
          Continue →
        </button>
      </div>
    );
  }

  // Chapter complete
  if (state.phase === "chapterComplete" && chapter) {
    return (
      <div className="flex flex-col items-center gap-6 mt-16">
        {floatingBack}
        <div className="text-5xl">👑</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Level Complete!</h2>
        <h3 className="text-lg font-bold" style={{ color: 'rgba(201,168,76,0.7)' }}>{chapter.title}</h3>
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-lg font-black" style={{ color: '#f0d070' }}>+{chapter.completionBonus.toLocaleString()} MfT bonus!</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(201,168,76,0.5)' }}>Total: {state.mftEarned.toLocaleString()} MfT</p>
        </div>
        <button onClick={backToMap}
          className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }}>
          Continue Adventure →
        </button>
      </div>
    );
  }

  return null;
}
