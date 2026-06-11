// ============================================================================
//  strongholdComponents.ts — Modular stronghold add-ons for World of War
// ============================================================================
//
//  Rethemed from the Stronghold Builder's Guidebook concepts and adapted to the
//  World of War castle layer (see worldOfWar.ts). Where the source book prices
//  components in raw gp, these are re-tuned to the WoW Treasury economy
//  (gold/food/iron/wood/mana) so they sit alongside CASTLE_LEVELS and UNIT_DEFS
//  rather than breaking the resource-based balance.
//
//  STATUS: data + types only. The WoW engine does not consume this yet — see
//  STRONGHOLD-COMPONENTS-PROPOSAL.md for the integration plan (Castle.components
//  field, buildComponent(), and how each effect should resolve in combat/economy).
//  Until then this file is a self-contained catalog with no side effects.
//
//  All names and flavor are Tasern-themed (gritty port-city / marsh setting,
//  Kardov's Gate). Marquee names are flagged in the content report for the
//  owner's flavor pass.
// ============================================================================

import type { Treasury, CastleLevel } from "./worldOfWar";

// ── Types ────────────────────────────────────────────────────────────────────

/** What a component primarily does — used for UI grouping and AI build priorities. */
export type ComponentCategory =
  | "defense"     // walls, towers, gatehouses — raise defense / structural HP
  | "military"    // barracks, training yards — garrison & recruitment
  | "economy"     // granaries, mills, forges — production & upkeep
  | "arcane"      // spire, sanctum — mana production & magical defense
  | "utility";    // cistern, infirmary, vault — quality-of-life / siege survival

/**
 * A modular structure that can be added to a castle. Effects are expressed as
 * plain data so the WoW engine (or a future UI) can apply them; nothing here
 * mutates game state on its own.
 */
export type StrongholdComponent = {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;            // Tasern-voiced flavor
  buildCost: Partial<Treasury>;   // one-time cost, in WoW resources
  buildTime: number;              // turns to construct
  minCastleLevel: CastleLevel;    // castle must be at least this level
  // ── Effects (all optional; absent = no effect of that kind) ──
  defenseBonus?: number;          // added to Castle.defense
  hpBonus?: number;               // added to Castle.maxHp
  garrisonBonus?: number;         // added to Castle.maxGarrison
  productionBonus?: Partial<Treasury>; // added to per-turn production
  upkeepReduction?: Partial<Treasury>; // reduces per-turn upkeep (army/castle)
  tags?: string[];                // special behaviors for the engine to switch on
};

// ── Defensive Components ──────────────────────────────────────────────────────

const DEFENSE: StrongholdComponent[] = [
  {
    id: "palisade",
    name: "Timber Palisade",
    category: "defense",
    description: "A ring of sharpened marsh-oak stakes driven deep into the mud. Cheap, quick, and better than an open gate when the raiders come.",
    buildCost: { wood: 80, gold: 30 },
    buildTime: 2,
    minCastleLevel: 1,
    defenseBonus: 4,
    hpBonus: 50,
  },
  {
    id: "stone_curtain_wall",
    name: "Stone Curtain Wall",
    category: "defense",
    description: "Mortared courses of grey quarry-stone, twice a man's height, ringing the bailey. The backbone of any real hold.",
    buildCost: { iron: 120, gold: 200, wood: 60 },
    buildTime: 5,
    minCastleLevel: 2,
    defenseBonus: 10,
    hpBonus: 200,
  },
  {
    id: "corner_tower",
    name: "Corner Tower",
    category: "defense",
    description: "A round bastion at the wall's angle, giving archers a clear line down every approach. Hard to flank, harder to climb.",
    buildCost: { iron: 90, gold: 150, wood: 40 },
    buildTime: 4,
    minCastleLevel: 2,
    defenseBonus: 7,
    hpBonus: 100,
    tags: ["enfilade"], // archers stationed here add ranged defense
  },
  {
    id: "gatehouse",
    name: "Iron-Banded Gatehouse",
    category: "defense",
    description: "A drawbridge, a portcullis, and a murder-hole gallery above the only way in. The most fought-over stone in any siege.",
    buildCost: { iron: 200, gold: 300, wood: 80 },
    buildTime: 6,
    minCastleLevel: 3,
    defenseBonus: 12,
    hpBonus: 150,
    tags: ["choke_point"], // attackers must reduce this before reaching the bailey
  },
  {
    id: "flooded_moat",
    name: "Flooded Moat",
    category: "defense",
    description: "A tide-fed ditch ringing the walls, brown and brackish and deeper than it looks. Sappers drown; siege towers bog down.",
    buildCost: { gold: 150, wood: 50 },
    buildTime: 4,
    minCastleLevel: 2,
    defenseBonus: 8,
    tags: ["anti_siege"], // negates a portion of siege-engine bonus
  },
  {
    id: "battlements",
    name: "Crenellated Battlements",
    category: "defense",
    description: "Toothed parapets along the wall-walk, giving defenders cover to loose and duck. Small thing; many lives.",
    buildCost: { iron: 60, gold: 100 },
    buildTime: 3,
    minCastleLevel: 2,
    defenseBonus: 6,
    tags: ["cover"], // reduces defender casualties in wall fighting
  },
];

// ── Military Components ───────────────────────────────────────────────────────

const MILITARY: StrongholdComponent[] = [
  {
    id: "barracks",
    name: "Barracks",
    category: "military",
    description: "Long timber halls of bunks and weapon-racks. More beds means more spears you can keep on the wall through a long winter.",
    buildCost: { wood: 100, gold: 120, iron: 30 },
    buildTime: 3,
    minCastleLevel: 1,
    garrisonBonus: 50,
  },
  {
    id: "training_yard",
    name: "Training Yard",
    category: "military",
    description: "A churned-mud square ringed by pell-posts and a sergeant who never sleeps. Green levies leave it as soldiers.",
    buildCost: { wood: 60, gold: 150, iron: 40 },
    buildTime: 4,
    minCastleLevel: 2,
    garrisonBonus: 30,
    tags: ["faster_recruit"], // shaves a turn off local recruitment
  },
  {
    id: "siege_workshop",
    name: "Siege Workshop",
    category: "military",
    description: "Sawpits, rope-walks, and the iron skeletons of half-built engines. Where catapults are born and walls are unmade.",
    buildCost: { wood: 200, iron: 150, gold: 250 },
    buildTime: 6,
    minCastleLevel: 3,
    tags: ["build_siege"], // enables/discounts siege-engine recruitment at this castle
  },
  {
    id: "stables_war",
    name: "War Stables",
    category: "military",
    description: "Stalls of destriers and marsh-striders, smelling of leather and oats. Cavalry rides out from here at first light.",
    buildCost: { wood: 120, gold: 180, food: 60 },
    buildTime: 4,
    minCastleLevel: 2,
    garrisonBonus: 20,
    tags: ["mount_cavalry"], // enables cavalry recruitment at lower castle level
  },
];

// ── Economic Components ───────────────────────────────────────────────────────

const ECONOMY: StrongholdComponent[] = [
  {
    id: "granary",
    name: "Granary",
    category: "economy",
    description: "A raised stone store kept dry against the marsh damp and the rats. Full bellies hold a wall; empty ones open the gate.",
    buildCost: { wood: 80, gold: 100, iron: 20 },
    buildTime: 3,
    minCastleLevel: 1,
    productionBonus: { food: 15 },
    tags: ["siege_rations"], // extends how long the castle endures a siege
  },
  {
    id: "watermill",
    name: "Tide Mill",
    category: "economy",
    description: "A wheel turned by the rise and fall of the estuary, grinding grain and coin both. Tasern runs on the tides.",
    buildCost: { wood: 150, iron: 50, gold: 200 },
    buildTime: 5,
    minCastleLevel: 2,
    productionBonus: { gold: 20, food: 10 },
  },
  {
    id: "forge",
    name: "Castle Forge",
    category: "economy",
    description: "A bellows-roaring smithy that turns raw ore into nails, hinges, and spearheads. The hold's own iron, no merchant's mark-up.",
    buildCost: { iron: 100, wood: 80, gold: 180 },
    buildTime: 4,
    minCastleLevel: 2,
    productionBonus: { iron: 12 },
    upkeepReduction: { iron: 2 },
  },
  {
    id: "lumber_camp",
    name: "Lumber Camp",
    category: "economy",
    description: "A clearing of stumps and a sawpit at the forest's edge, hauling marsh-oak back to the walls by the cartload.",
    buildCost: { gold: 120, iron: 30 },
    buildTime: 3,
    minCastleLevel: 1,
    productionBonus: { wood: 15 },
  },
  {
    id: "market_quarter",
    name: "Market Quarter",
    category: "economy",
    description: "A cobbled square of stalls and money-changers under the castle's protection. Taxes on every trade flow up to the keep.",
    buildCost: { wood: 150, gold: 300 },
    buildTime: 5,
    minCastleLevel: 3,
    productionBonus: { gold: 40 },
    tags: ["trade_hub"], // boosts income from connected caravan routes
  },
];

// ── Arcane Components ─────────────────────────────────────────────────────────

const ARCANE: StrongholdComponent[] = [
  {
    id: "mana_spire",
    name: "Mana Spire",
    category: "arcane",
    description: "A slender tower of fused quartz that hums against the storm-charged air over the fens, drawing the wild magic down into stored power.",
    buildCost: { gold: 400, iron: 100, mana: 50 },
    buildTime: 8,
    minCastleLevel: 4,
    productionBonus: { mana: 15 },
  },
  {
    id: "warding_sanctum",
    name: "Warding Sanctum",
    category: "arcane",
    description: "A chamber of graven sigils where the hold's mages bind protective wards into the very stone. Hostile spells gutter and fail at the wall.",
    buildCost: { gold: 350, mana: 100, iron: 60 },
    buildTime: 7,
    minCastleLevel: 4,
    defenseBonus: 10,
    tags: ["counter_magic"], // reduces enemy War Mage effectiveness in siege
  },
];

// ── Utility Components ────────────────────────────────────────────────────────

const UTILITY: StrongholdComponent[] = [
  {
    id: "cistern",
    name: "Deep Cistern",
    category: "utility",
    description: "A vaulted stone tank of clean rainwater, sealed against the brackish tide. A besieged hold dies of thirst long before hunger.",
    buildCost: { gold: 120, iron: 40, wood: 30 },
    buildTime: 3,
    minCastleLevel: 2,
    hpBonus: 50,
    tags: ["siege_water"], // extends siege endurance, stacks with granary
  },
  {
    id: "infirmary",
    name: "Infirmary",
    category: "utility",
    description: "Cots, clean linen, and a chirurgeon who has seen every way a man can be opened. The wounded who reach it often walk out again.",
    buildCost: { gold: 150, wood: 60, food: 40 },
    buildTime: 4,
    minCastleLevel: 2,
    tags: ["recover_wounded"], // a fraction of garrison losses return after battle
  },
  {
    id: "vault",
    name: "Strongroom Vault",
    category: "utility",
    description: "An iron-doored chamber beneath the keep where the hold's gold and writs are kept. Hard to reach, harder to crack — even when the walls fall.",
    buildCost: { iron: 150, gold: 200, wood: 20 },
    buildTime: 5,
    minCastleLevel: 3,
    tags: ["protect_treasury"], // a share of treasury survives if the castle is taken
  },
  {
    id: "signal_beacon",
    name: "Signal Beacon",
    category: "utility",
    description: "A great iron fire-basket atop the highest tower, ready to light the chain of beacons across Tasern. Help comes faster to a hold that can call for it.",
    buildCost: { wood: 50, iron: 60, gold: 100 },
    buildTime: 2,
    minCastleLevel: 2,
    tags: ["reinforce_signal"], // allies/reserves arrive sooner when this castle is attacked
  },
];

// ── Aggregate ─────────────────────────────────────────────────────────────────

export const STRONGHOLD_COMPONENTS: StrongholdComponent[] = [
  ...DEFENSE,
  ...MILITARY,
  ...ECONOMY,
  ...ARCANE,
  ...UTILITY,
];

/** Look up a component definition by id. */
export function getComponent(id: string): StrongholdComponent | undefined {
  return STRONGHOLD_COMPONENTS.find((c) => c.id === id);
}

/** All components a castle of the given level is allowed to build. */
export function componentsForCastleLevel(level: CastleLevel): StrongholdComponent[] {
  return STRONGHOLD_COMPONENTS.filter((c) => c.minCastleLevel <= level);
}

/** All components in a given category. */
export function componentsByCategory(category: ComponentCategory): StrongholdComponent[] {
  return STRONGHOLD_COMPONENTS.filter((c) => c.category === category);
}
