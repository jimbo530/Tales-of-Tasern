import { computeStats, type ComputedStats } from "./battleStats";
import { type HexCoord, hexDistance, hexNeighbors, isAdjacent, GRID_COLS, GRID_ROWS } from "./hexGrid";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterClass } from "./classes";
import type { Monster } from "./monsters";
import { getFeatCombatFlags } from "./feats";

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

export function createPlayerUnit(char: NftCharacter, position: HexCoord, charClass?: CharacterClass, featIds: string[] = []): BattleUnit {
  const stats = computeStats(char.stats, charClass, 1, featIds);
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
  };
}

// ── Combat Resolution ────────────────────────────────────────────────────────

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function resolveAttack(
  attacker: BattleUnit,
  target: BattleUnit,
  natural: number
): AttackResult {
  const modified = natural + attacker.stats.atkBonus;
  const flags = getFeatCombatFlags(attacker.feats);
  const isCrit = natural === 20 || (flags.improvedCritical && natural === 19);
  const isCritMiss = natural === 1;

  if (isCritMiss) {
    return { hit: false, damage: 0, breakdown: `d20(1) — Critical Miss!` };
  }

  if (!isCrit && modified < target.stats.ac) {
    return {
      hit: false,
      damage: 0,
      breakdown: `d20(${natural}) + ${attacker.stats.atkBonus} = ${modified} vs AC ${target.stats.ac} — Miss!`,
    };
  }

  let damage = attacker.stats.attack;
  const parts: string[] = [`${attacker.stats.attack} STR`];

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
  return {
    hit: true,
    damage,
    breakdown: `d20(${natural}) + ${attacker.stats.atkBonus} = ${modified} vs AC ${target.stats.ac} —${critStr} ${damage} damage (${dmgStr}${isCrit ? " x2" : ""})`,
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

  for (let step = 0; step < maxSteps; step++) {
    if (isAdjacent(current, target.position)) break;

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
