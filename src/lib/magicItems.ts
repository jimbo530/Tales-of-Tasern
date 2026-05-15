// ============================================================
// magicItems.ts — D20 Magic Items Database for Tales of Tasern
// D&D 3.5-style magic items with full game mechanics
// Rarity system, loot tables, set bonuses, shop generation
// ============================================================

// ── Types & Enums ─────────────────────────────────────────────────────────────

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Element = "fire" | "cold" | "lightning" | "acid" | "sonic" | "force" | "necrotic" | "radiant" | "poison" | "none";
export type ItemSlot = "mainhand" | "offhand" | "head" | "neck" | "body" | "hands" | "feet" | "ring" | "belt" | "back" | "consumable" | "none";

export type StatModifier = {
  stat: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  value: number;
};

export type OnHitEffect = {
  type: "poison" | "stun" | "slow" | "burn" | "bleed" | "freeze" | "drain" | "knockback";
  chance: number; // percent (0-100)
  duration?: number; // rounds
  damage?: string; // dice notation e.g. "1d6"
  dc?: number; // save DC
};

export type PassiveAbility = {
  type: "regen" | "stealth" | "flight" | "waterbreathing" | "darkvision" | "resistance" | "immunity" | "reflect" | "thorns";
  value?: number; // numeric magnitude
  element?: Element; // for resistance/immunity
  description: string;
};

export type ActiveAbility = {
  name: string;
  description: string;
  usesPerDay: number;
  cooldownRounds?: number;
  damage?: string;
  dc?: number;
  range?: number; // feet
};

export type DamageResistance = {
  element: Element;
  percent: number; // 0-100
};

// ── Base Item Type ────────────────────────────────────────────────────────────

export type MagicItemBase = {
  id: string;
  name: string;
  rarity: Rarity;
  value: number; // gold pieces
  weight: number; // pounds
  description: string;
  requiredLevel: number;
  slot: ItemSlot;
  setId?: string; // for set bonus tracking
  statModifiers?: StatModifier[];
  passives?: PassiveAbility[];
  actives?: ActiveAbility[];
  resistances?: DamageResistance[];
};

// ── Weapon Type ───────────────────────────────────────────────────────────────

export type WeaponType = "longsword" | "shortsword" | "greatsword" | "dagger" | "battleaxe" | "greataxe" | "warhammer" | "mace" | "flail" | "rapier" | "scimitar" | "longbow" | "shortbow" | "crossbow" | "staff" | "spear" | "halberd" | "trident";

export type MagicWeapon = MagicItemBase & {
  category: "weapon";
  weaponType: WeaponType;
  baseDamage: string; // dice notation "1d8", "2d6"
  bonusToHit: number;
  bonusDamage: number;
  element: Element;
  critRange: number; // e.g. 19 means 19-20, 20 means only 20
  critMultiplier: number; // x2, x3, etc.
  onHit?: OnHitEffect;
  twoHanded?: boolean;
  range?: number; // ranged weapon range in feet
  specialEffect: string;
};

// ── Armor Type ────────────────────────────────────────────────────────────────

export type ArmorType = "plate" | "half-plate" | "chainmail" | "breastplate" | "chain-shirt" | "leather" | "studded-leather" | "hide" | "padded" | "robes" | "shield" | "buckler";

export type MagicArmor = MagicItemBase & {
  category: "armor";
  armorType: ArmorType;
  baseAC: number;
  maxDexBonus: number;
  armorCheckPenalty: number;
  arcaneFailure: number; // percent
  specialEffect: string;
};

// ── Ring Type ─────────────────────────────────────────────────────────────────

export type MagicRing = MagicItemBase & {
  category: "ring";
  specialEffect: string;
};

// ── Amulet Type ───────────────────────────────────────────────────────────────

export type MagicAmulet = MagicItemBase & {
  category: "amulet";
  specialEffect: string;
};

// ── Potion Type ───────────────────────────────────────────────────────────────

export type MagicPotion = MagicItemBase & {
  category: "potion";
  healing?: string; // dice notation
  duration?: number; // rounds (0 = instant)
  specialEffect: string;
};

// ── Scroll Type ───────────────────────────────────────────────────────────────

export type MagicScroll = MagicItemBase & {
  category: "scroll";
  spellLevel: number;
  casterLevel: number;
  specialEffect: string;
};

// ── Wondrous Item Type ────────────────────────────────────────────────────────

export type WondrousSlot = "head" | "neck" | "body" | "hands" | "feet" | "belt" | "back" | "none";

export type MagicWondrous = MagicItemBase & {
  category: "wondrous";
  wondrousSlot: WondrousSlot;
  specialEffect: string;
};

// ── Union Type ────────────────────────────────────────────────────────────────

export type MagicItem = MagicWeapon | MagicArmor | MagicRing | MagicAmulet | MagicPotion | MagicScroll | MagicWondrous;

// ── Rarity Colors (for UI) ───────────────────────────────────────────────────

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#0070ff",
  epic: "#a335ee",
  legendary: "#ff8000",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

// ══════════════════════════════════════════════════════════════════════════════
//  WEAPONS (40 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_WEAPONS: MagicWeapon[] = [
  // ── Common (+1) ──
  {
    id: "wpn_longsword_1", name: "Longsword +1", category: "weapon", weaponType: "longsword",
    rarity: "common", value: 2315, weight: 4, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 19, critMultiplier: 2,
    description: "A well-crafted longsword with a faint magical shimmer along the blade.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },
  {
    id: "wpn_shortbow_1", name: "Shortbow +1", category: "weapon", weaponType: "shortbow",
    rarity: "common", value: 2330, weight: 2, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 20, critMultiplier: 3, range: 60,
    description: "A compact bow of yew with glowing string.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },
  {
    id: "wpn_dagger_1", name: "Dagger +1", category: "weapon", weaponType: "dagger",
    rarity: "common", value: 2302, weight: 1, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d4", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 19, critMultiplier: 2, range: 10,
    description: "A sharp dagger that hums with minor enchantment.",
    specialEffect: "+1 enhancement bonus to attack and damage. Can be thrown.",
  },
  {
    id: "wpn_mace_1", name: "Heavy Mace +1", category: "weapon", weaponType: "mace",
    rarity: "common", value: 2312, weight: 8, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 20, critMultiplier: 2,
    description: "A sturdy mace with a head that glows faintly blue.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },
  {
    id: "wpn_battleaxe_1", name: "Battleaxe +1", category: "weapon", weaponType: "battleaxe",
    rarity: "common", value: 2310, weight: 6, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 20, critMultiplier: 3,
    description: "A keen-edged axe with runes etched along the blade.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },
  {
    id: "wpn_staff_1", name: "Quarterstaff +1", category: "weapon", weaponType: "staff",
    rarity: "common", value: 2300, weight: 4, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 20, critMultiplier: 2, twoHanded: true,
    description: "A hardwood staff reinforced with magical energy.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },
  {
    id: "wpn_longbow_1", name: "Longbow +1", category: "weapon", weaponType: "longbow",
    rarity: "common", value: 2375, weight: 3, requiredLevel: 1, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 20, critMultiplier: 3, range: 100, twoHanded: true,
    description: "A tall composite bow with elvish runes.",
    specialEffect: "+1 enhancement bonus to attack and damage.",
  },

  // ── Uncommon (+2, elemental) ──
  {
    id: "wpn_flaming_longsword", name: "Flaming Longsword", category: "weapon", weaponType: "longsword",
    rarity: "uncommon", value: 8315, weight: 4, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "fire",
    critRange: 19, critMultiplier: 2,
    onHit: { type: "burn", chance: 100, damage: "1d6", duration: 1 },
    description: "A longsword wreathed in flickering flames that never die.",
    specialEffect: "+1 longsword, +1d6 fire damage on every hit.",
  },
  {
    id: "wpn_frost_battleaxe", name: "Frost Battleaxe", category: "weapon", weaponType: "battleaxe",
    rarity: "uncommon", value: 8310, weight: 6, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "cold",
    critRange: 20, critMultiplier: 3,
    onHit: { type: "slow", chance: 25, duration: 2, dc: 14 },
    description: "An axe rimed with perpetual frost that chills foes to the bone.",
    specialEffect: "+1 battleaxe, +1d6 cold damage. 25% chance to slow on hit (2 rounds, Fort DC 14).",
  },
  {
    id: "wpn_shock_longbow", name: "Shocking Longbow", category: "weapon", weaponType: "longbow",
    rarity: "uncommon", value: 8375, weight: 3, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "lightning",
    critRange: 20, critMultiplier: 3, range: 100, twoHanded: true,
    onHit: { type: "stun", chance: 10, duration: 1, dc: 14 },
    description: "A bow crackling with arcs of electricity between the limbs.",
    specialEffect: "+1 longbow, +1d6 lightning damage. 10% chance to stun (1 round, Fort DC 14).",
  },
  {
    id: "wpn_venom_dagger", name: "Venom Dagger", category: "weapon", weaponType: "dagger",
    rarity: "uncommon", value: 8302, weight: 1, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d4", bonusToHit: 2, bonusDamage: 2, element: "poison",
    critRange: 19, critMultiplier: 2, range: 10,
    onHit: { type: "poison", chance: 50, damage: "1d6", duration: 3, dc: 14 },
    description: "A +2 dagger with a hollow pommel dripping with virulent venom.",
    specialEffect: "+2 dagger. 50% chance on hit: 1d6 poison/round for 3 rounds (Fort DC 14).",
  },
  {
    id: "wpn_thundering_warhammer", name: "Thundering Warhammer", category: "weapon", weaponType: "warhammer",
    rarity: "uncommon", value: 8312, weight: 5, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "sonic",
    critRange: 20, critMultiplier: 3,
    onHit: { type: "knockback", chance: 20, dc: 14 },
    description: "A warhammer that booms like thunder on impact.",
    specialEffect: "+1 warhammer, +1d6 sonic on crit. 20% chance to knock back 5ft.",
  },
  {
    id: "wpn_corrosive_rapier", name: "Corrosive Rapier", category: "weapon", weaponType: "rapier",
    rarity: "uncommon", value: 8320, weight: 2, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 2, bonusDamage: 2, element: "acid",
    critRange: 18, critMultiplier: 2,
    onHit: { type: "bleed", chance: 30, damage: "1d4", duration: 2 },
    description: "A rapier that weeps acid, dissolving armor on contact.",
    specialEffect: "+2 rapier, +1d6 acid damage. 30% chance to corrode armor (-1 AC for 2 rounds).",
  },
  {
    id: "wpn_radiant_mace", name: "Radiant Mace", category: "weapon", weaponType: "mace",
    rarity: "uncommon", value: 8312, weight: 8, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "radiant",
    critRange: 20, critMultiplier: 2,
    description: "A mace that blazes with holy light, searing undead.",
    specialEffect: "+2 mace, +1d6 radiant damage. Deals +2d6 bonus vs. undead.",
  },

  // ── Rare (+3, strong effects) ──
  {
    id: "wpn_flame_tongue", name: "Flame Tongue", category: "weapon", weaponType: "longsword",
    rarity: "rare", value: 20715, weight: 4, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "fire",
    critRange: 19, critMultiplier: 2,
    onHit: { type: "burn", chance: 100, damage: "1d6", duration: 2 },
    description: "A +1 flaming burst longsword wreathed in living fire that erupts on critical hits.",
    specialEffect: "+2 longsword, +1d6 fire per hit, +1d10 fire on crit. Sheds light as torch.",
    actives: [{
      name: "Flaming Burst", description: "On critical hit, deals +1d10 extra fire damage.",
      usesPerDay: -1,
    }],
  },
  {
    id: "wpn_frost_brand", name: "Frost Brand", category: "weapon", weaponType: "greatsword",
    rarity: "rare", value: 54475, weight: 8, requiredLevel: 12, slot: "mainhand",
    baseDamage: "2d6", bonusToHit: 3, bonusDamage: 3, element: "cold",
    critRange: 19, critMultiplier: 2, twoHanded: true,
    onHit: { type: "slow", chance: 40, duration: 2, dc: 17 },
    description: "A +3 greatsword coated in ever-present frost that protects its wielder from fire.",
    specialEffect: "+3 greatsword, +1d6 cold damage. 40% slow. Fire resistance 10.",
    resistances: [{ element: "fire", percent: 30 }],
  },
  {
    id: "wpn_nine_lives_stealer", name: "Nine Lives Stealer", category: "weapon", weaponType: "longsword",
    rarity: "rare", value: 23057, weight: 4, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "necrotic",
    critRange: 19, critMultiplier: 2,
    description: "A +2 longsword with nine black gems set in the crossguard, each holding a stolen soul.",
    specialEffect: "+2 longsword. On crit: Fort DC 20 or die. Each kill consumes one gem (9 uses).",
    onHit: { type: "drain", chance: 5, damage: "1d4", dc: 20 },
  },
  {
    id: "wpn_oathbow", name: "Oathbow", category: "weapon", weaponType: "longbow",
    rarity: "rare", value: 25600, weight: 3, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "none",
    critRange: 20, critMultiplier: 3, range: 110, twoHanded: true,
    description: "A +2 composite longbow that forms a blood oath against your sworn enemy.",
    specialEffect: "+2 longbow. Name sworn enemy: +5 to hit, +5 damage vs. that target until it dies.",
    actives: [{
      name: "Sworn Enemy", description: "Declare a sworn enemy once per day. +5 attack/damage vs that target.",
      usesPerDay: 1,
    }],
  },
  {
    id: "wpn_life_stealing", name: "Sword of Life Stealing", category: "weapon", weaponType: "longsword",
    rarity: "rare", value: 25715, weight: 4, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "necrotic",
    critRange: 19, critMultiplier: 2,
    onHit: { type: "drain", chance: 100, damage: "0", dc: 16 },
    description: "A +2 longsword that drinks the lifeblood of its victims.",
    specialEffect: "+2 longsword. On crit: bestow 1 negative level (Fort DC 16). Gain 1d6 temp HP.",
  },
  {
    id: "wpn_sun_blade", name: "Sun Blade", category: "weapon", weaponType: "longsword",
    rarity: "rare", value: 50335, weight: 2, requiredLevel: 12, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "radiant",
    critRange: 19, critMultiplier: 2,
    description: "A +2 bastard sword blazing with solar radiance. Weighs nothing in the hand.",
    specialEffect: "+2 bastard sword (+4 vs evil). +2d6 radiant vs undead. Counts as sunlight.",
    actives: [{
      name: "Sunlight Blade", description: "Shed bright sunlight in 30ft radius. Undead take +2d6.",
      usesPerDay: 3,
    }],
  },
  {
    id: "wpn_dwarven_thrower", name: "Dwarven Thrower", category: "weapon", weaponType: "warhammer",
    rarity: "rare", value: 60312, weight: 5, requiredLevel: 12, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 3, bonusDamage: 3, element: "none",
    critRange: 20, critMultiplier: 3, range: 30,
    description: "A +2 warhammer that returns to the wielder's hand when thrown.",
    specialEffect: "+3 when thrown, returns. +2d8 thrown damage (+4d8 vs. giants).",
  },
  {
    id: "wpn_scimitar_speed", name: "Scimitar of Speed", category: "weapon", weaponType: "scimitar",
    rarity: "rare", value: 30000, weight: 4, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 3, bonusDamage: 3, element: "none",
    critRange: 18, critMultiplier: 2,
    description: "A curved blade that moves faster than the eye can follow.",
    specialEffect: "+3 scimitar. Grants one extra attack per round (as haste).",
    passives: [{ type: "regen", value: 0, description: "Grants one extra attack per round." }],
  },
  {
    id: "wpn_javelin_lightning", name: "Javelin of Lightning", category: "weapon", weaponType: "spear",
    rarity: "uncommon", value: 1500, weight: 2, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 0, bonusDamage: 0, element: "lightning",
    critRange: 20, critMultiplier: 2, range: 30,
    description: "A javelin wreathed in crackling arcs of electricity.",
    specialEffect: "Transforms into 5d6 lightning bolt (120ft line, Reflex DC 14). Becomes mundane after.",
    actives: [{
      name: "Lightning Bolt", description: "Throw: 5d6 lightning in 120ft line (Ref DC 14). Single use.",
      usesPerDay: 1, damage: "5d6", dc: 14, range: 120,
    }],
  },

  // ── Epic (+4, powerful effects) ──
  {
    id: "wpn_holy_avenger", name: "Holy Avenger", category: "weapon", weaponType: "longsword",
    rarity: "epic", value: 120630, weight: 4, requiredLevel: 15, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 5, bonusDamage: 5, element: "radiant",
    critRange: 19, critMultiplier: 2,
    description: "A legendary +2 cold iron longsword — the ultimate weapon against evil.",
    specialEffect: "+7 holy vs evil (+2d6 radiant). Greater dispel magic at will in 5ft radius. SR 15 aura.",
    actives: [{
      name: "Greater Dispel", description: "Continuous dispel magic in 5ft aura (paladin only).",
      usesPerDay: -1,
    }],
    passives: [{ type: "resistance", element: "necrotic", value: 50, description: "SR 15 spell resistance aura." }],
  },
  {
    id: "wpn_mace_smiting", name: "Mace of Smiting", category: "weapon", weaponType: "mace",
    rarity: "epic", value: 75312, weight: 8, requiredLevel: 15, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 3, bonusDamage: 3, element: "force",
    critRange: 20, critMultiplier: 2,
    description: "A +3 adamantine heavy mace that shatters constructs with a single blow.",
    specialEffect: "+3 adamantine. +5 vs constructs. Crit vs construct: destroy it (Fort DC 20).",
  },
  {
    id: "wpn_mace_terror", name: "Mace of Terror", category: "weapon", weaponType: "mace",
    rarity: "epic", value: 38552, weight: 8, requiredLevel: 13, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "necrotic",
    critRange: 20, critMultiplier: 2,
    description: "A +2 heavy mace carved with screaming faces that project waves of dread.",
    specialEffect: "+2 heavy mace. 3/day: cause fear in 30ft cone (Will DC 16, 1d4 rounds).",
    actives: [{
      name: "Wave of Terror", description: "30ft cone fear (Will DC 16 or flee 1d4 rounds).",
      usesPerDay: 3, dc: 16, range: 30,
    }],
  },
  {
    id: "wpn_life_drinker", name: "Life-Drinker", category: "weapon", weaponType: "greataxe",
    rarity: "epic", value: 40320, weight: 12, requiredLevel: 14, slot: "mainhand",
    baseDamage: "1d12", bonusToHit: 1, bonusDamage: 1, element: "necrotic",
    critRange: 20, critMultiplier: 3, twoHanded: true,
    onHit: { type: "drain", chance: 100, damage: "0", dc: 0 },
    description: "A +1 greataxe made of vampiric black iron that drinks life from the living.",
    specialEffect: "+1 greataxe. On hit: bestow 1 negative level. Gain 5 temp HP. Costs 1 of your HP.",
  },
  {
    id: "wpn_vorpal_greatsword", name: "Vorpal Greatsword", category: "weapon", weaponType: "greatsword",
    rarity: "epic", value: 100000, weight: 8, requiredLevel: 18, slot: "mainhand",
    baseDamage: "2d6", bonusToHit: 4, bonusDamage: 4, element: "none",
    critRange: 19, critMultiplier: 2, twoHanded: true,
    description: "A +4 greatsword so sharp it can sever heads. On a natural 20, the blade cuts clean through.",
    specialEffect: "+4 greatsword. On natural 20: instant decapitation (Fort DC 30 or die).",
  },
  {
    id: "wpn_rapier_puncturing", name: "Rapier of Puncturing", category: "weapon", weaponType: "rapier",
    rarity: "epic", value: 50320, weight: 2, requiredLevel: 14, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 2, bonusDamage: 2, element: "none",
    critRange: 18, critMultiplier: 2,
    onHit: { type: "bleed", chance: 100, damage: "1d4", duration: 99 },
    description: "A +2 wounding rapier that bleeds targets dry with every thrust.",
    specialEffect: "+2 rapier. On hit: 1 CON damage per round (stacks). No save.",
  },

  // ── Legendary (+5, game-changing) ──
  {
    id: "wpn_sword_kas", name: "Sword of Kas", category: "weapon", weaponType: "longsword",
    rarity: "legendary", value: 200000, weight: 4, requiredLevel: 20, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 5, bonusDamage: 5, element: "necrotic",
    critRange: 17, critMultiplier: 3,
    description: "A black-bladed longsword that severed the Hand of Vecna. It whispers in dreams, hungry and patient.",
    specialEffect: "+5 longsword, +3d6 necrotic. On crit: instant kill (Fort DC 25).",
    statModifiers: [{ stat: "STR", value: 4 }],
    onHit: { type: "drain", chance: 100, damage: "3d6", dc: 25 },
  },
  {
    id: "wpn_axe_dwarvish_lords", name: "Axe of the Dwarvish Lords", category: "weapon", weaponType: "greataxe",
    rarity: "legendary", value: 200000, weight: 8, requiredLevel: 20, slot: "mainhand",
    baseDamage: "1d12", bonusToHit: 5, bonusDamage: 5, element: "force",
    critRange: 20, critMultiplier: 3, twoHanded: true,
    description: "A mithral-edged greataxe forged in the heart of Bhalanur. The mountain roared when its last guardian fell.",
    specialEffect: "+5 greataxe, +2d6 damage. Sundering Strike: destroy enemy shield/armor 1/battle.",
    statModifiers: [{ stat: "CON", value: 4 }],
    actives: [{
      name: "Sundering Strike", description: "Destroy enemy shield or armor (no save). Once per battle.",
      usesPerDay: 1,
    }],
  },
  {
    id: "wpn_staff_magi", name: "Staff of the Magi", category: "weapon", weaponType: "staff",
    rarity: "legendary", value: 200000, weight: 4, requiredLevel: 20, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 2, bonusDamage: 2, element: "force",
    critRange: 20, critMultiplier: 2, twoHanded: true,
    description: "One of the mightiest staves ever crafted, humming with continent-shaking arcane power.",
    specialEffect: "+2 staff. 50 charges for spells. Spell power +3. Can break for 200ft retributive strike.",
    statModifiers: [{ stat: "INT", value: 4 }, { stat: "WIS", value: 2 }],
    actives: [
      { name: "Fireball", description: "10d6 fire, 20ft radius (1 charge).", usesPerDay: 10, damage: "10d6", dc: 17, range: 150 },
      { name: "Lightning Bolt", description: "10d6 lightning, 120ft line (1 charge).", usesPerDay: 10, damage: "10d6", dc: 17, range: 120 },
      { name: "Retributive Strike", description: "Break staff: 200ft radius destruction. Destroys staff.", usesPerDay: 1 },
    ],
  },
  {
    id: "wpn_luck_blade", name: "Luck Blade", category: "weapon", weaponType: "shortsword",
    rarity: "legendary", value: 100000, weight: 2, requiredLevel: 18, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 3, bonusDamage: 3, element: "force",
    critRange: 19, critMultiplier: 2,
    description: "A shimmering short sword that bends fortune around its wielder, granting impossible luck.",
    specialEffect: "+3 short sword. +1 luck bonus to all saves. Contains 3 wish spells.",
    actives: [{
      name: "Wish", description: "Cast Wish. 3 uses total (consumed permanently).",
      usesPerDay: 1,
    }],
  },
  {
    id: "wpn_dancing_scimitar", name: "Dancing Scimitar", category: "weapon", weaponType: "scimitar",
    rarity: "epic", value: 50000, weight: 4, requiredLevel: 14, slot: "mainhand",
    baseDamage: "1d6", bonusToHit: 3, bonusDamage: 3, element: "none",
    critRange: 18, critMultiplier: 2,
    description: "A +3 scimitar that fights on its own, hovering in the air beside you.",
    specialEffect: "+3 scimitar. Release to fight autonomously for 4 rounds (attacks independently).",
    actives: [{
      name: "Dance", description: "Release weapon — it fights alone for 4 rounds (uses your BAB).",
      usesPerDay: 3, cooldownRounds: 10,
    }],
  },
  {
    id: "wpn_speed_longsword", name: "Longsword of Speed", category: "weapon", weaponType: "longsword",
    rarity: "epic", value: 50315, weight: 4, requiredLevel: 14, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 3, bonusDamage: 3, element: "none",
    critRange: 19, critMultiplier: 2,
    description: "A +3 longsword that strikes with supernatural speed, granting an extra attack.",
    specialEffect: "+3 longsword. Grants one extra attack per round at highest BAB.",
  },
  {
    id: "wpn_disruption_mace", name: "Mace of Disruption", category: "weapon", weaponType: "mace",
    rarity: "rare", value: 18000, weight: 8, requiredLevel: 8, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "radiant",
    critRange: 20, critMultiplier: 2,
    description: "A +1 mace blazing with positive energy, the bane of all undead.",
    specialEffect: "+1 mace. Undead hit must Will DC 14 or be destroyed. Sheds daylight 20ft.",
    actives: [{
      name: "Disruption", description: "Undead on hit must Will DC 14 or be instantly destroyed.",
      usesPerDay: -1,
    }],
  },
  {
    id: "wpn_assassin_dagger", name: "Assassin's Dagger", category: "weapon", weaponType: "dagger",
    rarity: "rare", value: 10302, weight: 1, requiredLevel: 8, slot: "mainhand",
    baseDamage: "1d4", bonusToHit: 2, bonusDamage: 2, element: "poison",
    critRange: 19, critMultiplier: 2, range: 10,
    onHit: { type: "poison", chance: 30, damage: "2d6", duration: 3, dc: 16 },
    description: "A +2 dagger designed for killing, amplifying sneak attacks and death strikes.",
    specialEffect: "+2 dagger. +1d6 sneak attack damage. Death attack DC +1.",
  },
  {
    id: "wpn_crossbow_distance", name: "Crossbow of Distance", category: "weapon", weaponType: "crossbow",
    rarity: "uncommon", value: 8350, weight: 4, requiredLevel: 5, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 1, bonusDamage: 1, element: "none",
    critRange: 19, critMultiplier: 2, range: 240, twoHanded: true,
    description: "A +1 heavy crossbow enchanted to shoot bolts at double range.",
    specialEffect: "+1 heavy crossbow. Range increment doubled (240ft). No range penalty within 120ft.",
  },
  {
    id: "wpn_halberd_force", name: "Halberd of Force", category: "weapon", weaponType: "halberd",
    rarity: "rare", value: 30000, weight: 12, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d10", bonusToHit: 3, bonusDamage: 3, element: "force",
    critRange: 20, critMultiplier: 3, twoHanded: true,
    onHit: { type: "knockback", chance: 30, dc: 17 },
    description: "A +3 halberd crackling with force energy that sends foes flying.",
    specialEffect: "+3 halberd, +1d6 force damage. 30% chance knockback 10ft (Fort DC 17).",
  },
  {
    id: "wpn_trident_warning", name: "Trident of Warning", category: "weapon", weaponType: "trident",
    rarity: "uncommon", value: 10115, weight: 4, requiredLevel: 6, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 2, bonusDamage: 2, element: "none",
    critRange: 20, critMultiplier: 2, range: 10,
    description: "A +2 trident that glows red when enemies are near.",
    specialEffect: "+2 trident. Cannot be surprised — weapon warns of hostile intent within 120ft.",
    passives: [{ type: "darkvision", value: 120, description: "Warns of enemies within 120ft. Cannot be surprised." }],
  },
  {
    id: "wpn_flail_smiting", name: "Flail of Smiting", category: "weapon", weaponType: "flail",
    rarity: "rare", value: 35000, weight: 8, requiredLevel: 10, slot: "mainhand",
    baseDamage: "1d8", bonusToHit: 3, bonusDamage: 3, element: "radiant",
    critRange: 20, critMultiplier: 2,
    description: "A +3 heavy flail wreathed in divine energy, crushing evil where it stands.",
    specialEffect: "+3 flail. +2d6 radiant vs. evil outsiders. Crit vs evil: stun 1 round (no save).",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  ARMOR (30 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_ARMORS: MagicArmor[] = [
  // ── Common ──
  {
    id: "arm_chain_shirt_1", name: "Chain Shirt +1", category: "armor", armorType: "chain-shirt",
    rarity: "common", value: 1250, weight: 25, requiredLevel: 1, slot: "body",
    baseAC: 5, maxDexBonus: 4, armorCheckPenalty: -2, arcaneFailure: 20,
    description: "A shirt of interlocking rings with a faint magical ward.",
    specialEffect: "+1 enhancement bonus to AC.",
  },
  {
    id: "arm_leather_1", name: "Leather Armor +1", category: "armor", armorType: "leather",
    rarity: "common", value: 1160, weight: 15, requiredLevel: 1, slot: "body",
    baseAC: 3, maxDexBonus: 6, armorCheckPenalty: 0, arcaneFailure: 10,
    description: "Well-oiled leather armor reinforced with magical protection.",
    specialEffect: "+1 enhancement bonus to AC.",
  },
  {
    id: "arm_breastplate_1", name: "Breastplate +1", category: "armor", armorType: "breastplate",
    rarity: "common", value: 1350, weight: 30, requiredLevel: 1, slot: "body",
    baseAC: 6, maxDexBonus: 3, armorCheckPenalty: -4, arcaneFailure: 25,
    description: "A solid breastplate with a subtle shimmer of protection.",
    specialEffect: "+1 enhancement bonus to AC.",
  },
  {
    id: "arm_shield_heavy_1", name: "Heavy Shield +1", category: "armor", armorType: "shield",
    rarity: "common", value: 1170, weight: 15, requiredLevel: 1, slot: "offhand",
    baseAC: 2, maxDexBonus: 99, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "A sturdy shield with a faint protective aura.",
    specialEffect: "+1 enhancement bonus to shield AC.",
  },
  {
    id: "arm_studded_leather_1", name: "Studded Leather +1", category: "armor", armorType: "studded-leather",
    rarity: "common", value: 1175, weight: 20, requiredLevel: 1, slot: "body",
    baseAC: 4, maxDexBonus: 5, armorCheckPenalty: -1, arcaneFailure: 15,
    description: "Studded leather reinforced with magical studs.",
    specialEffect: "+1 enhancement bonus to AC.",
  },
  {
    id: "arm_full_plate_1", name: "Full Plate +1", category: "armor", armorType: "plate",
    rarity: "common", value: 2650, weight: 50, requiredLevel: 3, slot: "body",
    baseAC: 9, maxDexBonus: 1, armorCheckPenalty: -6, arcaneFailure: 35,
    description: "A suit of full plate armor with a minor magical enhancement.",
    specialEffect: "+1 enhancement bonus to AC.",
  },

  // ── Uncommon ──
  {
    id: "arm_mithral_shirt", name: "Mithral Shirt", category: "armor", armorType: "chain-shirt",
    rarity: "uncommon", value: 1100, weight: 10, requiredLevel: 5, slot: "body",
    baseAC: 5, maxDexBonus: 6, armorCheckPenalty: 0, arcaneFailure: 10,
    description: "A shirt of finely woven mithral rings — light as silk, strong as steel.",
    specialEffect: "+4 AC, +6 max DEX, no armor check penalty. Light armor.",
  },
  {
    id: "arm_elven_chain", name: "Elven Chain", category: "armor", armorType: "chainmail",
    rarity: "uncommon", value: 4150, weight: 20, requiredLevel: 6, slot: "body",
    baseAC: 6, maxDexBonus: 4, armorCheckPenalty: -2, arcaneFailure: 20,
    description: "An exquisitely crafted suit of mithral chainmail of elven make.",
    specialEffect: "+5 AC, +4 max DEX, -2 check penalty. Counts as light armor for movement.",
  },
  {
    id: "arm_rhino_hide", name: "Rhino Hide", category: "armor", armorType: "hide",
    rarity: "uncommon", value: 5165, weight: 25, requiredLevel: 6, slot: "body",
    baseAC: 6, maxDexBonus: 4, armorCheckPenalty: -3, arcaneFailure: 20,
    description: "Thick rhinoceros hide reinforced with magic — charges deal extra damage.",
    specialEffect: "+5 AC. On successful charge attack: +2d6 bonus damage.",
  },
  {
    id: "arm_adamantine_breastplate", name: "Adamantine Breastplate", category: "armor", armorType: "breastplate",
    rarity: "uncommon", value: 10200, weight: 30, requiredLevel: 8, slot: "body",
    baseAC: 6, maxDexBonus: 3, armorCheckPenalty: -4, arcaneFailure: 25,
    description: "A mirror-bright breastplate of indestructible adamantine.",
    specialEffect: "+5 AC. DR 2/-- (reduces all physical damage by 2).",
    passives: [{ type: "resistance", value: 2, description: "DR 2/-- reduces all physical damage by 2." }],
  },
  {
    id: "arm_spined_shield", name: "Spined Shield", category: "armor", armorType: "shield",
    rarity: "uncommon", value: 5580, weight: 15, requiredLevel: 6, slot: "offhand",
    baseAC: 3, maxDexBonus: 99, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "A +1 heavy shield bristling with sharp iron spikes.",
    specialEffect: "+3 AC. Fire spines: ranged attack 120ft, 1d10+3 damage, 3/day.",
    actives: [{
      name: "Fire Spine", description: "Launch a spine: ranged attack, 1d10+3 piercing, 120ft range.",
      usesPerDay: 3, damage: "1d10+3", range: 120,
    }],
  },
  {
    id: "arm_darkwood_buckler", name: "Darkwood Buckler", category: "armor", armorType: "buckler",
    rarity: "common", value: 205, weight: 2.5, requiredLevel: 1, slot: "offhand",
    baseAC: 1, maxDexBonus: 99, armorCheckPenalty: 0, arcaneFailure: 5,
    description: "A small shield carved from rare darkwood — nearly weightless.",
    specialEffect: "+1 AC shield bonus. No armor check penalty.",
  },

  // ── Rare ──
  {
    id: "arm_dwarven_plate", name: "Dwarven Plate", category: "armor", armorType: "plate",
    rarity: "rare", value: 16500, weight: 45, requiredLevel: 10, slot: "body",
    baseAC: 11, maxDexBonus: 1, armorCheckPenalty: -5, arcaneFailure: 35,
    description: "Masterwork dwarven full plate of unmatched craftsmanship.",
    specialEffect: "+9 AC (+2 full plate). Dwarven-forged — never rusts. -5 check penalty.",
  },
  {
    id: "arm_banded_luck", name: "Banded Mail of Luck", category: "armor", armorType: "chainmail",
    rarity: "rare", value: 18900, weight: 35, requiredLevel: 10, slot: "body",
    baseAC: 9, maxDexBonus: 1, armorCheckPenalty: -6, arcaneFailure: 35,
    description: "Gem-studded +3 banded mail that bends fate around its wearer.",
    specialEffect: "+6 AC. Once per week: force an attack against you to be rerolled.",
    actives: [{
      name: "Luck Reroll", description: "Force one attack against you to be rerolled (1/week).",
      usesPerDay: 1,
    }],
  },
  {
    id: "arm_celestial", name: "Celestial Armor", category: "armor", armorType: "chainmail",
    rarity: "rare", value: 22400, weight: 20, requiredLevel: 10, slot: "body",
    baseAC: 8, maxDexBonus: 8, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "Bright silver +3 chainmail so fine it can be worn under clothing.",
    specialEffect: "+6 AC, +8 max DEX. Fly 1/day (5 minutes). Counts as light armor.",
    actives: [{
      name: "Fly", description: "Fly at 60ft speed for 5 minutes.",
      usesPerDay: 1,
    }],
    passives: [{ type: "flight", value: 60, description: "Fly 1/day for 5 minutes." }],
  },
  {
    id: "arm_plate_deep", name: "Plate Armor of the Deep", category: "armor", armorType: "plate",
    rarity: "rare", value: 24650, weight: 45, requiredLevel: 10, slot: "body",
    baseAC: 10, maxDexBonus: 1, armorCheckPenalty: -6, arcaneFailure: 35,
    description: "Blue-green +1 full plate decorated with aquatic motifs.",
    specialEffect: "+9 AC. Breathe underwater, swim 20ft, understand aquatic languages.",
    passives: [{ type: "waterbreathing", description: "Breathe and move freely underwater." }],
  },
  {
    id: "arm_breastplate_command", name: "Breastplate of Command", category: "armor", armorType: "breastplate",
    rarity: "rare", value: 25400, weight: 30, requiredLevel: 10, slot: "body",
    baseAC: 8, maxDexBonus: 3, armorCheckPenalty: -4, arcaneFailure: 25,
    description: "A finely crafted +2 breastplate radiating a commanding aura.",
    specialEffect: "+7 AC. +2 CHA checks. Allies within 360ft gain +1 morale vs fear.",
    statModifiers: [{ stat: "CHA", value: 2 }],
  },
  {
    id: "arm_lions_shield", name: "Lion's Shield", category: "armor", armorType: "shield",
    rarity: "rare", value: 9170, weight: 15, requiredLevel: 8, slot: "offhand",
    baseAC: 4, maxDexBonus: 99, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "A +2 heavy shield emblazoned with a roaring lion head.",
    specialEffect: "+4 AC. Lion's head bites once per round: +8 melee, 2d6+3 damage.",
    actives: [{
      name: "Lion Bite", description: "Lion head bites each round: +8 attack, 2d6+3 damage.",
      usesPerDay: -1,
    }],
  },
  {
    id: "arm_shield_reflection", name: "Shield of Spell Reflection", category: "armor", armorType: "shield",
    rarity: "rare", value: 25000, weight: 15, requiredLevel: 12, slot: "offhand",
    baseAC: 4, maxDexBonus: 99, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "A polished +3 heavy shield that reflects hostile spells back at their casters.",
    specialEffect: "+5 AC. 1/day: reflect a targeted spell back at the caster.",
    actives: [{
      name: "Spell Reflection", description: "Reflect one targeted spell back at the caster.",
      usesPerDay: 1,
    }],
    passives: [{ type: "reflect", value: 1, description: "Reflects one spell per day." }],
  },
  {
    id: "arm_winged_shield", name: "Winged Shield", category: "armor", armorType: "shield",
    rarity: "rare", value: 17257, weight: 10, requiredLevel: 10, slot: "offhand",
    baseAC: 5, maxDexBonus: 99, armorCheckPenalty: -1, arcaneFailure: 15,
    description: "A +3 heavy shield decorated with eagle wings that animate on command.",
    specialEffect: "+5 AC. Fly 60ft for 5 minutes, 1/day.",
    actives: [{
      name: "Fly", description: "Wings animate: fly 60ft (average) for 5 minutes.",
      usesPerDay: 1,
    }],
  },

  // ── Epic ──
  {
    id: "arm_demon_armor", name: "Demon Armor", category: "armor", armorType: "plate",
    rarity: "epic", value: 52260, weight: 50, requiredLevel: 15, slot: "body",
    baseAC: 13, maxDexBonus: 1, armorCheckPenalty: -6, arcaneFailure: 35,
    description: "Fiendish +4 full plate shaped like a snarling demon, granting claws.",
    specialEffect: "+12 AC. Claw attacks 1d10+1 each. Contagion 1/day. Evil aura.",
    actives: [{
      name: "Contagion", description: "Cast contagion on touch (Fort DC 16).",
      usesPerDay: 1, dc: 16,
    }],
  },
  {
    id: "arm_invulnerability", name: "Plate of Invulnerability", category: "armor", armorType: "plate",
    rarity: "epic", value: 60000, weight: 50, requiredLevel: 15, slot: "body",
    baseAC: 13, maxDexBonus: 1, armorCheckPenalty: -6, arcaneFailure: 35,
    description: "A +3 full plate of adamantine that renders its wearer nearly impervious.",
    specialEffect: "+12 AC. DR 5/-- (reduce all physical damage by 5). Immune to critical hits.",
    passives: [{ type: "resistance", value: 5, description: "DR 5/-- physical damage reduction." }],
  },
  {
    id: "arm_absorbing_shield", name: "Absorbing Shield", category: "armor", armorType: "shield",
    rarity: "epic", value: 50170, weight: 15, requiredLevel: 15, slot: "offhand",
    baseAC: 3, maxDexBonus: 99, armorCheckPenalty: -2, arcaneFailure: 15,
    description: "A +1 heavy shield that devours magical energy on contact.",
    specialEffect: "+3 AC. Absorb (disintegrate) one magic item per day on touch, no save.",
    actives: [{
      name: "Absorb Item", description: "Touch a magic item to permanently destroy it (1/day).",
      usesPerDay: 1,
    }],
  },

  // ── Legendary ──
  {
    id: "arm_dragon_scale_red", name: "Red Dragon Scale Mail", category: "armor", armorType: "half-plate",
    rarity: "legendary", value: 100000, weight: 35, requiredLevel: 18, slot: "body",
    baseAC: 12, maxDexBonus: 3, armorCheckPenalty: -3, arcaneFailure: 20,
    description: "Armor forged from the scales of an ancient red dragon, radiating furnace heat.",
    specialEffect: "+10 AC. Fire immunity. 1/day: breath weapon 12d6 fire (30ft cone, Ref DC 20).",
    resistances: [{ element: "fire", percent: 100 }],
    actives: [{
      name: "Fire Breath", description: "Breathe fire: 12d6 in 30ft cone (Reflex DC 20 half).",
      usesPerDay: 1, damage: "12d6", dc: 20, range: 30,
    }],
  },
  {
    id: "arm_robe_archmagi", name: "Robe of the Archmagi", category: "armor", armorType: "robes",
    rarity: "legendary", value: 75000, weight: 1, requiredLevel: 18, slot: "body",
    baseAC: 5, maxDexBonus: 99, armorCheckPenalty: 0, arcaneFailure: 0,
    description: "The supreme garment of arcane power, woven from pure magic itself.",
    specialEffect: "+5 AC. SR 18. +4 resistance saves. +2 caster level to overcome SR. No arcane failure.",
    passives: [{ type: "resistance", element: "force", value: 18, description: "Spell Resistance 18." }],
  },
  {
    id: "arm_ethereal_plate", name: "Ethereal Plate", category: "armor", armorType: "plate",
    rarity: "legendary", value: 120000, weight: 0, requiredLevel: 20, slot: "body",
    baseAC: 14, maxDexBonus: 4, armorCheckPenalty: 0, arcaneFailure: 0,
    description: "Armor that exists partially on the ethereal plane — weightless, invisible, impenetrable.",
    specialEffect: "+14 AC. Weightless. No penalties. 3/day: become ethereal for 1 round.",
    actives: [{
      name: "Ethereal Shift", description: "Become ethereal for 1 round (untouchable, can pass through walls).",
      usesPerDay: 3,
    }],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  RINGS (25 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_RINGS: MagicRing[] = [
  {
    id: "ring_protection_1", name: "Ring of Protection +1", category: "ring",
    rarity: "common", value: 2000, weight: 0, requiredLevel: 1, slot: "ring",
    description: "A silver ring inscribed with a minor ward of deflection.",
    specialEffect: "+1 deflection bonus to AC.",
  },
  {
    id: "ring_feather_falling", name: "Ring of Feather Falling", category: "ring",
    rarity: "common", value: 2200, weight: 0, requiredLevel: 1, slot: "ring",
    description: "A delicate silver ring set with a tiny white feather.",
    specialEffect: "Automatically activates feather fall when you fall more than 5ft.",
    passives: [{ type: "resistance", description: "Immune to falling damage." }],
  },
  {
    id: "ring_sustenance", name: "Ring of Sustenance", category: "ring",
    rarity: "common", value: 2500, weight: 0, requiredLevel: 1, slot: "ring",
    description: "A plain iron ring that hums with nourishing magic.",
    specialEffect: "No need for food or water. Only need 2 hours sleep per night.",
  },
  {
    id: "ring_climbing", name: "Ring of Climbing", category: "ring",
    rarity: "common", value: 2500, weight: 0, requiredLevel: 1, slot: "ring",
    description: "A rough stone ring carved with gecko motifs.",
    specialEffect: "+5 competence bonus to Climb checks.",
  },
  {
    id: "ring_swimming", name: "Ring of Swimming", category: "ring",
    rarity: "common", value: 2500, weight: 0, requiredLevel: 1, slot: "ring",
    description: "A blue-green ring shaped like a wave.",
    specialEffect: "+5 competence bonus to Swim checks.",
  },
  {
    id: "ring_protection_2", name: "Ring of Protection +2", category: "ring",
    rarity: "uncommon", value: 8000, weight: 0, requiredLevel: 5, slot: "ring",
    description: "A gold ring inscribed with a powerful ward of deflection.",
    specialEffect: "+2 deflection bonus to AC.",
  },
  {
    id: "ring_counterspells", name: "Ring of Counterspells", category: "ring",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "ring",
    description: "A ring with a hollow setting that can hold a spell.",
    specialEffect: "Store one spell; auto-counters that same spell when cast at you.",
  },
  {
    id: "ring_mind_shielding", name: "Ring of Mind Shielding", category: "ring",
    rarity: "uncommon", value: 8000, weight: 0, requiredLevel: 5, slot: "ring",
    description: "A dark metal ring that blocks mental intrusion.",
    specialEffect: "Immune to detect thoughts, discern lies, and alignment detection.",
    passives: [{ type: "immunity", element: "force", description: "Immune to mind-reading effects." }],
  },
  {
    id: "ring_force_shield", name: "Ring of Force Shield", category: "ring",
    rarity: "uncommon", value: 8500, weight: 0, requiredLevel: 5, slot: "ring",
    description: "A ring that projects a buckler-sized disc of shimmering force.",
    specialEffect: "+2 shield bonus to AC (activate/deactivate as free action).",
  },
  {
    id: "ring_ram", name: "Ring of the Ram", category: "ring",
    rarity: "uncommon", value: 8600, weight: 0, requiredLevel: 6, slot: "ring",
    description: "An iron ring shaped like a ram's head.",
    specialEffect: "50 charges. Ranged force attack: 1-3 charges for 1d6-3d6 force + bull rush.",
    actives: [{
      name: "Ram Strike", description: "Spend 1-3 charges for 1d6-3d6 force damage + knockback.",
      usesPerDay: 10, range: 60,
    }],
  },
  {
    id: "ring_energy_resist_minor", name: "Ring of Energy Resistance (Minor)", category: "ring",
    rarity: "uncommon", value: 12000, weight: 0, requiredLevel: 6, slot: "ring",
    description: "A ring set with a swirling elemental gemstone.",
    specialEffect: "Resist 10 against one energy type (fire, cold, acid, lightning, or sonic).",
    resistances: [{ element: "fire", percent: 25 }],
  },
  {
    id: "ring_protection_3", name: "Ring of Protection +3", category: "ring",
    rarity: "rare", value: 18000, weight: 0, requiredLevel: 10, slot: "ring",
    description: "A mithral ring blazing with deflection wards.",
    specialEffect: "+3 deflection bonus to AC.",
  },
  {
    id: "ring_invisibility", name: "Ring of Invisibility", category: "ring",
    rarity: "rare", value: 20000, weight: 0, requiredLevel: 10, slot: "ring",
    description: "A plain band that turns transparent when worn.",
    specialEffect: "Become invisible at will (as invisibility spell).",
    actives: [{
      name: "Invisibility", description: "Become invisible at will. Ends if you attack.",
      usesPerDay: -1,
    }],
    passives: [{ type: "stealth", value: 20, description: "Invisibility at will." }],
  },
  {
    id: "ring_evasion", name: "Ring of Evasion", category: "ring",
    rarity: "rare", value: 25000, weight: 0, requiredLevel: 10, slot: "ring",
    description: "A nimble mithral ring that glimmers with protective magic.",
    specialEffect: "Evasion: Reflex saves for half damage take no damage on success instead.",
  },
  {
    id: "ring_spell_storing_minor", name: "Ring of Minor Spell Storing", category: "ring",
    rarity: "rare", value: 18000, weight: 0, requiredLevel: 9, slot: "ring",
    description: "A ring with three tiny crystal chambers for holding spells.",
    specialEffect: "Store up to 3 levels of spells, cast them as if you cast them yourself.",
  },
  {
    id: "ring_water_walking", name: "Ring of Water Walking", category: "ring",
    rarity: "uncommon", value: 15000, weight: 0, requiredLevel: 7, slot: "ring",
    description: "A blue sapphire ring that repels water.",
    specialEffect: "Walk on water as if solid ground.",
    passives: [{ type: "waterbreathing", description: "Walk on water surfaces." }],
  },
  {
    id: "ring_xray_vision", name: "Ring of X-Ray Vision", category: "ring",
    rarity: "rare", value: 25000, weight: 0, requiredLevel: 10, slot: "ring",
    description: "A lead-rimmed ring with a crystalline lens.",
    specialEffect: "See through solid matter (1ft stone, 1in metal, 3ft wood) for 1 min/day.",
    actives: [{
      name: "X-Ray Vision", description: "See through walls for 1 minute per day.",
      usesPerDay: 1,
    }],
  },
  {
    id: "ring_protection_4", name: "Ring of Protection +4", category: "ring",
    rarity: "epic", value: 32000, weight: 0, requiredLevel: 13, slot: "ring",
    description: "An adamantine ring glowing with deflection magic.",
    specialEffect: "+4 deflection bonus to AC.",
  },
  {
    id: "ring_freedom_of_movement", name: "Ring of Freedom of Movement", category: "ring",
    rarity: "epic", value: 40000, weight: 0, requiredLevel: 14, slot: "ring",
    description: "A ring of interlocking bands that never tangle.",
    specialEffect: "Continuous freedom of movement — immune to paralysis, grapple, entangle, slow.",
    passives: [{ type: "immunity", description: "Immune to paralysis, grapple, entangle, slow." }],
  },
  {
    id: "ring_energy_resist_major", name: "Ring of Energy Resistance (Major)", category: "ring",
    rarity: "epic", value: 28000, weight: 0, requiredLevel: 13, slot: "ring",
    description: "A ring blazing with elemental energy.",
    specialEffect: "Resist 20 against one energy type.",
    resistances: [{ element: "fire", percent: 50 }],
  },
  {
    id: "ring_regeneration", name: "Ring of Regeneration", category: "ring",
    rarity: "epic", value: 90000, weight: 0, requiredLevel: 16, slot: "ring",
    description: "A living ring of green metal that pulses with vitality.",
    specialEffect: "Regenerate 1 HP per round. Regrow lost limbs in 1d7 days.",
    passives: [{ type: "regen", value: 1, description: "Regenerate 1 HP per round." }],
  },
  {
    id: "ring_spell_turning", name: "Ring of Spell Turning", category: "ring",
    rarity: "epic", value: 98280, weight: 0, requiredLevel: 16, slot: "ring",
    description: "A mirrored ring that reflects hostile magic.",
    specialEffect: "Reflects 1d4+6 spell levels back at caster per day.",
    passives: [{ type: "reflect", value: 10, description: "Reflects spells back at caster." }],
  },
  {
    id: "ring_protection_5", name: "Ring of Protection +5", category: "ring",
    rarity: "legendary", value: 50000, weight: 0, requiredLevel: 18, slot: "ring",
    description: "A legendary ring of absolute deflection.",
    specialEffect: "+5 deflection bonus to AC.",
  },
  {
    id: "ring_spell_storing", name: "Ring of Spell Storing", category: "ring",
    rarity: "legendary", value: 50000, weight: 0, requiredLevel: 18, slot: "ring",
    description: "A ring with five crystal chambers for storing magic.",
    specialEffect: "Store up to 5 levels of spells, cast them as if you cast them yourself.",
  },
  {
    id: "ring_three_wishes", name: "Ring of Three Wishes", category: "ring",
    rarity: "legendary", value: 97950, weight: 0, requiredLevel: 20, slot: "ring",
    description: "A golden ring with three rubies — each holding a miracle.",
    specialEffect: "Contains 3 wish spells. Each ruby dims when a wish is used.",
    actives: [{
      name: "Wish", description: "Cast Wish (3 total uses, consumed permanently).",
      usesPerDay: 1,
    }],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  AMULETS & NECKLACES (20 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_AMULETS: MagicAmulet[] = [
  {
    id: "amu_health_2", name: "Amulet of Health +2", category: "amulet",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "neck",
    description: "A jade amulet carved with a bear symbol.",
    specialEffect: "+2 enhancement bonus to Constitution.",
    statModifiers: [{ stat: "CON", value: 2 }],
  },
  {
    id: "amu_health_4", name: "Amulet of Health +4", category: "amulet",
    rarity: "rare", value: 16000, weight: 0, requiredLevel: 10, slot: "neck",
    description: "A powerful jade amulet radiating vitality.",
    specialEffect: "+4 enhancement bonus to Constitution.",
    statModifiers: [{ stat: "CON", value: 4 }],
  },
  {
    id: "amu_health_6", name: "Amulet of Health +6", category: "amulet",
    rarity: "epic", value: 36000, weight: 0, requiredLevel: 15, slot: "neck",
    description: "A legendary jade amulet of supreme vitality.",
    specialEffect: "+6 enhancement bonus to Constitution.",
    statModifiers: [{ stat: "CON", value: 6 }],
  },
  {
    id: "amu_nat_armor_1", name: "Amulet of Natural Armor +1", category: "amulet",
    rarity: "common", value: 2000, weight: 0, requiredLevel: 1, slot: "neck",
    description: "A bone amulet with druidic sigils that toughen the skin.",
    specialEffect: "+1 enhancement bonus to natural armor.",
  },
  {
    id: "amu_nat_armor_2", name: "Amulet of Natural Armor +2", category: "amulet",
    rarity: "uncommon", value: 8000, weight: 0, requiredLevel: 5, slot: "neck",
    description: "A bone amulet with stronger druidic sigils.",
    specialEffect: "+2 enhancement bonus to natural armor.",
  },
  {
    id: "amu_nat_armor_3", name: "Amulet of Natural Armor +3", category: "amulet",
    rarity: "rare", value: 18000, weight: 0, requiredLevel: 10, slot: "neck",
    description: "A bone amulet blazing with protective magic.",
    specialEffect: "+3 enhancement bonus to natural armor.",
  },
  {
    id: "amu_periapt_wisdom_2", name: "Periapt of Wisdom +2", category: "amulet",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "neck",
    description: "A blue pearl pendant that deepens insight.",
    specialEffect: "+2 enhancement bonus to Wisdom.",
    statModifiers: [{ stat: "WIS", value: 2 }],
  },
  {
    id: "amu_periapt_wisdom_4", name: "Periapt of Wisdom +4", category: "amulet",
    rarity: "rare", value: 16000, weight: 0, requiredLevel: 10, slot: "neck",
    description: "A deep blue pearl pendant of profound insight.",
    specialEffect: "+4 enhancement bonus to Wisdom.",
    statModifiers: [{ stat: "WIS", value: 4 }],
  },
  {
    id: "amu_necklace_fireballs", name: "Necklace of Fireballs", category: "amulet",
    rarity: "uncommon", value: 4350, weight: 1, requiredLevel: 6, slot: "neck",
    description: "A necklace strung with dull red beads that erupt into fireballs.",
    specialEffect: "5 beads: one 5d6, two 3d6, two 2d6 fireballs (Reflex DC 14).",
    actives: [{
      name: "Throw Bead", description: "Throw bead: fireball (damage varies by bead size). 5 total.",
      usesPerDay: 5, damage: "5d6", dc: 14, range: 150,
    }],
  },
  {
    id: "amu_proof_poison", name: "Periapt of Proof against Poison", category: "amulet",
    rarity: "rare", value: 27000, weight: 0, requiredLevel: 10, slot: "neck",
    description: "A gem pendant that neutralizes all toxins on contact.",
    specialEffect: "Immune to all poisons.",
    passives: [{ type: "immunity", element: "poison", description: "Immune to all poisons." }],
  },
  {
    id: "amu_periapt_health", name: "Periapt of Health", category: "amulet",
    rarity: "uncommon", value: 7400, weight: 0, requiredLevel: 6, slot: "neck",
    description: "A jade periapt that wards against disease.",
    specialEffect: "Immune to all diseases, including magical diseases.",
    passives: [{ type: "immunity", description: "Immune to all diseases." }],
  },
  {
    id: "amu_adaptation", name: "Necklace of Adaptation", category: "amulet",
    rarity: "rare", value: 9000, weight: 0, requiredLevel: 8, slot: "neck",
    description: "A leather necklace with a crystal that purifies air.",
    specialEffect: "Breathe normally in any environment — underwater, vacuum, poison gas.",
    passives: [{ type: "waterbreathing", description: "Breathe in any environment." }],
  },
  {
    id: "amu_proof_detection", name: "Amulet of Proof against Detection", category: "amulet",
    rarity: "epic", value: 35000, weight: 0, requiredLevel: 14, slot: "neck",
    description: "A black star sapphire amulet that hides you from all divination.",
    specialEffect: "Immune to scrying, locate creature, detect thoughts, and all divination.",
    passives: [{ type: "stealth", value: 30, description: "Immune to all divination magic." }],
  },
  {
    id: "amu_scarab_protection", name: "Scarab of Protection", category: "amulet",
    rarity: "epic", value: 38000, weight: 0, requiredLevel: 14, slot: "neck",
    description: "A golden scarab brooch that absorbs death magic.",
    specialEffect: "+3 resistance saves. Absorbs energy drain/death effects (12 charges).",
    passives: [{ type: "immunity", element: "necrotic", description: "Absorbs death effects (12 charges)." }],
  },
  {
    id: "amu_mighty_fists_1", name: "Amulet of Mighty Fists +1", category: "amulet",
    rarity: "common", value: 6000, weight: 0, requiredLevel: 3, slot: "neck",
    description: "A fist-shaped iron amulet that empowers unarmed strikes.",
    specialEffect: "+1 enhancement bonus to unarmed attack and damage.",
  },
  {
    id: "amu_mighty_fists_3", name: "Amulet of Mighty Fists +3", category: "amulet",
    rarity: "rare", value: 54000, weight: 0, requiredLevel: 12, slot: "neck",
    description: "A powerful amulet blazing with martial ki.",
    specialEffect: "+3 enhancement bonus to unarmed attack and damage.",
  },
  {
    id: "amu_brooch_shielding", name: "Brooch of Shielding", category: "amulet",
    rarity: "common", value: 1500, weight: 0, requiredLevel: 1, slot: "neck",
    description: "A silver brooch that absorbs magic missiles.",
    specialEffect: "Absorbs magic missiles (up to 101 points of force damage total).",
    resistances: [{ element: "force", percent: 100 }],
  },
  {
    id: "amu_medallion_thoughts", name: "Medallion of Thoughts", category: "amulet",
    rarity: "rare", value: 12000, weight: 1, requiredLevel: 8, slot: "neck",
    description: "A gold medallion etched with a third eye.",
    specialEffect: "Detect thoughts at will (Will DC 13). Read surface thoughts within 60ft.",
    actives: [{
      name: "Detect Thoughts", description: "Read surface thoughts within 60ft (Will DC 13 negates).",
      usesPerDay: -1, dc: 13, range: 60,
    }],
  },
  {
    id: "amu_nat_armor_5", name: "Amulet of Natural Armor +5", category: "amulet",
    rarity: "legendary", value: 50000, weight: 0, requiredLevel: 18, slot: "neck",
    description: "A legendary bone amulet of absolute natural defense.",
    specialEffect: "+5 enhancement bonus to natural armor.",
  },
  {
    id: "amu_hand_of_glory", name: "Hand of Glory", category: "amulet",
    rarity: "legendary", value: 60000, weight: 1, requiredLevel: 18, slot: "neck",
    description: "A mummified hand on a chain that grants an extra ring slot and powers.",
    specialEffect: "Wear a third ring. Daylight and see invisibility at will. Dimension door 1/day.",
    actives: [{
      name: "Dimension Door", description: "Teleport up to 400ft (1/day).",
      usesPerDay: 1, range: 400,
    }],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  POTIONS (30 items)
// ═══════════════════════════════════════════════════════════════════════��══════

export const MAGIC_POTIONS: MagicPotion[] = [
  {
    id: "pot_cure_light", name: "Potion of Cure Light Wounds", category: "potion",
    rarity: "common", value: 50, weight: 0.1, requiredLevel: 1, slot: "consumable",
    description: "A small vial of warm golden liquid.",
    specialEffect: "Heals 1d8+1 hit points.",
    healing: "1d8+1", duration: 0,
  },
  {
    id: "pot_cure_moderate", name: "Potion of Cure Moderate Wounds", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A larger vial of warm golden healing draught.",
    specialEffect: "Heals 2d8+3 hit points.",
    healing: "2d8+3", duration: 0,
  },
  {
    id: "pot_cure_serious", name: "Potion of Cure Serious Wounds", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A large vial of intensely radiant golden liquid.",
    specialEffect: "Heals 3d8+5 hit points.",
    healing: "3d8+5", duration: 0,
  },
  {
    id: "pot_cure_critical", name: "Potion of Cure Critical Wounds", category: "potion",
    rarity: "epic", value: 1400, weight: 0.1, requiredLevel: 7, slot: "consumable",
    description: "A crystal flask of blazing golden healing essence.",
    specialEffect: "Heals 4d8+7 hit points.",
    healing: "4d8+7", duration: 0,
  },
  {
    id: "pot_mage_armor", name: "Potion of Mage Armor", category: "potion",
    rarity: "common", value: 50, weight: 0.1, requiredLevel: 1, slot: "consumable",
    description: "A shimmering silver liquid that hardens into an invisible ward.",
    specialEffect: "+4 armor bonus to AC for 1 hour.",
    duration: 600,
  },
  {
    id: "pot_bulls_strength", name: "Potion of Bull's Strength", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A thick red liquid that makes muscles bulge.",
    specialEffect: "+4 enhancement bonus to Strength for 3 minutes.",
    statModifiers: [{ stat: "STR", value: 4 }], duration: 30,
  },
  {
    id: "pot_cats_grace", name: "Potion of Cat's Grace", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A lithe amber liquid that makes you light on your feet.",
    specialEffect: "+4 enhancement bonus to Dexterity for 3 minutes.",
    statModifiers: [{ stat: "DEX", value: 4 }], duration: 30,
  },
  {
    id: "pot_bears_endurance", name: "Potion of Bear's Endurance", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A thick brown tonic that toughens the body.",
    specialEffect: "+4 enhancement bonus to Constitution for 3 minutes.",
    statModifiers: [{ stat: "CON", value: 4 }], duration: 30,
  },
  {
    id: "pot_foxs_cunning", name: "Potion of Fox's Cunning", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A sharp-smelling orange liquid that clears the mind.",
    specialEffect: "+4 enhancement bonus to Intelligence for 3 minutes.",
    statModifiers: [{ stat: "INT", value: 4 }], duration: 30,
  },
  {
    id: "pot_owls_wisdom", name: "Potion of Owl's Wisdom", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A dark potion with the scent of old incense.",
    specialEffect: "+4 enhancement bonus to Wisdom for 3 minutes.",
    statModifiers: [{ stat: "WIS", value: 4 }], duration: 30,
  },
  {
    id: "pot_eagles_splendor", name: "Potion of Eagle's Splendor", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A liquid that gleams like polished gold.",
    specialEffect: "+4 enhancement bonus to Charisma for 3 minutes.",
    statModifiers: [{ stat: "CHA", value: 4 }], duration: 30,
  },
  {
    id: "pot_invisibility", name: "Potion of Invisibility", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A clear liquid that turns transparent on your tongue.",
    specialEffect: "Invisible for 3 minutes or until you attack.",
    duration: 30,
  },
  {
    id: "pot_haste", name: "Potion of Haste", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A vibrating red elixir that makes the world slow down.",
    specialEffect: "+1 attack, +30ft speed, +1 AC, extra attack per round for 5 rounds.",
    duration: 5,
  },
  {
    id: "pot_fly", name: "Potion of Fly", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A pale blue potion with tiny clouds swirling inside.",
    specialEffect: "Fly at 60ft speed for 5 minutes.",
    duration: 50,
  },
  {
    id: "pot_heroism", name: "Potion of Heroism", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A bold crimson draught that fills you with unshakable confidence.",
    specialEffect: "+2 morale bonus on attack rolls, saves, and skill checks for 50 minutes.",
    duration: 500,
  },
  {
    id: "pot_displacement", name: "Potion of Displacement", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A shimmering liquid that bends light around you.",
    specialEffect: "50% miss chance (as displacement spell) for 5 rounds.",
    duration: 5,
  },
  {
    id: "pot_barkskin", name: "Potion of Barkskin", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A thick brown liquid that toughens skin to bark.",
    specialEffect: "+2 enhancement bonus to natural armor for 30 minutes.",
    duration: 300,
  },
  {
    id: "pot_darkvision", name: "Potion of Darkvision", category: "potion",
    rarity: "common", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "An inky black liquid that makes eyes gleam in darkness.",
    specialEffect: "See 60ft in total darkness for 3 hours.",
    duration: 1800,
  },
  {
    id: "pot_resist_fire", name: "Potion of Fire Resistance", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A red liquid with dancing sparks inside.",
    specialEffect: "Resist 10 fire damage for 30 minutes.",
    resistances: [{ element: "fire", percent: 25 }], duration: 300,
  },
  {
    id: "pot_resist_cold", name: "Potion of Cold Resistance", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A blue potion rimed with frost at the mouth.",
    specialEffect: "Resist 10 cold damage for 30 minutes.",
    resistances: [{ element: "cold", percent: 25 }], duration: 300,
  },
  {
    id: "pot_neutralize_poison", name: "Potion of Neutralize Poison", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A green elixir that purges all toxins from the body.",
    specialEffect: "Detoxifies all poisons. Cures poisoned conditions.",
    duration: 0,
  },
  {
    id: "pot_gaseous_form", name: "Potion of Gaseous Form", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A wispy grey liquid that dissolves on contact with air.",
    specialEffect: "Become insubstantial mist for 5 minutes. DR 10/magic, fly 10ft.",
    duration: 50,
  },
  {
    id: "pot_giant_strength", name: "Potion of Giant Strength", category: "potion",
    rarity: "rare", value: 900, weight: 0.1, requiredLevel: 6, slot: "consumable",
    description: "A viscous green liquid that swells muscles to grotesque proportions.",
    specialEffect: "+6 enhancement bonus to Strength for 3 minutes.",
    statModifiers: [{ stat: "STR", value: 6 }], duration: 30,
  },
  {
    id: "pot_fire_breath", name: "Potion of Fire Breath", category: "potion",
    rarity: "uncommon", value: 1100, weight: 0.1, requiredLevel: 4, slot: "consumable",
    description: "A fiery red elixir that makes your breath explosive.",
    specialEffect: "Breathe fire: 4d6 in 25ft cone (Reflex DC 13 half). 3 uses.",
    duration: 0,
  },
  {
    id: "pot_water_breathing", name: "Potion of Water Breathing", category: "potion",
    rarity: "common", value: 750, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A briny blue potion that lets you breathe underwater.",
    specialEffect: "Breathe water freely for 50 minutes.",
    duration: 500,
  },
  {
    id: "pot_spider_climb", name: "Potion of Spider Climb", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A sticky grey potion that makes your hands adhere to surfaces.",
    specialEffect: "Climb walls and ceilings at full speed for 30 minutes.",
    duration: 300,
  },
  {
    id: "pot_protection_evil", name: "Potion of Protection from Evil", category: "potion",
    rarity: "common", value: 50, weight: 0.1, requiredLevel: 1, slot: "consumable",
    description: "A silver-flecked elixir that wards against dark forces.",
    specialEffect: "+2 deflection AC, +2 resistance saves vs. evil creatures for 1 minute.",
    duration: 10,
  },
  {
    id: "pot_restoration", name: "Potion of Lesser Restoration", category: "potion",
    rarity: "uncommon", value: 300, weight: 0.1, requiredLevel: 3, slot: "consumable",
    description: "A sparkling white elixir of renewal.",
    specialEffect: "Dispels 1d4 points of ability damage.",
    duration: 0,
  },
  {
    id: "pot_rage", name: "Potion of Rage", category: "potion",
    rarity: "rare", value: 750, weight: 0.1, requiredLevel: 5, slot: "consumable",
    description: "A frothing red berserker's draught.",
    specialEffect: "+2 STR, +2 CON, +1 Will saves, -2 AC for 5 rounds.",
    statModifiers: [{ stat: "STR", value: 2 }, { stat: "CON", value: 2 }], duration: 5,
  },
  {
    id: "pot_stoneskin", name: "Potion of Stoneskin", category: "potion",
    rarity: "epic", value: 1500, weight: 0.1, requiredLevel: 8, slot: "consumable",
    description: "A liquid stone potion that hardens the skin to granite.",
    specialEffect: "DR 10/adamantine, absorbs up to 100 points of damage.",
    duration: 100,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  SCROLLS (25 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_SCROLLS: MagicScroll[] = [
  {
    id: "scr_magic_missile", name: "Scroll of Magic Missile", category: "scroll",
    rarity: "common", value: 25, weight: 0, requiredLevel: 1, slot: "consumable",
    spellLevel: 1, casterLevel: 1,
    description: "A scroll inscribed with glowing arcane arrows.",
    specialEffect: "1d4+1 force damage (auto-hit). Single use.",
  },
  {
    id: "scr_mage_armor", name: "Scroll of Mage Armor", category: "scroll",
    rarity: "common", value: 25, weight: 0, requiredLevel: 1, slot: "consumable",
    spellLevel: 1, casterLevel: 1,
    description: "A scroll inscribed with a shimmering ward formula.",
    specialEffect: "+4 armor bonus to AC for 1 hour. Single use.",
  },
  {
    id: "scr_sleep", name: "Scroll of Sleep", category: "scroll",
    rarity: "common", value: 25, weight: 0, requiredLevel: 1, slot: "consumable",
    spellLevel: 1, casterLevel: 1,
    description: "A scroll written in drowsy, curving script.",
    specialEffect: "4 HD of creatures fall asleep (Will negates). Single use.",
  },
  {
    id: "scr_burning_hands", name: "Scroll of Burning Hands", category: "scroll",
    rarity: "common", value: 25, weight: 0, requiredLevel: 1, slot: "consumable",
    spellLevel: 1, casterLevel: 1,
    description: "A scroll that smolders faintly at the edges.",
    specialEffect: "1d4 fire in 15ft cone (Reflex DC 11 half). Single use.",
  },
  {
    id: "scr_shield", name: "Scroll of Shield", category: "scroll",
    rarity: "common", value: 25, weight: 0, requiredLevel: 1, slot: "consumable",
    spellLevel: 1, casterLevel: 1,
    description: "A scroll edged with a faint blue glow.",
    specialEffect: "+4 shield bonus to AC for 1 minute. Blocks magic missiles. Single use.",
  },
  {
    id: "scr_bulls_strength", name: "Scroll of Bull's Strength", category: "scroll",
    rarity: "uncommon", value: 150, weight: 0, requiredLevel: 3, slot: "consumable",
    spellLevel: 2, casterLevel: 3,
    description: "A scroll penned in bold, forceful strokes.",
    specialEffect: "+4 STR for 3 minutes. Single use.",
  },
  {
    id: "scr_invisibility", name: "Scroll of Invisibility", category: "scroll",
    rarity: "uncommon", value: 150, weight: 0, requiredLevel: 3, slot: "consumable",
    spellLevel: 2, casterLevel: 3,
    description: "A scroll written in invisible ink.",
    specialEffect: "Invisible for 3 min or until attacking. Single use.",
  },
  {
    id: "scr_scorching_ray", name: "Scroll of Scorching Ray", category: "scroll",
    rarity: "uncommon", value: 150, weight: 0, requiredLevel: 3, slot: "consumable",
    spellLevel: 2, casterLevel: 3,
    description: "A scroll that radiates warmth when touched.",
    specialEffect: "Ranged touch: 4d6 fire damage. Single use.",
  },
  {
    id: "scr_web", name: "Scroll of Web", category: "scroll",
    rarity: "uncommon", value: 150, weight: 0, requiredLevel: 3, slot: "consumable",
    spellLevel: 2, casterLevel: 3,
    description: "A scroll with sticky fibers woven into the parchment.",
    specialEffect: "20ft radius sticky web (Reflex DC 13 or stuck). Single use.",
  },
  {
    id: "scr_mirror_image", name: "Scroll of Mirror Image", category: "scroll",
    rarity: "uncommon", value: 150, weight: 0, requiredLevel: 3, slot: "consumable",
    spellLevel: 2, casterLevel: 3,
    description: "A scroll that shimmers with duplicate reflections.",
    specialEffect: "Create 1d4+1 illusory duplicates for 3 minutes. Single use.",
  },
  {
    id: "scr_fireball", name: "Scroll of Fireball", category: "scroll",
    rarity: "rare", value: 375, weight: 0, requiredLevel: 5, slot: "consumable",
    spellLevel: 3, casterLevel: 5,
    description: "A scroll that flickers with inner flame.",
    specialEffect: "5d6 fire in 20ft radius (Reflex DC 14 half). Single use.",
  },
  {
    id: "scr_lightning_bolt", name: "Scroll of Lightning Bolt", category: "scroll",
    rarity: "rare", value: 375, weight: 0, requiredLevel: 5, slot: "consumable",
    spellLevel: 3, casterLevel: 5,
    description: "A scroll crackling with static electricity.",
    specialEffect: "5d6 lightning in 120ft line (Reflex DC 14 half). Single use.",
  },
  {
    id: "scr_haste", name: "Scroll of Haste", category: "scroll",
    rarity: "rare", value: 375, weight: 0, requiredLevel: 5, slot: "consumable",
    spellLevel: 3, casterLevel: 5,
    description: "A scroll humming with barely contained energy.",
    specialEffect: "+1 attack, +30ft speed, extra attack for 5 rounds. Single use.",
  },
  {
    id: "scr_dispel_magic", name: "Scroll of Dispel Magic", category: "scroll",
    rarity: "rare", value: 375, weight: 0, requiredLevel: 5, slot: "consumable",
    spellLevel: 3, casterLevel: 5,
    description: "A scroll of unraveling script.",
    specialEffect: "Targeted or area dispel (d20+5 vs DC 11+CL). Single use.",
  },
  {
    id: "scr_fly", name: "Scroll of Fly", category: "scroll",
    rarity: "rare", value: 375, weight: 0, requiredLevel: 5, slot: "consumable",
    spellLevel: 3, casterLevel: 5,
    description: "A scroll with feathery sigils that flutter in still air.",
    specialEffect: "Fly at 60ft speed for 5 minutes. Single use.",
  },
  {
    id: "scr_stoneskin", name: "Scroll of Stoneskin", category: "scroll",
    rarity: "epic", value: 700, weight: 0, requiredLevel: 7, slot: "consumable",
    spellLevel: 4, casterLevel: 7,
    description: "A scroll inscribed on granite-grey parchment.",
    specialEffect: "DR 10/adamantine, absorbs 70 damage. Single use.",
  },
  {
    id: "scr_dimension_door", name: "Scroll of Dimension Door", category: "scroll",
    rarity: "epic", value: 700, weight: 0, requiredLevel: 7, slot: "consumable",
    spellLevel: 4, casterLevel: 7,
    description: "A scroll that folds space when read.",
    specialEffect: "Teleport up to 680ft. Single use.",
  },
  {
    id: "scr_wall_of_fire", name: "Scroll of Wall of Fire", category: "scroll",
    rarity: "epic", value: 700, weight: 0, requiredLevel: 7, slot: "consumable",
    spellLevel: 4, casterLevel: 7,
    description: "A scroll that burns with inner flame when unrolled.",
    specialEffect: "Creates fire wall: 2d4 within 10ft, 1d4 within 20ft. Single use.",
  },
  {
    id: "scr_cloudkill", name: "Scroll of Cloudkill", category: "scroll",
    rarity: "epic", value: 1125, weight: 0, requiredLevel: 9, slot: "consumable",
    spellLevel: 5, casterLevel: 9,
    description: "A scroll reeking of chemical death.",
    specialEffect: "20ft cloud of poison: kills 3 HD or less, 1d4 CON to 4-6 HD (Fort negates). Single use.",
  },
  {
    id: "scr_teleport", name: "Scroll of Teleport", category: "scroll",
    rarity: "epic", value: 1125, weight: 0, requiredLevel: 9, slot: "consumable",
    spellLevel: 5, casterLevel: 9,
    description: "A scroll inscribed with spatial coordinates.",
    specialEffect: "Teleport to any known location on same plane. Single use.",
  },
  {
    id: "scr_raise_dead", name: "Scroll of Raise Dead", category: "scroll",
    rarity: "epic", value: 6125, weight: 0, requiredLevel: 9, slot: "consumable",
    spellLevel: 5, casterLevel: 9,
    description: "A holy scroll radiating divine power.",
    specialEffect: "Raise one dead creature (dead no more than 5 days). -1 level. Single use.",
  },
  {
    id: "scr_disintegrate", name: "Scroll of Disintegrate", category: "scroll",
    rarity: "legendary", value: 1650, weight: 0, requiredLevel: 11, slot: "consumable",
    spellLevel: 6, casterLevel: 11,
    description: "A scroll of absolute destruction.",
    specialEffect: "Ranged touch: 22d6 damage (Fort DC 19: 5d6 instead). Single use.",
  },
  {
    id: "scr_heal", name: "Scroll of Heal", category: "scroll",
    rarity: "legendary", value: 1650, weight: 0, requiredLevel: 11, slot: "consumable",
    spellLevel: 6, casterLevel: 11,
    description: "A scroll blazing with divine restoration.",
    specialEffect: "Heals 150 HP. Cures all conditions except death. Single use.",
  },
  {
    id: "scr_resurrection", name: "Scroll of Resurrection", category: "scroll",
    rarity: "legendary", value: 12275, weight: 0, requiredLevel: 13, slot: "consumable",
    spellLevel: 7, casterLevel: 13,
    description: "A golden scroll of supreme divine power.",
    specialEffect: "Raise dead (any time since death). Full HP. No level loss. Single use.",
  },
  {
    id: "scr_power_word_kill", name: "Scroll of Power Word Kill", category: "scroll",
    rarity: "legendary", value: 3825, weight: 0, requiredLevel: 17, slot: "consumable",
    spellLevel: 9, casterLevel: 17,
    description: "A scroll inscribed with a single terrible word.",
    specialEffect: "Instantly kill one creature with 100 HP or less (no save). Single use.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  WONDROUS ITEMS (30 items)
// ══════════════════════════════════════════════════════════════════════════════

export const MAGIC_WONDROUS: MagicWondrous[] = [
  // ── Boots ──
  {
    id: "won_boots_speed", name: "Boots of Speed", category: "wondrous", wondrousSlot: "feet",
    rarity: "rare", value: 12000, weight: 1, requiredLevel: 8, slot: "feet",
    description: "Red leather boots that blur with each step.",
    specialEffect: "10 rounds/day: activate haste (+1 attack, +30ft speed, +1 AC, extra attack).",
    actives: [{
      name: "Haste", description: "Activate haste for 1 round (10 rounds/day total).",
      usesPerDay: 10,
    }],
  },
  {
    id: "won_boots_elvenkind", name: "Boots of Elvenkind", category: "wondrous", wondrousSlot: "feet",
    rarity: "uncommon", value: 2500, weight: 1, requiredLevel: 3, slot: "feet",
    description: "Soft leather boots that make no sound.",
    specialEffect: "+5 competence bonus on Move Silently checks.",
    passives: [{ type: "stealth", value: 5, description: "+5 Move Silently." }],
  },
  {
    id: "won_boots_striding", name: "Boots of Striding and Springing", category: "wondrous", wondrousSlot: "feet",
    rarity: "uncommon", value: 5500, weight: 1, requiredLevel: 5, slot: "feet",
    description: "Sturdy boots that propel each step with magical energy.",
    specialEffect: "+10ft enhancement bonus to land speed. +5 Jump checks.",
  },
  {
    id: "won_boots_levitation", name: "Boots of Levitation", category: "wondrous", wondrousSlot: "feet",
    rarity: "rare", value: 7500, weight: 1, requiredLevel: 7, slot: "feet",
    description: "Boots that let you walk on air.",
    specialEffect: "Levitate at will — rise/descend 20ft per round.",
    passives: [{ type: "flight", value: 20, description: "Levitate at will." }],
  },
  {
    id: "won_boots_teleportation", name: "Boots of Teleportation", category: "wondrous", wondrousSlot: "feet",
    rarity: "legendary", value: 49000, weight: 3, requiredLevel: 14, slot: "feet",
    description: "Sleek boots that fold space.",
    specialEffect: "Teleport (self only) 3/day — anywhere on the same plane.",
    actives: [{
      name: "Teleport", description: "Teleport to any known location (3/day).",
      usesPerDay: 3,
    }],
  },

  // ── Cloaks ──
  {
    id: "won_cloak_resistance_1", name: "Cloak of Resistance +1", category: "wondrous", wondrousSlot: "back",
    rarity: "common", value: 1000, weight: 1, requiredLevel: 1, slot: "back",
    description: "A grey cloak with a shimmer of protection.",
    specialEffect: "+1 resistance bonus to all saving throws.",
  },
  {
    id: "won_cloak_elvenkind", name: "Cloak of Elvenkind", category: "wondrous", wondrousSlot: "back",
    rarity: "uncommon", value: 2500, weight: 1, requiredLevel: 3, slot: "back",
    description: "A grey-green cloak that shifts to match surroundings.",
    specialEffect: "+5 competence bonus on Hide checks.",
    passives: [{ type: "stealth", value: 5, description: "+5 Hide." }],
  },
  {
    id: "won_cloak_resistance_3", name: "Cloak of Resistance +3", category: "wondrous", wondrousSlot: "back",
    rarity: "rare", value: 9000, weight: 1, requiredLevel: 8, slot: "back",
    description: "A deep grey cloak with powerful protective weave.",
    specialEffect: "+3 resistance bonus to all saving throws.",
  },
  {
    id: "won_cloak_displacement", name: "Cloak of Displacement", category: "wondrous", wondrousSlot: "back",
    rarity: "rare", value: 24000, weight: 1, requiredLevel: 10, slot: "back",
    description: "A shimmering cloak that blurs your outline.",
    specialEffect: "20% miss chance against all attacks (as blur, continuously).",
  },
  {
    id: "won_cloak_arachnida", name: "Cloak of Arachnida", category: "wondrous", wondrousSlot: "back",
    rarity: "rare", value: 14000, weight: 1, requiredLevel: 8, slot: "back",
    description: "A black cloak sewn from giant spider silk.",
    specialEffect: "Spider climb at will. Immune to web spells. Web 1/day.",
    passives: [{ type: "resistance", description: "Immune to web effects. Spider climb at will." }],
  },
  {
    id: "won_cloak_bat", name: "Cloak of the Bat", category: "wondrous", wondrousSlot: "back",
    rarity: "epic", value: 26000, weight: 1, requiredLevel: 12, slot: "back",
    description: "A black bat-wing cloak that grants flight in darkness.",
    specialEffect: "+5 Hide in dim light. Fly 40ft in darkness. Hang from ceiling.",
    passives: [{ type: "flight", value: 40, description: "Fly 40ft in darkness." }],
  },
  {
    id: "won_wings_flying", name: "Wings of Flying", category: "wondrous", wondrousSlot: "back",
    rarity: "legendary", value: 54000, weight: 2, requiredLevel: 14, slot: "back",
    description: "A pair of silver-feathered wings that unfurl from a cloak.",
    specialEffect: "Fly at 60ft speed (good maneuverability) at will.",
    passives: [{ type: "flight", value: 60, description: "Fly 60ft at will." }],
  },

  // ── Gloves/Gauntlets ──
  {
    id: "won_gauntlets_ogre", name: "Gauntlets of Ogre Power", category: "wondrous", wondrousSlot: "hands",
    rarity: "uncommon", value: 4000, weight: 4, requiredLevel: 5, slot: "hands",
    description: "Massive iron gauntlets that grant inhuman strength.",
    specialEffect: "+2 enhancement bonus to Strength.",
    statModifiers: [{ stat: "STR", value: 2 }],
  },
  {
    id: "won_gloves_dexterity_2", name: "Gloves of Dexterity +2", category: "wondrous", wondrousSlot: "hands",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "hands",
    description: "Supple leather gloves that make your fingers lightning-fast.",
    specialEffect: "+2 enhancement bonus to Dexterity.",
    statModifiers: [{ stat: "DEX", value: 2 }],
  },
  {
    id: "won_gloves_dexterity_4", name: "Gloves of Dexterity +4", category: "wondrous", wondrousSlot: "hands",
    rarity: "rare", value: 16000, weight: 0, requiredLevel: 10, slot: "hands",
    description: "Supple mithral-thread gloves of extraordinary agility.",
    specialEffect: "+4 enhancement bonus to Dexterity.",
    statModifiers: [{ stat: "DEX", value: 4 }],
  },
  {
    id: "won_gloves_arrow_snaring", name: "Gloves of Arrow Snaring", category: "wondrous", wondrousSlot: "hands",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "hands",
    description: "Leather gloves with tiny magnets woven in.",
    specialEffect: "1/round: snatch a ranged attack out of the air (as free action).",
  },
  {
    id: "won_gauntlets_str_4", name: "Gauntlets of Giant Strength +4", category: "wondrous", wondrousSlot: "hands",
    rarity: "rare", value: 16000, weight: 4, requiredLevel: 10, slot: "hands",
    description: "Heavy gauntlets of ogre hide radiating raw power.",
    specialEffect: "+4 enhancement bonus to Strength.",
    statModifiers: [{ stat: "STR", value: 4 }],
  },

  // ── Headgear ──
  {
    id: "won_headband_intellect_2", name: "Headband of Intellect +2", category: "wondrous", wondrousSlot: "head",
    rarity: "uncommon", value: 4000, weight: 0, requiredLevel: 5, slot: "head",
    description: "A silver circlet that sharpens the mind.",
    specialEffect: "+2 enhancement bonus to Intelligence.",
    statModifiers: [{ stat: "INT", value: 2 }],
  },
  {
    id: "won_headband_intellect_4", name: "Headband of Intellect +4", category: "wondrous", wondrousSlot: "head",
    rarity: "rare", value: 16000, weight: 0, requiredLevel: 10, slot: "head",
    description: "A platinum circlet pulsing with mental energy.",
    specialEffect: "+4 enhancement bonus to Intelligence.",
    statModifiers: [{ stat: "INT", value: 4 }],
  },
  {
    id: "won_hat_disguise", name: "Hat of Disguise", category: "wondrous", wondrousSlot: "head",
    rarity: "common", value: 1800, weight: 0, requiredLevel: 2, slot: "head",
    description: "A nondescript hat that changes your appearance at will.",
    specialEffect: "Disguise self at will (+10 Disguise).",
    passives: [{ type: "stealth", value: 10, description: "Disguise self at will." }],
  },
  {
    id: "won_helm_telepathy", name: "Helm of Telepathy", category: "wondrous", wondrousSlot: "head",
    rarity: "rare", value: 27000, weight: 3, requiredLevel: 10, slot: "head",
    description: "A copper helm that reads and projects thoughts.",
    specialEffect: "Detect thoughts at will. Suggestion 1/day (Will DC 14).",
    actives: [{
      name: "Suggestion", description: "Implant a suggestion in one creature (Will DC 14).",
      usesPerDay: 1, dc: 14, range: 60,
    }],
  },
  {
    id: "won_goggles_night", name: "Goggles of Night", category: "wondrous", wondrousSlot: "head",
    rarity: "uncommon", value: 12000, weight: 0, requiredLevel: 6, slot: "head",
    description: "Dark lenses that grant supernatural vision in darkness.",
    specialEffect: "Darkvision 60ft.",
    passives: [{ type: "darkvision", value: 60, description: "See in total darkness to 60ft." }],
  },
  {
    id: "won_helm_brilliance", name: "Helm of Brilliance", category: "wondrous", wondrousSlot: "head",
    rarity: "legendary", value: 125000, weight: 3, requiredLevel: 18, slot: "head",
    description: "A crown-like helm set with 10 diamonds, 20 rubies, 30 fire opals, and 40 opals.",
    specialEffect: "Gems cast spells (prismatic spray, wall of fire, fireball, daylight). Fire resist 30. Flaming weapon.",
    resistances: [{ element: "fire", percent: 75 }],
  },

  // ── Belt ──
  {
    id: "won_belt_dwarvenkind", name: "Belt of Dwarvenkind", category: "wondrous", wondrousSlot: "belt",
    rarity: "rare", value: 14900, weight: 1, requiredLevel: 8, slot: "belt",
    description: "A thick belt of golden links with a gem clasp.",
    specialEffect: "+2 CON, darkvision 60ft, +2 saves vs. poison/spells.",
    statModifiers: [{ stat: "CON", value: 2 }],
    passives: [{ type: "darkvision", value: 60, description: "Darkvision 60ft." }],
  },
  {
    id: "won_belt_giant_str_6", name: "Belt of Giant Strength +6", category: "wondrous", wondrousSlot: "belt",
    rarity: "legendary", value: 36000, weight: 1, requiredLevel: 14, slot: "belt",
    description: "A titanic belt of storm giant hide radiating raw power.",
    specialEffect: "+6 enhancement bonus to Strength.",
    statModifiers: [{ stat: "STR", value: 6 }],
  },

  // ── Misc Wondrous ──
  {
    id: "won_bag_holding_1", name: "Bag of Holding (Type I)", category: "wondrous", wondrousSlot: "none",
    rarity: "uncommon", value: 2500, weight: 15, requiredLevel: 3, slot: "none",
    description: "A cloth sack that holds far more than possible.",
    specialEffect: "Holds 250 lbs / 30 cubic ft. Always weighs 15 lbs.",
  },
  {
    id: "won_handy_haversack", name: "Handy Haversack", category: "wondrous", wondrousSlot: "none",
    rarity: "uncommon", value: 2000, weight: 5, requiredLevel: 3, slot: "none",
    description: "A well-made leather backpack bigger on the inside.",
    specialEffect: "Holds 120 lbs total. Always weighs 5 lbs. Always find what you reach for.",
  },
  {
    id: "won_portable_hole", name: "Portable Hole", category: "wondrous", wondrousSlot: "none",
    rarity: "epic", value: 20000, weight: 0, requiredLevel: 12, slot: "none",
    description: "A circle of cloth that opens into a 10ft deep extradimensional space.",
    specialEffect: "6ft wide, 10ft deep hole. Holds 280 cubic ft. Folds up flat.",
  },
  {
    id: "won_stone_good_luck", name: "Stone of Good Luck (Luckstone)", category: "wondrous", wondrousSlot: "none",
    rarity: "rare", value: 20000, weight: 0, requiredLevel: 8, slot: "none",
    description: "A small, unremarkable stone that bends probability in your favor.",
    specialEffect: "+1 luck bonus on saving throws, ability checks, and skill checks.",
  },
  {
    id: "won_decanter_water", name: "Decanter of Endless Water", category: "wondrous", wondrousSlot: "none",
    rarity: "uncommon", value: 9000, weight: 2, requiredLevel: 5, slot: "none",
    description: "A stoppered flask that pours infinite fresh water.",
    specialEffect: "Stream (1 gal/round), fountain (5 gal/round), or geyser (30 gal + bull rush DC 15).",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//  ITEM SETS (5 sets, 3-4 pieces each)
// ══════════════════════════════════════════════════════════════════════════════

export type ItemSet = {
  id: string;
  name: string;
  description: string;
  pieces: string[]; // item ids
  bonuses: SetBonus[];
};

export type SetBonus = {
  piecesRequired: number;
  description: string;
  statModifiers?: StatModifier[];
  specialEffect?: string;
};

export const ITEM_SETS: ItemSet[] = [
  {
    id: "set_shadow_dancer",
    name: "Shadow Dancer's Regalia",
    description: "Worn by the legendary assassin Kael Duskblade, these items bend shadow around the wearer.",
    pieces: ["set_shadow_cloak", "set_shadow_boots", "set_shadow_gloves", "set_shadow_dagger"],
    bonuses: [
      { piecesRequired: 2, description: "+5 bonus to Hide and Move Silently checks.", specialEffect: "+5 stealth" },
      { piecesRequired: 3, description: "Gain permanent concealment (20% miss chance).", specialEffect: "20% miss chance" },
      { piecesRequired: 4, description: "Shadow Step: teleport through shadows 60ft, 3/day.", specialEffect: "Shadow Step 3/day" },
    ],
  },
  {
    id: "set_iron_warden",
    name: "Iron Warden's Bulwark",
    description: "Forged in the deepforges of Bhalanur, this set makes its wearer an unbreakable wall.",
    pieces: ["set_warden_plate", "set_warden_shield", "set_warden_helm"],
    bonuses: [
      { piecesRequired: 2, description: "+2 bonus to AC and saving throws vs. spells.", specialEffect: "+2 AC/saves vs spells" },
      { piecesRequired: 3, description: "DR 5/-- and immunity to knockback/trip.", specialEffect: "DR 5/-- + no knockdown", statModifiers: [{ stat: "CON", value: 2 }] },
    ],
  },
  {
    id: "set_storm_caller",
    name: "Storm Caller's Vestments",
    description: "Blessed by the sea-god Namaris, crackling with the fury of the tempest.",
    pieces: ["set_storm_staff", "set_storm_robes", "set_storm_circlet", "set_storm_ring"],
    bonuses: [
      { piecesRequired: 2, description: "+2 bonus to spell DCs for lightning/cold spells.", specialEffect: "+2 DC lightning/cold" },
      { piecesRequired: 3, description: "Lightning resistance 20. +4 INT.", statModifiers: [{ stat: "INT", value: 4 }], specialEffect: "Lightning resist 20" },
      { piecesRequired: 4, description: "Call Lightning Storm: 10d6 lightning, 3/day (no save on crit).", specialEffect: "Call Lightning Storm 3/day" },
    ],
  },
  {
    id: "set_beast_lord",
    name: "Beast Lord's Raiment",
    description: "Trophies taken from the most fearsome monsters of the wild, granting primal power.",
    pieces: ["set_beast_hide", "set_beast_claws", "set_beast_helm"],
    bonuses: [
      { piecesRequired: 2, description: "+4 bonus to STR and natural armor +2.", statModifiers: [{ stat: "STR", value: 4 }], specialEffect: "+2 natural armor" },
      { piecesRequired: 3, description: "Gain Scent ability, Pounce (full attack on charge), +30ft speed.", specialEffect: "Scent + Pounce + 30ft speed" },
    ],
  },
  {
    id: "set_divine_herald",
    name: "Divine Herald's Vestments",
    description: "Sacred relics gifted by the High Luminar to his chosen champion.",
    pieces: ["set_herald_mace", "set_herald_armor", "set_herald_shield", "set_herald_crown"],
    bonuses: [
      { piecesRequired: 2, description: "All healing spells heal +50%.", specialEffect: "+50% healing" },
      { piecesRequired: 3, description: "Radiant aura: undead within 30ft take 2d6 radiant/round.", specialEffect: "Anti-undead aura 2d6" },
      { piecesRequired: 4, description: "Divine Intervention: once per day, avoid lethal damage (drop to 1 HP instead).", specialEffect: "Cheat death 1/day", statModifiers: [{ stat: "WIS", value: 4 }, { stat: "CHA", value: 4 }] },
    ],
  },
];

// Set piece items (equipped like normal, tracked by setId)
export const SET_ITEMS: MagicItem[] = [
  // Shadow Dancer set
  { id: "set_shadow_cloak", name: "Kael's Shadow Cloak", category: "wondrous", wondrousSlot: "back", rarity: "rare", value: 15000, weight: 1, requiredLevel: 10, slot: "back", setId: "set_shadow_dancer", description: "A cloak of living shadow that drinks in light.", specialEffect: "+5 Hide. Darkvision 60ft.", passives: [{ type: "stealth", value: 5, description: "+5 Hide." }, { type: "darkvision", value: 60, description: "Darkvision 60ft." }] },
  { id: "set_shadow_boots", name: "Kael's Silent Treads", category: "wondrous", wondrousSlot: "feet", rarity: "rare", value: 12000, weight: 1, requiredLevel: 10, slot: "feet", setId: "set_shadow_dancer", description: "Boots that make no sound, not even on gravel.", specialEffect: "+5 Move Silently. +10ft speed.", passives: [{ type: "stealth", value: 5, description: "+5 Move Silently." }] },
  { id: "set_shadow_gloves", name: "Kael's Phantom Gloves", category: "wondrous", wondrousSlot: "hands", rarity: "rare", value: 10000, weight: 0, requiredLevel: 10, slot: "hands", setId: "set_shadow_dancer", description: "Gloves that make your hands pass through locks.", specialEffect: "+10 Open Lock. +5 Sleight of Hand.", statModifiers: [{ stat: "DEX", value: 2 }] },
  { id: "set_shadow_dagger", name: "Kael's Duskblade", category: "weapon", weaponType: "dagger", rarity: "rare", value: 18000, weight: 1, requiredLevel: 10, slot: "mainhand", setId: "set_shadow_dancer", baseDamage: "1d4", bonusToHit: 3, bonusDamage: 3, element: "necrotic", critRange: 18, critMultiplier: 2, range: 10, description: "A dagger that drinks shadow and strikes from nowhere.", specialEffect: "+3 dagger. +2d6 sneak attack. Returns when thrown.", onHit: { type: "drain", chance: 20, damage: "1d4", dc: 15 } },

  // Iron Warden set
  { id: "set_warden_plate", name: "Ironwarden Full Plate", category: "armor", armorType: "plate", rarity: "rare", value: 25000, weight: 50, requiredLevel: 10, slot: "body", setId: "set_iron_warden", baseAC: 11, maxDexBonus: 1, armorCheckPenalty: -5, arcaneFailure: 35, description: "Dwarven full plate of unmatched resilience, etched with fortress runes.", specialEffect: "+9 AC. DR 3/--." },
  { id: "set_warden_shield", name: "Ironwarden Bulwark", category: "armor", armorType: "shield", rarity: "rare", value: 15000, weight: 15, requiredLevel: 10, slot: "offhand", setId: "set_iron_warden", baseAC: 4, maxDexBonus: 99, armorCheckPenalty: -1, arcaneFailure: 15, description: "A tower shield that can protect an entire hallway.", specialEffect: "+4 AC. Total cover vs ranged as move action." },
  { id: "set_warden_helm", name: "Ironwarden Visage", category: "wondrous", wondrousSlot: "head", rarity: "rare", value: 12000, weight: 3, requiredLevel: 10, slot: "head", setId: "set_iron_warden", description: "A helm of dark iron with protective runes.", specialEffect: "Immune to critical hits. +2 Will saves.", passives: [{ type: "immunity", description: "Immune to critical hits." }] },

  // Storm Caller set
  { id: "set_storm_staff", name: "Tempest Staff", category: "weapon", weaponType: "staff", rarity: "rare", value: 25000, weight: 4, requiredLevel: 10, slot: "mainhand", setId: "set_storm_caller", baseDamage: "1d6", bonusToHit: 2, bonusDamage: 2, element: "lightning", critRange: 20, critMultiplier: 2, twoHanded: true, description: "A staff of copper and crystal crackling with storm energy.", specialEffect: "+2 staff. +2d6 lightning damage. Lightning spells +2 CL.", onHit: { type: "stun", chance: 15, duration: 1, dc: 16 } },
  { id: "set_storm_robes", name: "Stormweave Robes", category: "armor", armorType: "robes", rarity: "rare", value: 18000, weight: 1, requiredLevel: 10, slot: "body", setId: "set_storm_caller", baseAC: 4, maxDexBonus: 99, armorCheckPenalty: 0, arcaneFailure: 0, description: "Robes woven from cloudstuff, crackling faintly.", specialEffect: "+4 AC. No arcane failure. Lightning resist 10." },
  { id: "set_storm_circlet", name: "Circlet of the Tempest", category: "wondrous", wondrousSlot: "head", rarity: "rare", value: 16000, weight: 0, requiredLevel: 10, slot: "head", setId: "set_storm_caller", description: "A circlet of white gold with a sapphire thunderbolt.", specialEffect: "+2 INT. +2 spell DC. Call lightning 1/day.", statModifiers: [{ stat: "INT", value: 2 }] },
  { id: "set_storm_ring", name: "Ring of the Storm Eye", category: "ring", rarity: "rare", value: 12000, weight: 0, requiredLevel: 10, slot: "ring", setId: "set_storm_caller", description: "A sapphire ring that calms the storm around you.", specialEffect: "+2 saves. Immune to own lightning effects." },

  // Beast Lord set
  { id: "set_beast_hide", name: "Dire Bear Mantle", category: "armor", armorType: "hide", rarity: "rare", value: 20000, weight: 25, requiredLevel: 10, slot: "body", setId: "set_beast_lord", baseAC: 7, maxDexBonus: 4, armorCheckPenalty: -2, arcaneFailure: 20, description: "A mantle of dire bear hide that grants primal fury.", specialEffect: "+7 AC. +2 natural armor. Rage 1/day (as barbarian)." },
  { id: "set_beast_claws", name: "Claws of the Beast", category: "wondrous", wondrousSlot: "hands", rarity: "rare", value: 15000, weight: 2, requiredLevel: 10, slot: "hands", setId: "set_beast_lord", description: "Gauntlets tipped with adamantine claws.", specialEffect: "+2 STR. Claw attacks 1d8+STR each.", statModifiers: [{ stat: "STR", value: 2 }] },
  { id: "set_beast_helm", name: "Helm of the Alpha", category: "wondrous", wondrousSlot: "head", rarity: "rare", value: 12000, weight: 3, requiredLevel: 10, slot: "head", setId: "set_beast_lord", description: "A helm shaped from a dire wolf skull.", specialEffect: "Scent (detect creatures by smell). Intimidate +5. +2 CON.", statModifiers: [{ stat: "CON", value: 2 }] },

  // Divine Herald set
  { id: "set_herald_mace", name: "Luminar's Judgment", category: "weapon", weaponType: "mace", rarity: "epic", value: 50000, weight: 8, requiredLevel: 14, slot: "mainhand", setId: "set_divine_herald", baseDamage: "1d8", bonusToHit: 4, bonusDamage: 4, element: "radiant", critRange: 20, critMultiplier: 2, description: "A golden mace blazing with divine judgment.", specialEffect: "+4 mace. +2d6 radiant. Undead on hit: Will DC 18 or destroyed." },
  { id: "set_herald_armor", name: "Vestments of the Herald", category: "armor", armorType: "breastplate", rarity: "epic", value: 40000, weight: 30, requiredLevel: 14, slot: "body", setId: "set_divine_herald", baseAC: 10, maxDexBonus: 3, armorCheckPenalty: -3, arcaneFailure: 20, description: "Gleaming silver breastplate blessed by the High Luminar.", specialEffect: "+8 AC. Healing received +25%. Death ward (immune to death effects)." },
  { id: "set_herald_shield", name: "Aegis of Faith", category: "armor", armorType: "shield", rarity: "epic", value: 30000, weight: 15, requiredLevel: 14, slot: "offhand", setId: "set_divine_herald", baseAC: 5, maxDexBonus: 99, armorCheckPenalty: -1, arcaneFailure: 15, description: "A radiant shield bearing the sun symbol of the High Luminar.", specialEffect: "+5 AC. Allies within 10ft gain +2 AC." },
  { id: "set_herald_crown", name: "Crown of the Faithful", category: "wondrous", wondrousSlot: "head", rarity: "epic", value: 35000, weight: 2, requiredLevel: 14, slot: "head", setId: "set_divine_herald", description: "A golden circlet that marks the chosen of the High Luminar.", specialEffect: "+4 WIS, +4 CHA. Turn undead as 4 levels higher.", statModifiers: [{ stat: "WIS", value: 4 }, { stat: "CHA", value: 4 }] },
];

// ══════════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/** Get all items in a flat array */
export function getAllItems(): MagicItem[] {
  return [
    ...MAGIC_WEAPONS,
    ...MAGIC_ARMORS,
    ...MAGIC_RINGS,
    ...MAGIC_AMULETS,
    ...MAGIC_POTIONS,
    ...MAGIC_SCROLLS,
    ...MAGIC_WONDROUS,
    ...SET_ITEMS,
  ];
}

/** Find an item by ID */
export function getItemById(id: string): MagicItem | undefined {
  return getAllItems().find(i => i.id === id);
}

/** Get items by rarity */
export function getItemsByRarity(rarity: Rarity): MagicItem[] {
  return getAllItems().filter(i => i.rarity === rarity);
}

// ── Loot Generation ──────────────────────────────────────────────────────────

const RARITY_WEIGHTS: Record<number, Record<Rarity, number>> = {
  // difficulty brackets: weights per rarity (higher = more likely)
  1: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 },
  2: { common: 50, uncommon: 35, rare: 12, epic: 3, legendary: 0 },
  3: { common: 30, uncommon: 35, rare: 25, epic: 8, legendary: 2 },
  4: { common: 15, uncommon: 25, rare: 35, epic: 18, legendary: 7 },
  5: { common: 5, uncommon: 15, rare: 30, epic: 30, legendary: 20 },
};

function getDifficultyBracket(difficulty: number, playerLevel: number): number {
  const effective = difficulty + Math.floor(playerLevel / 4);
  if (effective <= 3) return 1;
  if (effective <= 6) return 2;
  if (effective <= 10) return 3;
  if (effective <= 15) return 4;
  return 5;
}

function weightedRarityPick(bracket: number): Rarity {
  const weights = RARITY_WEIGHTS[bracket] || RARITY_WEIGHTS[3];
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights) as [Rarity, number][]) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "common";
}

/**
 * Generate random loot for an encounter.
 * @param difficulty - encounter difficulty (1-20, roughly CR)
 * @param playerLevel - current player level
 * @returns Array of magic items (0-3 items, scaled by difficulty)
 */
export function generateLoot(difficulty: number, playerLevel: number): MagicItem[] {
  const bracket = getDifficultyBracket(difficulty, playerLevel);
  const loot: MagicItem[] = [];

  // Number of items: 0-3, weighted by difficulty
  const itemChance = Math.min(0.8, 0.2 + difficulty * 0.05);
  const maxItems = bracket >= 4 ? 3 : bracket >= 2 ? 2 : 1;

  for (let i = 0; i < maxItems; i++) {
    if (Math.random() > itemChance) continue;

    const rarity = weightedRarityPick(bracket);
    const eligible = getAllItems().filter(item =>
      item.rarity === rarity && item.requiredLevel <= playerLevel + 2
    );

    if (eligible.length > 0) {
      const pick = eligible[Math.floor(Math.random() * eligible.length)];
      // Avoid duplicates
      if (!loot.some(l => l.id === pick.id)) {
        loot.push(pick);
      }
    }
  }

  return loot;
}

// ── Shop Inventory Generator ─────────────────────────────────────────────────

export type ShopType = "weapons" | "armor" | "magic" | "potions" | "general";

/**
 * Generate level-appropriate shop inventory.
 * @param shopType - type of shop
 * @param playerLevel - current player level (filters out too-high items)
 * @param count - number of items to stock (default 10)
 */
export function generateShopInventory(shopType: ShopType, playerLevel: number, count = 10): MagicItem[] {
  let pool: MagicItem[];

  switch (shopType) {
    case "weapons":
      pool = MAGIC_WEAPONS.filter(w => w.requiredLevel <= playerLevel + 3);
      break;
    case "armor":
      pool = MAGIC_ARMORS.filter(a => a.requiredLevel <= playerLevel + 3);
      break;
    case "potions":
      pool = [...MAGIC_POTIONS, ...MAGIC_SCROLLS].filter(p => p.requiredLevel <= playerLevel + 2);
      break;
    case "magic":
      pool = [...MAGIC_RINGS, ...MAGIC_AMULETS, ...MAGIC_WONDROUS].filter(i => i.requiredLevel <= playerLevel + 3);
      break;
    case "general":
    default:
      pool = getAllItems().filter(i => i.requiredLevel <= playerLevel + 2 && (i.rarity === "common" || i.rarity === "uncommon"));
      break;
  }

  // Shuffle and take count items
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── Item Comparison ──────────────────────────────────────────────────────────

export type ItemComparison = {
  equipped: MagicItem;
  candidate: MagicItem;
  statDiffs: { label: string; current: number | string; new: number | string; better: boolean }[];
  summary: string; // e.g. "Candidate is stronger (+2 ATK, +1d6 fire) but heavier (4 lbs more)"
};

/**
 * Compare two items side-by-side for equip decisions.
 */
export function compareItems(equipped: MagicItem, candidate: MagicItem): ItemComparison {
  const diffs: ItemComparison["statDiffs"] = [];

  // Value comparison
  diffs.push({ label: "Value (gp)", current: equipped.value, new: candidate.value, better: candidate.value > equipped.value });
  diffs.push({ label: "Weight (lbs)", current: equipped.weight, new: candidate.weight, better: candidate.weight < equipped.weight });
  diffs.push({ label: "Required Level", current: equipped.requiredLevel, new: candidate.requiredLevel, better: candidate.requiredLevel <= equipped.requiredLevel });

  // Weapon-specific
  if (equipped.category === "weapon" && candidate.category === "weapon") {
    diffs.push({ label: "To Hit Bonus", current: equipped.bonusToHit, new: candidate.bonusToHit, better: candidate.bonusToHit > equipped.bonusToHit });
    diffs.push({ label: "Bonus Damage", current: equipped.bonusDamage, new: candidate.bonusDamage, better: candidate.bonusDamage > equipped.bonusDamage });
    diffs.push({ label: "Base Damage", current: equipped.baseDamage, new: candidate.baseDamage, better: candidate.baseDamage >= equipped.baseDamage });
    diffs.push({ label: "Element", current: equipped.element, new: candidate.element, better: candidate.element !== "none" && equipped.element === "none" });
    diffs.push({ label: "Crit Range", current: `${equipped.critRange}-20`, new: `${candidate.critRange}-20`, better: candidate.critRange < equipped.critRange });
  }

  // Armor-specific
  if (equipped.category === "armor" && candidate.category === "armor") {
    diffs.push({ label: "Base AC", current: equipped.baseAC, new: candidate.baseAC, better: candidate.baseAC > equipped.baseAC });
    diffs.push({ label: "Max DEX Bonus", current: equipped.maxDexBonus, new: candidate.maxDexBonus, better: candidate.maxDexBonus > equipped.maxDexBonus });
    diffs.push({ label: "Check Penalty", current: equipped.armorCheckPenalty, new: candidate.armorCheckPenalty, better: candidate.armorCheckPenalty > equipped.armorCheckPenalty });
  }

  // Stat modifier comparison
  const equippedStats = equipped.statModifiers || [];
  const candidateStats = candidate.statModifiers || [];
  const allStats: ("STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA")[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  for (const stat of allStats) {
    const eqVal = equippedStats.find(s => s.stat === stat)?.value || 0;
    const canVal = candidateStats.find(s => s.stat === stat)?.value || 0;
    if (eqVal !== 0 || canVal !== 0) {
      diffs.push({ label: stat, current: eqVal > 0 ? `+${eqVal}` : `${eqVal}`, new: canVal > 0 ? `+${canVal}` : `${canVal}`, better: canVal > eqVal });
    }
  }

  // Build summary
  const improvements = diffs.filter(d => d.better).map(d => d.label);
  const downgrades = diffs.filter(d => !d.better && d.current !== d.new).map(d => d.label);

  let summary: string;
  if (improvements.length > downgrades.length) {
    summary = `Upgrade: better ${improvements.slice(0, 3).join(", ")}${downgrades.length > 0 ? ` (trade-off: ${downgrades.slice(0, 2).join(", ")})` : ""}.`;
  } else if (downgrades.length > improvements.length) {
    summary = `Downgrade: worse ${downgrades.slice(0, 3).join(", ")}${improvements.length > 0 ? ` (but gains: ${improvements.slice(0, 2).join(", ")})` : ""}.`;
  } else {
    summary = "Sidegrade: roughly equivalent with different strengths.";
  }

  return { equipped, candidate, statDiffs: diffs, summary };
}

// ── Set Bonus Calculator ─────────────────────────────────────────────────────

/**
 * Calculate active set bonuses based on equipped item IDs.
 * @param equippedItemIds - array of equipped item IDs
 * @returns Active set bonuses
 */
export function getActiveSetBonuses(equippedItemIds: string[]): { set: ItemSet; activeBonus: SetBonus }[] {
  const results: { set: ItemSet; activeBonus: SetBonus }[] = [];

  for (const set of ITEM_SETS) {
    const equippedPieces = set.pieces.filter(p => equippedItemIds.includes(p)).length;

    // Find the highest bonus the player qualifies for
    const activeBonuses = set.bonuses
      .filter(b => equippedPieces >= b.piecesRequired)
      .sort((a, b) => b.piecesRequired - a.piecesRequired);

    if (activeBonuses.length > 0) {
      // All qualifying bonuses are active (they stack — 2pc + 3pc + 4pc)
      for (const bonus of activeBonuses) {
        results.push({ set, activeBonus: bonus });
      }
    }
  }

  return results;
}

/**
 * Get set progress for UI display.
 */
export function getSetProgress(equippedItemIds: string[]): { set: ItemSet; equipped: number; total: number; nextBonus?: SetBonus }[] {
  return ITEM_SETS
    .map(set => {
      const equipped = set.pieces.filter(p => equippedItemIds.includes(p)).length;
      const total = set.pieces.length;
      const nextBonus = set.bonuses.find(b => b.piecesRequired > equipped);
      return { set, equipped, total, nextBonus };
    })
    .filter(s => s.equipped > 0);
}
