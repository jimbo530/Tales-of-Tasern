import { computeStats, type ComputedStats } from "./battleStats";
import { type HexCoord, hexDistance, hexNeighbors, isAdjacent, GRID_COLS, GRID_ROWS } from "./hexGrid";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterClass } from "./classes";
import type { Monster } from "./monsters";
import { getFeatCombatFlags } from "./feats";
import type { SpellBattleEffect } from "./spells";

// ── Weapon Range & Properties System ─────────────────────────────────────────
// 1 hex = 5ft (matches movement: speed 30 = 6 hexes).
// On a 10x10 grid max distance is ~14 hexes.
// Range penalty: -2 per increment beyond the first (D&D 3.5 PHB).
//
// Weapon Properties (PHB Ch.7):
//   brace   — can "set against charge" as a readied action → double damage
//   reach   — threatens at 2 hexes (10ft), not adjacent
//   trip    — can trip on hit (+2 trip check)
//   double  — two-weapon fighting with one weapon
//   disarm  — +2 bonus on disarm attempts
//   thrown  — melee weapon that can also be thrown
//   charge  — double damage when charging (must move 2+ hexes in a straight line toward target)

export type WeaponProperty = "brace" | "reach" | "trip" | "double" | "disarm" | "thrown" | "charge";

export type WeaponRange = {
  attackRange: number;   // max range in hexes (1 = melee adjacent only)
  increment: number;     // range increment in hexes (0 = melee — no penalty system)
  isRanged: boolean;
  properties: WeaponProperty[];
};

const MELEE:  WeaponRange = { attackRange: 1, increment: 0, isRanged: false, properties: [] };
const REACH_BRACE: WeaponRange = { attackRange: 2, increment: 0, isRanged: false, properties: ["reach", "brace"] };
const REACH_TRIP:  WeaponRange = { attackRange: 2, increment: 0, isRanged: false, properties: ["reach", "trip"] };

// Weapon name → range + properties (partial-matched, case insensitive)
const WEAPON_RANGE_MAP: Record<string, WeaponRange> = {
  // ── Simple melee ──
  "dagger":                       { attackRange: 10, increment: 2,  isRanged: true,  properties: ["thrown"] },
  "club":                         { ...MELEE, properties: [] },
  "heavy mace":                   { ...MELEE, properties: [] },
  "morningstar":                  { ...MELEE, properties: [] },
  "quarterstaff":                 { ...MELEE, properties: ["double"] },
  "sickle":                       { ...MELEE, properties: ["trip"] },
  "spear":                        { attackRange: 4,   increment: 4,  isRanged: true,  properties: ["brace", "thrown"] },
  "shortspear":                   { attackRange: 4,   increment: 4,  isRanged: true,  properties: ["thrown"] },
  "longspear":                    { ...REACH_BRACE },  // reach + brace, no throw
  // ── Simple ranged ──
  "light crossbow":               { attackRange: 160, increment: 16, isRanged: true,  properties: [] },
  "heavy crossbow":               { attackRange: 240, increment: 24, isRanged: true,  properties: [] },
  "javelin":                      { attackRange: 30,  increment: 6,  isRanged: true,  properties: ["thrown"] },
  "sling":                        { attackRange: 100, increment: 10, isRanged: true,  properties: [] },
  // ── Martial melee ──
  "longsword":                    { ...MELEE, properties: [] },
  "battleaxe":                    { ...MELEE, properties: [] },
  "warhammer":                    { ...MELEE, properties: [] },
  "greatsword":                   { ...MELEE, properties: [] },
  "greataxe":                     { ...MELEE, properties: [] },
  "rapier":                       { ...MELEE, properties: [] },
  "scimitar":                     { ...MELEE, properties: [] },
  "flail":                        { ...MELEE, properties: ["trip", "disarm"] },
  "handaxe":                      { attackRange: 10, increment: 2,  isRanged: true,  properties: ["thrown"] },
  "short sword":                  { ...MELEE, properties: [] },
  "trident":                      { attackRange: 10, increment: 2,  isRanged: true,  properties: ["brace", "thrown"] },
  "lance":                        { attackRange: 2,  increment: 0,  isRanged: false, properties: ["reach", "brace", "charge"] },
  "halberd":                      { ...REACH_BRACE, properties: ["reach", "brace", "trip"] },
  "glaive":                       { attackRange: 2,  increment: 0,  isRanged: false, properties: ["reach"] },
  "guisarme":                     { attackRange: 2,  increment: 0,  isRanged: false, properties: ["reach", "trip"] },
  "ranseur":                      { ...REACH_BRACE, properties: ["reach", "brace", "disarm"] },
  // ── Martial ranged ──
  "shortbow":                     { attackRange: 120, increment: 12, isRanged: true,  properties: [] },
  "longbow":                      { attackRange: 200, increment: 20, isRanged: true,  properties: [] },
  "composite longbow":            { attackRange: 220, increment: 22, isRanged: true,  properties: [] },
  "masterwork longbow":           { attackRange: 200, increment: 20, isRanged: true,  properties: [] },
  "masterwork composite longbow": { attackRange: 220, increment: 22, isRanged: true,  properties: [] },
  // ── Exotic ──
  "bastard sword":                { ...MELEE, properties: [] },
  "dwarven waraxe":               { ...MELEE, properties: [] },
  "spiked chain":                 { attackRange: 2,  increment: 0,  isRanged: false, properties: ["reach", "trip", "disarm"] },
  "kukri":                        { ...MELEE, properties: [] },
  "whip":                         { attackRange: 3,  increment: 0,  isRanged: false, properties: ["reach", "trip", "disarm"] },
};

/** Look up range + properties for a weapon by name */
export function getWeaponRange(weaponName?: string): WeaponRange {
  if (!weaponName) return MELEE;
  const lower = weaponName.toLowerCase();
  if (WEAPON_RANGE_MAP[lower]) return WEAPON_RANGE_MAP[lower];
  // Partial match — longest key first to prefer "composite longbow" over "longbow"
  const sorted = Object.keys(WEAPON_RANGE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (lower.includes(key)) return WEAPON_RANGE_MAP[key];
  }
  return MELEE;
}

/** Check if a weapon can be set against charge (brace property) */
export function canBrace(weaponName?: string): boolean {
  return getWeaponRange(weaponName).properties.includes("brace");
}

/** Calculate range penalty for an attack at a given distance */
export function rangePenalty(distance: number, increment: number, farShot: boolean): number {
  if (increment <= 0 || distance <= 1) return 0;  // melee — no range penalty
  if (distance <= increment) return 0;  // within first increment
  const increments = Math.ceil(distance / increment) - 1;
  return increments * (farShot ? -1 : -2);  // Far Shot halves penalty
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ActiveSpellEffect = {
  spellId: string;
  spellName: string;
  sourceId: string;
  remainingRounds: number;  // -1 = until end of combat, 0 = instant (shouldn't be stored)
  buffAC?: number;
  buffAtk?: number;
  buffDmg?: number;
  buffSave?: number;
  buffSpeed?: number;
  debuffAC?: number;
  debuffAtk?: number;
  debuffDmg?: number;
  condition?: string;  // dazed, frightened, stunned, fatigued, entangled, charmed
};

export type SpellCastResult = {
  success: boolean;
  damage?: number;
  healing?: number;
  breakdown: string;
  effect?: ActiveSpellEffect;
  targetSaved?: boolean;
};

export type BattleUnit = {
  id: string;
  name: string;
  imageUrl?: string;
  imageEmoji?: string;
  position: HexCoord;
  stats: ComputedStats;
  subtypes: string[];
  currentHp: number;
  maxHp: number;
  isPlayer: boolean;
  hasMoved: boolean;
  hasActed: boolean;
  charClass?: CharacterClass;
  feats: string[];
  attackRange: number;     // max attack distance in hexes (1 = melee)
  rangeIncrement: number;  // hexes per range increment (0 = melee)
  isRanged: boolean;       // true if using a ranged weapon
  weaponProperties: WeaponProperty[];  // brace, reach, trip, etc.
  readiedAttack: boolean;  // true if holding action for approaching enemies
  turnStartPos: HexCoord;  // position at start of turn (for charge detection)
  reactionUsed: boolean;   // true if used their reaction this round (AoO)
  // ── Spell combat fields ──
  activeEffects: ActiveSpellEffect[];
  rawAbilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  spellSlots?: number[];          // max spell slots per level [0th, 1st, ...]
  spellSlotsUsed?: number[];      // slots used this battle
  availableSpells?: string[];     // spell IDs available to cast (known or prepared)
  casterLevel?: number;           // for damage scaling and DC
  castingAbilityMod?: number;     // ability modifier for spell DC
};

export type AttackResult = {
  hit: boolean;
  damage: number;
  breakdown: string;
};

export type CombatLogEntry = {
  id: number;
  text: string;
  type: "info" | "hit" | "miss" | "crit" | "kill" | "system";
};

// ── Enemy NFT lookup ─────────────────────────────────────────────────────────
// Enemies are real NFTs — same LP-backed stat system as players.
// Build LPs → gain stats → fund public goods.

type EnemyDef = {
  nftName: string;          // match against NftCharacter.name
  displayName: string;
  imageEmoji: string;
  localImage: string;       // fallback image in /public
};

const ENEMY_DEFS: Record<string, EnemyDef> = {
  goblin: {
    nftName: "Goblins",
    displayName: "Goblin Raider",
    imageEmoji: "\u{1F47A}",
    localImage: "/enemy-goblin.jpg",
  },
  wolf: {
    nftName: "Wolves",
    displayName: "Dire Wolf",
    imageEmoji: "\u{1F43A}",
    localImage: "/enemy-wolf.jpg",
  },
  skeleton: {
    nftName: "Skeleton",
    displayName: "Skeleton Warrior",
    imageEmoji: "\u{1F480}",
    localImage: "",
  },
};

export type EnemySpec = {
  name: string;
  imageUrl?: string;
  imageEmoji: string;
  stats: NftCharacter["stats"];
  subtypes: string[];
  hpOverride?: number;   // use this HP instead of computed (for D&D monsters)
  attackRange?: number;  // override attack range in hexes (default 1 = melee)
  rangeIncrement?: number; // range increment in hexes (default 0)
};

/** Look up an enemy NFT from the character list — uses real LP stats */
function buildEnemySpec(key: string, characters: NftCharacter[]): EnemySpec {
  const def = ENEMY_DEFS[key];
  if (!def) throw new Error(`Unknown enemy: ${key}`);

  const nft = characters.find(c => c.name === def.nftName);

  return {
    name: def.displayName,
    imageUrl: nft?.imageUrl || (def.localImage || undefined),
    imageEmoji: def.imageEmoji,
    stats: nft?.stats ?? { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1, ac: 10, atk: 0, speed: 30, lightningDmg: 0, fireDmg: 0 },
    subtypes: nft?.subtypes ?? [],
  };
}

// ── Monster → EnemySpec (D&D stats from monsters.ts) ────────────────────────

/** Build an EnemySpec from a Monster definition — uses D&D stats directly */
export function createMonsterSpec(monster: Monster, emoji?: string): EnemySpec {
  return {
    name: monster.name,
    imageEmoji: emoji ?? "\u{1F47E}",  // 👾 default
    stats: {
      str: monster.str,
      dex: monster.dex,
      con: monster.con,
      int: monster.int,
      wis: monster.wis,
      cha: monster.cha,
      ac: monster.ac,
      atk: 0,
      speed: monster.speed,
      lightningDmg: 0,
      fireDmg: 0,
    },
    subtypes: [],
    hpOverride: monster.hp,  // use D&D HP, not computed
  };
}

// ── Encounter Generation ─────────────────────────────────────────────────────

export function generateEncounter(
  difficulty: "easy" | "medium" | "hard",
  characters: NftCharacter[],
): EnemySpec[] {
  if (difficulty === "easy") return [buildEnemySpec("goblin", characters)];
  if (difficulty === "medium") return [buildEnemySpec("wolf", characters), buildEnemySpec("goblin", characters)];
  return [buildEnemySpec("skeleton", characters), buildEnemySpec("wolf", characters), buildEnemySpec("goblin", characters)];
}

// ── Spawn Positions ─────────────────────────────────────────────────────────

/** Generate spawn positions for N enemies on the right side of the grid */
export function generateSpawnPositions(count: number, playerPos: HexCoord): HexCoord[] {
  const positions: HexCoord[] = [];
  const used = new Set<string>();
  used.add(`${playerPos.q},${playerPos.r}`);

  // Start from far right, spread across rows
  for (let q = GRID_COLS - 2; q >= Math.floor(GRID_COLS / 2) && positions.length < count; q--) {
    for (let r = 1; r < GRID_ROWS - 1 && positions.length < count; r++) {
      const key = `${q},${r}`;
      if (!used.has(key)) {
        // Spread them out: skip every other row for first pass
        if (positions.length < count / 2 && r % 2 === 0) continue;
        positions.push({ q, r });
        used.add(key);
      }
    }
  }

  // If we still need more, fill remaining gaps
  for (let q = GRID_COLS - 2; q >= 2 && positions.length < count; q--) {
    for (let r = 0; r < GRID_ROWS && positions.length < count; r++) {
      const key = `${q},${r}`;
      if (!used.has(key)) {
        positions.push({ q, r });
        used.add(key);
      }
    }
  }

  return positions;
}

// ── Unit Creation ────────────────────────────────────────────────────────────

export type SpellUnitInfo = {
  spellSlots: number[];
  spellSlotsUsed: number[];
  availableSpells: string[];
  casterLevel: number;
  castingAbilityMod: number;
};

export function createPlayerUnit(
  char: NftCharacter, position: HexCoord, charClass?: CharacterClass,
  featIds: string[] = [], weaponName?: string, spellInfo?: SpellUnitInfo,
): BattleUnit {
  const stats = computeStats(char.stats, charClass, 1, featIds);
  const wr = getWeaponRange(weaponName);
  return {
    id: "player",
    name: char.name,
    imageUrl: char.imageUrl ?? undefined,
    position,
    stats,
    subtypes: char.subtypes ?? [],
    currentHp: stats.hp,
    maxHp: stats.hp,
    isPlayer: true,
    hasMoved: false,
    hasActed: false,
    charClass,
    feats: featIds,
    attackRange: wr.attackRange,
    rangeIncrement: wr.increment,
    isRanged: wr.isRanged,
    weaponProperties: wr.properties,
    readiedAttack: false,
    turnStartPos: position,
    reactionUsed: false,
    activeEffects: [],
    rawAbilities: { str: char.stats.str, dex: char.stats.dex, con: char.stats.con, int: char.stats.int, wis: char.stats.wis, cha: char.stats.cha },
    ...(spellInfo ? {
      spellSlots: spellInfo.spellSlots,
      spellSlotsUsed: spellInfo.spellSlotsUsed,
      availableSpells: spellInfo.availableSpells,
      casterLevel: spellInfo.casterLevel,
      castingAbilityMod: spellInfo.castingAbilityMod,
    } : {}),
  };
}

export function createEnemyUnit(spec: EnemySpec, position: HexCoord, index: number): BattleUnit {
  const stats = computeStats(spec.stats);
  const hp = spec.hpOverride ?? stats.hp;  // D&D monster HP if provided
  return {
    id: `enemy-${index}`,
    name: spec.name,
    imageUrl: spec.imageUrl,
    imageEmoji: spec.imageEmoji,
    position,
    stats,
    subtypes: spec.subtypes,
    currentHp: hp,
    maxHp: hp,
    isPlayer: false,
    hasMoved: false,
    hasActed: false,
    feats: [],
    attackRange: spec.attackRange ?? 1,
    rangeIncrement: spec.rangeIncrement ?? 0,
    isRanged: (spec.attackRange ?? 1) > 2,
    weaponProperties: [],
    readiedAttack: false,
    turnStartPos: position,
    reactionUsed: false,
    activeEffects: [],
    rawAbilities: { str: spec.stats.str, dex: spec.stats.dex, con: spec.stats.con, int: spec.stats.int, wis: spec.stats.wis, cha: spec.stats.cha },
  };
}

/** Check if a unit charged (moved 2+ hexes closer to target this turn) */
export function isCharge(unit: BattleUnit, target: BattleUnit): boolean {
  const distBefore = hexDistance(unit.turnStartPos, target.position);
  const distAfter = hexDistance(unit.position, target.position);
  const hexesMoved = hexDistance(unit.turnStartPos, unit.position);
  return hexesMoved >= 2 && distAfter < distBefore;
}

// ── Dice & Spell Resolution ──────────────────────────────────────────────────

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/** Ability modifier: our stats are D&D stats -10, so mod = floor(stat/2) */
export function abilityMod(stat: number): number {
  return Math.floor(Math.max(0, stat) / 2);
}

/** Roll a dice expression like "1d6", "2d4+1", "1d4/level" */
export function rollDice(expr: string, casterLevel: number = 1): { total: number; breakdown: string } {
  const trimmed = expr.trim();
  // Flat number
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed);
    return { total: n, breakdown: `${n}` };
  }
  const perLevel = trimmed.includes("/level");
  const clean = trimmed.replace("/level", "").trim();
  const m = clean.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!m) return { total: 0, breakdown: "0" };

  let numDice = parseInt(m[1]);
  const dieSize = parseInt(m[2]);
  const bonus = m[3] ? parseInt(m[3]) : 0;
  if (perLevel) numDice = Math.min(numDice * casterLevel, 10);

  let total = bonus;
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * dieSize) + 1;
    rolls.push(roll);
    total += roll;
  }
  total = Math.max(1, total);
  const diceStr = `${numDice}d${dieSize}[${rolls.join(",")}]`;
  const bonusStr = bonus > 0 ? `+${bonus}` : "";
  return { total, breakdown: `${diceStr}${bonusStr}=${total}` };
}

/** Get total buff/debuff modifier for a stat across all active effects */
function sumEffects(unit: BattleUnit, key: keyof ActiveSpellEffect): number {
  return unit.activeEffects.reduce((sum, e) => sum + ((e[key] as number) ?? 0), 0);
}

/** Check if a unit has an active condition */
export function hasCondition(unit: BattleUnit, condition: string): boolean {
  return unit.activeEffects.some(e => e.condition === condition && e.remainingRounds !== 0);
}

/** Resolve a spell cast in combat */
export function resolveSpellCast(
  caster: BattleUnit,
  target: BattleUnit,
  spellId: string,
  spellName: string,
  spellLevel: number,
  effect: SpellBattleEffect,
): SpellCastResult {
  const casterLvl = caster.casterLevel ?? 1;
  const casterMod = caster.castingAbilityMod ?? 0;
  const dc = 10 + spellLevel + casterMod;

  // Saving throw check
  let saved = false;
  let saveRoll = 0;
  let saveTotal = 0;
  if (effect.save) {
    const saveAbility = effect.save === "fort" ? target.rawAbilities.con
      : effect.save === "ref" ? target.rawAbilities.dex
      : target.rawAbilities.wis;
    const saveMod = abilityMod(saveAbility) + sumEffects(target, "buffSave");
    saveRoll = rollD20();
    saveTotal = saveRoll + saveMod;
    saved = saveTotal >= dc;
  }

  const saveStr = effect.save ? ` (${effect.save.toUpperCase()} save: d20(${saveRoll})+${abilityMod(effect.save === "fort" ? target.rawAbilities.con : effect.save === "ref" ? target.rawAbilities.dex : target.rawAbilities.wis)} = ${saveTotal} vs DC ${dc}${saved ? " — SAVED" : " — FAILED"})` : "";

  // ── Damage spells ──
  if (effect.type === "damage" && effect.damage) {
    const { total, breakdown } = rollDice(effect.damage, casterLvl);
    const finalDmg = saved ? Math.max(1, Math.floor(total / 2)) : total;
    const dmgTypeStr = effect.damageType ? ` ${effect.damageType}` : "";
    return {
      success: true,
      damage: finalDmg,
      breakdown: `${spellName}: ${breakdown}${dmgTypeStr} damage${saved ? " (halved)" : ""}${saveStr}`,
    };
  }

  // ── Healing spells ──
  if (effect.type === "healing" && effect.healing) {
    const { total, breakdown } = rollDice(effect.healing, casterLvl);
    return {
      success: true,
      healing: total,
      breakdown: `${spellName}: heals ${breakdown} HP`,
    };
  }

  // ── Buff spells ──
  if (effect.type === "buff") {
    const dur = effect.durationRounds ?? 1;
    const eff: ActiveSpellEffect = {
      spellId, spellName, sourceId: caster.id, remainingRounds: dur,
      buffAC: effect.buffAC, buffAtk: effect.buffAtk, buffDmg: effect.buffDmg,
      buffSave: effect.buffSave, buffSpeed: effect.buffSpeed,
    };
    const parts: string[] = [];
    if (effect.buffAC) parts.push(`+${effect.buffAC} AC`);
    if (effect.buffAtk) parts.push(`+${effect.buffAtk} ATK`);
    if (effect.buffDmg) parts.push(`+${effect.buffDmg} DMG`);
    if (effect.buffSave) parts.push(`+${effect.buffSave} saves`);
    if (effect.buffSpeed) parts.push(`+${effect.buffSpeed} speed`);
    return {
      success: true,
      effect: eff,
      breakdown: `${spellName}: ${parts.join(", ")} for ${dur === -1 ? "combat" : dur + " rounds"}`,
    };
  }

  // ── Debuff spells ──
  if (effect.type === "debuff") {
    if (saved) return { success: false, breakdown: `${spellName}: target resists${saveStr}`, targetSaved: true };
    const dur = effect.durationRounds ?? 1;
    const eff: ActiveSpellEffect = {
      spellId, spellName, sourceId: caster.id, remainingRounds: dur,
      debuffAC: effect.debuffAC, debuffAtk: effect.debuffAtk, debuffDmg: effect.debuffDmg,
    };
    const parts: string[] = [];
    if (effect.debuffAC) parts.push(`${effect.debuffAC} AC`);
    if (effect.debuffAtk) parts.push(`${effect.debuffAtk} ATK`);
    if (effect.debuffDmg) parts.push(`${effect.debuffDmg} DMG`);
    return {
      success: true,
      effect: eff,
      breakdown: `${spellName}: ${parts.join(", ")} for ${dur === -1 ? "combat" : dur + " rounds"}${saveStr}`,
    };
  }

  // ── Condition spells ──
  if (effect.type === "condition" && effect.condition) {
    if (saved) return { success: false, breakdown: `${spellName}: target resists${saveStr}`, targetSaved: true };
    const dur = effect.durationRounds ?? 1;
    const eff: ActiveSpellEffect = {
      spellId, spellName, sourceId: caster.id, remainingRounds: dur,
      condition: effect.condition,
    };
    return {
      success: true,
      effect: eff,
      breakdown: `${spellName}: target is ${effect.condition} for ${dur === -1 ? "combat" : dur + " rounds"}${saveStr}`,
    };
  }

  return { success: false, breakdown: `${spellName}: no battle effect` };
}

// ── Combat Resolution ────────────────────────────────────────────────────────

export function resolveAttack(
  attacker: BattleUnit,
  target: BattleUnit,
  natural: number,
  distance: number = 1,
): AttackResult {
  const flags = getFeatCombatFlags(attacker.feats);

  // ── Range modifiers ──
  const rPenalty = rangePenalty(distance, attacker.rangeIncrement, flags.farShot);
  const pbsBonus = (flags.pointBlankShot && distance <= 6) ? 1 : 0; // +1 atk within 30ft
  const pbsDmg   = (flags.pointBlankShot && distance <= 6) ? 1 : 0; // +1 dmg within 30ft

  // ── Active effect modifiers ──
  const atkBuff = sumEffects(attacker, "buffAtk") + sumEffects(attacker, "debuffAtk");
  const acBuff = sumEffects(target, "buffAC") + sumEffects(target, "debuffAC");
  const dmgBuff = sumEffects(attacker, "buffDmg") + sumEffects(attacker, "debuffDmg");
  const effectiveAC = target.stats.ac + acBuff;

  const atkMod = attacker.stats.atkBonus + rPenalty + pbsBonus + atkBuff;
  const modified = natural + atkMod;
  const isCrit = natural === 20 || (flags.improvedCritical && natural === 19);
  const isCritMiss = natural === 1;

  // ── Build modifier string for breakdown ──
  const modParts: string[] = [`${attacker.stats.atkBonus}`];
  if (rPenalty !== 0) modParts.push(`${rPenalty} range`);
  if (pbsBonus > 0)  modParts.push(`+${pbsBonus} PBS`);
  if (atkBuff !== 0)  modParts.push(`${atkBuff > 0 ? "+" : ""}${atkBuff} spell`);
  const modStr = modParts.join(" ");

  if (isCritMiss) {
    return { hit: false, damage: 0, breakdown: `d20(1) — Critical Miss!` };
  }

  if (!isCrit && modified < effectiveAC) {
    return {
      hit: false,
      damage: 0,
      breakdown: `d20(${natural}) + ${modStr} = ${modified} vs AC ${effectiveAC}${acBuff !== 0 ? ` (${target.stats.ac}${acBuff > 0 ? "+" : ""}${acBuff})` : ""} — Miss!`,
    };
  }

  let damage = attacker.stats.attack + pbsDmg + dmgBuff;
  const parts: string[] = [`${attacker.stats.attack} STR`];
  if (pbsDmg > 0) parts.push(`+${pbsDmg} PBS`);
  if (dmgBuff !== 0) parts.push(`${dmgBuff > 0 ? "+" : ""}${dmgBuff} spell`);

  if (attacker.subtypes.includes("electric") && attacker.stats.lightningDmg > 0) {
    damage += attacker.stats.lightningDmg;
    parts.push(`${attacker.stats.lightningDmg} Lightning`);
  }
  if (attacker.subtypes.includes("fire") && attacker.stats.fireDmg > 0) {
    damage += attacker.stats.fireDmg;
    parts.push(`${attacker.stats.fireDmg} Fire`);
  }

  if (isCrit) damage *= 2;
  damage = Math.max(1, Math.round(damage));

  const dmgStr = parts.join(" + ");
  const critStr = isCrit ? " CRITICAL HIT! " : "";
  const rangeStr = distance > 1 ? ` (${distance} hex)` : "";
  const acStr = acBuff !== 0 ? `${effectiveAC} (${target.stats.ac}${acBuff > 0 ? "+" : ""}${acBuff})` : `${effectiveAC}`;
  return {
    hit: true,
    damage,
    breakdown: `d20(${natural}) + ${modStr} = ${modified} vs AC ${acStr}${rangeStr} —${critStr} ${damage} damage (${dmgStr}${isCrit ? " x2" : ""})`,
  };
}

// ── Enemy AI ─────────────────────────────────────────────────────────────────

export function computeEnemyMove(
  enemy: BattleUnit,
  target: BattleUnit,
  allUnits: BattleUnit[]
): HexCoord {
  const maxSteps = Math.floor(enemy.stats.speed / 5);
  let current = enemy.position;
  const occupied = new Set(
    allUnits.filter(u => u.id !== enemy.id && u.currentHp > 0).map(u => `${u.position.q},${u.position.r}`)
  );

  // Ranged enemies: stop if already within range (prefer staying back)
  if (enemy.isRanged && hexDistance(current, target.position) <= enemy.attackRange) {
    return current;
  }

  for (let step = 0; step < maxSteps; step++) {
    // Melee: stop when adjacent. Ranged: stop when in range.
    if (enemy.isRanged) {
      if (hexDistance(current, target.position) <= enemy.attackRange) break;
    } else {
      if (isAdjacent(current, target.position)) break;
    }

    const neighbors = hexNeighbors(current).filter(
      n => !occupied.has(`${n.q},${n.r}`)
    );
    if (neighbors.length === 0) break;

    const best = neighbors.reduce((a, b) =>
      hexDistance(b, target.position) < hexDistance(a, target.position) ? b : a
    );

    if (hexDistance(best, target.position) >= hexDistance(current, target.position)) break;
    current = best;
  }

  return current;
}

/** Check if a unit can attack a target from its current position */
export function canAttack(attacker: BattleUnit, target: BattleUnit): boolean {
  return hexDistance(attacker.position, target.position) <= attacker.attackRange;
}

// ── Attacks of Opportunity ──────────────────────────────────────────────────
// D&D 3.5: AoO when entering threatened area.  D&D 5e: AoO when leaving.
// We use both, with one reaction per round per unit.

/** Return opponents eligible to take an AoO against a moving unit */
export function getAoOThreats(
  mover: BattleUnit,
  oldPos: HexCoord,
  newPos: HexCoord,
  allUnits: BattleUnit[],
): BattleUnit[] {
  const threats: BattleUnit[] = [];
  for (const u of allUnits) {
    if (u.id === mover.id || u.currentHp <= 0 || u.isPlayer === mover.isPlayer) continue;
    if (u.reactionUsed || u.isRanged) continue;  // ranged weapons can't AoO
    if (hasCondition(u, "stunned") || hasCondition(u, "dazed")) continue;

    const threatRange = u.weaponProperties.includes("reach") ? 2 : 1;
    const wasInRange = hexDistance(oldPos, u.position) <= threatRange;
    const isInRange = hexDistance(newPos, u.position) <= threatRange;

    // Entering OR leaving threatened area triggers AoO
    if ((!wasInRange && isInRange) || (wasInRange && !isInRange)) {
      threats.push(u);
    }
  }
  return threats;
}
