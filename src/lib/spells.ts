// ── D&D 3.5 PHB Spell System ────────────────────────────────────────────────
// All spells, schools, spell slot tables, and spells-known tables from the
// Player's Handbook 3.5e.  Stats adjusted −10 (min 1) per project convention.

// ── Types ────────────────────────────────────────────────────────────────────

export type SpellSchool =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation"
  | "universal";

export const SPELL_SCHOOLS: { id: SpellSchool; name: string; description: string }[] = [
  { id: "abjuration",    name: "Abjuration",    description: "Protective spells that block, banish, or ward." },
  { id: "conjuration",   name: "Conjuration",   description: "Spells that bring creatures or materials, or heal." },
  { id: "divination",    name: "Divination",    description: "Spells that reveal information." },
  { id: "enchantment",   name: "Enchantment",   description: "Spells that affect the minds of others." },
  { id: "evocation",     name: "Evocation",     description: "Spells that manipulate energy to create effects." },
  { id: "illusion",      name: "Illusion",      description: "Spells that alter perception or create false images." },
  { id: "necromancy",    name: "Necromancy",    description: "Spells that manipulate the power of death and life force." },
  { id: "transmutation", name: "Transmutation", description: "Spells that transform the subject." },
  { id: "universal",     name: "Universal",     description: "Not a true school — cannot specialize or prohibit." },
];

/** Wizard specialization: pick one school, prohibit two others (never universal) */
export const SPECIALIZABLE_SCHOOLS: SpellSchool[] = [
  "abjuration", "conjuration", "divination", "enchantment",
  "evocation", "illusion", "necromancy", "transmutation",
];

export type CasterClass = "wizard" | "sorcerer" | "cleric" | "druid" | "bard" | "paladin" | "ranger";

export type SpellBattleEffect = {
  type: "damage" | "healing" | "buff" | "debuff" | "summon" | "utility" | "condition";
  hexRange: number;           // 0=self, 1=touch/adjacent, 2-3=close, 4-6=medium, 7+=long
  hexArea?: number;           // radius in hexes for AoE
  damage?: string;            // dice expr: "1d4+1", "1d6/level"
  damageType?: string;        // "fire", "cold", "acid", "electricity", "force", "sonic", etc.
  healing?: string;           // dice expr
  buffAC?: number;
  buffAtk?: number;
  buffDmg?: number;
  buffSave?: number;
  buffSpeed?: number;
  debuffAC?: number;
  debuffAtk?: number;
  debuffDmg?: number;
  condition?: string;         // "stunned", "frightened", "entangled", "prone", "dazed", etc.
  durationRounds?: number;    // 0 = instant, -1 = until end of combat
  save?: "fort" | "ref" | "will";
};

export type Spell = {
  id: string;
  name: string;
  school: SpellSchool;
  subschool?: string;
  descriptor?: string[];      // fire, cold, mind-affecting, fear, force, etc.
  levels: Partial<Record<CasterClass, number>>;
  components: string;         // "V,S", "V,S,M", "V,S,DF", etc.
  castingTime: "standard" | "full-round" | "1 minute" | "10 minutes" | "1 hour" | "24 hours";
  range: "personal" | "touch" | "close" | "medium" | "long" | "unlimited";
  duration: string;
  savingThrow: string;        // "none", "Will negates", "Reflex half", etc.
  sr: boolean;                // spell resistance applies?
  description: string;
  battle?: SpellBattleEffect;
};

// ── Spell Slots Per Day ─────────────────────────────────────────────────────
// Index = class level (1-20), value = array of slots [0th, 1st, 2nd, ...]
// "-" in PHB = null here (can't cast that level yet)
// Bonus spells from ability scores are added at runtime.

type SlotRow = (number | null)[];

export const WIZARD_SLOTS: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [3, 1],
  /*  2 */ [4, 2],
  /*  3 */ [4, 2, 1],
  /*  4 */ [4, 3, 2],
  /*  5 */ [4, 3, 2, 1],
  /*  6 */ [4, 3, 3, 2],
  /*  7 */ [4, 4, 3, 2, 1],
  /*  8 */ [4, 4, 3, 3, 2],
  /*  9 */ [4, 4, 4, 3, 2, 1],
  /* 10 */ [4, 4, 4, 3, 3, 2],
  /* 11 */ [4, 4, 4, 4, 3, 2, 1],
  /* 12 */ [4, 4, 4, 4, 3, 3, 2],
  /* 13 */ [4, 4, 4, 4, 4, 3, 2, 1],
  /* 14 */ [4, 4, 4, 4, 4, 3, 3, 2],
  /* 15 */ [4, 4, 4, 4, 4, 4, 3, 2, 1],
  /* 16 */ [4, 4, 4, 4, 4, 4, 3, 3, 2],
  /* 17 */ [4, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  /* 18 */ [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
  /* 19 */ [4, 4, 4, 4, 4, 4, 4, 4, 3, 3],
  /* 20 */ [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];

export const SORCERER_SLOTS: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [5, 3],
  /*  2 */ [6, 4],
  /*  3 */ [6, 5],
  /*  4 */ [6, 6, 3],
  /*  5 */ [6, 6, 4],
  /*  6 */ [6, 6, 5, 3],
  /*  7 */ [6, 6, 6, 4],
  /*  8 */ [6, 6, 6, 5, 3],
  /*  9 */ [6, 6, 6, 6, 4],
  /* 10 */ [6, 6, 6, 6, 5, 3],
  /* 11 */ [6, 6, 6, 6, 6, 4],
  /* 12 */ [6, 6, 6, 6, 6, 5, 3],
  /* 13 */ [6, 6, 6, 6, 6, 6, 4],
  /* 14 */ [6, 6, 6, 6, 6, 6, 5, 3],
  /* 15 */ [6, 6, 6, 6, 6, 6, 6, 4],
  /* 16 */ [6, 6, 6, 6, 6, 6, 6, 5, 3],
  /* 17 */ [6, 6, 6, 6, 6, 6, 6, 6, 4],
  /* 18 */ [6, 6, 6, 6, 6, 6, 6, 6, 5, 3],
  /* 19 */ [6, 6, 6, 6, 6, 6, 6, 6, 6, 4],
  /* 20 */ [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
];

export const SORCERER_KNOWN: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [4, 2],
  /*  2 */ [5, 2],
  /*  3 */ [5, 3],
  /*  4 */ [6, 3, 1],
  /*  5 */ [6, 4, 2],
  /*  6 */ [7, 4, 2, 1],
  /*  7 */ [7, 5, 3, 2],
  /*  8 */ [8, 5, 3, 2, 1],
  /*  9 */ [8, 5, 4, 3, 2],
  /* 10 */ [9, 5, 4, 3, 2, 1],
  /* 11 */ [9, 5, 5, 4, 3, 2],
  /* 12 */ [9, 5, 5, 4, 3, 2, 1],
  /* 13 */ [9, 5, 5, 4, 4, 3, 2],
  /* 14 */ [9, 5, 5, 4, 4, 3, 2, 1],
  /* 15 */ [9, 5, 5, 4, 4, 4, 3, 2],
  /* 16 */ [9, 5, 5, 4, 4, 4, 3, 2, 1],
  /* 17 */ [9, 5, 5, 4, 4, 4, 3, 3, 2],
  /* 18 */ [9, 5, 5, 4, 4, 4, 3, 3, 2, 1],
  /* 19 */ [9, 5, 5, 4, 4, 4, 3, 3, 3, 2],
  /* 20 */ [9, 5, 5, 4, 4, 4, 3, 3, 3, 3],
];

export const CLERIC_SLOTS: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [3, 1],       // +1 domain slot per spell level
  /*  2 */ [4, 2],
  /*  3 */ [4, 2, 1],
  /*  4 */ [5, 3, 2],
  /*  5 */ [5, 3, 2, 1],
  /*  6 */ [5, 3, 3, 2],
  /*  7 */ [6, 4, 3, 2, 1],
  /*  8 */ [6, 4, 3, 3, 2],
  /*  9 */ [6, 4, 4, 3, 2, 1],
  /* 10 */ [6, 4, 4, 3, 3, 2],
  /* 11 */ [6, 5, 4, 4, 3, 2, 1],
  /* 12 */ [6, 5, 4, 4, 3, 3, 2],
  /* 13 */ [6, 5, 5, 4, 4, 3, 2, 1],
  /* 14 */ [6, 5, 5, 4, 4, 3, 3, 2],
  /* 15 */ [6, 5, 5, 5, 4, 4, 3, 2, 1],
  /* 16 */ [6, 5, 5, 5, 4, 4, 3, 3, 2],
  /* 17 */ [6, 5, 5, 5, 5, 4, 4, 3, 2, 1],
  /* 18 */ [6, 5, 5, 5, 5, 4, 4, 3, 3, 2],
  /* 19 */ [6, 5, 5, 5, 5, 5, 4, 4, 3, 3],
  /* 20 */ [6, 5, 5, 5, 5, 5, 4, 4, 4, 4],
];

export const DRUID_SLOTS: SlotRow[] = CLERIC_SLOTS;  // same progression (no domain slots though)

export const BARD_SLOTS: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [2],
  /*  2 */ [3, 0],
  /*  3 */ [3, 1],
  /*  4 */ [3, 2, 0],
  /*  5 */ [3, 3, 1],
  /*  6 */ [3, 3, 2],
  /*  7 */ [3, 3, 2, 0],
  /*  8 */ [3, 3, 3, 1],
  /*  9 */ [3, 3, 3, 2],
  /* 10 */ [3, 3, 3, 2, 0],
  /* 11 */ [3, 3, 3, 3, 1],
  /* 12 */ [3, 3, 3, 3, 2],
  /* 13 */ [3, 3, 3, 3, 2, 0],
  /* 14 */ [4, 3, 3, 3, 3, 1],
  /* 15 */ [4, 4, 3, 3, 3, 2],
  /* 16 */ [4, 4, 4, 3, 3, 2, 0],
  /* 17 */ [4, 4, 4, 4, 3, 3, 1],
  /* 18 */ [4, 4, 4, 4, 4, 3, 2],
  /* 19 */ [4, 4, 4, 4, 4, 4, 3],
  /* 20 */ [4, 4, 4, 4, 4, 4, 4],
];

export const BARD_KNOWN: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [4],
  /*  2 */ [5, 2],
  /*  3 */ [6, 3],
  /*  4 */ [6, 3, 2],
  /*  5 */ [6, 4, 3],
  /*  6 */ [6, 4, 3],
  /*  7 */ [6, 4, 4, 2],
  /*  8 */ [6, 4, 4, 3],
  /*  9 */ [6, 4, 4, 3],
  /* 10 */ [6, 4, 4, 4, 2],
  /* 11 */ [6, 4, 4, 4, 3],
  /* 12 */ [6, 4, 4, 4, 3],
  /* 13 */ [6, 4, 4, 4, 4, 2],
  /* 14 */ [6, 4, 4, 4, 4, 3],
  /* 15 */ [6, 4, 4, 4, 4, 3],
  /* 16 */ [6, 5, 4, 4, 4, 4, 2],
  /* 17 */ [6, 5, 5, 4, 4, 4, 3],
  /* 18 */ [6, 5, 5, 5, 4, 4, 3],
  /* 19 */ [6, 5, 5, 5, 5, 4, 4],
  /* 20 */ [6, 5, 5, 5, 5, 5, 4],
];

export const PALADIN_SLOTS: SlotRow[] = [
  /*  0 */ [],
  /*  1 */ [],
  /*  2 */ [],
  /*  3 */ [],
  /*  4 */ [null, 0],
  /*  5 */ [null, 0],
  /*  6 */ [null, 1],
  /*  7 */ [null, 1],
  /*  8 */ [null, 1, 0],
  /*  9 */ [null, 1, 0],
  /* 10 */ [null, 1, 1],
  /* 11 */ [null, 1, 1, 0],
  /* 12 */ [null, 1, 1, 1],
  /* 13 */ [null, 1, 1, 1],
  /* 14 */ [null, 2, 1, 1, 0],
  /* 15 */ [null, 2, 1, 1, 1],
  /* 16 */ [null, 2, 2, 1, 1],
  /* 17 */ [null, 2, 2, 2, 1],
  /* 18 */ [null, 3, 2, 2, 1],
  /* 19 */ [null, 3, 3, 3, 2],
  /* 20 */ [null, 3, 3, 3, 3],
];

export const RANGER_SLOTS: SlotRow[] = PALADIN_SLOTS;  // same progression

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get spell slots for a caster class at a given level */
export function getSpellSlots(casterClass: CasterClass, classLevel: number): SlotRow {
  const table: Record<CasterClass, SlotRow[]> = {
    wizard: WIZARD_SLOTS, sorcerer: SORCERER_SLOTS, cleric: CLERIC_SLOTS,
    druid: DRUID_SLOTS, bard: BARD_SLOTS, paladin: PALADIN_SLOTS, ranger: RANGER_SLOTS,
  };
  return table[casterClass][Math.min(classLevel, 20)] ?? [];
}

/** Get spells known for spontaneous casters */
export function getSpellsKnown(casterClass: "sorcerer" | "bard", classLevel: number): SlotRow {
  const table = casterClass === "sorcerer" ? SORCERER_KNOWN : BARD_KNOWN;
  return table[Math.min(classLevel, 20)] ?? [];
}

/** Bonus spells from ability score (PHB Table 1-1 derivative) */
export function bonusSpells(abilityScore: number): number[] {
  // Bonus spells per spell level for a given ability score
  // abilityScore 1 = mod -5, 10 = mod 0, 12 = mod +1, etc.
  const mod = Math.floor((abilityScore - 10) / 2);
  if (mod <= 0) return [];
  // Bonus spell at level N if mod >= N
  const bonus: number[] = [0]; // no bonus 0-level spells
  for (let lvl = 1; lvl <= 9; lvl++) {
    bonus.push(mod >= lvl ? 1 + Math.floor((mod - lvl) / 4) : 0);
  }
  return bonus;
}

/** Get all spells available to a class at a given spell level */
export function getClassSpells(casterClass: CasterClass, spellLevel: number): Spell[] {
  return SPELLS.filter(s => s.levels[casterClass] === spellLevel);
}

/** Get a spell by ID */
export function getSpell(id: string): Spell | undefined {
  return SPELL_MAP.get(id);
}

// ── All PHB 3.5 Spells ─────────────────────────────────────────────────────
// Organized alphabetically. Each spell lists all class/level mappings.
// Battle effects included for levels 0-3; higher levels get descriptions only
// (battle integration added as characters reach those levels).

export const SPELLS: Spell[] = [
  // ────────────────────────── 0-LEVEL (CANTRIPS / ORISONS) ──────────────────
  { id: "acid_splash", name: "Acid Splash", school: "conjuration", subschool: "creation", descriptor: ["acid"],
    levels: { sorcerer: 0, wizard: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: false,
    description: "An orb of acid deals 1d3 acid damage to a single target.",
    battle: { type: "damage", hexRange: 3, damage: "1d3", damageType: "acid" } },

  { id: "arcane_mark", name: "Arcane Mark", school: "universal",
    levels: { sorcerer: 0, wizard: 0 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "permanent", savingThrow: "none", sr: false,
    description: "Inscribes a personal rune or mark (visible or invisible)." },

  { id: "create_water", name: "Create Water", school: "conjuration", subschool: "creation", descriptor: ["water"],
    levels: { cleric: 0, druid: 0, paladin: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: false,
    description: "Creates 2 gallons per level of pure water." },

  { id: "cure_minor_wounds", name: "Cure Minor Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 0, druid: 0 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 1 point of damage.",
    battle: { type: "healing", hexRange: 1, healing: "1" } },

  { id: "dancing_lights", name: "Dancing Lights", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 min", savingThrow: "none", sr: false,
    description: "Creates up to four lights that resemble lanterns or torches, or one glowing humanoid form." },

  { id: "daze", name: "Daze", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 round", savingThrow: "Will negates", sr: true,
    description: "A humanoid of 4 HD or less loses its next action.",
    battle: { type: "condition", hexRange: 3, condition: "dazed", durationRounds: 1, save: "will" } },

  { id: "detect_magic", name: "Detect Magic", school: "divination",
    levels: { sorcerer: 0, wizard: 0, bard: 0, cleric: 0, druid: 0 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "concentration, up to 1 min/level", savingThrow: "none", sr: false,
    description: "Detects spells and magic items within 60 ft." },

  { id: "detect_poison", name: "Detect Poison", school: "divination",
    levels: { sorcerer: 0, wizard: 0, cleric: 0, druid: 0, paladin: 1, ranger: 1 }, components: "V,S",
    castingTime: "standard", range: "close", duration: "instant", savingThrow: "none", sr: false,
    description: "Detects poison in one creature or small object." },

  { id: "disrupt_undead", name: "Disrupt Undead", school: "necromancy",
    levels: { sorcerer: 0, wizard: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Deals 1d6 damage to one undead.",
    battle: { type: "damage", hexRange: 3, damage: "1d6", damageType: "positive" } },

  { id: "flare", name: "Flare", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 0, wizard: 0, bard: 0, druid: 0 }, components: "V", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Fort negates", sr: true,
    description: "Dazzles one creature, giving it -1 on attack rolls.",
    battle: { type: "debuff", hexRange: 3, debuffAtk: -1, durationRounds: 1, save: "fort" } },

  { id: "ghost_sound", name: "Ghost Sound", school: "illusion", subschool: "figment",
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 round/level", savingThrow: "Will disbelief", sr: false,
    description: "Figment sounds — anything from whispers to roaring." },

  { id: "guidance", name: "Guidance", school: "divination",
    levels: { cleric: 0, druid: 0 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "1 min or until discharged", savingThrow: "Will negates (harmless)", sr: true,
    description: "+1 on one attack roll, saving throw, or skill check.",
    battle: { type: "buff", hexRange: 1, buffAtk: 1, durationRounds: 1 } },

  { id: "inflict_minor_wounds", name: "Inflict Minor Wounds", school: "necromancy",
    levels: { cleric: 0 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half", sr: true,
    description: "Touch attack deals 1 point of damage.",
    battle: { type: "damage", hexRange: 1, damage: "1", damageType: "negative" } },

  { id: "know_direction", name: "Know Direction", school: "divination",
    levels: { bard: 0, druid: 0 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "instant", savingThrow: "none", sr: false,
    description: "You discern north." },

  { id: "light", name: "Light", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 0, wizard: 0, bard: 0, cleric: 0, druid: 0 }, components: "V,M/DF",
    castingTime: "standard", range: "touch", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Object shines like a torch." },

  { id: "lullaby", name: "Lullaby", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { bard: 0 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "concentration + 1 round/level", savingThrow: "Will negates", sr: true,
    description: "Makes subject drowsy; -5 on Spot and Listen, -2 on Will saves against sleep.",
    battle: { type: "debuff", hexRange: 5, debuffAtk: -2, durationRounds: 3, save: "will" } },

  { id: "mage_hand", name: "Mage Hand", school: "transmutation",
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "concentration", savingThrow: "none", sr: false,
    description: "5-pound telekinesis." },

  { id: "mending", name: "Mending", school: "transmutation",
    levels: { sorcerer: 0, wizard: 0, bard: 0, cleric: 0, druid: 0 }, components: "V,S",
    castingTime: "standard", range: "close", duration: "instant", savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Makes minor repairs on an object." },

  { id: "message", name: "Message", school: "transmutation", descriptor: ["language-dependent"],
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S,F", castingTime: "standard",
    range: "medium", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Whispered conversation at distance." },

  { id: "open_close", name: "Open/Close", school: "transmutation",
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S,F", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Will negates (object)", sr: true,
    description: "Opens or closes small or light things." },

  { id: "prestidigitation", name: "Prestidigitation", school: "universal",
    levels: { sorcerer: 0, wizard: 0, bard: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 hour", savingThrow: "none", sr: false,
    description: "Performs minor tricks — cleaning, warming, flavoring, coloring." },

  { id: "purify_food_drink", name: "Purify Food and Drink", school: "transmutation",
    levels: { cleric: 0, druid: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Will negates (object)", sr: true,
    description: "Purifies 1 cu. ft./level of food or water." },

  { id: "ray_of_frost", name: "Ray of Frost", school: "evocation", descriptor: ["cold"],
    levels: { sorcerer: 0, wizard: 0 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Ray deals 1d3 cold damage.",
    battle: { type: "damage", hexRange: 3, damage: "1d3", damageType: "cold" } },

  { id: "read_magic", name: "Read Magic", school: "divination",
    levels: { sorcerer: 0, wizard: 0, bard: 0, cleric: 0, druid: 0, paladin: 1, ranger: 1 },
    components: "V,S,F", castingTime: "standard", range: "personal",
    duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Read scrolls and spellbooks." },

  { id: "resistance", name: "Resistance", school: "abjuration",
    levels: { sorcerer: 0, wizard: 0, bard: 0, cleric: 0, druid: 0 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min", savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +1 on saving throws.",
    battle: { type: "buff", hexRange: 1, buffSave: 1, durationRounds: 10 } },

  { id: "summon_instrument", name: "Summon Instrument", school: "conjuration", subschool: "summoning",
    levels: { bard: 0 }, components: "V,S", castingTime: "full-round",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Summons one musical instrument of your choice." },

  { id: "touch_of_fatigue", name: "Touch of Fatigue", school: "necromancy",
    levels: { sorcerer: 0, wizard: 0 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "1 round/level", savingThrow: "Fort negates", sr: true,
    description: "Touch attack fatigues target.",
    battle: { type: "condition", hexRange: 1, condition: "fatigued", durationRounds: 3, save: "fort" } },

  { id: "virtue", name: "Virtue", school: "transmutation",
    levels: { cleric: 0, druid: 0, paladin: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 min", savingThrow: "none", sr: true,
    description: "Subject gains 1 temporary hit point.",
    battle: { type: "healing", hexRange: 1, healing: "1" } },

  // ────────────────────────── 1ST-LEVEL SPELLS ──────────────────────────────
  { id: "alarm", name: "Alarm", school: "abjuration",
    levels: { sorcerer: 1, wizard: 1, bard: 1, ranger: 1 }, components: "V,S,F/DF",
    castingTime: "standard", range: "close", duration: "2 hours/level", savingThrow: "none", sr: false,
    description: "Wards an area for 2 hours/level, alerting you to intruders." },

  { id: "animate_rope", name: "Animate Rope", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Makes a rope move at your command." },

  { id: "bane", name: "Bane", school: "enchantment", subschool: "compulsion", descriptor: ["fear", "mind-affecting"],
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "close", duration: "1 min/level", savingThrow: "Will negates", sr: true,
    description: "Enemies take -1 on attack rolls and saving throws against fear.",
    battle: { type: "debuff", hexRange: 3, debuffAtk: -1, durationRounds: 10, save: "will", hexArea: 2 } },

  { id: "bless", name: "Bless", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { cleric: 1, paladin: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "close", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "Allies gain +1 on attack rolls and saves against fear.",
    battle: { type: "buff", hexRange: 3, buffAtk: 1, buffSave: 1, durationRounds: 10, hexArea: 2 } },

  { id: "bless_water", name: "Bless Water", school: "transmutation", descriptor: ["good"],
    levels: { cleric: 1, paladin: 1 }, components: "V,S,M", castingTime: "1 minute",
    range: "touch", duration: "instant", savingThrow: "Will negates (object)", sr: true,
    description: "Makes holy water (2d4 damage to undead)." },

  { id: "bless_weapon", name: "Bless Weapon", school: "transmutation",
    levels: { paladin: 1 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Weapon strikes true against evil foes; +1 to confirm crits against evil.",
    battle: { type: "buff", hexRange: 1, buffAtk: 1, durationRounds: 10 } },

  { id: "burning_hands", name: "Burning Hands", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Reflex half", sr: true,
    description: "1d4 fire damage per caster level (max 5d4) in a cone.",
    battle: { type: "damage", hexRange: 2, hexArea: 1, damage: "1d4/level", damageType: "fire", save: "ref" } },

  { id: "calm_animals", name: "Calm Animals", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { druid: 1, ranger: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 min/level", savingThrow: "Will negates", sr: true,
    description: "Calms 2d4+level HD of animals." },

  { id: "cause_fear", name: "Cause Fear", school: "necromancy", descriptor: ["fear", "mind-affecting"],
    levels: { sorcerer: 1, wizard: 1, bard: 1, cleric: 1 }, components: "V,S",
    castingTime: "standard", range: "close", duration: "1d4 rounds or 1 round",
    savingThrow: "Will partial", sr: true,
    description: "One creature of 5 HD or less flees for 1d4 rounds.",
    battle: { type: "condition", hexRange: 3, condition: "frightened", durationRounds: 2, save: "will" } },

  { id: "charm_animal", name: "Charm Animal", school: "enchantment", subschool: "charm", descriptor: ["mind-affecting"],
    levels: { druid: 1, ranger: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 hour/level", savingThrow: "Will negates", sr: true,
    description: "Makes one animal your friend." },

  { id: "charm_person", name: "Charm Person", school: "enchantment", subschool: "charm", descriptor: ["mind-affecting"],
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 hour/level", savingThrow: "Will negates", sr: true,
    description: "Makes one humanoid your friend.",
    battle: { type: "condition", hexRange: 3, condition: "charmed", durationRounds: -1, save: "will" } },

  { id: "chill_touch", name: "Chill Touch", school: "necromancy",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Fort partial", sr: true,
    description: "One touch/level deals 1d6 negative energy damage and 1 STR damage.",
    battle: { type: "damage", hexRange: 1, damage: "1d6", damageType: "negative" } },

  { id: "color_spray", name: "Color Spray", school: "illusion", subschool: "pattern", descriptor: ["mind-affecting"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Will negates", sr: true,
    description: "Knocks unconscious, blinds, and/or stuns weak creatures in a cone.",
    battle: { type: "condition", hexRange: 2, hexArea: 1, condition: "stunned", durationRounds: 1, save: "will" } },

  { id: "command", name: "Command", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting", "language-dependent"],
    levels: { cleric: 1 }, components: "V", castingTime: "standard",
    range: "close", duration: "1 round", savingThrow: "Will negates", sr: true,
    description: "One subject obeys a one-word command for 1 round.",
    battle: { type: "condition", hexRange: 3, condition: "prone", durationRounds: 1, save: "will" } },

  { id: "comprehend_languages", name: "Comprehend Languages", school: "divination",
    levels: { sorcerer: 1, wizard: 1, bard: 1, cleric: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "personal", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "You understand all spoken and written languages." },

  { id: "cure_light_wounds", name: "Cure Light Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 1, druid: 1, bard: 1, paladin: 1, ranger: 2 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 1d8+1/level damage (max 1d8+5).",
    battle: { type: "healing", hexRange: 1, healing: "1d8+1/level" } },

  { id: "curse_water", name: "Curse Water", school: "necromancy", descriptor: ["evil"],
    levels: { cleric: 1 }, components: "V,S,M", castingTime: "1 minute",
    range: "touch", duration: "instant", savingThrow: "Will negates (object)", sr: true,
    description: "Makes unholy water." },

  { id: "deathwatch", name: "Deathwatch", school: "necromancy",
    levels: { cleric: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Reveals how near death subjects within 30 ft. are." },

  { id: "delay_poison", name: "Delay Poison", school: "conjuration", subschool: "healing",
    levels: { cleric: 2, druid: 2, bard: 2, paladin: 2, ranger: 1 }, components: "V,S,DF",
    castingTime: "standard", range: "touch", duration: "1 hour/level",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "Stops poison from harming subject for 1 hour/level." },

  { id: "detect_animals_plants", name: "Detect Animals or Plants", school: "divination",
    levels: { druid: 1, ranger: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Detects kinds of animals or plants." },

  { id: "detect_chaos", name: "Detect Chaos", school: "divination",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Reveals creatures, spells, or objects of selected alignment." },

  { id: "detect_evil", name: "Detect Evil", school: "divination",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Reveals creatures, spells, or objects of evil alignment." },

  { id: "detect_good", name: "Detect Good", school: "divination",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Reveals creatures, spells, or objects of good alignment." },

  { id: "detect_law", name: "Detect Law", school: "divination",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Reveals creatures, spells, or objects of lawful alignment." },

  { id: "detect_secret_doors", name: "Detect Secret Doors", school: "divination",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "concentration, up to 1 min/level", savingThrow: "none", sr: false,
    description: "Reveals hidden doors within 60 ft." },

  { id: "detect_snares_pits", name: "Detect Snares and Pits", school: "divination",
    levels: { druid: 1, ranger: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "concentration, up to 10 min/level", savingThrow: "none", sr: false,
    description: "Reveals natural or primitive traps." },

  { id: "detect_undead", name: "Detect Undead", school: "divination",
    levels: { sorcerer: 1, wizard: 1, cleric: 1, paladin: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "personal", duration: "concentration, up to 1 min/level",
    savingThrow: "none", sr: false,
    description: "Reveals undead within 60 ft." },

  { id: "disguise_self", name: "Disguise Self", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Changes your appearance." },

  { id: "divine_favor", name: "Divine Favor", school: "evocation",
    levels: { cleric: 1, paladin: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "1 min", savingThrow: "none", sr: false,
    description: "You gain +1/3 levels on attack and damage rolls (max +3).",
    battle: { type: "buff", hexRange: 0, buffAtk: 1, buffDmg: 1, durationRounds: 10 } },

  { id: "doom", name: "Doom", school: "necromancy", descriptor: ["fear", "mind-affecting"],
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "Will negates", sr: true,
    description: "One subject takes -2 on attack rolls, damage, saves, and checks.",
    battle: { type: "debuff", hexRange: 5, debuffAtk: -2, debuffDmg: -2, durationRounds: 10, save: "will" } },

  { id: "endure_elements", name: "Endure Elements", school: "abjuration",
    levels: { sorcerer: 1, wizard: 1, cleric: 1, druid: 1, paladin: 1, ranger: 1 },
    components: "V,S", castingTime: "standard", range: "touch", duration: "24 hours",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Exist comfortably in hot or cold environments." },

  { id: "enlarge_person", name: "Enlarge Person", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S,M", castingTime: "full-round",
    range: "close", duration: "1 min/level", savingThrow: "Fort negates", sr: true,
    description: "Humanoid creature doubles in size. +2 STR, -2 DEX, -1 AC, -1 attack.",
    battle: { type: "buff", hexRange: 3, buffDmg: 2, debuffAC: -1, durationRounds: 10 } },

  { id: "entangle", name: "Entangle", school: "transmutation",
    levels: { druid: 1, ranger: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "long", duration: "1 min/level", savingThrow: "Reflex partial", sr: false,
    description: "Plants in a 40-ft. radius entangle creatures.",
    battle: { type: "condition", hexRange: 7, hexArea: 2, condition: "entangled", durationRounds: 10, save: "ref" } },

  { id: "entropic_shield", name: "Entropic Shield", school: "abjuration",
    levels: { cleric: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Ranged attacks against you have 20% miss chance.",
    battle: { type: "buff", hexRange: 0, buffAC: 2, durationRounds: 10 } },

  { id: "erase", name: "Erase", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: false,
    description: "Mundane or magical writing vanishes." },

  { id: "expeditious_retreat", name: "Expeditious Retreat", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Your speed increases by 30 ft.",
    battle: { type: "buff", hexRange: 0, buffSpeed: 6, durationRounds: 10 } },

  { id: "faerie_fire", name: "Faerie Fire", school: "evocation", descriptor: ["light"],
    levels: { druid: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "long", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "Outlines subjects with light, negating blur, concealment, and invisibility.",
    battle: { type: "debuff", hexRange: 7, hexArea: 1, debuffAC: -2, durationRounds: 10 } },

  { id: "feather_fall", name: "Feather Fall", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V", castingTime: "standard",
    range: "close", duration: "until landing", savingThrow: "Will negates (harmless)", sr: true,
    description: "Objects or creatures fall slowly." },

  { id: "goodberry", name: "Goodberry", school: "transmutation",
    levels: { druid: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 day/level", savingThrow: "none", sr: true,
    description: "2d4 berries each cure 1 hp (max 8 hp/day).",
    battle: { type: "healing", hexRange: 1, healing: "1" } },

  { id: "grease", name: "Grease", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 round/level", savingThrow: "Reflex partial", sr: false,
    description: "Makes a 10-ft. square or one object slippery.",
    battle: { type: "condition", hexRange: 3, hexArea: 1, condition: "prone", durationRounds: 3, save: "ref" } },

  { id: "hide_from_animals", name: "Hide from Animals", school: "abjuration",
    levels: { druid: 1, ranger: 1 }, components: "S,DF", castingTime: "standard",
    range: "touch", duration: "10 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "Animals can't perceive one subject/level." },

  { id: "hide_from_undead", name: "Hide from Undead", school: "abjuration",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "10 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "Undead can't perceive one subject/level." },

  { id: "hold_portal", name: "Hold Portal", school: "abjuration",
    levels: { sorcerer: 1, wizard: 1 }, components: "V", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Holds door shut." },

  { id: "hypnotism", name: "Hypnotism", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S", castingTime: "full-round",
    range: "close", duration: "2d4 rounds", savingThrow: "Will negates", sr: true,
    description: "Fascinates 2d4 HD of creatures.",
    battle: { type: "condition", hexRange: 3, condition: "dazed", durationRounds: 2, save: "will" } },

  { id: "identify", name: "Identify", school: "divination",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,M", castingTime: "1 hour",
    range: "touch", duration: "instant", savingThrow: "none", sr: false,
    description: "Determines properties of a magic item." },

  { id: "inflict_light_wounds", name: "Inflict Light Wounds", school: "necromancy",
    levels: { cleric: 1 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half", sr: true,
    description: "Touch deals 1d8+1/level damage (max 1d8+5).",
    battle: { type: "damage", hexRange: 1, damage: "1d8+1/level", damageType: "negative" } },

  { id: "jump", name: "Jump", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, druid: 1, ranger: 1 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gets +10 on Jump checks (+20 at 5th, +30 at 9th)." },

  { id: "lesser_confusion", name: "Lesser Confusion", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { bard: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "close", duration: "1 round", savingThrow: "Will negates", sr: true,
    description: "One creature acts randomly for 1 round.",
    battle: { type: "condition", hexRange: 3, condition: "confused", durationRounds: 1, save: "will" } },

  { id: "longstrider", name: "Longstrider", school: "transmutation",
    levels: { druid: 1, ranger: 1 }, components: "V,S,M", castingTime: "standard",
    range: "personal", duration: "1 hour/level", savingThrow: "none", sr: false,
    description: "Increases your speed by 10 ft.",
    battle: { type: "buff", hexRange: 0, buffSpeed: 2, durationRounds: -1 } },

  { id: "mage_armor", name: "Mage Armor", school: "conjuration", subschool: "creation", descriptor: ["force"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S,F", castingTime: "standard",
    range: "touch", duration: "1 hour/level", savingThrow: "Will negates (harmless)", sr: false,
    description: "Gives subject +4 armor bonus.",
    battle: { type: "buff", hexRange: 1, buffAC: 4, durationRounds: -1 } },

  { id: "magic_fang", name: "Magic Fang", school: "transmutation",
    levels: { druid: 1, ranger: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "One natural weapon of subject gets +1 on attack and damage.",
    battle: { type: "buff", hexRange: 1, buffAtk: 1, buffDmg: 1, durationRounds: 10 } },

  { id: "magic_missile", name: "Magic Missile", school: "evocation", descriptor: ["force"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "none", sr: true,
    description: "1d4+1 damage; +1 missile per two levels above 1st (max 5).",
    battle: { type: "damage", hexRange: 5, damage: "1d4+1", damageType: "force" } },

  { id: "magic_mouth", name: "Magic Mouth", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 2, wizard: 2, bard: 1 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "permanent until discharged", savingThrow: "Will negates (object)", sr: true,
    description: "Speaks once when triggered." },

  { id: "magic_stone", name: "Magic Stone", school: "transmutation",
    levels: { cleric: 1, druid: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "30 min or until discharged", savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Three stones gain +1 on attack, deal 1d6+1 damage.",
    battle: { type: "damage", hexRange: 3, damage: "1d6+1" } },

  { id: "magic_weapon", name: "Magic Weapon", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1, cleric: 1, paladin: 1 }, components: "V,S,DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Weapon gains +1 enhancement bonus.",
    battle: { type: "buff", hexRange: 1, buffAtk: 1, buffDmg: 1, durationRounds: 10 } },

  { id: "mount", name: "Mount", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S,M", castingTime: "full-round",
    range: "close", duration: "2 hours/level", savingThrow: "none", sr: false,
    description: "Summons riding horse for 2 hours/level." },

  { id: "nystuls_magic_aura", name: "Nystul's Magic Aura", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,F", castingTime: "standard",
    range: "touch", duration: "1 day/level", savingThrow: "none", sr: false,
    description: "Alters object's magic aura." },

  { id: "obscure_object", name: "Obscure Object", school: "abjuration",
    levels: { bard: 1, cleric: 3, sorcerer: 2, wizard: 2 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "8 hours", savingThrow: "Will negates (object)", sr: true,
    description: "Masks object against scrying." },

  { id: "obscuring_mist", name: "Obscuring Mist", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 1, wizard: 1, cleric: 1, druid: 1 }, components: "V,S",
    castingTime: "standard", range: "close", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Fog surrounds you, giving concealment.",
    battle: { type: "utility", hexRange: 0, hexArea: 1, durationRounds: 10 } },

  { id: "pass_without_trace", name: "Pass without Trace", school: "transmutation",
    levels: { druid: 1, ranger: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 hour/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "One subject/level leaves no tracks." },

  { id: "produce_flame", name: "Produce Flame", school: "evocation", descriptor: ["fire"],
    levels: { druid: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "1d6 damage +1/level. Touch or throw.",
    battle: { type: "damage", hexRange: 3, damage: "1d6+1/level", damageType: "fire" } },

  { id: "protection_from_chaos", name: "Protection from Chaos", school: "abjuration", descriptor: ["lawful"],
    levels: { sorcerer: 1, wizard: 1, cleric: 1, paladin: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: false,
    description: "+2 to AC and saves against chaotic creatures.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, buffSave: 2, durationRounds: 10 } },

  { id: "protection_from_evil", name: "Protection from Evil", school: "abjuration", descriptor: ["good"],
    levels: { sorcerer: 1, wizard: 1, cleric: 1, paladin: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: false,
    description: "+2 to AC and saves against evil creatures.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, buffSave: 2, durationRounds: 10 } },

  { id: "protection_from_good", name: "Protection from Good", school: "abjuration", descriptor: ["evil"],
    levels: { sorcerer: 1, wizard: 1, cleric: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: false,
    description: "+2 to AC and saves against good creatures.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, buffSave: 2, durationRounds: 10 } },

  { id: "protection_from_law", name: "Protection from Law", school: "abjuration", descriptor: ["chaotic"],
    levels: { sorcerer: 1, wizard: 1, cleric: 1 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: false,
    description: "+2 to AC and saves against lawful creatures.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, buffSave: 2, durationRounds: 10 } },

  { id: "ray_of_enfeeblement", name: "Ray of Enfeeblement", school: "necromancy",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "Ray deals 1d6+1/2 levels STR penalty.",
    battle: { type: "debuff", hexRange: 3, debuffAtk: -2, debuffDmg: -2, durationRounds: 10 } },

  { id: "reduce_person", name: "Reduce Person", school: "transmutation",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S,M", castingTime: "full-round",
    range: "close", duration: "1 min/level", savingThrow: "Fort negates", sr: true,
    description: "Humanoid creature halves in size. -2 STR, +2 DEX, +1 AC, +1 attack.",
    battle: { type: "buff", hexRange: 3, buffAC: 1, debuffDmg: -2, durationRounds: 10 } },

  { id: "remove_fear", name: "Remove Fear", school: "abjuration",
    levels: { cleric: 1, bard: 1 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "10 min or special", savingThrow: "Will negates (harmless)", sr: true,
    description: "Suppresses fear or gives +4 on saves against fear for one subject +1/4 levels." },

  { id: "sanctuary", name: "Sanctuary", school: "abjuration",
    levels: { cleric: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 round/level", savingThrow: "Will negates", sr: false,
    description: "Opponents can't attack you until you attack.",
    battle: { type: "buff", hexRange: 1, buffAC: 4, durationRounds: 3 } },

  { id: "shield", name: "Shield", school: "abjuration", descriptor: ["force"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Invisible disc gives +4 AC, blocks magic missiles.",
    battle: { type: "buff", hexRange: 0, buffAC: 4, durationRounds: 10 } },

  { id: "shield_of_faith", name: "Shield of Faith", school: "abjuration",
    levels: { cleric: 1 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "Aura grants +2 deflection bonus to AC (+1/6 levels, max +5).",
    battle: { type: "buff", hexRange: 1, buffAC: 2, durationRounds: 10 } },

  { id: "shillelagh", name: "Shillelagh", school: "transmutation",
    levels: { druid: 1 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "Will negates (object, harmless)", sr: true,
    description: "Club or quarterstaff becomes +1 weapon dealing 2d6 damage.",
    battle: { type: "buff", hexRange: 0, buffAtk: 1, buffDmg: 3, durationRounds: 10 } },

  { id: "shocking_grasp", name: "Shocking Grasp", school: "evocation", descriptor: ["electricity"],
    levels: { sorcerer: 1, wizard: 1 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "none", sr: true,
    description: "Touch deals 1d6/level electricity damage (max 5d6).",
    battle: { type: "damage", hexRange: 1, damage: "1d6/level", damageType: "electricity" } },

  { id: "silent_image", name: "Silent Image", school: "illusion", subschool: "figment",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,F", castingTime: "standard",
    range: "long", duration: "concentration", savingThrow: "Will disbelief", sr: false,
    description: "Creates minor illusion of your design." },

  { id: "sleep", name: "Sleep", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,M", castingTime: "full-round",
    range: "medium", duration: "1 min/level", savingThrow: "Will negates", sr: true,
    description: "Puts 4 HD of creatures into magical slumber.",
    battle: { type: "condition", hexRange: 5, hexArea: 1, condition: "sleeping", durationRounds: 10, save: "will" } },

  { id: "speak_with_animals", name: "Speak with Animals", school: "divination",
    levels: { druid: 1, ranger: 1, bard: 3 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "You can communicate with animals." },

  { id: "summon_monster_i", name: "Summon Monster I", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 1, wizard: 1, bard: 1, cleric: 1 }, components: "V,S,F/DF",
    castingTime: "full-round", range: "close", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Calls extraplanar creature to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "summon_natures_ally_i", name: "Summon Nature's Ally I", school: "conjuration", subschool: "summoning",
    levels: { druid: 1, ranger: 1 }, components: "V,S,DF", castingTime: "full-round",
    range: "close", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Calls animal to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "tashas_hideous_laughter", name: "Tasha's Hideous Laughter", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { bard: 1, sorcerer: 2, wizard: 2 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 round/level", savingThrow: "Will negates", sr: true,
    description: "Subject falls prone laughing, can't act for 1 round/level.",
    battle: { type: "condition", hexRange: 3, condition: "prone", durationRounds: 3, save: "will" } },

  { id: "true_strike", name: "True Strike", school: "divination",
    levels: { sorcerer: 1, wizard: 1 }, components: "V,F", castingTime: "standard",
    range: "personal", duration: "next attack", savingThrow: "none", sr: false,
    description: "+20 on your next attack roll.",
    battle: { type: "buff", hexRange: 0, buffAtk: 20, durationRounds: 1 } },

  { id: "undetectable_alignment", name: "Undetectable Alignment", school: "abjuration",
    levels: { bard: 1, cleric: 2, paladin: 2 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "24 hours", savingThrow: "Will negates (object)", sr: true,
    description: "Conceals alignment for 24 hours." },

  { id: "unseen_servant", name: "Unseen Servant", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 hour/level", savingThrow: "none", sr: false,
    description: "Invisible force obeys your commands." },

  { id: "ventriloquism", name: "Ventriloquism", school: "illusion", subschool: "figment",
    levels: { sorcerer: 1, wizard: 1, bard: 1 }, components: "V,F", castingTime: "standard",
    range: "close", duration: "1 min/level", savingThrow: "Will disbelief", sr: false,
    description: "Throws voice for 1 min/level." },

  // ────────────────────────── 2ND-LEVEL SPELLS ──────────────────────────────
  { id: "acid_arrow", name: "Acid Arrow", school: "conjuration", subschool: "creation", descriptor: ["acid"],
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,M,F", castingTime: "standard",
    range: "long", duration: "1 round + 1 round/3 levels", savingThrow: "none", sr: false,
    description: "Ranged touch attack; 2d4 acid damage for 1 round +1/3 levels.",
    battle: { type: "damage", hexRange: 7, damage: "2d4", damageType: "acid" } },

  { id: "aid", name: "Aid", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { cleric: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "+1 on attack rolls, +1 against fear, 1d8 temp hp.",
    battle: { type: "buff", hexRange: 1, buffAtk: 1, buffSave: 1, durationRounds: 10 } },

  { id: "alter_self", name: "Alter Self", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Assume form of a similar creature." },

  { id: "animal_messenger", name: "Animal Messenger", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { druid: 2, ranger: 1, bard: 2 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "1 day/level", savingThrow: "none", sr: true,
    description: "Sends a Tiny animal to a specific place." },

  { id: "animal_trance", name: "Animal Trance", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting", "sonic"],
    levels: { druid: 2, bard: 2 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "concentration", savingThrow: "Will negates", sr: true,
    description: "Fascinates 2d6 HD of animals." },

  { id: "arcane_lock", name: "Arcane Lock", school: "abjuration",
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "permanent", savingThrow: "none", sr: false,
    description: "Magically locks a portal or chest." },

  { id: "barkskin", name: "Barkskin", school: "transmutation",
    levels: { druid: 2, ranger: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "10 min/level", savingThrow: "none", sr: true,
    description: "Grants +2 (or higher) enhancement to natural armor.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, durationRounds: -1 } },

  { id: "bears_endurance", name: "Bear's Endurance", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, cleric: 2, druid: 2, ranger: 2 },
    components: "V,S,DF", castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to CON for 1 min/level." },

  { id: "blindness_deafness", name: "Blindness/Deafness", school: "necromancy",
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 3 }, components: "V",
    castingTime: "standard", range: "medium", duration: "permanent",
    savingThrow: "Fort negates", sr: true,
    description: "Makes subject blind or deaf.",
    battle: { type: "condition", hexRange: 5, condition: "blinded", durationRounds: -1, save: "fort" } },

  { id: "blur", name: "Blur", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "Attacks have 20% miss chance against subject.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, durationRounds: 10 } },

  { id: "bulls_strength", name: "Bull's Strength", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, cleric: 2, druid: 2, paladin: 2 },
    components: "V,S,M/DF", castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to STR.",
    battle: { type: "buff", hexRange: 1, buffAtk: 2, buffDmg: 2, durationRounds: 10 } },

  { id: "calm_emotions", name: "Calm Emotions", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { cleric: 2, bard: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "medium", duration: "concentration, up to 1 round/level",
    savingThrow: "Will negates", sr: true,
    description: "Calms creatures, negating morale bonuses and rage." },

  { id: "cats_grace", name: "Cat's Grace", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, bard: 2, druid: 2, ranger: 2 },
    components: "V,S,M", castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to DEX.",
    battle: { type: "buff", hexRange: 1, buffAC: 2, durationRounds: 10 } },

  { id: "continual_flame", name: "Continual Flame", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 2, wizard: 2, cleric: 3 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "permanent", savingThrow: "none", sr: false,
    description: "Makes a permanent, heatless torch." },

  { id: "cure_moderate_wounds", name: "Cure Moderate Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 2, druid: 2, bard: 2, paladin: 3, ranger: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 2d8+1/level damage (max 2d8+10).",
    battle: { type: "healing", hexRange: 1, healing: "2d8+1/level" } },

  { id: "darkness", name: "Darkness", school: "evocation", descriptor: ["darkness"],
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 2 }, components: "V,M/DF",
    castingTime: "standard", range: "touch", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "20-ft. radius of supernatural shadow." },

  { id: "darkvision", name: "Darkvision", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, ranger: 3 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "1 hour/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "See 60 ft. in total darkness." },

  { id: "daze_monster", name: "Daze Monster", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "1 round",
    savingThrow: "Will negates", sr: true,
    description: "Living creature of 6 HD or less loses next action.",
    battle: { type: "condition", hexRange: 5, condition: "dazed", durationRounds: 1, save: "will" } },

  { id: "death_knell", name: "Death Knell", school: "necromancy", descriptor: ["death", "evil"],
    levels: { cleric: 2 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant/10 min per HD", savingThrow: "Will negates", sr: true,
    description: "Kills dying creature; you gain 1d8 temp hp, +2 STR, +1 level." },

  { id: "delay_poison_2", name: "Delay Poison", school: "conjuration", subschool: "healing",
    levels: { cleric: 2, druid: 2, bard: 2, paladin: 2 }, components: "V,S,DF",
    castingTime: "standard", range: "touch", duration: "1 hour/level",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "Stops poison from harming subject for 1 hour/level." },

  { id: "eagles_splendor", name: "Eagle's Splendor", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 2, paladin: 2 },
    components: "V,S,M/DF", castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to CHA." },

  { id: "enthrall", name: "Enthrall", school: "enchantment", subschool: "charm", descriptor: ["mind-affecting", "sonic", "language-dependent"],
    levels: { cleric: 2, bard: 2 }, components: "V,S", castingTime: "full-round",
    range: "medium", duration: "1 hour or less", savingThrow: "Will negates", sr: true,
    description: "Captivates all within 100 ft. + 10 ft./level." },

  { id: "find_traps", name: "Find Traps", school: "divination",
    levels: { cleric: 2 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Notice traps as a rogue does." },

  { id: "flame_blade", name: "Flame Blade", school: "evocation", descriptor: ["fire"],
    levels: { druid: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: true,
    description: "Touch attack deals 1d8+1/2 levels fire damage.",
    battle: { type: "buff", hexRange: 0, buffDmg: 4, durationRounds: 10 } },

  { id: "flaming_sphere", name: "Flaming Sphere", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 2, wizard: 2, druid: 2 }, components: "V,S,M/DF",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "Reflex negates", sr: true,
    description: "Rolling ball of fire deals 2d6 fire damage.",
    battle: { type: "damage", hexRange: 5, damage: "2d6", damageType: "fire", durationRounds: 3, save: "ref" } },

  { id: "fog_cloud", name: "Fog Cloud", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 2, wizard: 2, druid: 2 }, components: "V,S",
    castingTime: "standard", range: "medium", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Fog obscures vision in a 20-ft. radius." },

  { id: "foxs_cunning", name: "Fox's Cunning", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to INT." },

  { id: "gentle_repose", name: "Gentle Repose", school: "necromancy",
    levels: { sorcerer: 2, wizard: 2, cleric: 2 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 day/level",
    savingThrow: "Will negates (object)", sr: true,
    description: "Preserves one corpse." },

  { id: "ghoul_touch", name: "Ghoul Touch", school: "necromancy",
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "1d6+2 rounds",
    savingThrow: "Fort negates", sr: true,
    description: "Paralyzes one subject and sickens those nearby.",
    battle: { type: "condition", hexRange: 1, condition: "paralyzed", durationRounds: 3, save: "fort" } },

  { id: "glitterdust", name: "Glitterdust", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "Will negates (blinding)", sr: false,
    description: "Blinds creatures, outlines invisible creatures.",
    battle: { type: "condition", hexRange: 5, hexArea: 1, condition: "blinded", durationRounds: 3, save: "will" } },

  { id: "gust_of_wind", name: "Gust of Wind", school: "evocation", descriptor: ["air"],
    levels: { sorcerer: 2, wizard: 2, druid: 2 }, components: "V,S",
    castingTime: "standard", range: "personal", duration: "1 round",
    savingThrow: "Fort negates", sr: true,
    description: "Blows away or knocks down smaller creatures." },

  { id: "heat_metal", name: "Heat Metal", school: "transmutation", descriptor: ["fire"],
    levels: { druid: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "close", duration: "7 rounds", savingThrow: "Will negates (object)", sr: true,
    description: "Make metal so hot it damages those who touch it.",
    battle: { type: "damage", hexRange: 3, damage: "2d4", damageType: "fire", durationRounds: 3 } },

  { id: "hold_animal", name: "Hold Animal", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { druid: 2, ranger: 2 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 round/level", savingThrow: "Will negates", sr: true,
    description: "Paralyzes one animal for 1 round/level.",
    battle: { type: "condition", hexRange: 5, condition: "paralyzed", durationRounds: 3, save: "will" } },

  { id: "hold_person", name: "Hold Person", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 3, wizard: 3, bard: 2, cleric: 2 }, components: "V,S,F/DF",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "Will negates", sr: true,
    description: "Paralyzes one humanoid for 1 round/level.",
    battle: { type: "condition", hexRange: 5, condition: "paralyzed", durationRounds: 3, save: "will" } },

  { id: "inflict_moderate_wounds", name: "Inflict Moderate Wounds", school: "necromancy",
    levels: { cleric: 2 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half", sr: true,
    description: "Touch deals 2d8+1/level damage.",
    battle: { type: "damage", hexRange: 1, damage: "2d8+1/level", damageType: "negative" } },

  { id: "invisibility", name: "Invisibility", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject is invisible for 1 min/level or until it attacks.",
    battle: { type: "buff", hexRange: 1, buffAC: 4, durationRounds: 10 } },

  { id: "knock", name: "Knock", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2 }, components: "V", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "none", sr: false,
    description: "Opens locked or magically sealed door." },

  { id: "lesser_restoration", name: "Lesser Restoration", school: "conjuration", subschool: "healing",
    levels: { cleric: 2, druid: 2, paladin: 1 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will negates (harmless)", sr: true,
    description: "Dispels magical ability penalty or repairs 1d4 ability damage." },

  { id: "levitate", name: "Levitate", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,F",
    castingTime: "standard", range: "close", duration: "1 min/level",
    savingThrow: "none", sr: false,
    description: "Subject moves up and down at your direction." },

  { id: "locate_object", name: "Locate Object", school: "divination",
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 3 }, components: "V,S,F/DF",
    castingTime: "standard", range: "long", duration: "1 min/level",
    savingThrow: "none", sr: false,
    description: "Senses direction toward object." },

  { id: "mirror_image", name: "Mirror Image", school: "illusion", subschool: "figment",
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S",
    castingTime: "standard", range: "personal", duration: "1 min/level",
    savingThrow: "none", sr: false,
    description: "Creates 1d4+1/3 levels decoy duplicates of you.",
    battle: { type: "buff", hexRange: 0, buffAC: 3, durationRounds: 10 } },

  { id: "owls_wisdom", name: "Owl's Wisdom", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, cleric: 2, druid: 2, paladin: 2, ranger: 2 },
    components: "V,S,M/DF", castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject gains +4 to WIS." },

  { id: "protection_from_arrows", name: "Protection from Arrows", school: "abjuration",
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,F", castingTime: "standard",
    range: "touch", duration: "1 hour/level or until discharged", savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject is immune to most ranged weapons. Absorbs 10/magic damage.",
    battle: { type: "buff", hexRange: 1, buffAC: 3, durationRounds: -1 } },

  { id: "remove_paralysis", name: "Remove Paralysis", school: "conjuration", subschool: "healing",
    levels: { cleric: 2, paladin: 2 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Will negates (harmless)", sr: true,
    description: "Frees one or more creatures from paralysis or slow." },

  { id: "resist_energy", name: "Resist Energy", school: "abjuration",
    levels: { sorcerer: 2, wizard: 2, cleric: 2, druid: 2, paladin: 2, ranger: 1 },
    components: "V,S,DF", castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "Ignores first 10 (or more) points of damage/attack from specified energy type." },

  { id: "restoration_lesser", name: "Restoration, Lesser", school: "conjuration", subschool: "healing",
    levels: { paladin: 1 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Dispels magical ability penalty or repairs 1d4 ability damage." },

  { id: "scare", name: "Scare", school: "necromancy", descriptor: ["fear", "mind-affecting"],
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "1 round/level or 1 round",
    savingThrow: "Will partial", sr: true,
    description: "Frightens creatures of less than 6 HD.",
    battle: { type: "condition", hexRange: 5, condition: "frightened", durationRounds: 3, save: "will" } },

  { id: "scorching_ray", name: "Scorching Ray", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Ranged touch attack deals 4d6 fire damage; +1 ray per 4 levels (max 3).",
    battle: { type: "damage", hexRange: 3, damage: "4d6", damageType: "fire" } },

  { id: "see_invisibility", name: "See Invisibility", school: "divination",
    levels: { sorcerer: 2, wizard: 2, bard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "personal", duration: "10 min/level",
    savingThrow: "none", sr: false,
    description: "Reveals invisible creatures or objects." },

  { id: "shatter", name: "Shatter", school: "evocation", descriptor: ["sonic"],
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 2 }, components: "V,S,M/DF",
    castingTime: "standard", range: "close", duration: "instant",
    savingThrow: "Will negates (object)", sr: true,
    description: "Sonic vibration damages objects or crystalline creatures.",
    battle: { type: "damage", hexRange: 3, damage: "1d6/level", damageType: "sonic" } },

  { id: "silence", name: "Silence", school: "illusion", subschool: "glamer",
    levels: { cleric: 2, bard: 2 }, components: "V,S", castingTime: "standard",
    range: "long", duration: "1 min/level", savingThrow: "Will negates or none (object)", sr: true,
    description: "Negates sound in 20-ft. radius." },

  { id: "sound_burst", name: "Sound Burst", school: "evocation", descriptor: ["sonic"],
    levels: { cleric: 2, bard: 2 }, components: "V,S,F/DF", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Fort partial", sr: true,
    description: "Deals 1d8 sonic damage and may stun subjects.",
    battle: { type: "damage", hexRange: 3, hexArea: 1, damage: "1d8", damageType: "sonic", save: "fort" } },

  { id: "spider_climb", name: "Spider Climb", school: "transmutation",
    levels: { sorcerer: 2, wizard: 2, druid: 2 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Grants ability to walk on walls and ceilings." },

  { id: "spiritual_weapon", name: "Spiritual Weapon", school: "evocation", descriptor: ["force"],
    levels: { cleric: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "medium", duration: "1 round/level", savingThrow: "none", sr: true,
    description: "Magic weapon attacks on its own. +1/3 levels attack, 1d8+1/3 levels damage.",
    battle: { type: "damage", hexRange: 5, damage: "1d8+1", damageType: "force", durationRounds: 3 } },

  { id: "summon_monster_ii", name: "Summon Monster II", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 2, wizard: 2, bard: 2, cleric: 2 }, components: "V,S,F/DF",
    castingTime: "full-round", range: "close", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Calls extraplanar creature to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "summon_natures_ally_ii", name: "Summon Nature's Ally II", school: "conjuration", subschool: "summoning",
    levels: { druid: 2, ranger: 2 }, components: "V,S,DF", castingTime: "full-round",
    range: "close", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Calls animal to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "summon_swarm", name: "Summon Swarm", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 2, wizard: 2, bard: 2, druid: 2 }, components: "V,S,M/DF",
    castingTime: "full-round", range: "close", duration: "concentration + 2 rounds",
    savingThrow: "none", sr: false,
    description: "Summons swarm of bats, rats, or spiders.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "touch_of_idiocy", name: "Touch of Idiocy", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "none", sr: true,
    description: "Subject takes 1d6 penalty to INT, WIS, and CHA." },

  { id: "web", name: "Web", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 2, wizard: 2 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "10 min/level",
    savingThrow: "Reflex negates", sr: false,
    description: "Fills 20-ft. radius with sticky webs that entangle.",
    battle: { type: "condition", hexRange: 5, hexArea: 1, condition: "entangled", durationRounds: -1, save: "ref" } },

  { id: "whispering_wind", name: "Whispering Wind", school: "transmutation", descriptor: ["air"],
    levels: { sorcerer: 2, wizard: 2, bard: 2 }, components: "V,S",
    castingTime: "standard", range: "unlimited", duration: "until discharged",
    savingThrow: "none", sr: false,
    description: "Sends a short message 1 mile/level." },

  { id: "wood_shape", name: "Wood Shape", school: "transmutation",
    levels: { druid: 2 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will negates (object)", sr: true,
    description: "Rearranges wooden objects to suit you." },

  { id: "zone_of_truth", name: "Zone of Truth", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { cleric: 2, paladin: 2 }, components: "V,S,DF",
    castingTime: "standard", range: "close", duration: "1 min/level",
    savingThrow: "Will negates", sr: true,
    description: "Subjects within range cannot lie." },

  // ────────────────────────── 3RD-LEVEL SPELLS ──────────────────────────────
  { id: "animate_dead", name: "Animate Dead", school: "necromancy", descriptor: ["evil"],
    levels: { sorcerer: 4, wizard: 4, cleric: 3 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "none", sr: false,
    description: "Creates undead skeletons and zombies.",
    battle: { type: "summon", hexRange: 1, durationRounds: -1 } },

  { id: "bestow_curse", name: "Bestow Curse", school: "necromancy",
    levels: { sorcerer: 4, wizard: 4, cleric: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "permanent",
    savingThrow: "Will negates", sr: true,
    description: "-6 to an ability score, or -4 on attacks/saves/checks, or 50% chance of losing action.",
    battle: { type: "debuff", hexRange: 1, debuffAtk: -4, debuffDmg: -4, durationRounds: -1, save: "will" } },

  { id: "call_lightning", name: "Call Lightning", school: "evocation", descriptor: ["electricity"],
    levels: { druid: 3 }, components: "V,S", castingTime: "full-round",
    range: "medium", duration: "1 min/level", savingThrow: "Reflex half", sr: true,
    description: "Calls down lightning bolts (3d6) from sky, one per round.",
    battle: { type: "damage", hexRange: 5, damage: "3d6", damageType: "electricity", save: "ref" } },

  { id: "clairaudience_clairvoyance", name: "Clairaudience/Clairvoyance", school: "divination", subschool: "scrying",
    levels: { sorcerer: 3, wizard: 3, bard: 3 }, components: "V,S,F/DF",
    castingTime: "10 minutes", range: "long", duration: "1 min/level",
    savingThrow: "none", sr: false,
    description: "Hear or see at a distance for 1 min/level." },

  { id: "contagion", name: "Contagion", school: "necromancy", descriptor: ["evil"],
    levels: { sorcerer: 4, wizard: 4, cleric: 3, druid: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Fort negates", sr: true,
    description: "Infects subject with chosen disease.",
    battle: { type: "debuff", hexRange: 1, debuffAtk: -2, debuffDmg: -2, durationRounds: -1, save: "fort" } },

  { id: "create_food_water", name: "Create Food and Water", school: "conjuration", subschool: "creation",
    levels: { cleric: 3 }, components: "V,S", castingTime: "10 minutes",
    range: "close", duration: "24 hours", savingThrow: "none", sr: false,
    description: "Feeds three humans (or one horse)/level." },

  { id: "cure_serious_wounds", name: "Cure Serious Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 3, druid: 3, bard: 3, paladin: 4, ranger: 4 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 3d8+1/level damage (max 3d8+15).",
    battle: { type: "healing", hexRange: 1, healing: "3d8+1/level" } },

  { id: "daylight", name: "Daylight", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 3, wizard: 3, bard: 3, cleric: 3, druid: 3, paladin: 3 },
    components: "V,S", castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "none", sr: false,
    description: "60-ft. radius of bright light." },

  { id: "deeper_darkness", name: "Deeper Darkness", school: "evocation", descriptor: ["darkness"],
    levels: { cleric: 3 }, components: "V,M/DF", castingTime: "standard",
    range: "touch", duration: "1 day/level", savingThrow: "none", sr: false,
    description: "Object sheds supernatural shadow in 60-ft. radius." },

  { id: "dispel_magic", name: "Dispel Magic", school: "abjuration",
    levels: { sorcerer: 3, wizard: 3, bard: 3, cleric: 3, druid: 4, paladin: 3 },
    components: "V,S", castingTime: "standard", range: "medium", duration: "instant",
    savingThrow: "none", sr: false,
    description: "Cancels magical spells and effects." },

  { id: "displacement", name: "Displacement", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 3, wizard: 3, bard: 3 }, components: "V,M",
    castingTime: "standard", range: "touch", duration: "1 round/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Attacks miss subject 50% of the time.",
    battle: { type: "buff", hexRange: 1, buffAC: 4, durationRounds: 5 } },

  { id: "dominate_animal", name: "Dominate Animal", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { druid: 3 }, components: "V,S", castingTime: "full-round",
    range: "close", duration: "1 round/level", savingThrow: "Will negates", sr: true,
    description: "Subject animal obeys silent mental commands." },

  { id: "fear_spell", name: "Fear", school: "necromancy", descriptor: ["fear", "mind-affecting"],
    levels: { sorcerer: 4, wizard: 4, bard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "close", duration: "1 round/level",
    savingThrow: "Will partial", sr: true,
    description: "Subjects within cone flee for 1 round/level.",
    battle: { type: "condition", hexRange: 3, hexArea: 2, condition: "frightened", durationRounds: 3, save: "will" } },

  { id: "fireball", name: "Fireball", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "long", duration: "instant",
    savingThrow: "Reflex half", sr: true,
    description: "1d6 fire damage per level, 20-ft. radius.",
    battle: { type: "damage", hexRange: 7, hexArea: 2, damage: "1d6/level", damageType: "fire", save: "ref" } },

  { id: "flame_arrow", name: "Flame Arrow", school: "transmutation", descriptor: ["fire"],
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "close", duration: "10 min/level",
    savingThrow: "none", sr: false,
    description: "Arrows deal +1d6 fire damage.",
    battle: { type: "buff", hexRange: 3, buffDmg: 3, durationRounds: -1 } },

  { id: "fly", name: "Fly", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S,F",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject flies at speed of 60 ft.",
    battle: { type: "buff", hexRange: 1, buffSpeed: 6, durationRounds: 10 } },

  { id: "gaseous_form", name: "Gaseous Form", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3, bard: 3 }, components: "S,M/DF",
    castingTime: "standard", range: "touch", duration: "2 min/level",
    savingThrow: "none", sr: false,
    description: "Subject becomes insubstantial and can fly slowly." },

  { id: "good_hope", name: "Good Hope", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { bard: 3 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "Subjects gain +2 morale bonus on attack rolls, saves, checks, and weapon damage.",
    battle: { type: "buff", hexRange: 5, hexArea: 2, buffAtk: 2, buffDmg: 2, buffSave: 2, durationRounds: 10 } },

  { id: "haste", name: "Haste", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3, bard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "close", duration: "1 round/level",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "One creature/level moves faster, +1 attack, +1 AC and Reflex.",
    battle: { type: "buff", hexRange: 3, buffAtk: 1, buffAC: 1, buffSpeed: 6, durationRounds: 5 } },

  { id: "heroism", name: "Heroism", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 3, wizard: 3, bard: 2 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Gives +2 bonus on attack rolls, saves, and skill checks.",
    battle: { type: "buff", hexRange: 1, buffAtk: 2, buffSave: 2, durationRounds: -1 } },

  { id: "inflict_serious_wounds", name: "Inflict Serious Wounds", school: "necromancy",
    levels: { cleric: 3 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half", sr: true,
    description: "Touch deals 3d8+1/level damage.",
    battle: { type: "damage", hexRange: 1, damage: "3d8+1/level", damageType: "negative" } },

  { id: "invisibility_purge", name: "Invisibility Purge", school: "evocation",
    levels: { cleric: 3 }, components: "V,S", castingTime: "standard",
    range: "personal", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Dispels invisibility within 5 ft./level." },

  { id: "keen_edge", name: "Keen Edge", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S",
    castingTime: "standard", range: "close", duration: "10 min/level",
    savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Doubles weapon's threat range.",
    battle: { type: "buff", hexRange: 3, buffAtk: 2, durationRounds: -1 } },

  { id: "lightning_bolt", name: "Lightning Bolt", school: "evocation", descriptor: ["electricity"],
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "instant",
    savingThrow: "Reflex half", sr: true,
    description: "Electricity deals 1d6/level damage in a line.",
    battle: { type: "damage", hexRange: 5, damage: "1d6/level", damageType: "electricity", save: "ref" } },

  { id: "magic_circle_against_evil", name: "Magic Circle against Evil", school: "abjuration", descriptor: ["good"],
    levels: { sorcerer: 3, wizard: 3, cleric: 3, paladin: 3 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "Will negates (harmless)", sr: false,
    description: "As protection from evil, but 10-ft. radius and 10 min/level.",
    battle: { type: "buff", hexRange: 1, hexArea: 1, buffAC: 2, buffSave: 2, durationRounds: -1 } },

  { id: "magic_vestment", name: "Magic Vestment", school: "transmutation",
    levels: { cleric: 3 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "1 hour/level", savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Armor or shield gains +1 enhancement per four levels.",
    battle: { type: "buff", hexRange: 1, buffAC: 1, durationRounds: -1 } },

  { id: "magic_weapon_greater", name: "Greater Magic Weapon", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3, cleric: 4, paladin: 3 }, components: "V,S,M/DF",
    castingTime: "standard", range: "close", duration: "1 hour/level",
    savingThrow: "Will negates (harmless, object)", sr: true,
    description: "Weapon gains +1/4 levels enhancement bonus (max +5).",
    battle: { type: "buff", hexRange: 3, buffAtk: 1, buffDmg: 1, durationRounds: -1 } },

  { id: "neutralize_poison", name: "Neutralize Poison", school: "conjuration", subschool: "healing",
    levels: { cleric: 4, druid: 3, bard: 4, paladin: 4, ranger: 3 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Immunizes subject against poison, detoxifies venom." },

  { id: "plant_growth", name: "Plant Growth", school: "transmutation",
    levels: { druid: 3, ranger: 3 }, components: "V,S,DF", castingTime: "standard",
    range: "long", duration: "instant", savingThrow: "none", sr: false,
    description: "Grows vegetation, improves crops, or creates overgrowth." },

  { id: "prayer", name: "Prayer", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { cleric: 3, paladin: 3 }, components: "V,S,DF", castingTime: "standard",
    range: "close", duration: "1 round/level", savingThrow: "none", sr: true,
    description: "Allies +1 bonus on most rolls, enemies -1 penalty.",
    battle: { type: "buff", hexRange: 3, hexArea: 2, buffAtk: 1, buffDmg: 1, buffSave: 1, durationRounds: 5 } },

  { id: "protection_from_energy", name: "Protection from Energy", school: "abjuration",
    levels: { sorcerer: 3, wizard: 3, cleric: 3, druid: 3, ranger: 2 },
    components: "V,S,DF", castingTime: "standard", range: "touch", duration: "10 min/level or until discharged",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "Absorbs 12 points/level of damage from one energy type (max 120)." },

  { id: "remove_curse", name: "Remove Curse", school: "abjuration",
    levels: { sorcerer: 4, wizard: 4, bard: 3, cleric: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Frees object or person from curse." },

  { id: "remove_disease", name: "Remove Disease", school: "conjuration", subschool: "healing",
    levels: { cleric: 3, druid: 3, ranger: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "Fort negates (harmless)", sr: true,
    description: "Cures all diseases affecting subject." },

  { id: "searing_light", name: "Searing Light", school: "evocation",
    levels: { cleric: 3 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "none", sr: true,
    description: "Ray deals 1d8/2 levels damage, or 1d6/level to undead, or 1d8/level to undead vulnerable to light.",
    battle: { type: "damage", hexRange: 5, damage: "1d8/2levels", damageType: "light" } },

  { id: "sleet_storm", name: "Sleet Storm", school: "conjuration", subschool: "creation", descriptor: ["cold"],
    levels: { sorcerer: 3, wizard: 3, druid: 3 }, components: "V,S,M/DF",
    castingTime: "standard", range: "long", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Hampers vision and movement in a large area.",
    battle: { type: "condition", hexRange: 7, hexArea: 2, condition: "entangled", durationRounds: 5 } },

  { id: "slow", name: "Slow", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3, bard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "close", duration: "1 round/level",
    savingThrow: "Will negates", sr: true,
    description: "One subject/level takes only one action/round, -1 AC, -1 attack, -1 Reflex.",
    battle: { type: "debuff", hexRange: 3, debuffAC: -1, debuffAtk: -1, durationRounds: 5, save: "will" } },

  { id: "speak_with_dead", name: "Speak with Dead", school: "necromancy", descriptor: ["language-dependent"],
    levels: { cleric: 3 }, components: "V,S,DF", castingTime: "10 minutes",
    range: "close", duration: "1 min/level", savingThrow: "Will negates", sr: false,
    description: "Corpse answers one question/2 levels." },

  { id: "stinking_cloud", name: "Stinking Cloud", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S,M",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "Fort negates", sr: false,
    description: "Nauseating vapors, 1 round/level.",
    battle: { type: "condition", hexRange: 5, hexArea: 1, condition: "nauseated", durationRounds: 5, save: "fort" } },

  { id: "suggestion", name: "Suggestion", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting", "language-dependent"],
    levels: { sorcerer: 3, wizard: 3, bard: 2 }, components: "V,M",
    castingTime: "standard", range: "close", duration: "1 hour/level",
    savingThrow: "Will negates", sr: true,
    description: "Compels subject to follow stated course of action." },

  { id: "summon_monster_iii", name: "Summon Monster III", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 3, wizard: 3, bard: 3, cleric: 3 }, components: "V,S,F/DF",
    castingTime: "full-round", range: "close", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Calls extraplanar creature to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "summon_natures_ally_iii", name: "Summon Nature's Ally III", school: "conjuration", subschool: "summoning",
    levels: { druid: 3, ranger: 3 }, components: "V,S,DF", castingTime: "full-round",
    range: "close", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Calls animal to fight for you.",
    battle: { type: "summon", hexRange: 3, durationRounds: 5 } },

  { id: "vampiric_touch", name: "Vampiric Touch", school: "necromancy",
    levels: { sorcerer: 3, wizard: 3 }, components: "V,S",
    castingTime: "standard", range: "touch", duration: "instant",
    savingThrow: "none", sr: true,
    description: "Touch deals 1d6/2 levels damage; caster gains damage as temp hp.",
    battle: { type: "damage", hexRange: 1, damage: "1d6/2levels", damageType: "negative" } },

  { id: "water_breathing", name: "Water Breathing", school: "transmutation",
    levels: { sorcerer: 3, wizard: 3, cleric: 3, druid: 3 }, components: "V,S,M/DF",
    castingTime: "standard", range: "touch", duration: "2 hours/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subjects can breathe underwater." },

  { id: "wind_wall", name: "Wind Wall", school: "evocation", descriptor: ["air"],
    levels: { sorcerer: 3, wizard: 3, cleric: 3, druid: 3, ranger: 2 },
    components: "V,S,M/DF", castingTime: "standard", range: "medium",
    duration: "1 round/level", savingThrow: "none", sr: true,
    description: "Deflects arrows, smaller creatures, and gases." },

  // ────────────────────────── 4TH–9TH LEVEL SPELLS ─────────────────────────
  // Higher-level spells — descriptions only, battle effects added as needed.

  // 4th Level
  { id: "charm_monster", name: "Charm Monster", school: "enchantment", subschool: "charm", descriptor: ["mind-affecting"],
    levels: { sorcerer: 4, wizard: 4, bard: 3 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "1 day/level", savingThrow: "Will negates", sr: true,
    description: "Makes monster believe it is your ally." },

  { id: "confusion", name: "Confusion", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 4, wizard: 4, bard: 3 }, components: "V,S,M/DF", castingTime: "standard",
    range: "medium", duration: "1 round/level", savingThrow: "Will negates", sr: true,
    description: "Subjects behave oddly for 1 round/level." },

  { id: "cure_critical_wounds", name: "Cure Critical Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 4, druid: 5, bard: 4 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 4d8+1/level damage (max 4d8+20)." },

  { id: "dimension_door", name: "Dimension Door", school: "conjuration", subschool: "teleportation",
    levels: { sorcerer: 4, wizard: 4, bard: 4 }, components: "V", castingTime: "standard",
    range: "long", duration: "instant", savingThrow: "none", sr: false,
    description: "Teleports you short distance." },

  { id: "divine_power", name: "Divine Power", school: "evocation",
    levels: { cleric: 4 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "You gain attack bonus, +6 STR, and 1 hp/level." },

  { id: "enervation", name: "Enervation", school: "necromancy",
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Subject gains 1d4 negative levels." },

  { id: "fire_shield", name: "Fire Shield", school: "evocation", descriptor: ["fire", "cold"],
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S,M", castingTime: "standard",
    range: "personal", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Creatures attacking you take fire damage; you're protected from heat or cold." },

  { id: "flame_strike", name: "Flame Strike", school: "evocation", descriptor: ["fire"],
    levels: { cleric: 5, druid: 4 }, components: "V,S,DF", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Reflex half", sr: true,
    description: "Smites foes with divine fire (1d6/level, half fire half divine)." },

  { id: "freedom_of_movement", name: "Freedom of Movement", school: "abjuration",
    levels: { cleric: 4, druid: 4, bard: 4, ranger: 4 }, components: "V,S,M,DF",
    castingTime: "standard", range: "touch", duration: "10 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Subject moves normally despite impediments." },

  { id: "greater_invisibility", name: "Greater Invisibility", school: "illusion", subschool: "glamer",
    levels: { sorcerer: 4, wizard: 4, bard: 4 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "1 round/level", savingThrow: "Will negates (harmless)", sr: true,
    description: "As invisibility, but subject can attack and stay invisible." },

  { id: "ice_storm", name: "Ice Storm", school: "evocation", descriptor: ["cold"],
    levels: { sorcerer: 4, wizard: 4, druid: 4 }, components: "V,S,M/DF", castingTime: "standard",
    range: "long", duration: "1 full round", savingThrow: "none", sr: true,
    description: "Hail deals 5d6 damage in cylinder 40 ft. across." },

  { id: "phantasmal_killer", name: "Phantasmal Killer", school: "illusion", subschool: "phantasm", descriptor: ["fear", "mind-affecting"],
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Will disbelief, then Fort partial", sr: true,
    description: "Fearsome illusion kills subject or deals 3d6 damage." },

  { id: "poison", name: "Poison", school: "necromancy",
    levels: { cleric: 4, druid: 3 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Fort negates", sr: true,
    description: "Touch deals 1d10 CON damage, repeats in 1 min." },

  { id: "polymorph", name: "Polymorph", school: "transmutation",
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Gives one willing subject a new form." },

  { id: "restoration", name: "Restoration", school: "conjuration", subschool: "healing",
    levels: { cleric: 4, paladin: 4 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will negates (harmless)", sr: true,
    description: "Restores level and ability score drains." },

  { id: "solid_fog", name: "Solid Fog", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S,M", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Blocks vision and slows movement." },

  { id: "stoneskin", name: "Stoneskin", school: "abjuration",
    levels: { sorcerer: 4, wizard: 4, druid: 5 }, components: "V,S,M", castingTime: "standard",
    range: "touch", duration: "10 min/level or until discharged",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Ignores 10 points of damage per attack." },

  { id: "summon_monster_iv", name: "Summon Monster IV", school: "conjuration", subschool: "summoning",
    levels: { sorcerer: 4, wizard: 4, bard: 4, cleric: 4 }, components: "V,S,F/DF",
    castingTime: "full-round", range: "close", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Calls extraplanar creature to fight for you." },

  { id: "wall_of_fire", name: "Wall of Fire", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 4, wizard: 4, druid: 5 }, components: "V,S,M/DF",
    castingTime: "standard", range: "medium", duration: "concentration + 1 round/level",
    savingThrow: "none", sr: true,
    description: "Deals 2d4 fire damage out to 10 ft. and 1d4 out to 20 ft." },

  { id: "wall_of_ice", name: "Wall of Ice", school: "evocation", descriptor: ["cold"],
    levels: { sorcerer: 4, wizard: 4 }, components: "V,S,M", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "Reflex negates", sr: true,
    description: "Ice plane or hemisphere creates wall with 3 hp+1/level per 10-ft. square." },

  // 5th Level
  { id: "baleful_polymorph", name: "Baleful Polymorph", school: "transmutation",
    levels: { sorcerer: 5, wizard: 5, druid: 5 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "permanent", savingThrow: "Fort negates, Will partial", sr: true,
    description: "Transforms subject into harmless animal." },

  { id: "break_enchantment", name: "Break Enchantment", school: "abjuration",
    levels: { sorcerer: 5, wizard: 5, bard: 4, cleric: 5, paladin: 4 },
    components: "V,S", castingTime: "1 minute", range: "close", duration: "instant",
    savingThrow: "none", sr: false,
    description: "Frees subjects from enchantments, alterations, curses, and petrification." },

  { id: "cloudkill", name: "Cloudkill", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 5, wizard: 5 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "Fort partial", sr: false,
    description: "Kills 3 HD or less; 4-6 HD save or die; 6+ take CON damage." },

  { id: "cone_of_cold", name: "Cone of Cold", school: "evocation", descriptor: ["cold"],
    levels: { sorcerer: 5, wizard: 5 }, components: "V,S,M", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Reflex half", sr: true,
    description: "1d6/level cold damage." },

  { id: "commune", name: "Commune", school: "divination",
    levels: { cleric: 5 }, components: "V,S,M,DF,XP", castingTime: "10 minutes",
    range: "personal", duration: "1 round/level", savingThrow: "none", sr: false,
    description: "Deity answers one yes-or-no question/level." },

  { id: "dominate_person", name: "Dominate Person", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 5, wizard: 5, bard: 4 }, components: "V,S", castingTime: "full-round",
    range: "close", duration: "1 day/level", savingThrow: "Will negates", sr: true,
    description: "Controls humanoid telepathically." },

  { id: "greater_command", name: "Greater Command", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting", "language-dependent"],
    levels: { cleric: 5 }, components: "V", castingTime: "standard",
    range: "close", duration: "1 round/level", savingThrow: "Will negates", sr: true,
    description: "As command, but affects one subject/level." },

  { id: "hold_monster", name: "Hold Monster", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 5, wizard: 5, bard: 4 }, components: "V,S,M/DF",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "Will negates", sr: true,
    description: "As hold person, but any creature." },

  { id: "insect_plague", name: "Insect Plague", school: "conjuration", subschool: "summoning",
    levels: { cleric: 5, druid: 5 }, components: "V,S,DF", castingTime: "full-round",
    range: "long", duration: "1 min/level", savingThrow: "none", sr: false,
    description: "Locust swarms attack creatures." },

  { id: "raise_dead", name: "Raise Dead", school: "conjuration", subschool: "healing",
    levels: { cleric: 5 }, components: "V,S,M,DF", castingTime: "1 minute",
    range: "touch", duration: "instant", savingThrow: "none", sr: true,
    description: "Restores life to subject who died as long as one day/level ago." },

  { id: "telekinesis", name: "Telekinesis", school: "transmutation",
    levels: { sorcerer: 5, wizard: 5 }, components: "V,S", castingTime: "standard",
    range: "long", duration: "concentration or instant", savingThrow: "Will negates or none", sr: true,
    description: "Moves object, attacks creature, or hurls objects or creatures." },

  { id: "teleport", name: "Teleport", school: "conjuration", subschool: "teleportation",
    levels: { sorcerer: 5, wizard: 5 }, components: "V", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "none", sr: false,
    description: "Instantly transports you as far as 100 miles/level." },

  { id: "tree_stride", name: "Tree Stride", school: "conjuration", subschool: "teleportation",
    levels: { druid: 5, ranger: 4 }, components: "V,S,DF", castingTime: "standard",
    range: "personal", duration: "1 hour/level or until expended",
    savingThrow: "none", sr: false,
    description: "Step from one tree to another far away." },

  { id: "wall_of_stone", name: "Wall of Stone", school: "conjuration", subschool: "creation",
    levels: { sorcerer: 5, wizard: 5, cleric: 5, druid: 6 }, components: "V,S,M/DF",
    castingTime: "standard", range: "medium", duration: "instant",
    savingThrow: "none", sr: false,
    description: "Creates a stone wall that can be shaped." },

  // 6th Level
  { id: "antilife_shell", name: "Antilife Shell", school: "abjuration",
    levels: { cleric: 6, druid: 6 }, components: "V,S,DF", castingTime: "full-round",
    range: "personal", duration: "10 min/level", savingThrow: "none", sr: true,
    description: "10-ft. field hedges out living creatures." },

  { id: "blade_barrier", name: "Blade Barrier", school: "evocation", descriptor: ["force"],
    levels: { cleric: 6 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "1 min/level", savingThrow: "Reflex half or negates", sr: true,
    description: "Wall of blades deals 1d6/level damage." },

  { id: "chain_lightning", name: "Chain Lightning", school: "evocation", descriptor: ["electricity"],
    levels: { sorcerer: 6, wizard: 6 }, components: "V,S,F", castingTime: "standard",
    range: "long", duration: "instant", savingThrow: "Reflex half", sr: true,
    description: "1d6/level damage; 1 secondary bolt/level each deals half damage." },

  { id: "circle_of_death", name: "Circle of Death", school: "necromancy", descriptor: ["death"],
    levels: { sorcerer: 6, wizard: 6 }, components: "V,S,M", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Fort negates", sr: true,
    description: "Kills 1d4/level HD of creatures." },

  { id: "disintegrate", name: "Disintegrate", school: "transmutation",
    levels: { sorcerer: 6, wizard: 6 }, components: "V,S,M/DF", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Fort partial (object)", sr: true,
    description: "Makes one creature or object vanish. 2d6/level damage (max 40d6)." },

  { id: "find_the_path", name: "Find the Path", school: "divination",
    levels: { cleric: 6, bard: 6, druid: 6 }, components: "V,S,F", castingTime: "standard",
    range: "touch", duration: "10 min/level", savingThrow: "none", sr: false,
    description: "Shows most direct way to a location." },

  { id: "flesh_to_stone", name: "Flesh to Stone", school: "transmutation",
    levels: { sorcerer: 6, wizard: 6 }, components: "V,S,M", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Fort negates", sr: true,
    description: "Turns subject creature into statue." },

  { id: "greater_dispel_magic", name: "Greater Dispel Magic", school: "abjuration",
    levels: { sorcerer: 6, wizard: 6, bard: 5, cleric: 6, druid: 6 },
    components: "V,S", castingTime: "standard", range: "medium", duration: "instant",
    savingThrow: "none", sr: false,
    description: "As dispel magic, but +20 on check." },

  { id: "harm", name: "Harm", school: "necromancy",
    levels: { cleric: 6 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will half", sr: true,
    description: "Deals 10 points/level damage to target." },

  { id: "heal", name: "Heal", school: "conjuration", subschool: "healing",
    levels: { cleric: 6, druid: 7 }, components: "V,S", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will negates (harmless)", sr: true,
    description: "Cures 10 points/level of damage, all diseases, and mental conditions." },

  { id: "heroes_feast", name: "Heroes' Feast", school: "conjuration", subschool: "creation",
    levels: { cleric: 6, bard: 6 }, components: "V,S,DF", castingTime: "10 minutes",
    range: "close", duration: "1 hour + 12 hours", savingThrow: "none", sr: false,
    description: "Food for one creature/level cures disease, grants +1 attack, +1 Will, immunity to fear, 1d8+1/2 level temp hp." },

  { id: "true_seeing", name: "True Seeing", school: "divination",
    levels: { sorcerer: 5, wizard: 5, cleric: 5, druid: 7 }, components: "V,S,M",
    castingTime: "standard", range: "touch", duration: "1 min/level",
    savingThrow: "Will negates (harmless)", sr: true,
    description: "Lets you see all things as they really are." },

  // 7th Level
  { id: "blasphemy", name: "Blasphemy", school: "evocation", descriptor: ["evil", "sonic"],
    levels: { cleric: 7 }, components: "V", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none or Will negates", sr: true,
    description: "Kills, paralyzes, weakens, or dazes nonevil subjects." },

  { id: "delayed_blast_fireball", name: "Delayed Blast Fireball", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 7, wizard: 7 }, components: "V,S,M", castingTime: "standard",
    range: "long", duration: "5 rounds or less", savingThrow: "Reflex half", sr: true,
    description: "1d6/level fire damage; you can postpone blast for 5 rounds." },

  { id: "finger_of_death", name: "Finger of Death", school: "necromancy", descriptor: ["death"],
    levels: { sorcerer: 7, wizard: 7, druid: 8 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Fort partial", sr: true,
    description: "Kills one subject or deals 3d6+1/level damage." },

  { id: "greater_restoration", name: "Greater Restoration", school: "conjuration", subschool: "healing",
    levels: { cleric: 7 }, components: "V,S,XP", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Will negates (harmless)", sr: true,
    description: "As restoration, plus restores all levels and ability scores." },

  { id: "holy_word", name: "Holy Word", school: "evocation", descriptor: ["good", "sonic"],
    levels: { cleric: 7 }, components: "V", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none or Will negates", sr: true,
    description: "Kills, paralyzes, blinds, or deafens nongood subjects." },

  { id: "limited_wish", name: "Limited Wish", school: "universal",
    levels: { sorcerer: 7, wizard: 7 }, components: "V,S,XP", castingTime: "standard",
    range: "close", duration: "varies", savingThrow: "none", sr: true,
    description: "Alters reality — within spell limits." },

  { id: "power_word_blind", name: "Power Word Blind", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 7, wizard: 7 }, components: "V", castingTime: "standard",
    range: "close", duration: "permanent or 1d4+1 rounds", savingThrow: "none", sr: true,
    description: "Blinds creature with 200 hp or less." },

  { id: "regenerate", name: "Regenerate", school: "conjuration", subschool: "healing",
    levels: { cleric: 7, druid: 9 }, components: "V,S,DF", castingTime: "standard",
    range: "touch", duration: "instant", savingThrow: "Fort negates (harmless)", sr: true,
    description: "Subject's severed limbs grow back, cures 4d8+1/level damage." },

  { id: "resurrection", name: "Resurrection", school: "conjuration", subschool: "healing",
    levels: { cleric: 7 }, components: "V,S,M,DF", castingTime: "10 minutes",
    range: "touch", duration: "instant", savingThrow: "none", sr: true,
    description: "Fully restore dead subject." },

  { id: "reverse_gravity", name: "Reverse Gravity", school: "transmutation",
    levels: { sorcerer: 7, wizard: 7, druid: 8 }, components: "V,S,M/DF",
    castingTime: "standard", range: "medium", duration: "1 round/level",
    savingThrow: "none", sr: false,
    description: "Objects and creatures fall upward." },

  // 8th Level
  { id: "antimagic_field", name: "Antimagic Field", school: "abjuration",
    levels: { sorcerer: 6, wizard: 6, cleric: 8 }, components: "V,S,M/DF",
    castingTime: "standard", range: "personal", duration: "10 min/level",
    savingThrow: "none", sr: true,
    description: "Negates magic within 10 ft." },

  { id: "earthquake", name: "Earthquake", school: "evocation", descriptor: ["earth"],
    levels: { cleric: 8, druid: 8 }, components: "V,S,DF", castingTime: "standard",
    range: "long", duration: "1 round", savingThrow: "varies", sr: false,
    description: "Intense tremor shakes 80-ft. radius." },

  { id: "fire_storm", name: "Fire Storm", school: "evocation", descriptor: ["fire"],
    levels: { cleric: 8, druid: 7 }, components: "V,S", castingTime: "full-round",
    range: "medium", duration: "instant", savingThrow: "Reflex half", sr: true,
    description: "Deals 1d6/level fire damage." },

  { id: "horrid_wilting", name: "Horrid Wilting", school: "necromancy",
    levels: { sorcerer: 8, wizard: 8 }, components: "V,S,M/DF", castingTime: "standard",
    range: "long", duration: "instant", savingThrow: "Fort half", sr: true,
    description: "Deals 1d6/level damage within 30 ft." },

  { id: "mass_cure_critical_wounds", name: "Mass Cure Critical Wounds", school: "conjuration", subschool: "healing",
    levels: { cleric: 8, druid: 9 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Will half (harmless)", sr: true,
    description: "Cures 4d8+1/level damage for several creatures." },

  { id: "maze", name: "Maze", school: "conjuration", subschool: "teleportation",
    levels: { sorcerer: 8, wizard: 8 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "varies", savingThrow: "none", sr: true,
    description: "Traps subject in extradimensional maze." },

  { id: "polar_ray", name: "Polar Ray", school: "evocation", descriptor: ["cold"],
    levels: { sorcerer: 8, wizard: 8 }, components: "V,S,F", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Ranged touch attack deals 1d6/level cold damage." },

  { id: "power_word_stun", name: "Power Word Stun", school: "enchantment", subschool: "compulsion", descriptor: ["mind-affecting"],
    levels: { sorcerer: 8, wizard: 8 }, components: "V", castingTime: "standard",
    range: "close", duration: "varies", savingThrow: "none", sr: true,
    description: "Stuns creature with 150 hp or less." },

  { id: "sunburst", name: "Sunburst", school: "evocation", descriptor: ["light"],
    levels: { sorcerer: 8, wizard: 8, druid: 8 }, components: "V,S,M/DF",
    castingTime: "standard", range: "long", duration: "instant",
    savingThrow: "Reflex partial", sr: true,
    description: "Blinds all within 10 ft., deals 6d6 damage to undead." },

  // 9th Level
  { id: "energy_drain", name: "Energy Drain", school: "necromancy",
    levels: { sorcerer: 9, wizard: 9, cleric: 9 }, components: "V,S", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "Fort partial", sr: true,
    description: "Subject gains 2d4 negative levels." },

  { id: "gate", name: "Gate", school: "conjuration", subschool: "calling, creation",
    levels: { sorcerer: 9, wizard: 9, cleric: 9 }, components: "V,S,XP",
    castingTime: "standard", range: "medium", duration: "instant or concentration",
    savingThrow: "none", sr: false,
    description: "Connects two planes for travel or summons a powerful extraplanar creature." },

  { id: "meteor_swarm", name: "Meteor Swarm", school: "evocation", descriptor: ["fire"],
    levels: { sorcerer: 9, wizard: 9 }, components: "V,S", castingTime: "standard",
    range: "long", duration: "instant", savingThrow: "none or Reflex half", sr: true,
    description: "Four exploding spheres each deal 6d6 fire damage." },

  { id: "miracle", name: "Miracle", school: "evocation",
    levels: { cleric: 9 }, components: "V,S,XP", castingTime: "standard",
    range: "close", duration: "varies", savingThrow: "varies", sr: true,
    description: "Requests a deity's intercession — nearly anything is possible." },

  { id: "power_word_kill", name: "Power Word Kill", school: "enchantment", subschool: "compulsion", descriptor: ["death", "mind-affecting"],
    levels: { sorcerer: 9, wizard: 9 }, components: "V", castingTime: "standard",
    range: "close", duration: "instant", savingThrow: "none", sr: true,
    description: "Kills one creature with 100 hp or less." },

  { id: "prismatic_sphere", name: "Prismatic Sphere", school: "abjuration",
    levels: { sorcerer: 9, wizard: 9 }, components: "V", castingTime: "standard",
    range: "personal", duration: "10 min/level", savingThrow: "varies", sr: true,
    description: "As prismatic wall, but surrounds on all sides." },

  { id: "shapechange", name: "Shapechange", school: "transmutation",
    levels: { sorcerer: 9, wizard: 9, druid: 9 }, components: "V,S,F",
    castingTime: "standard", range: "personal", duration: "10 min/level",
    savingThrow: "none", sr: false,
    description: "Transforms you into any creature, and change forms once per round." },

  { id: "storm_of_vengeance", name: "Storm of Vengeance", school: "conjuration", subschool: "summoning",
    levels: { cleric: 9, druid: 9 }, components: "V,S", castingTime: "full-round",
    range: "long", duration: "concentration, up to 10 rounds",
    savingThrow: "varies", sr: true,
    description: "Storm rains acid, lightning, and hail." },

  { id: "time_stop", name: "Time Stop", school: "transmutation",
    levels: { sorcerer: 9, wizard: 9 }, components: "V", castingTime: "standard",
    range: "personal", duration: "1d4+1 rounds (apparent time)", savingThrow: "none", sr: false,
    description: "You act freely for 1d4+1 rounds." },

  { id: "true_resurrection", name: "True Resurrection", school: "conjuration", subschool: "healing",
    levels: { cleric: 9 }, components: "V,S,M,DF", castingTime: "10 minutes",
    range: "touch", duration: "instant", savingThrow: "none", sr: true,
    description: "As resurrection, plus remains are not needed." },

  { id: "weird", name: "Weird", school: "illusion", subschool: "phantasm", descriptor: ["fear", "mind-affecting"],
    levels: { sorcerer: 9, wizard: 9 }, components: "V,S", castingTime: "standard",
    range: "medium", duration: "instant", savingThrow: "Will disbelief, then Fort partial", sr: true,
    description: "As phantasmal killer, but all within 30 ft." },

  { id: "wish", name: "Wish", school: "universal",
    levels: { sorcerer: 9, wizard: 9 }, components: "V,XP", castingTime: "standard",
    range: "close", duration: "varies", savingThrow: "varies", sr: true,
    description: "As limited wish, but with fewer limits. The mightiest spell a wizard can cast." },
];

// ── Quick Lookup Map ────────────────────────────────────────────────────────

export const SPELL_MAP = new Map<string, Spell>(SPELLS.map(s => [s.id, s]));

/** Count of spells by school for UI display */
export function spellCountBySchool(): Record<SpellSchool, number> {
  const counts: Record<string, number> = {};
  for (const s of SPELLS) {
    counts[s.school] = (counts[s.school] ?? 0) + 1;
  }
  return counts as Record<SpellSchool, number>;
}
