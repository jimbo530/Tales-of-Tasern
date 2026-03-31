"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useHexBattle, type BattlePhase } from "@/hooks/useHexBattle";
import {
  allHexes,
  hexToPixel,
  hexPolygonPoints,
  gridPixelDimensions,
  hexDistance,
  HEX_SIZE,
  type HexCoord,
} from "@/lib/hexGrid";
import { CLASSES, type CharacterClass } from "@/lib/classes";
import { isCharge, type EnemySpec } from "@/lib/hexCombat";

export type QuestEncounter = {
  questId: string;
  questName: string;
  enemies: EnemySpec[];
  mapImage?: string;          // battle map background (e.g. "/cellar_1.png")
  difficulty: "easy" | "medium" | "hard";  // for reward calculation
  playerChar?: NftCharacter;              // pre-selected from save
  playerClass?: CharacterClass;           // pre-selected from save
  playerFeats?: string[];                 // feat IDs for combat mechanics
  playerWeapon?: string;                  // equipped weapon name (determines range)
};

type Props = {
  characters: NftCharacter[];
  questEncounter?: QuestEncounter;   // if set, skip selection and auto-start
  playerFeats?: string[];           // feat IDs from save for combat bonuses
  playerWeapon?: string;            // equipped weapon name (determines range)
  onExit: () => void;
  onBattleEnd?: (outcome: "victory" | "defeat" | "retreat", difficulty: "easy" | "medium" | "hard", enemies: string[], rounds: number) => void;
  onDefeatChoice?: (choice: "perish" | "rescue") => void;  // death penalty choice
};

// ── D20 Roll Animation ──────────────────────────────────────────────────────

function D20RollButton({ onRoll, disabled }: { onRoll: () => void; disabled: boolean }) {
  const [rolling, setRolling] = useState(false);
  const [displayNum, setDisplayNum] = useState(20);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleClick() {
    if (rolling || disabled) return;
    setRolling(true);
    // Animate cycling numbers
    intervalRef.current = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * 20) + 1);
    }, 50);
    // Stop after 600ms and trigger the actual roll
    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRolling(false);
      onRoll();
    }, 600);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-30"
      style={{
        background: rolling ? "rgba(251,191,36,0.3)" : "rgba(220,38,38,0.2)",
        color: rolling ? "#f0d070" : "rgba(220,38,38,0.9)",
        border: `2px solid ${rolling ? "rgba(251,191,36,0.6)" : "rgba(220,38,38,0.5)"}`,
        fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
        boxShadow: rolling ? "0 0 20px rgba(251,191,36,0.3)" : "0 0 10px rgba(220,38,38,0.1)",
      }}
    >
      <span className="text-3xl">{rolling ? displayNum : "D20"}</span>
      <span style={{ fontSize: "0.6rem" }}>Roll to Attack!</span>
    </button>
  );
}

// ── Roll Result Display ──────────────────────────────────────────────────────

function RollResult({ natural, result }: { natural: number; result: { hit: boolean; damage: number; breakdown: string } }) {
  const isCrit = natural === 20;
  const isMiss = natural === 1;
  const color = isCrit ? "rgba(251,191,36,1)" : isMiss ? "rgba(220,38,38,0.9)" : result.hit ? "rgba(74,222,128,0.9)" : "rgba(156,163,175,0.7)";
  const label = isCrit ? "CRITICAL HIT!" : isMiss ? "CRITICAL MISS!" : result.hit ? "HIT!" : "MISS!";

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${color}` }}>
      <span className="text-2xl font-black" style={{ color, fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>{label}</span>
      <span className="text-xs" style={{ color: "rgba(232,213,176,0.7)" }}>{result.breakdown}</span>
    </div>
  );
}

// ── Phase Label ──────────────────────────────────────────────────────────────

function phaseLabel(phase: BattlePhase): string {
  switch (phase) {
    case "playerMove": return "Move Phase";
    case "playerAction": return "Action Phase";
    case "playerRoll": return "Roll to Attack";
    case "playerResult": return "Attack Result";
    case "enemyTurn": return "Enemy Turn";
    case "victory": return "Victory!";
    case "defeat": return "Defeat!";
    default: return "";
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function HexBattle({ characters, questEncounter, playerFeats, playerWeapon, onExit, onBattleEnd, onDefeatChoice }: Props) {
  const ownedChars = useMemo(() => characters.filter(c => c.owned && c.stats.con > 0), [characters]);
  const [selectedChar, setSelectedChar] = useState<NftCharacter | null>(null);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const questStarted = useRef(false);

  const { state, activeUnit, isPlayerTurn, startBattle, startQuestBattle, clickHex, playerRoll, skipMove, readyAttack, endTurn } = useHexBattle();

  // Auto-scroll combat log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.combatLog.length]);

  // Quest encounter: auto-start immediately if character/class provided, skip all pickers
  useEffect(() => {
    if (questEncounter && state.phase === "setup" && !questStarted.current) {
      const char = questEncounter.playerChar ?? selectedChar;
      const cls = questEncounter.playerClass ?? selectedClass;
      if (char && cls) {
        questStarted.current = true;
        startQuestBattle(char, questEncounter.enemies, cls, questEncounter.playerFeats ?? playerFeats, questEncounter.playerWeapon ?? playerWeapon);
      }
    }
  }, [questEncounter, selectedChar, selectedClass, state.phase, startQuestBattle]);

  // Normal battle: start when all selections made
  useEffect(() => {
    if (!questEncounter && selectedChar && selectedClass && difficulty && state.phase === "setup") {
      startBattle(selectedChar, difficulty, selectedClass, characters, playerFeats, playerWeapon);
    }
  }, [questEncounter, selectedChar, selectedClass, difficulty, state.phase, startBattle, characters]);

  // Effective difficulty for rewards
  const effectiveDifficulty = questEncounter?.difficulty ?? difficulty ?? "easy";

  // ── Character Picker ───────────────────────────────────────────────────
  if (!selectedChar) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Choose Your Champion
        </h2>
        {ownedChars.length === 0 && (
          <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>You need owned heroes with CON to battle. Connect wallet or acquire heroes.</p>
        )}
        <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
          {ownedChars.map(c => (
            <button key={c.contractAddress} onClick={() => setSelectedChar(c)}
              className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg transition-all hover:scale-105"
              style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", minWidth: 120 }}>
              {c.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/images?url=${encodeURIComponent(c.imageUrl)}`} alt={c.name}
                  className="w-14 h-14 rounded-full object-cover" style={{ border: "2px solid rgba(201,168,76,0.4)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-2xl">{"\u{1F6E1}\uFE0F"}</span>
              )}
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(201,168,76,0.8)" }}>{c.name}</span>
              <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)" }}>HP {Math.round(10 + Math.max(1, c.stats.con) * 2)} | AC {c.stats.ac} | SPD {c.stats.speed}ft</span>
            </button>
          ))}
        </div>
        <button onClick={onExit} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Back
        </button>
      </div>
    );
  }

  // ── Class Picker ──────────────────────────────────────────────────────
  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Choose Your Class
        </h2>
        <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>Playing as {selectedChar.name}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl w-full">
          {CLASSES.map(cls => {
            const keyAb = cls.keyAbilities.map(a => a.toUpperCase()).join("/");
            return (
              <button key={cls.id} onClick={() => setSelectedClass(cls)}
                className="flex flex-col items-center gap-1.5 px-3 py-4 rounded-lg transition-all hover:scale-105"
                style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
                <span className="text-2xl">{cls.emoji}</span>
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(201,168,76,0.9)" }}>{cls.name}</span>
                <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {cls.hitDie} | {keyAb}
                </span>
                <span className="text-center" style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.4)", lineHeight: 1.3 }}>
                  {cls.description.split(",")[0]}
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setSelectedChar(null)} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Change Hero
        </button>
      </div>
    );
  }

  // ── Difficulty Picker (skipped for quest encounters) ──────────────────
  if (!questEncounter && !difficulty) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Choose Encounter
        </h2>
        <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>{selectedChar.name} — {selectedClass.emoji} {selectedClass.name}</p>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {([["easy", "1 Goblin", "rgba(74,222,128,0.8)"], ["medium", "Wolf + Goblin", "rgba(251,191,36,0.8)"], ["hard", "Skeleton + Wolf + Goblin", "rgba(220,38,38,0.8)"]] as const).map(([d, label, color]) => (
            <button key={d} onClick={() => setDifficulty(d)}
              className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
              style={{ background: `${color.replace("0.8", "0.1")}`, color, border: `1px solid ${color.replace("0.8", "0.4")}` }}>
              {d.toUpperCase()} — {label}
            </button>
          ))}
          <button onClick={() => setSelectedClass(null)} className="w-full px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
            Change Class
          </button>
        </div>
      </div>
    );
  }

  // ── Battle View ────────────────────────────────────────────────────────
  const grid = allHexes();
  const { width: svgW, height: svgH } = gridPixelDimensions();
  const reachableSet = new Set(state.reachableHexes.map(h => `${h.q},${h.r}`));
  const attackablePositions = new Set(
    state.units.filter(u => state.attackableEnemies.includes(u.id)).map(u => `${u.position.q},${u.position.r}`)
  );
  const target = state.pendingTargetId ? state.units.find(u => u.id === state.pendingTargetId) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={onExit} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Retreat
        </button>
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          {questEncounter ? questEncounter.questName : selectedClass.emoji} — Round {state.round} — {phaseLabel(state.phase)}
        </span>
        {isPlayerTurn && (state.phase === "playerMove" || state.phase === "playerAction") && (
          <button onClick={endTurn} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.3)" }}>
            End Turn
          </button>
        )}
        {(!isPlayerTurn || state.phase === "playerRoll" || state.phase === "playerResult") && <div />}
      </div>

      {/* Main content: grid + action panel */}
      <div className="flex gap-3 flex-col lg:flex-row">
        {/* SVG Hex Grid */}
        <div className="flex-1 overflow-auto rounded-lg p-2" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[650px] mx-auto" style={{ minHeight: 400 }}>
            {/* Battle map background */}
            {questEncounter?.mapImage && (
              <image href={questEncounter.mapImage} x="0" y="0" width={svgW} height={svgH}
                preserveAspectRatio="xMidYMid slice" opacity="0.6" />
            )}
            {/* Grid hexes */}
            {grid.map(hex => {
              const { x, y } = hexToPixel(hex);
              const key = `${hex.q},${hex.r}`;
              const isReachable = reachableSet.has(key);
              const isAttackable = attackablePositions.has(key);
              const unit = state.units.find(u => u.currentHp > 0 && u.position.q === hex.q && u.position.r === hex.r);
              const isActiveUnit = unit && activeUnit && unit.id === activeUnit.id;

              const isRangedTarget = isAttackable && activeUnit && hexDistance(activeUnit.position, hex) > 1;

              let fill = "rgba(201,168,76,0.04)";
              let stroke = "rgba(201,168,76,0.12)";
              if (isReachable) { fill = "rgba(74,222,128,0.15)"; stroke = "rgba(74,222,128,0.4)"; }
              if (isAttackable && isRangedTarget) { fill = "rgba(251,146,60,0.2)"; stroke = "rgba(251,146,60,0.5)"; }  // orange for ranged
              else if (isAttackable) { fill = "rgba(220,38,38,0.2)"; stroke = "rgba(220,38,38,0.5)"; }  // red for melee
              if (isActiveUnit) { fill = "rgba(96,165,250,0.15)"; stroke = "rgba(96,165,250,0.5)"; }

              return (
                <g key={key} onClick={() => clickHex(hex)} style={{ cursor: isReachable || isAttackable ? "pointer" : "default" }}>
                  <polygon
                    points={hexPolygonPoints(x, y)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                  />
                  {/* Coord label (tiny, for debug) */}
                  {/*<text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="rgba(201,168,76,0.15)">{hex.q},{hex.r}</text>*/}
                </g>
              );
            })}

            {/* Unit tokens */}
            {state.units.filter(u => u.currentHp > 0).map(unit => {
              const { x, y } = hexToPixel(unit.position);
              const r = HEX_SIZE * 0.55;
              const hpPct = unit.currentHp / unit.maxHp;
              const hpColor = hpPct > 0.5 ? "rgba(74,222,128,0.9)" : hpPct > 0.25 ? "rgba(251,191,36,0.9)" : "rgba(220,38,38,0.9)";
              const borderColor = unit.isPlayer ? "rgba(96,165,250,0.8)" : "rgba(220,38,38,0.8)";

              // Resolve image URL: local paths stay as-is, external URLs get proxied
              const imgSrc = unit.imageUrl
                ? unit.imageUrl.startsWith("/")
                  ? unit.imageUrl
                  : `/api/images?url=${encodeURIComponent(unit.imageUrl)}`
                : null;

              return (
                <g key={unit.id} onClick={() => clickHex(unit.position)}>
                  {/* Token circle background */}
                  <circle cx={x} cy={y} r={r} fill="rgba(0,0,0,0.6)" stroke={borderColor} strokeWidth={2.5} />
                  {/* Character image or emoji */}
                  {imgSrc ? (
                    <>
                      <defs>
                        <clipPath id={`clip-${unit.id}`}>
                          <circle cx={x} cy={y} r={r - 2} />
                        </clipPath>
                      </defs>
                      <image
                        href={imgSrc}
                        x={x - r + 2} y={y - r + 2}
                        width={(r - 2) * 2} height={(r - 2) * 2}
                        clipPath={`url(#clip-${unit.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.2}>
                      {unit.imageEmoji ?? "\u2694\uFE0F"}
                    </text>
                  )}
                  {/* HP bar */}
                  <rect x={x - r} y={y + r + 3} width={r * 2} height={4} rx={2} fill="rgba(0,0,0,0.5)" />
                  <rect x={x - r} y={y + r + 3} width={r * 2 * hpPct} height={4} rx={2} fill={hpColor} />
                  {/* Name label */}
                  <text x={x} y={y + r + 13} textAnchor="middle" fontSize={7} fill="rgba(232,213,176,0.6)" fontFamily="'Cinzel', serif">
                    {unit.name.length > 12 ? unit.name.slice(0, 10) + ".." : unit.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Action Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-3">
          {/* Active unit info */}
          {activeUnit && (
            <div className="px-4 py-3 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
              <div className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: activeUnit.isPlayer ? "rgba(96,165,250,0.8)" : "rgba(220,38,38,0.8)" }}>
                {activeUnit.name}
              </div>
              {activeUnit.charClass && (
                <div className="text-center mb-2" style={{ fontSize: "0.55rem", color: "rgba(201,168,76,0.6)" }}>
                  {activeUnit.charClass.emoji} {activeUnit.charClass.name} — {activeUnit.charClass.hitDie}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1 text-center" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
                <div>HP<br /><span className="font-bold text-xs" style={{ color: "rgba(251,113,133,0.9)" }}>{Math.round(activeUnit.currentHp)}/{Math.round(activeUnit.maxHp)}</span></div>
                <div>AC<br /><span className="font-bold text-xs" style={{ color: "rgba(209,213,219,0.9)" }}>{activeUnit.stats.ac}</span></div>
                <div>ATK<br /><span className="font-bold text-xs" style={{ color: "rgba(251,191,36,0.9)" }}>{Math.round(activeUnit.stats.attack)}</span></div>
                <div>DEF<br /><span className="font-bold text-xs" style={{ color: "rgba(74,222,128,0.9)" }}>{Math.round(activeUnit.stats.def)}</span></div>
                <div>SPD<br /><span className="font-bold text-xs" style={{ color: "rgba(56,189,248,0.9)" }}>{activeUnit.stats.speed}ft</span></div>
                <div>INIT<br /><span className="font-bold text-xs" style={{ color: "rgba(167,139,250,0.9)" }}>{Math.round(activeUnit.stats.initiative)}</span></div>
              </div>
              {activeUnit.subtypes.length > 0 && (
                <div className="flex gap-1 mt-2 justify-center">
                  {activeUnit.subtypes.includes("electric") && <span className="px-1 rounded" style={{ fontSize: "0.5rem", background: "rgba(250,204,21,0.2)", color: "rgba(250,204,21,0.9)", border: "1px solid rgba(250,204,21,0.4)" }}>Lightning +{Math.round(activeUnit.stats.lightningDmg)}</span>}
                  {activeUnit.subtypes.includes("fire") && <span className="px-1 rounded" style={{ fontSize: "0.5rem", background: "rgba(249,115,22,0.2)", color: "rgba(249,115,22,0.9)", border: "1px solid rgba(249,115,22,0.4)" }}>Fire +{Math.round(activeUnit.stats.fireDmg)}</span>}
                </div>
              )}
            </div>
          )}

          {/* Phase-specific actions */}
          {state.phase === "playerMove" && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(74,222,128,0.8)" }}>
                Click a green hex to move ({Math.floor((activeUnit?.stats.speed ?? 30) / 5)} hexes)
              </span>
              <button onClick={skipMove} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0"
                style={{ background: "rgba(201,168,76,0.15)", color: "rgba(201,168,76,0.8)", border: "1px solid rgba(201,168,76,0.3)" }}>
                Hold
              </button>
            </div>
          )}

          {state.phase === "playerAction" && state.attackableEnemies.length > 0 && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(220,38,38,0.8)" }}>
                {activeUnit && activeUnit.weaponProperties.includes("charge") && state.attackableEnemies.some(eid => {
                  const enemy = state.units.find(u => u.id === eid);
                  return enemy && isCharge(activeUnit, enemy);
                })
                  ? "CHARGE! Click enemy for x2 damage"
                  : activeUnit && activeUnit.attackRange > 1
                    ? `Click an enemy to attack (range ${activeUnit.attackRange} hex)`
                    : "Click an adjacent enemy to attack"}
              </span>
              <button onClick={readyAttack} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0"
                style={{ background: "rgba(168,85,247,0.15)", color: "rgba(168,85,247,0.8)", border: "1px solid rgba(168,85,247,0.3)" }}
                title={activeUnit?.weaponProperties.includes("brace") ? "Set against charge — x2 damage when enemies approach" : "Hold attack until an enemy moves into range"}>
                {activeUnit?.weaponProperties.includes("brace") ? "Set" : "Ready"}
              </button>
            </div>
          )}

          {state.phase === "playerAction" && state.attackableEnemies.length === 0 && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)" }}>
              <span className="text-xs tracking-widest uppercase" style={{ color: "rgba(201,168,76,0.5)" }}>
                No enemies in {activeUnit && activeUnit.attackRange > 1 ? "range" : "melee range"}
              </span>
              <button onClick={readyAttack} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0"
                style={{ background: "rgba(168,85,247,0.15)", color: "rgba(168,85,247,0.8)", border: "1px solid rgba(168,85,247,0.3)" }}
                title={activeUnit?.weaponProperties.includes("brace") ? "Set against charge — x2 damage when enemies approach" : "Hold attack until an enemy moves into range"}>
                {activeUnit?.weaponProperties.includes("brace") ? "Set" : "Ready"}
              </button>
            </div>
          )}

          {state.phase === "playerRoll" && target && (() => {
            const dist = activeUnit ? hexDistance(activeUnit.position, target.position) : 1;
            const charging = activeUnit?.weaponProperties.includes("charge") && activeUnit && isCharge(activeUnit, target);
            return (
            <div className="flex flex-col items-center gap-3">
              <div className="text-xs font-bold tracking-widest uppercase" style={{ color: charging ? "rgba(251,146,60,0.9)" : dist > 1 ? "rgba(251,146,60,0.8)" : "rgba(220,38,38,0.8)" }}>
                {charging ? "LANCE CHARGE (x2 damage) — " : dist > 1 ? `Ranged attack (${dist} hex) — ` : ""}Attacking {target.name} (AC {target.stats.ac})
              </div>
              <D20RollButton onRoll={playerRoll} disabled={false} />
            </div>
            );
          })()}

          {state.phase === "playerResult" && state.lastRollNatural !== null && state.lastAttackResult && (
            <RollResult natural={state.lastRollNatural} result={state.lastAttackResult} />
          )}

          {state.phase === "enemyTurn" && (
            <div className="px-4 py-3 rounded-lg text-center" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
              <span className="text-xs font-bold tracking-widest uppercase animate-pulse" style={{ color: "rgba(220,38,38,0.8)" }}>
                Enemy turn...
              </span>
              {state.lastRollNatural !== null && state.lastAttackResult && (
                <div className="mt-2">
                  <RollResult natural={state.lastRollNatural} result={state.lastAttackResult} />
                </div>
              )}
            </div>
          )}

          {/* Victory / Defeat */}
          {state.phase === "victory" && (
            <div className="flex flex-col items-center gap-3 px-4 py-6 rounded-lg" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.4)" }}>
              <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(74,222,128,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                Victory!
              </span>
              <button onClick={() => {
                if (onBattleEnd) {
                  const enemyNames = state.units.filter(u => !u.isPlayer).map(u => u.name);
                  onBattleEnd("victory", effectiveDifficulty, enemyNames, state.round);
                }
                onExit();
              }} className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: "rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.9)", border: "1px solid rgba(74,222,128,0.4)" }}>
                Collect Rewards
              </button>
            </div>
          )}

          {state.phase === "defeat" && (
            <div className="flex flex-col items-center gap-3 px-4 py-6 rounded-lg" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.4)" }}>
              <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(220,38,38,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                You Have Fallen
              </span>
              <p className="text-xs text-center max-w-xs" style={{ color: "rgba(232,213,176,0.7)" }}>
                Your soul drifts toward the void. A faint light flickers &mdash; the Temple of Namaris offers rescue... for a price.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {/* Rescue option — pay ETH, keep everything */}
                <button onClick={() => {
                  if (onBattleEnd) {
                    const enemyNames = state.units.filter(u => !u.isPlayer).map(u => u.name);
                    onBattleEnd("defeat", effectiveDifficulty, enemyNames, state.round);
                  }
                  onDefeatChoice?.("rescue");
                }} className="flex flex-col items-center px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#f0d070", border: "1px solid rgba(251,191,36,0.4)" }}>
                  <span>Temple Rescue &mdash; 0.0005 ETH</span>
                  <span className="text-[0.6rem] normal-case tracking-normal font-normal" style={{ color: "rgba(232,213,176,0.5)" }}>
                    Teleport to Kardov&apos;s Gate. Keep all levels, items &amp; gold.
                  </span>
                </button>
                {/* Perish option — lose everything */}
                <button onClick={() => {
                  if (onBattleEnd) {
                    const enemyNames = state.units.filter(u => !u.isPlayer).map(u => u.name);
                    onBattleEnd("defeat", effectiveDifficulty, enemyNames, state.round);
                  }
                  onDefeatChoice?.("perish");
                }} className="flex flex-col items-center px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(220,38,38,0.08)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.3)" }}>
                  <span>Accept Death</span>
                  <span className="text-[0.6rem] normal-case tracking-normal font-normal" style={{ color: "rgba(232,213,176,0.4)" }}>
                    Lose all levels, items &amp; gold. Restart from nothing.
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* All units HP summary */}
          <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>Units</div>
            {state.units.map(u => (
              <div key={u.id} className="flex items-center gap-2 py-0.5">
                <span style={{ fontSize: "0.6rem", color: u.isPlayer ? "rgba(96,165,250,0.8)" : "rgba(220,38,38,0.7)" }}>
                  {u.imageEmoji ?? "\u2694\uFE0F"}
                </span>
                <span className="flex-1 text-xs" style={{ color: u.currentHp > 0 ? "rgba(232,213,176,0.6)" : "rgba(232,213,176,0.25)", textDecoration: u.currentHp <= 0 ? "line-through" : undefined }}>
                  {u.name}
                </span>
                <span className="text-xs font-bold" style={{ color: u.currentHp > 0 ? "rgba(251,113,133,0.8)" : "rgba(251,113,133,0.3)" }}>
                  {Math.round(u.currentHp)}/{Math.round(u.maxHp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Combat Log */}
      <div className="px-3 py-2 rounded-lg overflow-y-auto" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.1)", maxHeight: 160 }}>
        <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(201,168,76,0.4)", fontSize: "0.5rem" }}>Combat Log</div>
        {state.combatLog.map(entry => {
          const color =
            entry.type === "crit" ? "rgba(251,191,36,0.9)" :
            entry.type === "hit" ? "rgba(74,222,128,0.8)" :
            entry.type === "miss" ? "rgba(156,163,175,0.5)" :
            entry.type === "kill" ? "rgba(220,38,38,0.9)" :
            entry.type === "system" ? "rgba(96,165,250,0.6)" :
            "rgba(232,213,176,0.5)";
          return (
            <div key={entry.id} className="py-0.5" style={{ fontSize: "0.6rem", color, fontFamily: "'Cinzel', serif" }}>
              {entry.text}
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
