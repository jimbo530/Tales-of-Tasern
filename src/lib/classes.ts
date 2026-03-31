// Tales of Tasern — Character Classes (inspired by D&D 3.5 SRD)
// Stats are LP-backed, not traditional D&D ability scores.
// Class features are preserved as design notes — to be adapted for
// our LP-stat system in future updates. Hit die affects HP calculation.
// Active abilities (rage, sneak attack, spells, etc.) are TODO.

export type HitDie = "d4" | "d6" | "d8" | "d10" | "d12";
export type BABProgression = "good" | "average" | "poor";
export type SaveQuality = "good" | "poor";

export type ClassFeature = {
  name: string;
  level: number;
  description: string;
  /** Passive stat modifier applied automatically */
  passive?: {
    hpBonus?: number;
    acBonus?: number;
    speedBonus?: number;
    atkBonus?: number;
    damageBonus?: number;
    fortBonus?: number;
    refBonus?: number;
    willBonus?: number;
  };
  /** Active ability usable in combat */
  active?: {
    uses: number | "unlimited";
    action: "standard" | "bonus" | "free";
    effect: string;
  };
};

/** Spellcasting type for classes that cast spells */
export type SpellcastingInfo = {
  type: "prepared" | "spontaneous";
  /** Primary casting ability */
  ability: "int" | "wis" | "cha";
  /** Caster class key matching spells.ts CasterClass */
  casterClass: "wizard" | "sorcerer" | "cleric" | "druid" | "bard" | "paladin" | "ranger";
  /** Level at which spellcasting begins (1 for most, 4 for paladin/ranger) */
  startsAt: number;
  /** Can pick a specialization school (wizard only) */
  canSpecialize?: boolean;
  /** Picks domains at creation (cleric only) */
  picksDomains?: boolean;
  /** Number of domains to pick */
  domainCount?: number;
};

export type CharacterClass = {
  id: string;
  name: string;
  hitDie: HitDie;
  bab: BABProgression;
  goodSaves: ("fort" | "ref" | "will")[];
  keyAbilities: ("str" | "dex" | "con" | "int" | "wis" | "cha")[];
  skillPoints: number; // per level (before Int mod)
  classSkills: string[];
  description: string;
  features: ClassFeature[];
  emoji: string;
  /** Spellcasting info — undefined for non-casters (fighter, barbarian, rogue, monk) */
  spellcasting?: SpellcastingInfo;
};

// ── Hit Die values ────────────────────────────────────────────────────────────

export const HIT_DIE_VALUES: Record<HitDie, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
};

// ── BAB at level N ────────────────────────────────────────────────────────────

export function getBAB(progression: BABProgression, level: number): number {
  if (progression === "good") return level;
  if (progression === "average") return Math.floor(level * 0.75);
  return Math.floor(level * 0.5);
}

// ── Save bonus at level N ─────────────────────────────────────────────────────

export function getSaveBonus(quality: SaveQuality, level: number): number {
  if (quality === "good") return 2 + Math.floor(level / 2);
  return Math.floor(level / 3);
}

// ── All 11 Base Classes ───────────────────────────────────────────────────────

export const CLASSES: CharacterClass[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: "d12",
    bab: "good",
    goodSaves: ["fort"],
    keyAbilities: ["str", "con"],
    skillPoints: 4,
    classSkills: ["climb", "craft", "handleAnimal", "intimidate", "jump", "listen", "ride", "survival", "swim"],
    description: "A ferocious warrior who channels primal rage into devastating combat power.",
    emoji: "\u{1F4A2}",
    features: [
      {
        name: "Rage",
        level: 1,
        description: "+4 STR, +4 CON, +2 Will saves, -2 AC for 5 rounds. 1/battle.",
        active: { uses: 1, action: "free", effect: "rage" },
      },
      {
        name: "Fast Movement",
        level: 1,
        description: "+10 ft movement speed.",
        passive: { speedBonus: 10 },
      },
      {
        name: "Uncanny Dodge",
        level: 2,
        description: "Retain DEX bonus to AC when flanked.",
      },
      {
        name: "Damage Reduction",
        level: 7,
        description: "Reduce all physical damage taken by 1.",
        passive: { hpBonus: 0 },
      },
    ],
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: "d6",
    bab: "average",
    goodSaves: ["ref", "will"],
    keyAbilities: ["cha"],
    skillPoints: 6,
    classSkills: ["appraise", "balance", "bluff", "climb", "concentration", "craft", "decipherScript", "diplomacy", "disguise", "escapeArtist", "gatherInformation", "hide", "jump", "knowledge", "listen", "moveSilently", "perform", "profession", "senseMotive", "sleightOfHand", "spellcraft", "swim", "tumble", "useMagicDevice"],
    description: "A versatile performer who weaves magic through music and lore to inspire allies.",
    emoji: "\u{1F3B6}",
    spellcasting: { type: "spontaneous", ability: "cha", casterClass: "bard", startsAt: 1 },
    features: [
      {
        name: "Inspire Courage",
        level: 1,
        description: "+1 attack and damage to all allies for 5 rounds.",
        active: { uses: 3, action: "bonus", effect: "inspireCourage" },
      },
      {
        name: "Bardic Knowledge",
        level: 1,
        description: "Chance to know useful information about enemies.",
      },
      {
        name: "Fascinate",
        level: 1,
        description: "Target enemy skips their next turn. Will save to resist.",
        active: { uses: 1, action: "standard", effect: "fascinate" },
      },
      {
        name: "Inspire Competence",
        level: 3,
        description: "+2 to an ally's skill checks.",
      },
    ],
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: "d8",
    bab: "average",
    goodSaves: ["fort", "will"],
    keyAbilities: ["wis", "cha"],
    skillPoints: 2,
    classSkills: ["concentration", "craft", "diplomacy", "heal", "knowledge", "profession", "spellcraft"],
    description: "A divine servant who channels the power of the gods to heal allies and smite the unholy.",
    emoji: "\u2695\uFE0F",
    spellcasting: { type: "prepared", ability: "wis", casterClass: "cleric", startsAt: 1, picksDomains: true, domainCount: 2 },
    features: [
      {
        name: "Turn Undead",
        level: 1,
        description: "Deal 2d6 radiant damage to undead in range. 3/battle.",
        active: { uses: 3, action: "standard", effect: "turnUndead" },
      },
      {
        name: "Cure Wounds",
        level: 1,
        description: "Heal self or adjacent ally for 1d8 + WIS modifier.",
        active: { uses: 3, action: "standard", effect: "cureWounds" },
      },
      {
        name: "Divine Fortune",
        level: 1,
        description: "+1 to all saving throws.",
        passive: { fortBonus: 1, refBonus: 1, willBonus: 1 },
      },
    ],
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: "d8",
    bab: "average",
    goodSaves: ["fort", "will"],
    keyAbilities: ["wis", "cha"],
    skillPoints: 4,
    classSkills: ["concentration", "craft", "diplomacy", "handleAnimal", "heal", "knowledge", "listen", "profession", "ride", "spellcraft", "spot", "survival", "swim"],
    description: "A guardian of nature who commands animals, shifts shape, and wields the fury of the wild.",
    emoji: "\u{1F33F}",
    spellcasting: { type: "prepared", ability: "wis", casterClass: "druid", startsAt: 1 },
    features: [
      {
        name: "Wild Shape",
        level: 5,
        description: "Transform into a beast: +4 STR, +2 CON, -2 INT for 5 rounds.",
        active: { uses: 1, action: "standard", effect: "wildShape" },
      },
      {
        name: "Animal Companion",
        level: 1,
        description: "A wolf ally joins the battle with 12 HP.",
        active: { uses: 1, action: "free", effect: "animalCompanion" },
      },
      {
        name: "Nature Sense",
        level: 1,
        description: "+2 to Survival and Knowledge (nature) checks.",
      },
      {
        name: "Entangle",
        level: 1,
        description: "Root an enemy in place for 2 rounds. Reflex save to resist.",
        active: { uses: 2, action: "standard", effect: "entangle" },
      },
    ],
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: "d10",
    bab: "good",
    goodSaves: ["fort"],
    keyAbilities: ["str", "con", "dex"],
    skillPoints: 2,
    classSkills: ["climb", "craft", "handleAnimal", "intimidate", "jump", "ride", "swim"],
    description: "A master of weapons and armor, the fighter excels in straightforward combat through sheer martial prowess.",
    emoji: "\u2694\uFE0F",
    features: [
      {
        name: "Weapon Specialization",
        level: 1,
        description: "+2 damage on all attacks.",
        passive: { damageBonus: 2 },
      },
      {
        name: "Combat Expertise",
        level: 1,
        description: "Trade up to 2 attack bonus for 2 AC until next turn.",
        active: { uses: "unlimited", action: "free", effect: "combatExpertise" },
      },
      {
        name: "Bonus Feat",
        level: 1,
        description: "Fighters gain bonus combat feats at 1st and every even level.",
      },
      {
        name: "Armor Training",
        level: 3,
        description: "+1 AC from better armor use.",
        passive: { acBonus: 1 },
      },
    ],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: "d8",
    bab: "average",
    goodSaves: ["fort", "ref", "will"],
    keyAbilities: ["wis", "str", "dex"],
    skillPoints: 4,
    classSkills: ["balance", "climb", "concentration", "craft", "diplomacy", "escapeArtist", "hide", "jump", "knowledge", "listen", "moveSilently", "perform", "profession", "senseMotive", "spot", "swim", "tumble"],
    description: "A disciplined martial artist whose training grants supernatural speed, resilience, and devastating unarmed strikes.",
    emoji: "\u{1F44A}",
    features: [
      {
        name: "Flurry of Blows",
        level: 1,
        description: "Make two attacks at -2 penalty each.",
        active: { uses: "unlimited", action: "standard", effect: "flurryOfBlows" },
      },
      {
        name: "Wisdom AC Bonus",
        level: 1,
        description: "Add WIS modifier to AC when unarmored.",
        passive: { acBonus: 0 }, // computed dynamically from WIS
      },
      {
        name: "Evasion",
        level: 2,
        description: "No damage on successful Reflex save (half damage otherwise).",
      },
      {
        name: "Fast Movement",
        level: 3,
        description: "+10 ft movement speed.",
        passive: { speedBonus: 10 },
      },
      {
        name: "Stunning Fist",
        level: 1,
        description: "Target must Fort save or lose next turn. 3/battle.",
        active: { uses: 3, action: "free", effect: "stunningFist" },
      },
      {
        name: "Ki Strike",
        level: 4,
        description: "Unarmed attacks count as magic weapons.",
      },
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: "d10",
    bab: "good",
    goodSaves: ["fort"],
    keyAbilities: ["cha", "wis", "str"],
    skillPoints: 2,
    classSkills: ["concentration", "craft", "diplomacy", "handleAnimal", "heal", "knowledge", "profession", "ride", "senseMotive"],
    description: "A holy warrior bound by oath, the paladin smites evil and shields the innocent with divine grace.",
    emoji: "\u{1F6E1}\uFE0F",
    spellcasting: { type: "prepared", ability: "wis", casterClass: "paladin", startsAt: 4 },
    features: [
      {
        name: "Smite Evil",
        level: 1,
        description: "Add CHA to attack roll and level to damage against one enemy. 1/battle.",
        active: { uses: 1, action: "free", effect: "smiteEvil" },
      },
      {
        name: "Divine Grace",
        level: 2,
        description: "Add CHA modifier to all saving throws.",
      },
      {
        name: "Lay on Hands",
        level: 2,
        description: "Heal self or adjacent ally for level x CHA modifier HP. 1/battle.",
        active: { uses: 1, action: "standard", effect: "layOnHands" },
      },
      {
        name: "Aura of Courage",
        level: 3,
        description: "Immune to fear. Allies within 2 hexes get +4 vs fear.",
      },
      {
        name: "Detect Evil",
        level: 1,
        description: "Reveals enemy stats and weaknesses.",
        active: { uses: "unlimited", action: "free", effect: "detectEvil" },
      },
    ],
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: "d8",
    bab: "good",
    goodSaves: ["fort", "ref"],
    keyAbilities: ["dex", "str", "wis"],
    skillPoints: 6,
    classSkills: ["climb", "concentration", "craft", "handleAnimal", "heal", "hide", "jump", "knowledge", "listen", "moveSilently", "profession", "ride", "search", "spot", "survival", "swim", "useRope"],
    description: "A skilled tracker and hunter at home in the wilderness, deadly with bow or dual blades.",
    emoji: "\u{1F3F9}",
    spellcasting: { type: "prepared", ability: "wis", casterClass: "ranger", startsAt: 4 },
    features: [
      {
        name: "Favored Enemy",
        level: 1,
        description: "+2 damage and +2 to track checks against chosen enemy type.",
        passive: { damageBonus: 0 }, // conditional
      },
      {
        name: "Combat Style: Archery",
        level: 2,
        description: "Ranged attacks can hit enemies up to 3 hexes away.",
        active: { uses: "unlimited", action: "standard", effect: "rangedAttack" },
      },
      {
        name: "Animal Companion",
        level: 4,
        description: "A hawk ally joins battle with 8 HP.",
        active: { uses: 1, action: "free", effect: "animalCompanion" },
      },
      {
        name: "Woodland Stride",
        level: 7,
        description: "Ignore difficult terrain.",
      },
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: "d6",
    bab: "average",
    goodSaves: ["ref"],
    keyAbilities: ["dex", "int"],
    skillPoints: 8,
    classSkills: ["appraise", "balance", "bluff", "climb", "craft", "decipherScript", "diplomacy", "disableDevice", "disguise", "escapeArtist", "forgery", "gatherInformation", "hide", "intimidate", "jump", "knowledge", "listen", "moveSilently", "openLock", "perform", "profession", "search", "senseMotive", "sleightOfHand", "spot", "swim", "tumble", "useMagicDevice", "useRope"],
    description: "A cunning opportunist who strikes from the shadows, exploiting every weakness with precision.",
    emoji: "\u{1F5E1}\uFE0F",
    features: [
      {
        name: "Sneak Attack",
        level: 1,
        description: "+2d6 damage when attacking from the flank or against a surprised enemy.",
        active: { uses: "unlimited", action: "free", effect: "sneakAttack" },
      },
      {
        name: "Evasion",
        level: 2,
        description: "No damage on successful Reflex save.",
      },
      {
        name: "Uncanny Dodge",
        level: 4,
        description: "Retain DEX bonus to AC when flanked.",
      },
      {
        name: "Trapfinding",
        level: 1,
        description: "Can detect and disarm magical traps.",
      },
    ],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: "d4",
    bab: "poor",
    goodSaves: ["will"],
    keyAbilities: ["cha"],
    skillPoints: 2,
    classSkills: ["bluff", "concentration", "craft", "knowledge", "profession", "spellcraft"],
    description: "An innate spellcaster whose arcane power flows from within, unleashing devastating magical force.",
    emoji: "\u{1F525}",
    spellcasting: { type: "spontaneous", ability: "cha", casterClass: "sorcerer", startsAt: 1 },
    features: [
      {
        name: "Magic Missile",
        level: 1,
        description: "Deal 1d4+1 force damage to any enemy within 4 hexes. Auto-hit.",
        active: { uses: 5, action: "standard", effect: "magicMissile" },
      },
      {
        name: "Burning Hands",
        level: 1,
        description: "Deal 2d4 fire damage to enemies in a cone (adjacent 3 hexes). Reflex half.",
        active: { uses: 3, action: "standard", effect: "burningHands" },
      },
      {
        name: "Shield",
        level: 1,
        description: "+4 AC for 3 rounds.",
        active: { uses: 2, action: "bonus", effect: "shield" },
      },
      {
        name: "Familiar",
        level: 1,
        description: "A small familiar grants +2 to one saving throw.",
        passive: { willBonus: 2 },
      },
    ],
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: "d4",
    bab: "poor",
    goodSaves: ["will"],
    keyAbilities: ["int"],
    skillPoints: 2,
    classSkills: ["concentration", "craft", "decipherScript", "knowledge", "profession", "spellcraft"],
    description: "A scholar of the arcane who prepares powerful spells from a vast spellbook, bending reality through study.",
    emoji: "\u{1F9D9}",
    spellcasting: { type: "prepared", ability: "int", casterClass: "wizard", startsAt: 1, canSpecialize: true },
    features: [
      {
        name: "Fireball",
        level: 5,
        description: "Deal 3d6 fire damage to all enemies within 2 hexes of target. Reflex half.",
        active: { uses: 1, action: "standard", effect: "fireball" },
      },
      {
        name: "Ray of Frost",
        level: 1,
        description: "Deal 1d3 cold damage to one enemy within 4 hexes and reduce speed by 10ft.",
        active: { uses: "unlimited", action: "standard", effect: "rayOfFrost" },
      },
      {
        name: "Mage Armor",
        level: 1,
        description: "+4 AC for the entire battle.",
        active: { uses: 1, action: "bonus", effect: "mageArmor" },
      },
      {
        name: "Scribe Scroll",
        level: 1,
        description: "Can prepare one extra spell before battle.",
      },
      {
        name: "Familiar",
        level: 1,
        description: "A small familiar grants +3 HP.",
        passive: { hpBonus: 3 },
      },
    ],
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getClassById(id: string): CharacterClass | undefined {
  return CLASSES.find(c => c.id === id);
}

export function getHitDieMax(die: HitDie): number {
  return HIT_DIE_VALUES[die];
}
