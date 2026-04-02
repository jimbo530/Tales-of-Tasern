import type { NftCharacter } from "@/hooks/useNftStats";
import { type CharacterClass, getBAB, HIT_DIE_VALUES } from "./classes";
import { getFeatBonuses } from "./feats";

// Combat stats derived from LP-backed ability scores + class
// All stats come from token liquidity — same system for players and enemies.
// Build LPs → gain stats → fund public goods.
export type ComputedStats = {
  attack: number;        // physical damage (STR)
  mAtk: number;          // magic damage (INT)
  def: number;           // physical defense (DEX)
  mDef: number;          // magic defense (WIS)
  hp: number;            // hit points (CON-based)
  healing: number;       // regen per round
  initiative: number;    // turn order (DEX)
  carryCapacity: number; // heavy load max in lbs (PHB table, base 1)
  ac: number;            // armor class (from LP-backed AC tokens)
  atkBonus: number;      // attack bonus (from LP-backed ATK tokens)
  speed: number;         // move speed in ft (from LP-backed speed tokens)
  lightningDmg: number;  // bonus lightning damage
  fireDmg: number;       // bonus fire damage
};

// ── PHB 3.5 Carry Capacity ───────────────────────────────────────────────────
// Full PHB Table 9-1 values.  Our stats are D&D stats -10 (min 1), so
// our STR 1 → D&D STR 10 → 100 lbs heavy load (PHB p.162).
// Mapping: effective D&D STR = our_STR + 9.
//
// Light load: no penalty. Medium: -3 check, ×3 run. Heavy: -6 check, ×3 run, max DEX +1.

/** PHB heavy load values for D&D STR 11-20.  Index 1 = STR 11, index 10 = STR 20. */
const PHB_HEAVY = [0, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400];

/** Max heavy load in lbs for our game STR score (PHB table, our 1 = D&D 10) */
export function getHeavyLoad(str: number): number {
  if (str <= 0) return 0;
  // Convert to effective D&D STR: our 1 = D&D 10
  const dndStr = str + 9;
  if (dndStr <= 10) return dndStr * 10;  // D&D 1-10: heavy = STR × 10
  // D&D 11-20: PHB table values; 21+: ×4 per 10 points above 20
  const decade = Math.floor((dndStr - 11) / 10);   // 0 for 11-20, 1 for 21-30, …
  const ones = ((dndStr - 11) % 10) + 1;           // 1-10 index into table
  return Math.floor(PHB_HEAVY[ones] * Math.pow(4, decade));
}

export type CarryThresholds = {
  light: number;    // max weight for light load (no penalty)
  medium: number;   // max weight for medium load
  heavy: number;    // absolute max carry weight
};

/** Light / medium / heavy load thresholds for a STR score */
export function getCarryThresholds(str: number): CarryThresholds {
  const heavy = getHeavyLoad(str);
  return {
    light: Math.floor(heavy / 3),
    medium: Math.floor(heavy * 2 / 3),
    heavy,
  };
}

/** Encumbrance level based on current weight vs STR */
export function getEncumbrance(str: number, weightLbs: number): "light" | "medium" | "heavy" | "over" {
  const t = getCarryThresholds(str);
  if (weightLbs <= t.light) return "light";
  if (weightLbs <= t.medium) return "medium";
  if (weightLbs <= t.heavy) return "heavy";
  return "over";
}

/** Compute battle stats from LP-backed raw scores + optional class */
export function computeStats(
  raw: NftCharacter["stats"],
  charClass?: CharacterClass,
  level: number = 1,
  featIds: string[] = [],
): ComputedStats {
  // Base HP: 10 + CON * 2. Class hit die replaces the base 10.
  const baseHp = charClass ? HIT_DIE_VALUES[charClass.hitDie] : 10;
  const hp = baseHp + Math.max(1, raw.con) * 2;

  // Class passive bonuses
  let speedBonus = 0;
  let damageBonus = 0;
  let acBonus = 0;
  let hpBonus = 0;
  if (charClass) {
    for (const feat of charClass.features) {
      if (feat.passive && feat.level <= level) {
        speedBonus += feat.passive.speedBonus ?? 0;
        damageBonus += feat.passive.damageBonus ?? 0;
        acBonus += feat.passive.acBonus ?? 0;
        hpBonus += feat.passive.hpBonus ?? 0;
      }
    }
  }

  // Feat passive bonuses
  const fb = getFeatBonuses(featIds);

  return {
    attack:        Math.max(1, raw.str) + damageBonus + fb.damage,
    mAtk:          Math.max(1, raw.int),
    def:           Math.max(1, raw.dex),
    mDef:          Math.max(1, raw.wis),
    hp:            hp + hpBonus + fb.hp,
    healing:       (Math.max(1, raw.wis) + Math.max(1, raw.con)) / 4,
    initiative:    Math.max(1, raw.dex) + fb.initiative,
    carryCapacity: getHeavyLoad(Math.max(1, raw.str)),
    ac:            raw.ac + acBonus + fb.ac,
    atkBonus:      raw.atk + (charClass ? getBAB(charClass.bab, level) : 0) + fb.atkBonus,
    speed:         (raw.speed || 30) + speedBonus + fb.speed,
    lightningDmg:  raw.lightningDmg,
    fireDmg:       raw.fireDmg,
  };
}
