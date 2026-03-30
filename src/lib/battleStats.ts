import type { NftCharacter } from "@/hooks/useNftStats";
import { type CharacterClass, getBAB, HIT_DIE_VALUES } from "./classes";

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
  carryCapacity: number; // weight limit (STR × 2)
  ac: number;            // armor class (from LP-backed AC tokens)
  atkBonus: number;      // attack bonus (from LP-backed ATK tokens)
  speed: number;         // move speed in ft (from LP-backed speed tokens)
  lightningDmg: number;  // bonus lightning damage
  fireDmg: number;       // bonus fire damage
};

/** Compute battle stats from LP-backed raw scores + optional class */
export function computeStats(
  raw: NftCharacter["stats"],
  charClass?: CharacterClass,
  level: number = 1,
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

  return {
    attack:        Math.max(1, raw.str) + damageBonus,
    mAtk:          Math.max(1, raw.int),
    def:           Math.max(1, raw.dex),
    mDef:          Math.max(1, raw.wis),
    hp:            hp + hpBonus,
    healing:       (Math.max(1, raw.wis) + Math.max(1, raw.con)) / 4,
    initiative:    Math.max(1, raw.dex),
    carryCapacity: Math.max(1, raw.str) * 2,
    ac:            raw.ac + acBonus,
    atkBonus:      raw.atk + (charClass ? getBAB(charClass.bab, level) : 0),
    speed:         (raw.speed || 30) + speedBonus,
    lightningDmg:  raw.lightningDmg,
    fireDmg:       raw.fireDmg,
  };
}
