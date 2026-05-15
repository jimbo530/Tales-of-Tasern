// ============================================================
// craftingSystem.ts — Extended Crafting System for Tales of Tasern
//
// Expands on crafting.ts with:
//   - 50 named materials across 6 categories
//   - 6 crafting skills with level 1-100 progression
//   - 80+ recipes producing items matching magicItems.ts IDs
//   - Quality tiers based on skill vs recipe difficulty
//   - Experimentation/discovery system
//   - Gem socketing and item upgrades
//   - Gathering from hexWorld terrain types
//
// This system layers ON TOP of the existing crafting.ts D&D 3.5 system.
// Low-level mundane crafting (campfire, basic weapons) uses crafting.ts.
// This file handles magical/advanced crafting, progression, and materials.
// ============================================================

import type { Terrain, Resource } from "./hexWorld";
import type { MagicItem } from "./magicItems";

// ── Material Tiers & Categories ──────────────────────────────────────────────

export type MaterialCategory = "metal" | "wood" | "leather_cloth" | "gem" | "herb" | "monster_part";

export type MaterialTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type Material = {
  id: string;
  name: string;
  category: MaterialCategory;
  tier: MaterialTier;
  weight: number;         // lbs per unit
  valueCp: number;        // value in copper pieces
  description: string;
  gatherTerrains: Terrain[];   // where this can be found
  gatherDC: number;            // skill check DC to gather
};

// ── 50 Materials ─────────────────────────────────────────────────────────────

export const MATERIALS: Material[] = [
  // ── Metals (10) ──
  { id: "mat_iron_ore",     name: "Iron Ore",      category: "metal", tier: "common",    weight: 3, valueCp: 50,    gatherTerrains: ["mountain", "highlands", "snow"], gatherDC: 10, description: "Raw iron ore, dark and heavy. Requires smelting before use." },
  { id: "mat_steel_ingot",  name: "Steel Ingot",   category: "metal", tier: "uncommon",  weight: 4, valueCp: 200,   gatherTerrains: [], gatherDC: 0, description: "Refined steel, strong and workable. Smelted from iron ore." },
  { id: "mat_mithral",      name: "Mithral",       category: "metal", tier: "rare",      weight: 1, valueCp: 5000,  gatherTerrains: ["mountain"], gatherDC: 25, description: "Silvery-blue metal, light as silk and hard as dragon scale." },
  { id: "mat_adamantine",   name: "Adamantine",    category: "metal", tier: "epic",      weight: 5, valueCp: 10000, gatherTerrains: ["mountain", "volcanic"], gatherDC: 30, description: "The hardest metal known. Weapons of adamantine ignore all hardness." },
  { id: "mat_cold_iron",    name: "Cold Iron",     category: "metal", tier: "uncommon",  weight: 4, valueCp: 400,   gatherTerrains: ["mountain", "snow"], gatherDC: 15, description: "Iron mined deep and forged at low temperature. Bane of fey and demons." },
  { id: "mat_electrum",     name: "Electrum",      category: "metal", tier: "uncommon",  weight: 3, valueCp: 600,   gatherTerrains: ["mountain", "desert"], gatherDC: 18, description: "A natural alloy of gold and silver with innate conductivity." },
  { id: "mat_orichalcum",   name: "Orichalcum",    category: "metal", tier: "rare",      weight: 4, valueCp: 8000,  gatherTerrains: ["volcanic"], gatherDC: 28, description: "Red-gold metal found only in volcanic depths. Holds enchantments eagerly." },
  { id: "mat_dark_iron",    name: "Dark Iron",     category: "metal", tier: "rare",      weight: 5, valueCp: 4000,  gatherTerrains: ["cursed", "mountain"], gatherDC: 25, description: "Iron tainted by necrotic energy. Absorbs light and life force." },
  { id: "mat_starmetal",    name: "Starmetal",     category: "metal", tier: "legendary", weight: 3, valueCp: 25000, gatherTerrains: [], gatherDC: 0, description: "Meteoric iron from beyond the sky. Radiates faint warmth and strange magic." },
  { id: "mat_moonsilver",   name: "Moonsilver",    category: "metal", tier: "legendary", weight: 2, valueCp: 20000, gatherTerrains: [], gatherDC: 0, description: "Silver that only forms under a total lunar eclipse. Flows like quicksilver when touched by moonlight." },

  // ── Wood (8) ──
  { id: "mat_oak",          name: "Oak",           category: "wood", tier: "common",    weight: 3, valueCp: 20,    gatherTerrains: ["forest", "plains"], gatherDC: 8,  description: "Strong, reliable hardwood. The backbone of mundane craft." },
  { id: "mat_ash",          name: "Ash",           category: "wood", tier: "common",    weight: 2, valueCp: 30,    gatherTerrains: ["forest", "highlands"], gatherDC: 8,  description: "Flexible and shock-absorbing. Favored for weapon hafts and bows." },
  { id: "mat_ironwood",     name: "Ironwood",      category: "wood", tier: "uncommon",  weight: 5, valueCp: 500,   gatherTerrains: ["forest"], gatherDC: 18, description: "Wood as hard as steel. Can substitute for metal in many applications." },
  { id: "mat_darkwood",     name: "Darkwood",      category: "wood", tier: "rare",      weight: 1, valueCp: 2000,  gatherTerrains: ["forest", "jungle"], gatherDC: 22, description: "Impossibly light dark timber. Halves the weight of wooden items." },
  { id: "mat_eldertree",    name: "Eldertree",     category: "wood", tier: "epic",      weight: 2, valueCp: 8000,  gatherTerrains: ["forest"], gatherDC: 30, description: "Ancient heartwood from trees older than recorded history. Pulses with druidic power." },
  { id: "mat_petrified",    name: "Petrified Wood", category: "wood", tier: "uncommon", weight: 6, valueCp: 300,   gatherTerrains: ["desert", "mountain", "swamp"], gatherDC: 15, description: "Stone-hard fossilized wood. Takes an edge like flint but never burns." },
  { id: "mat_fungal",       name: "Fungal Wood",   category: "wood", tier: "uncommon",  weight: 2, valueCp: 400,   gatherTerrains: ["fungal", "swamp"], gatherDC: 15, description: "Mycelium-bound timber that grows in the dark. Slightly luminescent." },
  { id: "mat_crystal_wood", name: "Crystal Wood",  category: "wood", tier: "rare",      weight: 3, valueCp: 3000,  gatherTerrains: ["fungal"], gatherDC: 25, description: "Wood infused with crystalline structures. Channels arcane energy like a wand." },

  // ── Leather & Cloth (8) ──
  { id: "mat_leather",      name: "Leather",       category: "leather_cloth", tier: "common",    weight: 2, valueCp: 40,    gatherTerrains: ["grass", "plains", "forest"], gatherDC: 10, description: "Tanned animal hide. Basic but versatile." },
  { id: "mat_hardened_leather", name: "Hardened Leather", category: "leather_cloth", tier: "uncommon", weight: 3, valueCp: 200, gatherTerrains: ["grass", "plains"], gatherDC: 15, description: "Boiled and shaped leather, nearly as hard as wood." },
  { id: "mat_dragon_scale", name: "Dragon Scale",  category: "leather_cloth", tier: "legendary", weight: 1, valueCp: 30000, gatherTerrains: [], gatherDC: 0, description: "A single scale from a true dragon. Nearly indestructible and radiates elemental power." },
  { id: "mat_silk",         name: "Silk",          category: "leather_cloth", tier: "uncommon",  weight: 0.5, valueCp: 300, gatherTerrains: ["jungle", "forest"], gatherDC: 15, description: "Fine silk threads. Light, comfortable, and surprisingly strong." },
  { id: "mat_spidersilk",   name: "Spidersilk",    category: "leather_cloth", tier: "rare",     weight: 0.5, valueCp: 2000, gatherTerrains: ["fungal", "jungle"], gatherDC: 22, description: "Silk harvested from giant spiders. Stronger than steel at a fraction of the weight." },
  { id: "mat_mageweave",    name: "Mageweave",     category: "leather_cloth", tier: "rare",     weight: 0.5, valueCp: 4000, gatherTerrains: [], gatherDC: 0, description: "Cloth woven from raw magical threads. Responds to arcane energies." },
  { id: "mat_shadow_cloth", name: "Shadow Cloth",  category: "leather_cloth", tier: "epic",     weight: 0.5, valueCp: 8000, gatherTerrains: ["cursed"], gatherDC: 28, description: "Fabric spun from solidified darkness. Blends its wearer into shadows." },
  { id: "mat_phoenix_feather", name: "Phoenix Feather", category: "leather_cloth", tier: "legendary", weight: 0.1, valueCp: 25000, gatherTerrains: [], gatherDC: 0, description: "A single feather from a phoenix. Warm to the touch and radiates renewal." },

  // ── Gems (8) ──
  { id: "mat_ruby",         name: "Ruby",          category: "gem", tier: "uncommon",  weight: 0.1, valueCp: 1000,  gatherTerrains: ["mountain", "volcanic"], gatherDC: 18, description: "Deep red gemstone. Associated with fire and courage." },
  { id: "mat_sapphire",     name: "Sapphire",      category: "gem", tier: "uncommon",  weight: 0.1, valueCp: 1000,  gatherTerrains: ["mountain"], gatherDC: 18, description: "Blue gemstone of clarity and wisdom. Favored by diviners." },
  { id: "mat_emerald",      name: "Emerald",       category: "gem", tier: "uncommon",  weight: 0.1, valueCp: 1000,  gatherTerrains: ["jungle", "forest"], gatherDC: 20, description: "Green gemstone of nature and growth. Healers prize these." },
  { id: "mat_diamond",      name: "Diamond",       category: "gem", tier: "rare",      weight: 0.1, valueCp: 5000,  gatherTerrains: ["mountain"], gatherDC: 28, description: "The hardest and most brilliant gem. Component for resurrection magic." },
  { id: "mat_amethyst",     name: "Amethyst",      category: "gem", tier: "common",    weight: 0.1, valueCp: 500,   gatherTerrains: ["mountain", "highlands"], gatherDC: 12, description: "Purple crystal associated with protection and sobriety." },
  { id: "mat_onyx",         name: "Onyx",          category: "gem", tier: "uncommon",  weight: 0.1, valueCp: 800,   gatherTerrains: ["cursed", "mountain"], gatherDC: 16, description: "Black gemstone that absorbs necromantic energy. Used in dark rituals." },
  { id: "mat_opal",         name: "Opal",          category: "gem", tier: "rare",      weight: 0.1, valueCp: 3000,  gatherTerrains: ["desert", "volcanic"], gatherDC: 24, description: "Iridescent stone that shifts color. Amplifies all schools of magic." },
  { id: "mat_void_crystal", name: "Void Crystal",  category: "gem", tier: "legendary", weight: 0.1, valueCp: 50000, gatherTerrains: [], gatherDC: 0, description: "A crystal of absolute emptiness. Looking into it reveals nothing — not even light returns." },

  // ── Herbs (8) ──
  { id: "mat_moonpetal",    name: "Moonpetal",     category: "herb", tier: "common",    weight: 0.1, valueCp: 50,   gatherTerrains: ["forest", "grass", "plains"], gatherDC: 10, description: "Pale flower that blooms only at night. Mild healing properties." },
  { id: "mat_firecap",      name: "Firecap",       category: "herb", tier: "uncommon",  weight: 0.1, valueCp: 300,  gatherTerrains: ["volcanic", "desert"], gatherDC: 18, description: "Red mushroom that generates heat. Key ingredient in fire potions." },
  { id: "mat_frostmint",    name: "Frostmint",     category: "herb", tier: "uncommon",  weight: 0.1, valueCp: 300,  gatherTerrains: ["snow", "mountain"], gatherDC: 18, description: "Minty herb that thrives in frozen soil. Cools fevers and resists fire." },
  { id: "mat_shadowroot",   name: "Shadowroot",    category: "herb", tier: "rare",      weight: 0.1, valueCp: 1500, gatherTerrains: ["cursed", "swamp"], gatherDC: 22, description: "Black root that grows only in darkness. Toxic and powerfully magical." },
  { id: "mat_lifeleaf",     name: "Lifeleaf",      category: "herb", tier: "uncommon",  weight: 0.1, valueCp: 400,  gatherTerrains: ["forest", "jungle"], gatherDC: 15, description: "Bright green leaf that accelerates natural healing." },
  { id: "mat_venombloom",   name: "Venombloom",    category: "herb", tier: "rare",      weight: 0.1, valueCp: 2000, gatherTerrains: ["swamp", "jungle"], gatherDC: 22, description: "Beautiful purple flower with lethal nectar. Handle with thick gloves." },
  { id: "mat_stardust_pollen", name: "Stardust Pollen", category: "herb", tier: "epic", weight: 0.1, valueCp: 10000, gatherTerrains: [], gatherDC: 0, description: "Sparkling pollen from a flower that blooms once per century. Transcendent alchemical catalyst." },
  { id: "mat_fungal_spore", name: "Fungal Spore",  category: "herb", tier: "common",    weight: 0.1, valueCp: 60,   gatherTerrains: ["fungal", "swamp"], gatherDC: 10, description: "Spores from giant mushrooms. Versatile in alchemy and cooking." },

  // ── Monster Parts (8) ──
  { id: "mat_beast_fang",   name: "Beast Fang",    category: "monster_part", tier: "common",    weight: 0.5, valueCp: 100,   gatherTerrains: ["forest", "grass", "plains", "jungle"], gatherDC: 12, description: "Large fang from a predatory beast. Used in primitive weapons and necklaces." },
  { id: "mat_dragon_blood", name: "Dragon Blood",  category: "monster_part", tier: "legendary", weight: 1, valueCp: 40000, gatherTerrains: [], gatherDC: 0, description: "Blood of a true dragon, still warm. The ultimate alchemical solvent." },
  { id: "mat_elemental_core", name: "Elemental Core", category: "monster_part", tier: "rare",  weight: 2, valueCp: 5000,  gatherTerrains: ["volcanic", "snow"], gatherDC: 25, description: "Crystallized essence from a slain elemental. Radiates primal energy." },
  { id: "mat_undead_essence", name: "Undead Essence", category: "monster_part", tier: "uncommon", weight: 0.5, valueCp: 600, gatherTerrains: ["cursed"], gatherDC: 18, description: "Dark vapor captured in a sealed vial. Necromantic applications abound." },
  { id: "mat_demon_heart", name: "Demon Heart",    category: "monster_part", tier: "epic",     weight: 3, valueCp: 15000, gatherTerrains: [], gatherDC: 0, description: "Still-beating heart of a slain fiend. Corrupts whatever it touches with power." },
  { id: "mat_angel_tear",  name: "Angel Tear",     category: "monster_part", tier: "epic",     weight: 0.1, valueCp: 15000, gatherTerrains: [], gatherDC: 0, description: "A single crystallized tear of a celestial being. Radiates pure divine energy." },
  { id: "mat_slime_gel",   name: "Slime Gel",      category: "monster_part", tier: "common",    weight: 1, valueCp: 80,    gatherTerrains: ["swamp", "fungal"], gatherDC: 10, description: "Acidic gel harvested from slain oozes. Useful as a solvent and adhesive." },
  { id: "mat_phoenix_ash", name: "Phoenix Ash",    category: "monster_part", tier: "legendary", weight: 0.1, valueCp: 35000, gatherTerrains: [], gatherDC: 0, description: "Ash from a phoenix's rebirth. Contains the spark of resurrection." },
];

/** Lookup a material by ID */
export function getMaterial(id: string): Material | undefined {
  return MATERIALS.find(m => m.id === id);
}

// ── Crafting Skills ──────────────────────────────────────────────────────────

export type CraftingSkill = "blacksmithing" | "leatherworking" | "alchemy" | "enchanting" | "jewelcrafting" | "inscription";

export type CraftingSkillInfo = {
  id: CraftingSkill;
  name: string;
  description: string;
  primaryStat: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
  station: CraftingStation;
  produces: string;  // what this skill makes
};

export const CRAFTING_SKILLS: CraftingSkillInfo[] = [
  { id: "blacksmithing",  name: "Blacksmithing",  primaryStat: "STR", station: "forge",            produces: "Weapons, heavy armor, shields", description: "The art of shaping metal with hammer and anvil. Produces weapons, heavy armor, and tools." },
  { id: "leatherworking", name: "Leatherworking", primaryStat: "DEX", station: "tanning_rack",     produces: "Light/medium armor, bags, straps", description: "Working hides and skins into flexible armor, containers, and bindings." },
  { id: "alchemy",        name: "Alchemy",        primaryStat: "INT", station: "alchemy_lab",      produces: "Potions, poisons, bombs, elixirs", description: "Combining reagents into magical draughts, deadly toxins, and volatile concoctions." },
  { id: "enchanting",     name: "Enchanting",     primaryStat: "INT", station: "enchanting_table", produces: "Magical properties on existing items", description: "Imbuing mundane items with permanent magical effects through runic inscription and arcane focus." },
  { id: "jewelcrafting",  name: "Jewelcrafting",  primaryStat: "DEX", station: "jewelers_bench",   produces: "Rings, amulets, gem cutting, socketing", description: "Cutting gems and shaping precious metals into magical jewelry." },
  { id: "inscription",    name: "Inscription",    primaryStat: "INT", station: "scriptorium",      produces: "Scrolls, runes, spell books", description: "Recording magical formulae onto scrolls and etching power runes." },
];

// ── Crafting Stations ────────────────────────────────────────────────────────

export type CraftingStation = "forge" | "tanning_rack" | "alchemy_lab" | "enchanting_table" | "jewelers_bench" | "scriptorium";

export type StationInfo = {
  id: CraftingStation;
  name: string;
  description: string;
  foundIn: string[];  // where players can find these
};

export const CRAFTING_STATIONS: StationInfo[] = [
  { id: "forge",            name: "Forge",            foundIn: ["cities", "castles", "mines"],           description: "A full forge with anvil, bellows, and quenching trough. Required for metalwork." },
  { id: "tanning_rack",     name: "Tanning Rack",     foundIn: ["wilderness camps", "villages", "cities"], description: "A frame for stretching and treating hides. Can be built at any camp." },
  { id: "alchemy_lab",      name: "Alchemy Lab",      foundIn: ["cities", "wizard towers", "dungeons"],  description: "Glassware, burners, and measuring tools for precise alchemical work." },
  { id: "enchanting_table", name: "Enchanting Table", foundIn: ["wizard towers", "libraries", "temples"], description: "A runically-inscribed table that focuses magical energy. Very rare." },
  { id: "jewelers_bench",   name: "Jeweler's Bench",  foundIn: ["cities", "dwarven halls"],              description: "Precision tools for gem cutting, setting, and metalwork on a small scale." },
  { id: "scriptorium",      name: "Scriptorium",      foundIn: ["libraries", "temples", "monasteries"],  description: "Quills, inks, and clean surfaces for delicate magical inscription." },
];

// ── Quality System ───────────────────────────────────────────────────────────

export type CraftQuality = "poor" | "normal" | "fine" | "superior" | "masterwork";

export const QUALITY_MULTIPLIERS: Record<CraftQuality, number> = {
  poor: 0.8,
  normal: 1.0,
  fine: 1.1,
  superior: 1.25,
  masterwork: 1.5,
};

export const QUALITY_LABELS: Record<CraftQuality, string> = {
  poor: "Poor",
  normal: "Normal",
  fine: "Fine",
  superior: "Superior",
  masterwork: "Masterwork",
};

/**
 * Roll quality based on skill level vs recipe minimum.
 * Base 50% chance of normal, +5% per skill level above minimum.
 * Higher rolls = better quality.
 */
export function rollQuality(skillLevel: number, recipeMinLevel: number): CraftQuality {
  const bonus = Math.max(0, skillLevel - recipeMinLevel);
  const qualityRoll = Math.random() * 100;
  const baseNormal = 50 + bonus * 5;

  // Distribution: poor < (100 - baseNormal)%, normal = baseNormal%, then split the bonus
  if (qualityRoll < Math.max(0, 20 - bonus * 2)) {
    return "poor";
  } else if (qualityRoll < 50) {
    return "normal";
  } else if (qualityRoll < 50 + bonus * 3) {
    return "fine";
  } else if (qualityRoll < 50 + bonus * 5) {
    return "superior";
  } else if (bonus >= 10 && qualityRoll >= 95) {
    return "masterwork";
  }
  return "normal";
}

// ── Skill Progression ────────────────────────────────────────────────────────

export type SkillProgress = {
  skill: CraftingSkill;
  level: number;     // 1-100
  xp: number;        // current XP
  xpToNext: number;  // XP needed for next level
};

/** XP required to reach a given level */
export function xpForLevel(level: number): number {
  // Accelerating curve: 100 XP for level 2, scales up
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** Calculate XP needed from current level to next */
export function xpToNextLevel(currentLevel: number, currentXp: number): number {
  if (currentLevel >= 100) return 0;
  return xpForLevel(currentLevel + 1) - currentXp;
}

/** Add XP and return updated progress (may level up multiple times) */
export function addSkillXp(progress: SkillProgress, xpGain: number): SkillProgress {
  let { level, xp } = progress;
  xp += xpGain;

  while (level < 100 && xp >= xpForLevel(level + 1)) {
    level++;
  }

  return {
    skill: progress.skill,
    level,
    xp,
    xpToNext: xpToNextLevel(level, xp),
  };
}

/** Create fresh skill progress at level 1 */
export function initSkillProgress(skill: CraftingSkill): SkillProgress {
  return {
    skill,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(2),
  };
}

// ── Recipe System ────────────────────────────────────────────────────────────

export type RecipeMaterial = {
  materialId: string;
  quantity: number;
};

export type Recipe = {
  id: string;
  name: string;
  skill: CraftingSkill;
  skillRequired: number;   // minimum skill level to attempt
  materials: RecipeMaterial[];
  resultItemId: string;    // references magicItems.ts ID or a custom craft ID
  resultQuantity: number;
  craftTime: number;       // turns (1 turn = ~10 minutes in-game)
  discoverable: boolean;   // can be found by experimentation
  xpGain: number;
  description: string;
};

// ── Recipes: Weapons (15) ────────────────────────────────────────────────────

const WEAPON_RECIPES: Recipe[] = [
  { id: "rc_iron_longsword",      name: "Iron Longsword",          skill: "blacksmithing", skillRequired: 5,  materials: [{ materialId: "mat_iron_ore", quantity: 3 }, { materialId: "mat_oak", quantity: 1 }], resultItemId: "craft_iron_longsword", resultQuantity: 1, craftTime: 6, discoverable: false, xpGain: 15, description: "A serviceable iron longsword." },
  { id: "rc_steel_longsword",     name: "Steel Longsword",         skill: "blacksmithing", skillRequired: 15, materials: [{ materialId: "mat_steel_ingot", quantity: 3 }, { materialId: "mat_ash", quantity: 1 }], resultItemId: "craft_steel_longsword", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 30, description: "A well-tempered steel blade." },
  { id: "rc_longsword_1",         name: "Enchanted Longsword +1",  skill: "blacksmithing", skillRequired: 30, materials: [{ materialId: "mat_steel_ingot", quantity: 4 }, { materialId: "mat_cold_iron", quantity: 1 }, { materialId: "mat_amethyst", quantity: 1 }], resultItemId: "wpn_longsword_1", resultQuantity: 1, craftTime: 12, discoverable: false, xpGain: 60, description: "A longsword imbued with minor enchantment during forging." },
  { id: "rc_frost_battleaxe",     name: "Frost Battleaxe",         skill: "blacksmithing", skillRequired: 45, materials: [{ materialId: "mat_steel_ingot", quantity: 4 }, { materialId: "mat_cold_iron", quantity: 2 }, { materialId: "mat_sapphire", quantity: 1 }, { materialId: "mat_frostmint", quantity: 3 }], resultItemId: "wpn_frost_battleaxe", resultQuantity: 1, craftTime: 18, discoverable: false, xpGain: 100, description: "An axe forged in cold iron and quenched in frost mint extract." },
  { id: "rc_flaming_longsword",   name: "Flaming Longsword",       skill: "blacksmithing", skillRequired: 45, materials: [{ materialId: "mat_steel_ingot", quantity: 4 }, { materialId: "mat_orichalcum", quantity: 1 }, { materialId: "mat_ruby", quantity: 1 }, { materialId: "mat_firecap", quantity: 3 }], resultItemId: "wpn_flaming_longsword", resultQuantity: 1, craftTime: 18, discoverable: false, xpGain: 100, description: "A sword whose blade dances with perpetual flame." },
  { id: "rc_venom_dagger",        name: "Venom Dagger",            skill: "blacksmithing", skillRequired: 35, materials: [{ materialId: "mat_steel_ingot", quantity: 1 }, { materialId: "mat_dark_iron", quantity: 1 }, { materialId: "mat_venombloom", quantity: 2 }, { materialId: "mat_beast_fang", quantity: 1 }], resultItemId: "wpn_venom_dagger", resultQuantity: 1, craftTime: 10, discoverable: true, xpGain: 75, description: "A dagger with channels carved to hold persistent venom." },
  { id: "rc_thundering_warhammer", name: "Thundering Warhammer",   skill: "blacksmithing", skillRequired: 50, materials: [{ materialId: "mat_adamantine", quantity: 2 }, { materialId: "mat_electrum", quantity: 2 }, { materialId: "mat_elemental_core", quantity: 1 }], resultItemId: "wpn_thundering_warhammer", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 120, description: "A warhammer that cracks with thunder on impact." },
  { id: "rc_radiant_mace",        name: "Radiant Mace",            skill: "blacksmithing", skillRequired: 55, materials: [{ materialId: "mat_mithral", quantity: 2 }, { materialId: "mat_angel_tear", quantity: 1 }, { materialId: "mat_diamond", quantity: 1 }], resultItemId: "wpn_radiant_mace", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 140, description: "A mace that shines with holy light, bane of undead." },
  { id: "rc_mithral_shortsword",  name: "Mithral Short Sword",     skill: "blacksmithing", skillRequired: 40, materials: [{ materialId: "mat_mithral", quantity: 2 }, { materialId: "mat_darkwood", quantity: 1 }], resultItemId: "craft_mithral_shortsword", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 80, description: "A feather-light blade of silvery mithral." },
  { id: "rc_corrosive_rapier",    name: "Corrosive Rapier",        skill: "blacksmithing", skillRequired: 50, materials: [{ materialId: "mat_steel_ingot", quantity: 2 }, { materialId: "mat_orichalcum", quantity: 1 }, { materialId: "mat_slime_gel", quantity: 3 }, { materialId: "mat_emerald", quantity: 1 }], resultItemId: "wpn_corrosive_rapier", resultQuantity: 1, craftTime: 16, discoverable: true, xpGain: 110, description: "A rapier etched with acid channels that corrode on contact." },
  { id: "rc_oathbow",             name: "Oathbow",                 skill: "blacksmithing", skillRequired: 65, materials: [{ materialId: "mat_eldertree", quantity: 2 }, { materialId: "mat_spidersilk", quantity: 2 }, { materialId: "mat_moonsilver", quantity: 1 }], resultItemId: "wpn_oathbow", resultQuantity: 1, craftTime: 24, discoverable: false, xpGain: 180, description: "A bow that bonds to its wielder and marks sworn enemies." },
  { id: "rc_sun_blade",           name: "Sun Blade",               skill: "blacksmithing", skillRequired: 75, materials: [{ materialId: "mat_starmetal", quantity: 2 }, { materialId: "mat_angel_tear", quantity: 1 }, { materialId: "mat_diamond", quantity: 2 }, { materialId: "mat_phoenix_ash", quantity: 1 }], resultItemId: "wpn_sun_blade", resultQuantity: 1, craftTime: 30, discoverable: false, xpGain: 250, description: "A blade of pure sunlight solidified in starmetal." },
  { id: "rc_holy_avenger",        name: "Holy Avenger",            skill: "blacksmithing", skillRequired: 90, materials: [{ materialId: "mat_starmetal", quantity: 3 }, { materialId: "mat_moonsilver", quantity: 2 }, { materialId: "mat_angel_tear", quantity: 2 }, { materialId: "mat_diamond", quantity: 3 }], resultItemId: "wpn_holy_avenger", resultQuantity: 1, craftTime: 40, discoverable: false, xpGain: 400, description: "The pinnacle of divine weaponsmithing. Only the truly righteous may wield it." },
  { id: "rc_vorpal_greatsword",   name: "Vorpal Greatsword",       skill: "blacksmithing", skillRequired: 95, materials: [{ materialId: "mat_adamantine", quantity: 4 }, { materialId: "mat_starmetal", quantity: 2 }, { materialId: "mat_void_crystal", quantity: 1 }, { materialId: "mat_demon_heart", quantity: 1 }], resultItemId: "wpn_vorpal_greatsword", resultQuantity: 1, craftTime: 50, discoverable: false, xpGain: 500, description: "A blade so keen it can sever any head from any neck." },
  { id: "rc_iron_dagger",         name: "Iron Dagger",             skill: "blacksmithing", skillRequired: 1,  materials: [{ materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_iron_dagger", resultQuantity: 1, craftTime: 3, discoverable: false, xpGain: 8, description: "A simple iron dagger. Every smith starts here." },
];

// ── Recipes: Armor (12) ──────────────────────────────────────────────────────

const ARMOR_RECIPES: Recipe[] = [
  { id: "rc_leather_armor",       name: "Crafted Leather Armor",   skill: "leatherworking", skillRequired: 5,  materials: [{ materialId: "mat_leather", quantity: 4 }], resultItemId: "craft_leather_armor", resultQuantity: 1, craftTime: 6, discoverable: false, xpGain: 15, description: "Basic leather armor shaped and stitched." },
  { id: "rc_hardened_leather_armor", name: "Hardened Leather Armor", skill: "leatherworking", skillRequired: 15, materials: [{ materialId: "mat_hardened_leather", quantity: 4 }, { materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_hardened_leather", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 30, description: "Boiled and shaped leather that resists blades." },
  { id: "rc_studded_leather_1",   name: "Studded Leather +1",      skill: "leatherworking", skillRequired: 30, materials: [{ materialId: "mat_hardened_leather", quantity: 4 }, { materialId: "mat_cold_iron", quantity: 2 }, { materialId: "mat_amethyst", quantity: 1 }], resultItemId: "arm_studded_leather_1", resultQuantity: 1, craftTime: 12, discoverable: false, xpGain: 60, description: "Enchanted studded leather that moves with the wearer." },
  { id: "rc_chain_shirt_1",       name: "Chain Shirt +1",          skill: "blacksmithing", skillRequired: 30, materials: [{ materialId: "mat_steel_ingot", quantity: 5 }, { materialId: "mat_amethyst", quantity: 1 }], resultItemId: "arm_chain_shirt_1", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 65, description: "A finely-linked chain shirt with minor enchantment." },
  { id: "rc_mithral_shirt",       name: "Mithral Shirt",           skill: "blacksmithing", skillRequired: 55, materials: [{ materialId: "mat_mithral", quantity: 5 }], resultItemId: "arm_mithral_shirt", resultQuantity: 1, craftTime: 24, discoverable: false, xpGain: 150, description: "A gossamer chain shirt of mithral links. Light as silk." },
  { id: "rc_elven_chain",         name: "Elven Chain",             skill: "blacksmithing", skillRequired: 60, materials: [{ materialId: "mat_mithral", quantity: 4 }, { materialId: "mat_moonsilver", quantity: 1 }, { materialId: "mat_spidersilk", quantity: 2 }], resultItemId: "arm_elven_chain", resultQuantity: 1, craftTime: 28, discoverable: false, xpGain: 170, description: "Elven chainmail woven with moonsilver threads." },
  { id: "rc_adamantine_breastplate", name: "Adamantine Breastplate", skill: "blacksmithing", skillRequired: 70, materials: [{ materialId: "mat_adamantine", quantity: 5 }, { materialId: "mat_steel_ingot", quantity: 3 }], resultItemId: "arm_adamantine_breastplate", resultQuantity: 1, craftTime: 30, discoverable: false, xpGain: 200, description: "Virtually impenetrable. Negates critical hits." },
  { id: "rc_spidersilk_armor",    name: "Spidersilk Armor",        skill: "leatherworking", skillRequired: 45, materials: [{ materialId: "mat_spidersilk", quantity: 5 }, { materialId: "mat_silk", quantity: 3 }], resultItemId: "craft_spidersilk_armor", resultQuantity: 1, craftTime: 16, discoverable: true, xpGain: 90, description: "Armor woven from giant spider silk. Incredibly light and strong." },
  { id: "rc_shadow_leather",      name: "Shadow Leather Armor",    skill: "leatherworking", skillRequired: 60, materials: [{ materialId: "mat_shadow_cloth", quantity: 3 }, { materialId: "mat_hardened_leather", quantity: 3 }, { materialId: "mat_onyx", quantity: 1 }], resultItemId: "craft_shadow_leather", resultQuantity: 1, craftTime: 20, discoverable: true, xpGain: 140, description: "Armor that merges with darkness. +5 to Hide in dim light." },
  { id: "rc_dwarven_plate",       name: "Dwarven Plate",           skill: "blacksmithing", skillRequired: 80, materials: [{ materialId: "mat_adamantine", quantity: 4 }, { materialId: "mat_steel_ingot", quantity: 6 }, { materialId: "mat_diamond", quantity: 1 }], resultItemId: "arm_dwarven_plate", resultQuantity: 1, craftTime: 40, discoverable: false, xpGain: 280, description: "Full plate forged with dwarven precision. Unmatched protection." },
  { id: "rc_darkwood_buckler",    name: "Darkwood Buckler",        skill: "leatherworking", skillRequired: 25, materials: [{ materialId: "mat_darkwood", quantity: 2 }, { materialId: "mat_leather", quantity: 1 }], resultItemId: "arm_darkwood_buckler", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 45, description: "A feather-light shield of precious darkwood." },
  { id: "rc_celestial_armor",     name: "Celestial Armor",         skill: "blacksmithing", skillRequired: 85, materials: [{ materialId: "mat_mithral", quantity: 4 }, { materialId: "mat_moonsilver", quantity: 2 }, { materialId: "mat_angel_tear", quantity: 2 }, { materialId: "mat_phoenix_feather", quantity: 1 }], resultItemId: "arm_celestial", resultQuantity: 1, craftTime: 45, discoverable: false, xpGain: 350, description: "Armor blessed by celestial beings. Grants flight once per day." },
];

// ── Recipes: Potions (15) ────────────────────────────────────────────────────

const POTION_RECIPES: Recipe[] = [
  { id: "rc_pot_cure_light",      name: "Potion of Cure Light Wounds",    skill: "alchemy", skillRequired: 5,  materials: [{ materialId: "mat_moonpetal", quantity: 2 }, { materialId: "mat_lifeleaf", quantity: 1 }], resultItemId: "pot_cure_light", resultQuantity: 1, craftTime: 3, discoverable: true, xpGain: 12, description: "A basic healing potion that restores 1d8+1 HP." },
  { id: "rc_pot_cure_moderate",   name: "Potion of Cure Moderate Wounds", skill: "alchemy", skillRequired: 20, materials: [{ materialId: "mat_moonpetal", quantity: 3 }, { materialId: "mat_lifeleaf", quantity: 2 }, { materialId: "mat_fungal_spore", quantity: 1 }], resultItemId: "pot_cure_moderate", resultQuantity: 1, craftTime: 5, discoverable: true, xpGain: 35, description: "Moderate healing draught restoring 2d8+3 HP." },
  { id: "rc_pot_cure_serious",    name: "Potion of Cure Serious Wounds",  skill: "alchemy", skillRequired: 40, materials: [{ materialId: "mat_lifeleaf", quantity: 4 }, { materialId: "mat_moonpetal", quantity: 3 }, { materialId: "mat_emerald", quantity: 1 }], resultItemId: "pot_cure_serious", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 70, description: "Powerful healing draught restoring 3d8+5 HP." },
  { id: "rc_pot_cure_critical",   name: "Potion of Cure Critical Wounds", skill: "alchemy", skillRequired: 60, materials: [{ materialId: "mat_lifeleaf", quantity: 5 }, { materialId: "mat_stardust_pollen", quantity: 1 }, { materialId: "mat_diamond", quantity: 1 }], resultItemId: "pot_cure_critical", resultQuantity: 1, craftTime: 12, discoverable: false, xpGain: 130, description: "Supreme healing draught restoring 4d8+7 HP." },
  { id: "rc_pot_mage_armor",      name: "Potion of Mage Armor",           skill: "alchemy", skillRequired: 15, materials: [{ materialId: "mat_fungal_spore", quantity: 2 }, { materialId: "mat_slime_gel", quantity: 1 }, { materialId: "mat_amethyst", quantity: 1 }], resultItemId: "pot_mage_armor", resultQuantity: 1, craftTime: 4, discoverable: true, xpGain: 25, description: "Shimmering draught that creates a protective force field." },
  { id: "rc_pot_bulls_strength",  name: "Potion of Bull's Strength",      skill: "alchemy", skillRequired: 25, materials: [{ materialId: "mat_beast_fang", quantity: 2 }, { materialId: "mat_firecap", quantity: 1 }, { materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "pot_bulls_strength", resultQuantity: 1, craftTime: 5, discoverable: true, xpGain: 40, description: "Grants +4 STR for 1 hour." },
  { id: "rc_pot_cats_grace",      name: "Potion of Cat's Grace",          skill: "alchemy", skillRequired: 25, materials: [{ materialId: "mat_beast_fang", quantity: 1 }, { materialId: "mat_silk", quantity: 1 }, { materialId: "mat_frostmint", quantity: 1 }], resultItemId: "pot_cats_grace", resultQuantity: 1, craftTime: 5, discoverable: true, xpGain: 40, description: "Grants +4 DEX for 1 hour." },
  { id: "rc_pot_invisibility",    name: "Potion of Invisibility",         skill: "alchemy", skillRequired: 35, materials: [{ materialId: "mat_shadowroot", quantity: 2 }, { materialId: "mat_slime_gel", quantity: 2 }, { materialId: "mat_opal", quantity: 1 }], resultItemId: "pot_invisibility", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 65, description: "Renders the drinker completely invisible." },
  { id: "rc_pot_haste",           name: "Potion of Haste",                skill: "alchemy", skillRequired: 45, materials: [{ materialId: "mat_firecap", quantity: 2 }, { materialId: "mat_frostmint", quantity: 2 }, { materialId: "mat_elemental_core", quantity: 1 }], resultItemId: "pot_haste", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 90, description: "Doubles movement speed and grants an extra attack." },
  { id: "rc_pot_fly",             name: "Potion of Fly",                  skill: "alchemy", skillRequired: 40, materials: [{ materialId: "mat_phoenix_feather", quantity: 1 }, { materialId: "mat_frostmint", quantity: 2 }, { materialId: "mat_slime_gel", quantity: 1 }], resultItemId: "pot_fly", resultQuantity: 1, craftTime: 8, discoverable: true, xpGain: 75, description: "Grants flight for 10 minutes." },
  { id: "rc_pot_resist_fire",     name: "Potion of Fire Resistance",      skill: "alchemy", skillRequired: 30, materials: [{ materialId: "mat_frostmint", quantity: 3 }, { materialId: "mat_slime_gel", quantity: 2 }], resultItemId: "pot_resist_fire", resultQuantity: 1, craftTime: 6, discoverable: true, xpGain: 50, description: "Grants fire resistance 20 for 1 hour." },
  { id: "rc_pot_resist_cold",     name: "Potion of Cold Resistance",      skill: "alchemy", skillRequired: 30, materials: [{ materialId: "mat_firecap", quantity: 3 }, { materialId: "mat_beast_fang", quantity: 1 }], resultItemId: "pot_resist_cold", resultQuantity: 1, craftTime: 6, discoverable: true, xpGain: 50, description: "Grants cold resistance 20 for 1 hour." },
  { id: "rc_pot_giant_strength",  name: "Potion of Giant Strength",       skill: "alchemy", skillRequired: 65, materials: [{ materialId: "mat_elemental_core", quantity: 2 }, { materialId: "mat_beast_fang", quantity: 3 }, { materialId: "mat_stardust_pollen", quantity: 1 }], resultItemId: "pot_giant_strength", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 150, description: "Grants STR 25 for 1 hour. Bones creak under the pressure." },
  { id: "rc_pot_stoneskin",       name: "Potion of Stoneskin",            skill: "alchemy", skillRequired: 55, materials: [{ materialId: "mat_elemental_core", quantity: 1 }, { materialId: "mat_iron_ore", quantity: 2 }, { materialId: "mat_diamond", quantity: 1 }], resultItemId: "pot_stoneskin", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 120, description: "Skin hardens to stone. DR 10/adamantine for 10 min." },
  { id: "rc_pot_fire_breath",     name: "Potion of Fire Breath",          skill: "alchemy", skillRequired: 35, materials: [{ materialId: "mat_firecap", quantity: 3 }, { materialId: "mat_dragon_blood", quantity: 1 }], resultItemId: "pot_fire_breath", resultQuantity: 1, craftTime: 7, discoverable: true, xpGain: 65, description: "Breathe a 30-ft cone of fire for 4d6 damage." },
];

// ── Recipes: Enchantments (12) ───────────────────────────────────────────────

const ENCHANTMENT_RECIPES: Recipe[] = [
  { id: "rc_ench_weapon_1",       name: "+1 Weapon Enchantment",     skill: "enchanting", skillRequired: 20, materials: [{ materialId: "mat_amethyst", quantity: 2 }, { materialId: "mat_moonpetal", quantity: 3 }], resultItemId: "ench_weapon_1", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 40, description: "Imbue a weapon with +1 enhancement bonus." },
  { id: "rc_ench_weapon_2",       name: "+2 Weapon Enchantment",     skill: "enchanting", skillRequired: 40, materials: [{ materialId: "mat_sapphire", quantity: 2 }, { materialId: "mat_orichalcum", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 5 }], resultItemId: "ench_weapon_2", resultQuantity: 1, craftTime: 16, discoverable: false, xpGain: 80, description: "Imbue a weapon with +2 enhancement bonus." },
  { id: "rc_ench_weapon_3",       name: "+3 Weapon Enchantment",     skill: "enchanting", skillRequired: 65, materials: [{ materialId: "mat_diamond", quantity: 2 }, { materialId: "mat_starmetal", quantity: 1 }, { materialId: "mat_stardust_pollen", quantity: 2 }], resultItemId: "ench_weapon_3", resultQuantity: 1, craftTime: 24, discoverable: false, xpGain: 160, description: "Imbue a weapon with +3 enhancement bonus." },
  { id: "rc_ench_armor_1",        name: "+1 Armor Enchantment",      skill: "enchanting", skillRequired: 20, materials: [{ materialId: "mat_amethyst", quantity: 2 }, { materialId: "mat_iron_ore", quantity: 2 }], resultItemId: "ench_armor_1", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 40, description: "Imbue armor with +1 enhancement bonus." },
  { id: "rc_ench_armor_2",        name: "+2 Armor Enchantment",      skill: "enchanting", skillRequired: 40, materials: [{ materialId: "mat_sapphire", quantity: 2 }, { materialId: "mat_mithral", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 4 }], resultItemId: "ench_armor_2", resultQuantity: 1, craftTime: 16, discoverable: false, xpGain: 80, description: "Imbue armor with +2 enhancement bonus." },
  { id: "rc_ench_flaming",        name: "Flaming Enchantment",       skill: "enchanting", skillRequired: 35, materials: [{ materialId: "mat_ruby", quantity: 2 }, { materialId: "mat_firecap", quantity: 4 }, { materialId: "mat_elemental_core", quantity: 1 }], resultItemId: "ench_flaming", resultQuantity: 1, craftTime: 14, discoverable: true, xpGain: 70, description: "Add 1d6 fire damage to a weapon." },
  { id: "rc_ench_frost",          name: "Frost Enchantment",         skill: "enchanting", skillRequired: 35, materials: [{ materialId: "mat_sapphire", quantity: 2 }, { materialId: "mat_frostmint", quantity: 4 }, { materialId: "mat_elemental_core", quantity: 1 }], resultItemId: "ench_frost", resultQuantity: 1, craftTime: 14, discoverable: true, xpGain: 70, description: "Add 1d6 cold damage to a weapon." },
  { id: "rc_ench_shock",          name: "Shock Enchantment",         skill: "enchanting", skillRequired: 35, materials: [{ materialId: "mat_electrum", quantity: 2 }, { materialId: "mat_elemental_core", quantity: 1 }, { materialId: "mat_opal", quantity: 1 }], resultItemId: "ench_shock", resultQuantity: 1, craftTime: 14, discoverable: true, xpGain: 70, description: "Add 1d6 lightning damage to a weapon." },
  { id: "rc_ench_keen",           name: "Keen Enchantment",          skill: "enchanting", skillRequired: 50, materials: [{ materialId: "mat_diamond", quantity: 1 }, { materialId: "mat_orichalcum", quantity: 1 }, { materialId: "mat_moonsilver", quantity: 1 }], resultItemId: "ench_keen", resultQuantity: 1, craftTime: 18, discoverable: false, xpGain: 110, description: "Double the critical threat range of a weapon." },
  { id: "rc_ench_vorpal",         name: "Vorpal Enchantment",        skill: "enchanting", skillRequired: 90, materials: [{ materialId: "mat_void_crystal", quantity: 1 }, { materialId: "mat_adamantine", quantity: 2 }, { materialId: "mat_demon_heart", quantity: 1 }, { materialId: "mat_stardust_pollen", quantity: 2 }], resultItemId: "ench_vorpal", resultQuantity: 1, craftTime: 40, discoverable: false, xpGain: 400, description: "On a natural 20, the target's head is severed." },
  { id: "rc_ench_resistance",     name: "Resistance Enchantment",    skill: "enchanting", skillRequired: 25, materials: [{ materialId: "mat_amethyst", quantity: 1 }, { materialId: "mat_onyx", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 2 }], resultItemId: "ench_resistance", resultQuantity: 1, craftTime: 8, discoverable: true, xpGain: 45, description: "Add +1 to all saving throws on a cloak or ring." },
  { id: "rc_ench_speed",          name: "Speed Enchantment",         skill: "enchanting", skillRequired: 70, materials: [{ materialId: "mat_opal", quantity: 2 }, { materialId: "mat_stardust_pollen", quantity: 1 }, { materialId: "mat_phoenix_feather", quantity: 1 }], resultItemId: "ench_speed", resultQuantity: 1, craftTime: 24, discoverable: false, xpGain: 200, description: "Grant one extra attack per round. Extraordinarily rare." },
];

// ── Recipes: Jewelry (12) ────────────────────────────────────────────────────

const JEWELRY_RECIPES: Recipe[] = [
  { id: "rc_copper_ring",         name: "Copper Ring",               skill: "jewelcrafting", skillRequired: 1,  materials: [{ materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_copper_ring", resultQuantity: 1, craftTime: 2, discoverable: false, xpGain: 5, description: "A plain copper band. Good for practice." },
  { id: "rc_amethyst_pendant",    name: "Amethyst Pendant",          skill: "jewelcrafting", skillRequired: 10, materials: [{ materialId: "mat_amethyst", quantity: 1 }, { materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_amethyst_pendant", resultQuantity: 1, craftTime: 4, discoverable: false, xpGain: 18, description: "A simple pendant with a cut amethyst." },
  { id: "rc_ring_protection_1",   name: "Ring of Protection +1",     skill: "jewelcrafting", skillRequired: 30, materials: [{ materialId: "mat_electrum", quantity: 2 }, { materialId: "mat_amethyst", quantity: 2 }, { materialId: "mat_moonpetal", quantity: 2 }], resultItemId: "craft_ring_protection_1", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 55, description: "A ring that deflects blows slightly. +1 deflection to AC." },
  { id: "rc_amu_health_2",        name: "Amulet of Health +2",       skill: "jewelcrafting", skillRequired: 35, materials: [{ materialId: "mat_emerald", quantity: 1 }, { materialId: "mat_electrum", quantity: 2 }, { materialId: "mat_lifeleaf", quantity: 3 }], resultItemId: "amu_health_2", resultQuantity: 1, craftTime: 12, discoverable: false, xpGain: 65, description: "An amulet pulsing with vitality. +2 CON." },
  { id: "rc_amu_nat_armor_1",     name: "Amulet of Natural Armor +1", skill: "jewelcrafting", skillRequired: 30, materials: [{ materialId: "mat_beast_fang", quantity: 2 }, { materialId: "mat_hardened_leather", quantity: 1 }, { materialId: "mat_electrum", quantity: 1 }], resultItemId: "amu_nat_armor_1", resultQuantity: 1, craftTime: 10, discoverable: true, xpGain: 55, description: "An amulet carved from fang and bound in gold. +1 natural armor." },
  { id: "rc_amu_nat_armor_2",     name: "Amulet of Natural Armor +2", skill: "jewelcrafting", skillRequired: 50, materials: [{ materialId: "mat_dragon_scale", quantity: 1 }, { materialId: "mat_orichalcum", quantity: 1 }, { materialId: "mat_emerald", quantity: 1 }], resultItemId: "amu_nat_armor_2", resultQuantity: 1, craftTime: 16, discoverable: false, xpGain: 100, description: "An amulet reinforced with dragon scale. +2 natural armor." },
  { id: "rc_amu_periapt_wisdom_2", name: "Periapt of Wisdom +2",     skill: "jewelcrafting", skillRequired: 40, materials: [{ materialId: "mat_sapphire", quantity: 2 }, { materialId: "mat_moonsilver", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 3 }], resultItemId: "amu_periapt_wisdom_2", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 80, description: "A sapphire periapt that sharpens the mind. +2 WIS." },
  { id: "rc_amu_necklace_fireballs", name: "Necklace of Fireballs",  skill: "jewelcrafting", skillRequired: 55, materials: [{ materialId: "mat_ruby", quantity: 4 }, { materialId: "mat_orichalcum", quantity: 2 }, { materialId: "mat_firecap", quantity: 5 }], resultItemId: "amu_necklace_fireballs", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 140, description: "Rubies strung on orichalcum links, each containing a fireball." },
  { id: "rc_ruby_ring_fire",      name: "Ruby Ring of Fire Resistance", skill: "jewelcrafting", skillRequired: 35, materials: [{ materialId: "mat_ruby", quantity: 2 }, { materialId: "mat_electrum", quantity: 1 }, { materialId: "mat_frostmint", quantity: 2 }], resultItemId: "craft_ruby_ring_fire", resultQuantity: 1, craftTime: 10, discoverable: true, xpGain: 60, description: "A ring set with rubies that grants fire resistance 5." },
  { id: "rc_crown_stars",         name: "Crown of Stars",            skill: "jewelcrafting", skillRequired: 85, materials: [{ materialId: "mat_starmetal", quantity: 2 }, { materialId: "mat_moonsilver", quantity: 2 }, { materialId: "mat_diamond", quantity: 3 }, { materialId: "mat_void_crystal", quantity: 1 }], resultItemId: "craft_crown_stars", resultQuantity: 1, craftTime: 40, discoverable: false, xpGain: 350, description: "A crown of cosmic power. Stars orbit the wearer's head." },
  { id: "rc_amu_scarab",          name: "Scarab of Protection",      skill: "jewelcrafting", skillRequired: 70, materials: [{ materialId: "mat_opal", quantity: 2 }, { materialId: "mat_diamond", quantity: 1 }, { materialId: "mat_angel_tear", quantity: 1 }, { materialId: "mat_orichalcum", quantity: 2 }], resultItemId: "amu_scarab_protection", resultQuantity: 1, craftTime: 28, discoverable: false, xpGain: 220, description: "An ancient protective scarab that absorbs death effects." },
  { id: "rc_amu_brooch_shielding", name: "Brooch of Shielding",      skill: "jewelcrafting", skillRequired: 25, materials: [{ materialId: "mat_electrum", quantity: 2 }, { materialId: "mat_amethyst", quantity: 1 }, { materialId: "mat_fungal_spore", quantity: 2 }], resultItemId: "amu_brooch_shielding", resultQuantity: 1, craftTime: 8, discoverable: true, xpGain: 40, description: "Absorbs magic missile damage. Holds 50 points." },
];

// ── Recipes: Scrolls (10) ────────────────────────────────────────────────────

const SCROLL_RECIPES: Recipe[] = [
  { id: "rc_scr_magic_missile",   name: "Scroll of Magic Missile",    skill: "inscription", skillRequired: 5,  materials: [{ materialId: "mat_moonpetal", quantity: 1 }, { materialId: "mat_fungal_spore", quantity: 1 }], resultItemId: "scr_magic_missile", resultQuantity: 1, craftTime: 3, discoverable: true, xpGain: 10, description: "A scroll containing the Magic Missile spell." },
  { id: "rc_scr_mage_armor",      name: "Scroll of Mage Armor",       skill: "inscription", skillRequired: 8,  materials: [{ materialId: "mat_slime_gel", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 1 }], resultItemId: "scr_mage_armor", resultQuantity: 1, craftTime: 3, discoverable: true, xpGain: 12, description: "A scroll containing the Mage Armor spell." },
  { id: "rc_scr_fireball",        name: "Scroll of Fireball",         skill: "inscription", skillRequired: 30, materials: [{ materialId: "mat_firecap", quantity: 3 }, { materialId: "mat_ruby", quantity: 1 }], resultItemId: "scr_fireball", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 50, description: "A scroll containing the Fireball spell." },
  { id: "rc_scr_lightning_bolt",   name: "Scroll of Lightning Bolt",   skill: "inscription", skillRequired: 30, materials: [{ materialId: "mat_electrum", quantity: 1 }, { materialId: "mat_elemental_core", quantity: 1 }], resultItemId: "scr_lightning_bolt", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 50, description: "A scroll containing the Lightning Bolt spell." },
  { id: "rc_scr_haste",           name: "Scroll of Haste",            skill: "inscription", skillRequired: 35, materials: [{ materialId: "mat_firecap", quantity: 2 }, { materialId: "mat_frostmint", quantity: 2 }, { materialId: "mat_opal", quantity: 1 }], resultItemId: "scr_haste", resultQuantity: 1, craftTime: 10, discoverable: false, xpGain: 65, description: "A scroll containing the Haste spell." },
  { id: "rc_scr_stoneskin",        name: "Scroll of Stoneskin",        skill: "inscription", skillRequired: 45, materials: [{ materialId: "mat_elemental_core", quantity: 1 }, { materialId: "mat_diamond", quantity: 1 }, { materialId: "mat_iron_ore", quantity: 2 }], resultItemId: "scr_stoneskin", resultQuantity: 1, craftTime: 12, discoverable: false, xpGain: 90, description: "A scroll containing the Stoneskin spell." },
  { id: "rc_scr_teleport",        name: "Scroll of Teleport",         skill: "inscription", skillRequired: 55, materials: [{ materialId: "mat_opal", quantity: 2 }, { materialId: "mat_stardust_pollen", quantity: 1 }], resultItemId: "scr_teleport", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 120, description: "A scroll containing the Teleport spell." },
  { id: "rc_scr_raise_dead",      name: "Scroll of Raise Dead",       skill: "inscription", skillRequired: 60, materials: [{ materialId: "mat_phoenix_ash", quantity: 1 }, { materialId: "mat_diamond", quantity: 1 }, { materialId: "mat_lifeleaf", quantity: 3 }], resultItemId: "scr_raise_dead", resultQuantity: 1, craftTime: 18, discoverable: false, xpGain: 150, description: "A scroll containing the Raise Dead spell." },
  { id: "rc_scr_disintegrate",    name: "Scroll of Disintegrate",     skill: "inscription", skillRequired: 70, materials: [{ materialId: "mat_void_crystal", quantity: 1 }, { materialId: "mat_demon_heart", quantity: 1 }], resultItemId: "scr_disintegrate", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 180, description: "A scroll containing the Disintegrate spell." },
  { id: "rc_scr_power_word_kill", name: "Scroll of Power Word Kill",  skill: "inscription", skillRequired: 90, materials: [{ materialId: "mat_void_crystal", quantity: 1 }, { materialId: "mat_dragon_blood", quantity: 1 }, { materialId: "mat_stardust_pollen", quantity: 2 }, { materialId: "mat_demon_heart", quantity: 1 }], resultItemId: "scr_power_word_kill", resultQuantity: 1, craftTime: 30, discoverable: false, xpGain: 400, description: "A scroll of ultimate power. One word, and the target dies." },
];

// ── Recipes: Utility (6) ─────────────────────────────────────────────────────

const UTILITY_RECIPES: Recipe[] = [
  { id: "rc_lockpicks",           name: "Masterwork Lockpicks",      skill: "blacksmithing", skillRequired: 20, materials: [{ materialId: "mat_steel_ingot", quantity: 1 }, { materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_lockpicks", resultQuantity: 1, craftTime: 4, discoverable: true, xpGain: 25, description: "A set of fine lockpicks. +2 to Open Lock checks." },
  { id: "rc_everburning_torch",   name: "Everburning Torch",         skill: "alchemy", skillRequired: 15, materials: [{ materialId: "mat_oak", quantity: 1 }, { materialId: "mat_firecap", quantity: 2 }, { materialId: "mat_slime_gel", quantity: 1 }], resultItemId: "craft_everburning_torch", resultQuantity: 1, craftTime: 4, discoverable: true, xpGain: 20, description: "A torch with an alchemical flame that never dies." },
  { id: "rc_silk_rope",           name: "Silk Rope (50 ft)",         skill: "leatherworking", skillRequired: 10, materials: [{ materialId: "mat_silk", quantity: 3 }], resultItemId: "craft_silk_rope", resultQuantity: 1, craftTime: 4, discoverable: false, xpGain: 15, description: "Strong, light rope woven from silk. Half weight of hemp." },
  { id: "rc_bag_holding",         name: "Bag of Holding (Small)",    skill: "leatherworking", skillRequired: 50, materials: [{ materialId: "mat_spidersilk", quantity: 3 }, { materialId: "mat_mageweave", quantity: 2 }, { materialId: "mat_void_crystal", quantity: 1 }], resultItemId: "craft_bag_holding", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 130, description: "A bag with extraplanar space inside. Holds 250 lbs in a 15 lb bag." },
  { id: "rc_camping_kit",         name: "Camping Kit",               skill: "leatherworking", skillRequired: 5,  materials: [{ materialId: "mat_leather", quantity: 2 }, { materialId: "mat_oak", quantity: 1 }], resultItemId: "craft_camping_kit", resultQuantity: 1, craftTime: 4, discoverable: true, xpGain: 10, description: "Bedroll, tarp, and stakes. Proper rest in the wilderness." },
  { id: "rc_alchemists_fire",     name: "Alchemist's Fire",          skill: "alchemy", skillRequired: 20, materials: [{ materialId: "mat_firecap", quantity: 2 }, { materialId: "mat_slime_gel", quantity: 2 }, { materialId: "mat_iron_ore", quantity: 1 }], resultItemId: "craft_alchemists_fire", resultQuantity: 3, craftTime: 6, discoverable: true, xpGain: 30, description: "Volatile flasks that ignite on impact. 1d6 fire, splashes." },
];

// ── Recipes: Wondrous Items (from jewelcrafting/enchanting, filling to 80+) ──

const WONDROUS_RECIPES: Recipe[] = [
  { id: "rc_boots_speed",         name: "Boots of Speed",            skill: "enchanting", skillRequired: 55, materials: [{ materialId: "mat_hardened_leather", quantity: 3 }, { materialId: "mat_opal", quantity: 2 }, { materialId: "mat_firecap", quantity: 3 }], resultItemId: "won_boots_speed", resultQuantity: 1, craftTime: 20, discoverable: false, xpGain: 140, description: "Boots that grant Haste for 10 rounds/day." },
  { id: "rc_boots_elvenkind",     name: "Boots of Elvenkind",        skill: "leatherworking", skillRequired: 30, materials: [{ materialId: "mat_spidersilk", quantity: 2 }, { materialId: "mat_hardened_leather", quantity: 2 }, { materialId: "mat_moonpetal", quantity: 2 }], resultItemId: "won_boots_elvenkind", resultQuantity: 1, craftTime: 12, discoverable: true, xpGain: 55, description: "Boots that muffle all sound. +5 to Move Silently." },
  { id: "rc_cloak_resistance_1",  name: "Cloak of Resistance +1",   skill: "enchanting", skillRequired: 20, materials: [{ materialId: "mat_silk", quantity: 2 }, { materialId: "mat_amethyst", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 2 }], resultItemId: "won_cloak_resistance_1", resultQuantity: 1, craftTime: 8, discoverable: false, xpGain: 35, description: "A cloak that bolsters all saving throws by +1." },
  { id: "rc_cloak_elvenkind",     name: "Cloak of Elvenkind",        skill: "leatherworking", skillRequired: 35, materials: [{ materialId: "mat_silk", quantity: 3 }, { materialId: "mat_shadow_cloth", quantity: 1 }, { materialId: "mat_moonpetal", quantity: 3 }], resultItemId: "won_cloak_elvenkind", resultQuantity: 1, craftTime: 14, discoverable: true, xpGain: 65, description: "A cloak that shifts color to match surroundings. +5 Hide." },
  { id: "rc_gauntlets_ogre",      name: "Gauntlets of Ogre Power",  skill: "blacksmithing", skillRequired: 40, materials: [{ materialId: "mat_steel_ingot", quantity: 3 }, { materialId: "mat_beast_fang", quantity: 3 }, { materialId: "mat_ruby", quantity: 1 }], resultItemId: "won_gauntlets_ogre", resultQuantity: 1, craftTime: 14, discoverable: false, xpGain: 80, description: "Iron gauntlets that grant STR +2." },
  { id: "rc_cloak_displacement",  name: "Cloak of Displacement",    skill: "enchanting", skillRequired: 60, materials: [{ materialId: "mat_shadow_cloth", quantity: 3 }, { materialId: "mat_opal", quantity: 1 }, { materialId: "mat_undead_essence", quantity: 2 }], resultItemId: "won_cloak_displacement", resultQuantity: 1, craftTime: 22, discoverable: false, xpGain: 160, description: "The wearer's image is displaced, granting 50% miss chance." },
  { id: "rc_wings_flying",        name: "Wings of Flying",           skill: "enchanting", skillRequired: 75, materials: [{ materialId: "mat_phoenix_feather", quantity: 2 }, { materialId: "mat_mageweave", quantity: 3 }, { materialId: "mat_stardust_pollen", quantity: 1 }], resultItemId: "won_wings_flying", resultQuantity: 1, craftTime: 30, discoverable: false, xpGain: 250, description: "Magical wings that unfold from a cape. Fly speed 60 ft." },
  { id: "rc_cloak_arachnida",     name: "Cloak of Arachnida",       skill: "leatherworking", skillRequired: 55, materials: [{ materialId: "mat_spidersilk", quantity: 5 }, { materialId: "mat_shadow_cloth", quantity: 2 }, { materialId: "mat_venombloom", quantity: 2 }], resultItemId: "won_cloak_arachnida", resultQuantity: 1, craftTime: 20, discoverable: true, xpGain: 130, description: "Spider climb at will, web 1/day, immune to web effects." },
];

// ── Combined Recipe List ─────────────────────────────────────────────────────

export const ALL_RECIPES: Recipe[] = [
  ...WEAPON_RECIPES,
  ...ARMOR_RECIPES,
  ...POTION_RECIPES,
  ...ENCHANTMENT_RECIPES,
  ...JEWELRY_RECIPES,
  ...SCROLL_RECIPES,
  ...UTILITY_RECIPES,
  ...WONDROUS_RECIPES,
];

/** Find a recipe by ID */
export function getRecipe(id: string): Recipe | undefined {
  return ALL_RECIPES.find(r => r.id === id);
}

/** Get all recipes for a given skill */
export function getRecipesBySkill(skill: CraftingSkill): Recipe[] {
  return ALL_RECIPES.filter(r => r.skill === skill);
}

// ── Inventory Types ──────────────────────────────────────────────────────────

export type MaterialStack = {
  materialId: string;
  quantity: number;
};

export type PlayerCraftingState = {
  playerId: string;
  materials: MaterialStack[];
  skills: SkillProgress[];
  knownRecipes: string[];       // recipe IDs the player has discovered
  discoveredByExperiment: string[];  // recipes found through experimentation
};

// ── Core Crafting API ────────────────────────────────────────────────────────

export type CraftAttemptResult = {
  success: boolean;
  quality: CraftQuality;
  resultItemId: string;
  resultQuantity: number;
  qualityMultiplier: number;
  xpGained: number;
  materialsConsumed: RecipeMaterial[];
  description: string;
};

export type ExperimentResult = {
  discoveredRecipe: Recipe | null;
  materialsLost: RecipeMaterial[];
  xpGained: number;
  hint: string;
  description: string;
};

/**
 * Get all materials a player currently holds.
 */
export function getMaterials(state: PlayerCraftingState): MaterialStack[] {
  return state.materials.filter(m => m.quantity > 0);
}

/**
 * Get all recipes the player knows.
 */
export function getKnownRecipes(state: PlayerCraftingState): Recipe[] {
  return ALL_RECIPES.filter(r => state.knownRecipes.includes(r.id));
}

/**
 * Check if a recipe can be crafted given current inventory.
 */
export function canCraft(recipe: Recipe, materials: MaterialStack[]): boolean {
  for (const req of recipe.materials) {
    const stack = materials.find(m => m.materialId === req.materialId);
    if (!stack || stack.quantity < req.quantity) return false;
  }
  return true;
}

/**
 * Get skill level for a given crafting skill.
 */
export function getSkillLevel(state: PlayerCraftingState, skill: CraftingSkill): number {
  const progress = state.skills.find(s => s.skill === skill);
  return progress ? progress.level : 0;
}

/**
 * Attempt to craft a recipe. Consumes materials and returns result.
 * Requires: player knows recipe, has materials, has sufficient skill, is at correct station.
 */
export function craft(
  state: PlayerCraftingState,
  recipe: Recipe,
  stationAvailable: CraftingStation
): CraftAttemptResult {
  // Validate station
  const skillInfo = CRAFTING_SKILLS.find(s => s.id === recipe.skill);
  if (!skillInfo || skillInfo.station !== stationAvailable) {
    return {
      success: false,
      quality: "poor",
      resultItemId: "",
      resultQuantity: 0,
      qualityMultiplier: 0,
      xpGained: 0,
      materialsConsumed: [],
      description: `You need a ${skillInfo?.station ?? "proper station"} to craft this.`,
    };
  }

  // Validate skill level
  const currentLevel = getSkillLevel(state, recipe.skill);
  if (currentLevel < recipe.skillRequired) {
    return {
      success: false,
      quality: "poor",
      resultItemId: "",
      resultQuantity: 0,
      qualityMultiplier: 0,
      xpGained: 0,
      materialsConsumed: [],
      description: `Your ${recipe.skill} skill is too low. Need level ${recipe.skillRequired}, have ${currentLevel}.`,
    };
  }

  // Validate materials
  if (!canCraft(recipe, state.materials)) {
    return {
      success: false,
      quality: "poor",
      resultItemId: "",
      resultQuantity: 0,
      qualityMultiplier: 0,
      xpGained: 0,
      materialsConsumed: [],
      description: "You don't have the required materials.",
    };
  }

  // Consume materials
  for (const req of recipe.materials) {
    const stack = state.materials.find(m => m.materialId === req.materialId);
    if (stack) stack.quantity -= req.quantity;
  }

  // Roll quality
  const quality = rollQuality(currentLevel, recipe.skillRequired);
  const multiplier = QUALITY_MULTIPLIERS[quality];

  // Calculate XP (bonus for higher quality)
  const qualityXpBonus = quality === "masterwork" ? 2.0 : quality === "superior" ? 1.5 : quality === "fine" ? 1.2 : 1.0;
  const xpGained = Math.floor(recipe.xpGain * qualityXpBonus);

  // Update skill XP
  const skillProgress = state.skills.find(s => s.skill === recipe.skill);
  if (skillProgress) {
    const updated = addSkillXp(skillProgress, xpGained);
    Object.assign(skillProgress, updated);
  }

  const qualityLabel = quality === "normal" ? "" : ` (${QUALITY_LABELS[quality]})`;

  return {
    success: true,
    quality,
    resultItemId: recipe.resultItemId,
    resultQuantity: recipe.resultQuantity,
    qualityMultiplier: multiplier,
    xpGained,
    materialsConsumed: recipe.materials,
    description: `You craft a${qualityLabel} ${recipe.name}! [+${xpGained} XP]`,
  };
}

// ── Experimentation System ───────────────────────────────────────────────────

/**
 * Attempt to discover a recipe by combining 2-4 materials without knowing a recipe.
 * If the materials match a discoverable recipe, it's discovered.
 * Otherwise, materials are lost and a hint is given.
 */
export function experiment(
  state: PlayerCraftingState,
  materialIds: string[]
): ExperimentResult {
  if (materialIds.length < 2 || materialIds.length > 4) {
    return {
      discoveredRecipe: null,
      materialsLost: [],
      xpGained: 0,
      hint: "You need 2 to 4 materials to experiment.",
      description: "You stare at the materials but aren't sure what to try.",
    };
  }

  // Check if materials are available
  const materialsNeeded: RecipeMaterial[] = [];
  const counted: Record<string, number> = {};
  for (const id of materialIds) {
    counted[id] = (counted[id] ?? 0) + 1;
  }
  for (const [id, qty] of Object.entries(counted)) {
    materialsNeeded.push({ materialId: id, quantity: qty });
    const stack = state.materials.find(m => m.materialId === id);
    if (!stack || stack.quantity < qty) {
      return {
        discoveredRecipe: null,
        materialsLost: [],
        xpGained: 0,
        hint: `You don't have enough ${getMaterial(id)?.name ?? id}.`,
        description: "You check your pack but come up short.",
      };
    }
  }

  // Check all discoverable recipes the player hasn't found yet
  const discoverableRecipes = ALL_RECIPES.filter(
    r => r.discoverable && !state.knownRecipes.includes(r.id)
  );

  // Check for match: all recipe materials must be present in experiment
  let matchedRecipe: Recipe | null = null;
  for (const recipe of discoverableRecipes) {
    const recipeMatIds: Record<string, number> = {};
    for (const rm of recipe.materials) {
      recipeMatIds[rm.materialId] = (recipeMatIds[rm.materialId] ?? 0) + rm.quantity;
    }
    // Check if experiment materials are a superset of recipe materials
    let allPresent = true;
    for (const [matId, qty] of Object.entries(recipeMatIds)) {
      if ((counted[matId] ?? 0) < qty) {
        allPresent = false;
        break;
      }
    }
    if (allPresent) {
      matchedRecipe = recipe;
      break;
    }
  }

  // Consume materials regardless
  for (const { materialId, quantity } of materialsNeeded) {
    const stack = state.materials.find(m => m.materialId === materialId);
    if (stack) stack.quantity -= quantity;
  }

  if (matchedRecipe) {
    // Discovery!
    state.knownRecipes.push(matchedRecipe.id);
    state.discoveredByExperiment.push(matchedRecipe.id);

    // Bonus XP for discovery
    const xpGained = Math.floor(matchedRecipe.xpGain * 1.5);
    const skillProgress = state.skills.find(s => s.skill === matchedRecipe!.skill);
    if (skillProgress) {
      const updated = addSkillXp(skillProgress, xpGained);
      Object.assign(skillProgress, updated);
    }

    return {
      discoveredRecipe: matchedRecipe,
      materialsLost: materialsNeeded,
      xpGained,
      hint: "",
      description: `Eureka! You discover how to craft: ${matchedRecipe.name}! [+${xpGained} XP]`,
    };
  }

  // Failed experiment — give hint about closest match
  const hint = generateExperimentHint(counted, discoverableRecipes);
  const xpGained = 5; // small consolation XP

  const skillToUse = guessSkillFromMaterials(materialIds);
  if (skillToUse) {
    const skillProgress = state.skills.find(s => s.skill === skillToUse);
    if (skillProgress) {
      const updated = addSkillXp(skillProgress, xpGained);
      Object.assign(skillProgress, updated);
    }
  }

  return {
    discoveredRecipe: null,
    materialsLost: materialsNeeded,
    xpGained,
    hint,
    description: `The combination fizzles. Materials are lost. ${hint} [+${xpGained} XP]`,
  };
}

/** Generate a hint about what recipe might be close */
function generateExperimentHint(
  usedMats: Record<string, number>,
  discoverableRecipes: Recipe[]
): string {
  let bestOverlap = 0;
  let closestRecipe: Recipe | null = null;

  for (const recipe of discoverableRecipes) {
    let overlap = 0;
    for (const rm of recipe.materials) {
      if (usedMats[rm.materialId]) {
        overlap += Math.min(usedMats[rm.materialId], rm.quantity);
      }
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      closestRecipe = recipe;
    }
  }

  if (!closestRecipe || bestOverlap === 0) {
    return "These materials have no affinity for each other.";
  }

  const missingCount = closestRecipe.materials.reduce((sum, rm) => {
    const have = usedMats[rm.materialId] ?? 0;
    return sum + Math.max(0, rm.quantity - have);
  }, 0);

  if (missingCount === 0) {
    return "You sense you had the right ingredients but something was off about the proportions...";
  } else if (missingCount === 1) {
    return "You feel very close to something. Perhaps one more ingredient...";
  } else if (missingCount <= 3) {
    const skillInfo = CRAFTING_SKILLS.find(s => s.id === closestRecipe!.skill);
    return `The materials hint at ${skillInfo?.name ?? "something"}. You need ${missingCount} more components.`;
  }

  return "A faint reaction occurs — you're on the right track but far from a result.";
}

/** Guess which skill would apply based on material categories */
function guessSkillFromMaterials(materialIds: string[]): CraftingSkill | null {
  const categories = materialIds.map(id => getMaterial(id)?.category).filter(Boolean);
  if (categories.includes("metal")) return "blacksmithing";
  if (categories.includes("herb")) return "alchemy";
  if (categories.includes("gem")) return "jewelcrafting";
  if (categories.includes("leather_cloth")) return "leatherworking";
  return "alchemy"; // default fallback
}

// ── Gathering System ─────────────────────────────────────────────────────────

export type GatherResult = {
  materials: MaterialStack[];
  xpGained: number;
  description: string;
};

/** Map hex terrain + resources to possible materials */
const TERRAIN_MATERIALS: Record<Terrain, string[]> = {
  mountain:  ["mat_iron_ore", "mat_cold_iron", "mat_electrum", "mat_amethyst", "mat_sapphire", "mat_ruby", "mat_diamond"],
  highlands: ["mat_iron_ore", "mat_amethyst", "mat_ash"],
  volcanic:  ["mat_orichalcum", "mat_dark_iron", "mat_adamantine", "mat_firecap", "mat_ruby", "mat_opal", "mat_elemental_core"],
  forest:    ["mat_oak", "mat_ash", "mat_ironwood", "mat_darkwood", "mat_moonpetal", "mat_lifeleaf", "mat_leather", "mat_beast_fang", "mat_silk", "mat_emerald"],
  jungle:    ["mat_darkwood", "mat_silk", "mat_venombloom", "mat_lifeleaf", "mat_spidersilk", "mat_beast_fang", "mat_emerald"],
  swamp:     ["mat_fungal", "mat_shadowroot", "mat_fungal_spore", "mat_venombloom", "mat_undead_essence", "mat_slime_gel", "mat_petrified"],
  fungal:    ["mat_fungal", "mat_crystal_wood", "mat_fungal_spore", "mat_spidersilk", "mat_slime_gel"],
  desert:    ["mat_petrified", "mat_electrum", "mat_opal"],
  snow:      ["mat_cold_iron", "mat_iron_ore", "mat_frostmint", "mat_elemental_core"],
  cursed:    ["mat_dark_iron", "mat_shadowroot", "mat_undead_essence", "mat_shadow_cloth", "mat_onyx"],
  grass:     ["mat_oak", "mat_moonpetal", "mat_leather", "mat_beast_fang", "mat_fungal_spore"],
  plains:    ["mat_oak", "mat_ash", "mat_moonpetal", "mat_leather", "mat_beast_fang"],
  coast:     ["mat_leather", "mat_slime_gel"],
  water:     [],
};

/**
 * Gather materials from the current hex terrain.
 * Uses a gathering skill check (Survival/Search mapped through INT or WIS).
 * @param terrain - the terrain type of the current hex
 * @param gatheringSkill - player's effective gathering skill (Survival ranks + WIS mod)
 * @param hexResources - resources present on this specific hex (from hexWorld)
 */
export function gatherMaterials(
  terrain: Terrain,
  gatheringSkill: number,
  hexResources: Resource[]
): GatherResult {
  const availableMats = TERRAIN_MATERIALS[terrain] || [];
  if (availableMats.length === 0) {
    return { materials: [], xpGained: 0, description: "Nothing useful to gather here." };
  }

  const gathered: MaterialStack[] = [];
  let totalXp = 0;

  // Filter to materials the player can actually find (DC check)
  const attemptable = availableMats
    .map(id => getMaterial(id))
    .filter((m): m is Material => m !== undefined)
    .filter(m => m.gatherDC > 0); // exclude non-gatherable

  if (attemptable.length === 0) {
    return { materials: [], xpGained: 0, description: "Nothing useful to gather here." };
  }

  // Pick 1-3 materials to attempt gathering
  const shuffled = [...attemptable].sort(() => Math.random() - 0.5);
  const attempts = Math.min(shuffled.length, 1 + Math.floor(Math.random() * 2)); // 1-2 attempts

  const descriptions: string[] = [];

  for (let i = 0; i < attempts; i++) {
    const mat = shuffled[i];
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + gatheringSkill;

    if (total >= mat.gatherDC) {
      // Success - quantity depends on how much you beat DC
      const margin = total - mat.gatherDC;
      const qty = 1 + (margin >= 10 ? 1 : 0);

      const existing = gathered.find(g => g.materialId === mat.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        gathered.push({ materialId: mat.id, quantity: qty });
      }

      // XP scales with material tier
      const tierXp = { common: 3, uncommon: 8, rare: 15, epic: 25, legendary: 50 };
      totalXp += tierXp[mat.tier];
      descriptions.push(`Found ${qty}x ${mat.name}`);
    } else {
      descriptions.push(`Searched for ${mat.name} but found nothing`);
    }
  }

  // Bonus materials from hex-specific resources
  if (hexResources.includes("gems") && Math.random() < 0.15) {
    const gemMats = attemptable.filter(m => m.category === "gem");
    if (gemMats.length > 0) {
      const bonusGem = gemMats[Math.floor(Math.random() * gemMats.length)];
      const existing = gathered.find(g => g.materialId === bonusGem.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        gathered.push({ materialId: bonusGem.id, quantity: 1 });
      }
      descriptions.push(`Bonus: spotted a ${bonusGem.name} glinting in the rock!`);
      totalXp += 10;
    }
  }

  const desc = gathered.length > 0
    ? `You spend time gathering. ${descriptions.join(". ")}.`
    : "You search thoroughly but find nothing useful this time.";

  return {
    materials: gathered,
    xpGained: totalXp,
    description: desc,
  };
}

// ── Item Upgrade System ──────────────────────────────────────────────────────

export type UpgradeResult = {
  success: boolean;
  newEnhancementBonus: number;
  materialsConsumed: RecipeMaterial[];
  description: string;
};

/** Materials required per upgrade tier */
const UPGRADE_COSTS: Record<number, RecipeMaterial[]> = {
  // +0 -> +1
  1: [{ materialId: "mat_amethyst", quantity: 2 }, { materialId: "mat_moonpetal", quantity: 3 }],
  // +1 -> +2
  2: [{ materialId: "mat_sapphire", quantity: 2 }, { materialId: "mat_orichalcum", quantity: 1 }],
  // +2 -> +3
  3: [{ materialId: "mat_diamond", quantity: 2 }, { materialId: "mat_starmetal", quantity: 1 }, { materialId: "mat_stardust_pollen", quantity: 1 }],
};

/**
 * Upgrade an item's enhancement bonus (+0 -> +1 -> +2 -> +3).
 * Requires enchanting skill and appropriate materials.
 */
export function upgradeItem(
  state: PlayerCraftingState,
  currentBonus: number,
  stationAvailable: CraftingStation
): UpgradeResult {
  if (stationAvailable !== "enchanting_table") {
    return {
      success: false,
      newEnhancementBonus: currentBonus,
      materialsConsumed: [],
      description: "You need an enchanting table to upgrade items.",
    };
  }

  const targetBonus = currentBonus + 1;
  if (targetBonus > 3) {
    return {
      success: false,
      newEnhancementBonus: currentBonus,
      materialsConsumed: [],
      description: "This item is already at maximum enhancement (+3).",
    };
  }

  const cost = UPGRADE_COSTS[targetBonus];
  if (!cost) {
    return {
      success: false,
      newEnhancementBonus: currentBonus,
      materialsConsumed: [],
      description: "Unknown upgrade tier.",
    };
  }

  // Check enchanting skill requirement
  const requiredLevel = targetBonus * 20; // +1=20, +2=40, +3=60
  const enchantingLevel = getSkillLevel(state, "enchanting");
  if (enchantingLevel < requiredLevel) {
    return {
      success: false,
      newEnhancementBonus: currentBonus,
      materialsConsumed: [],
      description: `Enchanting level ${requiredLevel} required. You have ${enchantingLevel}.`,
    };
  }

  // Check materials
  if (!canCraft({ materials: cost } as Recipe, state.materials)) {
    return {
      success: false,
      newEnhancementBonus: currentBonus,
      materialsConsumed: [],
      description: "You lack the materials for this upgrade.",
    };
  }

  // Consume materials
  for (const req of cost) {
    const stack = state.materials.find(m => m.materialId === req.materialId);
    if (stack) stack.quantity -= req.quantity;
  }

  return {
    success: true,
    newEnhancementBonus: targetBonus,
    materialsConsumed: cost,
    description: `The item surges with power! Enhanced to +${targetBonus}.`,
  };
}

// ── Gem Socket System ────────────────────────────────────────────────────────

export type SocketSlot = {
  index: number;
  gemId: string | null;     // material ID of socketed gem, or null if empty
  bonusType: string;        // what stat/effect the socket provides
  bonusValue: number;
};

export type SocketableItem = {
  itemId: string;
  sockets: SocketSlot[];
  maxSockets: number;       // 0-3 based on item rarity
};

/** Gem effect mapping - what each gem does when socketed */
export const GEM_SOCKET_EFFECTS: Record<string, { bonusType: string; bonusValue: number; description: string }> = {
  mat_ruby:         { bonusType: "fire_damage",    bonusValue: 2,  description: "+2 fire damage" },
  mat_sapphire:     { bonusType: "cold_damage",    bonusValue: 2,  description: "+2 cold damage" },
  mat_emerald:      { bonusType: "regen",          bonusValue: 1,  description: "Regenerate 1 HP/round" },
  mat_diamond:      { bonusType: "all_saves",      bonusValue: 1,  description: "+1 to all saving throws" },
  mat_amethyst:     { bonusType: "spell_resist",   bonusValue: 2,  description: "+2 spell resistance" },
  mat_onyx:         { bonusType: "necrotic_damage", bonusValue: 2, description: "+2 necrotic damage" },
  mat_opal:         { bonusType: "all_damage",     bonusValue: 1,  description: "+1 to all damage" },
  mat_void_crystal: { bonusType: "crit_range",     bonusValue: 1,  description: "Critical range expanded by 1" },
};

/** Determine max sockets based on item rarity */
export function maxSocketsForRarity(rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"): number {
  switch (rarity) {
    case "common": return 0;
    case "uncommon": return 1;
    case "rare": return 2;
    case "epic": return 3;
    case "legendary": return 3;
  }
}

export type SocketResult = {
  success: boolean;
  socket: SocketSlot | null;
  description: string;
};

/**
 * Socket a gem into an item. Requires jewelcrafting skill.
 * The gem is consumed. The socket is filled permanently.
 */
export function socketGem(
  state: PlayerCraftingState,
  item: SocketableItem,
  gemMaterialId: string,
  socketIndex: number
): SocketResult {
  // Validate gem exists in effects table
  const gemEffect = GEM_SOCKET_EFFECTS[gemMaterialId];
  if (!gemEffect) {
    return { success: false, socket: null, description: "That material cannot be socketed." };
  }

  // Validate socket index
  if (socketIndex < 0 || socketIndex >= item.maxSockets) {
    return { success: false, socket: null, description: "Invalid socket slot." };
  }

  // Check socket is empty
  const existingSocket = item.sockets[socketIndex];
  if (existingSocket && existingSocket.gemId !== null) {
    return { success: false, socket: null, description: "That socket is already filled." };
  }

  // Check player has the gem
  const gemStack = state.materials.find(m => m.materialId === gemMaterialId);
  if (!gemStack || gemStack.quantity < 1) {
    return { success: false, socket: null, description: "You don't have that gem." };
  }

  // Check jewelcrafting skill (minimum 15 + 10 per socket index)
  const requiredLevel = 15 + socketIndex * 10;
  const jcLevel = getSkillLevel(state, "jewelcrafting");
  if (jcLevel < requiredLevel) {
    return {
      success: false,
      socket: null,
      description: `Jewelcrafting level ${requiredLevel} required. You have ${jcLevel}.`,
    };
  }

  // Consume gem
  gemStack.quantity -= 1;

  // Fill socket
  const newSocket: SocketSlot = {
    index: socketIndex,
    gemId: gemMaterialId,
    bonusType: gemEffect.bonusType,
    bonusValue: gemEffect.bonusValue,
  };

  item.sockets[socketIndex] = newSocket;

  const gemName = getMaterial(gemMaterialId)?.name ?? "gem";
  return {
    success: true,
    socket: newSocket,
    description: `You carefully set the ${gemName} into the socket. ${gemEffect.description}.`,
  };
}

// ── Player State Initialization ──────────────────────────────────────────────

/** Create a fresh crafting state for a new player */
export function initCraftingState(playerId: string): PlayerCraftingState {
  return {
    playerId,
    materials: [],
    skills: [
      initSkillProgress("blacksmithing"),
      initSkillProgress("leatherworking"),
      initSkillProgress("alchemy"),
      initSkillProgress("enchanting"),
      initSkillProgress("jewelcrafting"),
      initSkillProgress("inscription"),
    ],
    knownRecipes: ALL_RECIPES.filter(r => !r.discoverable).map(r => r.id),
    discoveredByExperiment: [],
  };
}

/** Add materials to player inventory */
export function addMaterials(state: PlayerCraftingState, materialId: string, quantity: number): void {
  const existing = state.materials.find(m => m.materialId === materialId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.materials.push({ materialId, quantity });
  }
}

/** Remove materials from player inventory (returns false if insufficient) */
export function removeMaterials(state: PlayerCraftingState, materialId: string, quantity: number): boolean {
  const existing = state.materials.find(m => m.materialId === materialId);
  if (!existing || existing.quantity < quantity) return false;
  existing.quantity -= quantity;
  return true;
}

// ── Smelting / Material Conversion ───────────────────────────────────────────

export type SmeltRecipe = {
  inputId: string;
  inputQty: number;
  outputId: string;
  outputQty: number;
  skill: CraftingSkill;
  skillRequired: number;
  description: string;
};

export const SMELT_RECIPES: SmeltRecipe[] = [
  { inputId: "mat_iron_ore", inputQty: 2, outputId: "mat_steel_ingot", outputQty: 1, skill: "blacksmithing", skillRequired: 10, description: "Smelt iron ore into a steel ingot at the forge." },
  { inputId: "mat_iron_ore", inputQty: 3, outputId: "mat_cold_iron",   outputQty: 1, skill: "blacksmithing", skillRequired: 20, description: "Forge iron at low temperature to produce cold iron." },
];

/**
 * Smelt/convert raw materials into processed ones.
 */
export function smelt(
  state: PlayerCraftingState,
  smeltRecipe: SmeltRecipe,
  stationAvailable: CraftingStation
): { success: boolean; description: string } {
  if (stationAvailable !== "forge") {
    return { success: false, description: "Smelting requires a forge." };
  }

  const level = getSkillLevel(state, smeltRecipe.skill);
  if (level < smeltRecipe.skillRequired) {
    return { success: false, description: `${smeltRecipe.skill} level ${smeltRecipe.skillRequired} required.` };
  }

  const stack = state.materials.find(m => m.materialId === smeltRecipe.inputId);
  if (!stack || stack.quantity < smeltRecipe.inputQty) {
    return { success: false, description: `Need ${smeltRecipe.inputQty}x ${getMaterial(smeltRecipe.inputId)?.name ?? smeltRecipe.inputId}.` };
  }

  stack.quantity -= smeltRecipe.inputQty;
  addMaterials(state, smeltRecipe.outputId, smeltRecipe.outputQty);

  const outputName = getMaterial(smeltRecipe.outputId)?.name ?? smeltRecipe.outputId;
  return { success: true, description: `Smelted ${smeltRecipe.outputQty}x ${outputName}. ${smeltRecipe.description}` };
}

// ── Recipe Discovery Sources ─────────────────────────────────────────────────

export type RecipeSource = "dungeon_loot" | "npc_vendor" | "experiment" | "quest_reward" | "library";

/**
 * Teach a player a recipe from an external source (NPC, dungeon find, etc).
 * Returns false if already known.
 */
export function learnRecipe(state: PlayerCraftingState, recipeId: string): boolean {
  if (state.knownRecipes.includes(recipeId)) return false;
  const recipe = getRecipe(recipeId);
  if (!recipe) return false;
  state.knownRecipes.push(recipeId);
  return true;
}

/**
 * Get recipes available from a dungeon of given danger level.
 * Higher danger = rarer recipes.
 */
export function getDungeonRecipeDrops(dangerLevel: number): Recipe[] {
  const minSkill = Math.max(1, dangerLevel * 8);
  const maxSkill = dangerLevel * 15;
  return ALL_RECIPES.filter(
    r => r.discoverable && r.skillRequired >= minSkill && r.skillRequired <= maxSkill
  );
}
