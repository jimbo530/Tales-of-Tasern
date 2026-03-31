// ============================================================
// crafting.ts — D&D 3.5-based crafting system for Tales of Tasern
//
// Craft depends on three things:
//   1. TOOLS — what you have (improvised, basic, masterwork)
//   2. LOCATION — where you are (wilderness, camp, workshop, smithy)
//   3. MATERIALS — what raw materials you're carrying
//
// Craft has subcategories that stack:
//   - By MATERIAL: wood, stone, metal, leather, cloth, bone, herb
//   - By TYPE: weaponsmithing, armorsmithing, alchemy, cooking, carpentry, etc.
//   - By SPECIFIC ITEM: e.g. "Craft (longsword)" or "Craft (healing potion)"
//
// The more specific your craft skill, the lower the DC but fewer options.
// A general "Craft" rank applies to everything at higher DC.
// A specific "Craft (longsword)" rank stacks and lowers the DC for longswords.
//
// Roll: d20 + INT mod + craft ranks + specialization bonus + tool bonus + location bonus
// ============================================================

// ── Craft Specializations ───────────────────────────────────────────────────

export type CraftMaterial = "wood" | "stone" | "metal" | "leather" | "cloth" | "bone" | "herb";
export type CraftType = "weaponsmithing" | "armorsmithing" | "bowmaking" | "alchemy" | "cooking"
  | "carpentry" | "masonry" | "leatherworking" | "tailoring" | "trapmaking" | "poisonmaking";

export type CraftSpecialization = {
  id: string;
  name: string;
  type: CraftType;
  materials: CraftMaterial[];       // what materials this spec uses
  dcReduction: number;              // how much this lowers DC vs general craft
  description: string;
};

export const CRAFT_SPECIALIZATIONS: CraftSpecialization[] = [
  // ── By material (broad, small DC reduction) ──
  { id: "craft_wood",    name: "Woodworking",    type: "carpentry",       materials: ["wood"],                dcReduction: 2, description: "Shape wood into tools, handles, shafts, and structures." },
  { id: "craft_stone",   name: "Stoneworking",   type: "masonry",         materials: ["stone"],               dcReduction: 2, description: "Carve and shape stone for tools, walls, and arrowheads." },
  { id: "craft_metal",   name: "Metalworking",   type: "weaponsmithing",  materials: ["metal"],               dcReduction: 2, description: "Forge and shape metal into useful forms." },
  { id: "craft_leather", name: "Leatherworking", type: "leatherworking",  materials: ["leather"],             dcReduction: 2, description: "Tan, cut, and stitch leather into armor and goods." },
  { id: "craft_cloth",   name: "Tailoring",      type: "tailoring",       materials: ["cloth"],               dcReduction: 2, description: "Sew cloth into clothing, bags, and bandages." },
  { id: "craft_bone",    name: "Bonecraft",      type: "carpentry",       materials: ["bone"],                dcReduction: 2, description: "Carve bone into needles, arrowheads, and tools." },
  { id: "craft_herb",    name: "Herbalism",      type: "alchemy",         materials: ["herb"],                dcReduction: 2, description: "Prepare herbs into poultices, teas, and remedies." },

  // ── By type (moderate DC reduction) ──
  { id: "craft_weapons",   name: "Weaponsmithing",  type: "weaponsmithing", materials: ["metal", "wood"],       dcReduction: 4, description: "Forge swords, axes, and other metal weapons." },
  { id: "craft_armor",     name: "Armorsmithing",   type: "armorsmithing",  materials: ["metal", "leather"],    dcReduction: 4, description: "Forge and assemble metal and leather armor." },
  { id: "craft_bows",      name: "Bowmaking",        type: "bowmaking",     materials: ["wood", "bone"],        dcReduction: 4, description: "Craft bows, crossbows, and arrows." },
  { id: "craft_alchemy",   name: "Alchemy",          type: "alchemy",       materials: ["herb", "metal"],       dcReduction: 4, description: "Brew potions, acids, and alchemical compounds." },
  { id: "craft_cooking",   name: "Cooking",          type: "cooking",       materials: ["herb"],                dcReduction: 4, description: "Prepare meals that restore HP and provide buffs." },
  { id: "craft_traps",     name: "Trapmaking",       type: "trapmaking",    materials: ["wood", "metal"],       dcReduction: 4, description: "Build mechanical traps and snares." },
  { id: "craft_poison",    name: "Poisonmaking",     type: "poisonmaking",  materials: ["herb", "bone"],        dcReduction: 4, description: "Distill poisons from natural ingredients." },
];

// ── Tools ───────────────────────────────────────────────────────────────────

export type ToolQuality = "none" | "improvised" | "basic" | "masterwork";

export const TOOL_BONUS: Record<ToolQuality, number> = {
  none: -4,         // crafting without tools is very hard
  improvised: -2,   // rocks, sticks, campfire
  basic: 0,         // standard artisan's tools
  masterwork: 2,    // masterwork artisan's tools
};

// Tools required for each craft type
export const TOOLS_FOR_TYPE: Record<CraftType, string> = {
  weaponsmithing: "smith's tools",
  armorsmithing:  "smith's tools",
  bowmaking:      "woodcarver's tools",
  alchemy:        "alchemist's supplies",
  cooking:        "cook's utensils",
  carpentry:      "carpenter's tools",
  masonry:        "mason's tools",
  leatherworking: "leatherworker's tools",
  tailoring:      "weaver's tools",
  trapmaking:     "tinker's tools",
  poisonmaking:   "poisoner's kit",
};

// ── Location ────────────────────────────────────────────────────────────────

export type CraftLocation = "wilderness" | "camp" | "workshop" | "smithy" | "alchemist_lab";

export const LOCATION_BONUS: Record<CraftLocation, number> = {
  wilderness: -4,     // no shelter, no setup
  camp: -2,           // basic fire and flat surface
  workshop: 0,        // proper workbench and shelter
  smithy: 2,          // forge, anvil, quenching — best for metal
  alchemist_lab: 2,   // proper glassware, burners — best for alchemy
};

// Which locations give their full bonus for which craft types
export const LOCATION_SPECIALTY: Record<CraftLocation, CraftType[]> = {
  wilderness: [],
  camp: [],
  workshop: ["carpentry", "leatherworking", "tailoring", "bowmaking", "trapmaking", "cooking"],
  smithy: ["weaponsmithing", "armorsmithing"],
  alchemist_lab: ["alchemy", "poisonmaking"],
};

/** Get effective location bonus (full bonus only if location matches craft type) */
export function getLocationBonus(location: CraftLocation, craftType: CraftType): number {
  const base = LOCATION_BONUS[location];
  if (base <= 0) return base; // penalties always apply
  const specialties = LOCATION_SPECIALTY[location];
  if (specialties.includes(craftType)) return base;
  return 0; // no bonus if location doesn't match craft type
}

// ── Materials ───────────────────────────────────────────────────────────────

export type MaterialItem = {
  id: string;
  name: string;
  material: CraftMaterial;
  qty: number;
};

// Materials found via Survival, Search, etc. in the field
export const MATERIAL_SOURCES: Record<CraftMaterial, string> = {
  wood:    "Gathered from forests, bought from carpenters",
  stone:   "Gathered from mountains, riverbeds, quarries",
  metal:   "Mined from ore deposits, bought from smiths, salvaged from equipment",
  leather: "Skinned from animals, bought from tanners",
  cloth:   "Harvested from wild flax, bought from weavers, stripped from loot",
  bone:    "Collected from kills, found in dungeons",
  herb:    "Foraged via Survival, bought from alchemists and herbalists",
};

// ── Craftable Recipes ───────────────────────────────────────────────────────

export type CraftRecipe = {
  id: string;
  name: string;
  craftType: CraftType;
  materials: { material: CraftMaterial; qty: number }[];
  baseDC: number;           // DC with general Craft skill
  hoursRequired: number;    // base hours (8h = 1 action)
  resultItemId: string;     // shop item id or custom item id
  resultValue: number;      // gold value of finished item
  description: string;
};

// Sample recipes — more will be added as the game grows
export const RECIPES: CraftRecipe[] = [
  // ── Wilderness basics (low DC, improvised materials) ──
  { id: "r_campfire",       name: "Campfire",           craftType: "carpentry",      materials: [{ material: "wood", qty: 1 }],                          baseDC: 5,  hoursRequired: 1, resultItemId: "craft_campfire",     resultValue: 0,  description: "A proper campfire for cooking and warmth." },
  { id: "r_torch",          name: "Crude Torch",        craftType: "carpentry",      materials: [{ material: "wood", qty: 1 }],                          baseDC: 5,  hoursRequired: 1, resultItemId: "craft_torch",        resultValue: 0,  description: "A wrapped branch that burns for an hour." },
  { id: "r_wooden_club",    name: "Wooden Club",        craftType: "carpentry",      materials: [{ material: "wood", qty: 1 }],                          baseDC: 8,  hoursRequired: 2, resultItemId: "shop_club",          resultValue: 1,  description: "A crude but serviceable bludgeon." },
  { id: "r_wooden_shield",  name: "Wooden Shield",      craftType: "carpentry",      materials: [{ material: "wood", qty: 2 }],                          baseDC: 12, hoursRequired: 4, resultItemId: "shop_light_wooden_shield", resultValue: 3, description: "A round shield lashed together from wood." },
  { id: "r_shortbow",       name: "Shortbow",           craftType: "bowmaking",      materials: [{ material: "wood", qty: 2 }],                          baseDC: 14, hoursRequired: 8, resultItemId: "shop_shortbow",      resultValue: 30, description: "A simple short bow carved from springy wood." },
  { id: "r_arrows_20",      name: "Arrows (20)",        craftType: "bowmaking",      materials: [{ material: "wood", qty: 1 }, { material: "stone", qty: 1 }], baseDC: 10, hoursRequired: 4, resultItemId: "shop_arrows_20",  resultValue: 1, description: "Twenty stone-tipped arrows." },
  { id: "r_stone_knife",    name: "Stone Knife",        craftType: "masonry",        materials: [{ material: "stone", qty: 1 }],                         baseDC: 8,  hoursRequired: 2, resultItemId: "shop_dagger",        resultValue: 1,  description: "A knapped flint blade. Crude but sharp." },
  { id: "r_sling",          name: "Sling",              craftType: "leatherworking", materials: [{ material: "leather", qty: 1 }],                       baseDC: 8,  hoursRequired: 2, resultItemId: "shop_sling",         resultValue: 1,  description: "A leather pouch and cord for hurling stones." },

  // ── Cooking (uses herb materials, restores HP/buffs) ──
  { id: "r_trail_rations",  name: "Trail Rations",      craftType: "cooking",        materials: [{ material: "herb", qty: 1 }],                          baseDC: 8,  hoursRequired: 2, resultItemId: "shop_rations_1",     resultValue: 1,  description: "Dried food that keeps for days." },
  { id: "r_healing_meal",   name: "Healing Stew",       craftType: "cooking",        materials: [{ material: "herb", qty: 2 }],                          baseDC: 15, hoursRequired: 4, resultItemId: "craft_healing_stew",  resultValue: 5,  description: "A hearty stew that restores 1d6 HP." },
  { id: "r_stamina_meal",   name: "Stamina Bread",      craftType: "cooking",        materials: [{ material: "herb", qty: 2 }, { material: "wood", qty: 1 }], baseDC: 18, hoursRequired: 4, resultItemId: "craft_stamina_bread", resultValue: 8, description: "Dense travel bread that reduces food consumption for a day." },

  // ── Alchemy (herb + sometimes metal, creates potions/bombs) ──
  { id: "r_healing_poultice", name: "Healing Poultice",  craftType: "alchemy",       materials: [{ material: "herb", qty: 2 }],                          baseDC: 12, hoursRequired: 4, resultItemId: "craft_poultice",     resultValue: 5,  description: "A healing compress that restores 1d4 HP." },
  { id: "r_antitoxin",       name: "Antitoxin",          craftType: "alchemy",       materials: [{ material: "herb", qty: 3 }],                          baseDC: 18, hoursRequired: 8, resultItemId: "shop_antitoxin",     resultValue: 50, description: "Grants +5 to saves vs poison for 1 hour." },
  { id: "r_alchemists_fire",  name: "Alchemist's Fire",  craftType: "alchemy",       materials: [{ material: "herb", qty: 2 }, { material: "metal", qty: 1 }], baseDC: 20, hoursRequired: 8, resultItemId: "shop_alchemists_fire", resultValue: 20, description: "A volatile flask that ignites on contact." },
  { id: "r_smokestick",      name: "Smokestick",        craftType: "alchemy",       materials: [{ material: "herb", qty: 1 }, { material: "wood", qty: 1 }], baseDC: 15, hoursRequired: 4, resultItemId: "shop_smokestick",    resultValue: 20, description: "Produces thick smoke for concealment." },

  // ── Metalwork (requires smithy ideally) ──
  { id: "r_dagger",         name: "Dagger",             craftType: "weaponsmithing", materials: [{ material: "metal", qty: 1 }],                         baseDC: 12, hoursRequired: 4, resultItemId: "shop_dagger",        resultValue: 2,  description: "A simple metal dagger." },
  { id: "r_shortsword",     name: "Short Sword",        craftType: "weaponsmithing", materials: [{ material: "metal", qty: 2 }],                         baseDC: 15, hoursRequired: 8, resultItemId: "shop_shortsword",    resultValue: 10, description: "A straight-bladed short sword." },
  { id: "r_longsword",      name: "Longsword",          craftType: "weaponsmithing", materials: [{ material: "metal", qty: 3 }],                         baseDC: 18, hoursRequired: 16, resultItemId: "shop_longsword",    resultValue: 15, description: "A well-balanced longsword." },
  { id: "r_chain_shirt",    name: "Chain Shirt",        craftType: "armorsmithing",  materials: [{ material: "metal", qty: 4 }],                         baseDC: 18, hoursRequired: 24, resultItemId: "shop_chain_shirt",  resultValue: 100, description: "Interlocking metal rings forming a flexible shirt." },
  { id: "r_metal_shield",   name: "Heavy Steel Shield", craftType: "armorsmithing",  materials: [{ material: "metal", qty: 3 }],                         baseDC: 15, hoursRequired: 8,  resultItemId: "shop_heavy_steel_shield", resultValue: 20, description: "A sturdy steel shield." },

  // ── Leatherwork ──
  { id: "r_leather_armor",  name: "Leather Armor",      craftType: "leatherworking", materials: [{ material: "leather", qty: 3 }],                       baseDC: 14, hoursRequired: 8, resultItemId: "shop_leather",       resultValue: 10, description: "Cured hide formed into a vest and bracers." },
  { id: "r_studded_leather", name: "Studded Leather",   craftType: "leatherworking", materials: [{ material: "leather", qty: 3 }, { material: "metal", qty: 1 }], baseDC: 16, hoursRequired: 12, resultItemId: "shop_studded_leather", resultValue: 25, description: "Leather reinforced with metal studs." },
  { id: "r_waterskin",      name: "Waterskin",          craftType: "leatherworking", materials: [{ material: "leather", qty: 1 }],                       baseDC: 8,  hoursRequired: 2, resultItemId: "shop_waterskin",     resultValue: 1,  description: "A leather waterskin." },

  // ── Traps ──
  { id: "r_snare",          name: "Snare Trap",         craftType: "trapmaking",     materials: [{ material: "wood", qty: 1 }],                          baseDC: 12, hoursRequired: 4, resultItemId: "craft_snare",        resultValue: 2,  description: "A simple animal snare. Catches small game while you rest." },
  { id: "r_caltrops",       name: "Caltrops",           craftType: "trapmaking",     materials: [{ material: "metal", qty: 1 }],                         baseDC: 14, hoursRequired: 4, resultItemId: "shop_caltrops",      resultValue: 1,  description: "Scattered metal spikes that slow pursuers." },

  // ── Poison (hidden, requires poisonmaking knowledge) ──
  { id: "r_basic_poison",   name: "Blade Venom",        craftType: "poisonmaking",   materials: [{ material: "herb", qty: 3 }, { material: "bone", qty: 1 }], baseDC: 20, hoursRequired: 8, resultItemId: "craft_blade_venom", resultValue: 50, description: "A toxin applied to blades. Extra 1d4 damage for 3 hits." },
];

// ── Craft Check ─────────────────────────────────────────────────────────────

export type CraftCheckInput = {
  intScore: number;                        // character INT stat
  generalCraftRanks: number;               // ranks in general "Craft"
  specializationRanks: Record<string, number>;  // ranks in specific craft specs (e.g. craft_weapons: 3)
  toolQuality: ToolQuality;
  location: CraftLocation;
  recipe: CraftRecipe;
};

export type CraftResult = {
  roll: number;             // d20 roll
  total: number;            // roll + all modifiers
  dc: number;               // effective DC after specialization reductions
  success: boolean;
  quality: "failed" | "poor" | "normal" | "fine" | "masterwork";
  description: string;
  hoursSpent: number;
  materialsConsumed: boolean;   // materials lost even on failure (50% chance)
};

/**
 * Calculate effective DC for a recipe given the player's specializations.
 * The most relevant specialization's dcReduction applies (not stacked).
 */
export function effectiveDC(recipe: CraftRecipe, specializationRanks: Record<string, number>): number {
  let bestReduction = 0;
  for (const spec of CRAFT_SPECIALIZATIONS) {
    if ((specializationRanks[spec.id] ?? 0) > 0 && spec.type === recipe.craftType) {
      bestReduction = Math.max(bestReduction, spec.dcReduction);
    }
  }
  // Also check material-based specializations
  for (const spec of CRAFT_SPECIALIZATIONS) {
    if ((specializationRanks[spec.id] ?? 0) <= 0) continue;
    const recipeMats = recipe.materials.map(m => m.material);
    if (spec.materials.some(m => recipeMats.includes(m))) {
      bestReduction = Math.max(bestReduction, spec.dcReduction);
    }
  }
  return Math.max(5, recipe.baseDC - bestReduction);
}

/**
 * Roll a craft check. Returns quality based on how much you beat the DC by.
 *   - Beat by 10+: masterwork quality (worth 1.5x, bonus stats)
 *   - Beat by 5-9: fine quality (worth 1.2x)
 *   - Beat DC: normal quality
 *   - Miss by 1-4: poor quality (worth 0.5x, fragile)
 *   - Miss by 5+: failed — materials may be lost
 */
export function rollCraftCheck(input: CraftCheckInput): CraftResult {
  const { intScore, generalCraftRanks, specializationRanks, toolQuality, location, recipe } = input;

  const d20 = Math.floor(Math.random() * 20) + 1;
  const intMod = Math.floor((intScore - 10) / 2);
  const toolBonus = TOOL_BONUS[toolQuality];
  const locBonus = getLocationBonus(location, recipe.craftType);

  // Specialization ranks add to the check directly (best matching spec)
  let specRankBonus = 0;
  for (const spec of CRAFT_SPECIALIZATIONS) {
    const ranks = specializationRanks[spec.id] ?? 0;
    if (ranks <= 0) continue;
    if (spec.type === recipe.craftType || spec.materials.some(m => recipe.materials.some(rm => rm.material === m))) {
      specRankBonus = Math.max(specRankBonus, ranks);
    }
  }

  const total = d20 + intMod + generalCraftRanks + specRankBonus + toolBonus + locBonus;
  const dc = effectiveDC(recipe, specializationRanks);
  const margin = total - dc;

  let quality: CraftResult["quality"];
  let description: string;

  if (margin >= 10) {
    quality = "masterwork";
    description = `Exceptional work! You craft a masterwork ${recipe.name} — superior in every way.`;
  } else if (margin >= 5) {
    quality = "fine";
    description = `Well made. Your ${recipe.name} is of fine quality.`;
  } else if (margin >= 0) {
    quality = "normal";
    description = `You successfully craft a ${recipe.name}.`;
  } else if (margin >= -4) {
    quality = "poor";
    description = `Your ${recipe.name} is rough and fragile, but functional.`;
  } else {
    quality = "failed";
    description = `The ${recipe.name} falls apart during crafting. ${Math.random() < 0.5 ? "Some materials are ruined." : "You salvage most materials."}`;
  }

  return {
    roll: d20,
    total,
    dc,
    success: margin >= -4, // poor still produces something
    quality,
    description,
    hoursSpent: recipe.hoursRequired,
    materialsConsumed: quality === "failed" ? Math.random() < 0.5 : true,
  };
}

// ── Available Recipes ───────────────────────────────────────────────────────

/** Get recipes the player can attempt given their materials and location */
export function getAvailableRecipes(
  inventory: MaterialItem[],
  location: CraftLocation,
  craftRanks: number,
  specializationRanks: Record<string, number>,
): CraftRecipe[] {
  return RECIPES.filter(recipe => {
    // Check materials
    for (const req of recipe.materials) {
      const have = inventory
        .filter(i => i.material === req.material)
        .reduce((sum, i) => sum + i.qty, 0);
      if (have < req.qty) return false;
    }
    // Poisonmaking requires specialization (can't attempt untrained)
    if (recipe.craftType === "poisonmaking" && (specializationRanks["craft_poison"] ?? 0) <= 0) return false;
    return true;
  });
}
