// ============================================================
// party.ts — Party & Follower system for Tales of Tasern
//
// Up to 4 NFT heroes in a party. Each hero can have followers
// (hirelings, mercenaries, faction troops, pets) limited by
// Leadership score and carry capacity.
//
// Based on D&D 3.5 Arms & Equipment Guide hireling rules.
// ============================================================

// ── Follower Types ──────────────────────────────────────────────────────────

export type FollowerRole =
  | "melee"         // frontline fighters
  | "ranged"        // archers, slingers
  | "specialist"    // guides, healers, cooks, sages
  | "labor"         // porters, teamsters, farmhands
  | "pet"           // animals (combat or utility)
  | "faction";      // faction-specific unique followers

export type Follower = {
  id: string;               // unique instance id (generated on hire)
  templateId: string;       // shop item id (merc_light_foot, etc.)
  name: string;             // display name (can be customized)
  role: FollowerRole;
  factionId?: string;       // which faction they belong to (affects loyalty)
  level: number;            // follower's effective level
  hp: number;               // current HP
  maxHp: number;            // max HP
  attack: number;           // combat bonus
  ac: number;               // armor class
  dailyCost: number;        // copper per day to maintain (0 = free/pet)
  foodCost: number;         // food per day (most = 1, ogres = 3, etc.)
  abilities: string[];      // special abilities (e.g. "scouting", "healing 1d8+1", "carry +50%")
  morale: number;           // 0-100, drops if unpaid/starving, flees at 0
  alive: boolean;
};

// ── Party Structure ─────────────────────────────────────────────────────────
// A party has up to 4 NFT heroes. Each hero has their own follower slots.
// Follower limit per hero = CHA modifier + level/2 (min 1).

export type PartyHero = {
  nft_address: string;      // NFT contract address (links to NftCharacter)
  isLeader: boolean;        // party leader (first slot, controls movement)
  followers: Follower[];    // this hero's personal followers
};

export type Party = {
  heroes: PartyHero[];      // 1-4 NFT heroes
};

// ── Follower Capacity ───────────────────────────────────────────────────────

/** Max followers a hero can lead = CHA bonus (floor(chaScore/2)), min 1 */
export function maxFollowers(chaScore: number): number {
  return Math.max(1, Math.floor(chaScore / 2));
}

/** Total party follower count */
export function totalFollowers(party: Party): number {
  return party.heroes.reduce((sum, h) => sum + h.followers.length, 0);
}

/** Total daily cost of all followers in party (copper pieces) */
export function totalDailyCost(party: Party): number {
  return party.heroes.reduce((sum, h) =>
    sum + h.followers.reduce((s, f) => s + (f.alive ? f.dailyCost : 0), 0), 0);
}

/** Total daily food cost of all followers in party */
export function totalDailyFood(party: Party): number {
  return party.heroes.reduce((sum, h) =>
    sum + h.followers.reduce((s, f) => s + (f.alive ? f.foodCost : 0), 0), 0);
}

// ── Combat Bonuses ──────────────────────────────────────────────────────────

/** Sum of all alive follower attack bonuses for a hero */
export function followerAttackBonus(hero: PartyHero): number {
  return hero.followers
    .filter(f => f.alive && (f.role === "melee" || f.role === "ranged" || f.role === "faction"))
    .reduce((sum, f) => sum + f.attack, 0);
}

/** Sum of hits followers can absorb (act as damage sponges) */
export function followerHpPool(hero: PartyHero): number {
  return hero.followers
    .filter(f => f.alive && (f.role === "melee" || f.role === "faction"))
    .reduce((sum, f) => sum + f.hp, 0);
}

/** Check if party has a follower with a specific ability */
export function partyHasAbility(party: Party, ability: string): boolean {
  return party.heroes.some(h =>
    h.followers.some(f => f.alive && f.abilities.includes(ability)));
}

// ── Morale ──────────────────────────────────────────────────────────────────
// Morale drops when:
//   - Not paid (-10/day unpaid)
//   - Starving (-15/day without food)
//   - Party loses a battle (-5)
//   - Fellow follower dies (-3)
// Morale recovers when:
//   - Paid on time (+2/day)
//   - Well fed (+1/day)
//   - Party wins a battle (+3)
//   - Rest at inn (+5)
// At morale 0, follower deserts.

export function updateMorale(follower: Follower, delta: number): Follower {
  const newMorale = Math.max(0, Math.min(100, follower.morale + delta));
  return { ...follower, morale: newMorale };
}

/** Check for desertions — returns followers that remain */
export function checkDesertions(followers: Follower[]): { remaining: Follower[]; deserted: Follower[] } {
  const deserted = followers.filter(f => f.alive && f.morale <= 0);
  const remaining = followers.filter(f => !(f.alive && f.morale <= 0));
  return { remaining, deserted };
}

// ── Follower Templates ──────────────────────────────────────────────────────
// Used to create Follower instances from shop purchases.

export type FollowerTemplate = {
  templateId: string;
  name: string;
  role: FollowerRole;
  factionId?: string;
  level: number;
  maxHp: number;
  attack: number;
  ac: number;
  dailyCost: number;        // copper per day
  foodCost: number;
  abilities: string[];
};

// General Mercenary Guild templates (match shop items)
export const GENERAL_TEMPLATES: FollowerTemplate[] = [
  // ══════════════════════════════════════════════════════════════
  // Arms & Equipment Guide p.66 — Table 4-4: Mercenary Equipment
  // Stats: attack = book BAB, ac = book AC, dailyCost in cp
  // HP = level × 5.5 + 3 (warrior d8 + CON 12)
  // ══════════════════════════════════════════════════════════════

  // ── Skirmishers, Foot (Lv 1, 2sp/day = 20cp) ──
  { templateId: "merc_skirm_sling",       name: "Skirmisher (Sling)",         role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"] },
  { templateId: "merc_skirm_axe",         name: "Skirmisher (Throwing Axes)", role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 12, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"] },
  { templateId: "merc_skirm_javelin",     name: "Skirmisher (Javelin)",       role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "absorb_hit"] },
  { templateId: "merc_skirm_shortbow",    name: "Skirmisher (Shortbow)",      role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 12, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"] },
  { templateId: "merc_skirm_crossbow",    name: "Skirmisher (Crossbow)",      role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"] },
  { templateId: "merc_skirm_scimitar",    name: "Skirmisher (Bow & Scimitar)",role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"] },

  // ── Skirmishers, Mounted (Lv 4, 4sp/day = 40cp) ──
  { templateId: "merc_skirm_mt_sling",    name: "Mtd Skirmisher (Sling)",     role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "mounted_charge"] },
  { templateId: "merc_skirm_mt_javelin",  name: "Mtd Skirmisher (Javelin)",   role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 15, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "absorb_hit", "mounted_charge"] },
  { templateId: "merc_skirm_mt_bow",      name: "Mtd Skirmisher (Shortbow)",  role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "covering_fire", "mounted_charge"] },

  // ── Light Foot (Lv 1, 2sp/day = 20cp) ──
  { templateId: "merc_light_battleaxe",   name: "Light Foot (Battleaxe)",     role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["absorb_hit"] },
  { templateId: "merc_light_spear",       name: "Light Foot (Spear & Shield)",role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["absorb_hit"] },
  { templateId: "merc_light_longspear",   name: "Light Foot (Longspear)",     role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["set_against_charge"] },
  { templateId: "merc_light_hvy_xbow",    name: "Light Foot (Heavy Crossbow)",role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"] },
  { templateId: "merc_light_longbow",     name: "Light Foot (Longbow)",       role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"] },
  { templateId: "merc_light_comp_bow",    name: "Light Foot (Comp Longbow)",  role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"] },

  // ── Light Mounted (Lv 4, 4sp/day = 40cp) ──
  { templateId: "merc_light_mt_spear",    name: "Light Cav (Spear & Flail)",  role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"] },
  { templateId: "merc_light_mt_lance",    name: "Light Cav (Lance & Mace)",   role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"] },
  { templateId: "merc_light_mt_scimitar", name: "Light Cav (Scimitar)",       role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"] },

  // ── Medium Foot (Lv 2-5, 4-10sp/day) ──
  { templateId: "merc_med_halberd",       name: "Medium Foot (Halberd)",      role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 14, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"] },
  { templateId: "merc_med_ranseur",       name: "Medium Foot (Ranseur)",      role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 14, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"] },
  { templateId: "merc_med_longsword",     name: "Medium Foot (Longsword)",    role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 15, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"] },
  { templateId: "merc_med_chain",         name: "Medium Foot (Chainmail)",    role: "melee",   level: 3, maxHp: 20, attack: 5, ac: 15, dailyCost: 60, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"] },
  { templateId: "merc_med_splint",        name: "Medium Foot (Splint Mail)",  role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100,foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },
  { templateId: "merc_med_breastplate",   name: "Medium Foot (Breastplate)",  role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100,foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },

  // ── Medium Mounted (Lv 8-9, 16-18sp/day) ──
  { templateId: "merc_med_mt_longsword",  name: "Medium Cav (Longsword)",     role: "melee",   level: 8, maxHp: 50, attack: 11, ac: 16, dailyCost: 160, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "mounted_charge"] },
  { templateId: "merc_med_mt_trident",    name: "Medium Cav (Trident)",       role: "melee",   level: 8, maxHp: 50, attack: 11, ac: 16, dailyCost: 160, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "mounted_charge"] },
  { templateId: "merc_med_mt_breastplate",name: "Medium Cav (Breastplate)",   role: "melee",   level: 9, maxHp: 56, attack: 12, ac: 16, dailyCost: 180, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"] },

  // ── Heavy Foot (Lv 5, 10sp/day = 100cp) ──
  { templateId: "merc_heavy_greatsword",  name: "Heavy Foot (Greatsword)",    role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },
  { templateId: "merc_heavy_mace",        name: "Heavy Foot (Mace & Shield)", role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 18, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },
  { templateId: "merc_heavy_flail",       name: "Heavy Foot (Heavy Flail)",   role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },
  { templateId: "merc_heavy_battleaxe",   name: "Heavy Foot (Battleaxe)",     role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 18, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },
  { templateId: "merc_heavy_greataxe",    name: "Heavy Foot (Greataxe)",      role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"] },

  // ── Heavy Mounted (Lv 10-12, 20-24sp/day) ──
  { templateId: "merc_heavy_mt_warhammer",name: "Heavy Cav (Warhammer)",      role: "melee",   level: 10, maxHp: 62, attack: 13, ac: 19, dailyCost: 200, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"] },
  { templateId: "merc_heavy_mt_pick",     name: "Heavy Cav (Heavy Pick)",     role: "melee",   level: 10, maxHp: 62, attack: 13, ac: 18, dailyCost: 200, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"] },
  { templateId: "merc_heavy_mt_lance",    name: "Heavy Cav (Heavy Lance)",    role: "melee",   level: 12, maxHp: 74, attack: 16, ac: 20, dailyCost: 240, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"] },

  // ── Exotic Troops ──
  { templateId: "merc_goblin",            name: "Goblin Scout",       role: "specialist",  level: 1, maxHp: 5,  attack: 1, ac: 13, dailyCost: 10,  foodCost: 1, abilities: ["scouting"] },
  { templateId: "merc_hobgoblin",         name: "Hobgoblin Soldier",  role: "melee",       level: 1, maxHp: 8,  attack: 1, ac: 14, dailyCost: 20,  foodCost: 1, abilities: ["absorb_hit"] },
  { templateId: "merc_gnoll",             name: "Gnoll Brute",        role: "melee",       level: 2, maxHp: 14, attack: 3, ac: 13, dailyCost: 20,  foodCost: 2, abilities: ["absorb_hit"] },
  { templateId: "merc_bugbear",           name: "Bugbear Enforcer",   role: "melee",       level: 3, maxHp: 16, attack: 4, ac: 14, dailyCost: 400, foodCost: 2, abilities: ["absorb_hit", "stealth"] },
  { templateId: "merc_ogre",              name: "Ogre Mercenary",     role: "melee",       level: 4, maxHp: 29, attack: 8, ac: 14, dailyCost: 400, foodCost: 3, abilities: ["absorb_hit", "absorb_hit", "break_barriers"] },
  { templateId: "merc_centaur",           name: "Centaur Lancer",     role: "melee",       level: 4, maxHp: 26, attack: 7, ac: 15, dailyCost: 600, foodCost: 2, abilities: ["absorb_hit", "mounted_charge", "ranged_support"] },
  { templateId: "merc_minotaur",          name: "Minotaur Champion",  role: "melee",       level: 6, maxHp: 36, attack: 9, ac: 14, dailyCost: 800, foodCost: 3, abilities: ["absorb_hit", "absorb_hit", "break_barriers"] },

  // ── Specialist Hirelings (non-combat) ──
  { templateId: "merc_guide",             name: "Wilderness Guide",   role: "specialist",  level: 1, maxHp: 8,  attack: 0, ac: 12, dailyCost: 30,  foodCost: 1, abilities: ["scouting", "survival_bonus", "reveal_terrain"] },
  { templateId: "merc_healer",            name: "Field Healer",       role: "specialist",  level: 2, maxHp: 10, attack: 0, ac: 11, dailyCost: 50,  foodCost: 1, abilities: ["healing_1d8"] },
  { templateId: "merc_cook",              name: "Camp Cook",          role: "specialist",  level: 1, maxHp: 6,  attack: 0, ac: 10, dailyCost: 10,  foodCost: 1, abilities: ["reduce_food_cost", "rest_bonus"] },
  { templateId: "merc_teamster",          name: "Teamster",           role: "labor",       level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 30,  foodCost: 1, abilities: ["carry_bonus_50"] },
  { templateId: "merc_animal_trainer",    name: "Animal Trainer",     role: "specialist",  level: 1, maxHp: 8,  attack: 0, ac: 11, dailyCost: 80,  foodCost: 1, abilities: ["handle_animal_basic", "scouting"] },
  { templateId: "merc_sage",              name: "Sage",               role: "specialist",  level: 2, maxHp: 6,  attack: 0, ac: 10, dailyCost: 200, foodCost: 1, abilities: ["identify_item", "knowledge_bonus"] },
  { templateId: "merc_interpreter",       name: "Interpreter",        role: "specialist",  level: 1, maxHp: 6,  attack: 0, ac: 10, dailyCost: 30,  foodCost: 1, abilities: ["languages", "gather_info_bonus"] },
  { templateId: "merc_siege_engineer",    name: "Siege Engineer",     role: "specialist",  level: 3, maxHp: 12, attack: 1, ac: 12, dailyCost: 200, foodCost: 1, abilities: ["build_camp", "break_barriers", "siege_craft"] },
];

// Faction-specific follower templates

export const FACTION_TEMPLATES: FollowerTemplate[] = [
  // ── Alchemist Guild ──
  { templateId: "faction_alch_bodyguard",  name: "Guild Bodyguard",    role: "faction", factionId: "alchemist_guild", level: 3, maxHp: 22, attack: 2, ac: 16, dailyCost: 150, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "poison_resistance"] },
  { templateId: "faction_alch_bomber",     name: "Alchemist Bomber",   role: "faction", factionId: "alchemist_guild", level: 2, maxHp: 10, attack: 3, ac: 12, dailyCost: 200, foodCost: 1, abilities: ["ranged_support", "aoe_damage", "fire_bomb"] },
  { templateId: "faction_alch_homunculus", name: "Homunculus",         role: "faction", factionId: "alchemist_guild", level: 1, maxHp: 6,  attack: 0, ac: 14, dailyCost: 0,   foodCost: 0, abilities: ["scouting", "detect_magic", "deliver_touch_spell"] },

  // ── Temple of the Earthmother ──
  { templateId: "faction_earth_guardian",  name: "Earthmother Guardian", role: "faction", factionId: "temple_earthmother", level: 3, maxHp: 28, attack: 2, ac: 17, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "stone_skin"] },
  { templateId: "faction_earth_druid",     name: "Earthmother Druid",   role: "faction", factionId: "temple_earthmother", level: 2, maxHp: 12, attack: 1, ac: 13, dailyCost: 100, foodCost: 1, abilities: ["healing_1d8", "survival_bonus", "entangle"] },

  // ── Temple of the Windcaller ──
  { templateId: "faction_wind_scout",      name: "Windcaller Scout",    role: "faction", factionId: "temple_windcaller", level: 2, maxHp: 14, attack: 2, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["scouting", "reveal_terrain", "speed_bonus", "evasion"] },
  { templateId: "faction_wind_archer",     name: "Windcaller Archer",   role: "faction", factionId: "temple_windcaller", level: 3, maxHp: 16, attack: 4, ac: 15, dailyCost: 150, foodCost: 1, abilities: ["ranged_support", "covering_fire", "wind_shot"] },

  // ── Temple of the Tidewarden ──
  { templateId: "faction_tide_healer",     name: "Tidewarden Healer",   role: "faction", factionId: "temple_tidewarden", level: 3, maxHp: 14, attack: 0, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["healing_2d8", "cure_poison", "purify_water"] },
  { templateId: "faction_tide_marine",     name: "Tidewarden Marine",   role: "faction", factionId: "temple_tidewarden", level: 2, maxHp: 18, attack: 2, ac: 15, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "swim_speed", "water_breathing"] },

  // ── Temple of the Dawnfire ──
  { templateId: "faction_dawn_paladin",    name: "Dawnfire Paladin",    role: "faction", factionId: "temple_dawnfire", level: 4, maxHp: 30, attack: 3, ac: 18, dailyCost: 200, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "smite_undead", "aura_courage"] },
  { templateId: "faction_dawn_zealot",     name: "Dawnfire Zealot",     role: "faction", factionId: "temple_dawnfire", level: 2, maxHp: 16, attack: 2, ac: 15, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "fire_strike", "detect_evil"] },

  // ── Temple of Shadow (hidden) ──
  { templateId: "faction_shadow_assassin", name: "Shadow Assassin",     role: "faction", factionId: "temple_shadow", level: 4, maxHp: 18, attack: 5, ac: 16, dailyCost: 300, foodCost: 1, abilities: ["sneak_attack", "stealth", "poison_blade"] },
  { templateId: "faction_shadow_spy",      name: "Shadow Spy",          role: "faction", factionId: "temple_shadow", level: 2, maxHp: 10, attack: 1, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["scouting", "disguise", "gather_info_bonus"] },

  // ── Temple of Death (hidden) ──
  { templateId: "faction_death_knight",    name: "Death Knight",        role: "faction", factionId: "temple_death", level: 5, maxHp: 35, attack: 4, ac: 19, dailyCost: 300, foodCost: 0, abilities: ["absorb_hit", "absorb_hit", "undead", "fear_aura"] },
  { templateId: "faction_death_acolyte",   name: "Death Acolyte",       role: "faction", factionId: "temple_death", level: 3, maxHp: 14, attack: 1, ac: 12, dailyCost: 100, foodCost: 1, abilities: ["healing_1d8", "animate_dead", "detect_undead"] },

  // ── Farmers & Villagers ──
  { templateId: "faction_farmer_porter",   name: "Porter",              role: "labor", factionId: "farmers", level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["carry_bonus_30"] },
  { templateId: "faction_farmer_laborer",  name: "Laborer",             role: "labor", factionId: "farmers", level: 1, maxHp: 10, attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["build_camp", "dig"] },
  { templateId: "faction_farmer_farmhand", name: "Farmhand",            role: "labor", factionId: "farmers", level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["forage_bonus", "handle_animal_basic"] },
  { templateId: "faction_farmer_militia",  name: "Farmer Militia",      role: "melee", factionId: "farmers", level: 1, maxHp: 8,  attack: 1, ac: 11, dailyCost: 10, foodCost: 1, abilities: ["absorb_hit"] },
];

/** Get faction templates available based on rep tier */
export function getAvailableFactionFollowers(factionId: string, rep: number): FollowerTemplate[] {
  const templates = FACTION_TEMPLATES.filter(t => t.factionId === factionId);
  // Need at least Friendly (25+) to hire faction troops
  // Farmers only need Neutral (0+) since they're just labor
  const minRep = factionId === "farmers" ? 0 : 25;
  if (rep < minRep) return [];
  return templates;
}

/** Create a Follower instance from a template */
export function hireFollower(template: FollowerTemplate, customName?: string): Follower {
  return {
    id: `${template.templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.templateId,
    name: customName ?? template.name,
    role: template.role,
    factionId: template.factionId,
    level: template.level,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attack: template.attack,
    ac: template.ac,
    dailyCost: template.dailyCost,
    foodCost: template.foodCost,
    abilities: [...template.abilities],
    morale: 75,   // start at 75 — not fully loyal yet
    alive: true,
  };
}

/** Default empty party with a single hero */
export function defaultParty(nftAddress: string): Party {
  return {
    heroes: [{
      nft_address: nftAddress.toLowerCase(),
      isLeader: true,
      followers: [],
    }],
  };
}

// ── Multi-Party Adventuring ─────────────────────────────────────────────────
// Multiple parties can explore the world simultaneously.
// Each party has its own map position and acts independently.
// After one party acts, the next is auto-selected before time advances.

export type AdventureParty = {
  id: string;                          // unique party ID (e.g. "party-0")
  name: string;                        // player-visible name
  heroes: PartyHero[];                 // at least 1 NFT hero
  map_hex: { q: number; r: number };   // independent position on world map
  map_region: string;
  map_node: string;
  has_acted: boolean;                  // true after this party acts in the current round
};

/** Create a default adventure party */
export function createAdventureParty(
  id: string,
  name: string,
  nftAddress: string,
  hex?: { q: number; r: number },
): AdventureParty {
  return {
    id,
    name,
    heroes: [{ nft_address: nftAddress.toLowerCase(), isLeader: true, followers: [] }],
    map_hex: hex ?? { q: 36, r: 32 },
    map_region: "kardovs-gate",
    map_node: "tavern",
    has_acted: false,
  };
}

/** Check if all parties have acted this round */
export function allPartiesActed(parties: AdventureParty[]): boolean {
  return parties.length > 0 && parties.every(p => p.has_acted);
}

/** Reset all parties' acted flags for a new round */
export function resetPartyRound(parties: AdventureParty[]): AdventureParty[] {
  return parties.map(p => ({ ...p, has_acted: false }));
}

/** Find next party that hasn't acted yet */
export function nextUnactedParty(parties: AdventureParty[], currentIndex: number): number {
  for (let i = 1; i <= parties.length; i++) {
    const idx = (currentIndex + i) % parties.length;
    if (!parties[idx].has_acted) return idx;
  }
  return currentIndex;
}

// ── Daily Upkeep (called when a new in-game day starts) ─────────────────────
//
// Mercenaries charge per day. At the start of each new day:
//   1. Deduct gold for each alive follower's dailyCost
//   2. Deduct food for each alive follower's foodCost
//   3. Unpaid followers lose morale (-10/day)
//   4. Unfed followers lose morale (-15/day) and take 1 starvation damage
//   5. Paid + fed followers gain morale (+2 paid, +1 fed)
//   6. Followers at morale 0 desert
//
// Returns updated party, remaining gold/food, and a log of what happened.

export type UpkeepEvent =
  | { type: "paid"; followerName: string; cost: number }
  | { type: "unpaid"; followerName: string; cost: number }
  | { type: "fed"; followerName: string; food: number }
  | { type: "starving"; followerName: string }
  | { type: "deserted"; followerName: string }
  | { type: "died"; followerName: string };

export type UpkeepResult = {
  party: Party;
  goldSpent: number;
  foodSpent: number;
  goldRemaining: number;
  foodRemaining: number;
  events: UpkeepEvent[];
};

export function processDailyUpkeep(
  party: Party,
  goldCp: number,   // copper available for wages
  food: number,
): UpkeepResult {
  let goldLeft = goldCp;
  let foodLeft = food;
  let totalGoldSpent = 0;
  let totalFoodSpent = 0;
  const events: UpkeepEvent[] = [];

  const updatedHeroes = party.heroes.map(hero => {
    const updatedFollowers = hero.followers.map(f => {
      if (!f.alive) return f;
      let updated = { ...f };

      // ── Pay gold ──
      if (updated.dailyCost > 0) {
        if (goldLeft >= updated.dailyCost) {
          goldLeft -= updated.dailyCost;
          totalGoldSpent += updated.dailyCost;
          updated = updateMorale(updated, 2);  // paid: +2 morale
          events.push({ type: "paid", followerName: updated.name, cost: updated.dailyCost });
        } else {
          // Can't afford — don't deduct, morale drops
          updated = updateMorale(updated, -10);  // unpaid: -10 morale
          events.push({ type: "unpaid", followerName: updated.name, cost: updated.dailyCost });
        }
      }

      // ── Feed ──
      if (updated.foodCost > 0) {
        if (foodLeft >= updated.foodCost) {
          foodLeft -= updated.foodCost;
          totalFoodSpent += updated.foodCost;
          updated = updateMorale(updated, 1);  // fed: +1 morale
          events.push({ type: "fed", followerName: updated.name, food: updated.foodCost });
        } else {
          // Starving — morale drop + 1 damage
          updated = updateMorale(updated, -15);
          updated = { ...updated, hp: Math.max(0, updated.hp - 1) };
          events.push({ type: "starving", followerName: updated.name });
          if (updated.hp <= 0) {
            updated = { ...updated, alive: false };
            events.push({ type: "died", followerName: updated.name });
          }
        }
      }

      return updated;
    });

    // Check desertions
    const { remaining, deserted } = checkDesertions(updatedFollowers);
    for (const d of deserted) {
      events.push({ type: "deserted", followerName: d.name });
    }

    return { ...hero, followers: remaining };
  });

  return {
    party: { heroes: updatedHeroes },
    goldSpent: totalGoldSpent,
    foodSpent: totalFoodSpent,
    goldRemaining: goldLeft,
    foodRemaining: foodLeft,
    events,
  };
}
