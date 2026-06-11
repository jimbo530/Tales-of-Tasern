// ============================================================
// worldOfWar.ts — Strategic Kingdom Layer for Tales of Tasern
//
// Same hex world, zoomed out. Each hex = a region.
// Turn-based (1 turn = 1 in-game week). One save per wallet.
// Players command armies, siege castles, control territory,
// and manage supply lines. Hero from D20 RPG adds personal power.
//
// Imports hex types from hexWorld.ts. Uses same deterministic
// seed-based generation for consistent world state.
// ============================================================

import type { Coord, Terrain, Resource } from "./hexWorld";

// ============================================================================
//  SEEDED RNG — deterministic random for WoW-specific generation
// ============================================================================

function wowHash(a: number, b: number, seed: number): number {
  let h = seed ^ 0xcafebabe;
  h = Math.imul(h ^ a, 0x9e3779b9);
  h = Math.imul(h ^ b, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff; // [0, 1)
}

function wowRoll(seed: number, turn: number, slot: number): number {
  return wowHash(turn * 97 + slot, slot * 53 + turn, seed);
}

// ============================================================================
//  CORE TYPES
// ============================================================================

// ── Resources ───────────────────────────────────────────────────────────────

export type KingdomResource = "gold" | "food" | "iron" | "wood" | "mana";

export type Treasury = Record<KingdomResource, number>;

// ── Castle System ───────────────────────────────────────────────────────────

export type CastleLevel = 1 | 2 | 3 | 4 | 5;

export const CASTLE_NAMES: Record<CastleLevel, string> = {
  1: "Outpost",
  2: "Keep",
  3: "Fortress",
  4: "Citadel",
  5: "Capital",
};

export type Castle = {
  id: string;
  name: string;
  level: CastleLevel;
  hex: Coord;
  garrison: number;        // troops stationed for defense
  maxGarrison: number;     // based on castle level
  defense: number;         // defense rating (walls, towers)
  production: Treasury;    // resources produced per turn
  buildProgress: number;   // turns remaining for current upgrade (0 = idle)
  siegeTurns: number;      // turns under siege (0 = not sieged)
  hp: number;              // structural HP
  maxHp: number;
};

// Castle level definitions: cost to build/upgrade, stats granted
export type CastleLevelDef = {
  level: CastleLevel;
  name: string;
  buildCost: Partial<Treasury>;
  buildTime: number;        // turns to build/upgrade
  maxGarrison: number;
  defense: number;
  hp: number;
  productionBonus: Partial<Treasury>;
};

export const CASTLE_LEVELS: CastleLevelDef[] = [
  {
    level: 1, name: "Outpost",
    buildCost: { gold: 200, wood: 150, iron: 50 },
    buildTime: 3,
    maxGarrison: 50, defense: 5, hp: 100,
    productionBonus: { gold: 10, food: 5 },
  },
  {
    level: 2, name: "Keep",
    buildCost: { gold: 500, wood: 300, iron: 150 },
    buildTime: 5,
    maxGarrison: 150, defense: 12, hp: 250,
    productionBonus: { gold: 25, food: 15, iron: 5 },
  },
  {
    level: 3, name: "Fortress",
    buildCost: { gold: 1200, wood: 600, iron: 400 },
    buildTime: 8,
    maxGarrison: 300, defense: 22, hp: 500,
    productionBonus: { gold: 50, food: 30, iron: 15, wood: 10 },
  },
  {
    level: 4, name: "Citadel",
    buildCost: { gold: 3000, wood: 1000, iron: 800, mana: 100 },
    buildTime: 12,
    maxGarrison: 600, defense: 35, hp: 1000,
    productionBonus: { gold: 100, food: 50, iron: 30, wood: 20, mana: 10 },
  },
  {
    level: 5, name: "Capital",
    buildCost: { gold: 8000, wood: 2000, iron: 1500, mana: 500 },
    buildTime: 20,
    maxGarrison: 1200, defense: 50, hp: 2000,
    productionBonus: { gold: 200, food: 100, iron: 60, wood: 40, mana: 30 },
  },
];

// ── Unit Types ──────────────────────────────────────────────────────────────

export type UnitType =
  | "infantry"
  | "cavalry"
  | "archers"
  | "siege_engines"
  | "mages"
  | "flying"
  | "yieldlings";

export type UnitDef = {
  type: UnitType;
  name: string;
  strength: number;       // combat power per unit
  speed: number;          // hexes per turn
  upkeep: Partial<Treasury>;  // cost per turn per unit
  recruitCost: Partial<Treasury>;
  recruitTime: number;    // turns to recruit a batch of 10
  supplyRange: number;    // turns without resupply before attrition
  bonuses: string[];      // special abilities
  requirement?: string;   // what is needed to recruit (castle level, etc.)
};

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  infantry: {
    type: "infantry", name: "Infantry",
    strength: 2, speed: 2,
    upkeep: { gold: 1, food: 2 },
    recruitCost: { gold: 10, iron: 5 },
    recruitTime: 1, supplyRange: 6,
    bonuses: ["shield_wall"],
    requirement: "Outpost",
  },
  cavalry: {
    type: "cavalry", name: "Cavalry",
    strength: 4, speed: 4,
    upkeep: { gold: 3, food: 4 },
    recruitCost: { gold: 30, iron: 10, food: 10 },
    recruitTime: 2, supplyRange: 4,
    bonuses: ["flanking", "charge"],
    requirement: "Keep",
  },
  archers: {
    type: "archers", name: "Archers",
    strength: 3, speed: 2,
    upkeep: { gold: 2, food: 2, wood: 1 },
    recruitCost: { gold: 15, wood: 10 },
    recruitTime: 1, supplyRange: 5,
    bonuses: ["ranged", "volley"],
    requirement: "Outpost",
  },
  siege_engines: {
    type: "siege_engines", name: "Siege Engines",
    strength: 1, speed: 1,
    upkeep: { gold: 5, wood: 3, iron: 2 },
    recruitCost: { gold: 80, wood: 50, iron: 30 },
    recruitTime: 4, supplyRange: 3,
    bonuses: ["wall_breaker", "anti_structure"],
    requirement: "Fortress",
  },
  mages: {
    type: "mages", name: "War Mages",
    strength: 6, speed: 2,
    upkeep: { gold: 8, food: 2, mana: 3 },
    recruitCost: { gold: 100, mana: 50 },
    recruitTime: 3, supplyRange: 4,
    bonuses: ["aoe_damage", "arcane_shield", "counter_magic"],
    requirement: "Citadel",
  },
  flying: {
    type: "flying", name: "Sky Riders",
    strength: 4, speed: 6,
    upkeep: { gold: 5, food: 5, mana: 1 },
    recruitCost: { gold: 60, food: 20, mana: 10 },
    recruitTime: 3, supplyRange: 3,
    bonuses: ["ignore_terrain", "scout", "aerial_strike"],
    requirement: "Citadel",
  },
  yieldlings: {
    type: "yieldlings", name: "Yieldlings",
    strength: 8, speed: 3,
    upkeep: { gold: 2, food: 8, mana: 5 },
    recruitCost: { gold: 200, mana: 100 },
    recruitTime: 5, supplyRange: 8,
    bonuses: ["regenerate", "evolve", "symbiotic"],
    requirement: "Capital",
  },
};

// ── Army ────────────────────────────────────────────────────────────────────

export type UnitStack = {
  type: UnitType;
  count: number;
};

export type Army = {
  id: string;
  name: string;
  hex: Coord;
  units: UnitStack[];
  morale: number;          // 0-100, army-level morale
  supply: number;          // turns of supply remaining
  maxSupply: number;       // based on composition
  movesRemaining: number;  // hexes this army can still move this turn
  orders: ArmyOrder | null;
  heroAttached: boolean;   // player D20 character is with this army
  status: "idle" | "marching" | "besieging" | "defending" | "routing";
};

export type ArmyOrder =
  | { type: "move"; path: Coord[] }
  | { type: "attack"; target: string }  // army or castle ID
  | { type: "siege"; castleId: string }
  | { type: "defend"; hex: Coord }
  | { type: "resupply" }
  | { type: "retreat"; direction: Coord };

// ── Diplomacy ───────────────────────────────────────────────────────────────

export type DiplomacyStatus = "allied" | "neutral" | "war" | "vassal" | "tribute";

export type Treaty = {
  type: "alliance" | "non_aggression" | "trade" | "tribute";
  partnerKingdomId: string;
  turnsRemaining: number;   // -1 = permanent until broken
  terms?: string;
};

// ── Kingdom ─────────────────────────────────────────────────────────────────

export type Kingdom = {
  id: string;
  name: string;
  ruler: string;            // wallet address (or AI identifier)
  isPlayer: boolean;
  castles: Castle[];
  armies: Army[];
  territory: Coord[];       // hexes controlled
  treasury: Treasury;
  population: number;
  morale: number;           // 0-100, kingdom-wide morale
  diplomacy: Record<string, DiplomacyStatus>;
  treaties: Treaty[];
  turn: number;
  seed: number;             // for deterministic random events
  victoryPoints: number;
  flags: Record<string, boolean>;  // state flags for events/quests
  morale_streak?: number;          // consecutive turns at 90+ morale (cultural victory tracker)
};

// ── Combat ──────────────────────────────────────────────────────────────────

export type BattleResult = {
  victor: "attacker" | "defender" | "draw";
  attackerLosses: UnitStack[];
  defenderLosses: UnitStack[];
  attackerMoraleChange: number;
  defenderMoraleChange: number;
  capturedCastle: boolean;
  routedArmy: string | null;  // army ID that fled
  heroBonus: number;
  terrainEffect: string;
  narrative: string;          // battle report text
};

// ── Turn Report ─────────────────────────────────────────────────────────────

export type TurnEvent =
  | { type: "production"; resources: Partial<Treasury> }
  | { type: "upkeep"; cost: Partial<Treasury>; deficit: boolean }
  | { type: "population_change"; delta: number; reason: string }
  | { type: "morale_change"; delta: number; reason: string }
  | { type: "battle"; result: BattleResult; location: Coord }
  | { type: "castle_complete"; castle: Castle }
  | { type: "army_recruited"; army: Army }
  | { type: "supply_loss"; armyId: string; attrition: number }
  | { type: "random_event"; event: RandomEvent }
  | { type: "diplomacy_change"; kingdom: string; from: DiplomacyStatus; to: DiplomacyStatus }
  | { type: "victory_check"; condition: VictoryCondition | null };

export type TurnReport = {
  turn: number;
  events: TurnEvent[];
  kingdomSnapshot: Kingdom;
};

// ── Random Events ───────────────────────────────────────────────────────────

export type RandomEventType =
  | "plague"
  | "bountiful_harvest"
  | "peasant_rebellion"
  | "mercenaries_available"
  | "dragon_attack"
  | "trade_opportunity"
  | "enemy_spy_caught"
  | "hero_quest"
  | "bandit_raids"
  | "diplomatic_incident"
  | "magical_surge"
  | "refugee_influx";

export type RandomEvent = {
  type: RandomEventType;
  title: string;
  description: string;
  effects: Partial<Treasury>;
  moraleEffect: number;
  populationEffect: number;
  requiresResponse: boolean;
  options?: EventOption[];
};

export type EventOption = {
  label: string;
  cost?: Partial<Treasury>;
  effects: Partial<Treasury>;
  moraleEffect: number;
  populationEffect: number;
  outcome: string;
};

// ── Victory ─────────────────────────────────────────────────────────────────

export type VictoryCondition =
  | { type: "domination"; percentControlled: number }
  | { type: "economic"; goldAccumulated: number }
  | { type: "military"; capitalsDestroyed: number }
  | { type: "cultural"; moraleTurns: number };

// ============================================================================
//  TERRAIN → STRATEGIC VALUE
// ============================================================================

// Resource production by terrain (per hex controlled, per turn)
const TERRAIN_PRODUCTION: Record<Terrain, Partial<Treasury>> = {
  grass:      { food: 3, gold: 1 },
  plains:     { food: 4, gold: 1 },
  forest:     { wood: 4, food: 1 },
  jungle:     { wood: 3, food: 2, mana: 1 },
  mountain:   { iron: 4, gold: 2 },
  highlands:  { iron: 2, gold: 1, food: 1 },
  desert:     { gold: 2, mana: 1 },
  swamp:      { food: 1, mana: 2 },
  coast:      { food: 3, gold: 3 },
  water:      { food: 2, gold: 1 },
  snow:       { iron: 1, mana: 2 },
  volcanic:   { iron: 3, mana: 3 },
  fungal:     { food: 2, mana: 4 },
  cursed:     { mana: 5 },
};

// Defensive bonus by terrain (multiplier to defender strength)
const TERRAIN_DEFENSE_BONUS: Record<Terrain, number> = {
  grass: 1.0, plains: 1.0, coast: 1.0, water: 0.8,
  forest: 1.4, jungle: 1.5, swamp: 1.3,
  mountain: 1.8, highlands: 1.5, snow: 1.3,
  desert: 0.9, volcanic: 1.1,
  fungal: 1.2, cursed: 1.1,
};

// Movement cost for armies by terrain (hexes "consumed" per hex entered)
const STRATEGIC_MOVEMENT_COST: Record<Terrain, number> = {
  grass: 1, plains: 1, coast: 1,
  forest: 2, jungle: 3, swamp: 3,
  mountain: 3, highlands: 2, snow: 2,
  desert: 2, volcanic: 3,
  water: 1,  // only with ships
  fungal: 2, cursed: 2,
};

// ============================================================================
//  RANDOM EVENT DEFINITIONS
// ============================================================================

const RANDOM_EVENTS: RandomEvent[] = [
  {
    type: "plague",
    title: "The Wasting Sickness",
    description: "A plague sweeps through your lands. Villages fall silent. The people cry out for aid.",
    effects: { gold: -50 },
    moraleEffect: -15,
    populationEffect: -200,
    requiresResponse: true,
    options: [
      {
        label: "Quarantine and pray",
        effects: {},
        moraleEffect: -5,
        populationEffect: -100,
        outcome: "The quarantine slows the spread but trust in the crown wavers.",
      },
      {
        label: "Hire healers (100 gold)",
        cost: { gold: 100 },
        effects: {},
        moraleEffect: 5,
        populationEffect: 50,
        outcome: "Healers tend to the sick. Many recover. The people remember your generosity.",
      },
    ],
  },
  {
    type: "bountiful_harvest",
    title: "A Golden Harvest",
    description: "The rains came at the perfect time. Fields overflow with grain. The granaries fill to bursting.",
    effects: { food: 100 },
    moraleEffect: 10,
    populationEffect: 50,
    requiresResponse: false,
  },
  {
    type: "peasant_rebellion",
    title: "The Pitchfork Rising",
    description: "Overtaxed peasants have taken up arms! A mob marches on your nearest castle.",
    effects: { gold: -30 },
    moraleEffect: -20,
    populationEffect: -50,
    requiresResponse: true,
    options: [
      {
        label: "Crush them with soldiers",
        effects: {},
        moraleEffect: -10,
        populationEffect: -100,
        outcome: "The rebellion is put down. Fear keeps the peace, but resentment festers.",
      },
      {
        label: "Lower taxes (50 gold/turn for 3 turns)",
        cost: { gold: 150 },
        effects: {},
        moraleEffect: 15,
        populationEffect: 25,
        outcome: "The peasants lay down arms. Word spreads of a just ruler.",
      },
      {
        label: "Negotiate — offer land",
        effects: { food: -30 },
        moraleEffect: 5,
        populationEffect: 0,
        outcome: "Leaders are given small holdings. The mob disperses. An uneasy truce.",
      },
    ],
  },
  {
    type: "mercenaries_available",
    title: "Blades for Hire",
    description: "A mercenary company arrives at your gates. Hardened veterans, seeking employment.",
    effects: {},
    moraleEffect: 0,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Hire them (200 gold)",
        cost: { gold: 200 },
        effects: {},
        moraleEffect: 5,
        populationEffect: 0,
        outcome: "50 veteran infantry join your forces. Professional, ruthless, effective.",
      },
      {
        label: "Turn them away",
        effects: {},
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "The mercenaries move on. Perhaps a rival will hire them instead.",
      },
    ],
  },
  {
    type: "dragon_attack",
    title: "Wings of Fire",
    description: "A great wyrm descends upon your territory! Farms burn. Soldiers flee. Send an army or lose everything.",
    effects: { food: -50, wood: -30 },
    moraleEffect: -15,
    populationEffect: -75,
    requiresResponse: true,
    options: [
      {
        label: "Send your strongest army",
        effects: {},
        moraleEffect: 10,
        populationEffect: 0,
        outcome: "Your warriors drive off the beast. Songs will be sung of this day.",
      },
      {
        label: "Offer tribute (500 gold)",
        cost: { gold: 500 },
        effects: {},
        moraleEffect: -5,
        populationEffect: 0,
        outcome: "The dragon takes the gold and departs. For now.",
      },
      {
        label: "Do nothing",
        effects: { food: -100, wood: -60 },
        moraleEffect: -20,
        populationEffect: -150,
        outcome: "The dragon ravages three settlements before flying off, sated.",
      },
    ],
  },
  {
    type: "trade_opportunity",
    title: "Merchant Caravan",
    description: "A great caravan arrives from distant lands, offering rare goods at favorable prices.",
    effects: { gold: 30 },
    moraleEffect: 5,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Trade food for iron (50 food -> 30 iron)",
        cost: { food: 50 },
        effects: { iron: 30 },
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "A fair exchange. Your smiths rejoice.",
      },
      {
        label: "Trade wood for gold (40 wood -> 60 gold)",
        cost: { wood: 40 },
        effects: { gold: 60 },
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "The caravan loads timber eagerly. Gold fills your coffers.",
      },
      {
        label: "Buy mana crystals (100 gold -> 20 mana)",
        cost: { gold: 100 },
        effects: { mana: 20 },
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "Arcane crystals secured. Your mages glow with anticipation.",
      },
    ],
  },
  {
    type: "enemy_spy_caught",
    title: "The Shadow Unmasked",
    description: "Your guards capture a spy from a rival kingdom! Under questioning, they reveal enemy army positions.",
    effects: {},
    moraleEffect: 5,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Execute the spy (intimidate rivals)",
        effects: {},
        moraleEffect: 3,
        populationEffect: 0,
        outcome: "The spy's head is displayed at the gate. Enemy scouts think twice.",
      },
      {
        label: "Turn them as a double agent",
        effects: { gold: -20 },
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "The spy now feeds misinformation to your enemies. Clever.",
      },
    ],
  },
  {
    type: "hero_quest",
    title: "A Call to Arms",
    description: "Word of a powerful artifact reaches your ears. Your hero could retrieve it — but the journey is perilous.",
    effects: {},
    moraleEffect: 0,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Send your hero (absent for 3 turns)",
        effects: {},
        moraleEffect: 5,
        populationEffect: 0,
        outcome: "Your hero departs. If they succeed, great power awaits.",
      },
      {
        label: "Ignore it — keep hero with armies",
        effects: {},
        moraleEffect: 0,
        populationEffect: 0,
        outcome: "The artifact remains lost. Perhaps that is for the best.",
      },
    ],
  },
  {
    type: "bandit_raids",
    title: "Wolves on Two Legs",
    description: "Bandits have established a camp in your territory. Trade routes suffer.",
    effects: { gold: -20, food: -15 },
    moraleEffect: -8,
    populationEffect: -25,
    requiresResponse: true,
    options: [
      {
        label: "Hunt them down (requires army in territory)",
        effects: { gold: 40 },
        moraleEffect: 10,
        populationEffect: 0,
        outcome: "The bandits are routed. Their stolen loot replenishes your treasury.",
      },
      {
        label: "Recruit them (pay 50 gold)",
        cost: { gold: 50 },
        effects: {},
        moraleEffect: -3,
        populationEffect: 20,
        outcome: "The bandits become irregular scouts. The people grumble.",
      },
    ],
  },
  {
    type: "diplomatic_incident",
    title: "Border Dispute",
    description: "A rival kingdom's patrol crossed into your territory and killed a merchant. Tensions rise.",
    effects: {},
    moraleEffect: -5,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Demand reparations",
        effects: { gold: 30 },
        moraleEffect: 5,
        populationEffect: 0,
        outcome: "The rival pays, grudgingly. Relations sour.",
      },
      {
        label: "Let it slide (maintain peace)",
        effects: {},
        moraleEffect: -5,
        populationEffect: 0,
        outcome: "Your people see weakness. The rival sees opportunity.",
      },
      {
        label: "Retaliate in kind",
        effects: {},
        moraleEffect: 8,
        populationEffect: 0,
        outcome: "Your raiders strike back. War may follow.",
      },
    ],
  },
  {
    type: "magical_surge",
    title: "The Ley Lines Pulse",
    description: "A surge of magical energy courses through the land. Crystals glow. Enchantments strengthen.",
    effects: { mana: 40 },
    moraleEffect: 3,
    populationEffect: 0,
    requiresResponse: false,
  },
  {
    type: "refugee_influx",
    title: "The Displaced",
    description: "Refugees from a neighboring conflict arrive at your borders, seeking shelter.",
    effects: {},
    moraleEffect: 0,
    populationEffect: 0,
    requiresResponse: true,
    options: [
      {
        label: "Welcome them (feed them: 30 food)",
        cost: { food: 30 },
        effects: {},
        moraleEffect: 8,
        populationEffect: 150,
        outcome: "New settlers strengthen your kingdom. Word of your mercy spreads.",
      },
      {
        label: "Turn them away",
        effects: {},
        moraleEffect: -3,
        populationEffect: 0,
        outcome: "The refugees shuffle onward. Some of your people look away in shame.",
      },
    ],
  },
];

// ============================================================================
//  AI KINGDOM GENERATION
// ============================================================================

type AIPersonality = "aggressive" | "defensive" | "expansionist" | "diplomatic" | "merchant";

type AIKingdomDef = {
  id: string;
  name: string;
  rulerName: string;
  personality: AIPersonality;
  startHex: Coord;
  color: string;
  description: string;
};

const AI_KINGDOMS: AIKingdomDef[] = [
  {
    id: "ironhold",
    name: "The Ironhold",
    rulerName: "Warlord Grask",
    personality: "aggressive",
    startHex: { q: 15, r: 10 },
    color: "#8B0000",
    description: "A militaristic kingdom built on conquest. Their forges never cool.",
  },
  {
    id: "verdant_crown",
    name: "The Verdant Crown",
    rulerName: "Queen Elethra",
    personality: "defensive",
    startHex: { q: 50, r: 45 },
    color: "#228B22",
    description: "An ancient woodland kingdom. They fight only to protect what is theirs.",
  },
  {
    id: "salt_throne",
    name: "The Salt Throne",
    rulerName: "Merchant Prince Davar",
    personality: "merchant",
    startHex: { q: 60, r: 20 },
    color: "#4169E1",
    description: "A coastal trading empire. They prefer gold to glory — but have both.",
  },
  {
    id: "ashen_reach",
    name: "The Ashen Reach",
    rulerName: "Archon Kael",
    personality: "expansionist",
    startHex: { q: 25, r: 55 },
    color: "#4B0082",
    description: "A mage-ruled territory pushing outward with arcane force.",
  },
  {
    id: "frostwatch",
    name: "Frostwatch",
    rulerName: "Jarl Thordis",
    personality: "defensive",
    startHex: { q: 40, r: 5 },
    color: "#87CEEB",
    description: "A hardy northern kingdom. Their walls are ice and iron.",
  },
  {
    id: "sunfire",
    name: "The Sunfire Dominion",
    rulerName: "Empress Zahra",
    personality: "diplomatic",
    startHex: { q: 70, r: 40 },
    color: "#FFD700",
    description: "A desert empire of diplomats and schemers. Alliances are their weapon.",
  },
];

// ============================================================================
//  HELPER FUNCTIONS
// ============================================================================

function coordKey(c: Coord): string {
  return `${c.q},${c.r}`;
}

function coordFromKey(key: string): Coord {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

function emptyTreasury(): Treasury {
  return { gold: 0, food: 0, iron: 0, wood: 0, mana: 0 };
}

function addTreasury(base: Treasury, add: Partial<Treasury>): Treasury {
  return {
    gold: base.gold + (add.gold ?? 0),
    food: base.food + (add.food ?? 0),
    iron: base.iron + (add.iron ?? 0),
    wood: base.wood + (add.wood ?? 0),
    mana: base.mana + (add.mana ?? 0),
  };
}

function subtractTreasury(base: Treasury, cost: Partial<Treasury>): Treasury {
  return {
    gold: base.gold - (cost.gold ?? 0),
    food: base.food - (cost.food ?? 0),
    iron: base.iron - (cost.iron ?? 0),
    wood: base.wood - (cost.wood ?? 0),
    mana: base.mana - (cost.mana ?? 0),
  };
}

function canAfford(treasury: Treasury, cost: Partial<Treasury>): boolean {
  return (
    treasury.gold >= (cost.gold ?? 0) &&
    treasury.food >= (cost.food ?? 0) &&
    treasury.iron >= (cost.iron ?? 0) &&
    treasury.wood >= (cost.wood ?? 0) &&
    treasury.mana >= (cost.mana ?? 0)
  );
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Hex distance between two coordinates (cube-based) */
function hexDist(a: Coord, b: Coord): number {
  // Convert odd-q offset to cube
  const ax = a.q;
  const az = a.r - (a.q - (a.q & 1)) / 2;
  const ay = -ax - az;
  const bx = b.q;
  const bz = b.r - (b.q - (b.q & 1)) / 2;
  const by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** Get hex neighbors (odd-q offset, unbounded) */
function getNeighbors(hex: Coord): Coord[] {
  const evenQ = [
    { dq: +1, dr: 0 }, { dq: +1, dr: -1 },
    { dq: 0, dr: -1 }, { dq: -1, dr: -1 },
    { dq: -1, dr: 0 }, { dq: 0, dr: +1 },
  ];
  const oddQ = [
    { dq: +1, dr: +1 }, { dq: +1, dr: 0 },
    { dq: 0, dr: -1 }, { dq: -1, dr: 0 },
    { dq: -1, dr: +1 }, { dq: 0, dr: +1 },
  ];
  const offsets = (hex.q & 1) === 0 ? evenQ : oddQ;
  return offsets.map(d => ({ q: hex.q + d.dq, r: hex.r + d.dr }));
}

/** BFS path from start to end, avoiding blocked hexes */
function findPath(start: Coord, end: Coord, blocked: Set<string>): Coord[] {
  const startKey = coordKey(start);
  const endKey = coordKey(end);
  if (startKey === endKey) return [start];

  const visited = new Set<string>([startKey]);
  const queue: { coord: Coord; path: Coord[] }[] = [{ coord: start, path: [start] }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of getNeighbors(current.coord)) {
      const key = coordKey(neighbor);
      if (visited.has(key) || blocked.has(key)) continue;
      visited.add(key);
      const newPath = [...current.path, neighbor];
      if (key === endKey) return newPath;
      queue.push({ coord: neighbor, path: newPath });
    }
  }
  return []; // no path found
}

// ============================================================================
//  ARMY CALCULATIONS
// ============================================================================

/** Total combat strength of an army */
export function armyStrength(army: Army): number {
  let str = 0;
  for (const stack of army.units) {
    const def = UNIT_DEFS[stack.type];
    str += def.strength * stack.count;
  }
  // Morale modifier: +/- up to 30%
  const moraleModifier = 1 + (army.morale - 50) / 166;
  // Hero bonus: ~20% if attached
  const heroMod = army.heroAttached ? 1.2 : 1.0;
  return Math.round(str * moraleModifier * heroMod);
}

/** Army movement speed = slowest unit type in the composition */
export function armySpeed(army: Army): number {
  let slowest = Infinity;
  for (const stack of army.units) {
    if (stack.count > 0) {
      const spd = UNIT_DEFS[stack.type].speed;
      if (spd < slowest) slowest = spd;
    }
  }
  return slowest === Infinity ? 0 : slowest;
}

/** Calculate total upkeep for an army per turn */
export function armyUpkeep(army: Army): Partial<Treasury> {
  const total: Treasury = emptyTreasury();
  for (const stack of army.units) {
    const def = UNIT_DEFS[stack.type];
    total.gold += (def.upkeep.gold ?? 0) * stack.count;
    total.food += (def.upkeep.food ?? 0) * stack.count;
    total.iron += (def.upkeep.iron ?? 0) * stack.count;
    total.wood += (def.upkeep.wood ?? 0) * stack.count;
    total.mana += (def.upkeep.mana ?? 0) * stack.count;
  }
  return total;
}

/** Total unit count */
export function armyUnitCount(army: Army): number {
  return army.units.reduce((sum, s) => sum + s.count, 0);
}

/** Check if supply line exists: army hex connected to any owned castle via territory */
export function hasSupplyLine(army: Army, kingdom: Kingdom): boolean {
  const territorySet = new Set(kingdom.territory.map(coordKey));
  const armyKey = coordKey(army.hex);

  // Army must be in or adjacent to own territory
  if (!territorySet.has(armyKey)) {
    const neighbors = getNeighbors(army.hex);
    if (!neighbors.some(n => territorySet.has(coordKey(n)))) return false;
  }

  // Check if any castle is reachable through territory (BFS)
  for (const castle of kingdom.castles) {
    const castleKey = coordKey(castle.hex);
    if (castleKey === armyKey) return true;

    // BFS through territory from army to castle
    const visited = new Set<string>([armyKey]);
    const queue = [army.hex];
    let found = false;

    while (queue.length > 0 && !found) {
      const current = queue.shift()!;
      for (const neighbor of getNeighbors(current)) {
        const nk = coordKey(neighbor);
        if (visited.has(nk)) continue;
        if (!territorySet.has(nk)) continue;
        if (nk === castleKey) { found = true; break; }
        visited.add(nk);
        queue.push(neighbor);
      }
    }
    if (found) return true;
  }
  return false;
}

// ============================================================================
//  COMBAT RESOLUTION
// ============================================================================

/**
 * Resolve battle between two armies.
 * Terrain of defender's hex gives defense bonus.
 * Flanking bonus if multiple friendly armies adjacent to defender.
 */
export function resolveBattle(
  attacker: Army,
  defender: Army,
  defenderTerrain: Terrain,
  attackerFlanking: number,  // number of friendly armies adjacent to defender (0-5)
  seed: number,
): BattleResult {
  const atkStr = armyStrength(attacker);
  const defStr = armyStrength(defender);

  // Terrain defense bonus
  const terrainMod = TERRAIN_DEFENSE_BONUS[defenderTerrain];
  const effectiveDefStr = Math.round(defStr * terrainMod);

  // Flanking bonus: +15% per flanking army, max +60%
  const flankMod = 1 + Math.min(attackerFlanking, 4) * 0.15;
  const effectiveAtkStr = Math.round(atkStr * flankMod);

  // Battle rolls — add variance (both sides roll d20-equivalent)
  const atkRoll = wowHash(seed, attacker.units.length, 1) * 0.4 + 0.8; // 0.8-1.2
  const defRoll = wowHash(seed, defender.units.length, 2) * 0.4 + 0.8;

  const finalAtk = effectiveAtkStr * atkRoll;
  const finalDef = effectiveDefStr * defRoll;

  // Determine outcome
  const ratio = finalAtk / Math.max(finalDef, 1);
  let victor: "attacker" | "defender" | "draw";
  if (ratio > 1.3) victor = "attacker";
  else if (ratio < 0.77) victor = "defender";
  else victor = "draw";

  // Calculate losses: loser takes 30-60% casualties, winner takes 10-25%
  const loserLossPct = 0.3 + wowHash(seed, 3, 3) * 0.3;
  const winnerLossPct = 0.1 + wowHash(seed, 4, 4) * 0.15;

  function applyLosses(army: Army, pct: number): UnitStack[] {
    const losses: UnitStack[] = [];
    for (const stack of army.units) {
      const lost = Math.round(stack.count * pct);
      if (lost > 0) {
        losses.push({ type: stack.type, count: lost });
        stack.count = Math.max(0, stack.count - lost);
      }
    }
    // Remove empty stacks
    army.units = army.units.filter(s => s.count > 0);
    return losses;
  }

  let attackerLosses: UnitStack[];
  let defenderLosses: UnitStack[];
  let attackerMoraleChange: number;
  let defenderMoraleChange: number;
  let routedArmy: string | null = null;

  if (victor === "attacker") {
    attackerLosses = applyLosses(attacker, winnerLossPct);
    defenderLosses = applyLosses(defender, loserLossPct);
    attackerMoraleChange = 10;
    defenderMoraleChange = -20;
    // Defender may rout if morale drops below 20
    if (defender.morale + defenderMoraleChange < 20) {
      routedArmy = defender.id;
      defender.status = "routing";
    }
  } else if (victor === "defender") {
    attackerLosses = applyLosses(attacker, loserLossPct);
    defenderLosses = applyLosses(defender, winnerLossPct);
    attackerMoraleChange = -20;
    defenderMoraleChange = 10;
    if (attacker.morale + attackerMoraleChange < 20) {
      routedArmy = attacker.id;
      attacker.status = "routing";
    }
  } else {
    // Draw: both take moderate losses
    const drawPct = 0.15 + wowHash(seed, 5, 5) * 0.1;
    attackerLosses = applyLosses(attacker, drawPct);
    defenderLosses = applyLosses(defender, drawPct);
    attackerMoraleChange = -5;
    defenderMoraleChange = -5;
  }

  attacker.morale = clamp(attacker.morale + attackerMoraleChange, 0, 100);
  defender.morale = clamp(defender.morale + defenderMoraleChange, 0, 100);

  // Build narrative
  const terrainName = defenderTerrain.charAt(0).toUpperCase() + defenderTerrain.slice(1);
  let narrative = `Battle in the ${terrainName}. `;
  narrative += `${attacker.name} (str ${effectiveAtkStr}) vs ${defender.name} (str ${effectiveDefStr}). `;
  if (victor === "attacker") narrative += `${attacker.name} carries the day!`;
  else if (victor === "defender") narrative += `${defender.name} holds firm!`;
  else narrative += "Neither side yields. Both withdraw bloodied.";
  if (routedArmy) narrative += ` The defeated army routs!`;

  return {
    victor,
    attackerLosses,
    defenderLosses,
    attackerMoraleChange,
    defenderMoraleChange,
    capturedCastle: false,
    routedArmy,
    heroBonus: attacker.heroAttached ? Math.round(atkStr * 0.2) : 0,
    terrainEffect: `${terrainName} (${terrainMod}x defense)`,
    narrative,
  };
}

/**
 * Resolve a castle siege.
 * Attacker needs siege_engines or 3x the garrison strength.
 */
export function resolveSiege(
  attacker: Army,
  castle: Castle,
  turn: number,
  seed: number,
): BattleResult {
  const atkStr = armyStrength(attacker);
  const garrisonStr = castle.garrison * 2; // garrison fights at 2x in castle
  const wallBonus = castle.defense * 5;    // castle walls add flat defense
  const effectiveDefStr = garrisonStr + wallBonus;

  // Check for siege engines
  const siegeCount = attacker.units
    .filter(s => s.type === "siege_engines")
    .reduce((sum, s) => sum + s.count, 0);

  // Siege engines negate wall bonus proportionally
  const wallNegation = Math.min(1, siegeCount * 10 / wallBonus);
  const adjustedDefStr = garrisonStr + Math.round(wallBonus * (1 - wallNegation));

  // Without siege engines, need 3x strength to breach
  const canBreach = siegeCount > 0 || atkStr >= adjustedDefStr * 3;

  if (!canBreach) {
    // Siege continues — attrition damage to castle
    const siegeDmg = Math.round(atkStr * 0.05);
    castle.hp = Math.max(0, castle.hp - siegeDmg);
    castle.siegeTurns++;

    return {
      victor: "defender",
      attackerLosses: [{ type: "infantry", count: Math.round(armyUnitCount(attacker) * 0.02) }],
      defenderLosses: [],
      attackerMoraleChange: -3,
      defenderMoraleChange: -2,
      capturedCastle: false,
      routedArmy: null,
      heroBonus: 0,
      terrainEffect: `Castle walls (${castle.defense} defense)`,
      narrative: `The siege of ${castle.name} continues. Walls hold firm. (Turn ${castle.siegeTurns})`,
    };
  }

  // Assault — resolve as battle with reduced defender strength
  const ratio = atkStr / Math.max(adjustedDefStr, 1);
  const roll = wowHash(seed, turn, castle.garrison) * 0.4 + 0.8;
  const finalRatio = ratio * roll;

  let captured = false;
  let attackerLosses: UnitStack[];
  let defenderLosses: UnitStack[] = [];
  let attackerMoraleChange: number;
  let defenderMoraleChange: number;

  if (finalRatio > 1.5) {
    // Decisive victory — castle falls
    captured = true;
    const lossPct = 0.15 + wowHash(seed, turn, 7) * 0.15;
    attackerLosses = [];
    for (const stack of attacker.units) {
      const lost = Math.round(stack.count * lossPct);
      if (lost > 0) attackerLosses.push({ type: stack.type, count: lost });
      stack.count = Math.max(0, stack.count - lost);
    }
    attacker.units = attacker.units.filter(s => s.count > 0);
    castle.garrison = 0;
    castle.siegeTurns = 0;
    attackerMoraleChange = 20;
    defenderMoraleChange = -30;
  } else if (finalRatio > 1.0) {
    // Partial success — heavy damage, castle weakened
    const lossPct = 0.25;
    attackerLosses = [];
    for (const stack of attacker.units) {
      const lost = Math.round(stack.count * lossPct);
      if (lost > 0) attackerLosses.push({ type: stack.type, count: lost });
      stack.count = Math.max(0, stack.count - lost);
    }
    attacker.units = attacker.units.filter(s => s.count > 0);
    castle.garrison = Math.round(castle.garrison * 0.5);
    castle.hp = Math.round(castle.hp * 0.6);
    attackerMoraleChange = 5;
    defenderMoraleChange = -10;
  } else {
    // Repelled
    const lossPct = 0.35;
    attackerLosses = [];
    for (const stack of attacker.units) {
      const lost = Math.round(stack.count * lossPct);
      if (lost > 0) attackerLosses.push({ type: stack.type, count: lost });
      stack.count = Math.max(0, stack.count - lost);
    }
    attacker.units = attacker.units.filter(s => s.count > 0);
    castle.garrison = Math.round(castle.garrison * 0.85);
    attackerMoraleChange = -15;
    defenderMoraleChange = 10;
  }

  attacker.morale = clamp(attacker.morale + attackerMoraleChange, 0, 100);

  const action = captured ? "falls" : "holds";
  const narrative = `Assault on ${castle.name}! The ${castle.name} ${action}. ` +
    (captured ? "The banner changes hands." : "Defenders repel the assault.");

  return {
    victor: captured ? "attacker" : "defender",
    attackerLosses,
    defenderLosses,
    attackerMoraleChange,
    defenderMoraleChange,
    capturedCastle: captured,
    routedArmy: null,
    heroBonus: attacker.heroAttached ? Math.round(atkStr * 0.15) : 0,
    terrainEffect: `${castle.name} (Level ${castle.level}, ${castle.defense} defense)`,
    narrative,
  };
}

// ============================================================================
//  KINGDOM CREATION & MANAGEMENT
// ============================================================================

/**
 * Create a new player kingdom at the given starting hex.
 * Grants initial territory (7 hexes: center + neighbors), a starting Outpost,
 * a small army, and modest resources.
 */
export function createKingdom(name: string, ruler: string, startHex: Coord): Kingdom {
  const id = generateId();
  const neighbors = getNeighbors(startHex);
  const territory = [startHex, ...neighbors.slice(0, 6)];

  const startCastle: Castle = {
    id: generateId(),
    name: `${name} Outpost`,
    level: 1,
    hex: startHex,
    garrison: 20,
    maxGarrison: 50,
    defense: 5,
    production: { gold: 10, food: 5, iron: 0, wood: 0, mana: 0 },
    buildProgress: 0,
    siegeTurns: 0,
    hp: 100,
    maxHp: 100,
  };

  const startArmy: Army = {
    id: generateId(),
    name: `${name} Vanguard`,
    hex: startHex,
    units: [
      { type: "infantry", count: 30 },
      { type: "archers", count: 15 },
    ],
    morale: 70,
    supply: 6,
    maxSupply: 6,
    movesRemaining: 2,
    orders: null,
    heroAttached: true,
    status: "idle",
  };

  return {
    id,
    name,
    ruler,
    isPlayer: true,
    castles: [startCastle],
    armies: [startArmy],
    territory,
    treasury: { gold: 500, food: 300, iron: 100, wood: 150, mana: 20 },
    population: 500,
    morale: 60,
    diplomacy: {},
    treaties: [],
    turn: 0,
    seed: Math.floor(Math.random() * 0xffffffff),
    victoryPoints: 0,
    flags: {},
  };
}

/** Create AI kingdoms for the world */
export function getAIKingdoms(worldSeed: number): Kingdom[] {
  return AI_KINGDOMS.map((def, i) => {
    const neighbors = getNeighbors(def.startHex);
    // AI starts with more territory (10-14 hexes)
    const extraNeighbors = neighbors.flatMap(n => getNeighbors(n)).slice(0, 6);
    const territory = [def.startHex, ...neighbors, ...extraNeighbors];
    // Deduplicate
    const seen = new Set<string>();
    const uniqueTerritory = territory.filter(c => {
      const k = coordKey(c);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const castle: Castle = {
      id: `ai_castle_${def.id}`,
      name: def.name + " Seat",
      level: 3 as CastleLevel,  // AI starts stronger
      hex: def.startHex,
      garrison: 100,
      maxGarrison: 300,
      defense: 22,
      production: { gold: 50, food: 30, iron: 15, wood: 10, mana: 0 },
      buildProgress: 0,
      siegeTurns: 0,
      hp: 500,
      maxHp: 500,
    };

    const army: Army = {
      id: `ai_army_${def.id}`,
      name: `${def.rulerName}'s Host`,
      hex: def.startHex,
      units: [
        { type: "infantry", count: 80 },
        { type: "cavalry", count: 30 },
        { type: "archers", count: 40 },
      ],
      morale: 75,
      supply: 6,
      maxSupply: 6,
      movesRemaining: 2,
      orders: null,
      heroAttached: false,
      status: "idle",
    };

    // Set diplomacy — personality-based defaults
    const diplomacy: Record<string, DiplomacyStatus> = {};
    // All AI start neutral to player, varied toward each other
    const personalityHostility: Record<AIPersonality, number> = {
      aggressive: 0.4,
      defensive: 0.1,
      expansionist: 0.3,
      diplomatic: 0.05,
      merchant: 0.1,
    };
    for (const other of AI_KINGDOMS) {
      if (other.id === def.id) continue;
      const hostileChance = personalityHostility[def.personality];
      const roll = wowHash(i, AI_KINGDOMS.indexOf(other), worldSeed);
      diplomacy[other.id] = roll < hostileChance ? "war" : "neutral";
    }

    const kingdom: Kingdom = {
      id: def.id,
      name: def.name,
      ruler: def.rulerName,
      isPlayer: false,
      castles: [castle],
      armies: [army],
      territory: uniqueTerritory,
      treasury: { gold: 2000, food: 1000, iron: 500, wood: 400, mana: 100 },
      population: 2000,
      morale: 70,
      diplomacy,
      treaties: [],
      turn: 0,
      seed: worldSeed + i * 7919,
      victoryPoints: 0,
      flags: {},
    };

    return kingdom;
  });
}

// ============================================================================
//  BUILDING & RECRUITMENT
// ============================================================================

export type BuildError = { error: string };

/**
 * Build a new castle (Outpost) on a controlled hex.
 * Returns the updated kingdom or an error.
 */
export function buildCastle(
  kingdom: Kingdom,
  hex: Coord,
  name?: string,
): Kingdom | BuildError {
  // Validate hex is in territory
  if (!kingdom.territory.some(t => t.q === hex.q && t.r === hex.r)) {
    return { error: "Cannot build outside your territory." };
  }

  // Check no existing castle on this hex
  if (kingdom.castles.some(c => c.hex.q === hex.q && c.hex.r === hex.r)) {
    return { error: "A castle already exists on this hex." };
  }

  const levelDef = CASTLE_LEVELS[0]; // Outpost
  if (!canAfford(kingdom.treasury, levelDef.buildCost)) {
    return { error: `Cannot afford Outpost. Need: ${JSON.stringify(levelDef.buildCost)}` };
  }

  const castle: Castle = {
    id: generateId(),
    name: name ?? `${kingdom.name} Outpost`,
    level: 1,
    hex,
    garrison: 0,
    maxGarrison: levelDef.maxGarrison,
    defense: levelDef.defense,
    production: emptyTreasury(), // production unlocks when build finishes
    buildProgress: levelDef.buildTime,
    siegeTurns: 0,
    hp: levelDef.hp,
    maxHp: levelDef.hp,
  };

  return {
    ...kingdom,
    treasury: subtractTreasury(kingdom.treasury, levelDef.buildCost),
    castles: [...kingdom.castles, castle],
  };
}

/**
 * Upgrade an existing castle to the next level.
 */
export function upgradeCastle(
  kingdom: Kingdom,
  castleId: string,
): Kingdom | BuildError {
  const castleIdx = kingdom.castles.findIndex(c => c.id === castleId);
  if (castleIdx === -1) return { error: "Castle not found." };

  const castle = kingdom.castles[castleIdx];
  if (castle.level >= 5) return { error: "Castle is already at maximum level (Capital)." };
  if (castle.buildProgress > 0) return { error: "Castle is already under construction." };

  const nextLevel = CASTLE_LEVELS[castle.level]; // 0-indexed: level 1 = index 0, next = index at current level
  if (!canAfford(kingdom.treasury, nextLevel.buildCost)) {
    return { error: `Cannot afford upgrade to ${nextLevel.name}. Need: ${JSON.stringify(nextLevel.buildCost)}` };
  }

  const updatedCastles = [...kingdom.castles];
  updatedCastles[castleIdx] = {
    ...castle,
    buildProgress: nextLevel.buildTime,
  };

  return {
    ...kingdom,
    treasury: subtractTreasury(kingdom.treasury, nextLevel.buildCost),
    castles: updatedCastles,
  };
}

/**
 * Recruit an army at a castle.
 */
export type UnitMix = Partial<Record<UnitType, number>>;

export function recruitArmy(
  kingdom: Kingdom,
  castleId: string,
  composition: UnitMix,
  name?: string,
): Kingdom | BuildError {
  const castle = kingdom.castles.find(c => c.id === castleId);
  if (!castle) return { error: "Castle not found." };
  if (castle.buildProgress > 0) return { error: "Castle is still under construction." };

  // Validate unit requirements
  for (const [unitType, count] of Object.entries(composition)) {
    if (!count || count <= 0) continue;
    const def = UNIT_DEFS[unitType as UnitType];
    if (!def) return { error: `Unknown unit type: ${unitType}` };

    // Check castle level meets requirement
    const reqLevel = CASTLE_LEVELS.findIndex(l => l.name === def.requirement);
    if (reqLevel >= 0 && castle.level < CASTLE_LEVELS[reqLevel].level) {
      return { error: `${def.name} requires ${def.requirement} (level ${CASTLE_LEVELS[reqLevel].level}). Castle is level ${castle.level}.` };
    }
  }

  // Calculate total cost
  const totalCost: Treasury = emptyTreasury();
  const units: UnitStack[] = [];
  for (const [unitType, count] of Object.entries(composition)) {
    if (!count || count <= 0) continue;
    const def = UNIT_DEFS[unitType as UnitType];
    totalCost.gold += (def.recruitCost.gold ?? 0) * count;
    totalCost.food += (def.recruitCost.food ?? 0) * count;
    totalCost.iron += (def.recruitCost.iron ?? 0) * count;
    totalCost.wood += (def.recruitCost.wood ?? 0) * count;
    totalCost.mana += (def.recruitCost.mana ?? 0) * count;
    units.push({ type: unitType as UnitType, count });
  }

  if (!canAfford(kingdom.treasury, totalCost)) {
    return { error: `Cannot afford army recruitment. Need: ${JSON.stringify(totalCost)}` };
  }

  if (units.length === 0) {
    return { error: "Must recruit at least one unit." };
  }

  // Determine max supply based on composition
  const minSupply = Math.min(...units.map(u => UNIT_DEFS[u.type].supplyRange));

  const army: Army = {
    id: generateId(),
    name: name ?? `${kingdom.name} ${ordinalArmy(kingdom.armies.length + 1)}`,
    hex: castle.hex,
    units,
    morale: kingdom.morale, // inherits kingdom morale
    supply: minSupply,
    maxSupply: minSupply,
    movesRemaining: 0, // can't move on recruitment turn
    orders: null,
    heroAttached: false,
    status: "idle",
  };

  return {
    ...kingdom,
    treasury: subtractTreasury(kingdom.treasury, totalCost),
    armies: [...kingdom.armies, army],
  };
}

function ordinalArmy(n: number): string {
  const names = [
    "First", "Second", "Third", "Fourth", "Fifth",
    "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
  ];
  return (names[n - 1] ?? `${n}th`) + " Host";
}

// ============================================================================
//  ARMY MOVEMENT
// ============================================================================

/**
 * Issue move orders to an army. Validates path and speed.
 */
export function moveArmy(
  kingdom: Kingdom,
  armyId: string,
  destination: Coord,
  getTerrainAt: (c: Coord) => Terrain,
): Kingdom | BuildError {
  const armyIdx = kingdom.armies.findIndex(a => a.id === armyId);
  if (armyIdx === -1) return { error: "Army not found." };

  const army = kingdom.armies[armyIdx];
  if (army.status === "routing") return { error: "Routing army cannot receive orders." };
  if (army.status === "besieging") return { error: "Army is besieging. Lift siege first." };

  const speed = armySpeed(army);
  const dist = hexDist(army.hex, destination);

  if (dist === 0) return { error: "Army is already at destination." };

  // Find path (block nothing for now — enemy territory isn't physically blocked)
  const path = findPath(army.hex, destination, new Set());
  if (path.length === 0) return { error: "No valid path to destination." };

  // Calculate movement cost along path
  let moveCost = 0;
  for (let i = 1; i < path.length; i++) {
    const terrain = getTerrainAt(path[i]);
    moveCost += STRATEGIC_MOVEMENT_COST[terrain];
  }

  // Army moves as far as speed allows this turn
  // Remaining distance is queued for next turns
  const updatedArmies = [...kingdom.armies];
  updatedArmies[armyIdx] = {
    ...army,
    orders: { type: "move", path: path.slice(1) }, // exclude current position
    status: "marching",
  };

  return { ...kingdom, armies: updatedArmies };
}

// ============================================================================
//  DIPLOMACY
// ============================================================================

export function declareWar(kingdom: Kingdom, targetKingdomId: string): Kingdom {
  const updated = { ...kingdom };
  updated.diplomacy = { ...kingdom.diplomacy, [targetKingdomId]: "war" };
  // Breaking a treaty = morale penalty
  const brokenTreaty = kingdom.treaties.find(
    t => t.partnerKingdomId === targetKingdomId &&
      (t.type === "alliance" || t.type === "non_aggression")
  );
  if (brokenTreaty) {
    updated.morale = clamp(kingdom.morale - 15, 0, 100);
    updated.treaties = kingdom.treaties.filter(t => t.partnerKingdomId !== targetKingdomId);
  }
  return updated;
}

export function proposeAlliance(kingdom: Kingdom, targetKingdomId: string): Kingdom {
  const treaty: Treaty = {
    type: "alliance",
    partnerKingdomId: targetKingdomId,
    turnsRemaining: -1, // permanent until broken
  };
  return {
    ...kingdom,
    diplomacy: { ...kingdom.diplomacy, [targetKingdomId]: "allied" },
    treaties: [...kingdom.treaties, treaty],
  };
}

export function demandTribute(kingdom: Kingdom, targetKingdomId: string): Kingdom {
  return {
    ...kingdom,
    diplomacy: { ...kingdom.diplomacy, [targetKingdomId]: "tribute" },
  };
}

// ============================================================================
//  TURN PROCESSING
// ============================================================================

/**
 * Process a full turn for a kingdom.
 * This is the core game loop — called once per turn.
 *
 * Steps:
 * 1. Resource production from territory + castles
 * 2. Upkeep deduction (armies, castles)
 * 3. Population growth/decline based on food + morale
 * 4. Army movement execution
 * 5. Supply line checks + attrition
 * 6. Combat resolution (when armies collide)
 * 7. Castle build progress
 * 8. Random events (~20% chance)
 * 9. Victory condition check
 */
export function processTurn(
  kingdom: Kingdom,
  allKingdoms: Kingdom[],
  getTerrainAt: (c: Coord) => Terrain,
): TurnReport {
  const events: TurnEvent[] = [];
  let k = { ...kingdom, turn: kingdom.turn + 1 };

  // ── 1. Resource Production ────────────────────────────────────────────────
  const production = emptyTreasury();

  // Territory production
  for (const hex of k.territory) {
    const terrain = getTerrainAt(hex);
    const terrainProd = TERRAIN_PRODUCTION[terrain];
    production.gold += terrainProd.gold ?? 0;
    production.food += terrainProd.food ?? 0;
    production.iron += terrainProd.iron ?? 0;
    production.wood += terrainProd.wood ?? 0;
    production.mana += terrainProd.mana ?? 0;
  }

  // Castle production
  for (const castle of k.castles) {
    if (castle.buildProgress <= 0) {
      production.gold += castle.production.gold;
      production.food += castle.production.food;
      production.iron += castle.production.iron;
      production.wood += castle.production.wood;
      production.mana += castle.production.mana;
    }
  }

  k.treasury = addTreasury(k.treasury, production);
  events.push({ type: "production", resources: production });

  // ── 2. Upkeep ─────────────────────────────────────────────────────────────
  const totalUpkeep = emptyTreasury();

  for (const army of k.armies) {
    const upkeep = armyUpkeep(army);
    totalUpkeep.gold += upkeep.gold ?? 0;
    totalUpkeep.food += upkeep.food ?? 0;
    totalUpkeep.iron += upkeep.iron ?? 0;
    totalUpkeep.wood += upkeep.wood ?? 0;
    totalUpkeep.mana += upkeep.mana ?? 0;
  }

  // Castle maintenance (1 gold per castle level per turn)
  for (const castle of k.castles) {
    totalUpkeep.gold += castle.level * 2;
  }

  const deficit = !canAfford(k.treasury, totalUpkeep);
  k.treasury = subtractTreasury(k.treasury, totalUpkeep);

  // Floor at 0 — deficit causes morale/attrition instead
  for (const res of Object.keys(k.treasury) as KingdomResource[]) {
    if (k.treasury[res] < 0) k.treasury[res] = 0;
  }

  if (deficit) {
    k.morale = clamp(k.morale - 5, 0, 100);
    // Starving armies lose troops
    for (const army of k.armies) {
      const attrition = Math.round(armyUnitCount(army) * 0.05);
      if (attrition > 0 && army.units.length > 0) {
        army.units[0].count = Math.max(0, army.units[0].count - attrition);
        army.units = army.units.filter(s => s.count > 0);
        events.push({ type: "supply_loss", armyId: army.id, attrition });
      }
    }
  }

  events.push({ type: "upkeep", cost: totalUpkeep, deficit });

  // ── 3. Population ─────────────────────────────────────────────────────────
  const foodSurplus = k.treasury.food > 0;
  const growthRate = foodSurplus ? 0.02 : -0.03;
  const moraleMod = (k.morale - 50) / 500; // +/- 10% based on morale
  const popDelta = Math.round(k.population * (growthRate + moraleMod));
  k.population = Math.max(50, k.population + popDelta);

  if (popDelta !== 0) {
    const reason = popDelta > 0 ? "Growth (food surplus + morale)" : "Decline (starvation/low morale)";
    events.push({ type: "population_change", delta: popDelta, reason });
  }

  // ── 4. Army Movement ──────────────────────────────────────────────────────
  for (const army of k.armies) {
    if (army.orders?.type === "move" && army.orders.path.length > 0) {
      const speed = armySpeed(army);
      let moveBudget = speed;
      const path = army.orders.path;
      let moved = 0;

      while (moveBudget > 0 && moved < path.length) {
        const nextHex = path[moved];
        const terrain = getTerrainAt(nextHex);
        const cost = STRATEGIC_MOVEMENT_COST[terrain];
        if (cost > moveBudget) break;
        moveBudget -= cost;
        army.hex = nextHex;
        moved++;
      }

      // Update remaining path
      army.orders = moved >= path.length
        ? null
        : { type: "move", path: path.slice(moved) };

      if (!army.orders) {
        army.status = "idle";
      }
    }

    // Reset moves for next turn
    army.movesRemaining = armySpeed(army);
  }

  // ── 5. Supply Lines ───────────────────────────────────────────────────────
  for (const army of k.armies) {
    if (hasSupplyLine(army, k)) {
      army.supply = army.maxSupply; // resupplied
    } else {
      army.supply--;
      if (army.supply <= 0) {
        // Starvation attrition
        const attrition = Math.round(armyUnitCount(army) * 0.1);
        if (army.units.length > 0) {
          army.units[0].count = Math.max(0, army.units[0].count - attrition);
          army.units = army.units.filter(s => s.count > 0);
        }
        army.morale = clamp(army.morale - 10, 0, 100);
        events.push({ type: "supply_loss", armyId: army.id, attrition });
      }
    }
  }

  // ── 6. Combat Resolution ──────────────────────────────────────────────────
  // Check for armies occupying same hex as enemy armies/castles
  for (const army of k.armies) {
    for (const otherKingdom of allKingdoms) {
      if (otherKingdom.id === k.id) continue;
      if (k.diplomacy[otherKingdom.id] !== "war") continue;

      // Check enemy armies on same hex
      for (const enemyArmy of otherKingdom.armies) {
        if (enemyArmy.hex.q === army.hex.q && enemyArmy.hex.r === army.hex.r) {
          const terrain = getTerrainAt(army.hex);
          // Count flanking allies
          const flankers = k.armies.filter(a =>
            a.id !== army.id &&
            hexDist(a.hex, enemyArmy.hex) === 1
          ).length;

          const result = resolveBattle(army, enemyArmy, terrain, flankers, k.seed + k.turn);
          events.push({ type: "battle", result, location: army.hex });
        }
      }

      // Check enemy castles on army hex
      for (const enemyCastle of otherKingdom.castles) {
        if (enemyCastle.hex.q === army.hex.q && enemyCastle.hex.r === army.hex.r) {
          const result = resolveSiege(army, enemyCastle, k.turn, k.seed);
          events.push({ type: "battle", result, location: army.hex });

          // If captured, transfer castle
          if (result.capturedCastle) {
            const capturedIdx = otherKingdom.castles.indexOf(enemyCastle);
            if (capturedIdx >= 0) {
              otherKingdom.castles.splice(capturedIdx, 1);
              enemyCastle.garrison = Math.round(armyUnitCount(army) * 0.1);
              k.castles = [...k.castles, enemyCastle];
              // Claim surrounding territory
              const newTerritory = [enemyCastle.hex, ...getNeighbors(enemyCastle.hex)];
              const existing = new Set(k.territory.map(coordKey));
              for (const nt of newTerritory) {
                if (!existing.has(coordKey(nt))) {
                  k.territory = [...k.territory, nt];
                }
              }
            }
          }
        }
      }
    }
  }

  // Remove destroyed armies (no units left)
  k.armies = k.armies.filter(a => a.units.length > 0);

  // ── 7. Castle Build Progress ──────────────────────────────────────────────
  for (const castle of k.castles) {
    if (castle.buildProgress > 0) {
      castle.buildProgress--;
      if (castle.buildProgress === 0) {
        // Complete the build/upgrade
        if (castle.level < 5) {
          castle.level = (castle.level + 1) as CastleLevel;
        }
        const def = CASTLE_LEVELS[castle.level - 1];
        castle.maxGarrison = def.maxGarrison;
        castle.defense = def.defense;
        castle.maxHp = def.hp;
        castle.hp = def.hp;
        castle.production = {
          gold: def.productionBonus.gold ?? 0,
          food: def.productionBonus.food ?? 0,
          iron: def.productionBonus.iron ?? 0,
          wood: def.productionBonus.wood ?? 0,
          mana: def.productionBonus.mana ?? 0,
        };
        castle.name = castle.name.replace(
          /Outpost|Keep|Fortress|Citadel/,
          CASTLE_NAMES[castle.level]
        );
        events.push({ type: "castle_complete", castle });
      }
    }
  }

  // ── 8. Random Events ──────────────────────────────────────────────────────
  const eventRoll = wowRoll(k.seed, k.turn, 0);
  if (eventRoll < 0.20) { // 20% chance per turn
    const eventIdx = Math.floor(wowRoll(k.seed, k.turn, 1) * RANDOM_EVENTS.length);
    const event = RANDOM_EVENTS[eventIdx];

    // Auto-apply non-response events
    if (!event.requiresResponse) {
      k.treasury = addTreasury(k.treasury, event.effects);
      k.morale = clamp(k.morale + event.moraleEffect, 0, 100);
      k.population = Math.max(50, k.population + event.populationEffect);
    }

    events.push({ type: "random_event", event });
  }

  // ── 9. Morale Natural Drift ───────────────────────────────────────────────
  // Morale drifts toward 50 by 1 per turn, plus bonuses for prosperity
  const moraleDrift = k.morale > 50 ? -1 : k.morale < 50 ? 1 : 0;
  const prosperityBonus = k.treasury.gold > 1000 && k.treasury.food > 500 ? 2 : 0;
  const moraleChange = moraleDrift + prosperityBonus;
  if (moraleChange !== 0) {
    k.morale = clamp(k.morale + moraleChange, 0, 100);
    events.push({ type: "morale_change", delta: moraleChange, reason: "Natural drift + prosperity" });
  }

  // ── 10. Victory Check ─────────────────────────────────────────────────────
  const victory = checkVictory(k, allKingdoms);
  events.push({ type: "victory_check", condition: victory });

  return {
    turn: k.turn,
    events,
    kingdomSnapshot: k,
  };
}

// ============================================================================
//  AI TURN PROCESSING
// ============================================================================

/**
 * Process AI kingdom turns. Simple personality-driven decisions.
 */
export function processAITurn(
  aiKingdom: Kingdom,
  allKingdoms: Kingdom[],
  getTerrainAt: (c: Coord) => Terrain,
): Kingdom {
  const k = { ...aiKingdom, turn: aiKingdom.turn + 1 };
  const personality = AI_KINGDOMS.find(d => d.id === k.id)?.personality ?? "neutral";

  // Production (simplified)
  const production = emptyTreasury();
  for (const hex of k.territory) {
    const terrain = getTerrainAt(hex);
    const tp = TERRAIN_PRODUCTION[terrain];
    production.gold += tp.gold ?? 0;
    production.food += tp.food ?? 0;
    production.iron += tp.iron ?? 0;
    production.wood += tp.wood ?? 0;
    production.mana += tp.mana ?? 0;
  }
  for (const castle of k.castles) {
    if (castle.buildProgress <= 0) {
      production.gold += castle.production.gold;
      production.food += castle.production.food;
    }
  }
  k.treasury = addTreasury(k.treasury, production);

  // Upkeep
  const upkeep = emptyTreasury();
  for (const army of k.armies) {
    const au = armyUpkeep(army);
    upkeep.gold += au.gold ?? 0;
    upkeep.food += au.food ?? 0;
  }
  k.treasury = subtractTreasury(k.treasury, upkeep);
  for (const res of Object.keys(k.treasury) as KingdomResource[]) {
    if (k.treasury[res] < 0) k.treasury[res] = 0;
  }

  // AI Behavior by personality
  const roll = wowRoll(k.seed, k.turn, 10);

  switch (personality) {
    case "aggressive":
      // Recruit more troops when affordable
      if (k.treasury.gold > 500 && roll < 0.4) {
        for (const army of k.armies) {
          army.units.push({ type: "infantry", count: 10 });
        }
        k.treasury.gold -= 100;
      }
      break;

    case "expansionist":
      // Expand territory (claim adjacent unclaimed hexes)
      if (roll < 0.3) {
        const border = k.territory.flatMap(t => getNeighbors(t));
        const owned = new Set(k.territory.map(coordKey));
        const allOwned = new Set(
          allKingdoms.flatMap(ak => ak.territory.map(coordKey))
        );
        const claimable = border.filter(b => {
          const bk = coordKey(b);
          return !owned.has(bk) && !allOwned.has(bk);
        });
        if (claimable.length > 0) {
          const pick = claimable[Math.floor(roll * claimable.length)];
          k.territory = [...k.territory, pick];
        }
      }
      break;

    case "defensive":
      // Garrison up
      if (k.treasury.gold > 300 && roll < 0.3) {
        for (const castle of k.castles) {
          castle.garrison = Math.min(castle.maxGarrison, castle.garrison + 20);
        }
        k.treasury.gold -= 60;
      }
      break;

    case "merchant":
      // Generate extra gold from trade
      k.treasury.gold += Math.round(k.territory.length * 2);
      break;

    case "diplomatic":
      // Attempt to ally with neutrals
      if (roll < 0.2) {
        for (const other of allKingdoms) {
          if (other.id === k.id) continue;
          if (k.diplomacy[other.id] === "neutral") {
            k.diplomacy[other.id] = "allied";
            break;
          }
        }
      }
      break;
  }

  // Population growth
  k.population = Math.round(k.population * 1.01);

  return k;
}

// ============================================================================
//  VICTORY CONDITIONS
// ============================================================================

/**
 * Check if a kingdom has met any victory condition.
 */
export function checkVictory(
  kingdom: Kingdom,
  allKingdoms: Kingdom[],
): VictoryCondition | null {
  // Total hexes in the world (estimate from all kingdoms)
  const totalHexes = allKingdoms.reduce((sum, k) => sum + k.territory.length, 0);

  // Domination: control 60% of all territory
  const percentControlled = kingdom.territory.length / Math.max(totalHexes, 1);
  if (percentControlled >= 0.6) {
    return { type: "domination", percentControlled: Math.round(percentControlled * 100) };
  }

  // Economic: accumulate 100,000 gold
  if (kingdom.treasury.gold >= 100000) {
    return { type: "economic", goldAccumulated: kingdom.treasury.gold };
  }

  // Military: all rival capitals destroyed
  const rivalCapitals = allKingdoms
    .filter(k => k.id !== kingdom.id && k.isPlayer === false)
    .filter(k => k.castles.some(c => c.level >= 5));
  if (rivalCapitals.length === 0 && kingdom.turn > 10) {
    const destroyed = allKingdoms
      .filter(k => k.id !== kingdom.id)
      .filter(k => k.castles.length === 0).length;
    if (destroyed >= AI_KINGDOMS.length) {
      return { type: "military", capitalsDestroyed: destroyed };
    }
  }

  // Cultural: maintain 90+ morale for 20 consecutive turns
  // (tracked via flags)
  const highMoraleTurns = kingdom.morale >= 90
    ? ((kingdom.morale_streak ?? 0) + 1)
    : 0;
  kingdom.morale_streak = highMoraleTurns;
  if (highMoraleTurns >= 20) {
    return { type: "cultural", moraleTurns: highMoraleTurns };
  }

  return null;
}

// ============================================================================
//  TERRITORY EXPANSION
// ============================================================================

/**
 * Claim an unclaimed adjacent hex. Costs gold proportional to terrain.
 */
export function claimHex(
  kingdom: Kingdom,
  hex: Coord,
  allKingdoms: Kingdom[],
  getTerrainAt: (c: Coord) => Terrain,
): Kingdom | BuildError {
  // Must be adjacent to existing territory
  const territorySet = new Set(kingdom.territory.map(coordKey));
  const hexKey = coordKey(hex);

  if (territorySet.has(hexKey)) {
    return { error: "Already own this hex." };
  }

  const neighbors = getNeighbors(hex);
  const isAdjacent = neighbors.some(n => territorySet.has(coordKey(n)));
  if (!isAdjacent) {
    return { error: "Hex must be adjacent to existing territory." };
  }

  // Check not owned by another kingdom
  for (const other of allKingdoms) {
    if (other.id === kingdom.id) continue;
    if (other.territory.some(t => t.q === hex.q && t.r === hex.r)) {
      return { error: "This hex belongs to another kingdom. Conquer it first." };
    }
  }

  // Cost: 20 gold + terrain difficulty modifier
  const terrain = getTerrainAt(hex);
  const terrainCostMod = STRATEGIC_MOVEMENT_COST[terrain];
  const claimCost = { gold: 20 * terrainCostMod };

  if (!canAfford(kingdom.treasury, claimCost)) {
    return { error: `Cannot afford to claim hex. Cost: ${claimCost.gold} gold.` };
  }

  return {
    ...kingdom,
    treasury: subtractTreasury(kingdom.treasury, claimCost),
    territory: [...kingdom.territory, hex],
  };
}

// ============================================================================
//  APPLY EVENT OPTIONS
// ============================================================================

/**
 * Apply a chosen option from a random event.
 */
export function applyEventOption(
  kingdom: Kingdom,
  event: RandomEvent,
  optionIndex: number,
): Kingdom | BuildError {
  if (!event.options || optionIndex >= event.options.length) {
    return { error: "Invalid event option." };
  }

  const option = event.options[optionIndex];

  // Check cost
  if (option.cost && !canAfford(kingdom.treasury, option.cost)) {
    return { error: `Cannot afford this option. Cost: ${JSON.stringify(option.cost)}` };
  }

  let k = { ...kingdom };
  if (option.cost) {
    k.treasury = subtractTreasury(k.treasury, option.cost);
  }
  k.treasury = addTreasury(k.treasury, option.effects);
  k.morale = clamp(k.morale + option.moraleEffect, 0, 100);
  k.population = Math.max(50, k.population + option.populationEffect);

  // Special handling for mercenary hire
  if (event.type === "mercenaries_available" && optionIndex === 0) {
    const mercs: Army = {
      id: generateId(),
      name: "Hired Swords",
      hex: k.castles[0]?.hex ?? k.territory[0],
      units: [{ type: "infantry", count: 50 }],
      morale: 60,
      supply: 4,
      maxSupply: 4,
      movesRemaining: 2,
      orders: null,
      heroAttached: false,
      status: "idle",
    };
    k.armies = [...k.armies, mercs];
  }

  return k;
}

// ============================================================================
//  SAVE/LOAD (wallet-keyed)
// ============================================================================

export type WoWGameState = {
  playerKingdom: Kingdom;
  aiKingdoms: Kingdom[];
  worldSeed: number;
  totalTurns: number;
  pendingEvents: RandomEvent[];
};

/** Create a fresh game state for a new player */
export function newGame(
  kingdomName: string,
  ruler: string,
  startHex: Coord,
  worldSeed?: number,
): WoWGameState {
  const seed = worldSeed ?? Math.floor(Math.random() * 0xffffffff);
  const player = createKingdom(kingdomName, ruler, startHex);
  const ai = getAIKingdoms(seed);

  // Set initial diplomacy — player starts neutral with all AI
  for (const aiK of ai) {
    player.diplomacy[aiK.id] = "neutral";
    aiK.diplomacy[player.id] = "neutral";
  }

  return {
    playerKingdom: player,
    aiKingdoms: ai,
    worldSeed: seed,
    totalTurns: 0,
    pendingEvents: [],
  };
}

/**
 * Advance the game by one turn. Processes player + all AI kingdoms.
 */
export function advanceTurn(
  state: WoWGameState,
  getTerrainAt: (c: Coord) => Terrain,
): { state: WoWGameState; report: TurnReport } {
  const allKingdoms = [state.playerKingdom, ...state.aiKingdoms];

  // Process player turn
  const report = processTurn(state.playerKingdom, allKingdoms, getTerrainAt);

  // Process AI turns
  const updatedAI = state.aiKingdoms.map(ai =>
    processAITurn(ai, allKingdoms, getTerrainAt)
  );

  // Extract pending events that need player response
  const pendingEvents = report.events
    .filter((e): e is { type: "random_event"; event: RandomEvent } => e.type === "random_event")
    .map(e => e.event)
    .filter(e => e.requiresResponse);

  return {
    state: {
      playerKingdom: report.kingdomSnapshot,
      aiKingdoms: updatedAI,
      worldSeed: state.worldSeed,
      totalTurns: state.totalTurns + 1,
      pendingEvents,
    },
    report,
  };
}

// ============================================================================
//  PUBLIC API SUMMARY
// ============================================================================
//
//  createKingdom(name, ruler, startHex) → Kingdom
//  getAIKingdoms(worldSeed) → Kingdom[]
//  buildCastle(kingdom, hex, name?) → Kingdom | BuildError
//  upgradeCastle(kingdom, castleId) → Kingdom | BuildError
//  recruitArmy(kingdom, castleId, composition, name?) → Kingdom | BuildError
//  moveArmy(kingdom, armyId, destination, getTerrainAt) → Kingdom | BuildError
//  resolveBattle(attacker, defender, terrain, flanking, seed) → BattleResult
//  resolveSiege(attacker, castle, turn, seed) → BattleResult
//  claimHex(kingdom, hex, allKingdoms, getTerrainAt) → Kingdom | BuildError
//  declareWar(kingdom, targetId) → Kingdom
//  proposeAlliance(kingdom, targetId) → Kingdom
//  demandTribute(kingdom, targetId) → Kingdom
//  applyEventOption(kingdom, event, optionIndex) → Kingdom | BuildError
//  processTurn(kingdom, allKingdoms, getTerrainAt) → TurnReport
//  processAITurn(aiKingdom, allKingdoms, getTerrainAt) → Kingdom
//  checkVictory(kingdom, allKingdoms) → VictoryCondition | null
//  newGame(name, ruler, startHex, worldSeed?) → WoWGameState
//  advanceTurn(state, getTerrainAt) → { state, report }
//
//  Utilities:
//  armyStrength(army) → number
//  armySpeed(army) → number
//  armyUpkeep(army) → Partial<Treasury>
//  armyUnitCount(army) → number
//  hasSupplyLine(army, kingdom) → boolean
// ============================================================================
