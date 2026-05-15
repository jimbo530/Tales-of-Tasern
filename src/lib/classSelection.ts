// Tales of Tasern — Class Selection & Starting Stats
// Used during character creation. Stats are our system (D&D stats -10, min 1).
// A stat of 1 here = D&D 11, stat of 5 = D&D 15, stat of 8 = D&D 18.

export type StartingStats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type ClassStartingData = {
  classId: string;
  className: string;
  hitDie: string;
  description: string;
  playstyle: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Starting ability scores (our system: D&D value - 10) */
  startingStats: StartingStats;
  /** Starting HP at level 1 (max hit die + CON mod) */
  startingHp: number;
  /** Starting mana at level 1 */
  startingMana: number;
  /** Recommended role in a party */
  role: "tank" | "melee_dps" | "ranged_dps" | "healer" | "support" | "caster";
  /** Key stat for the class */
  primaryStat: keyof StartingStats;
  /** Secondary stat */
  secondaryStat: keyof StartingStats;
  /** Starting equipment names */
  startingEquipment: string[];
  /** Starting gold (in gp) */
  startingGold: number;
};

// ── Stat allocation philosophy ────────────────────────────────────────────────
// Total stat points per class: 24 (spread across 6 stats)
// Primary stat gets 5-6, secondary gets 4-5, tertiary gets 3-4, dumps get 1-2.
// This creates distinct class identities while remaining balanced.

export const CLASS_STARTING_DATA: ClassStartingData[] = [
  {
    classId: "fighter",
    className: "Fighter",
    hitDie: "d10",
    description: "A master of weapons and armor. Excels in straightforward melee combat through sheer martial prowess and endurance.",
    playstyle: "Get in close and hit hard. High survivability lets you stay in the fight longer than anyone else. Simple but effective.",
    difficulty: "beginner",
    startingStats: { str: 6, dex: 3, con: 5, int: 2, wis: 3, cha: 2 },
    startingHp: 12,
    startingMana: 20,
    role: "tank",
    primaryStat: "str",
    secondaryStat: "con",
    startingEquipment: ["Longsword", "Chain Mail", "Heavy Shield", "Adventurer's Kit"],
    startingGold: 150,
  },
  {
    classId: "wizard",
    className: "Wizard",
    hitDie: "d4",
    description: "A scholar of the arcane who bends reality through study. Fragile but devastating at range with the most powerful spells in the game.",
    playstyle: "Stay back and obliterate groups of enemies with area spells. Manage your mana carefully — you are a glass cannon.",
    difficulty: "intermediate",
    startingStats: { str: 1, dex: 3, con: 2, int: 7, wis: 4, cha: 3 },
    startingHp: 5,
    startingMana: 60,
    role: "caster",
    primaryStat: "int",
    secondaryStat: "wis",
    startingEquipment: ["Quarterstaff", "Spellbook", "Component Pouch", "Scholar's Kit"],
    startingGold: 100,
  },
  {
    classId: "rogue",
    className: "Rogue",
    hitDie: "d6",
    description: "A cunning opportunist who strikes from the shadows. Relies on positioning, timing, and devastating single-target burst damage.",
    playstyle: "Maneuver around enemies to flank them. Your backstab damage skyrockets when you have positioning advantage. High skill, high reward.",
    difficulty: "intermediate",
    startingStats: { str: 2, dex: 7, con: 3, int: 4, wis: 2, cha: 3 },
    startingHp: 8,
    startingMana: 25,
    role: "melee_dps",
    primaryStat: "dex",
    secondaryStat: "int",
    startingEquipment: ["Short Sword", "Dagger", "Leather Armor", "Thieves' Tools", "Adventurer's Kit"],
    startingGold: 125,
  },
  {
    classId: "cleric",
    className: "Cleric",
    hitDie: "d8",
    description: "A divine servant channeling the power of the gods. The ultimate support class — heals allies, buffs the party, and smites the unholy.",
    playstyle: "Keep your party alive while contributing damage against undead and fiends. Position mid-range to reach wounded allies.",
    difficulty: "beginner",
    startingStats: { str: 3, dex: 2, con: 4, int: 2, wis: 6, cha: 4 },
    startingHp: 10,
    startingMana: 50,
    role: "healer",
    primaryStat: "wis",
    secondaryStat: "cha",
    startingEquipment: ["Heavy Mace", "Chain Shirt", "Light Shield", "Holy Symbol", "Healer's Kit"],
    startingGold: 125,
  },
  {
    classId: "ranger",
    className: "Ranger",
    hitDie: "d8",
    description: "A skilled tracker and hunter deadly with bow or dual blades. Combines ranged damage with traps and animal companions.",
    playstyle: "Control the battlefield from range. Lay traps, summon your companion, and pick off enemies one by one. Versatile in any situation.",
    difficulty: "beginner",
    startingStats: { str: 3, dex: 6, con: 3, int: 2, wis: 4, cha: 2 },
    startingHp: 10,
    startingMana: 30,
    role: "ranged_dps",
    primaryStat: "dex",
    secondaryStat: "wis",
    startingEquipment: ["Longbow", "Short Sword", "Studded Leather", "Quiver (40 arrows)", "Adventurer's Kit"],
    startingGold: 130,
  },
  {
    classId: "paladin",
    className: "Paladin",
    hitDie: "d10",
    description: "A holy warrior bound by oath. Combines tanking, healing, and burst damage. The most versatile melee class.",
    playstyle: "Wade into battle as a holy juggernaut. Heal your allies, smite your foes, and your auras passively protect everyone nearby.",
    difficulty: "intermediate",
    startingStats: { str: 5, dex: 2, con: 4, int: 1, wis: 3, cha: 5 },
    startingHp: 12,
    startingMana: 35,
    role: "tank",
    primaryStat: "cha",
    secondaryStat: "str",
    startingEquipment: ["Longsword", "Heavy Shield", "Chain Mail", "Holy Symbol", "Adventurer's Kit"],
    startingGold: 150,
  },
  {
    classId: "barbarian",
    className: "Barbarian",
    hitDie: "d12",
    description: "A ferocious warrior channeling primal rage. The highest HP in the game with devastating but reckless offense.",
    playstyle: "Charge in and rage. You are the toughest combatant alive. Trade defense for offense and crush everything in your path.",
    difficulty: "beginner",
    startingStats: { str: 6, dex: 3, con: 6, int: 1, wis: 2, cha: 3 },
    startingHp: 14,
    startingMana: 15,
    role: "melee_dps",
    primaryStat: "str",
    secondaryStat: "con",
    startingEquipment: ["Greataxe", "Hide Armor", "Javelins (4)", "Adventurer's Kit"],
    startingGold: 80,
  },
  {
    classId: "bard",
    className: "Bard",
    hitDie: "d6",
    description: "A versatile performer who weaves magic through music. The ultimate support — buffs, debuffs, healing, and crowd control in one package.",
    playstyle: "Stay mid-range and empower your party with songs. Your buffs make everyone better. Counter enemy spells and charm dangerous foes.",
    difficulty: "advanced",
    startingStats: { str: 2, dex: 4, con: 3, int: 3, wis: 3, cha: 6 },
    startingHp: 8,
    startingMana: 45,
    role: "support",
    primaryStat: "cha",
    secondaryStat: "dex",
    startingEquipment: ["Rapier", "Lute", "Leather Armor", "Entertainer's Kit", "Spell Component Pouch"],
    startingGold: 125,
  },
  {
    classId: "druid",
    className: "Druid",
    hitDie: "d8",
    description: "A guardian of nature commanding animals, storms, and earth. Transforms into beasts and summons nature spirits.",
    playstyle: "Adapt to any role. Wild Shape for melee, summon beasts for allies, or cast devastating nature spells from safety. Jack of all trades.",
    difficulty: "advanced",
    startingStats: { str: 2, dex: 3, con: 4, int: 3, wis: 6, cha: 3 },
    startingHp: 10,
    startingMana: 50,
    role: "caster",
    primaryStat: "wis",
    secondaryStat: "con",
    startingEquipment: ["Scimitar", "Wooden Shield", "Hide Armor", "Holly and Mistletoe", "Adventurer's Kit"],
    startingGold: 100,
  },
  {
    classId: "monk",
    className: "Monk",
    hitDie: "d8",
    description: "A disciplined martial artist with supernatural speed and ki powers. High mobility, stunning strikes, and unmatched defensive agility.",
    playstyle: "Dart around the battlefield striking key targets. Stun dangerous enemies, deflect attacks, and nobody can pin you down.",
    difficulty: "advanced",
    startingStats: { str: 4, dex: 5, con: 3, int: 2, wis: 5, cha: 2 },
    startingHp: 10,
    startingMana: 35,
    role: "melee_dps",
    primaryStat: "wis",
    secondaryStat: "dex",
    startingEquipment: ["Quarterstaff", "Monk's Outfit", "Adventurer's Kit"],
    startingGold: 50,
  },
  {
    classId: "necromancer",
    className: "Necromancer",
    hitDie: "d4",
    description: "A master of death magic who raises the dead and drains life force. Builds an army of undead while staying safely behind them.",
    playstyle: "Raise skeletons from fallen foes to fight for you. Drain life to stay alive, and explode corpses for area damage. You get stronger as enemies die.",
    difficulty: "advanced",
    startingStats: { str: 1, dex: 3, con: 3, int: 7, wis: 3, cha: 4 },
    startingHp: 5,
    startingMana: 55,
    role: "caster",
    primaryStat: "int",
    secondaryStat: "cha",
    startingEquipment: ["Dagger", "Bone Staff", "Dark Robes", "Spell Component Pouch", "Scholar's Kit"],
    startingGold: 90,
  },
  {
    classId: "warlock",
    className: "Warlock",
    hitDie: "d6",
    description: "A caster who draws power from a dark pact. Reliable ranged damage with Eldritch Blast, supplemented by curses and fiendish summons.",
    playstyle: "Hex a target then blast them from range. Sacrifice HP for mana when needed. Your familiar and curses do half the work for you.",
    difficulty: "intermediate",
    startingStats: { str: 2, dex: 3, con: 3, int: 3, wis: 3, cha: 7 },
    startingHp: 8,
    startingMana: 50,
    role: "ranged_dps",
    primaryStat: "cha",
    secondaryStat: "con",
    startingEquipment: ["Dagger", "Eldritch Focus", "Leather Armor", "Dark Grimoire", "Adventurer's Kit"],
    startingGold: 110,
  },
];

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/** Get starting data for a class */
export function getClassStartingData(classId: string): ClassStartingData | undefined {
  return CLASS_STARTING_DATA.find(c => c.classId === classId);
}

/** Get all classes sorted by difficulty */
export function getClassesByDifficulty(): { beginner: ClassStartingData[]; intermediate: ClassStartingData[]; advanced: ClassStartingData[] } {
  return {
    beginner: CLASS_STARTING_DATA.filter(c => c.difficulty === "beginner"),
    intermediate: CLASS_STARTING_DATA.filter(c => c.difficulty === "intermediate"),
    advanced: CLASS_STARTING_DATA.filter(c => c.difficulty === "advanced"),
  };
}

/** Get classes by role */
export function getClassesByRole(role: ClassStartingData["role"]): ClassStartingData[] {
  return CLASS_STARTING_DATA.filter(c => c.role === role);
}

/** Calculate starting HP from class data: max hit die + CON modifier */
export function calculateStartingHp(classData: ClassStartingData): number {
  const hitDieMax: Record<string, number> = {
    d4: 4, d6: 6, d8: 8, d10: 10, d12: 12,
  };
  const dieMax = hitDieMax[classData.hitDie] ?? 8;
  const conMod = Math.floor(Math.max(0, classData.startingStats.con) / 2);
  return dieMax + conMod;
}

/** Stat modifier from our stat value (stat / 2 floored) */
export function statModifier(statValue: number): number {
  return Math.floor(Math.max(0, statValue) / 2);
}

/** Total stat points for validation (should always be 21 for balanced classes) */
export function totalStatPoints(stats: StartingStats): number {
  return stats.str + stats.dex + stats.con + stats.int + stats.wis + stats.cha;
}

/** Get a brief class comparison table entry */
export function getClassSummary(classId: string): string | null {
  const data = getClassStartingData(classId);
  if (!data) return null;
  const stats = data.startingStats;
  return `${data.className} [${data.difficulty}] — ${data.role} — HP:${data.startingHp} MP:${data.startingMana} — STR:${stats.str} DEX:${stats.dex} CON:${stats.con} INT:${stats.int} WIS:${stats.wis} CHA:${stats.cha}`;
}
