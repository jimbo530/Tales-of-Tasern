// Tales of Tasern — Class Active Abilities
// Resolves class feature abilities in combat (rage, sneak attack, smite, etc.)

import type { BattleUnit, ActiveSpellEffect } from "./hexCombat";
import { hexDistance } from "./hexGrid";
import type { ClassFeature } from "./classes";

// ── Dice helpers ──────────────────────────────────────────────────────────────

function nd(n: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

function rollD20(): number { return Math.floor(Math.random() * 20) + 1; }

/** Ability modifier: our stats are D&D stats -10, so mod = floor(stat/2) */
function aMod(stat: number): number { return Math.floor(Math.max(0, stat) / 2); }

// ── Types ─────────────────────────────────────────────────────────────────────

export type AbilityTargetKind = "self" | "enemy" | "ally" | "allAllies" | "none";

export type AbilityDef = {
  targetKind: AbilityTargetKind;
  range: number;
  onlyUndead?: boolean;
};

export const ABILITY_DEFS: Record<string, AbilityDef> = {
  rage:            { targetKind: "self",      range: 0 },
  inspireCourage:  { targetKind: "allAllies", range: 0 },
  fascinate:       { targetKind: "enemy",     range: 4 },
  turnUndead:      { targetKind: "enemy",     range: 3, onlyUndead: true },
  cureWounds:      { targetKind: "ally",      range: 1 },
  wildShape:       { targetKind: "self",      range: 0 },
  animalCompanion: { targetKind: "none",      range: 0 },
  entangle:        { targetKind: "enemy",     range: 4 },
  combatExpertise: { targetKind: "self",      range: 0 },
  flurryOfBlows:   { targetKind: "self",      range: 0 },
  stunningFist:    { targetKind: "self",      range: 0 },
  smiteEvil:       { targetKind: "self",      range: 0 },
  layOnHands:      { targetKind: "ally",      range: 1 },
  detectEvil:      { targetKind: "enemy",     range: 6 },
  magicMissile:    { targetKind: "enemy",     range: 4 },
  burningHands:    { targetKind: "enemy",     range: 1 },
  shield:          { targetKind: "self",      range: 0 },
  fireball:        { targetKind: "enemy",     range: 4 },
  rayOfFrost:      { targetKind: "enemy",     range: 4 },
  mageArmor:       { targetKind: "self",      range: 0 },
};

export type AbilityResult = {
  success: boolean;
  breakdown: string;
  logType: "hit" | "miss" | "info" | "system" | "crit";
  selfEffect?: ActiveSpellEffect;
  targetEffect?: ActiveSpellEffect;
  partyEffect?: ActiveSpellEffect;  // applied to ALL player-side conscious units
  damage?: number;
  aoeRange?: number;  // damage hits all units within this range of target
  aoeRawDmg?: number; // raw dice damage before save (reducer rolls per-target)
  aoeSaveDC?: number; // DC for the AoE save
  aoeSaveStat?: "dex" | "con" | "wis"; // which stat the save uses
  healing?: number;
  // Next-attack modifier flags
  setStunFist?: boolean;
  setFlurry?: boolean;
  // Summon
  summon?: SummonDef;
  // What action slot this uses (overrides feature's declared action type for some abilities)
  consumesStandard: boolean;
  consumesBonus: boolean;
};

export type SummonDef = {
  name: string;
  emoji: string;
  hp: number;
  ac: number;
  atk: number;
  dmg: number;
  speed: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
};

// ── Available abilities for UI ────────────────────────────────────────────────

export type AvailableAbility = {
  effectId: string;
  name: string;
  description: string;
  targetKind: AbilityTargetKind;
  range: number;
  usesLeft: number | "unlimited";
  maxUses: number | "unlimited";
  actionType: "standard" | "bonus" | "free";
  isAvailable: boolean;
  onlyUndead?: boolean;
};

export function getAvailableAbilities(unit: BattleUnit): AvailableAbility[] {
  if (!unit.activeAbilities || unit.activeAbilities.length === 0) return [];
  const uses = unit._abilityUses ?? {};

  return unit.activeAbilities
    .filter(f => {
      const id = f.active!.effect;
      // Skip passive-only abilities that don't need a button
      return id !== "sneakAttack" && id !== "rangedAttack";
    })
    .map(feat => {
      const effectId = feat.active!.effect;
      const maxUses = feat.active!.uses;
      const used = uses[effectId] ?? 0;
      const usesLeft: number | "unlimited" = maxUses === "unlimited" ? "unlimited" : (maxUses as number) - used;
      const hasUses = usesLeft === "unlimited" || (usesLeft as number) > 0;
      const def = ABILITY_DEFS[effectId];
      const actionType = feat.active!.action;
      const actionAvailable = actionType === "free"
        || (actionType === "bonus" ? !unit.hasBonusActed : !unit.hasActed);

      return {
        effectId,
        name: feat.name,
        description: feat.description,
        targetKind: def?.targetKind ?? "self",
        range: def?.range ?? 0,
        usesLeft,
        maxUses,
        actionType,
        isAvailable: hasUses && actionAvailable,
        ...(def?.onlyUndead ? { onlyUndead: true } : {}),
      };
    });
}

// ── Resolve ability ───────────────────────────────────────────────────────────

export function resolveAbility(
  effectId: string,
  user: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
): AbilityResult {
  const wisMod = aMod(user.rawAbilities.wis);
  const chaMod = aMod(user.rawAbilities.cha);
  const intMod = aMod(user.rawAbilities.int);
  const level = user.level ?? 1;

  const makeEffect = (id: string, name: string, rounds: number, opts: Partial<ActiveSpellEffect> = {}): ActiveSpellEffect => ({
    spellId: `ability_${id}`,
    spellName: name,
    sourceId: user.id,
    remainingRounds: rounds,
    ...opts,
  });

  const noTarget: AbilityResult = { success: false, breakdown: "No target", logType: "miss", consumesStandard: false, consumesBonus: false };

  switch (effectId) {
    // ══════════════════════════════════════════════════════════════════════════
    //  BARBARIAN
    // ══════════════════════════════════════════════════════════════════════════
    case "rage":
      return {
        success: true,
        breakdown: `${user.name} enters a furious RAGE! (+2 ATK, +2 DMG, +2 saves, -2 AC for 5 rounds)`,
        logType: "crit",
        selfEffect: makeEffect("rage", "Rage", 5, { buffAtk: 2, buffDmg: 2, buffSave: 2, debuffAC: -2 }),
        consumesStandard: false, consumesBonus: false,
      };

    // ══════════════════════════════════════════════════════════════════════════
    //  BARD
    // ══════════════════════════════════════════════════════════════════════════
    case "inspireCourage":
      return {
        success: true,
        breakdown: `${user.name} plays an inspiring melody! All allies gain +1 ATK, +1 DMG for 5 rounds.`,
        logType: "info",
        partyEffect: makeEffect("inspire", "Inspired", 5, { buffAtk: 1, buffDmg: 1 }),
        consumesStandard: false, consumesBonus: true,
      };

    case "fascinate": {
      if (!target) return noTarget;
      const dc = 10 + Math.floor(level / 2) + chaMod;
      const roll = rollD20();
      const save = roll + aMod(target.rawAbilities.wis);
      if (save >= dc) {
        return {
          success: false,
          breakdown: `${user.name} tries to fascinate ${target.name} — Will d20(${roll})+${aMod(target.rawAbilities.wis)}=${save} vs DC ${dc} — resisted!`,
          logType: "miss", consumesStandard: true, consumesBonus: false,
        };
      }
      return {
        success: true,
        breakdown: `${user.name} fascinates ${target.name}! Will d20(${roll})+${aMod(target.rawAbilities.wis)}=${save} vs DC ${dc} — dazed!`,
        logType: "hit",
        targetEffect: makeEffect("fascinate", "Fascinated", 1, { condition: "dazed" }),
        consumesStandard: true, consumesBonus: false,
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  CLERIC
    // ══════════════════════════════════════════════════════════════════════════
    case "turnUndead": {
      if (!target) return noTarget;
      const dmg = nd(2, 6);
      return {
        success: true,
        breakdown: `${user.name} channels divine energy against ${target.name}! ${dmg} radiant damage! (2d6)`,
        logType: "hit", damage: dmg,
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "cureWounds": {
      if (!target) return noTarget;
      const heal = nd(1, 8) + wisMod;
      return {
        success: true,
        breakdown: `${user.name} heals ${target.name} for ${heal} HP! (1d8+${wisMod})`,
        logType: "info", healing: heal,
        consumesStandard: true, consumesBonus: false,
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  DRUID
    // ══════════════════════════════════════════════════════════════════════════
    case "wildShape":
      return {
        success: true,
        breakdown: `${user.name} transforms into a fearsome beast! (+2 ATK, +2 DMG for 5 rounds)`,
        logType: "crit",
        selfEffect: makeEffect("wildshape", "Wild Shape", 5, { buffAtk: 2, buffDmg: 2 }),
        consumesStandard: true, consumesBonus: false,
      };

    case "animalCompanion": {
      const isDruid = user.charClass?.id === "druid";
      const companion: SummonDef = isDruid
        ? { name: "Wolf Companion", emoji: "\u{1F43A}", hp: 12, ac: 14, atk: 4, dmg: 4, speed: 40, str: 4, dex: 5, con: 3, int: 1, wis: 3, cha: 1 }
        : { name: "Hawk Companion", emoji: "\u{1F985}", hp: 8, ac: 16, atk: 6, dmg: 3, speed: 60, str: 2, dex: 7, con: 2, int: 1, wis: 4, cha: 1 };
      return {
        success: true,
        breakdown: `${user.name} calls forth a ${companion.name.toLowerCase()}!`,
        logType: "info", summon: companion,
        consumesStandard: false, consumesBonus: false,
      };
    }

    case "entangle": {
      if (!target) return noTarget;
      const dc = 10 + Math.floor(level / 2) + wisMod;
      const roll = rollD20();
      const save = roll + aMod(target.rawAbilities.dex);
      if (save >= dc) {
        return {
          success: false,
          breakdown: `${user.name} tries to entangle ${target.name} — Ref d20(${roll})+${aMod(target.rawAbilities.dex)}=${save} vs DC ${dc} — breaks free!`,
          logType: "miss", consumesStandard: true, consumesBonus: false,
        };
      }
      return {
        success: true,
        breakdown: `Vines erupt around ${target.name}! Ref d20(${roll})+${aMod(target.rawAbilities.dex)}=${save} vs DC ${dc} — entangled for 2 rounds!`,
        logType: "hit",
        targetEffect: makeEffect("entangle", "Entangled", 2, { condition: "entangled", buffSpeed: -999 }),
        consumesStandard: true, consumesBonus: false,
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  FIGHTER
    // ══════════════════════════════════════════════════════════════════════════
    case "combatExpertise":
      return {
        success: true,
        breakdown: `${user.name} fights defensively. (-2 ATK, +2 AC until next turn)`,
        logType: "info",
        selfEffect: makeEffect("expertise", "Combat Expertise", 1, { debuffAtk: -2, buffAC: 2 }),
        consumesStandard: false, consumesBonus: false,
      };

    // ══════════════════════════════════════════════════════════════════════════
    //  MONK
    // ══════════════════════════════════════════════════════════════════════════
    case "flurryOfBlows":
      return {
        success: true,
        breakdown: `${user.name} readies a Flurry of Blows! (Next attack: two strikes at -2 each)`,
        logType: "info", setFlurry: true,
        consumesStandard: false, consumesBonus: false,
      };

    case "stunningFist":
      return {
        success: true,
        breakdown: `${user.name} focuses chi into a Stunning Fist! (Next hit: target must Fort save or lose their turn)`,
        logType: "info", setStunFist: true,
        consumesStandard: false, consumesBonus: false,
      };

    // ══════════════════════════════════════════════════════════════════════════
    //  PALADIN
    // ══════════════════════════════════════════════════════════════════════════
    case "smiteEvil": {
      const atkBonus = Math.max(1, chaMod);
      const dmgBonus = level;
      return {
        success: true,
        breakdown: `${user.name} invokes Smite Evil! (+${atkBonus} ATK, +${dmgBonus} DMG for 1 round)`,
        logType: "crit",
        selfEffect: makeEffect("smite", "Smite Evil", 1, { buffAtk: atkBonus, buffDmg: dmgBonus }),
        consumesStandard: false, consumesBonus: false,
      };
    }

    case "layOnHands": {
      if (!target) return noTarget;
      const heal = Math.max(1, level * Math.max(1, chaMod));
      return {
        success: true,
        breakdown: `${user.name} lays hands on ${target.name}, healing ${heal} HP! (Lv${level} \u00D7 CHA ${Math.max(1, chaMod)})`,
        logType: "info", healing: heal,
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "detectEvil": {
      if (!target) return noTarget;
      return {
        success: true,
        breakdown: `${user.name} senses ${target.name}: HP ${target.currentHp}/${target.maxHp}, AC ${target.stats.ac}, ATK +${target.stats.atkBonus}, DMG ${target.stats.attack}, SPD ${target.stats.speed}`,
        logType: "info",
        consumesStandard: false, consumesBonus: false,
      };
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  SORCERER
    // ══════════════════════════════════════════════════════════════════════════
    case "magicMissile": {
      if (!target) return noTarget;
      const dmg = nd(1, 4) + 1;
      return {
        success: true,
        breakdown: `${user.name} fires a Magic Missile at ${target.name} — ${dmg} force damage! (1d4+1, auto-hit)`,
        logType: "hit", damage: dmg,
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "burningHands": {
      if (!target) return noTarget;
      const rawDmg = nd(2, 4);
      const dc = 10 + Math.floor(level / 2) + chaMod;
      const roll = rollD20();
      const save = roll + aMod(target.rawAbilities.dex);
      const saved = save >= dc;
      const finalDmg = saved ? Math.max(1, Math.floor(rawDmg / 2)) : rawDmg;
      return {
        success: true,
        breakdown: `${user.name} unleashes Burning Hands! ${saved ? `Ref ${save} vs DC ${dc} — ${finalDmg} fire (half)` : `Ref ${save} vs DC ${dc} — ${finalDmg} fire damage!`}`,
        logType: saved ? "info" : "hit",
        damage: finalDmg, aoeRange: 1,
        aoeRawDmg: rawDmg, aoeSaveDC: dc, aoeSaveStat: "dex",
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "shield":
      return {
        success: true,
        breakdown: `${user.name} raises a magical Shield! (+4 AC for 3 rounds)`,
        logType: "info",
        selfEffect: makeEffect("shield", "Shield", 3, { buffAC: 4 }),
        consumesStandard: false, consumesBonus: true,
      };

    // ══════════════════════════════════════════════════════════════════════════
    //  WIZARD
    // ══════════════════════════════════════════════════════════════════════════
    case "fireball": {
      if (!target) return noTarget;
      const rawDmg = nd(3, 6);
      const dc = 10 + Math.floor(level / 2) + intMod;
      const roll = rollD20();
      const save = roll + aMod(target.rawAbilities.dex);
      const saved = save >= dc;
      const finalDmg = saved ? Math.max(1, Math.floor(rawDmg / 2)) : rawDmg;
      return {
        success: true,
        breakdown: `${user.name} hurls a FIREBALL! ${saved ? `Ref ${save} vs DC ${dc} — ${finalDmg} fire (half)` : `Ref ${save} vs DC ${dc} — ${finalDmg} fire!`}`,
        logType: "crit",
        damage: finalDmg, aoeRange: 2,
        aoeRawDmg: rawDmg, aoeSaveDC: dc, aoeSaveStat: "dex",
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "rayOfFrost": {
      if (!target) return noTarget;
      const dmg = nd(1, 3);
      return {
        success: true,
        breakdown: `${user.name} fires a Ray of Frost at ${target.name} — ${dmg} cold damage and slowed!`,
        logType: "hit", damage: dmg,
        targetEffect: makeEffect("frost", "Chilled", 2, { buffSpeed: -10 }),
        consumesStandard: true, consumesBonus: false,
      };
    }

    case "mageArmor":
      return {
        success: true,
        breakdown: `${user.name} casts Mage Armor! (+4 AC for the battle)`,
        logType: "info",
        selfEffect: makeEffect("magearmor", "Mage Armor", -1, { buffAC: 4 }),
        consumesStandard: false, consumesBonus: true,
      };

    // ══════════════════════════════════════════════════════════════════════════
    //  FALLBACK
    // ══════════════════════════════════════════════════════════════════════════
    default:
      return {
        success: false,
        breakdown: `${user.name} tries an unknown ability.`,
        logType: "miss", consumesStandard: false, consumesBonus: false,
      };
  }
}

// ── Sneak Attack helper ───────────────────────────────────────────────────────

/** Check if a rogue can sneak attack: another ally must be adjacent to the target (flanking). */
export function getSneakAttackDice(attacker: BattleUnit, target: BattleUnit, allUnits: BattleUnit[]): number {
  if (!attacker.activeAbilities?.some(a => a.active?.effect === "sneakAttack")) return 0;
  // Flanking: at least one other conscious ally adjacent to target
  const hasFlanker = allUnits.some(u =>
    u.id !== attacker.id && u.isPlayer && u.currentHp > 0 && hexDistance(u.position, target.position) <= 1
  );
  if (!hasFlanker) return 0;
  return nd(2, 6);  // 2d6 sneak attack damage
}

/** Resolve Stunning Fist: target must Fort save or be stunned for 1 round. */
export function resolveStunningFist(
  attacker: BattleUnit,
  target: BattleUnit,
): { stunned: boolean; breakdown: string; effect?: ActiveSpellEffect } {
  const dc = 10 + Math.floor((attacker.level ?? 1) / 2) + aMod(attacker.rawAbilities.wis);
  const roll = rollD20();
  const save = roll + aMod(target.rawAbilities.con);
  if (save >= dc) {
    return { stunned: false, breakdown: `Stunning Fist: ${target.name} resists! Fort d20(${roll})+${aMod(target.rawAbilities.con)}=${save} vs DC ${dc}` };
  }
  return {
    stunned: true,
    breakdown: `Stunning Fist: ${target.name} is STUNNED! Fort d20(${roll})+${aMod(target.rawAbilities.con)}=${save} vs DC ${dc}`,
    effect: {
      spellId: "ability_stun", spellName: "Stunned", sourceId: attacker.id,
      remainingRounds: 1, condition: "stunned",
    },
  };
}
