// Tales of Tasern — Class Ability System
// Full level-based ability unlocks for all 12 classes.
// Each class has 8 abilities unlocked at levels 1, 3, 5, 7, 9, 12, 15, 20.
// Integrates with the mana/cooldown system in manaSystem.ts.

import type { ActiveSpellEffect } from "./hexCombat";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DamageType = "physical" | "fire" | "cold" | "lightning" | "radiant" | "necrotic" | "force" | "psychic" | "poison" | "nature";

export type StatusEffectDef = {
  id: string;
  name: string;
  duration: number;        // rounds (-1 = until end of combat)
  condition?: string;      // dazed, stunned, frightened, charmed, entangled, poisoned, blinded, silenced
  buffAC?: number;
  buffAtk?: number;
  buffDmg?: number;
  buffSave?: number;
  buffSpeed?: number;
  debuffAC?: number;
  debuffAtk?: number;
  debuffDmg?: number;
  dot?: number;            // damage over time per round
  dotType?: DamageType;
  hot?: number;            // heal over time per round
};

export type AbilityScaling = {
  /** Which stat drives this ability's power */
  primaryStat: "str" | "dex" | "con" | "int" | "wis" | "cha";
  /** Bonus per point of stat modifier: damage/healing = base + (statMod * perStatMod) */
  perStatMod: number;
  /** Bonus per character level beyond levelRequired */
  perLevel: number;
};

export type TargetType = "self" | "singleEnemy" | "singleAlly" | "allEnemies" | "allAllies" | "aoe" | "cone" | "line" | "none";

export type ClassAbility = {
  id: string;
  name: string;
  description: string;
  classId: string;
  levelRequired: number;
  manaCost: number;
  cooldownTurns: number;
  targetType: TargetType;
  range: number;           // in hexes (0 = self, 1 = adjacent, etc.)
  areaOfEffect: number;   // radius in hexes (0 = single target)
  damageType?: DamageType;
  /** Base damage dice: e.g. "2d6", "3d8+5" */
  baseDamage?: string;
  /** Base healing dice */
  baseHealing?: string;
  statusEffects: StatusEffectDef[];
  scaling: AbilityScaling;
  /** Action economy */
  actionType: "standard" | "bonus" | "free";
  /** Whether the ability requires concentration */
  concentration?: boolean;
  /** Special flags for combat resolution */
  flags?: string[];
};

export type ClassAbilitySet = {
  classId: string;
  className: string;
  abilities: ClassAbility[];
};

// ── Dice Parser ───────────────────────────────────────────────────────────────

/** Parse "2d6+3" into { count, sides, bonus }. Returns null on invalid input. */
export function parseDice(expr: string): { count: number; sides: number; bonus: number } | null {
  const match = expr.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    bonus: match[3] ? parseInt(match[3], 10) : 0,
  };
}

/** Roll dice from expression string */
export function rollDice(expr: string): number {
  const parsed = parseDice(expr);
  if (!parsed) return 0;
  let total = parsed.bonus;
  for (let i = 0; i < parsed.count; i++) {
    total += Math.floor(Math.random() * parsed.sides) + 1;
  }
  return total;
}

/** Calculate average of dice expression */
export function avgDice(expr: string): number {
  const parsed = parseDice(expr);
  if (!parsed) return 0;
  return parsed.count * ((parsed.sides + 1) / 2) + parsed.bonus;
}

// ── Ability Definitions ───────────────────────────────────────────────────────

const UNLOCK_LEVELS = [1, 3, 5, 7, 9, 12, 15, 20] as const;

function ability(
  id: string,
  name: string,
  classId: string,
  levelIndex: number,
  opts: Omit<ClassAbility, "id" | "name" | "classId" | "levelRequired">
): ClassAbility {
  return {
    id,
    name,
    classId,
    levelRequired: UNLOCK_LEVELS[levelIndex],
    ...opts,
  };
}

// ── FIGHTER ───────────────────────────────────────────────────────────────────

const FIGHTER_ABILITIES: ClassAbility[] = [
  ability("fighter_strike", "Strike", "fighter", 0, {
    description: "A precise weapon strike dealing bonus damage based on STR.",
    manaCost: 0,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "1d8+2",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 1.5, perLevel: 0.5 },
    actionType: "standard",
  }),
  ability("fighter_power_attack", "Power Attack", "fighter", 1, {
    description: "Trade accuracy for raw power. -2 ATK, deal massive damage.",
    manaCost: 5,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "2d8+4",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["self_debuff_atk_2"],
  }),
  ability("fighter_cleave", "Cleave", "fighter", 2, {
    description: "Swing through enemies. If you down a foe, immediately attack an adjacent one.",
    manaCost: 8,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 1,
    damageType: "physical",
    baseDamage: "2d6+3",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "standard",
    flags: ["cleave_on_kill"],
  }),
  ability("fighter_whirlwind", "Whirlwind", "fighter", 3, {
    description: "Spin attack hitting all adjacent enemies.",
    manaCost: 12,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 0,
    areaOfEffect: 1,
    damageType: "physical",
    baseDamage: "2d8+2",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 1.0, perLevel: 1.0 },
    actionType: "standard",
  }),
  ability("fighter_battle_cry", "Battle Cry", "fighter", 4, {
    description: "Shout a rallying cry. All allies gain +2 ATK and +2 DMG for 3 rounds.",
    manaCost: 10,
    cooldownTurns: 4,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 3,
    statusEffects: [{ id: "battle_cry", name: "Rallied", duration: 3, buffAtk: 2, buffDmg: 2 }],
    scaling: { primaryStat: "cha", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "bonus",
  }),
  ability("fighter_iron_will", "Iron Will", "fighter", 5, {
    description: "Steel yourself against pain. Gain damage reduction 4 and +3 AC for 3 rounds.",
    manaCost: 15,
    cooldownTurns: 4,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "iron_will", name: "Iron Will", duration: 3, buffAC: 3 }],
    scaling: { primaryStat: "con", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["damage_reduction_4"],
  }),
  ability("fighter_blade_storm", "Blade Storm", "fighter", 6, {
    description: "Unleash a flurry of 5 rapid strikes against a single foe.",
    manaCost: 20,
    cooldownTurns: 5,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "5d6+5",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 2.5, perLevel: 1.5 },
    actionType: "standard",
    flags: ["multi_hit_5"],
  }),
  ability("fighter_titan_strike", "Titan Strike", "fighter", 7, {
    description: "Channel all your martial mastery into one devastating blow that sunders armor.",
    manaCost: 30,
    cooldownTurns: 6,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "6d10+10",
    statusEffects: [{ id: "armor_sundered", name: "Sundered", duration: 3, debuffAC: -4 }],
    scaling: { primaryStat: "str", perStatMod: 3.0, perLevel: 2.0 },
    actionType: "standard",
    flags: ["ignores_dr"],
  }),
];

// ── WIZARD ────────────────────────────────────────────────────────────────────

const WIZARD_ABILITIES: ClassAbility[] = [
  ability("wizard_magic_missile", "Magic Missile", "wizard", 0, {
    description: "Unerring bolts of force strike the target. Cannot miss.",
    manaCost: 3,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    damageType: "force",
    baseDamage: "1d4+1",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
    flags: ["auto_hit"],
  }),
  ability("wizard_fireball", "Fireball", "wizard", 1, {
    description: "Hurl a bead of flame that explodes in a 2-hex radius. Dex save for half.",
    manaCost: 10,
    cooldownTurns: 2,
    targetType: "aoe",
    range: 5,
    areaOfEffect: 2,
    damageType: "fire",
    baseDamage: "3d6",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["save_half_dex"],
  }),
  ability("wizard_ice_wall", "Ice Wall", "wizard", 2, {
    description: "Conjure a wall of ice blocking a line of hexes. Enemies crossing take cold damage.",
    manaCost: 12,
    cooldownTurns: 3,
    targetType: "line",
    range: 4,
    areaOfEffect: 3,
    damageType: "cold",
    baseDamage: "2d6",
    statusEffects: [{ id: "chilled", name: "Chilled", duration: 2, buffSpeed: -20 }],
    scaling: { primaryStat: "int", perStatMod: 1.0, perLevel: 0.8 },
    actionType: "standard",
    concentration: true,
    flags: ["creates_terrain"],
  }),
  ability("wizard_teleport", "Teleport", "wizard", 3, {
    description: "Instantly move to any visible hex within range. Does not provoke attacks of opportunity.",
    manaCost: 8,
    cooldownTurns: 2,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "bonus",
    flags: ["teleport_6_hexes", "no_aoo"],
  }),
  ability("wizard_lightning_chain", "Lightning Chain", "wizard", 4, {
    description: "A bolt of lightning arcs between up to 4 enemies. Each jump deals slightly less damage.",
    manaCost: 18,
    cooldownTurns: 3,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    damageType: "lightning",
    baseDamage: "4d6",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 2.0, perLevel: 1.2 },
    actionType: "standard",
    flags: ["chain_4_targets", "reduce_25_per_jump"],
  }),
  ability("wizard_time_stop", "Time Stop", "wizard", 5, {
    description: "Freeze time briefly. Gain 2 extra standard actions this turn.",
    manaCost: 25,
    cooldownTurns: 6,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "time_stop", name: "Time Stop", duration: 1 }],
    scaling: { primaryStat: "int", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "free",
    flags: ["extra_actions_2"],
  }),
  ability("wizard_meteor_swarm", "Meteor Swarm", "wizard", 6, {
    description: "Call down 4 meteors on the battlefield. Each strikes a 2-hex area for massive fire damage.",
    manaCost: 35,
    cooldownTurns: 5,
    targetType: "aoe",
    range: 6,
    areaOfEffect: 2,
    damageType: "fire",
    baseDamage: "6d8",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 3.0, perLevel: 2.0 },
    actionType: "standard",
    flags: ["multi_target_4", "save_half_dex"],
  }),
  ability("wizard_arcane_apocalypse", "Arcane Apocalypse", "wizard", 7, {
    description: "Tear open the fabric of reality. All enemies take devastating force damage and are dazed.",
    manaCost: 50,
    cooldownTurns: 8,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "force",
    baseDamage: "8d10+20",
    statusEffects: [{ id: "reality_torn", name: "Reality Torn", duration: 2, condition: "dazed", debuffAC: -3 }],
    scaling: { primaryStat: "int", perStatMod: 4.0, perLevel: 3.0 },
    actionType: "standard",
    flags: ["save_half_wis"],
  }),
];

// ── ROGUE ─────────────────────────────────────────────────────────────────────

const ROGUE_ABILITIES: ClassAbility[] = [
  ability("rogue_backstab", "Backstab", "rogue", 0, {
    description: "Strike from the shadows for bonus damage. Extra effective when flanking.",
    manaCost: 0,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "2d6",
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "standard",
    flags: ["bonus_if_flanking_2d6"],
  }),
  ability("rogue_poison_blade", "Poison Blade", "rogue", 1, {
    description: "Coat your weapon in venom. Next 3 attacks deal poison damage over time.",
    manaCost: 6,
    cooldownTurns: 2,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    damageType: "poison",
    statusEffects: [{ id: "poison_blade", name: "Poisoned Blade", duration: 3, dot: 3, dotType: "poison" }],
    scaling: { primaryStat: "dex", perStatMod: 0.5, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["applies_to_attacks"],
  }),
  ability("rogue_shadow_step", "Shadow Step", "rogue", 2, {
    description: "Vanish into shadow and reappear behind an enemy. Next attack has advantage.",
    manaCost: 8,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 4,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "bonus",
    flags: ["teleport_to_target", "next_attack_advantage"],
  }),
  ability("rogue_smoke_bomb", "Smoke Bomb", "rogue", 3, {
    description: "Throw a smoke bomb obscuring a 2-hex area. Enemies inside are blinded for 2 rounds.",
    manaCost: 10,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 3,
    areaOfEffect: 2,
    statusEffects: [{ id: "smoke_blind", name: "Blinded", duration: 2, condition: "blinded", debuffAtk: -4 }],
    scaling: { primaryStat: "dex", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "bonus",
  }),
  ability("rogue_assassinate", "Assassinate", "rogue", 4, {
    description: "If the target has not yet acted this combat, deal triple backstab damage. Auto-crit.",
    manaCost: 15,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "6d6",
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 3.0, perLevel: 1.5 },
    actionType: "standard",
    flags: ["first_round_only", "auto_crit"],
  }),
  ability("rogue_death_mark", "Death Mark", "rogue", 5, {
    description: "Mark a target for death. All allies deal +3 damage to the marked target for 4 rounds.",
    manaCost: 12,
    cooldownTurns: 4,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    statusEffects: [{ id: "death_mark", name: "Death Marked", duration: 4, debuffAC: -2 }],
    scaling: { primaryStat: "dex", perStatMod: 0.5, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["party_bonus_dmg_3_vs_target"],
  }),
  ability("rogue_shadow_dance", "Shadow Dance", "rogue", 6, {
    description: "Enter a state of perfect shadow movement for 3 rounds. All attacks gain backstab bonus, cannot be targeted by opportunity attacks.",
    manaCost: 22,
    cooldownTurns: 5,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "shadow_dance", name: "Shadow Dancing", duration: 3, buffAtk: 3, buffDmg: 4 }],
    scaling: { primaryStat: "dex", perStatMod: 1.0, perLevel: 1.0 },
    actionType: "bonus",
    flags: ["immune_aoo", "always_flanking"],
  }),
  ability("rogue_phantom_kill", "Phantom Kill", "rogue", 7, {
    description: "Strike with such speed and precision the target cannot perceive the attack. Massive single-target damage, ignores all armor and resistances.",
    manaCost: 40,
    cooldownTurns: 7,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "10d6+15",
    statusEffects: [{ id: "phantom_wound", name: "Phantom Wound", duration: 3, dot: 5, dotType: "physical" }],
    scaling: { primaryStat: "dex", perStatMod: 4.0, perLevel: 2.5 },
    actionType: "standard",
    flags: ["ignores_armor", "ignores_dr"],
  }),
];

// ── CLERIC ────────────────────────────────────────────────────────────────────

const CLERIC_ABILITIES: ClassAbility[] = [
  ability("cleric_heal", "Heal", "cleric", 0, {
    description: "Channel divine energy to restore an ally's wounds.",
    manaCost: 4,
    cooldownTurns: 0,
    targetType: "singleAlly",
    range: 2,
    areaOfEffect: 0,
    baseHealing: "1d8+3",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "standard",
  }),
  ability("cleric_smite", "Smite", "cleric", 1, {
    description: "Strike an enemy with holy wrath. Deals bonus damage to undead and fiends.",
    manaCost: 6,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "radiant",
    baseDamage: "2d6+2",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "standard",
    flags: ["bonus_vs_undead_2d6", "bonus_vs_fiend_2d6"],
  }),
  ability("cleric_shield_of_faith", "Shield of Faith", "cleric", 2, {
    description: "Surround an ally with a shimmering barrier granting +3 AC for 5 rounds.",
    manaCost: 8,
    cooldownTurns: 2,
    targetType: "singleAlly",
    range: 3,
    areaOfEffect: 0,
    statusEffects: [{ id: "shield_faith", name: "Shield of Faith", duration: 5, buffAC: 3 }],
    scaling: { primaryStat: "wis", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "bonus",
    concentration: true,
  }),
  ability("cleric_resurrect", "Resurrect", "cleric", 3, {
    description: "Bring a fallen ally back from unconsciousness with half their maximum HP.",
    manaCost: 20,
    cooldownTurns: 5,
    targetType: "singleAlly",
    range: 1,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["revive_to_50_percent"],
  }),
  ability("cleric_holy_nova", "Holy Nova", "cleric", 4, {
    description: "Burst of radiant energy heals all allies and damages all enemies within 2 hexes.",
    manaCost: 15,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 0,
    areaOfEffect: 2,
    damageType: "radiant",
    baseDamage: "2d8",
    baseHealing: "2d8",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["heals_allies_damages_enemies"],
  }),
  ability("cleric_divine_intervention", "Divine Intervention", "cleric", 5, {
    description: "Call upon your deity. One ally becomes immune to damage for 1 round.",
    manaCost: 25,
    cooldownTurns: 6,
    targetType: "singleAlly",
    range: 4,
    areaOfEffect: 0,
    statusEffects: [{ id: "divine_shield", name: "Divine Protection", duration: 1 }],
    scaling: { primaryStat: "wis", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "standard",
    flags: ["immune_damage_1_round"],
  }),
  ability("cleric_mass_heal", "Mass Heal", "cleric", 6, {
    description: "A wave of healing light restores all allies within 3 hexes.",
    manaCost: 30,
    cooldownTurns: 5,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 3,
    baseHealing: "4d8+10",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 3.0, perLevel: 2.0 },
    actionType: "standard",
  }),
  ability("cleric_judgment", "Judgment", "cleric", 7, {
    description: "Call down divine judgment on all enemies. Massive radiant damage and all negative conditions are cleansed from allies.",
    manaCost: 45,
    cooldownTurns: 8,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "radiant",
    baseDamage: "6d10+15",
    statusEffects: [{ id: "judged", name: "Judged", duration: 2, debuffAtk: -3, debuffDmg: -3 }],
    scaling: { primaryStat: "wis", perStatMod: 4.0, perLevel: 2.5 },
    actionType: "standard",
    flags: ["cleanse_all_allies", "save_half_wis"],
  }),
];

// ── RANGER ────────────────────────────────────────────────────────────────────

const RANGER_ABILITIES: ClassAbility[] = [
  ability("ranger_quick_shot", "Quick Shot", "ranger", 0, {
    description: "Fire a rapid arrow at an enemy. Low cost, reliable ranged damage.",
    manaCost: 2,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "1d8+1",
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
  }),
  ability("ranger_trap", "Trap", "ranger", 1, {
    description: "Place a hidden trap on a hex. First enemy to step on it takes damage and is rooted.",
    manaCost: 6,
    cooldownTurns: 2,
    targetType: "aoe",
    range: 3,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "2d6",
    statusEffects: [{ id: "trapped", name: "Trapped", duration: 2, condition: "entangled", buffSpeed: -999 }],
    scaling: { primaryStat: "dex", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["placed_trap", "triggered_on_move"],
  }),
  ability("ranger_animal_companion", "Animal Companion", "ranger", 2, {
    description: "Call a loyal beast companion to fight alongside you.",
    manaCost: 10,
    cooldownTurns: 0,
    targetType: "none",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.0, perLevel: 1.0 },
    actionType: "free",
    flags: ["summon_companion"],
  }),
  ability("ranger_rain_of_arrows", "Rain of Arrows", "ranger", 3, {
    description: "Launch a volley skyward that rains down on a 2-hex area.",
    manaCost: 12,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 6,
    areaOfEffect: 2,
    damageType: "physical",
    baseDamage: "3d6",
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["save_half_dex"],
  }),
  ability("ranger_camouflage", "Camouflage", "ranger", 4, {
    description: "Blend into the surroundings. Cannot be targeted for 2 rounds or until you attack.",
    manaCost: 8,
    cooldownTurns: 4,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "camouflage", name: "Camouflaged", duration: 2 }],
    scaling: { primaryStat: "dex", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "bonus",
    flags: ["untargetable", "breaks_on_attack"],
  }),
  ability("ranger_eagle_eye", "Eagle Eye", "ranger", 5, {
    description: "Focus with preternatural clarity. Next 3 ranged attacks auto-hit and deal +50% damage.",
    manaCost: 15,
    cooldownTurns: 4,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "eagle_eye", name: "Eagle Eye", duration: 3, buffAtk: 5, buffDmg: 3 }],
    scaling: { primaryStat: "dex", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["auto_hit_3_attacks"],
  }),
  ability("ranger_volley_storm", "Volley Storm", "ranger", 6, {
    description: "Fire 8 arrows in rapid succession at multiple targets across the battlefield.",
    manaCost: 25,
    cooldownTurns: 5,
    targetType: "allEnemies",
    range: 6,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "2d8+4",
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 2.5, perLevel: 1.5 },
    actionType: "standard",
    flags: ["hits_each_enemy_once"],
  }),
  ability("ranger_natures_wrath", "Nature's Wrath", "ranger", 7, {
    description: "Channel the fury of the wild. Roots erupt, winds howl, and lightning strikes all foes.",
    manaCost: 40,
    cooldownTurns: 7,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "lightning",
    baseDamage: "5d8+10",
    statusEffects: [{ id: "natures_grip", name: "Nature's Grip", duration: 2, condition: "entangled", buffSpeed: -999 }],
    scaling: { primaryStat: "wis", perStatMod: 3.5, perLevel: 2.0 },
    actionType: "standard",
    flags: ["save_half_dex"],
  }),
];

// ── PALADIN ───────────────────────────────────────────────────────────────────

const PALADIN_ABILITIES: ClassAbility[] = [
  ability("paladin_lay_hands", "Lay Hands", "paladin", 0, {
    description: "Place your hands on an ally and channel healing light.",
    manaCost: 3,
    cooldownTurns: 0,
    targetType: "singleAlly",
    range: 1,
    areaOfEffect: 0,
    baseHealing: "1d6+2",
    statusEffects: [],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
  }),
  ability("paladin_divine_smite", "Divine Smite", "paladin", 1, {
    description: "Channel radiant fury through your weapon strike. Extra damage to undead.",
    manaCost: 6,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "radiant",
    baseDamage: "2d8+2",
    statusEffects: [],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["bonus_vs_undead_2d8"],
  }),
  ability("paladin_aura_of_protection", "Aura of Protection", "paladin", 2, {
    description: "Emit an aura granting all allies within 2 hexes +2 to all saving throws.",
    manaCost: 8,
    cooldownTurns: 0,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 2,
    statusEffects: [{ id: "aura_protect", name: "Protected", duration: -1, buffSave: 2 }],
    scaling: { primaryStat: "cha", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "free",
    concentration: true,
  }),
  ability("paladin_holy_shield", "Holy Shield", "paladin", 3, {
    description: "Raise a shield of divine light absorbing up to 20 damage before shattering.",
    manaCost: 12,
    cooldownTurns: 3,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "holy_shield", name: "Holy Shield", duration: 3, buffAC: 4 }],
    scaling: { primaryStat: "con", perStatMod: 2.0, perLevel: 1.5 },
    actionType: "bonus",
    flags: ["absorb_20_damage"],
  }),
  ability("paladin_consecrate", "Consecrate", "paladin", 4, {
    description: "Bless the ground beneath your feet. Allies in the area heal each round, undead take damage.",
    manaCost: 14,
    cooldownTurns: 4,
    targetType: "aoe",
    range: 0,
    areaOfEffect: 2,
    damageType: "radiant",
    baseDamage: "1d8",
    statusEffects: [{ id: "consecrated", name: "Consecrated Ground", duration: 4, hot: 4 }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
    flags: ["heals_allies_damages_undead", "creates_terrain"],
  }),
  ability("paladin_righteous_fury", "Righteous Fury", "paladin", 5, {
    description: "Enter a state of holy rage. +4 ATK, +4 DMG, attacks deal radiant damage for 3 rounds.",
    manaCost: 18,
    cooldownTurns: 5,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "righteous_fury", name: "Righteous Fury", duration: 3, buffAtk: 4, buffDmg: 4 }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.8 },
    actionType: "bonus",
    flags: ["attacks_become_radiant"],
  }),
  ability("paladin_crusader_strike", "Crusader Strike", "paladin", 6, {
    description: "A devastating holy blow that heals you for damage dealt.",
    manaCost: 22,
    cooldownTurns: 4,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "radiant",
    baseDamage: "4d8+8",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 2.5, perLevel: 1.5 },
    actionType: "standard",
    flags: ["lifesteal_100_percent"],
  }),
  ability("paladin_avatar_of_light", "Avatar of Light", "paladin", 7, {
    description: "Transform into a radiant avatar. Gain flight, +5 AC, +5 ATK, and all attacks deal 3d8 bonus radiant. Heals all allies for 30 HP.",
    manaCost: 45,
    cooldownTurns: 8,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    baseHealing: "30",
    statusEffects: [{ id: "avatar_light", name: "Avatar of Light", duration: 3, buffAC: 5, buffAtk: 5, buffDmg: 8 }],
    scaling: { primaryStat: "cha", perStatMod: 3.0, perLevel: 2.0 },
    actionType: "standard",
    flags: ["party_heal_30", "grants_flight"],
  }),
];

// ── BARBARIAN ─────────────────────────────────────────────────────────────────

const BARBARIAN_ABILITIES: ClassAbility[] = [
  ability("barbarian_rage", "Rage", "barbarian", 0, {
    description: "Enter a berserker rage. +2 ATK, +2 DMG, +2 saves, -2 AC for 5 rounds.",
    manaCost: 0,
    cooldownTurns: 0,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "rage", name: "Raging", duration: 5, buffAtk: 2, buffDmg: 2, buffSave: 2, debuffAC: -2 }],
    scaling: { primaryStat: "con", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "free",
  }),
  ability("barbarian_reckless_attack", "Reckless Attack", "barbarian", 1, {
    description: "Throw caution to the wind. +4 ATK but enemies get +2 to hit you until your next turn.",
    manaCost: 3,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "2d8+3",
    statusEffects: [{ id: "reckless", name: "Reckless", duration: 1, debuffAC: -2 }],
    scaling: { primaryStat: "str", perStatMod: 2.0, perLevel: 0.8 },
    actionType: "standard",
    flags: ["self_debuff_ac_2"],
  }),
  ability("barbarian_intimidate", "Intimidate", "barbarian", 2, {
    description: "Let out a terrifying roar. Target must Will save or be frightened for 3 rounds.",
    manaCost: 5,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 3,
    areaOfEffect: 0,
    statusEffects: [{ id: "frightened", name: "Frightened", duration: 3, condition: "frightened", debuffAtk: -2 }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["save_wis_negates"],
  }),
  ability("barbarian_frenzy", "Frenzy", "barbarian", 3, {
    description: "Enter a deeper rage granting an extra attack each turn for 3 rounds. Fatigued after.",
    manaCost: 10,
    cooldownTurns: 4,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "frenzy", name: "Frenzied", duration: 3, buffAtk: 3, buffDmg: 3 }],
    scaling: { primaryStat: "con", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "free",
    flags: ["extra_attack_per_turn", "fatigue_after"],
  }),
  ability("barbarian_earthquake_stomp", "Earthquake Stomp", "barbarian", 4, {
    description: "Slam the ground with devastating force. All enemies within 2 hexes take damage and are knocked prone.",
    manaCost: 14,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 0,
    areaOfEffect: 2,
    damageType: "physical",
    baseDamage: "3d8",
    statusEffects: [{ id: "prone", name: "Prone", duration: 1, debuffAC: -4 }],
    scaling: { primaryStat: "str", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["save_dex_negates_prone"],
  }),
  ability("barbarian_undying_fury", "Undying Fury", "barbarian", 5, {
    description: "Refuse to die. For 3 rounds, you cannot be reduced below 1 HP.",
    manaCost: 18,
    cooldownTurns: 6,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "undying", name: "Undying Fury", duration: 3 }],
    scaling: { primaryStat: "con", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "free",
    flags: ["cannot_die"],
  }),
  ability("barbarian_primal_scream", "Primal Scream", "barbarian", 6, {
    description: "Release a primal howl that frightens all enemies and grants allies +3 ATK.",
    manaCost: 20,
    cooldownTurns: 5,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "primal_fear", name: "Terrified", duration: 3, condition: "frightened", debuffAtk: -3, debuffDmg: -2 }],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "bonus",
    flags: ["party_buff_atk_3", "save_wis_negates"],
  }),
  ability("barbarian_cataclysm", "Cataclysm", "barbarian", 7, {
    description: "Channel all your fury into a single world-shattering blow. The impact creates a shockwave damaging everything in 3 hexes.",
    manaCost: 40,
    cooldownTurns: 7,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 3,
    damageType: "physical",
    baseDamage: "8d10+15",
    statusEffects: [{ id: "shattered", name: "Shattered", duration: 2, debuffAC: -5, condition: "stunned" }],
    scaling: { primaryStat: "str", perStatMod: 4.0, perLevel: 3.0 },
    actionType: "standard",
    flags: ["aoe_half_damage"],
  }),
];

// ── BARD ──────────────────────────────────────────────────────────────────────

const BARD_ABILITIES: ClassAbility[] = [
  ability("bard_inspire", "Inspire", "bard", 0, {
    description: "Play an inspiring melody granting all allies +1 ATK and +1 DMG for 5 rounds.",
    manaCost: 3,
    cooldownTurns: 0,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 4,
    statusEffects: [{ id: "inspired", name: "Inspired", duration: 5, buffAtk: 1, buffDmg: 1 }],
    scaling: { primaryStat: "cha", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "bonus",
  }),
  ability("bard_charm", "Charm", "bard", 1, {
    description: "Enchant an enemy with a beguiling melody. Charmed for 3 rounds (Will save negates).",
    manaCost: 7,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 4,
    areaOfEffect: 0,
    statusEffects: [{ id: "charmed", name: "Charmed", duration: 3, condition: "charmed" }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
    flags: ["save_wis_negates"],
  }),
  ability("bard_song_of_rest", "Song of Rest", "bard", 2, {
    description: "Play a soothing melody healing all allies over 3 rounds.",
    manaCost: 10,
    cooldownTurns: 3,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 3,
    baseHealing: "1d6+2",
    statusEffects: [{ id: "song_rest", name: "Resting", duration: 3, hot: 4 }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
  }),
  ability("bard_hypnotic_pattern", "Hypnotic Pattern", "bard", 3, {
    description: "Weave a mesmerizing pattern dazing all enemies in a 2-hex area for 2 rounds.",
    manaCost: 12,
    cooldownTurns: 3,
    targetType: "aoe",
    range: 4,
    areaOfEffect: 2,
    statusEffects: [{ id: "hypnotized", name: "Hypnotized", duration: 2, condition: "dazed" }],
    scaling: { primaryStat: "cha", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "standard",
    concentration: true,
    flags: ["save_wis_negates"],
  }),
  ability("bard_counter_spell", "Counter Spell", "bard", 4, {
    description: "React to an enemy casting a spell and attempt to counter it. CHA check vs caster level.",
    manaCost: 10,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "free",
    flags: ["reaction", "counter_spell"],
  }),
  ability("bard_epic_ballad", "Epic Ballad", "bard", 5, {
    description: "Perform an epic tale of heroism. All allies gain +3 ATK, +3 DMG, +2 AC for 4 rounds.",
    manaCost: 20,
    cooldownTurns: 5,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 5,
    statusEffects: [{ id: "epic_ballad", name: "Epic Ballad", duration: 4, buffAtk: 3, buffDmg: 3, buffAC: 2 }],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    concentration: true,
  }),
  ability("bard_mass_inspire", "Mass Inspire", "bard", 6, {
    description: "Your performance reaches transcendent heights. All allies gain +4 to all stats for 4 rounds.",
    manaCost: 28,
    cooldownTurns: 5,
    targetType: "allAllies",
    range: 0,
    areaOfEffect: 6,
    statusEffects: [{ id: "mass_inspired", name: "Transcendent", duration: 4, buffAtk: 4, buffDmg: 4, buffAC: 3, buffSave: 3 }],
    scaling: { primaryStat: "cha", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
  }),
  ability("bard_symphony_of_destruction", "Symphony of Destruction", "bard", 7, {
    description: "Play the forbidden Symphony of Destruction. All enemies take psychic damage each round for 5 rounds, with stacking intensity.",
    manaCost: 42,
    cooldownTurns: 8,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "psychic",
    baseDamage: "3d8",
    statusEffects: [{ id: "symphony_doom", name: "Doomed", duration: 5, dot: 8, dotType: "psychic", debuffAtk: -2, debuffDmg: -2 }],
    scaling: { primaryStat: "cha", perStatMod: 3.5, perLevel: 2.5 },
    actionType: "standard",
    concentration: true,
    flags: ["stacking_dot"],
  }),
];

// ── DRUID ─────────────────────────────────────────────────────────────────────

const DRUID_ABILITIES: ClassAbility[] = [
  ability("druid_wild_shape", "Wild Shape", "druid", 0, {
    description: "Transform into a beast gaining +2 ATK, +2 DMG, +10 temp HP for 5 rounds.",
    manaCost: 5,
    cooldownTurns: 0,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "wild_shape", name: "Wild Shape", duration: 5, buffAtk: 2, buffDmg: 2 }],
    scaling: { primaryStat: "wis", perStatMod: 0.5, perLevel: 0.5 },
    actionType: "standard",
    flags: ["temp_hp_10"],
  }),
  ability("druid_entangle", "Entangle", "druid", 1, {
    description: "Vines erupt from the ground rooting enemies in a 2-hex area.",
    manaCost: 6,
    cooldownTurns: 2,
    targetType: "aoe",
    range: 4,
    areaOfEffect: 2,
    statusEffects: [{ id: "entangled", name: "Entangled", duration: 2, condition: "entangled", buffSpeed: -999 }],
    scaling: { primaryStat: "wis", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "standard",
    concentration: true,
    flags: ["save_dex_negates"],
  }),
  ability("druid_call_lightning", "Call Lightning", "druid", 2, {
    description: "Call a bolt of lightning from the sky striking a single target.",
    manaCost: 10,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    damageType: "lightning",
    baseDamage: "3d6",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["save_half_dex"],
  }),
  ability("druid_summon_beast", "Summon Beast", "druid", 3, {
    description: "Summon a powerful nature spirit in beast form to fight for you.",
    manaCost: 14,
    cooldownTurns: 0,
    targetType: "none",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["summon_beast_spirit"],
  }),
  ability("druid_earthquake", "Earthquake", "druid", 4, {
    description: "Shake the earth violently. All enemies within 3 hexes take damage and may fall prone.",
    manaCost: 16,
    cooldownTurns: 4,
    targetType: "aoe",
    range: 0,
    areaOfEffect: 3,
    damageType: "physical",
    baseDamage: "4d6",
    statusEffects: [{ id: "quake_prone", name: "Prone", duration: 1, debuffAC: -4 }],
    scaling: { primaryStat: "wis", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["save_dex_negates_prone"],
  }),
  ability("druid_storm_form", "Storm Form", "druid", 5, {
    description: "Transform into a living storm. Gain flight, lightning immunity, and a lightning aura dealing damage to adjacent foes.",
    manaCost: 22,
    cooldownTurns: 5,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "storm_form", name: "Storm Form", duration: 4, buffAtk: 3, buffDmg: 4, buffSpeed: 20 }],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["lightning_aura_1d8", "grants_flight", "immune_lightning"],
  }),
  ability("druid_ancient_guardian", "Ancient Guardian", "druid", 6, {
    description: "Call forth an ancient treant guardian. Massive HP, high damage, protects allies.",
    manaCost: 30,
    cooldownTurns: 6,
    targetType: "none",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 2.5, perLevel: 2.0 },
    actionType: "standard",
    flags: ["summon_treant"],
  }),
  ability("druid_world_tree", "World Tree", "druid", 7, {
    description: "Channel the World Tree. All allies are fully healed, all enemies take nature damage, and the battlefield becomes difficult terrain for foes.",
    manaCost: 50,
    cooldownTurns: 8,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "nature",
    baseDamage: "6d8+12",
    baseHealing: "50",
    statusEffects: [{ id: "world_roots", name: "Rooted", duration: 3, condition: "entangled", buffSpeed: -999 }],
    scaling: { primaryStat: "wis", perStatMod: 4.0, perLevel: 2.5 },
    actionType: "standard",
    flags: ["full_party_heal", "save_half_con"],
  }),
];

// ── MONK ──────────────────────────────────────────────────────────────────────

const MONK_ABILITIES: ClassAbility[] = [
  ability("monk_flurry_of_blows", "Flurry of Blows", "monk", 0, {
    description: "Make two rapid unarmed strikes at -2 penalty each.",
    manaCost: 0,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "1d6",
    statusEffects: [],
    scaling: { primaryStat: "str", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
    flags: ["double_attack_minus_2"],
  }),
  ability("monk_stunning_strike", "Stunning Strike", "monk", 1, {
    description: "Focus ki into a strike. On hit, target must Fort save or be stunned for 1 round.",
    manaCost: 4,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "physical",
    baseDamage: "1d8+2",
    statusEffects: [{ id: "stunned", name: "Stunned", duration: 1, condition: "stunned" }],
    scaling: { primaryStat: "wis", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
    flags: ["save_con_negates_stun"],
  }),
  ability("monk_deflect", "Deflect", "monk", 2, {
    description: "Ready to deflect the next incoming attack, reducing damage by 1d10 + DEX mod.",
    manaCost: 3,
    cooldownTurns: 1,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "deflecting", name: "Deflecting", duration: 1, buffAC: 4 }],
    scaling: { primaryStat: "dex", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "free",
    flags: ["reaction", "reduce_damage_1d10"],
  }),
  ability("monk_ki_blast", "Ki Blast", "monk", 3, {
    description: "Release a focused burst of ki energy at range.",
    manaCost: 8,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 4,
    areaOfEffect: 0,
    damageType: "force",
    baseDamage: "3d6",
    statusEffects: [],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
  }),
  ability("monk_shadow_step", "Shadow Step", "monk", 4, {
    description: "Step through shadows to appear behind any enemy within 5 hexes.",
    manaCost: 6,
    cooldownTurns: 2,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "dex", perStatMod: 0.0, perLevel: 0.0 },
    actionType: "bonus",
    flags: ["teleport_to_target", "no_aoo"],
  }),
  ability("monk_quivering_palm", "Quivering Palm", "monk", 5, {
    description: "Strike a pressure point. On your next turn, you can trigger the vibration to deal massive internal damage.",
    manaCost: 18,
    cooldownTurns: 5,
    targetType: "singleEnemy",
    range: 1,
    areaOfEffect: 0,
    damageType: "force",
    baseDamage: "5d10",
    statusEffects: [{ id: "quivering", name: "Quivering Palm", duration: 2 }],
    scaling: { primaryStat: "wis", perStatMod: 3.0, perLevel: 1.5 },
    actionType: "standard",
    flags: ["delayed_trigger", "save_con_half"],
  }),
  ability("monk_perfect_self", "Perfect Self", "monk", 6, {
    description: "Achieve perfect harmony of body and mind. +4 AC, +4 ATK, +4 saves, immune to poison and disease for 4 rounds.",
    manaCost: 25,
    cooldownTurns: 6,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "perfect_self", name: "Perfect Self", duration: 4, buffAC: 4, buffAtk: 4, buffSave: 4 }],
    scaling: { primaryStat: "wis", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "free",
    flags: ["immune_poison", "immune_disease"],
  }),
  ability("monk_transcendence", "Transcendence", "monk", 7, {
    description: "Transcend the physical plane. For 3 rounds, you strike all adjacent enemies each turn, cannot be hit by non-magical attacks, and each hit heals you.",
    manaCost: 45,
    cooldownTurns: 8,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "transcendent", name: "Transcendent", duration: 3, buffAtk: 6, buffDmg: 6, buffAC: 6 }],
    scaling: { primaryStat: "wis", perStatMod: 4.0, perLevel: 2.5 },
    actionType: "standard",
    flags: ["auto_hit_adjacent", "lifesteal_50_percent", "immune_nonmagical"],
  }),
];

// ── NECROMANCER ────────────────────────────────────────────────────────────────

const NECROMANCER_ABILITIES: ClassAbility[] = [
  ability("necro_raise_dead", "Raise Dead", "necromancer", 0, {
    description: "Animate a fallen corpse to fight for you as a skeleton warrior.",
    manaCost: 5,
    cooldownTurns: 0,
    targetType: "none",
    range: 2,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 1.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["summon_skeleton"],
  }),
  ability("necro_life_drain", "Life Drain", "necromancer", 1, {
    description: "Drain life force from an enemy, healing yourself for damage dealt.",
    manaCost: 6,
    cooldownTurns: 1,
    targetType: "singleEnemy",
    range: 3,
    areaOfEffect: 0,
    damageType: "necrotic",
    baseDamage: "2d6",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 1.5, perLevel: 0.8 },
    actionType: "standard",
    flags: ["lifesteal_100_percent"],
  }),
  ability("necro_bone_armor", "Bone Armor", "necromancer", 2, {
    description: "Encase yourself in a shield of bones granting +4 AC and thorns damage to melee attackers.",
    manaCost: 8,
    cooldownTurns: 3,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "bone_armor", name: "Bone Armor", duration: 4, buffAC: 4 }],
    scaling: { primaryStat: "int", perStatMod: 0.5, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["thorns_1d6_necrotic"],
  }),
  ability("necro_corpse_explosion", "Corpse Explosion", "necromancer", 3, {
    description: "Detonate a corpse on the battlefield dealing necrotic damage in a 2-hex radius.",
    manaCost: 12,
    cooldownTurns: 2,
    targetType: "aoe",
    range: 4,
    areaOfEffect: 2,
    damageType: "necrotic",
    baseDamage: "4d6",
    statusEffects: [{ id: "decay", name: "Decaying", duration: 2, dot: 3, dotType: "necrotic" }],
    scaling: { primaryStat: "int", perStatMod: 2.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["requires_corpse"],
  }),
  ability("necro_army_of_dead", "Army of Dead", "necromancer", 4, {
    description: "Raise up to 4 skeletal warriors from fallen enemies.",
    manaCost: 18,
    cooldownTurns: 5,
    targetType: "none",
    range: 3,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 1.5, perLevel: 1.5 },
    actionType: "standard",
    flags: ["summon_4_skeletons"],
  }),
  ability("necro_soul_reap", "Soul Reap", "necromancer", 5, {
    description: "Attempt to rip the soul from a weakened enemy. If target is below 25% HP, instant kill (Will save negates).",
    manaCost: 20,
    cooldownTurns: 4,
    targetType: "singleEnemy",
    range: 3,
    areaOfEffect: 0,
    damageType: "necrotic",
    baseDamage: "5d8",
    statusEffects: [],
    scaling: { primaryStat: "int", perStatMod: 2.5, perLevel: 1.5 },
    actionType: "standard",
    flags: ["execute_25_percent", "save_wis_negates_execute"],
  }),
  ability("necro_lich_form", "Lich Form", "necromancer", 6, {
    description: "Transform into a lich for 4 rounds. Immune to necrotic, +5 INT, all necrotic spells cost 0 mana.",
    manaCost: 30,
    cooldownTurns: 6,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "lich_form", name: "Lich Form", duration: 4, buffAtk: 4, buffDmg: 5 }],
    scaling: { primaryStat: "int", perStatMod: 2.0, perLevel: 1.5 },
    actionType: "standard",
    flags: ["immune_necrotic", "free_necrotic_spells"],
  }),
  ability("necro_apocalypse", "Apocalypse", "necromancer", 7, {
    description: "Unleash a wave of death energy. All enemies take massive necrotic damage and the dead rise as your servants.",
    manaCost: 50,
    cooldownTurns: 8,
    targetType: "allEnemies",
    range: 0,
    areaOfEffect: 0,
    damageType: "necrotic",
    baseDamage: "8d8+20",
    statusEffects: [{ id: "death_aura", name: "Death's Embrace", duration: 3, dot: 6, dotType: "necrotic", debuffAtk: -3 }],
    scaling: { primaryStat: "int", perStatMod: 4.0, perLevel: 3.0 },
    actionType: "standard",
    flags: ["raise_all_killed", "save_half_con"],
  }),
];

// ── WARLOCK ───────────────────────────────────────────────────────────────────

const WARLOCK_ABILITIES: ClassAbility[] = [
  ability("warlock_eldritch_blast", "Eldritch Blast", "warlock", 0, {
    description: "Fire a beam of crackling eldritch energy. Reliable ranged damage.",
    manaCost: 2,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    damageType: "force",
    baseDamage: "1d10+1",
    statusEffects: [],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "standard",
  }),
  ability("warlock_hex", "Hex", "warlock", 1, {
    description: "Curse a target. They take +1d6 damage from all your attacks and have disadvantage on one ability check.",
    manaCost: 5,
    cooldownTurns: 0,
    targetType: "singleEnemy",
    range: 5,
    areaOfEffect: 0,
    statusEffects: [{ id: "hexed", name: "Hexed", duration: -1, debuffAC: -1 }],
    scaling: { primaryStat: "cha", perStatMod: 0.5, perLevel: 0.3 },
    actionType: "bonus",
    concentration: true,
    flags: ["bonus_1d6_from_caster"],
  }),
  ability("warlock_dark_pact", "Dark Pact", "warlock", 2, {
    description: "Sacrifice 10% of your current HP to restore mana equal to HP lost x2.",
    manaCost: 0,
    cooldownTurns: 2,
    targetType: "self",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [],
    scaling: { primaryStat: "con", perStatMod: 1.0, perLevel: 0.5 },
    actionType: "bonus",
    flags: ["sacrifice_hp_10_percent", "restore_mana"],
  }),
  ability("warlock_summon_familiar", "Summon Familiar", "warlock", 3, {
    description: "Call forth a fiendish familiar that attacks enemies and grants you +2 saves.",
    manaCost: 12,
    cooldownTurns: 0,
    targetType: "none",
    range: 0,
    areaOfEffect: 0,
    statusEffects: [{ id: "familiar_bond", name: "Familiar Bond", duration: -1, buffSave: 2 }],
    scaling: { primaryStat: "cha", perStatMod: 1.0, perLevel: 1.0 },
    actionType: "standard",
    flags: ["summon_familiar"],
  }),
  ability("warlock_hellfire", "Hellfire", "warlock", 4, {
    description: "Unleash a torrent of hellfire in a cone. Burns through fire resistance.",
    manaCost: 15,
    cooldownTurns: 3,
    targetType: "cone",
    range: 3,
    areaOfEffect: 2,
    damageType: "fire",
    baseDamage: "4d8",
    statusEffects: [{ id: "hellburned", name: "Hellburned", duration: 2, dot: 4, dotType: "fire" }],
    scaling: { primaryStat: "cha", perStatMod: 2.0, perLevel: 1.2 },
    actionType: "standard",
    flags: ["ignores_fire_resistance", "save_half_dex"],
  }),
  ability("warlock_soul_cage", "Soul Cage", "warlock", 5, {
    description: "Trap an enemy's soul. They cannot heal and take necrotic damage each round. If they die, you gain their remaining soul energy as temp HP.",
    manaCost: 18,
    cooldownTurns: 4,
    targetType: "singleEnemy",
    range: 4,
    areaOfEffect: 0,
    damageType: "necrotic",
    statusEffects: [{ id: "soul_caged", name: "Soul Caged", duration: 4, dot: 5, dotType: "necrotic" }],
    scaling: { primaryStat: "cha", perStatMod: 1.5, perLevel: 1.0 },
    actionType: "standard",
    flags: ["prevents_healing", "death_grants_temp_hp"],
  }),
  ability("warlock_dread_lord", "Dread Lord", "warlock", 6, {
    description: "Assume the form of a Dread Lord for 4 rounds. All attacks deal bonus necrotic, enemies within 2 hexes are frightened.",
    manaCost: 28,
    cooldownTurns: 6,
    targetType: "self",
    range: 0,
    areaOfEffect: 2,
    statusEffects: [{ id: "dread_lord", name: "Dread Lord", duration: 4, buffAtk: 4, buffDmg: 5, buffAC: 3 }],
    scaling: { primaryStat: "cha", perStatMod: 2.0, perLevel: 1.5 },
    actionType: "standard",
    flags: ["fear_aura_2_hexes", "attacks_add_necrotic_2d6"],
  }),
  ability("warlock_void_rift", "Void Rift", "warlock", 7, {
    description: "Tear open a rift to the void. All enemies are pulled toward the center and take massive force + necrotic damage. Those who fail their save are banished for 1 round.",
    manaCost: 48,
    cooldownTurns: 8,
    targetType: "aoe",
    range: 5,
    areaOfEffect: 3,
    damageType: "force",
    baseDamage: "7d10+15",
    statusEffects: [{ id: "void_touched", name: "Void Touched", duration: 2, debuffAC: -4, debuffAtk: -4 }],
    scaling: { primaryStat: "cha", perStatMod: 4.0, perLevel: 3.0 },
    actionType: "standard",
    flags: ["pull_to_center", "save_wis_or_banished_1_round"],
  }),
];

// ── ALL CLASS ABILITY SETS ────────────────────────────────────────────────────

export const CLASS_ABILITY_SETS: ClassAbilitySet[] = [
  { classId: "fighter", className: "Fighter", abilities: FIGHTER_ABILITIES },
  { classId: "wizard", className: "Wizard", abilities: WIZARD_ABILITIES },
  { classId: "rogue", className: "Rogue", abilities: ROGUE_ABILITIES },
  { classId: "cleric", className: "Cleric", abilities: CLERIC_ABILITIES },
  { classId: "ranger", className: "Ranger", abilities: RANGER_ABILITIES },
  { classId: "paladin", className: "Paladin", abilities: PALADIN_ABILITIES },
  { classId: "barbarian", className: "Barbarian", abilities: BARBARIAN_ABILITIES },
  { classId: "bard", className: "Bard", abilities: BARD_ABILITIES },
  { classId: "druid", className: "Druid", abilities: DRUID_ABILITIES },
  { classId: "monk", className: "Monk", abilities: MONK_ABILITIES },
  { classId: "necromancer", className: "Necromancer", abilities: NECROMANCER_ABILITIES },
  { classId: "warlock", className: "Warlock", abilities: WARLOCK_ABILITIES },
];

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/** Get all abilities for a given class */
export function getClassAbilities(classId: string): ClassAbility[] {
  const set = CLASS_ABILITY_SETS.find(s => s.classId === classId);
  return set ? set.abilities : [];
}

/** Get abilities unlocked at or below a given level */
export function getUnlockedAbilities(classId: string, level: number): ClassAbility[] {
  return getClassAbilities(classId).filter(a => a.levelRequired <= level);
}

/** Get the ability that unlocks at a specific level (for level-up notifications) */
export function getAbilityAtLevel(classId: string, level: number): ClassAbility | undefined {
  return getClassAbilities(classId).find(a => a.levelRequired === level);
}

/** Get a specific ability by ID */
export function getAbilityById(abilityId: string): ClassAbility | undefined {
  for (const set of CLASS_ABILITY_SETS) {
    const found = set.abilities.find(a => a.id === abilityId);
    if (found) return found;
  }
  return undefined;
}

/** Calculate total damage for an ability given user stats and level */
export function calculateAbilityDamage(
  ability: ClassAbility,
  statMod: number,
  userLevel: number
): { base: number; scaled: number; total: number } {
  const base = ability.baseDamage ? rollDice(ability.baseDamage) : 0;
  const statBonus = Math.floor(statMod * ability.scaling.perStatMod);
  const levelBonus = Math.floor((userLevel - ability.levelRequired) * ability.scaling.perLevel);
  const scaled = statBonus + levelBonus;
  return { base, scaled, total: base + scaled };
}

/** Calculate total healing for an ability given user stats and level */
export function calculateAbilityHealing(
  ability: ClassAbility,
  statMod: number,
  userLevel: number
): number {
  const base = ability.baseHealing ? rollDice(ability.baseHealing) : 0;
  const statBonus = Math.floor(statMod * ability.scaling.perStatMod);
  const levelBonus = Math.floor((userLevel - ability.levelRequired) * ability.scaling.perLevel);
  return base + statBonus + levelBonus;
}

/** Convert a ClassAbility's statusEffect into an ActiveSpellEffect for the combat system */
export function toActiveEffect(
  effect: StatusEffectDef,
  sourceId: string
): ActiveSpellEffect {
  return {
    spellId: `classability_${effect.id}`,
    spellName: effect.name,
    sourceId,
    remainingRounds: effect.duration,
    buffAC: effect.buffAC,
    buffAtk: effect.buffAtk,
    buffDmg: effect.buffDmg,
    buffSave: effect.buffSave,
    buffSpeed: effect.buffSpeed,
    debuffAC: effect.debuffAC,
    debuffAtk: effect.debuffAtk,
    debuffDmg: effect.debuffDmg,
    condition: effect.condition,
  };
}

/** Generate a tooltip string for an ability */
export function getAbilityTooltip(ability: ClassAbility, userLevel: number, statMod: number): string {
  const lines: string[] = [];
  lines.push(ability.name);
  lines.push(ability.description);
  lines.push(`Level Required: ${ability.levelRequired}`);
  lines.push(`Mana Cost: ${ability.manaCost}`);
  lines.push(`Cooldown: ${ability.cooldownTurns} turns`);
  lines.push(`Range: ${ability.range === 0 ? "Self" : `${ability.range} hexes`}`);
  if (ability.areaOfEffect > 0) lines.push(`Area: ${ability.areaOfEffect} hex radius`);
  if (ability.baseDamage) {
    const avg = avgDice(ability.baseDamage);
    const statBonus = Math.floor(statMod * ability.scaling.perStatMod);
    const levelBonus = Math.floor(Math.max(0, userLevel - ability.levelRequired) * ability.scaling.perLevel);
    lines.push(`Damage: ${ability.baseDamage} + ${statBonus} (${ability.scaling.primaryStat.toUpperCase()}) + ${levelBonus} (level) [avg ${Math.floor(avg + statBonus + levelBonus)}]`);
    if (ability.damageType) lines.push(`Type: ${ability.damageType}`);
  }
  if (ability.baseHealing) {
    const avg = avgDice(ability.baseHealing);
    const statBonus = Math.floor(statMod * ability.scaling.perStatMod);
    const levelBonus = Math.floor(Math.max(0, userLevel - ability.levelRequired) * ability.scaling.perLevel);
    lines.push(`Healing: ${ability.baseHealing} + ${statBonus} + ${levelBonus} [avg ${Math.floor(avg + statBonus + levelBonus)}]`);
  }
  if (ability.statusEffects.length > 0) {
    for (const eff of ability.statusEffects) {
      const parts: string[] = [eff.name];
      if (eff.duration > 0) parts.push(`${eff.duration} rounds`);
      if (eff.condition) parts.push(eff.condition);
      if (eff.buffAC) parts.push(`+${eff.buffAC} AC`);
      if (eff.buffAtk) parts.push(`+${eff.buffAtk} ATK`);
      if (eff.buffDmg) parts.push(`+${eff.buffDmg} DMG`);
      if (eff.debuffAC) parts.push(`${eff.debuffAC} AC`);
      if (eff.debuffAtk) parts.push(`${eff.debuffAtk} ATK`);
      if (eff.dot) parts.push(`${eff.dot} ${eff.dotType ?? ""} dmg/round`);
      if (eff.hot) parts.push(`${eff.hot} heal/round`);
      lines.push(`Effect: ${parts.join(", ")}`);
    }
  }
  lines.push(`Action: ${ability.actionType}`);
  if (ability.concentration) lines.push("Requires concentration");
  return lines.join("\n");
}
