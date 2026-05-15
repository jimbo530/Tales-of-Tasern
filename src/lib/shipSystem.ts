// ============================================================
// shipSystem.ts — Naval Combat, Trade, Crew & Fleet System
//
// Builds on ships.ts (ship data/templates) and hexWorld.ts (world).
// Handles: naval combat, boarding, trade routes, port services,
// crew management, and WoW fleet integration.
//
// 1 hex = 6 miles on world map. Ship speed from ships.ts determines
// travel time. Wind direction affects sail-powered vessels.
// ============================================================

import type { Coord, Terrain } from "./hexWorld";
import type { Ship, OwnedShip, WindCondition } from "./ships";
import { getShip, effectiveShipSpeed, hoursPerWaterHex, ALL_SHIPS } from "./ships";

// ============================================================================
//  TYPES — Ship Weapons
// ============================================================================

export type ShipWeaponType = "ballista" | "catapult" | "greek_fire" | "cannon" | "ram";

export type ShipWeapon = {
  id: string;
  type: ShipWeaponType;
  name: string;
  damage: string;          // dice expression, e.g. "1d10"
  range: number;           // hexes (0 = melee/ramming)
  reloadTurns: number;     // turns between shots (0 = every turn)
  costGp: number;
  special: string[];       // "fire", "slow_reload", "requires_speed_3"
  currentReload: number;   // turns until ready (0 = ready)
};

export const SHIP_WEAPON_DEFS: Record<ShipWeaponType, Omit<ShipWeapon, "id" | "currentReload">> = {
  ballista: {
    type: "ballista",
    name: "Ballista",
    damage: "1d10",
    range: 3,
    reloadTurns: 0,
    costGp: 500,
    special: [],
  },
  catapult: {
    type: "catapult",
    name: "Catapult",
    damage: "3d6",
    range: 5,
    reloadTurns: 2,
    costGp: 1500,
    special: ["slow_reload"],
  },
  greek_fire: {
    type: "greek_fire",
    name: "Greek Fire Siphon",
    damage: "2d8",
    range: 1,
    reloadTurns: 1,
    costGp: 3000,
    special: ["fire", "burn"],
  },
  cannon: {
    type: "cannon",
    name: "Cannon",
    damage: "4d8",
    range: 4,
    reloadTurns: 1,
    costGp: 5000,
    special: [],
  },
  ram: {
    type: "ram",
    name: "Ram",
    damage: "0",  // calculated from speed
    range: 0,
    reloadTurns: 0,
    costGp: 0,
    special: ["requires_speed_3", "built_in"],
  },
};

// ============================================================================
//  TYPES — Ship Upgrades
// ============================================================================

export type ShipUpgradeType =
  | "reinforced_hull"
  | "extended_cargo"
  | "crows_nest"
  | "enchanted_sails"
  | "hidden_compartment"
  | "boarding_nets"
  | "healers_quarters"
  | "navigators_tools";

export type ShipUpgrade = {
  id: string;
  type: ShipUpgradeType;
  name: string;
  costGp: number;
  description: string;
  effect: {
    hpBonus?: number;
    armorBonus?: number;
    cargoMultiplier?: number;
    visibilityBonus?: number;
    speedBonus?: number;
    openWaterSpeedBonus?: number;
    smuggling?: boolean;
    boardingDefense?: number;
    crewRegen?: number;
  };
};

export const SHIP_UPGRADES: Record<ShipUpgradeType, Omit<ShipUpgrade, "id">> = {
  reinforced_hull: {
    type: "reinforced_hull",
    name: "Reinforced Hull",
    costGp: 2000,
    description: "Iron-banded hull planks. +20 HP, +2 damage reduction.",
    effect: { hpBonus: 20, armorBonus: 2 },
  },
  extended_cargo: {
    type: "extended_cargo",
    name: "Extended Cargo Hold",
    costGp: 1500,
    description: "Reconfigured hold. +50% cargo capacity.",
    effect: { cargoMultiplier: 1.5 },
  },
  crows_nest: {
    type: "crows_nest",
    name: "Crow's Nest",
    costGp: 800,
    description: "Elevated lookout platform. +2 hex visibility.",
    effect: { visibilityBonus: 2 },
  },
  enchanted_sails: {
    type: "enchanted_sails",
    name: "Enchanted Sails",
    costGp: 5000,
    description: "Magically-woven sails catch even the faintest breeze. +1 speed.",
    effect: { speedBonus: 1 },
  },
  hidden_compartment: {
    type: "hidden_compartment",
    name: "Hidden Compartment",
    costGp: 1200,
    description: "Secret space for contraband. Passes port inspections.",
    effect: { smuggling: true },
  },
  boarding_nets: {
    type: "boarding_nets",
    name: "Boarding Nets",
    costGp: 600,
    description: "Rigged netting deters boarders. +3 defense vs boarding.",
    effect: { boardingDefense: 3 },
  },
  healers_quarters: {
    type: "healers_quarters",
    name: "Healer's Quarters",
    costGp: 2500,
    description: "Dedicated sickbay with herbs and cots. Crew heal 1 HP/turn.",
    effect: { crewRegen: 1 },
  },
  navigators_tools: {
    type: "navigators_tools",
    name: "Navigator's Tools",
    costGp: 1800,
    description: "Astrolabe, charts, and lodestones. +1 speed in open water.",
    effect: { openWaterSpeedBonus: 1 },
  },
};

// ============================================================================
//  TYPES — Combat Ship (runtime state for naval battles)
// ============================================================================

export type CombatShip = {
  id: string;
  name: string;
  shipId: string;         // references Ship.id template
  hp: number;
  maxHp: number;
  crew: number;
  maxCrew: number;
  cargo: number;          // current cargo weight (lbs)
  maxCargo: number;
  speed: number;          // hexes per turn (effective)
  armor: number;          // damage reduction per hit
  weapons: ShipWeapon[];
  upgrades: ShipUpgrade[];
  condition: number;      // 0-100, affects speed/combat
  location: Coord;
  heading: number;        // 0-5 (hex direction)
  isPlayer: boolean;
  onFire: boolean;
  fireDamage: number;     // HP lost per turn from fire
  sinking: boolean;
  sinkTurns: number;      // turns until gone (3 when sinking starts)
  morale: number;         // crew morale 0-100
  hasMoved: boolean;
  hasActed: boolean;
};

// ============================================================================
//  TYPES — Trade Goods & Economy
// ============================================================================

export type TradeGoodType =
  | "food" | "ore" | "lumber" | "silk" | "spices"
  | "weapons" | "magic_items" | "ale" | "salt" | "gems";

export type TradeGood = {
  type: TradeGoodType;
  name: string;
  basePrice: number;      // gp per unit
  weightLbs: number;      // per unit
  perishable: boolean;
  illegal: boolean;
};

export const TRADE_GOODS: Record<TradeGoodType, TradeGood> = {
  food:        { type: "food",        name: "Foodstuffs",    basePrice: 1,   weightLbs: 20, perishable: true,  illegal: false },
  ore:         { type: "ore",         name: "Iron Ore",      basePrice: 5,   weightLbs: 50, perishable: false, illegal: false },
  lumber:      { type: "lumber",      name: "Timber",        basePrice: 3,   weightLbs: 80, perishable: false, illegal: false },
  silk:        { type: "silk",        name: "Silk Bolts",    basePrice: 20,  weightLbs: 5,  perishable: false, illegal: false },
  spices:      { type: "spices",      name: "Spices",        basePrice: 30,  weightLbs: 2,  perishable: false, illegal: false },
  weapons:     { type: "weapons",     name: "Weapons",       basePrice: 15,  weightLbs: 30, perishable: false, illegal: false },
  magic_items: { type: "magic_items", name: "Magic Items",   basePrice: 100, weightLbs: 5,  perishable: false, illegal: false },
  ale:         { type: "ale",         name: "Ale & Spirits", basePrice: 2,   weightLbs: 40, perishable: true,  illegal: false },
  salt:        { type: "salt",        name: "Salt",          basePrice: 8,   weightLbs: 30, perishable: false, illegal: false },
  gems:        { type: "gems",        name: "Gemstones",     basePrice: 50,  weightLbs: 1,  perishable: false, illegal: false },
};

export type CargoManifest = {
  good: TradeGoodType;
  quantity: number;
  purchasePrice: number;  // what we paid per unit
};

// ============================================================================
//  TYPES — Ports
// ============================================================================

export type PortSize = "small" | "medium" | "large";

export type PortAlignment = "friendly" | "neutral" | "hostile" | "pirate";

export type Port = {
  id: string;
  name: string;
  hex: Coord;
  size: PortSize;
  alignment: PortAlignment;
  terrain: Terrain;
  // Trade: which goods this port buys/sells and price modifiers
  exports: TradeGoodType[];     // sells these (cheaper here)
  imports: TradeGoodType[];     // buys these (pays more)
  priceModifier: number;        // 0.5 = half price exports, 1.5 = 50% markup imports
  // Services
  hasShipyard: boolean;
  hasMarket: boolean;
  hasTavern: boolean;
  portFeeGp: number;            // fee to dock per day, by ship size
  // Supply/demand fluctuation seed
  demandSeed: number;
};

export type PortService =
  | "repair"
  | "upgrade"
  | "recruit_crew"
  | "buy_cargo"
  | "sell_cargo"
  | "rest"
  | "buy_ship"
  | "sell_ship"
  | "resupply";

// ============================================================================
//  TYPES — Crew
// ============================================================================

export type CrewSpecialization = "sailor" | "navigator" | "surgeon" | "gunner" | "marine" | "cook";

export type CrewMember = {
  id: string;
  name: string;
  specialization: CrewSpecialization;
  skill: number;          // 1-5
  morale: number;         // 0-100
  hireGp: number;         // one-time hire cost
  wageGp: number;         // per turn
};

export const CREW_WAGES: Record<CrewSpecialization, { hireGp: number; wageGp: number }> = {
  sailor:     { hireGp: 5,  wageGp: 1 },
  navigator:  { hireGp: 50, wageGp: 5 },
  surgeon:    { hireGp: 40, wageGp: 4 },
  gunner:     { hireGp: 30, wageGp: 3 },
  marine:     { hireGp: 20, wageGp: 2 },
  cook:       { hireGp: 10, wageGp: 1 },
};

// ============================================================================
//  TYPES — Naval Combat Results
// ============================================================================

export type NavalCombatLog = {
  round: number;
  text: string;
  type: "fire" | "hit" | "miss" | "ram" | "board" | "sink" | "info";
};

export type MoveResult = {
  success: boolean;
  hexesMoved: number;
  newLocation: Coord;
  hoursElapsed: number;
  encounters: NavalEncounter[];
  conditionLoss: number;     // wear from travel
  message: string;
};

export type NavalBattleResult = {
  victor: "attacker" | "defender" | "draw";
  attackerShipsLost: string[];     // ship IDs sunk
  defenderShipsLost: string[];
  attackerDamage: Record<string, number>;  // shipId -> HP lost
  defenderDamage: Record<string, number>;
  captured: string[];              // ship IDs captured
  loot: CargoManifest[];
  log: NavalCombatLog[];
  rounds: number;
};

export type BoardingResult = {
  success: boolean;
  attackerCasualties: number;
  defenderCasualties: number;
  shipCaptured: boolean;
  loot: CargoManifest[];
  log: string[];
};

export type TradeResult = {
  bought: { good: TradeGoodType; quantity: number; totalCost: number }[];
  sold: { good: TradeGoodType; quantity: number; totalRevenue: number }[];
  netGold: number;
  cargoRemaining: number;
  message: string;
};

export type NavalEncounter = {
  type: "pirate" | "merchant" | "patrol" | "storm" | "monster" | "debris";
  description: string;
  dangerLevel: number;
  ships?: CombatShip[];    // enemy ships if hostile
};

export type TradeRoute = {
  from: Coord;
  to: Coord;
  distance: number;        // hexes
  goods: TradeGoodType[];
  estimatedProfit: number; // gp per trip
  dangerLevel: number;
  piracyRisk: number;      // 0-1
};

// ============================================================================
//  TYPES — Fleet (WoW Integration)
// ============================================================================

export type Fleet = {
  id: string;
  name: string;
  ships: CombatShip[];
  flagship: string;        // ship ID of the fleet leader
  hex: Coord;
  formation: "line" | "wedge" | "scatter" | "blockade";
  orders: FleetOrder | null;
  kingdomId: string;
  admiralName: string;
};

export type FleetOrder =
  | { type: "move"; destination: Coord }
  | { type: "patrol"; waypoints: Coord[] }
  | { type: "blockade"; targetPort: Coord }
  | { type: "transport"; army: string; destination: Coord }
  | { type: "engage"; targetFleet: string }
  | { type: "escort"; merchantShip: string; route: Coord[] };

// ============================================================================
//  WIND SYSTEM
// ============================================================================

/** Wind direction (0-5 mapping to hex directions) */
export type WindDirection = 0 | 1 | 2 | 3 | 4 | 5;

export type WindState = {
  direction: WindDirection;
  condition: WindCondition;
};

/** Speed modifier based on heading relative to wind */
export function windSpeedModifier(shipHeading: number, windDir: WindDirection): number {
  const diff = Math.abs(shipHeading - windDir);
  const angle = Math.min(diff, 6 - diff); // shortest arc on hex rose
  // 0 = directly downwind (best), 3 = directly into wind (worst)
  switch (angle) {
    case 0: return 1.5;   // running before the wind
    case 1: return 1.25;  // broad reach
    case 2: return 1.0;   // beam reach (baseline)
    case 3: return 0.5;   // beating into wind
    default: return 1.0;
  }
}

/** Generate random wind for a new turn */
export function rollWind(seed: number, turn: number): WindState {
  const dirRoll = Math.abs(Math.imul(seed ^ turn, 0x9e3779b9) >>> 0) % 6;
  const condRoll = Math.abs(Math.imul(seed ^ (turn * 7), 0x85ebca6b) >>> 0) % 100;
  let condition: WindCondition;
  if (condRoll < 10) condition = "calm";
  else if (condRoll < 35) condition = "light";
  else if (condRoll < 70) condition = "moderate";
  else if (condRoll < 90) condition = "heavy";
  else condition = "gale";
  return { direction: dirRoll as WindDirection, condition };
}

// ============================================================================
//  DICE UTILITIES
// ============================================================================

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function rollDice(expr: string): number {
  const m = expr.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  if (!m) return 0;
  const numDice = parseInt(m[1]);
  const sides = parseInt(m[2]);
  const bonus = m[3] ? parseInt(m[3]) : 0;
  let total = bonus;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

// ============================================================================
//  SHIP CONSTRUCTION — Create CombatShip from templates
// ============================================================================

let nextWeaponId = 1;
let nextUpgradeId = 1;

function makeWeapon(type: ShipWeaponType): ShipWeapon {
  const def = SHIP_WEAPON_DEFS[type];
  return { ...def, id: `wpn-${nextWeaponId++}`, currentReload: 0 };
}

function makeUpgrade(type: ShipUpgradeType): ShipUpgrade {
  const def = SHIP_UPGRADES[type];
  return { ...def, id: `upg-${nextUpgradeId++}` };
}

/** Build a CombatShip from an OwnedShip + its Ship template */
export function buildCombatShip(
  owned: OwnedShip,
  weapons: ShipWeaponType[],
  upgrades: ShipUpgradeType[],
  isPlayer: boolean,
): CombatShip | null {
  const template = getShip(owned.shipId);
  if (!template) return null;

  const builtWeapons = weapons.map(w => makeWeapon(w));
  const builtUpgrades = upgrades.map(u => makeUpgrade(u));

  // Calculate effective stats from template + upgrades
  let hpBonus = 0;
  let armorBonus = 0;
  let cargoMult = 1;
  let speedBonus = 0;
  for (const upg of builtUpgrades) {
    hpBonus += upg.effect.hpBonus ?? 0;
    armorBonus += upg.effect.armorBonus ?? 0;
    if (upg.effect.cargoMultiplier) cargoMult = upg.effect.cargoMultiplier;
    speedBonus += upg.effect.speedBonus ?? 0;
  }

  const maxHp = owned.maxHp + hpBonus;
  const maxCargo = Math.floor(template.cargoLbs * cargoMult);
  // Speed in "hexes per naval combat turn" — derived from ft speed
  const baseSpeed = Math.max(template.windSpeed, template.oarSpeed);
  const hexSpeed = Math.max(1, Math.floor(baseSpeed / 10) + speedBonus);

  return {
    id: `${owned.shipId}-${owned.name}`.replace(/\s+/g, "_").toLowerCase(),
    name: owned.name,
    shipId: owned.shipId,
    hp: owned.currentHp,
    maxHp,
    crew: owned.crewAssigned.length,
    maxCrew: template.crew + template.maxPassengers,
    cargo: owned.cargo.reduce((sum, c) => sum + c.weightLbs * c.qty, 0),
    maxCargo,
    speed: hexSpeed,
    armor: template.hardness + armorBonus,
    weapons: builtWeapons,
    upgrades: builtUpgrades,
    condition: owned.damaged ? 50 : 100,
    location: owned.dockedAt ?? { q: 0, r: 0 },
    heading: 0,
    isPlayer,
    onFire: false,
    fireDamage: 0,
    sinking: false,
    sinkTurns: 0,
    morale: 80,
    hasMoved: false,
    hasActed: false,
  };
}

// ============================================================================
//  PORT SYSTEM
// ============================================================================

/** Major ports of Tasern — expandable via world generation */
export const KNOWN_PORTS: Port[] = [
  {
    id: "kardovs_harbor",
    name: "Kardov's Harbor",
    hex: { q: 36, r: 32 },
    size: "large",
    alignment: "friendly",
    terrain: "coast",
    exports: ["weapons", "ale", "salt"],
    imports: ["silk", "spices", "gems", "magic_items"],
    priceModifier: 1.0,
    hasShipyard: true,
    hasMarket: true,
    hasTavern: true,
    portFeeGp: 5,
    demandSeed: 42,
  },
  {
    id: "saltmere",
    name: "Saltmere",
    hex: { q: 30, r: 28 },
    size: "medium",
    alignment: "friendly",
    terrain: "coast",
    exports: ["salt", "fish" as TradeGoodType, "food"],
    imports: ["lumber", "ore", "weapons"],
    priceModifier: 0.9,
    hasShipyard: true,
    hasMarket: true,
    hasTavern: true,
    portFeeGp: 3,
    demandSeed: 77,
  },
  {
    id: "blackwater_cove",
    name: "Blackwater Cove",
    hex: { q: 42, r: 35 },
    size: "small",
    alignment: "pirate",
    terrain: "coast",
    exports: ["weapons", "ale"],
    imports: ["food", "lumber"],
    priceModifier: 0.7,
    hasShipyard: false,
    hasMarket: true,
    hasTavern: true,
    portFeeGp: 0,
    demandSeed: 13,
  },
  {
    id: "stormreach",
    name: "Stormreach",
    hex: { q: 25, r: 20 },
    size: "large",
    alignment: "neutral",
    terrain: "coast",
    exports: ["ore", "gems", "lumber"],
    imports: ["food", "silk", "spices", "ale"],
    priceModifier: 1.1,
    hasShipyard: true,
    hasMarket: true,
    hasTavern: true,
    portFeeGp: 8,
    demandSeed: 99,
  },
  {
    id: "serpent_isle",
    name: "Serpent Isle",
    hex: { q: 50, r: 25 },
    size: "medium",
    alignment: "hostile",
    terrain: "coast",
    exports: ["spices", "magic_items", "gems"],
    imports: ["food", "weapons", "ore"],
    priceModifier: 1.3,
    hasShipyard: true,
    hasMarket: true,
    hasTavern: false,
    portFeeGp: 10,
    demandSeed: 55,
  },
];

const portMap = new Map<string, Port>();
for (const p of KNOWN_PORTS) portMap.set(`${p.hex.q},${p.hex.r}`, p);

/** Find port at a coordinate */
export function getPort(hex: Coord): Port | undefined {
  return portMap.get(`${hex.q},${hex.r}`);
}

/** Get available services at a port */
export function getPortServices(port: Coord): PortService[] {
  const p = getPort(port);
  if (!p) return [];
  const services: PortService[] = ["rest", "resupply"];
  if (p.hasShipyard) {
    services.push("repair", "upgrade", "buy_ship", "sell_ship");
  }
  if (p.hasMarket) {
    services.push("buy_cargo", "sell_cargo");
  }
  if (p.hasTavern) {
    services.push("recruit_crew");
  }
  return services;
}

/** Port docking fee based on ship size */
export function dockingFee(ship: Ship, port: Port): number {
  const sizeMultiplier: Record<string, number> = {
    Small: 0.5, Medium: 1, Large: 1, Huge: 2, Gargantuan: 3, Colossal: 5,
  };
  return Math.ceil(port.portFeeGp * (sizeMultiplier[ship.size] ?? 1));
}

// ============================================================================
//  TRADE SYSTEM
// ============================================================================

/** Calculate buy/sell price for a good at a port, with supply/demand fluctuation */
export function getTradePrice(
  good: TradeGoodType,
  port: Port,
  action: "buy" | "sell",
  turnNumber: number,
): number {
  const base = TRADE_GOODS[good].basePrice;
  // Demand fluctuation based on port seed + turn
  const fluctuation = Math.sin(port.demandSeed * 0.1 + turnNumber * 0.3) * 0.2;

  if (action === "buy") {
    // Buying from port: exports are cheaper, imports are expensive
    const isExport = port.exports.includes(good);
    const modifier = isExport ? 0.7 : 1.3;
    return Math.max(1, Math.round(base * modifier * (1 + fluctuation)));
  } else {
    // Selling to port: imports fetch more, exports fetch less
    const isImport = port.imports.includes(good);
    const modifier = isImport ? 1.4 : 0.6;
    return Math.max(1, Math.round(base * port.priceModifier * modifier * (1 + fluctuation)));
  }
}

/** Execute a trade at a port */
export function trade(
  ship: CombatShip,
  port: Coord,
  buy: { good: TradeGoodType; quantity: number }[],
  sell: { good: TradeGoodType; quantity: number }[],
  currentGold: number,
  turnNumber: number,
): TradeResult | null {
  const p = getPort(port);
  if (!p) return null;
  if (!p.hasMarket) return null;

  const bought: TradeResult["bought"] = [];
  const sold: TradeResult["sold"] = [];
  let gold = currentGold;
  let cargoWeight = ship.cargo;

  // Sell first (to free up cargo space and gain gold)
  for (const s of sell) {
    const price = getTradePrice(s.good, p, "sell", turnNumber);
    const revenue = price * s.quantity;
    const weight = TRADE_GOODS[s.good].weightLbs * s.quantity;
    cargoWeight -= weight;
    gold += revenue;
    sold.push({ good: s.good, quantity: s.quantity, totalRevenue: revenue });
  }

  // Then buy
  for (const b of buy) {
    const price = getTradePrice(b.good, p, "buy", turnNumber);
    const totalCost = price * b.quantity;
    const weight = TRADE_GOODS[b.good].weightLbs * b.quantity;
    if (totalCost > gold) continue;               // can't afford
    if (cargoWeight + weight > ship.maxCargo) continue; // no space
    gold -= totalCost;
    cargoWeight += weight;
    bought.push({ good: b.good, quantity: b.quantity, totalCost });
  }

  const netGold = gold - currentGold;
  return {
    bought,
    sold,
    netGold,
    cargoRemaining: ship.maxCargo - cargoWeight,
    message: `Trade complete at ${p.name}. Net: ${netGold >= 0 ? "+" : ""}${netGold} gp.`,
  };
}

/** Get profitable trade routes from a port */
export function getTradeRoutes(from: Coord): TradeRoute[] {
  const sourcePort = getPort(from);
  if (!sourcePort) return [];

  const routes: TradeRoute[] = [];
  for (const dest of KNOWN_PORTS) {
    if (dest.hex.q === from.q && dest.hex.r === from.r) continue;
    if (dest.alignment === "hostile") continue; // can't trade with hostile ports easily

    // Calculate distance (simple hex distance — water pathing would be better)
    const dist = Math.abs(dest.hex.q - from.q) + Math.abs(dest.hex.r - from.r);

    // Find profitable goods: source exports that destination imports
    const profitableGoods = sourcePort.exports.filter(g => dest.imports.includes(g));
    const estimatedProfit = profitableGoods.reduce((sum, g) => {
      const buyCost = TRADE_GOODS[g].basePrice * 0.7;
      const sellPrice = TRADE_GOODS[g].basePrice * 1.4;
      return sum + (sellPrice - buyCost) * 10; // assume 10 units per good
    }, 0);

    // Piracy risk scales with distance and destination alignment
    let piracyRisk = Math.min(0.8, dist * 0.03);
    if (dest.alignment === "pirate") piracyRisk += 0.3;

    routes.push({
      from,
      to: dest.hex,
      distance: dist,
      goods: profitableGoods,
      estimatedProfit: Math.round(estimatedProfit),
      dangerLevel: Math.min(10, Math.ceil(dist / 3)),
      piracyRisk: Math.min(1, piracyRisk),
    });
  }

  return routes.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}

// ============================================================================
//  SHIP PURCHASE & SALE
// ============================================================================

/** Buy a ship at a port. Returns the new OwnedShip or null if unavailable. */
export function buyShip(
  shipId: string,
  port: Coord,
  playerName: string,
): { ship: OwnedShip; cost: number } | null {
  const p = getPort(port);
  if (!p || !p.hasShipyard) return null;

  const template = getShip(shipId);
  if (!template) return null;

  // Check if port size supports this ship
  const available = ALL_SHIPS.filter(s => {
    if (p.size === "small") return s.costGp <= 1000;
    if (p.size === "medium") return s.costGp <= 10000;
    return true;
  });
  if (!available.find(s => s.id === shipId)) return null;

  const totalHp = template.sectionHp * template.totalSections;
  const owned: OwnedShip = {
    shipId,
    name: playerName,
    currentHp: totalHp,
    maxHp: totalHp,
    riggingHp: template.riggingHp,
    maxRiggingHp: template.riggingHp,
    dockedAt: port,
    crewAssigned: [],
    cargo: [],
    damaged: false,
  };
  return { ship: owned, cost: template.costGp };
}

/** Sell a ship. Returns gold received (50% of base value, condition-adjusted). */
export function sellShip(owned: OwnedShip, port: Coord): number | null {
  const p = getPort(port);
  if (!p || !p.hasShipyard) return null;

  const template = getShip(owned.shipId);
  if (!template) return null;

  const conditionFactor = owned.currentHp / owned.maxHp;
  return Math.floor(template.costGp * 0.5 * conditionFactor);
}

// ============================================================================
//  SHIP MOVEMENT
// ============================================================================

/** Move a ship across water hexes. Returns the result of the journey. */
export function moveShip(
  ship: CombatShip,
  destination: Coord,
  wind: WindState,
  isOpenWater: boolean,
): MoveResult {
  // Calculate effective speed with wind
  const windMod = windSpeedModifier(ship.heading, wind.direction);
  let effectiveSpeed = Math.max(1, Math.round(ship.speed * windMod));

  // Open water bonus from navigator's tools
  if (isOpenWater) {
    const navTools = ship.upgrades.find(u => u.type === "navigators_tools");
    if (navTools) effectiveSpeed += navTools.effect.openWaterSpeedBonus ?? 0;
  }

  // Condition penalty
  if (ship.condition < 50) effectiveSpeed = Math.max(1, effectiveSpeed - 1);
  if (ship.condition < 25) effectiveSpeed = Math.max(1, effectiveSpeed - 1);

  // Gale penalty
  if (wind.condition === "gale") effectiveSpeed = Math.max(1, effectiveSpeed - 1);

  const distance = Math.abs(destination.q - ship.location.q) + Math.abs(destination.r - ship.location.r);
  const hexesMoved = Math.min(distance, effectiveSpeed);
  const hoursPerHex = hoursPerWaterHex(ship.speed * 10); // convert back to ft for the utility
  const hoursElapsed = hexesMoved * hoursPerHex;

  // Random encounter check (1 per hex moved, ~15% chance)
  const encounters: NavalEncounter[] = [];
  for (let i = 0; i < hexesMoved; i++) {
    if (Math.random() < 0.15) {
      encounters.push(generateNavalEncounter(Math.ceil(distance / 3)));
    }
  }

  // Condition degrades slightly with travel
  const conditionLoss = Math.ceil(hexesMoved * 0.5);

  // Move toward destination (greedy — straight line)
  const dq = destination.q - ship.location.q;
  const dr = destination.r - ship.location.r;
  const ratio = hexesMoved / Math.max(1, distance);
  const newLocation: Coord = {
    q: Math.round(ship.location.q + dq * ratio),
    r: Math.round(ship.location.r + dr * ratio),
  };

  const arrived = hexesMoved >= distance;
  return {
    success: true,
    hexesMoved,
    newLocation: arrived ? destination : newLocation,
    hoursElapsed,
    encounters,
    conditionLoss,
    message: arrived
      ? `Arrived at (${destination.q}, ${destination.r}) after ${hoursElapsed} hours.`
      : `Sailed ${hexesMoved} hexes toward destination. ${distance - hexesMoved} hexes remaining.`,
  };
}

/** Generate a random naval encounter */
function generateNavalEncounter(dangerLevel: number): NavalEncounter {
  const roll = Math.random() * 100;
  if (roll < 20) {
    return { type: "storm", description: "A squall hits without warning. Batten down!", dangerLevel: Math.min(10, dangerLevel + 2) };
  }
  if (roll < 40) {
    return { type: "merchant", description: "A merchant vessel hails you. Trade opportunity.", dangerLevel: 0 };
  }
  if (roll < 55) {
    return { type: "pirate", description: "Black sails on the horizon. Pirates!", dangerLevel: Math.min(10, dangerLevel + 3) };
  }
  if (roll < 70) {
    return { type: "patrol", description: "A naval patrol approaches. They demand identification.", dangerLevel: 1 };
  }
  if (roll < 85) {
    return { type: "debris", description: "Wreckage floats in the water. Salvage possible.", dangerLevel: 0 };
  }
  return { type: "monster", description: "Something massive stirs beneath the waves.", dangerLevel: Math.min(10, dangerLevel + 4) };
}

// ============================================================================
//  NAVAL COMBAT
// ============================================================================

/** Resolve a full naval battle between two groups of ships */
export function navalCombat(
  attackers: CombatShip[],
  defenders: CombatShip[],
  wind: WindState,
  maxRounds: number = 10,
): NavalBattleResult {
  const log: NavalCombatLog[] = [];
  const attackerDamage: Record<string, number> = {};
  const defenderDamage: Record<string, number> = {};
  const attackerSunk: string[] = [];
  const defenderSunk: string[] = [];
  const captured: string[] = [];
  let round = 0;

  // Clone ships for mutation during combat
  const aShips = attackers.map(s => ({ ...s }));
  const dShips = defenders.map(s => ({ ...s }));

  while (round < maxRounds) {
    round++;
    log.push({ round, text: `--- Round ${round} ---`, type: "info" });

    // Attackers fire
    for (const ship of aShips) {
      if (ship.hp <= 0) continue;
      const target = pickTarget(dShips);
      if (!target) break;
      const result = resolveShipAttack(ship, target, wind);
      log.push({ round, text: result.text, type: result.hit ? "hit" : "miss" });
      if (result.hit) {
        defenderDamage[target.id] = (defenderDamage[target.id] ?? 0) + result.damage;
      }
      if (target.hp <= 0 && !target.sinking) {
        target.sinking = true;
        target.sinkTurns = 3;
        log.push({ round, text: `${target.name} is sinking!`, type: "sink" });
      }
    }

    // Defenders fire
    for (const ship of dShips) {
      if (ship.hp <= 0) continue;
      const target = pickTarget(aShips);
      if (!target) break;
      const result = resolveShipAttack(ship, target, wind);
      log.push({ round, text: result.text, type: result.hit ? "hit" : "miss" });
      if (result.hit) {
        attackerDamage[target.id] = (attackerDamage[target.id] ?? 0) + result.damage;
      }
      if (target.hp <= 0 && !target.sinking) {
        target.sinking = true;
        target.sinkTurns = 3;
        log.push({ round, text: `${target.name} is sinking!`, type: "sink" });
      }
    }

    // Process fire damage
    for (const ship of [...aShips, ...dShips]) {
      if (ship.onFire && ship.hp > 0) {
        ship.hp -= ship.fireDamage;
        log.push({ round, text: `${ship.name} burns for ${ship.fireDamage} damage!`, type: "fire" });
        // 20% chance fire spreads (more damage next turn)
        if (Math.random() < 0.2) ship.fireDamage += 2;
        // 30% chance fire goes out
        if (Math.random() < 0.3) {
          ship.onFire = false;
          ship.fireDamage = 0;
          log.push({ round, text: `Fire on ${ship.name} extinguished.`, type: "info" });
        }
      }
    }

    // Process sinking ships
    for (const ship of [...aShips, ...dShips]) {
      if (ship.sinking) {
        ship.sinkTurns--;
        if (ship.sinkTurns <= 0) {
          ship.hp = -999;
          const isAttacker = aShips.includes(ship);
          if (isAttacker) attackerSunk.push(ship.id);
          else defenderSunk.push(ship.id);
          log.push({ round, text: `${ship.name} has sunk beneath the waves.`, type: "sink" });
        }
      }
    }

    // Reload weapons
    for (const ship of [...aShips, ...dShips]) {
      for (const wpn of ship.weapons) {
        if (wpn.currentReload > 0) wpn.currentReload--;
      }
    }

    // Check victory conditions
    const aAlive = aShips.filter(s => s.hp > 0);
    const dAlive = dShips.filter(s => s.hp > 0);
    if (aAlive.length === 0 && dAlive.length === 0) break;
    if (aAlive.length === 0) break;
    if (dAlive.length === 0) break;

    // Morale check — ships flee at low morale
    for (const ship of [...aAlive, ...dAlive]) {
      if (ship.hp < ship.maxHp * 0.25) ship.morale -= 15;
    }
  }

  // Determine victor
  const aAlive = aShips.filter(s => s.hp > 0);
  const dAlive = dShips.filter(s => s.hp > 0);
  let victor: "attacker" | "defender" | "draw";
  if (aAlive.length > 0 && dAlive.length === 0) victor = "attacker";
  else if (dAlive.length > 0 && aAlive.length === 0) victor = "defender";
  else victor = "draw";

  return {
    victor,
    attackerShipsLost: attackerSunk,
    defenderShipsLost: defenderSunk,
    attackerDamage,
    defenderDamage,
    captured,
    loot: [],
    log,
    rounds: round,
  };
}

/** Pick a living target (prioritize lowest HP) */
function pickTarget(ships: CombatShip[]): CombatShip | null {
  const alive = ships.filter(s => s.hp > 0);
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => a.hp < b.hp ? a : b);
}

/** Resolve a single ship's attack against a target */
function resolveShipAttack(
  attacker: CombatShip,
  target: CombatShip,
  wind: WindState,
): { hit: boolean; damage: number; text: string } {
  // Find a ready weapon
  const readyWeapon = attacker.weapons.find(w => w.currentReload === 0 && w.type !== "ram");
  if (!readyWeapon) {
    return { hit: false, damage: 0, text: `${attacker.name}: All weapons reloading.` };
  }

  // Attack roll: d20 + crew skill (condition/10) vs target AC (armor + size)
  const attackBonus = Math.floor(attacker.condition / 10);
  const targetAC = 10 + target.armor + (target.speed > 2 ? 2 : 0); // fast ships harder to hit
  const roll = rollD20();
  const total = roll + attackBonus;

  // Set reload
  readyWeapon.currentReload = readyWeapon.reloadTurns;

  if (roll === 1) {
    return { hit: false, damage: 0, text: `${attacker.name}'s ${readyWeapon.name}: Critical miss!` };
  }

  if (roll !== 20 && total < targetAC) {
    return { hit: false, damage: 0, text: `${attacker.name}'s ${readyWeapon.name}: d20(${roll})+${attackBonus}=${total} vs AC ${targetAC} — Miss!` };
  }

  // Damage
  let damage = rollDice(readyWeapon.damage);
  const isCrit = roll === 20;
  if (isCrit) damage *= 2;

  // Armor reduces damage
  damage = Math.max(1, damage - target.armor);
  target.hp -= damage;

  // Fire effect from greek fire
  if (readyWeapon.special.includes("fire") && !target.onFire) {
    target.onFire = true;
    target.fireDamage = 4;
  }

  const critStr = isCrit ? " CRITICAL! " : "";
  const fireStr = readyWeapon.special.includes("fire") ? " Target is ON FIRE!" : "";
  return {
    hit: true,
    damage,
    text: `${attacker.name}'s ${readyWeapon.name}: d20(${roll})+${attackBonus}=${total} vs AC ${targetAC} —${critStr} ${damage} damage!${fireStr}`,
  };
}

// ============================================================================
//  RAMMING
// ============================================================================

/** Resolve a ramming attack (move into enemy hex at speed 3+) */
export function resolveRam(
  attacker: CombatShip,
  target: CombatShip,
): { damage: number; selfDamage: number; text: string } {
  if (attacker.speed < 3) {
    return { damage: 0, selfDamage: 0, text: `${attacker.name}: Not enough speed to ram (need 3+, have ${attacker.speed}).` };
  }

  const template = getShip(attacker.shipId);
  if (!template) {
    return { damage: 0, selfDamage: 0, text: `${attacker.name}: Unknown ship template.` };
  }

  // Ram damage from template, or speed-based fallback
  let damage: number;
  if (template.ramDamage && template.ramDamage !== "0") {
    damage = rollDice(template.ramDamage);
  } else {
    damage = rollDice(`${attacker.speed * 2}d6`);
  }

  // Self-damage: half for ships with ramming prow, full otherwise
  const selfDamage = template.hasRammingProw ? Math.floor(damage * 0.25) : Math.floor(damage * 0.5);

  damage = Math.max(1, damage - target.armor);
  target.hp -= damage;
  attacker.hp -= selfDamage;

  return {
    damage,
    selfDamage,
    text: `${attacker.name} RAMS ${target.name}! ${damage} damage to target, ${selfDamage} damage to self.`,
  };
}

// ============================================================================
//  BOARDING
// ============================================================================

/** Resolve boarding combat (crew vs crew melee) */
export function board(
  attacker: CombatShip,
  defender: CombatShip,
): BoardingResult {
  const log: string[] = [];
  let aCrew = attacker.crew;
  let dCrew = defender.crew;

  // Boarding net defense
  const boardingDef = defender.upgrades
    .filter(u => u.type === "boarding_nets")
    .reduce((sum, u) => sum + (u.effect.boardingDefense ?? 0), 0);

  log.push(`${attacker.name} (${aCrew} crew) boards ${defender.name} (${dCrew} crew)!`);
  if (boardingDef > 0) {
    log.push(`Boarding nets slow the attackers! (-${boardingDef} effective crew)`);
    aCrew = Math.max(1, aCrew - boardingDef);
  }

  // Resolve in rounds until one side falls below 25% or routs
  let round = 0;
  const maxRounds = 8;
  const startACrew = aCrew;
  const startDCrew = dCrew;

  while (round < maxRounds && aCrew > 0 && dCrew > 0) {
    round++;
    // Each side rolls: crew count * d20, compared to opposing morale/10
    const aRoll = rollD20() + Math.floor(aCrew / 5);
    const dRoll = rollD20() + Math.floor(dCrew / 5);

    const aKills = Math.max(0, Math.floor((aRoll - 10) * aCrew / 20));
    const dKills = Math.max(0, Math.floor((dRoll - 10) * dCrew / 20));

    dCrew = Math.max(0, dCrew - aKills);
    aCrew = Math.max(0, aCrew - dKills);

    log.push(`Round ${round}: Attackers kill ${aKills}, Defenders kill ${dKills}. (A:${aCrew} D:${dCrew})`);

    // Morale break at 25% remaining
    if (dCrew > 0 && dCrew < startDCrew * 0.25) {
      log.push(`${defender.name}'s crew surrenders!`);
      dCrew = 0;
      break;
    }
    if (aCrew > 0 && aCrew < startACrew * 0.25) {
      log.push(`${attacker.name}'s boarding party retreats!`);
      break;
    }
  }

  const attackerWon = dCrew === 0 && aCrew > 0;
  const attackerCasualties = startACrew - aCrew;
  const defenderCasualties = startDCrew - dCrew;

  // Loot captured ship's cargo
  const loot: CargoManifest[] = [];
  if (attackerWon) {
    log.push(`${attacker.name} captures ${defender.name}!`);
    // Transfer cargo as loot
    if (defender.cargo > 0) {
      loot.push({ good: "weapons", quantity: Math.ceil(defender.cargo / 100), purchasePrice: 0 });
    }
  }

  return {
    success: attackerWon,
    attackerCasualties,
    defenderCasualties,
    shipCaptured: attackerWon,
    loot,
    log,
  };
}

// ============================================================================
//  SHIP REPAIR & UPGRADE
// ============================================================================

/** Repair a ship at a port. Returns cost in gp. */
export function repairShip(ship: CombatShip, port: Coord): { cost: number; message: string } | null {
  const p = getPort(port);
  if (!p || !p.hasShipyard) return null;

  const template = getShip(ship.shipId);
  if (!template) return null;

  if (ship.hp >= ship.maxHp && ship.condition >= 100) {
    return { cost: 0, message: `${ship.name} is already in perfect condition.` };
  }

  // Repair cost: proportional to damage, based on ship value
  const hpDamage = 1 - (ship.hp / ship.maxHp);
  const condDamage = 1 - (ship.condition / 100);
  const totalDamage = Math.max(hpDamage, condDamage);
  const cost = Math.ceil(totalDamage * template.costGp * 0.3);

  return {
    cost,
    message: `Repair ${ship.name}: ${cost} gp (${Math.round(totalDamage * 100)}% damaged).`,
  };
}

/** Apply a repair (mutates ship) */
export function applyRepair(ship: CombatShip): void {
  ship.hp = ship.maxHp;
  ship.condition = 100;
  ship.onFire = false;
  ship.fireDamage = 0;
  ship.sinking = false;
  ship.sinkTurns = 0;
}

/** Install an upgrade on a ship */
export function upgradeShip(
  ship: CombatShip,
  upgradeType: ShipUpgradeType,
  port: Coord,
): { success: boolean; cost: number; message: string } {
  const p = getPort(port);
  if (!p || !p.hasShipyard) {
    return { success: false, cost: 0, message: "No shipyard available at this port." };
  }

  // Check if already has this upgrade
  if (ship.upgrades.find(u => u.type === upgradeType)) {
    return { success: false, cost: 0, message: `${ship.name} already has ${SHIP_UPGRADES[upgradeType].name}.` };
  }

  const upgDef = SHIP_UPGRADES[upgradeType];
  const upgrade = makeUpgrade(upgradeType);

  // Apply the upgrade effects
  ship.upgrades.push(upgrade);
  if (upgrade.effect.hpBonus) ship.maxHp += upgrade.effect.hpBonus;
  if (upgrade.effect.armorBonus) ship.armor += upgrade.effect.armorBonus;
  if (upgrade.effect.cargoMultiplier) ship.maxCargo = Math.floor(ship.maxCargo * upgrade.effect.cargoMultiplier);
  if (upgrade.effect.speedBonus) ship.speed += upgrade.effect.speedBonus;

  return {
    success: true,
    cost: upgDef.costGp,
    message: `Installed ${upgDef.name} on ${ship.name} for ${upgDef.costGp} gp.`,
  };
}

// ============================================================================
//  CREW MANAGEMENT
// ============================================================================

/** Hire a crew member at a port */
export function hireCrew(
  specialization: CrewSpecialization,
  port: Coord,
): CrewMember | null {
  const p = getPort(port);
  if (!p || !p.hasTavern) return null;

  const wages = CREW_WAGES[specialization];
  const names = CREW_NAMES[specialization];
  const name = names[Math.floor(Math.random() * names.length)];

  return {
    id: `crew-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    specialization,
    skill: Math.floor(Math.random() * 3) + 1, // 1-3 at hire
    morale: 70 + Math.floor(Math.random() * 20),
    hireGp: wages.hireGp,
    wageGp: wages.wageGp,
  };
}

const CREW_NAMES: Record<CrewSpecialization, string[]> = {
  sailor: ["Jack", "Sam", "Peg", "Old Tom", "Deckhand Fen", "Barnacle", "Cork", "Rope-arm"],
  navigator: ["Starwatcher Iden", "Compass Rose", "Chart-keeper Voss", "Astral Ren"],
  surgeon: ["Doc Needles", "Bone-setter Sal", "Sawbones", "Healer Lorn"],
  gunner: ["Boom-arm Kral", "Steady Hand", "Powder Meg", "One-eye Griz"],
  marine: ["Ironjaw", "Blade-fist", "Shield-wall Grun", "Scarface", "Wardbreaker"],
  cook: ["Grease", "Stewpot", "Salty", "Biscuit", "Pepper"],
};

/** Update crew morale based on conditions */
export function updateCrewMorale(
  ship: CombatShip,
  crew: CrewMember[],
  paid: boolean,
  recentBattle: boolean,
  daysAtSea: number,
): { morale: number; mutinyRisk: boolean; message: string } {
  let moraleChange = 0;

  if (!paid) moraleChange -= 15;
  if (recentBattle && ship.hp < ship.maxHp * 0.5) moraleChange -= 10;
  if (recentBattle && ship.hp >= ship.maxHp * 0.5) moraleChange += 5; // survived!
  if (daysAtSea > 14) moraleChange -= 5;
  if (daysAtSea > 30) moraleChange -= 10;

  // Cook provides morale bonus
  const hasCook = crew.some(c => c.specialization === "cook");
  if (hasCook) moraleChange += 3;

  // Apply to ship morale
  ship.morale = Math.max(0, Math.min(100, ship.morale + moraleChange));

  // Apply to individual crew
  for (const c of crew) {
    c.morale = Math.max(0, Math.min(100, c.morale + moraleChange));
  }

  const mutinyRisk = ship.morale < 20;
  let message = `Crew morale: ${ship.morale}%.`;
  if (mutinyRisk) message += " WARNING: Mutiny risk is HIGH!";

  return { morale: ship.morale, mutinyRisk, message };
}

/** Resolve a mutiny attempt */
export function resolveMutiny(ship: CombatShip, captainCha: number): { mutiny: boolean; message: string } {
  // Captain's CHA modifier + d20 vs DC 15 + (100 - morale)/10
  const dc = 15 + Math.floor((100 - ship.morale) / 10);
  const roll = rollD20();
  const chaMod = Math.floor(captainCha / 2);
  const total = roll + chaMod;

  if (total >= dc) {
    ship.morale = Math.min(100, ship.morale + 20);
    return {
      mutiny: false,
      message: `Captain quells the unrest! d20(${roll})+${chaMod}=${total} vs DC ${dc}. Morale restored to ${ship.morale}%.`,
    };
  }

  return {
    mutiny: true,
    message: `MUTINY! d20(${roll})+${chaMod}=${total} vs DC ${dc}. The crew has turned against you!`,
  };
}

/** Get crew bonus effects for a ship */
export function crewBonuses(crew: CrewMember[]): {
  speedBonus: number;
  healingPerTurn: number;
  weaponAccuracy: number;
  boardingBonus: number;
} {
  let speedBonus = 0;
  let healingPerTurn = 0;
  let weaponAccuracy = 0;
  let boardingBonus = 0;

  for (const c of crew) {
    switch (c.specialization) {
      case "navigator":
        speedBonus += Math.floor(c.skill / 2);
        break;
      case "surgeon":
        healingPerTurn += c.skill;
        break;
      case "gunner":
        weaponAccuracy += c.skill;
        break;
      case "marine":
        boardingBonus += c.skill;
        break;
    }
  }

  return { speedBonus, healingPerTurn, weaponAccuracy, boardingBonus };
}

// ============================================================================
//  FLEET SYSTEM (WoW Integration)
// ============================================================================

/** Create a fleet from a set of combat ships */
export function createFleet(
  name: string,
  ships: CombatShip[],
  flagshipId: string,
  kingdomId: string,
  admiralName: string,
): Fleet {
  return {
    id: `fleet-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    ships,
    flagship: flagshipId,
    hex: ships[0]?.location ?? { q: 0, r: 0 },
    formation: "line",
    orders: null,
    kingdomId,
    admiralName,
  };
}

/** Move a fleet — speed limited by slowest ship */
export function moveFleet(fleet: Fleet, destination: Coord, wind: WindState): MoveResult {
  const slowestSpeed = Math.min(...fleet.ships.map(s => s.speed));
  // Create a virtual "fleet ship" with slowest speed for movement calc
  const virtualShip: CombatShip = {
    ...fleet.ships[0],
    speed: slowestSpeed,
    location: fleet.hex,
  };
  const result = moveShip(virtualShip, destination, wind, true);
  // Update all ship positions
  for (const ship of fleet.ships) {
    ship.location = result.newLocation;
  }
  fleet.hex = result.newLocation;
  return result;
}

/** Resolve fleet-vs-fleet combat */
export function fleetCombat(
  attackerFleet: Fleet,
  defenderFleet: Fleet,
  wind: WindState,
): NavalBattleResult {
  return navalCombat(attackerFleet.ships, defenderFleet.ships, wind);
}

/** Check if a fleet is blockading a port (within 1 hex) */
export function isBlockading(fleet: Fleet, port: Coord): boolean {
  const dist = Math.abs(fleet.hex.q - port.q) + Math.abs(fleet.hex.r - port.r);
  return dist <= 1 && fleet.formation === "blockade";
}

/** Calculate transport capacity of a fleet (for army movement) */
export function fleetTransportCapacity(fleet: Fleet): number {
  return fleet.ships.reduce((sum, ship) => {
    const template = getShip(ship.shipId);
    if (!template) return sum;
    return sum + template.maxPassengers;
  }, 0);
}

/** Check if fleet can transport an army of given size */
export function canTransportArmy(fleet: Fleet, armySize: number): boolean {
  return fleetTransportCapacity(fleet) >= armySize;
}

// ============================================================================
//  STORM DAMAGE
// ============================================================================

/** Apply storm damage to a ship (gale-force winds) */
export function applyStormDamage(ship: CombatShip): { damage: number; riggingLost: boolean; message: string } {
  const damage = rollDice("2d6");
  ship.hp -= damage;
  ship.condition = Math.max(0, ship.condition - 10);

  // 25% chance of losing rigging (speed penalty)
  const riggingLost = Math.random() < 0.25;
  if (riggingLost) {
    ship.speed = Math.max(1, ship.speed - 1);
  }

  let message = `Storm batters ${ship.name} for ${damage} damage!`;
  if (riggingLost) message += " Rigging torn away — speed reduced!";
  if (ship.hp <= 0) message += ` ${ship.name} is breaking apart!`;

  return { damage, riggingLost, message };
}

// ============================================================================
//  SALVAGE & LOOT
// ============================================================================

/** Loot a disabled/sinking ship */
export function lootShip(target: CombatShip): CargoManifest[] {
  if (target.hp > 0 && !target.sinking) return [];
  // Recover 50-80% of cargo
  const recoverRate = 0.5 + Math.random() * 0.3;
  const recovered: CargoManifest[] = [];

  // Generate some random loot based on ship size
  const lootValue = Math.floor(target.maxCargo * 0.01); // rough gold value
  if (lootValue > 0) {
    const goods: TradeGoodType[] = ["weapons", "food", "ore", "gems", "silk"];
    const good = goods[Math.floor(Math.random() * goods.length)];
    const qty = Math.max(1, Math.floor(lootValue * recoverRate / TRADE_GOODS[good].basePrice));
    recovered.push({ good, quantity: qty, purchasePrice: 0 });
  }

  return recovered;
}

// ============================================================================
//  UTILITY
// ============================================================================

/** Calculate total weekly crew wages for a ship */
export function weeklyCrewCost(crew: CrewMember[]): number {
  return crew.reduce((sum, c) => sum + c.wageGp, 0);
}

/** Check if a hex is navigable water */
export function isWaterHex(terrain: Terrain): boolean {
  return terrain === "water" || terrain === "coast";
}

/** Hex distance (simplified — use hexWorld for full distance calc) */
export function navalHexDistance(a: Coord, b: Coord): number {
  return Math.abs(a.q - b.q) + Math.abs(a.r - b.r);
}
