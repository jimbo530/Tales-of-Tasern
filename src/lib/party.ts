// ============================================================
// party.ts — Party & Follower system for Tales of Tasern
//
// Up to 4 NFT heroes in a party. Each hero can have followers
// (hirelings, mercenaries, faction troops, pets) limited by
// Leadership score and carry capacity.
//
// Based on D&D 3.5 Arms & Equipment Guide hireling rules.
// ============================================================

import { type Equipment } from "./saveSystem";
import { type CharacterClass, CLASSES, getBAB, getSaveBonus, getClassById, HIT_DIE_VALUES } from "./classes";
import { getItemInfo } from "./itemRegistry";
import { parseArmorEffect } from "./battleStats";

// ── Entity Progression (shared by heroes and loyal followers) ─────────────

export type ClassLevel = { class_id: string; levels: number };

export type EntityProgression = {
  class_levels: ClassLevel[];        // e.g. [{class_id:"fighter", levels:3}, {class_id:"rogue", levels:2}]
  level_history: string[];           // class taken at each level: ["fighter","fighter","fighter","rogue","rogue"]
  total_level: number;               // sum of all class levels (= level_history.length)
  xp: number;                        // XP toward next level
  skill_ranks: Record<string, number>;
  feats: string[];
  // Spellcasting
  known_spells: string[];
  prepared_spells: string[];
  spellbook: string[];
  spell_slots_used: number[];
  domains: [string, string] | null;
  school_specialization: string | null;
  prohibited_schools: string[];
  // Combat
  equipment: Equipment;
  current_hp: number;
  max_hp: number;
};

/** Create a default level-1 progression for a given class */
export function defaultProgression(classId: string): EntityProgression {
  const cls = getClassById(classId);
  const hitDie = cls ? HIT_DIE_VALUES[cls.hitDie] : 8;
  return {
    class_levels: [{ class_id: classId, levels: 1 }],
    level_history: [classId],
    total_level: 1,
    xp: 0,
    skill_ranks: {},
    feats: [],
    known_spells: [],
    prepared_spells: [],
    spellbook: [],
    spell_slots_used: [],
    domains: null,
    school_specialization: null,
    prohibited_schools: [],
    equipment: {},
    current_hp: hitDie,
    max_hp: hitDie,
  };
}

// ── Multiclass Helpers ───────────────────────────────────────────────────────

/** Total BAB across all class levels */
export function totalBAB(classLevels: ClassLevel[]): number {
  let bab = 0;
  for (const cl of classLevels) {
    const cls = getClassById(cl.class_id);
    if (cls) bab += getBAB(cls.bab, cl.levels);
  }
  return bab;
}

/** Total base saves across all class levels. Returns { fort, ref, will } */
export function totalSaves(classLevels: ClassLevel[]): { fort: number; ref: number; will: number } {
  let fort = 0, ref = 0, will = 0;
  for (const cl of classLevels) {
    const cls = getClassById(cl.class_id);
    if (!cls) continue;
    const isGood = (s: string) => cls.goodSaves.includes(s as "fort" | "ref" | "will");
    fort += getSaveBonus(isGood("fort") ? "good" : "poor", cl.levels);
    ref += getSaveBonus(isGood("ref") ? "good" : "poor", cl.levels);
    will += getSaveBonus(isGood("will") ? "good" : "poor", cl.levels);
  }
  return { fort, ref, will };
}

/** Effective caster level = levels in the casting class only */
export function effectiveCasterLevel(classLevels: ClassLevel[], castingClassId: string): number {
  return classLevels.find(cl => cl.class_id === castingClassId)?.levels ?? 0;
}

/** Hit die for the class taken at a specific level (1-indexed) */
export function getHitDieForLevel(levelHistory: string[], levelIndex: number): number {
  const classId = levelHistory[levelIndex - 1];
  if (!classId) return 8;
  const cls = getClassById(classId);
  return cls ? HIT_DIE_VALUES[cls.hitDie] : 8;
}

/** Union of class skills from all classes the entity has levels in */
export function getAllClassSkills(classLevels: ClassLevel[]): string[] {
  const skills = new Set<string>();
  for (const cl of classLevels) {
    const cls = getClassById(cl.class_id);
    if (cls) for (const s of cls.classSkills) skills.add(s);
  }
  return [...skills];
}

/** Get the primary class (most levels, or first in history on tie) */
export function getPrimaryClass(classLevels: ClassLevel[]): CharacterClass | undefined {
  if (classLevels.length === 0) return undefined;
  const sorted = [...classLevels].sort((a, b) => b.levels - a.levels);
  return getClassById(sorted[0].class_id);
}

/** Levels in a specific class */
export function classLevelsIn(classLevels: ClassLevel[], classId: string): number {
  return classLevels.find(cl => cl.class_id === classId)?.levels ?? 0;
}

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
  level: number;            // follower's effective level (template base, or progression total_level)
  hp: number;               // current HP
  maxHp: number;            // max HP
  attack: number;           // combat bonus (template base; overridden by progression if present)
  ac: number;               // armor class (template base; overridden by progression if present)
  dailyCost: number;        // copper per day to maintain (0 = free/pet)
  foodCost: number;         // food per day (most = 1, ogres = 3, etc.)
  abilities: string[];      // special abilities (e.g. "scouting", "healing 1d8+1", "carry +50%")
  morale: number;           // 0-100, drops if unpaid/starving, flees at 0
  loyalty: number;          // 0-100, slow-moving trust score (>= 80 = loyal, unlocks customization)
  alive: boolean;
  // ── Equipment ──
  weapon?: string;           // equipped weapon description
  armor?: string;            // equipped armor description
  // ── Progression ──
  xp: number;               // XP toward next level (independent of hero)
  class_id: string;         // default class: "warrior" for combat, "commoner" for labor
  progression?: EntityProgression;  // full progression — present for loyal followers when customized
  // ── Gift tracking ──
  giftMoraleToday: number;  // morale gained from gifts today (caps at 15/day)
  giftLoyalty: number;      // total loyalty gained from gifts (caps at 40 — rest must be earned)
};

// ── Party Structure ─────────────────────────────────────────────────────────
// A party has up to 4 NFT heroes. Each hero has their own follower slots.
// Follower limit per hero = CHA modifier + level/2 (min 1).

export type PartyHero = {
  nft_address: string;      // NFT contract address (links to NftCharacter)
  isLeader: boolean;        // party leader (first slot, controls movement)
  followers: Follower[];    // this hero's personal followers
  progression?: EntityProgression;  // hero's class/level/xp/skills/feats/equipment/hp
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

/** Daily loyalty update based on current morale. Loyalty moves slowly. */
export function updateLoyaltyDaily(follower: Follower): Follower {
  let delta = 0;
  if (follower.morale >= 80) delta = 1;       // happy → slow loyalty gain
  else if (follower.morale >= 50) delta = 0;   // neutral → no change
  else if (follower.morale >= 30) delta = -0.5; // unhappy → slow loyalty loss
  else delta = -1;                              // miserable → faster loss
  const newLoyalty = Math.max(0, Math.min(100, (follower.loyalty ?? 0) + delta));
  return { ...follower, loyalty: Math.round(newLoyalty * 10) / 10 }; // keep 1 decimal
}

// ── Gift System ──────────────────────────────────────────────────────────────
// Followers accept gifts from inventory. Value determines morale/loyalty gain.
// Morale: easy to buy but capped at 15/day from gifts.
// Loyalty: only 40 total loyalty can come from gifts — the rest must be earned
// through service (daily loyalty ticks from high morale over time).
//
// Gift value tiers (in cp):
//   1-49cp     → +3 morale, +1 loyalty
//   50-199cp   → +5 morale, +2 loyalty
//   200-999cp  → +8 morale, +3 loyalty
//   1000cp+    → +12 morale, +5 loyalty

const GIFT_MORALE_CAP_PER_DAY = 15;
const GIFT_LOYALTY_CAP = 40;

export type GiftResult = {
  follower: Follower;
  moraleGain: number;
  loyaltyGain: number;
  moraleCapHit: boolean;
  loyaltyCapHit: boolean;
};

/** Give a gift to a follower. Returns updated follower + what was gained. */
export function giveGift(follower: Follower, itemValueCp: number): GiftResult {
  // Determine base gains from gift value
  let baseMorale: number;
  let baseLoyalty: number;
  if (itemValueCp >= 1000) { baseMorale = 12; baseLoyalty = 5; }
  else if (itemValueCp >= 200) { baseMorale = 8; baseLoyalty = 3; }
  else if (itemValueCp >= 50) { baseMorale = 5; baseLoyalty = 2; }
  else { baseMorale = 3; baseLoyalty = 1; }

  // Apply daily morale cap
  const moraleSpent = follower.giftMoraleToday ?? 0;
  const moraleRoom = Math.max(0, GIFT_MORALE_CAP_PER_DAY - moraleSpent);
  const actualMorale = Math.min(baseMorale, moraleRoom);

  // Apply lifetime loyalty cap from gifts
  const loyaltySpent = follower.giftLoyalty ?? 0;
  const loyaltyRoom = Math.max(0, GIFT_LOYALTY_CAP - loyaltySpent);
  const actualLoyalty = Math.min(baseLoyalty, loyaltyRoom);

  const updated: Follower = {
    ...follower,
    morale: Math.min(100, follower.morale + actualMorale),
    loyalty: Math.min(100, (follower.loyalty ?? 0) + actualLoyalty),
    giftMoraleToday: moraleSpent + actualMorale,
    giftLoyalty: loyaltySpent + actualLoyalty,
  };

  return {
    follower: updated,
    moraleGain: actualMorale,
    loyaltyGain: actualLoyalty,
    moraleCapHit: actualMorale < baseMorale,
    loyaltyCapHit: actualLoyalty < baseLoyalty,
  };
}

/** Reset daily gift morale tracking (call at start of each new day) */
export function resetDailyGifts(follower: Follower): Follower {
  return { ...follower, giftMoraleToday: 0 };
}

// ── Auto-Equip ─────────────────────────────────────────────────────────────
// Followers auto-equip the best weapon/armor/shield they receive.

/** Parse average weapon damage from effect string like "1d8 slashing" → 4.5 */
export function parseWeaponAvgDmg(effect?: string): number {
  if (!effect) return 0;
  const m = effect.match(/(\d+)d(\d+)/);
  if (!m) return 0;
  return parseInt(m[1]) * (parseInt(m[2]) + 1) / 2;
}

/** Auto-equip an item on a follower if it's better than current gear.
 *  Stores item IDs in follower.weapon / follower.armor / progression.equipment.
 *  Returns the (possibly updated) follower. */
export function autoEquipFollower(follower: Follower, itemId: string): Follower {
  const info = getItemInfo(itemId);
  if (!info) return follower;

  const cat = info.category;
  let updated = { ...follower };

  if (cat === "weapon") {
    const newDmg = parseWeaponAvgDmg(info.effect);
    const curEffect = updated.weapon ? getItemInfo(updated.weapon)?.effect : undefined;
    const curDmg = parseWeaponAvgDmg(curEffect);
    if (newDmg > curDmg) {
      updated.weapon = itemId;
      if (updated.progression) {
        updated.progression = { ...updated.progression, equipment: { ...updated.progression.equipment, weapon: itemId } };
      }
    }
  } else if (cat === "armor") {
    const parsed = parseArmorEffect(info.effect);
    if (parsed.isShield) {
      // Shield — compare to progression shield slot
      const curShieldId = updated.progression?.equipment?.shield;
      const curShieldAc = parseArmorEffect(curShieldId ? getItemInfo(curShieldId)?.effect : undefined).ac;
      if (parsed.ac > curShieldAc) {
        if (updated.progression) {
          updated.progression = { ...updated.progression, equipment: { ...updated.progression.equipment, shield: itemId } };
        }
      }
    } else {
      // Body armor — compare to current armor
      const curEffect = updated.armor ? getItemInfo(updated.armor)?.effect : undefined;
      const curAc = parseArmorEffect(curEffect).ac;
      if (parsed.ac > curAc) {
        updated.armor = itemId;
        if (updated.progression) {
          updated.progression = { ...updated.progression, equipment: { ...updated.progression.equipment, armor: itemId } };
        }
      }
    }
  }

  return updated;
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
  weapon?: string;           // equipped weapon description
  armor?: string;            // equipped armor description
};

// General Mercenary Guild templates (match shop items)
export const GENERAL_TEMPLATES: FollowerTemplate[] = [
  // ══════════════════════════════════════════════════════════════
  // Arms & Equipment Guide p.66 — Table 4-4: Mercenary Equipment
  // Stats: attack = book BAB, ac = book AC, dailyCost in cp
  // HP = level × 5.5 + 3 (warrior d8 + CON 12)
  // ══════════════════════════════════════════════════════════════

  // ── Skirmishers, Foot (Lv 1, 2sp/day = 20cp) ──
  // A&E p.66: light troops with minimal armor, ranged weapons
  { templateId: "merc_skirm_sling",       name: "Skirmisher (Sling)",         role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"], weapon: "Sling", armor: "Studded Leather" },
  { templateId: "merc_skirm_axe",         name: "Skirmisher (Throwing Axes)", role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 12, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"], weapon: "Throwing Axes", armor: "Leather" },
  { templateId: "merc_skirm_javelin",     name: "Skirmisher (Javelin)",       role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "absorb_hit"], weapon: "Javelins & Short Sword", armor: "Chain Shirt" },
  { templateId: "merc_skirm_shortbow",    name: "Skirmisher (Shortbow)",      role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 12, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"], weapon: "Shortbow", armor: "Leather" },
  { templateId: "merc_skirm_crossbow",    name: "Skirmisher (Crossbow)",      role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["ranged_support"], weapon: "Light Crossbow", armor: "Studded Leather" },
  { templateId: "merc_skirm_scimitar",    name: "Skirmisher (Bow & Scimitar)",role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"], weapon: "Shortbow & Scimitar", armor: "Chain Shirt" },

  // ── Skirmishers, Mounted (Lv 4, 4sp/day = 40cp) ──
  { templateId: "merc_skirm_mt_sling",    name: "Mtd Skirmisher (Sling)",     role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "mounted_charge"], weapon: "Sling & Short Sword", armor: "Chain Shirt" },
  { templateId: "merc_skirm_mt_javelin",  name: "Mtd Skirmisher (Javelin)",   role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 15, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "absorb_hit", "mounted_charge"], weapon: "Javelins & Scimitar", armor: "Scale Mail" },
  { templateId: "merc_skirm_mt_bow",      name: "Mtd Skirmisher (Shortbow)",  role: "ranged",  level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["ranged_support", "covering_fire", "mounted_charge"], weapon: "Shortbow & Scimitar", armor: "Chain Shirt" },

  // ── Light Foot (Lv 1, 2sp/day = 20cp) ──
  { templateId: "merc_light_battleaxe",   name: "Light Foot (Battleaxe)",     role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 13, dailyCost: 20, foodCost: 1, abilities: ["absorb_hit"], weapon: "Battleaxe", armor: "Studded Leather" },
  { templateId: "merc_light_spear",       name: "Light Foot (Spear & Shield)",role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 14, dailyCost: 20, foodCost: 1, abilities: ["absorb_hit"], weapon: "Spear & Light Shield", armor: "Leather" },
  { templateId: "merc_light_longspear",   name: "Light Foot (Longspear)",     role: "melee",   level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["set_against_charge"], weapon: "Longspear", armor: "Padded" },
  { templateId: "merc_light_hvy_xbow",    name: "Light Foot (Heavy Crossbow)",role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"], weapon: "Heavy Crossbow & Dagger", armor: "Padded" },
  { templateId: "merc_light_longbow",     name: "Light Foot (Longbow)",       role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"], weapon: "Longbow & Short Sword", armor: "Padded" },
  { templateId: "merc_light_comp_bow",    name: "Light Foot (Comp Longbow)",  role: "ranged",  level: 1, maxHp: 8,  attack: 3, ac: 11, dailyCost: 20, foodCost: 1, abilities: ["ranged_support", "covering_fire"], weapon: "Composite Longbow & Short Sword", armor: "Padded" },

  // ── Light Mounted (Lv 4, 4sp/day = 40cp) ──
  { templateId: "merc_light_mt_spear",    name: "Light Cav (Spear & Flail)",  role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"], weapon: "Spear & Heavy Flail", armor: "Chain Shirt" },
  { templateId: "merc_light_mt_lance",    name: "Light Cav (Lance & Mace)",   role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"], weapon: "Lance & Heavy Mace", armor: "Chain Shirt" },
  { templateId: "merc_light_mt_scimitar", name: "Light Cav (Scimitar)",       role: "melee",   level: 4, maxHp: 25, attack: 6, ac: 14, dailyCost: 40, foodCost: 2, abilities: ["absorb_hit", "mounted_charge"], weapon: "Scimitar & Light Shield", armor: "Chain Shirt" },

  // ── Medium Foot (Lv 2-5, 4-10sp/day) ──
  { templateId: "merc_med_halberd",       name: "Medium Foot (Halberd)",      role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 14, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"], weapon: "Halberd", armor: "Chain Shirt" },
  { templateId: "merc_med_ranseur",       name: "Medium Foot (Ranseur)",      role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 14, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"], weapon: "Ranseur", armor: "Chain Shirt" },
  { templateId: "merc_med_longsword",     name: "Medium Foot (Longsword)",    role: "melee",   level: 2, maxHp: 14, attack: 4, ac: 15, dailyCost: 40, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"], weapon: "Longsword & Heavy Shield", armor: "Scale Mail" },
  { templateId: "merc_med_chain",         name: "Medium Foot (Chainmail)",    role: "melee",   level: 3, maxHp: 20, attack: 5, ac: 15, dailyCost: 60, foodCost: 1, abilities: ["absorb_hit", "absorb_hit"], weapon: "Longsword & Heavy Shield", armor: "Chainmail" },
  { templateId: "merc_med_splint",        name: "Medium Foot (Splint Mail)",  role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100,foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Bastard Sword & Heavy Shield", armor: "Splint Mail" },
  { templateId: "merc_med_breastplate",   name: "Medium Foot (Breastplate)",  role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100,foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Longsword & Heavy Shield", armor: "Breastplate" },

  // ── Medium Mounted (Lv 8-9, 16-18sp/day) ──
  { templateId: "merc_med_mt_longsword",  name: "Medium Cav (Longsword)",     role: "melee",   level: 8, maxHp: 50, attack: 11, ac: 16, dailyCost: 160, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Lance & Longsword", armor: "Breastplate" },
  { templateId: "merc_med_mt_trident",    name: "Medium Cav (Trident)",       role: "melee",   level: 8, maxHp: 50, attack: 11, ac: 16, dailyCost: 160, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Lance & Trident", armor: "Breastplate" },
  { templateId: "merc_med_mt_breastplate",name: "Medium Cav (Breastplate)",   role: "melee",   level: 9, maxHp: 56, attack: 12, ac: 16, dailyCost: 180, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Lance & Heavy Mace", armor: "Breastplate & Heavy Shield" },

  // ── Heavy Foot (Lv 5, 10sp/day = 100cp) ──
  { templateId: "merc_heavy_greatsword",  name: "Heavy Foot (Greatsword)",    role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Greatsword", armor: "Banded Mail" },
  { templateId: "merc_heavy_mace",        name: "Heavy Foot (Mace & Shield)", role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 18, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Heavy Mace & Heavy Shield", armor: "Banded Mail" },
  { templateId: "merc_heavy_flail",       name: "Heavy Foot (Heavy Flail)",   role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Heavy Flail", armor: "Banded Mail" },
  { templateId: "merc_heavy_battleaxe",   name: "Heavy Foot (Battleaxe)",     role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 18, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Battleaxe & Heavy Shield", armor: "Banded Mail" },
  { templateId: "merc_heavy_greataxe",    name: "Heavy Foot (Greataxe)",      role: "melee",   level: 5, maxHp: 31, attack: 7, ac: 16, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit"], weapon: "Greataxe", armor: "Banded Mail" },

  // ── Heavy Mounted (Lv 10-12, 20-24sp/day) ──
  { templateId: "merc_heavy_mt_warhammer",name: "Heavy Cav (Warhammer)",      role: "melee",   level: 10, maxHp: 62, attack: 13, ac: 19, dailyCost: 200, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Lance & Warhammer", armor: "Full Plate" },
  { templateId: "merc_heavy_mt_pick",     name: "Heavy Cav (Heavy Pick)",     role: "melee",   level: 10, maxHp: 62, attack: 13, ac: 18, dailyCost: 200, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Lance & Heavy Pick", armor: "Half Plate" },
  { templateId: "merc_heavy_mt_lance",    name: "Heavy Cav (Heavy Lance)",    role: "melee",   level: 12, maxHp: 74, attack: 16, ac: 20, dailyCost: 240, foodCost: 2, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "mounted_charge"], weapon: "Heavy Lance & Longsword", armor: "Full Plate & Heavy Shield" },

  // ── Exotic Troops ──
  { templateId: "merc_goblin",            name: "Goblin Scout",       role: "specialist",  level: 1, maxHp: 5,  attack: 1, ac: 13, dailyCost: 10,  foodCost: 1, abilities: ["scouting"], weapon: "Short Sword", armor: "Leather & Light Shield" },
  { templateId: "merc_hobgoblin",         name: "Hobgoblin Soldier",  role: "melee",       level: 1, maxHp: 8,  attack: 1, ac: 14, dailyCost: 20,  foodCost: 1, abilities: ["absorb_hit"], weapon: "Longsword & Light Shield", armor: "Chain Shirt" },
  { templateId: "merc_gnoll",             name: "Gnoll Brute",        role: "melee",       level: 2, maxHp: 14, attack: 3, ac: 13, dailyCost: 20,  foodCost: 2, abilities: ["absorb_hit"], weapon: "Battleaxe", armor: "Studded Leather" },
  { templateId: "merc_bugbear",           name: "Bugbear Enforcer",   role: "melee",       level: 3, maxHp: 16, attack: 4, ac: 14, dailyCost: 400, foodCost: 2, abilities: ["absorb_hit", "stealth"], weapon: "Morningstar", armor: "Chain Shirt" },
  { templateId: "merc_ogre",              name: "Ogre Mercenary",     role: "melee",       level: 4, maxHp: 29, attack: 8, ac: 14, dailyCost: 400, foodCost: 3, abilities: ["absorb_hit", "absorb_hit", "break_barriers"], weapon: "Greatclub", armor: "Hide" },
  { templateId: "merc_centaur",           name: "Centaur Lancer",     role: "melee",       level: 4, maxHp: 26, attack: 7, ac: 15, dailyCost: 600, foodCost: 2, abilities: ["absorb_hit", "mounted_charge", "ranged_support"], weapon: "Lance & Longbow", armor: "Chain Shirt" },
  { templateId: "merc_minotaur",          name: "Minotaur Champion",  role: "melee",       level: 6, maxHp: 36, attack: 9, ac: 14, dailyCost: 800, foodCost: 3, abilities: ["absorb_hit", "absorb_hit", "break_barriers"], weapon: "Greataxe", armor: "Natural Armor" },

  // ── Specialist Hirelings (non-combat) ──
  { templateId: "merc_guide",             name: "Wilderness Guide",   role: "specialist",  level: 1, maxHp: 8,  attack: 0, ac: 12, dailyCost: 30,  foodCost: 1, abilities: ["scouting", "survival_bonus", "reveal_terrain"], weapon: "Short Sword", armor: "Leather" },
  { templateId: "merc_healer",            name: "Field Healer",       role: "specialist",  level: 2, maxHp: 10, attack: 0, ac: 11, dailyCost: 50,  foodCost: 1, abilities: ["healing_1d8"], weapon: "Quarterstaff", armor: "Padded" },
  { templateId: "merc_cook",              name: "Camp Cook",          role: "specialist",  level: 1, maxHp: 6,  attack: 0, ac: 10, dailyCost: 10,  foodCost: 1, abilities: ["reduce_food_cost", "rest_bonus"], weapon: "Cleaver (Handaxe)", armor: "None" },
  { templateId: "merc_teamster",          name: "Teamster",           role: "labor",       level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 30,  foodCost: 1, abilities: ["carry_bonus_50"], weapon: "Club", armor: "None" },
  { templateId: "merc_animal_trainer",    name: "Animal Trainer",     role: "specialist",  level: 1, maxHp: 8,  attack: 0, ac: 11, dailyCost: 80,  foodCost: 1, abilities: ["handle_animal_basic", "scouting"], weapon: "Whip & Dagger", armor: "Padded" },
  { templateId: "merc_sage",              name: "Sage",               role: "specialist",  level: 2, maxHp: 6,  attack: 0, ac: 10, dailyCost: 200, foodCost: 1, abilities: ["identify_item", "knowledge_bonus"], weapon: "Dagger", armor: "None" },
  { templateId: "merc_interpreter",       name: "Interpreter",        role: "specialist",  level: 1, maxHp: 6,  attack: 0, ac: 10, dailyCost: 30,  foodCost: 1, abilities: ["languages", "gather_info_bonus"], weapon: "Dagger", armor: "None" },
  { templateId: "merc_siege_engineer",    name: "Siege Engineer",     role: "specialist",  level: 3, maxHp: 12, attack: 1, ac: 12, dailyCost: 200, foodCost: 1, abilities: ["build_camp", "break_barriers", "siege_craft"], weapon: "Warhammer", armor: "Leather" },
];

// Faction-specific follower templates

export const FACTION_TEMPLATES: FollowerTemplate[] = [
  // ── Alchemist Guild ──
  { templateId: "faction_alch_bodyguard",  name: "Guild Bodyguard",    role: "faction", factionId: "alchemist_guild", level: 3, maxHp: 22, attack: 2, ac: 16, dailyCost: 150, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "poison_resistance"], weapon: "Heavy Mace", armor: "Chainmail & Heavy Steel Shield" },
  { templateId: "faction_alch_bomber",     name: "Alchemist Bomber",   role: "faction", factionId: "alchemist_guild", level: 2, maxHp: 10, attack: 3, ac: 12, dailyCost: 200, foodCost: 1, abilities: ["ranged_support", "aoe_damage", "fire_bomb"], weapon: "Alchemist's Fire & Light Crossbow", armor: "Leather" },
  { templateId: "faction_alch_homunculus", name: "Homunculus",         role: "faction", factionId: "alchemist_guild", level: 1, maxHp: 6,  attack: 0, ac: 14, dailyCost: 0,   foodCost: 0, abilities: ["scouting", "detect_magic", "deliver_touch_spell"], weapon: "Bite", armor: "Natural Armor" },

  // ── Temple of the Earthmother ──
  { templateId: "faction_earth_guardian",  name: "Earthmother Guardian", role: "faction", factionId: "temple_earthmother", level: 3, maxHp: 28, attack: 2, ac: 17, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "absorb_hit", "stone_skin"], weapon: "Warhammer & Heavy Steel Shield", armor: "Splint Mail" },
  { templateId: "faction_earth_druid",     name: "Earthmother Druid",   role: "faction", factionId: "temple_earthmother", level: 2, maxHp: 12, attack: 1, ac: 13, dailyCost: 100, foodCost: 1, abilities: ["healing_1d8", "survival_bonus", "entangle"], weapon: "Scimitar", armor: "Hide" },

  // ── Temple of the Windcaller ──
  { templateId: "faction_wind_scout",      name: "Windcaller Scout",    role: "faction", factionId: "temple_windcaller", level: 2, maxHp: 14, attack: 2, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["scouting", "reveal_terrain", "speed_bonus", "evasion"], weapon: "Short Sword & Shortbow", armor: "Studded Leather" },
  { templateId: "faction_wind_archer",     name: "Windcaller Archer",   role: "faction", factionId: "temple_windcaller", level: 3, maxHp: 16, attack: 4, ac: 15, dailyCost: 150, foodCost: 1, abilities: ["ranged_support", "covering_fire", "wind_shot"], weapon: "Composite Longbow", armor: "Chain Shirt" },

  // ── Temple of the Tidewarden ──
  { templateId: "faction_tide_healer",     name: "Tidewarden Healer",   role: "faction", factionId: "temple_tidewarden", level: 3, maxHp: 14, attack: 0, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["healing_2d8", "cure_poison", "purify_water"], weapon: "Quarterstaff", armor: "Chain Shirt" },
  { templateId: "faction_tide_marine",     name: "Tidewarden Marine",   role: "faction", factionId: "temple_tidewarden", level: 2, maxHp: 18, attack: 2, ac: 15, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "swim_speed", "water_breathing"], weapon: "Trident & Light Steel Shield", armor: "Scale Mail" },

  // ── Temple of the Dawnfire ──
  { templateId: "faction_dawn_paladin",    name: "Dawnfire Paladin",    role: "faction", factionId: "temple_dawnfire", level: 4, maxHp: 30, attack: 3, ac: 18, dailyCost: 200, foodCost: 1, abilities: ["absorb_hit", "absorb_hit", "smite_undead", "aura_courage"], weapon: "Longsword & Heavy Steel Shield", armor: "Full Plate" },
  { templateId: "faction_dawn_zealot",     name: "Dawnfire Zealot",     role: "faction", factionId: "temple_dawnfire", level: 2, maxHp: 16, attack: 2, ac: 15, dailyCost: 100, foodCost: 1, abilities: ["absorb_hit", "fire_strike", "detect_evil"], weapon: "Flail", armor: "Breastplate" },

  // ── Temple of Shadow (hidden) ──
  { templateId: "faction_shadow_assassin", name: "Shadow Assassin",     role: "faction", factionId: "temple_shadow", level: 4, maxHp: 18, attack: 5, ac: 16, dailyCost: 300, foodCost: 1, abilities: ["sneak_attack", "stealth", "poison_blade"], weapon: "Kukri (poisoned) & Hand Crossbow", armor: "Mithral Chain Shirt" },
  { templateId: "faction_shadow_spy",      name: "Shadow Spy",          role: "faction", factionId: "temple_shadow", level: 2, maxHp: 10, attack: 1, ac: 14, dailyCost: 100, foodCost: 1, abilities: ["scouting", "disguise", "gather_info_bonus"], weapon: "Dagger", armor: "Leather" },

  // ── Temple of Death (hidden) ──
  { templateId: "faction_death_knight",    name: "Death Knight",        role: "faction", factionId: "temple_death", level: 5, maxHp: 35, attack: 4, ac: 19, dailyCost: 300, foodCost: 0, abilities: ["absorb_hit", "absorb_hit", "undead", "fear_aura"], weapon: "Greatsword", armor: "Full Plate" },
  { templateId: "faction_death_acolyte",   name: "Death Acolyte",       role: "faction", factionId: "temple_death", level: 3, maxHp: 14, attack: 1, ac: 12, dailyCost: 100, foodCost: 1, abilities: ["healing_1d8", "animate_dead", "detect_undead"], weapon: "Sickle", armor: "Robes" },

  // ── Farmers & Villagers ──
  { templateId: "faction_farmer_porter",   name: "Porter",              role: "labor", factionId: "farmers", level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["carry_bonus_30"], weapon: "Quarterstaff", armor: "None" },
  { templateId: "faction_farmer_laborer",  name: "Laborer",             role: "labor", factionId: "farmers", level: 1, maxHp: 10, attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["build_camp", "dig"], weapon: "Shovel (Club)", armor: "None" },
  { templateId: "faction_farmer_farmhand", name: "Farmhand",            role: "labor", factionId: "farmers", level: 1, maxHp: 8,  attack: 0, ac: 10, dailyCost: 10, foodCost: 1, abilities: ["forage_bonus", "handle_animal_basic"], weapon: "Sickle", armor: "None" },
  { templateId: "faction_farmer_militia",  name: "Farmer Militia",      role: "melee", factionId: "farmers", level: 1, maxHp: 8,  attack: 1, ac: 11, dailyCost: 10, foodCost: 1, abilities: ["absorb_hit"], weapon: "Spear", armor: "Padded" },
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

// ── Random Name Generator ────────────────────────────────────────────────────
// Fantasy-flavored names for hired followers. Mixes syllables for variety.

const NAME_FIRST = [
  "Bran", "Kael", "Dorn", "Ulf", "Grim", "Thane", "Rolf", "Sven", "Bjorn", "Torv",
  "Hal", "Conn", "Wulf", "Garr", "Finn", "Dag", "Skald", "Arn", "Leif", "Bors",
  "Mira", "Elsa", "Hild", "Inga", "Sigr", "Freya", "Asta", "Runa", "Ylva", "Liv",
  "Tova", "Nessa", "Bryn", "Kara", "Dalla", "Solvi", "Edda", "Thyra", "Greta", "Vera",
  "Jorik", "Pell", "Tam", "Cort", "Dunn", "Moss", "Flint", "Reed", "Pike", "Cobb",
  "Wren", "Sage", "Lark", "Fern", "Rue", "Ivy", "Ash", "Birch", "Stone", "Clay",
];
const NAME_SUFFIX = [
  "", "", "", "", "", // often no suffix
  "ric", "ard", "mund", "gar", "sson", "vik", "mar", "ren", "den", "ley",
  "win", "ulf", "ax", "orn", "ald", "wen", "lyn", "mir", "ild", "dis",
];

function randomFollowerName(): string {
  const first = NAME_FIRST[Math.floor(Math.random() * NAME_FIRST.length)];
  const suffix = NAME_SUFFIX[Math.floor(Math.random() * NAME_SUFFIX.length)];
  return first + suffix;
}

/** Create a Follower instance from a template.
 *  factionRep: reputation with the follower's faction (0-100), affects starting loyalty. */
export function hireFollower(template: FollowerTemplate, customName?: string, factionRep?: number): Follower {
  // Faction followers start with loyalty based on faction rep; mercs start at 0
  const startLoyalty = template.factionId && factionRep !== undefined
    ? Math.min(80, factionRep * 2)
    : 0;
  // Default class based on combat role
  const defaultClass = (template.role === "melee" || template.role === "ranged" || template.role === "faction")
    ? "warrior" : "commoner";
  return {
    id: `${template.templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.templateId,
    name: customName ?? randomFollowerName(),
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
    loyalty: startLoyalty,
    alive: true,
    weapon: template.weapon,
    armor: template.armor,
    xp: 0,
    class_id: defaultClass,
    giftMoraleToday: 0,
    giftLoyalty: 0,
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
  auto_action?: { type: "rest" | "skill"; skill?: string } | null;  // repeat this action each turn until interrupted
  // ── Per-Party Supplies (swapped into save.* when active) ──
  coins?: { gp: number; sp: number; cp: number };
  food?: number;
  inventory?: { id: string; name: string; qty: number }[];
  equipment?: { weapon?: string; armor?: string; shield?: string; accessory?: string };
  current_hp?: number;
  max_hp?: number;
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

/** Add an NFT hero to an existing party (max 4 heroes per party) */
export function addHeroToParty<T extends Party>(party: T, nftAddress: string): T {
  if (party.heroes.length >= 4) return party;
  return {
    ...party,
    heroes: [...party.heroes, { nft_address: nftAddress.toLowerCase(), isLeader: false, followers: [] }],
  };
}

/** Remove an NFT hero from a party (cannot remove the leader) */
export function removeHeroFromParty<T extends Party>(party: T, nftAddress: string): T {
  const hero = party.heroes.find(h => h.nft_address === nftAddress.toLowerCase());
  if (!hero || hero.isLeader) return party;
  return {
    ...party,
    heroes: party.heroes.filter(h => h.nft_address !== nftAddress.toLowerCase()),
  };
}

/** Swap save-level fields with party storage when switching active party.
 *  save.coins/food/inventory/equipment/hp always reflect the ACTIVE party's values.
 *  On switch: stash current values into old party, load from new party. */
export function swapActiveParty(
  parties: AdventureParty[],
  oldIndex: number,
  newIndex: number,
  current: { coins: { gp: number; sp: number; cp: number }; food: number; inventory: { id: string; name: string; qty: number }[]; equipment: { weapon?: string; armor?: string; shield?: string; accessory?: string }; current_hp: number; max_hp: number },
): { parties: AdventureParty[]; coins: { gp: number; sp: number; cp: number }; food: number; inventory: { id: string; name: string; qty: number }[]; equipment: { weapon?: string; armor?: string; shield?: string; accessory?: string }; current_hp: number; max_hp: number } {
  const updated = parties.map((p, i) => {
    if (i === oldIndex) return { ...p, coins: current.coins, food: current.food, inventory: current.inventory, equipment: current.equipment, current_hp: current.current_hp, max_hp: current.max_hp };
    return p;
  });
  const np = updated[newIndex];
  return {
    parties: updated,
    coins: np.coins ?? { gp: 0, sp: 0, cp: 0 },
    food: np.food ?? 0,
    inventory: np.inventory ?? [],
    equipment: np.equipment ?? {},
    current_hp: np.current_hp ?? 12,
    max_hp: np.max_hp ?? 12,
  };
}

/** Migrate a save that predates per-party supplies: active party gets everything */
export function migratePartySupplies(
  parties: AdventureParty[],
  activeIndex: number,
  current: { coins: { gp: number; sp: number; cp: number }; food: number; inventory: { id: string; name: string; qty: number }[]; equipment: { weapon?: string; armor?: string; shield?: string; accessory?: string }; current_hp: number; max_hp: number },
): AdventureParty[] {
  if (!parties.length) return parties;
  if (parties.some(p => p.coins !== undefined)) return parties;
  return parties.map((p, i) => ({
    ...p,
    coins: i === activeIndex ? current.coins : { gp: 0, sp: 0, cp: 0 },
    food: i === activeIndex ? current.food : 0,
    inventory: i === activeIndex ? current.inventory : [],
    equipment: i === activeIndex ? current.equipment : {},
    current_hp: i === activeIndex ? current.current_hp : 12,
    max_hp: i === activeIndex ? current.max_hp : 12,
  }));
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

// ── Entity Progression Migration & Accessors ─────────────────────────────────

/** Migrate a pre-progression save: copy top-level class/level/xp/skills/etc
 *  into the first hero's progression field. Also add xp/class_id/loyalty to
 *  existing followers. Returns null if already migrated. */
export function migrateEntityProgression(save: {
  party: Party;
  parties: AdventureParty[];
  active_party_index: number;
  class_id: string;
  level: number;
  xp: number;
  skill_ranks: Record<string, number>;
  feats: string[];
  known_spells: string[];
  prepared_spells: string[];
  spellbook: string[];
  spell_slots_used: number[];
  domains: [string, string] | null;
  school_specialization: string | null;
  prohibited_schools: string[];
  equipment: Equipment;
  current_hp: number;
  max_hp: number;
}): Record<string, unknown> | null {
  // Already migrated?
  if (save.party.heroes[0]?.progression) return null;

  const prog: EntityProgression = {
    class_levels: [{ class_id: save.class_id, levels: save.level }],
    level_history: Array(save.level).fill(save.class_id),
    total_level: save.level,
    xp: save.xp,
    skill_ranks: { ...save.skill_ranks },
    feats: [...save.feats],
    known_spells: [...save.known_spells],
    prepared_spells: [...save.prepared_spells],
    spellbook: [...save.spellbook],
    spell_slots_used: [...save.spell_slots_used],
    domains: save.domains,
    school_specialization: save.school_specialization,
    prohibited_schools: [...save.prohibited_schools],
    equipment: { ...save.equipment },
    current_hp: save.current_hp,
    max_hp: save.max_hp,
  };

  // Migrate followers: add missing xp/class_id/loyalty fields
  const migrateFollowers = (followers: Follower[]): Follower[] =>
    followers.map(f => ({
      ...f,
      xp: f.xp ?? 0,
      loyalty: f.loyalty ?? 0,
      class_id: f.class_id ?? ((f.role === "melee" || f.role === "ranged" || f.role === "faction") ? "warrior" : "commoner"),
      giftMoraleToday: f.giftMoraleToday ?? 0,
      giftLoyalty: f.giftLoyalty ?? 0,
    }));

  // Apply to active party
  const updatedHeroes = save.party.heroes.map((h, i) => ({
    ...h,
    progression: i === 0 ? prog : undefined,
    followers: migrateFollowers(h.followers),
  }));

  // Also update in parties[] array
  const activeIdx = save.active_party_index ?? 0;
  const updatedParties = save.parties.map((p, i) => ({
    ...p,
    heroes: p.heroes.map((h, j) => ({
      ...h,
      progression: (i === activeIdx && j === 0) ? prog : h.progression,
      followers: migrateFollowers(h.followers),
    })),
  }));

  return {
    party: { heroes: updatedHeroes },
    parties: updatedParties,
  };
}

/** Get the leader hero's progression, with fallback to top-level save fields */
export function getLeaderProgression(save: {
  party: Party;
  class_id: string; level: number; xp: number;
  skill_ranks: Record<string, number>; feats: string[];
  known_spells: string[]; prepared_spells: string[]; spellbook: string[];
  spell_slots_used: number[];
  domains: [string, string] | null;
  school_specialization: string | null;
  prohibited_schools: string[];
  equipment: Equipment; current_hp: number; max_hp: number;
}): EntityProgression {
  const leader = save.party.heroes.find(h => h.isLeader) ?? save.party.heroes[0];
  if (leader?.progression) return leader.progression;
  // Fallback: pre-migration save
  return {
    class_levels: [{ class_id: save.class_id, levels: save.level }],
    level_history: Array(save.level).fill(save.class_id),
    total_level: save.level,
    xp: save.xp,
    skill_ranks: save.skill_ranks,
    feats: save.feats,
    known_spells: save.known_spells,
    prepared_spells: save.prepared_spells,
    spellbook: save.spellbook,
    spell_slots_used: save.spell_slots_used,
    domains: save.domains,
    school_specialization: save.school_specialization,
    prohibited_schools: save.prohibited_schools,
    equipment: save.equipment,
    current_hp: save.current_hp,
    max_hp: save.max_hp,
  };
}

/** Check if a follower is loyal (eligible for full customization) */
export function isFollowerLoyal(f: Follower): boolean {
  return f.loyalty >= 80;
}

/** Auto-resolve a non-loyal follower level-up as warrior.
 *  Returns the updated follower (level bumped, HP increased, stats scaled). */
export function autoLevelFollower(f: Follower): Follower {
  const conMod = 1; // assume CON 12 for NPCs
  const avgHpGain = 5 + conMod; // d8 average (4.5 → 5) + CON
  return {
    ...f,
    level: f.level + 1,
    maxHp: f.maxHp + avgHpGain,
    hp: f.hp + avgHpGain, // heal by the amount gained
    attack: f.attack + (f.level % 1 === 0 ? 1 : 0), // +1 BAB per level (good progression)
  };
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
  | { type: "died"; followerName: string }
  | { type: "feast"; itemName: string; moraleBonus: number };

export type UpkeepResult = {
  party: Party;
  goldSpent: number;
  foodSpent: number;
  goldRemaining: number;
  foodRemaining: number;
  consumedFoodItemId: string | null;  // inventory food item consumed for morale
  events: UpkeepEvent[];
};

/** Trail rations cost 50cp — any food item above this counts as a feast */
const RATIONS_COST_CP = 50;

/** Morale bonus from consuming a food item, based on its price */
function feastMoraleBonus(priceCp: number): number {
  if (priceCp >= 1000) return 10;  // exotic feast
  if (priceCp >= 200) return 5;    // good meal
  if (priceCp > RATIONS_COST_CP) return 3; // better than rations
  return 0;
}

export function processDailyUpkeep(
  party: Party,
  goldCp: number,   // copper available for wages
  food: number,
  foodInventory?: { id: string; name: string; priceCp: number }[],  // food items from inventory
): UpkeepResult {
  let goldLeft = goldCp;
  let foodLeft = food;
  let totalGoldSpent = 0;
  let totalFoodSpent = 0;
  const events: UpkeepEvent[] = [];

  // Check for feast item — pick the most expensive food item above rations cost
  let feastItem: { id: string; name: string; priceCp: number } | null = null;
  let feastBonus = 0;
  if (foodInventory && foodInventory.length > 0) {
    const candidates = foodInventory
      .filter(f => f.priceCp > RATIONS_COST_CP)
      .sort((a, b) => b.priceCp - a.priceCp);
    if (candidates.length > 0) {
      feastItem = candidates[0];
      feastBonus = feastMoraleBonus(feastItem.priceCp);
    }
  }

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

      // ── Feast bonus — expensive food boosts morale of all fed followers ──
      if (feastBonus > 0 && updated.alive && updated.foodCost > 0) {
        updated = updateMorale(updated, feastBonus);
      }

      // ── Loyalty — slow daily shift based on morale ──
      if (updated.alive) {
        updated = updateLoyaltyDaily(updated);
      }

      // ── Reset daily gift morale cap ──
      updated = resetDailyGifts(updated);

      return updated;
    });

    // Check desertions
    const { remaining, deserted } = checkDesertions(updatedFollowers);
    for (const d of deserted) {
      events.push({ type: "deserted", followerName: d.name });
    }

    return { ...hero, followers: remaining };
  });

  if (feastItem && feastBonus > 0) {
    events.push({ type: "feast", itemName: feastItem.name, moraleBonus: feastBonus });
  }

  return {
    party: { heroes: updatedHeroes },
    goldSpent: totalGoldSpent,
    foodSpent: totalFoodSpent,
    goldRemaining: goldLeft,
    foodRemaining: foodLeft,
    consumedFoodItemId: feastItem?.id ?? null,
    events,
  };
}
