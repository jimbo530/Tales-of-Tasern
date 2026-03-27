"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdventure } from "@/hooks/useAdventure";
import { useNftImage } from "@/hooks/useNftImage";
import type { NftCharacter } from "@/hooks/useNftStats";
import { makeUnit, resolveRound, generateEnemies, type CombatUnit, type CombatEvent } from "@/lib/adventureCombat";

type Props = {
  characters: NftCharacter[];
  onExit: () => void;
};

function UnitPortrait({ unit, small }: { unit: CombatUnit; small?: boolean }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(unit.character.metadataUri);
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
  // Target selection: which hero is picking, and what targets are assigned
  const [selectingHero, setSelectingHero] = useState<number | null>(null);
  const [targets, setTargets] = useState<Map<number, number>>(new Map());

  const alivePlayers = players.filter(p => p.currentHp > 0);
  const aliveEnemies = enemies.filter(e => e.currentHp > 0);
  const allTargetsSet = !fighting && alivePlayers.every(p => targets.has(p.index));

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  const doRound = useCallback((overrideTargets?: Map<number, number>) => {
    if (done) return;
    const result = resolveRound(players, enemies, overrideTargets ?? targets);
    setPlayers(result.players);
    setEnemies(result.enemies);
    setLog(prev => [...prev, ...result.events]);
    setRound(r => r + 1);
    setTargets(new Map()); // reset targets for next round
    setSelectingHero(null);

    const playersAlive = result.players.some(p => p.currentHp > 0);
    const enemiesAlive = result.enemies.some(e => e.currentHp > 0);

    if (!enemiesAlive) setDone("win");
    else if (!playersAlive) setDone("lose");
  }, [players, enemies, done, targets]);

  // Auto-fight mode
  useEffect(() => {
    if (!fighting || done) return;
    const t = setInterval(doRound, 1500);
    return () => clearInterval(t);
  }, [fighting, done, doRound]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <div className="text-xs tracking-widest uppercase font-bold" style={{ color: 'rgba(201,168,76,0.6)' }}>
        Round {round}
      </div>

      {/* Enemy party — clickable when selecting target */}
      <div className="w-full rounded-xl p-4 battle-arena">
        <p className="text-center text-xs tracking-widest uppercase mb-3" style={{ color: 'rgba(220,38,38,0.5)' }}>
          {selectingHero !== null ? `Select target for ${players[selectingHero]?.character.name}` : "Enemies"}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {enemies.map((e, i) => {
            const isTargeted = [...targets.values()].includes(e.index);
            const canTarget = selectingHero !== null && e.currentHp > 0;
            return (
              <div key={i} onClick={() => {
                if (canTarget && selectingHero !== null) {
                  setTargets(prev => new Map(prev).set(selectingHero, e.index));
                  setSelectingHero(null);
                }
              }}
                className="transition-all"
                style={{
                  cursor: canTarget ? 'pointer' : 'default',
                  outline: canTarget ? '2px dashed rgba(220,38,38,0.6)' : isTargeted ? '2px solid rgba(251,191,36,0.5)' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '0.5rem',
                }}>
                <UnitPortrait unit={e} />
                {isTargeted && <p className="text-center" style={{ color: 'rgba(251,191,36,0.7)', fontSize: '0.5rem' }}>🎯</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* VS */}
      <div className="text-2xl" style={{ color: 'rgba(201,168,76,0.4)' }}>⚔️</div>

      {/* Player party — click to select who targets */}
      <div className="w-full rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)' }}>
        <p className="text-center text-xs tracking-widest uppercase mb-3" style={{ color: 'rgba(201,168,76,0.5)' }}>
          {!fighting && !done ? "Click a hero, then click an enemy to target" : "Your Party"}
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {players.map((p, i) => {
            const hasTarget = targets.has(p.index);
            const isSelecting = selectingHero === p.index;
            const targetEnemy = hasTarget ? enemies[targets.get(p.index)!] : null;
            return (
              <div key={i} onClick={() => {
                if (!fighting && !done && p.currentHp > 0) setSelectingHero(p.index);
              }}
                className="transition-all"
                style={{
                  cursor: !fighting && !done && p.currentHp > 0 ? 'pointer' : 'default',
                  outline: isSelecting ? '2px solid rgba(201,168,76,0.8)' : 'none',
                  outlineOffset: '3px',
                  borderRadius: '0.5rem',
                }}>
                <UnitPortrait unit={p} />
                {hasTarget && targetEnemy && (
                  <p className="text-center" style={{ color: 'rgba(251,191,36,0.6)', fontSize: '0.45rem' }}>
                    → {targetEnemy.character.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      {!done && (
        <div className="flex gap-3 flex-wrap justify-center">
          {!fighting ? (
            <>
              <button onClick={() => doRound()}
                className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: allTargetsSet ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)' }}>
                ⚔️ {allTargetsSet ? "Attack!" : "Attack (auto-target remaining)"}
              </button>
              <button onClick={() => setFighting(true)}
                className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                ⚡ Auto-Fight
              </button>
              {targets.size > 0 && (
                <button onClick={() => { setTargets(new Map()); setSelectingHero(null); }}
                  className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  Clear Targets
                </button>
              )}
            </>
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

function PartyPicker({ characters, onStart, onBack }: {
  characters: NftCharacter[];
  onStart: (party: NftCharacter[]) => void;
  onBack: () => void;
}) {
  const [party, setParty] = useState<NftCharacter[]>([]);
  const owned = characters.filter(c => c.owned);
  const pool = owned.length > 0 ? owned : characters;
  const partyAddrs = new Set(party.map(c => c.contractAddress));

  function toggle(card: NftCharacter) {
    if (partyAddrs.has(card.contractAddress)) {
      setParty(prev => prev.filter(c => c.contractAddress !== card.contractAddress));
    } else if (party.length < 4) {
      setParty(prev => [...prev, card]);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
      <h3 className="text-lg font-black tracking-widest text-gold-shimmer uppercase">Choose Your Party</h3>
      <p className="text-sm" style={{ color: 'rgba(201,168,76,0.5)' }}>
        Select 1-4 heroes. More heroes = harder enemies.
      </p>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold" style={{ color: 'rgba(201,168,76,0.8)' }}>
          {party.length}/4 selected
        </span>
        {party.length > 0 && (
          <button onClick={() => onStart(party)}
            className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)' }}>
            ⚔️ Begin!
          </button>
        )}
      </div>
      <div className="w-full max-h-[50vh] overflow-y-auto rounded-lg p-3"
        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {pool.map((card) => {
            const picked = partyAddrs.has(card.contractAddress);
            return (
              <div key={card.contractAddress} onClick={() => toggle(card)}
                className="rounded-lg p-1.5 cursor-pointer transition-all text-center"
                style={{
                  background: picked ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${picked ? 'rgba(201,168,76,0.7)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                <p className="text-xs font-bold truncate" style={{
                  color: picked ? 'rgba(201,168,76,0.9)' : 'rgba(232,213,176,0.6)', fontSize: '0.5rem',
                }}>{card.name}</p>
                {picked && <span className="text-xs font-black" style={{ color: '#f0d070', fontSize: '0.5rem' }}>⚔️</span>}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onBack}
        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ← Back
      </button>
    </div>
  );
}

export function AdventureMode({ characters, onExit }: Props) {
  const { state, chapter, encounter, chapters, startChapter, startBattle, winBattle, loseBattle, nextEncounter, backToMap, resetAdventure } = useAdventure();
  const [party, setParty] = useState<NftCharacter[]>([]);
  const [pickingParty, setPickingParty] = useState(false);

  // Map screen
  if (state.phase === "map") {
    return (
      <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto mt-8">
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Adventure ⚜
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: 'rgba(201,168,76,0.8)' }}>
            💰 {state.mftEarned.toLocaleString()} MfT earned
          </span>
        </div>

        <div className="w-full flex flex-col gap-4">
          {chapters.map((ch, i) => {
            const completed = state.completedChapters.includes(ch.id);
            const locked = i > 0 && !state.completedChapters.includes(chapters[i - 1].id);
            return (
              <div key={ch.id}
                onClick={() => !locked && (() => { startChapter(i); setPickingParty(true); })()}
                className="rounded-xl p-5 cursor-pointer transition-all"
                style={{
                  background: completed ? 'rgba(34,197,94,0.1)' : locked ? 'rgba(255,255,255,0.02)' : 'rgba(201,168,76,0.08)',
                  border: `1px solid ${completed ? 'rgba(34,197,94,0.3)' : locked ? 'rgba(255,255,255,0.06)' : 'rgba(201,168,76,0.3)'}`,
                  opacity: locked ? 0.4 : 1, cursor: locked ? 'not-allowed' : 'pointer',
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm tracking-widest uppercase"
                      style={{ color: completed ? 'rgba(74,222,128,0.9)' : 'rgba(201,168,76,0.9)' }}>
                      {completed ? '✅ ' : locked ? '🔒 ' : '⚔️ '}
                      Chapter {i + 1}: {ch.title}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'rgba(232,213,176,0.5)' }}>
                      {ch.encounters.length} encounters · {ch.encounters.reduce((s, e) => s + e.mftReward, 0) + ch.completionBonus} MfT
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onExit} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Back
          </button>
          {state.mftEarned > 0 && (
            <button onClick={resetAdventure} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(220,38,38,0.1)', color: 'rgba(220,38,38,0.5)', border: '1px solid rgba(220,38,38,0.2)' }}>
              Reset Progress
            </button>
          )}
        </div>
      </div>
    );
  }

  // Party picker
  if (pickingParty) {
    return (
      <PartyPicker characters={characters}
        onStart={(p) => { setParty(p); setPickingParty(false); }}
        onBack={() => { setPickingParty(false); backToMap(); }}
      />
    );
  }

  // Story
  if (state.phase === "story" && chapter && encounter) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto mt-8">
        <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.4)' }}>
          Chapter {state.currentChapter + 1}: {chapter.title} — Encounter {state.currentEncounter + 1}/{chapter.encounters.length}
        </p>
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
        <div className="flex gap-3">
          <button onClick={startBattle}
            className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(220,38,38,0.3)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.6)', boxShadow: '0 0 20px rgba(220,38,38,0.15)' }}>
            ⚔️ Fight!
          </button>
          <button onClick={backToMap}
            className="px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Retreat
          </button>
        </div>
      </div>
    );
  }

  // Battle
  if (state.phase === "battle" && encounter) {
    const playerUnits = party.map((c, i) => makeUnit(c, true, i));
    const enemyUnits = generateEnemies(characters, party.length, encounter.aiStrength, encounter.aiDeckBias);

    return (
      <PartyCombat
        players={playerUnits}
        enemies={enemyUnits}
        onWin={winBattle}
        onLose={loseBattle}
      />
    );
  }

  // Reward
  if (state.phase === "reward" && encounter) {
    return (
      <div className="flex flex-col items-center gap-6 mt-16">
        <div className="text-5xl">🏆</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Victory!</h2>
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <p className="text-lg font-black" style={{ color: '#f0d070' }}>+{encounter.mftReward.toLocaleString()} MfT</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(201,168,76,0.5)' }}>Total: {state.mftEarned.toLocaleString()} MfT</p>
        </div>
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
        <div className="text-5xl">👑</div>
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>Chapter Complete!</h2>
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
