"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { isCharge, isConscious, isAlive, isDead, isUnconscious, createMonsterSpec, type EnemySpec, type SpellUnitInfo, abilityMod } from "@/lib/hexCombat";
import { getSpell, getSpellSlots, bonusSpells, type Spell } from "@/lib/spells";
import { getAvailableAbilities, ABILITY_DEFS, type AvailableAbility } from "@/lib/classAbilities";
import { MONSTERS } from "@/lib/monsters";
import type { DungeonRoom } from "@/lib/dungeons";

export type QuestEncounter = {
  questId: string;
  questName: string;
  enemies: EnemySpec[];
  mapImage?: string;          // battle map background (e.g. "/cellar_1.png")
  difficulty: "easy" | "medium" | "hard" | "deadly";  // for reward calculation
  playerChar?: NftCharacter;              // pre-selected from save
  playerClass?: CharacterClass;           // pre-selected from save
  playerFeats?: string[];                 // feat IDs for combat mechanics
  playerWeapon?: string;                  // equipped weapon name (determines range)
  playerKnownSpells?: string[];           // spell IDs known/prepared
  playerSpellSlotsUsed?: number[];        // current slots expended
  playerLevel?: number;                   // character level for caster level
  dungeon?: {
    template: import("@/lib/dungeons").DungeonTemplate;
    roomIndex: number;
  };
};

type Props = {
  characters: NftCharacter[];
  questEncounter?: QuestEncounter;   // if set, skip selection and auto-start
  playerFeats?: string[];           // feat IDs from save for combat bonuses
  playerWeapon?: string;            // equipped weapon name (determines range)
  playerArmorEffect?: string;       // equipped armor effect string (e.g. "+4 AC, max Dex +4")
  playerShieldEffect?: string;      // equipped shield effect string
  playerKnownSpells?: string[];     // spell IDs known/prepared
  playerPreparedSpells?: string[];  // prepared spells for prepared casters
  playerSpellSlotsUsed?: number[];  // current slots expended
  playerLevel?: number;             // character level
  playerCurrentHp?: number;         // current HP (battle starts with this, not full)
  playerFollowers?: import("@/lib/party").Follower[];  // combat-capable followers
  playerProgression?: import("@/lib/party").EntityProgression;  // multiclass progression
  extraHeroes?: { char: NftCharacter; charClass?: import("@/lib/classes").CharacterClass; featIds?: string[]; weaponName?: string; currentHp?: number; progression?: import("@/lib/party").EntityProgression }[];  // additional NFT heroes in party
  onExit: () => void;
  onBattleEnd?: (outcome: "victory" | "defeat" | "retreat", difficulty: "easy" | "medium" | "hard" | "deadly", enemies: string[], rounds: number, spellSlotsUsed?: number[], remainingHp?: number, prisoners?: string[]) => Promise<{ xp: number; goldCp: number; loot: { name: string }[]; levelsGained: number; newLevel: number } | null> | void;
  onDefeatChoice?: (choice: "perish" | "rescue") => void;  // death penalty choice
  playerUseRopeBonus?: number;  // Use Rope skill ranks + DEX mod for binding prisoners
};

function dungeonRoomToSpecs(room: DungeonRoom, playerLevel: number): EnemySpec[] {
  const specs: EnemySpec[] = [];
  for (const def of room.enemies) {
    if (def.type === "monster") {
      const monster = MONSTERS.find(m => m.id === def.monsterId);
      if (!monster) continue;
      const count = def.count === "scale"
        ? Math.floor(Math.random() * 3) + 2 + Math.floor(playerLevel / 2)
        : def.count;
      for (let i = 0; i < count; i++) {
        const spec = createMonsterSpec(monster, def.emoji);
        if (def.nameOverride) spec.name = def.nameOverride;
        if (def.hpBoost) spec.hpOverride = (spec.hpOverride ?? monster.hp) + def.hpBoost;
        specs.push(spec);
      }
    } else {
      specs.push({
        name: def.name,
        imageEmoji: def.emoji,
        stats: def.stats as EnemySpec["stats"],
        subtypes: def.subtypes,
        hpOverride: def.hpOverride,
      });
    }
  }
  return specs;
}

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
    case "playerTurn": return "Your Turn";
    case "playerRoll": return "Roll to Attack";
    case "playerResult": return "Attack Result";
    case "playerReaction": return "Reaction!";
    case "enemyTurn": return "Enemy Turn";
    case "victory": return "Victory!";
    case "defeat": return "Defeat!";
    case "room_cleared": return "Room Cleared";
    default: return "";
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function HexBattle({ characters, questEncounter, playerFeats, playerWeapon, playerArmorEffect, playerShieldEffect, playerKnownSpells, playerPreparedSpells, playerSpellSlotsUsed, playerLevel, playerCurrentHp, playerFollowers, playerProgression, extraHeroes, onExit, onBattleEnd, onDefeatChoice, playerUseRopeBonus }: Props) {
  const ownedChars = useMemo(() => characters.filter(c => c.owned && c.stats.con > 0), [characters]);
  const [selectedChar, setSelectedChar] = useState<NftCharacter | null>(null);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "deadly" | null>(null);
  const [battleRewards, setBattleRewards] = useState<{ xp: number; goldCp: number; loot: { name: string }[]; levelsGained: number; newLevel: number } | null>(null);
  const [collectingRewards, setCollectingRewards] = useState(false);
  const [showSpellPicker, setShowSpellPicker] = useState(false);
  const [boundPrisoners, setBoundPrisoners] = useState<string[]>([]);
  const [bindResults, setBindResults] = useState<Record<string, { roll: number; total: number; success: boolean }>>({});
  const [pendingSpell, setPendingSpell] = useState<Spell | null>(null);
  const [showRetreatPicker, setShowRetreatPicker] = useState(false);
  const [showAbilityPicker, setShowAbilityPicker] = useState(false);
  const [pendingAbility, setPendingAbility] = useState<AvailableAbility | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const questStarted = useRef(false);
  const [damagePopups, setDamagePopups] = useState<Array<{ id: string; x: number; y: number; text: string; type: 'damage' | 'heal' | 'miss'; timestamp: number }>>([]);

  const { state, activeUnit, isPlayerTurn, startBattle, startQuestBattle, clickHex, playerRoll, skipMove, readyAttack, endTurn, castSpell, useAbility, attemptRetreat, takeAoO, passAoO, isDungeon, dungeonRoomIndex, dungeonTotalRooms, dungeonName, dungeonRoomCleared, canDungeonRest, advanceRoom, dungeonShortRest, dungeonRetreat } = useHexBattle();

  /** Build SpellUnitInfo from props + selected class */
  const buildSpellInfo = useCallback((char: NftCharacter, cls: CharacterClass): SpellUnitInfo | undefined => {
    if (!cls.spellcasting) return undefined;
    const sc = cls.spellcasting;
    const lvl = questEncounter?.playerLevel ?? playerLevel ?? 1;
    if (lvl < sc.startsAt) return undefined;
    const slots = getSpellSlots(sc.casterClass, lvl);
    const abilityScore = char.stats[sc.ability];
    const bonus = bonusSpells(abilityScore);
    const totalSlots = slots.map((s, i) => (s ?? 0) + (bonus[i] ?? 0));
    const usedSlots = questEncounter?.playerSpellSlotsUsed ?? playerSpellSlotsUsed ?? [];
    // Available spells: known (sorc/bard) or prepared (wiz/cleric) that have battle effects
    const spellIds = questEncounter?.playerKnownSpells ?? playerKnownSpells ?? playerPreparedSpells ?? [];
    const battleSpells = spellIds.filter(id => { const sp = getSpell(id); return sp?.battle; });
    return {
      spellSlots: totalSlots,
      spellSlotsUsed: [...usedSlots],
      availableSpells: battleSpells,
      casterLevel: lvl,
      castingAbilityMod: abilityMod(abilityScore),
    };
  }, [questEncounter, playerLevel, playerSpellSlotsUsed, playerKnownSpells, playerPreparedSpells]);

  // Auto-scroll combat log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.combatLog.length]);

  // ── Floating damage popups: watch combat log for new entries ──
  const prevLogLen = useRef(0);
  useEffect(() => {
    const newEntries = state.combatLog.slice(prevLogLen.current);
    prevLogLen.current = state.combatLog.length;
    if (newEntries.length === 0) return;

    const pops: typeof damagePopups = [];
    for (const entry of newEntries) {
      // Parse damage: "X deals 5 damage to Y" / "X attacks Y: ... 7 damage"
      const dmgMatch = entry.text.match(/(\d+)\s*(?:damage|dmg)\s*to\s+(\S.+?)(?:\s*[.!]|$)/i)
        ?? entry.text.match(/attacks?\s+(\S.+?)[\s:].+?(\d+)\s*(?:damage|dmg)/i);
      // Parse heal: "heals X for 5" / "5 healing"
      const healMatch = entry.text.match(/heals?\s+(\S.+?)\s+for\s+(\d+)/i)
        ?? entry.text.match(/(\S.+?)\s+(?:heals?|regains?)\s+(\d+)/i);
      // Miss entries
      const isMiss = entry.type === "miss";

      if (dmgMatch || healMatch || isMiss) {
        // Find which unit was targeted
        let targetUnit = null;
        if (dmgMatch) {
          // targetName is in the match — find matching unit
          const tName = (dmgMatch[2] ?? dmgMatch[1]).trim().toLowerCase();
          targetUnit = state.units.find(u => u.name.toLowerCase() === tName || tName.startsWith(u.name.toLowerCase()));
        } else if (healMatch) {
          const tName = (healMatch[1]).trim().toLowerCase();
          targetUnit = state.units.find(u => u.name.toLowerCase() === tName || tName.startsWith(u.name.toLowerCase()));
        } else if (isMiss) {
          // "X attacks Y" — target is after "attacks"
          const atkMatch = entry.text.match(/attacks?\s+(\S.+?)[\s:]/i);
          if (atkMatch) {
            const tName = atkMatch[1].trim().toLowerCase();
            targetUnit = state.units.find(u => u.name.toLowerCase() === tName || tName.startsWith(u.name.toLowerCase()));
          }
        }

        if (targetUnit) {
          const { x, y } = hexToPixel(targetUnit.position);
          const popType = healMatch ? 'heal' as const : isMiss && !dmgMatch ? 'miss' as const : 'damage' as const;
          const popText = healMatch ? `+${healMatch[2]}` : dmgMatch ? `-${dmgMatch[2] ?? dmgMatch[1]}` : "MISS";
          pops.push({ id: `${Date.now()}-${entry.id}`, x, y: y - 10, text: popText, type: popType, timestamp: Date.now() });
        }
      }
    }
    if (pops.length > 0) {
      setDamagePopups(prev => [...prev, ...pops]);
    }
  }, [state.combatLog.length, state.combatLog, state.units]);

  // Auto-remove damage popups after 1.5 seconds
  useEffect(() => {
    if (damagePopups.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setDamagePopups(prev => prev.filter(p => now - p.timestamp < 1500));
    }, 1600);
    return () => clearTimeout(timer);
  }, [damagePopups]);

  // Quest encounter: auto-start immediately if character/class provided, skip all pickers
  useEffect(() => {
    if (questEncounter && state.phase === "setup" && !questStarted.current) {
      const char = questEncounter.playerChar ?? selectedChar;
      const cls = questEncounter.playerClass ?? selectedClass;
      if (char && cls) {
        questStarted.current = true;
        const si = buildSpellInfo(char, cls);
        const dungeonParam = questEncounter.dungeon ? {
          dungeonId: questEncounter.dungeon.template.id,
          dungeonName: questEncounter.dungeon.template.name,
          dungeonRoomIndex: questEncounter.dungeon.roomIndex,
          dungeonTotalRooms: questEncounter.dungeon.template.rooms.length,
          dungeonCanRest: questEncounter.dungeon.template.rooms[questEncounter.dungeon.roomIndex]?.canRest,
        } : undefined;
        startQuestBattle(char, questEncounter.enemies, cls, questEncounter.playerFeats ?? playerFeats, questEncounter.playerWeapon ?? playerWeapon, si, playerCurrentHp, playerFollowers, playerProgression, extraHeroes, playerArmorEffect, playerShieldEffect, dungeonParam);
      }
    }
  }, [questEncounter, selectedChar, selectedClass, state.phase, startQuestBattle, buildSpellInfo]);

  // Dungeon room transition: when useHexBattle sets phase to "setup" after DUNGEON_NEXT_ROOM,
  // load the next room's enemies and re-start the battle with current player HP.
  useEffect(() => {
    if (!questEncounter?.dungeon || state.phase !== "setup" || !questStarted.current) return;
    if (!isDungeon || dungeonRoomIndex === 0) return;
    const template = questEncounter.dungeon.template;
    const room = template.rooms[dungeonRoomIndex];
    if (!room) return;
    const char = questEncounter.playerChar ?? selectedChar;
    const cls = questEncounter.playerClass ?? selectedClass;
    if (!char || !cls) return;
    const si = buildSpellInfo(char, cls);
    const roomEnemies = dungeonRoomToSpecs(room, questEncounter.playerLevel ?? 1);
    const survivingPlayer = state.units.find(u => u.id === "player");
    const currentPlayerHp = survivingPlayer ? survivingPlayer.currentHp : undefined;
    startQuestBattle(char, roomEnemies, cls, questEncounter.playerFeats ?? playerFeats, questEncounter.playerWeapon ?? playerWeapon, si, currentPlayerHp ?? playerCurrentHp, playerFollowers, playerProgression, extraHeroes, playerArmorEffect, playerShieldEffect, {
      dungeonId: template.id,
      dungeonName: template.name,
      dungeonRoomIndex: dungeonRoomIndex,
      dungeonTotalRooms: template.rooms.length,
      dungeonCanRest: room.canRest,
    });
  }, [state.phase, isDungeon, dungeonRoomIndex]);

  // Normal battle: start when all selections made
  useEffect(() => {
    if (!questEncounter && selectedChar && selectedClass && difficulty && state.phase === "setup") {
      const si = buildSpellInfo(selectedChar, selectedClass);
      startBattle(selectedChar, difficulty, selectedClass, characters, playerFeats, playerWeapon, si, playerCurrentHp, playerFollowers, playerProgression, extraHeroes, playerArmorEffect, playerShieldEffect);
    }
  }, [questEncounter, selectedChar, selectedClass, difficulty, state.phase, startBattle, characters, buildSpellInfo]);

  // Effective difficulty for rewards
  const effectiveDifficulty = questEncounter?.difficulty ?? difficulty ?? "easy";

  // Spell system helpers
  const playerUnit = state.units.find(u => u.isPlayer);
  const canCastSpells = !!(playerUnit?.availableSpells && playerUnit.availableSpells.length > 0 && playerUnit.spellSlots);

  /** Get castable spells grouped by level with remaining slot counts */
  const castableSpells = useMemo(() => {
    if (!playerUnit?.availableSpells || !playerUnit.spellSlots) return [];
    const spells: { spell: Spell; level: number; slotsLeft: number }[] = [];
    const casterClassId = playerUnit.charClass?.spellcasting?.casterClass;
    if (!casterClassId) return [];
    for (const id of playerUnit.availableSpells) {
      const sp = getSpell(id);
      if (!sp?.battle) continue;
      const lvl = sp.levels[casterClassId] ?? -1;
      if (lvl < 0) continue;
      const maxSlots = playerUnit.spellSlots[lvl] ?? 0;
      const usedSlots = playerUnit.spellSlotsUsed?.[lvl] ?? 0;
      const left = maxSlots - usedSlots;
      if (left > 0 || lvl === 0) spells.push({ spell: sp, level: lvl, slotsLeft: left });
    }
    return spells.sort((a, b) => a.level - b.level || a.spell.name.localeCompare(b.spell.name));
  }, [playerUnit]);

  // Handle hex click with spell/ability targeting
  const handleHexClick = useCallback((hex: HexCoord) => {
    // Ability targeting
    if (pendingAbility && state.phase === "playerTurn" && playerUnit) {
      const enemy = state.units.find(u => u.position.q === hex.q && u.position.r === hex.r && !u.isPlayer && isConscious(u));
      if (enemy) {
        const def = ABILITY_DEFS[pendingAbility.effectId];
        if (def && hexDistance(playerUnit.position, enemy.position) <= def.range) {
          useAbility(pendingAbility.effectId, enemy.id);
          setPendingAbility(null);
        }
      }
      return;
    }
    // Spell targeting
    if (pendingSpell && state.phase === "playerTurn" && playerUnit) {
      const battle = pendingSpell.battle;
      if (!battle) return;
      if (battle.type === "healing" || battle.type === "buff") {
        if (hex.q === playerUnit.position.q && hex.r === playerUnit.position.r) {
          castSpell(pendingSpell.id, playerUnit.id);
          setPendingSpell(null);
        }
      } else {
        const enemy = state.units.find(u => u.position.q === hex.q && u.position.r === hex.r && !u.isPlayer && isConscious(u));
        if (enemy) {
          const dist = hexDistance(playerUnit.position, enemy.position);
          if (dist <= (battle.hexRange ?? 1)) {
            castSpell(pendingSpell.id, enemy.id);
            setPendingSpell(null);
          }
        }
      }
      return;
    }
    clickHex(hex);
  }, [pendingAbility, pendingSpell, state.phase, state.units, playerUnit, clickHex, castSpell, useAbility]);

  /** Select a spell from the picker */
  const selectSpell = useCallback((spell: Spell) => {
    setShowSpellPicker(false);
    if (!spell.battle || !playerUnit) return;
    // Self-targeting spells: cast immediately
    if (spell.battle.type === "healing" || spell.battle.type === "buff") {
      if (spell.battle.hexRange <= 1) {
        castSpell(spell.id, playerUnit.id);
        return;
      }
    }
    // Targeted spells: need target selection
    setPendingSpell(spell);
  }, [playerUnit, castSpell]);

  // Spell targeting: highlight valid targets (must be before early returns — hooks order)
  const spellTargetPositions = useMemo(() => {
    if (!pendingSpell?.battle || !playerUnit) return new Set<string>();
    const range = pendingSpell.battle.hexRange;
    if (pendingSpell.battle.type === "healing" || pendingSpell.battle.type === "buff") {
      return new Set([`${playerUnit.position.q},${playerUnit.position.r}`]);
    }
    return new Set(
      state.units.filter(u => !u.isPlayer && isConscious(u) && hexDistance(playerUnit.position, u.position) <= range)
        .map(u => `${u.position.q},${u.position.r}`)
    );
  }, [pendingSpell, playerUnit, state.units]);

  // ── Class Ability picker ────────────────────────────────────────────────
  const availableAbilities = useMemo(() => {
    if (!activeUnit || !activeUnit.isPlayer) return [];
    return getAvailableAbilities(activeUnit);
  }, [activeUnit]);

  const hasAbilities = availableAbilities.length > 0;

  const selectAbility = useCallback((ability: AvailableAbility) => {
    setShowAbilityPicker(false);
    if (!playerUnit) return;
    const def = ABILITY_DEFS[ability.effectId];
    if (!def) return;
    // Self / allAllies / none — resolve immediately
    if (def.targetKind === "self" || def.targetKind === "allAllies" || def.targetKind === "none") {
      useAbility(ability.effectId);
      return;
    }
    // Ally targeting — for now, target self (heal/layOnHands)
    if (def.targetKind === "ally") {
      // If range 1 and adjacent allies exist, could pick target — simplified to self for now
      useAbility(ability.effectId, playerUnit.id);
      return;
    }
    // Enemy targeting — enter targeting mode
    setPendingAbility(ability);
  }, [playerUnit, useAbility]);

  // Ability targeting: highlight valid targets
  const abilityTargetPositions = useMemo(() => {
    if (!pendingAbility || !playerUnit) return new Set<string>();
    const def = ABILITY_DEFS[pendingAbility.effectId];
    if (!def) return new Set<string>();
    return new Set(
      state.units.filter(u => !u.isPlayer && isConscious(u) && hexDistance(playerUnit.position, u.position) <= def.range)
        .map(u => `${u.position.q},${u.position.r}`)
    );
  }, [pendingAbility, playerUnit, state.units]);

  // ── Character Picker ───────────────────────────────────────────────────
  // Skip pickers when quest encounter provides char/class (auto-start via useEffect)
  if (!selectedChar && !questEncounter?.playerChar) {
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
  if (!selectedClass && !questEncounter?.playerClass) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Choose Your Class
        </h2>
        <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>Playing as {selectedChar?.name ?? questEncounter?.playerChar?.name ?? "?"}</p>
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
        <p className="text-sm" style={{ color: "rgba(201,168,76,0.5)" }}>{selectedChar!.name} — {selectedClass!.emoji} {selectedClass!.name}</p>
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

  // ── IMPROVEMENT 2: Turn order sorted by initiative (descending) ──
  const turnOrderUnits = useMemo(() => {
    if (state.units.length === 0) return [];
    return [...state.units].sort((a, b) => b.stats.initiative - a.stats.initiative);
  }, [state.units]);
  const currentActiveId = state.turnOrder[state.currentTurnIndex] ?? null;

  // ── IMPROVEMENT 3: Memoized hex polygon rendering ──
  const hexPolygons = useMemo(() => {
    return grid.map(hex => {
      const { x, y } = hexToPixel(hex);
      const key = `${hex.q},${hex.r}`;
      const isReachable = reachableSet.has(key);
      const isAttackable = attackablePositions.has(key);
      const unit = state.units.find(u => isAlive(u) && u.position.q === hex.q && u.position.r === hex.r);
      const isActiveUnit = unit && activeUnit && unit.id === activeUnit.id;

      const isRangedTarget = isAttackable && activeUnit && hexDistance(activeUnit.position, hex) > 1;

      const isSpellTarget = spellTargetPositions.has(key);
      const isAbilityTarget = abilityTargetPositions.has(key);

      let fill = "rgba(201,168,76,0.04)";
      let stroke = "rgba(201,168,76,0.12)";
      if (isReachable) { fill = "rgba(74,222,128,0.15)"; stroke = "rgba(74,222,128,0.4)"; }
      if (isAttackable && isRangedTarget) { fill = "rgba(251,146,60,0.2)"; stroke = "rgba(251,146,60,0.5)"; }
      else if (isAttackable) { fill = "rgba(220,38,38,0.2)"; stroke = "rgba(220,38,38,0.5)"; }
      if (isSpellTarget) { fill = "rgba(168,85,247,0.25)"; stroke = "rgba(168,85,247,0.6)"; }
      if (isAbilityTarget) { fill = "rgba(251,191,36,0.25)"; stroke = "rgba(251,191,36,0.6)"; }
      if (isActiveUnit) { fill = "rgba(96,165,250,0.15)"; stroke = "rgba(96,165,250,0.5)"; }

      const cursor = isReachable || isAttackable || !!pendingSpell || !!pendingAbility ? "pointer" : "default";

      return { key, hex, x, y, fill, stroke, cursor, points: hexPolygonPoints(x, y) };
    });
  }, [grid, reachableSet, attackablePositions, state.units, activeUnit, spellTargetPositions, abilityTargetPositions, pendingSpell, pendingAbility]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
        {isPlayerTurn && state.phase === "playerTurn" && isConscious(state.units.find(u => u.id === "player")!) ? (
          showRetreatPicker ? (
            (() => {
              const au = state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]);
              const enemies = state.units.filter(u => !u.isPlayer && isConscious(u));
              const motivation = enemies[0]?.motivation;
              const dc = motivation === "territorial" ? 5 : motivation === "food" ? 12 : 15;
              const dexMod = au ? Math.floor((au.rawAbilities.dex - 10) / 2) : 0;
              const chaMod = au ? Math.floor((au.rawAbilities.cha - 10) / 2) : 0;
              const ranks = au?.skillRanks ?? {};
              // Enemies with INT >= 3 can understand speech
              const enemiesSpeak = enemies.some(e => e.rawAbilities.int >= 3);
              // Enemies with INT >= 1 can feel fear (not mindless)
              const enemiesFearable = enemies.some(e => e.rawAbilities.int >= 1);

              type RetreatSkill = { id: string; label: string; ability: string; mod: number; trained: boolean; available: boolean; reason?: string };
              const skills: RetreatSkill[] = [
                { id: "tumble", label: "Tumble", ability: "DEX", mod: dexMod, trained: (ranks.tumble ?? 0) > 0, available: (ranks.tumble ?? 0) > 0, reason: "Trained only" },
                { id: "bluff", label: "Bluff", ability: "CHA", mod: chaMod, trained: (ranks.bluff ?? 0) > 0, available: enemiesSpeak, reason: "Enemies don't understand speech" },
                { id: "diplomacy", label: "Diplomacy", ability: "CHA", mod: chaMod, trained: (ranks.diplomacy ?? 0) > 0, available: enemiesSpeak, reason: "Enemies don't understand speech" },
                { id: "intimidate", label: "Intimidate", ability: "CHA", mod: chaMod, trained: (ranks.intimidate ?? 0) > 0, available: enemiesFearable, reason: "Enemies are mindless" },
                { id: "hide", label: "Hide", ability: "DEX", mod: dexMod, trained: (ranks.hide ?? 0) > 0, available: true },
              ];

              const rollRetreat = (skill: RetreatSkill) => {
                const skillRanks = ranks[skill.id] ?? 0;
                const natural = Math.floor(Math.random() * 20) + 1;
                const total = natural + skillRanks + skill.mod;
                const parts = [`d20(${natural})`];
                if (skillRanks > 0) parts.push(`${skill.label} +${skillRanks}`);
                if (skill.mod !== 0) parts.push(`${skill.ability} ${skill.mod >= 0 ? "+" : ""}${skill.mod}`);
                setShowRetreatPicker(false);
                attemptRetreat(total, dc, natural, parts.join(" "));
              };

              return (
                <div className="flex items-center gap-1">
                  {skills.map(sk => {
                    const bonus = (ranks[sk.id] ?? 0) + sk.mod;
                    const sign = bonus >= 0 ? "+" : "";
                    return (
                      <button key={sk.id} disabled={!sk.available}
                        title={!sk.available ? sk.reason : `${sk.label} ${sign}${bonus} vs DC ${dc}`}
                        onClick={() => rollRetreat(sk)}
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide leading-tight"
                        style={{
                          background: sk.available ? "rgba(251,191,36,0.12)" : "rgba(100,100,100,0.1)",
                          color: sk.available ? "rgba(251,191,36,0.8)" : "rgba(150,150,150,0.4)",
                          border: `1px solid ${sk.available ? "rgba(251,191,36,0.3)" : "rgba(100,100,100,0.15)"}`,
                          cursor: sk.available ? "pointer" : "not-allowed",
                        }}>
                        {sk.label}<br /><span className="text-[9px] opacity-60">{sign}{bonus}</span>
                      </button>
                    );
                  })}
                  <button onClick={() => setShowRetreatPicker(false)}
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                    style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.6)", border: "1px solid rgba(220,38,38,0.2)" }}>
                    X
                  </button>
                </div>
              );
            })()
          ) : (
            <button onClick={() => setShowRetreatPicker(true)}
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: "rgba(251,191,36,0.1)", color: "rgba(251,191,36,0.6)", border: "1px solid rgba(251,191,36,0.2)" }}>
              Retreat
            </button>
          )
        ) : (
          <div style={{ width: 70 }} />
        )}
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          {isDungeon ? `${dungeonName} ${dungeonRoomIndex + 1}/${dungeonTotalRooms}` : questEncounter ? questEncounter.questName : selectedClass!.emoji} — Round {state.round} — {phaseLabel(state.phase)}
        </span>
        {isPlayerTurn && state.phase === "playerTurn" && (
          <button onClick={endTurn} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.3)" }}>
            End Turn
          </button>
        )}
        {(!isPlayerTurn || state.phase === "playerRoll" || state.phase === "playerResult") && <div />}
      </div>

      {/* IMPROVEMENT 2: Turn order bar */}
      {turnOrderUnits.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg overflow-x-auto" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(201,168,76,0.1)" }}>
          <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Init</span>
          {turnOrderUnits.map(u => {
            const isActive = u.id === currentActiveId;
            const dead = isDead(u);
            const unconscious = isUnconscious(u);
            const initials = u.name.slice(0, 2).toUpperCase();
            const borderColor = dead ? "rgba(100,100,100,0.3)" : unconscious ? "rgba(120,80,80,0.5)" : isActive ? "rgba(251,191,36,1)" : u.isPlayer ? "rgba(96,165,250,0.6)" : "rgba(220,38,38,0.5)";
            const bgColor = dead ? "rgba(50,50,50,0.4)" : unconscious ? "rgba(60,40,40,0.4)" : isActive ? "rgba(251,191,36,0.15)" : "rgba(0,0,0,0.3)";
            return (
              <div key={u.id} className="flex items-center gap-1 shrink-0" title={`${u.name} (Init ${Math.round(u.stats.initiative)})`}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${borderColor}`, background: bgColor,
                  boxShadow: isActive ? "0 0 8px rgba(251,191,36,0.5)" : "none",
                  fontSize: "0.45rem", fontWeight: 900, color: dead ? "rgba(100,100,100,0.5)" : "rgba(232,213,176,0.8)",
                }}>
                  {initials}
                </div>
                <span style={{
                  fontSize: "0.45rem", color: dead ? "rgba(100,100,100,0.4)" : unconscious ? "rgba(120,80,80,0.5)" : "rgba(232,213,176,0.5)",
                  textDecoration: dead ? "line-through" : undefined, whiteSpace: "nowrap",
                  fontWeight: isActive ? 700 : 400,
                }}>
                  {u.name.length > 8 ? u.name.slice(0, 7) + ".." : u.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

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
            {/* Grid hexes (IMPROVEMENT 3: memoized) */}
            {hexPolygons.map(h => (
              <g key={h.key} onClick={() => handleHexClick(h.hex)} style={{ cursor: h.cursor }}>
                <polygon points={h.points} fill={h.fill} stroke={h.stroke} strokeWidth={1.5} />
              </g>
            ))}

            {/* Unit tokens */}
            {state.units.filter(u => isAlive(u)).map(unit => {
              const { x, y } = hexToPixel(unit.position);
              const r = HEX_SIZE * 0.55;
              const hpPct = Math.max(0, unit.currentHp) / unit.maxHp;
              const unconscious = isUnconscious(unit);
              const hpColor = unconscious ? "rgba(120,80,80,0.9)" : hpPct > 0.5 ? "rgba(74,222,128,0.9)" : hpPct > 0.25 ? "rgba(251,191,36,0.9)" : "rgba(220,38,38,0.9)";
              const borderColor = unconscious ? "rgba(120,80,80,0.5)" : unit.isPlayer ? "rgba(96,165,250,0.8)" : "rgba(220,38,38,0.8)";

              // Resolve image URL: local paths stay as-is, external URLs get proxied
              const imgSrc = unit.imageUrl
                ? unit.imageUrl.startsWith("/")
                  ? unit.imageUrl
                  : `/api/images?url=${encodeURIComponent(unit.imageUrl)}`
                : null;

              return (
                <g key={unit.id} onClick={() => handleHexClick(unit.position)} opacity={unconscious ? 0.5 : 1}>
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
                  {/* Unconscious indicator */}
                  {unconscious && (
                    <text x={x} y={y + r + 21} textAnchor="middle" fontSize={6} fill="rgba(220,38,38,0.8)" fontWeight="bold">
                      {unit.stabilized ? "Stable" : `Dying (${unit.currentHp})`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* IMPROVEMENT 1: Floating damage/heal/miss popups */}
            {damagePopups.map(p => (
              <text
                key={p.id}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                fontSize={p.type === 'miss' ? 10 : 14}
                fontWeight="900"
                fontFamily="'Cinzel', serif"
                fill={p.type === 'damage' ? 'rgba(220,38,38,0.95)' : p.type === 'heal' ? 'rgba(74,222,128,0.95)' : 'rgba(156,163,175,0.8)'}
                stroke={p.type === 'damage' ? 'rgba(0,0,0,0.6)' : p.type === 'heal' ? 'rgba(0,0,0,0.4)' : 'none'}
                strokeWidth={0.5}
                style={{ animation: 'floatUp 1.5s ease-out forwards', pointerEvents: 'none' }}
              >
                {p.text}
              </text>
            ))}
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
                  {activeUnit.subtypes.includes("electric") && <span className="px-1 rounded" style={{ fontSize: "0.5rem", background: "rgba(250,204,21,0.2)", color: "rgba(250,204,21,0.9)", border: "1px solid rgba(250,204,21,0.4)" }}>Lightning +{activeUnit.stats.lightningDice ? `${activeUnit.stats.lightningDice.n}d${activeUnit.stats.lightningDice.sides}` : Math.round(activeUnit.stats.lightningDmg)}</span>}
                  {activeUnit.subtypes.includes("fire") && <span className="px-1 rounded" style={{ fontSize: "0.5rem", background: "rgba(249,115,22,0.2)", color: "rgba(249,115,22,0.9)", border: "1px solid rgba(249,115,22,0.4)" }}>Fire +{activeUnit.stats.fireDice ? `${activeUnit.stats.fireDice.n}d${activeUnit.stats.fireDice.sides}` : Math.round(activeUnit.stats.fireDmg)}</span>}
                </div>
              )}
              {activeUnit.activeEffects.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 justify-center">
                  {activeUnit.activeEffects.map((eff, i) => {
                    const isBuff = eff.buffAC || eff.buffAtk || eff.buffDmg || eff.buffSave || eff.buffSpeed;
                    const color = isBuff ? "rgba(74,222,128,0.8)" : eff.condition ? "rgba(220,38,38,0.8)" : "rgba(251,191,36,0.8)";
                    const bg = isBuff ? "rgba(74,222,128,0.15)" : eff.condition ? "rgba(220,38,38,0.1)" : "rgba(251,191,36,0.1)";
                    return <span key={i} className="px-1 rounded" style={{ fontSize: "0.45rem", background: bg, color, border: `1px solid ${color.replace("0.8", "0.4")}` }}>
                      {eff.spellName}{eff.condition ? ` (${eff.condition})` : ""} {eff.remainingRounds > 0 ? `${eff.remainingRounds}r` : ""}
                    </span>;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Phase-specific actions — unified playerTurn with 3 action buttons */}
          {state.phase === "playerTurn" && !pendingSpell && !showSpellPicker && !pendingAbility && !showAbilityPicker && (
            <div className="px-4 py-3 rounded-lg flex flex-col gap-2" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.2)" }}>
              {/* Action buttons row */}
              <div className="flex gap-2 justify-center">
                <button disabled={!!activeUnit?.hasMoved}
                  className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all"
                  style={{
                    background: activeUnit?.hasMoved ? "rgba(74,222,128,0.05)" : "rgba(74,222,128,0.15)",
                    color: activeUnit?.hasMoved ? "rgba(74,222,128,0.3)" : "rgba(74,222,128,0.9)",
                    border: `1px solid ${activeUnit?.hasMoved ? "rgba(74,222,128,0.1)" : "rgba(74,222,128,0.4)"}`,
                  }}>
                  {activeUnit?.hasMoved ? "Moved" : `Move (${Math.floor((activeUnit?.stats.speed ?? 30) / 5)})`}
                </button>
                <button disabled={!!activeUnit?.hasActed}
                  className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all"
                  style={{
                    background: activeUnit?.hasActed ? "rgba(220,38,38,0.05)" : "rgba(220,38,38,0.15)",
                    color: activeUnit?.hasActed ? "rgba(220,38,38,0.3)" : "rgba(220,38,38,0.9)",
                    border: `1px solid ${activeUnit?.hasActed ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.4)"}`,
                  }}>
                  {activeUnit?.hasActed ? "Acted" : "Attack"}
                </button>
                <button disabled
                  className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                  style={{
                    background: "rgba(251,191,36,0.05)",
                    color: "rgba(251,191,36,0.3)",
                    border: "1px solid rgba(251,191,36,0.1)",
                  }}>
                  Bonus
                </button>
              </div>
              {/* Context hints */}
              {!activeUnit?.hasMoved && (
                <span className="text-xs text-center" style={{ color: "rgba(74,222,128,0.7)" }}>
                  Click a green hex to move
                </span>
              )}
              {!activeUnit?.hasActed && state.attackableEnemies.length > 0 && (
                <span className="text-xs text-center" style={{ color: "rgba(220,38,38,0.7)" }}>
                  {activeUnit && activeUnit.weaponProperties.includes("charge") && state.attackableEnemies.some(eid => {
                    const enemy = state.units.find(u => u.id === eid);
                    return enemy && isCharge(activeUnit, enemy);
                  })
                    ? "CHARGE! Click enemy for x2 damage"
                    : activeUnit && activeUnit.attackRange > 1
                      ? `Click enemy to attack (range ${activeUnit.attackRange})`
                      : "Click an adjacent enemy to attack"}
                </span>
              )}
              {!activeUnit?.hasActed && state.attackableEnemies.length === 0 && (
                <span className="text-xs text-center" style={{ color: "rgba(201,168,76,0.4)" }}>
                  No enemies in {activeUnit && activeUnit.attackRange > 1 ? "range" : "melee range"}
                </span>
              )}
              {/* Sub-action buttons */}
              <div className="flex gap-1 justify-center flex-wrap">
                {!activeUnit?.hasMoved && (
                  <button onClick={skipMove} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.7)", border: "1px solid rgba(201,168,76,0.25)" }}>
                    Hold
                  </button>
                )}
                {canCastSpells && !activeUnit?.hasActed && (
                  <button onClick={() => setShowSpellPicker(true)} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(168,85,247,0.15)", color: "rgba(168,85,247,0.8)", border: "1px solid rgba(168,85,247,0.3)" }}>
                    Cast
                  </button>
                )}
                {hasAbilities && (
                  <button onClick={() => setShowAbilityPicker(true)} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(251,191,36,0.15)", color: "rgba(251,191,36,0.8)", border: "1px solid rgba(251,191,36,0.3)" }}>
                    Ability
                  </button>
                )}
                {!activeUnit?.hasActed && (
                  <button onClick={readyAttack} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.7)", border: "1px solid rgba(201,168,76,0.25)" }}
                    title={activeUnit?.weaponProperties.includes("brace") ? "Set against charge — x2 damage when enemies approach" : "Hold attack until an enemy moves into range"}>
                    {activeUnit?.weaponProperties.includes("brace") ? "Set" : "Ready"}
                  </button>
                )}
                <button onClick={endTurn} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
                  style={{ background: "rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.8)", border: "1px solid rgba(96,165,250,0.3)" }}>
                  End Turn
                </button>
              </div>
            </div>
          )}

          {/* Spell targeting prompt */}
          {state.phase === "playerTurn" && pendingSpell && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)" }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(168,85,247,0.9)" }}>
                {pendingSpell.name}: click a purple-highlighted target
              </span>
              <button onClick={() => setPendingSpell(null)} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0"
                style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.3)" }}>
                Cancel
              </button>
            </div>
          )}

          {/* Spell picker overlay */}
          {state.phase === "playerTurn" && showSpellPicker && (
            <div className="px-3 py-2 rounded-lg overflow-y-auto" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(168,85,247,0.4)", maxHeight: 260 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(168,85,247,0.9)" }}>Cast Spell</span>
                <button onClick={() => setShowSpellPicker(false)} className="px-2 py-0.5 rounded text-xs"
                  style={{ color: "rgba(220,38,38,0.7)", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" }}>X</button>
              </div>
              {castableSpells.length === 0 && <div className="text-xs" style={{ color: "rgba(232,213,176,0.4)" }}>No battle spells available</div>}
              {castableSpells.map(({ spell, level, slotsLeft }) => (
                <button key={spell.id} onClick={() => selectSpell(spell)} disabled={slotsLeft <= 0 && level > 0}
                  className="w-full text-left px-2 py-1.5 rounded mb-1 transition-all hover:scale-[1.01]"
                  style={{
                    background: slotsLeft > 0 || level === 0 ? "rgba(168,85,247,0.1)" : "rgba(0,0,0,0.2)",
                    border: `1px solid ${slotsLeft > 0 || level === 0 ? "rgba(168,85,247,0.3)" : "rgba(168,85,247,0.1)"}`,
                    opacity: slotsLeft > 0 || level === 0 ? 1 : 0.4,
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.9)" }}>{spell.name}</span>
                    <span style={{ fontSize: "0.5rem", color: "rgba(168,85,247,0.7)" }}>
                      Lv{level} {level > 0 ? `(${slotsLeft} left)` : "(at will)"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.5)" }}>
                    {spell.battle?.type === "damage" && `${spell.battle.damage} ${spell.battle.damageType ?? ""} dmg`}
                    {spell.battle?.type === "healing" && `heal ${spell.battle.healing}`}
                    {spell.battle?.type === "buff" && [spell.battle.buffAC && `+${spell.battle.buffAC} AC`, spell.battle.buffAtk && `+${spell.battle.buffAtk} ATK`, spell.battle.buffSave && `+${spell.battle.buffSave} saves`].filter(Boolean).join(", ")}
                    {spell.battle?.type === "debuff" && [spell.battle.debuffAC && `${spell.battle.debuffAC} AC`, spell.battle.debuffAtk && `${spell.battle.debuffAtk} ATK`].filter(Boolean).join(", ")}
                    {spell.battle?.type === "condition" && spell.battle.condition}
                    {" "}{spell.battle?.save ? `(${spell.battle.save.toUpperCase()} save)` : ""}
                    {" "}range {spell.battle?.hexRange ?? 0} hex
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Ability targeting prompt */}
          {state.phase === "playerTurn" && pendingAbility && (
            <div className="px-4 py-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)" }}>
                {pendingAbility.name}: click a gold-highlighted target
              </span>
              <button onClick={() => setPendingAbility(null)} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest shrink-0"
                style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.3)" }}>
                Cancel
              </button>
            </div>
          )}

          {/* Ability picker overlay */}
          {state.phase === "playerTurn" && showAbilityPicker && (
            <div className="px-3 py-2 rounded-lg overflow-y-auto" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(251,191,36,0.4)", maxHeight: 280 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)" }}>Class Abilities</span>
                <button onClick={() => setShowAbilityPicker(false)} className="px-2 py-0.5 rounded text-xs"
                  style={{ color: "rgba(220,38,38,0.7)", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" }}>X</button>
              </div>
              {availableAbilities.length === 0 && <div className="text-xs" style={{ color: "rgba(232,213,176,0.4)" }}>No abilities available</div>}
              {availableAbilities.map(ab => {
                const usesStr = ab.usesLeft === "unlimited" ? "at will" : `${ab.usesLeft}/${ab.maxUses}`;
                const actionColor = ab.actionType === "free" ? "rgba(74,222,128,0.7)" : ab.actionType === "bonus" ? "rgba(251,191,36,0.7)" : "rgba(220,38,38,0.7)";
                return (
                  <button key={ab.effectId} onClick={() => selectAbility(ab)} disabled={!ab.isAvailable}
                    className="w-full text-left px-2 py-1.5 rounded mb-1 transition-all hover:scale-[1.01]"
                    style={{
                      background: ab.isAvailable ? "rgba(251,191,36,0.1)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${ab.isAvailable ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.1)"}`,
                      opacity: ab.isAvailable ? 1 : 0.4,
                    }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.9)" }}>{ab.name}</span>
                      <span style={{ fontSize: "0.5rem", color: "rgba(251,191,36,0.7)" }}>
                        {usesStr} <span style={{ color: actionColor }}>{ab.actionType}</span>
                      </span>
                    </div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.5)" }}>
                      {ab.description}
                    </div>
                  </button>
                );
              })}
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

          {/* Attack of Opportunity prompt */}
          {state.phase === "playerReaction" && state.pendingAoO && (() => {
            const aoTarget = state.units.find(u => u.id === state.pendingAoO!.targetId);
            return (
              <div className="px-4 py-3 rounded-lg flex flex-col gap-2" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.5)" }}>
                <span className="text-xs font-black tracking-widest uppercase text-center" style={{ color: "rgba(251,191,36,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                  Attack of Opportunity!
                </span>
                <span className="text-xs text-center" style={{ color: "rgba(232,213,176,0.8)" }}>
                  {aoTarget?.name ?? "Enemy"} moved through your threat range
                </span>
                <div className="flex gap-2 justify-center">
                  <button onClick={takeAoO} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ background: "rgba(220,38,38,0.2)", color: "rgba(220,38,38,0.9)", border: "1px solid rgba(220,38,38,0.5)" }}>
                    Strike!
                  </button>
                  <button onClick={passAoO} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.6)", border: "1px solid rgba(201,168,76,0.25)" }}>
                    Pass
                  </button>
                </div>
              </div>
            );
          })()}

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

          {/* Dungeon Room Cleared */}
          {dungeonRoomCleared && questEncounter?.dungeon && (() => {
            const template = questEncounter.dungeon.template;
            const room = template.rooms[dungeonRoomIndex];
            const nextRoom = template.rooms[dungeonRoomIndex + 1];
            return (
              <div className="flex flex-col items-center gap-3 px-4 py-5 rounded-lg" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)" }}>
                <span className="text-lg font-black tracking-widest uppercase" style={{ color: "rgba(168,85,247,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                  Room Cleared
                </span>
                <span className="text-xs font-bold text-center" style={{ color: "rgba(232,213,176,0.8)" }}>
                  {room?.name ?? `Room ${dungeonRoomIndex + 1}`} of {dungeonTotalRooms}
                </span>
                {nextRoom && (
                  <p className="text-xs text-center max-w-xs" style={{ color: "rgba(232,213,176,0.6)" }}>
                    {nextRoom.description.length > 200 ? nextRoom.description.slice(0, 200) + "..." : nextRoom.description}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap justify-center">
                  <button onClick={advanceRoom}
                    className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ background: "rgba(168,85,247,0.2)", color: "rgba(168,85,247,0.9)", border: "1px solid rgba(168,85,247,0.5)" }}>
                    Next Room
                  </button>
                  {canDungeonRest && (
                    <button onClick={dungeonShortRest}
                      className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
                      style={{ background: "rgba(74,222,128,0.15)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.4)" }}>
                      Short Rest
                    </button>
                  )}
                  <button onClick={dungeonRetreat}
                    className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ background: "rgba(251,191,36,0.1)", color: "rgba(251,191,36,0.7)", border: "1px solid rgba(251,191,36,0.3)" }}>
                    Retreat
                  </button>
                </div>
                <span style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.4)" }}>
                  {dungeonName} — Room {dungeonRoomIndex + 1}/{dungeonTotalRooms}
                  {canDungeonRest ? " — Safe to rest here" : ""}
                </span>
              </div>
            );
          })()}

          {/* Victory / Defeat */}
          {state.phase === "victory" && (
            <div className="flex flex-col items-center gap-3 px-4 py-6 rounded-lg" style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.4)" }}>
              <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(74,222,128,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                {isDungeon ? "Dungeon Complete!" : "Victory!"}
              </span>
              {isDungeon && questEncounter?.dungeon && (
                <p className="text-xs text-center max-w-xs" style={{ color: "rgba(232,213,176,0.7)" }}>
                  {questEncounter.dungeon.template.completionText}
                </p>
              )}

              {/* Prisoner binding — unconscious enemies can be tied up */}
              {(() => {
                const survivors = state.units.filter(u => !u.isPlayer && isUnconscious(u));
                if (survivors.length === 0) return null;
                const BIND_DC = 15;
                const ropeBonus = playerUseRopeBonus ?? 0;
                return (
                  <div className="w-full px-3 py-2 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1 text-center" style={{ color: "rgba(201,168,76,0.6)", fontSize: "0.5rem" }}>
                      Unconscious Survivors
                    </div>
                    <p className="text-center mb-2" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.5)" }}>
                      Bind prisoners for questioning or turn them in to the authorities. (Use Rope DC {BIND_DC})
                    </p>
                    {survivors.map(u => {
                      const isBound = boundPrisoners.includes(u.id);
                      const result = bindResults[u.id];
                      return (
                        <div key={u.id} className="flex items-center gap-2 py-1" style={{ borderBottom: "1px solid rgba(201,168,76,0.08)" }}>
                          <span style={{ fontSize: "0.6rem" }}>{u.imageEmoji ?? "\u2694\uFE0F"}</span>
                          <span className="flex-1 text-xs" style={{ color: "rgba(232,213,176,0.7)" }}>
                            {u.name} <span style={{ color: "rgba(220,38,38,0.5)" }}>({u.currentHp} HP)</span>
                          </span>
                          {isBound ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.15)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.3)", fontSize: "0.5rem" }}>
                              Bound
                            </span>
                          ) : result && !result.success ? (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.5rem" }}>
                              Failed (d20:{result.roll}+{ropeBonus}={result.total} vs DC {BIND_DC})
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const roll = Math.floor(Math.random() * 20) + 1;
                                const total = roll + ropeBonus;
                                const success = total >= BIND_DC;
                                setBindResults(prev => ({ ...prev, [u.id]: { roll, total, success } }));
                                if (success) setBoundPrisoners(prev => [...prev, u.id]);
                              }}
                              className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                              style={{ background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.8)", border: "1px solid rgba(201,168,76,0.3)", fontSize: "0.5rem", cursor: "pointer" }}>
                              Bind ({ropeBonus >= 0 ? "+" : ""}{ropeBonus})
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {boundPrisoners.length > 0 && (
                      <div className="text-center mt-1" style={{ fontSize: "0.5rem", color: "rgba(74,222,128,0.6)" }}>
                        {boundPrisoners.length} prisoner{boundPrisoners.length > 1 ? "s" : ""} bound
                      </div>
                    )}
                  </div>
                );
              })()}

              {battleRewards ? (
                <>
                  <div className="flex flex-col items-center gap-1 text-sm" style={{ color: "rgba(232,213,176,0.9)" }}>
                    <span>+{battleRewards.xp} XP</span>
                    {battleRewards.goldCp > 0 && (
                      <span>+{Math.floor(battleRewards.goldCp / 100)}g {Math.floor((battleRewards.goldCp % 100) / 10)}s {battleRewards.goldCp % 10}c loose coin</span>
                    )}
                    {battleRewards.loot.length > 0 && (
                      <div className="flex flex-col items-center gap-0.5 mt-1">
                        <span style={{ fontSize: "0.6rem", color: "rgba(201,168,76,0.6)" }} className="uppercase tracking-widest font-bold">Loot</span>
                        {battleRewards.loot.map((item, i) => (
                          <span key={i} style={{ color: "rgba(251,191,36,0.9)" }}>{item.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {battleRewards.levelsGained > 0 && (
                    <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.5)" }}>
                      <span className="text-lg font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                        Level Up!
                      </span>
                      <span className="text-sm" style={{ color: "rgba(251,191,36,0.8)" }}>Now Level {battleRewards.newLevel}</span>
                    </div>
                  )}
                  <button onClick={onExit} className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                    style={{ background: "rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.9)", border: "1px solid rgba(74,222,128,0.4)" }}>
                    Continue
                  </button>
                </>
              ) : (
                <button disabled={collectingRewards} onClick={async () => {
                  setCollectingRewards(true);
                  if (onBattleEnd) {
                    const enemyNames = state.units.filter(u => !u.isPlayer).map(u => u.name);
                    const prisonerNames = boundPrisoners.map(pid => state.units.find(u => u.id === pid)?.name).filter(Boolean) as string[];
                    const result = await onBattleEnd("victory", effectiveDifficulty, enemyNames, state.round, playerUnit?.spellSlotsUsed, playerUnit?.currentHp, prisonerNames);
                    if (result) { setBattleRewards(result); setCollectingRewards(false); return; }
                  }
                  setCollectingRewards(false);
                  onExit();
                }} className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                  style={{ background: "rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.9)", border: "1px solid rgba(74,222,128,0.4)" }}>
                  {collectingRewards ? "..." : "Collect Rewards"}
                </button>
              )}
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
                    onBattleEnd("defeat", effectiveDifficulty, enemyNames, state.round, playerUnit?.spellSlotsUsed, playerUnit?.currentHp);
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
                    onBattleEnd("defeat", effectiveDifficulty, enemyNames, state.round, playerUnit?.spellSlotsUsed, playerUnit?.currentHp);
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

          {state.phase === "retreat" && (
            <div className="flex flex-col items-center gap-3 px-4 py-6 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)" }}>
              <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
                Retreated!
              </span>
              <p className="text-xs text-center max-w-xs" style={{ color: "rgba(232,213,176,0.7)" }}>
                Your party disengages and falls back to safety.
              </p>
              <button onClick={async () => {
                if (onBattleEnd) {
                  const enemyNames = state.units.filter(u => !u.isPlayer).map(u => u.name);
                  await onBattleEnd("retreat", effectiveDifficulty, enemyNames, state.round, playerUnit?.spellSlotsUsed, playerUnit?.currentHp);
                }
                onExit();
              }} className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: "rgba(251,191,36,0.2)", color: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.4)" }}>
                Continue
              </button>
            </div>
          )}

          {/* All units HP summary */}
          <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>Units</div>
            {state.units.map(u => {
              const status = isDead(u) ? "dead" : isUnconscious(u) ? "unconscious" : "alive";
              return (
                <div key={u.id} className="flex items-center gap-2 py-0.5">
                  <span style={{ fontSize: "0.6rem", color: u.isPlayer ? "rgba(96,165,250,0.8)" : "rgba(220,38,38,0.7)" }}>
                    {status === "dead" ? "\u2620\uFE0F" : u.imageEmoji ?? "\u2694\uFE0F"}
                  </span>
                  <span className="flex-1 text-xs" style={{ color: status === "alive" ? "rgba(232,213,176,0.6)" : "rgba(232,213,176,0.25)", textDecoration: status === "dead" ? "line-through" : undefined }}>
                    {u.name}{status === "unconscious" ? (u.stabilized ? " (stable)" : " (dying)") : ""}
                  </span>
                  <span className="text-xs font-bold" style={{ color: status === "alive" ? "rgba(251,113,133,0.8)" : "rgba(251,113,133,0.3)" }}>
                    {Math.round(u.currentHp)}/{Math.round(u.maxHp)}
                  </span>
                </div>
              );
            })}
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
