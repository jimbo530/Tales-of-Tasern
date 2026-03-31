import { computeStats, type ComputedStats } from "./battleStats";
import { type HexCoord, hexDistance, hexNeighbors, isAdjacent, GRID_COLS, GRID_ROWS } from "./hexGrid";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterClass } from "./classes";
import type { Monster } from "./monsters";
import { getFeatCombatFlags } from "./feats";

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

export function createPlayerUnit(
  char: NftCharacter, position: HexCoord, charClass?: CharacterClass,
  featIds: string[] = [], weaponName?: string,
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
  };
}

/** Check if a unit charged (moved 2+ hexes closer to target this turn) */
export function isCharge(unit: BattleUnit, target: BattleUnit): boolean {
  const distBefore = hexDistance(unit.turnStartPos, target.position);
  const distAfter = hexDistance(unit.position, target.position);
  const hexesMoved = hexDistance(unit.turnStartPos, unit.position);
  return hexesMoved >= 2 && distAfter < distBefore;
}

// ── Combat Resolution ────────────────────────────────────────────────────────

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

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

  const atkMod = attacker.stats.atkBonus + rPenalty + pbsBonus;
  const modified = natural + atkMod;
  const isCrit = natural === 20 || (flags.improvedCritical && natural === 19);
  const isCritMiss = natural === 1;

  // ── Build modifier string for breakdown ──
  const modParts: string[] = [`${attacker.stats.atkBonus}`];
  if (rPenalty !== 0) modParts.push(`${rPenalty} range`);
  if (pbsBonus > 0)  modParts.push(`+${pbsBonus} PBS`);
  const modStr = modParts.join(" ");

  if (isCritMiss) {
    return { hit: false, damage: 0, breakdown: `d20(1) — Critical Miss!` };
  }

  if (!isCrit && modified < target.stats.ac) {
    return {
      hit: false,
      damage: 0,
      breakdown: `d20(${natural}) + ${modStr} = ${modified} vs AC ${target.stats.ac} — Miss!`,
    };
  }

  let damage = attacker.stats.attack + pbsDmg;
  const parts: string[] = [`${attacker.stats.attack} STR`];
  if (pbsDmg > 0) parts.push(`+${pbsDmg} PBS`);

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
  return {
    hit: true,
    damage,
    breakdown: `d20(${natural}) + ${modStr} = ${modified} vs AC ${target.stats.ac}${rangeStr} —${critStr} ${damage} damage (${dmgStr}${isCrit ? " x2" : ""})`,
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
