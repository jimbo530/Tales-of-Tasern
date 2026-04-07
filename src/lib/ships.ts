// ============================================================
// ships.ts — Ship & watercraft registry for Tales of Tasern
//
// All ships from D&D 3.5 Arms & Equipment Guide Chapter 3
// plus PHB basics (rowboat, raft). Stats adapted for game use.
// Ships unlock water travel, cargo hauling, and transfer to
// ToT World of War for naval warfare.
//
// 1 hex = 5 ft.  Ship speed is in ft/round (like creature speed).
// Water hex travel: speed determines hours per hex (base 8h).
// ============================================================

// ── Types ────────────────────────────────────────────────────────────────────

export type ShipSize = "Small" | "Medium" | "Large" | "Huge" | "Gargantuan" | "Colossal";

export type Maneuverability = "clumsy" | "poor" | "average" | "good" | "perfect";

export type PropulsionType = "oars" | "wind" | "oars_and_wind" | "mechanical";

export type WeaponMount = {
  type: "ballista" | "light_catapult" | "heavy_catapult";
  count: number;
};

export type Ship = {
  id: string;
  name: string;
  size: ShipSize;
  category: "smaller" | "medium" | "larger";  // A&E vessel class
  description: string;

  // ── Propulsion ──
  propulsion: PropulsionType;
  windSpeed: number;           // base speed with wind (ft), 0 if no sails
  oarSpeed: number;            // base speed with oars (ft), 0 if no oars
  maneuverability: Maneuverability;

  // ── Durability ──
  sectionHp: number;           // HP per 10x10ft section
  hardness: number;            // damage reduction per hit
  overallAC: number;           // overall AC modifier
  sectionAC: number;           // individual section AC
  riggingHp: number;           // rigging HP (0 = no rigging)
  riggingAC: number;           // rigging AC
  ramDamage: string;           // ram damage dice (e.g. "8d6")
  totalSections: number;       // number of 10x10 sections (face / 100)

  // ── Dimensions ──
  lengthFt: number;
  widthFt: number;
  heightFt: number;            // waterline to deck
  draftFt: number;             // min water depth needed

  // ── Crew & Cargo ──
  crew: number;                // minimum crew to operate
  rowers: number;              // how many of crew are rowers (0 for sail-only)
  maxPassengers: number;       // extra capacity beyond crew
  cargoTons: number;           // cargo hold in tons (1 ton = 2000 lbs)
  cargoLbs: number;            // cargo in lbs (for small vessels)
  cargoSpeedPenalty?: {        // speed drop when heavily loaded
    thresholdTons: number;     // cargo weight that triggers penalty
    windReduction: number;     // wind speed reduction (ft)
    oarReduction: number;      // oar speed reduction (ft)
  };

  // ── Weapons ──
  weaponMounts: WeaponMount[];
  hasRammingProw: boolean;     // built-in ramming prow (half ram damage to self)

  // ── Cost ──
  costGp: number;              // purchase price in gold pieces

  // ── Special ──
  special: string[];           // special qualities (e.g. "submersible", "iron-plated")
  coverFromDeck: string;       // cover type for those on deck
  canOceanVoyage: boolean;     // suitable for open ocean travel
};

export type OwnedShip = {
  shipId: string;              // references Ship.id
  name: string;                // player-chosen ship name
  currentHp: number;           // total hull HP remaining (all sections)
  maxHp: number;               // total hull HP at full repair
  riggingHp: number;           // current rigging HP
  maxRiggingHp: number;
  dockedAt: { q: number; r: number } | null;  // hex where docked, null if at sea
  crewAssigned: string[];      // follower IDs assigned as crew
  cargo: { id: string; name: string; qty: number; weightLbs: number }[];  // items in hold
  damaged: boolean;            // needs repair
};

// ── Ship Data (D&D 3.5 Arms & Equipment Guide + PHB) ───────────────────────

function ship(
  id: string, name: string, size: ShipSize, category: Ship["category"],
  description: string, data: Omit<Ship, "id" | "name" | "size" | "category" | "description">,
): Ship {
  return { id, name, size, category, description, ...data };
}

// ── SMALLER VESSELS (up to 60 ft — PCs are the crew) ────────────────────────

export const SMALLER_VESSELS: Ship[] = [
  ship("raft", "Raft", "Large", "smaller",
    "A simple platform of lashed logs. Barely seaworthy, but cheap and quick to build. No cover, no cargo hold — just a flat surface and a prayer.",
    {
      propulsion: "oars",
      windSpeed: 0, oarSpeed: 5, maneuverability: "clumsy",
      sectionHp: 10, hardness: 3, overallAC: 5, sectionAC: 5,
      riggingHp: 0, riggingAC: 0, ramDamage: "1d6", totalSections: 1,
      lengthFt: 10, widthFt: 10, heightFt: 1, draftFt: 1,
      crew: 1, rowers: 1, maxPassengers: 3, cargoTons: 0, cargoLbs: 200,
      weaponMounts: [], hasRammingProw: false,
      costGp: 5,
      special: ["makeshift"],
      coverFromDeck: "none",
      canOceanVoyage: false,
    }),

  ship("rowboat", "Rowboat", "Large", "smaller",
    "A sturdy wooden boat with oars. Good for river crossings, lake fishing, and short coastal hops. Two can row while others ride.",
    {
      propulsion: "oars",
      windSpeed: 0, oarSpeed: 15, maneuverability: "good",
      sectionHp: 20, hardness: 5, overallAC: 5, sectionAC: 5,
      riggingHp: 0, riggingAC: 0, ramDamage: "2d6", totalSections: 1,
      lengthFt: 15, widthFt: 5, heightFt: 3, draftFt: 2,
      crew: 1, rowers: 1, maxPassengers: 3, cargoTons: 0, cargoLbs: 500,
      weaponMounts: [], hasRammingProw: false,
      costGp: 50,
      special: [],
      coverFromDeck: "one-quarter",
      canOceanVoyage: false,
    }),

  ship("launch", "Launch", "Huge", "smaller",
    "A large-oared vessel often used as a lifeboat or ship-to-shore boat. Crew and passengers are exposed to the elements. Can be converted for pure passenger use.",
    {
      propulsion: "oars",
      windSpeed: 0, oarSpeed: 15, maneuverability: "good",
      sectionHp: 30, hardness: 5, overallAC: 3, sectionAC: 3,
      riggingHp: 0, riggingAC: 0, ramDamage: "4d6", totalSections: 2,
      lengthFt: 20, widthFt: 10, heightFt: 5, draftFt: 2,
      crew: 4, rowers: 4, maxPassengers: 4, cargoTons: 5, cargoLbs: 10000,
      cargoSpeedPenalty: { thresholdTons: 2, windReduction: 0, oarReduction: 5 },
      weaponMounts: [], hasRammingProw: false,
      costGp: 500,
      special: [],
      coverFromDeck: "one-quarter",
      canOceanVoyage: false,
    }),

  ship("catamaran", "Catamaran", "Gargantuan", "smaller",
    "A twin-hulled vessel designed for ocean voyages. Its hulls slip through the water efficiently, but a wooden paddle-keel and simple sail prevent quick maneuvers. No belowdecks — only a tarp for shelter.",
    {
      propulsion: "wind",
      windSpeed: 20, oarSpeed: 0, maneuverability: "poor",
      sectionHp: 50, hardness: 5, overallAC: 1, sectionAC: 3,
      riggingHp: 30, riggingAC: 3, ramDamage: "12d6", totalSections: 6,
      lengthFt: 60, widthFt: 20, heightFt: 5, draftFt: 5,
      crew: 15, rowers: 0, maxPassengers: 5, cargoTons: 5, cargoLbs: 10000,
      weaponMounts: [], hasRammingProw: false,
      costGp: 2000,
      special: ["twin-hull"],
      coverFromDeck: "one-quarter",
      canOceanVoyage: true,
    }),

  ship("keelboat", "Keelboat", "Gargantuan", "smaller",
    "A shallow-draft vessel with both sails and oars, perfect for rivers and lakes. The PCs can be the entire crew. Can mount a single light catapult or ballista on deck.",
    {
      propulsion: "oars_and_wind",
      windSpeed: 10, oarSpeed: 10, maneuverability: "good",
      sectionHp: 40, hardness: 5, overallAC: 1, sectionAC: 3,
      riggingHp: 30, riggingAC: 3, ramDamage: "8d6", totalSections: 6,
      lengthFt: 60, widthFt: 20, heightFt: 10, draftFt: 5,
      crew: 15, rowers: 0, maxPassengers: 10, cargoTons: 50, cargoLbs: 100000,
      cargoSpeedPenalty: { thresholdTons: 25, windReduction: 5, oarReduction: 5 },
      weaponMounts: [{ type: "light_catapult", count: 1 }],
      hasRammingProw: false,
      costGp: 3000,
      special: ["shallow-draft"],
      coverFromDeck: "one-half",
      canOceanVoyage: false,
    }),

  // ── MEDIUM VESSELS (70-90 ft — PCs are part of the crew) ──────────────────

  ship("sailing_ship", "Sailing Ship", "Colossal", "medium",
    "A sturdy ocean-going vessel with full sails, a proper belowdecks, and room for light catapults. The workhorse of merchant fleets and adventuring companies. Uses a launch as a lifeboat.",
    {
      propulsion: "wind",
      windSpeed: 20, oarSpeed: 0, maneuverability: "average",
      sectionHp: 50, hardness: 5, overallAC: -3, sectionAC: 3,
      riggingHp: 80, riggingAC: 1, ramDamage: "12d6", totalSections: 16,
      lengthFt: 80, widthFt: 20, heightFt: 10, draftFt: 10,
      crew: 20, rowers: 0, maxPassengers: 20, cargoTons: 150, cargoLbs: 300000,
      cargoSpeedPenalty: { thresholdTons: 75, windReduction: 5, oarReduction: 0 },
      weaponMounts: [{ type: "light_catapult", count: 2 }],
      hasRammingProw: false,
      costGp: 10000,
      special: [],
      coverFromDeck: "one-half",
      canOceanVoyage: true,
    }),

  ship("longship", "Longship", "Colossal", "medium",
    "A Norse-style vessel with both sails and oars, shallow draft, and room for raiders. Fast under oar power, and its shallow draft lets it beach on any shore. Favored by coastal raiders and explorers.",
    {
      propulsion: "oars_and_wind",
      windSpeed: 10, oarSpeed: 15, maneuverability: "average",
      sectionHp: 90, hardness: 5, overallAC: -3, sectionAC: 3,
      riggingHp: 40, riggingAC: 1, ramDamage: "8d6", totalSections: 14,
      lengthFt: 70, widthFt: 20, heightFt: 10, draftFt: 5,
      crew: 50, rowers: 40, maxPassengers: 50, cargoTons: 50, cargoLbs: 100000,
      cargoSpeedPenalty: { thresholdTons: 25, windReduction: 5, oarReduction: 5 },
      weaponMounts: [{ type: "light_catapult", count: 2 }],
      hasRammingProw: false,
      costGp: 10000,
      special: ["shallow-draft"],
      coverFromDeck: "one-half",
      canOceanVoyage: true,
    }),

  ship("yacht", "Yacht", "Colossal", "medium",
    "A pleasure ship for royalty and extremely rich merchants. Opulent staterooms belowdecks, clear decks for leisure strolls. Everything is the finest quality, from mast to belaying pins.",
    {
      propulsion: "wind",
      windSpeed: 15, oarSpeed: 0, maneuverability: "average",
      sectionHp: 40, hardness: 5, overallAC: -3, sectionAC: 3,
      riggingHp: 60, riggingAC: 1, ramDamage: "8d6", totalSections: 27,
      lengthFt: 90, widthFt: 30, heightFt: 10, draftFt: 10,
      crew: 20, rowers: 0, maxPassengers: 30, cargoTons: 30, cargoLbs: 60000,
      weaponMounts: [],
      hasRammingProw: false,
      costGp: 30000,
      special: ["luxury", "opulent-staterooms"],
      coverFromDeck: "one-half",
      canOceanVoyage: true,
    }),
];

// ── LARGER VESSELS (100+ ft — PCs are passengers or officers) ───────────────

export const LARGER_VESSELS: Ship[] = [
  ship("galley", "Galley", "Colossal", "larger",
    "A massive oar-and-sail warship with flat deck space for siege weapons and troop berths. War galleys convert cargo space into soldier quarters. Eight to ten launches serve as lifeboats.",
    {
      propulsion: "oars_and_wind",
      windSpeed: 15, oarSpeed: 20, maneuverability: "average",
      sectionHp: 80, hardness: 5, overallAC: -3, sectionAC: 3,
      riggingHp: 160, riggingAC: 1, ramDamage: "18d6", totalSections: 26,
      lengthFt: 130, widthFt: 20, heightFt: 20, draftFt: 15,
      crew: 200, rowers: 160, maxPassengers: 100, cargoTons: 150, cargoLbs: 300000,
      cargoSpeedPenalty: { thresholdTons: 75, windReduction: 5, oarReduction: 5 },
      weaponMounts: [
        { type: "heavy_catapult", count: 3 },
        { type: "ballista", count: 6 },
      ],
      hasRammingProw: false,
      costGp: 30000,
      special: ["troop-berths"],
      coverFromDeck: "one-half",
      canOceanVoyage: true,
    }),

  ship("warship", "Warship", "Colossal", "larger",
    "A purpose-built war vessel with a reinforced ramming prow, heavy catapult mountings, and berths for 160 marines. Four launches serve as lifeboats and troop transports. The iron fist of any naval fleet.",
    {
      propulsion: "oars_and_wind",
      windSpeed: 15, oarSpeed: 20, maneuverability: "good",
      sectionHp: 100, hardness: 5, overallAC: -3, sectionAC: 3,
      riggingHp: 80, riggingAC: 1, ramDamage: "15d6", totalSections: 20,
      lengthFt: 100, widthFt: 20, heightFt: 20, draftFt: 15,
      crew: 260, rowers: 80, maxPassengers: 160, cargoTons: 5, cargoLbs: 10000,
      weaponMounts: [
        { type: "heavy_catapult", count: 2 },
        { type: "ballista", count: 4 },
      ],
      hasRammingProw: true,
      costGp: 25000,
      special: ["ramming-prow", "marine-berths"],
      coverFromDeck: "one-half",
      canOceanVoyage: true,
    }),

  ship("ironclad", "Ironclad", "Colossal", "larger",
    "A dwarven iron-plated warship that sits low in the water and bristles with ballistas. Iron shutters protect the ballista crews. Rowing dwarves turn giant cranks to propel the vessel. Rightly feared by naval commanders.",
    {
      propulsion: "oars",
      windSpeed: 0, oarSpeed: 10, maneuverability: "average",
      sectionHp: 60, hardness: 10, overallAC: -3, sectionAC: 3,
      riggingHp: 0, riggingAC: 0, ramDamage: "20d6", totalSections: 24,
      lengthFt: 80, widthFt: 30, heightFt: 15, draftFt: 20,
      crew: 80, rowers: 60, maxPassengers: 20, cargoTons: 1, cargoLbs: 2000,
      weaponMounts: [{ type: "ballista", count: 8 }],
      hasRammingProw: true,
      costGp: 30000,
      special: ["iron-plated", "hardness-10-iron-sections", "ballista-shutters"],
      coverFromDeck: "three-quarters",
      canOceanVoyage: true,
    }),

  ship("gnome_submersible", "Gnome Submersible", "Colossal", "larger",
    "A fully enclosed vessel that can travel the ocean depths. Air bladders allow 24 hours underwater before surfacing for 30 minutes. Large screws cranked by gnome teams propel it. A marvel of engineering — and a terrifying weapon.",
    {
      propulsion: "mechanical",
      windSpeed: 0, oarSpeed: 10, maneuverability: "poor",
      sectionHp: 90, hardness: 8, overallAC: -3, sectionAC: 3,
      riggingHp: 0, riggingAC: 0, ramDamage: "6d6", totalSections: 14,
      lengthFt: 70, widthFt: 20, heightFt: 10, draftFt: 10,
      crew: 70, rowers: 60, maxPassengers: 10, cargoTons: 20, cargoLbs: 40000,
      cargoSpeedPenalty: { thresholdTons: 10, windReduction: 0, oarReduction: 5 },
      weaponMounts: [],
      hasRammingProw: false,
      costGp: 80000,
      special: ["submersible", "24h-underwater", "fully-enclosed"],
      coverFromDeck: "total",
      canOceanVoyage: true,
    }),
];

// ── All Ships ───────────────────────────────────────────────────────────────

export const ALL_SHIPS: Ship[] = [...SMALLER_VESSELS, ...LARGER_VESSELS];

// ── Lookup ──────────────────────────────────────────────────────────────────

const shipMap = new Map<string, Ship>();
for (const s of ALL_SHIPS) shipMap.set(s.id, s);

/** Look up a ship by ID */
export function getShip(id: string): Ship | undefined {
  return shipMap.get(id);
}

/** Ships available for purchase at a port (filtered by port size) */
export function shipsForSale(portSize: "small" | "medium" | "large"): Ship[] {
  switch (portSize) {
    case "small":
      // Small fishing villages: rowboats, rafts, launches
      return ALL_SHIPS.filter(s => s.costGp <= 1000);
    case "medium":
      // Coastal towns: up to sailing ships and longships
      return ALL_SHIPS.filter(s => s.costGp <= 10000);
    case "large":
      // Major ports like Kardov's Gate: everything
      return ALL_SHIPS;
  }
}

// ── Ship Travel Speed ───────────────────────────────────────────────────────
// Convert ship speed (ft/round) to hours per hex on the world map.
// World map: 1 hex ≈ 6 miles. Ships travel faster than walking.
// Base walking: 8 hours/hex (speed 30ft).  Ship speed scales linearly.
//
// Wind multiplier: calm ×0.5, light ×1, moderate ×2, heavy ×3, gale ×4
// Moderate wind is the default (×2).

export type WindCondition = "calm" | "light" | "moderate" | "heavy" | "gale";

const WIND_MULTIPLIERS: Record<WindCondition, number> = {
  calm: 0.5,
  light: 1,
  moderate: 2,
  heavy: 3,
  gale: 4,
};

/** Get effective ship speed in ft given wind conditions */
export function effectiveShipSpeed(ship: Ship, wind: WindCondition, usingOars: boolean): number {
  const windMult = WIND_MULTIPLIERS[wind];
  const sailSpeed = ship.windSpeed > 0 ? ship.windSpeed * windMult : 0;
  const oarSpd = usingOars ? ship.oarSpeed : 0;
  // Ships with both use the better option
  return Math.max(sailSpeed, oarSpd);
}

/** Hours to cross one water hex (6 miles). Walking pace = 8h at speed 30. */
export function hoursPerWaterHex(speed: number): number {
  if (speed <= 0) return Infinity;
  // Speed 30 = 8 hours/hex (walking baseline). Ships scale proportionally.
  return Math.max(1, Math.round((30 / speed) * 8));
}

// ── Ship Repair ─────────────────────────────────────────────────────────────
// D&D 3.5 A&E Guide: A shipwright can repair 10 gp worth of damage per day.
// Repair cost = (destroyed sections / total sections) × (ship cost / 2).

/** Repair cost in gp for a damaged ship */
export function repairCostGp(ship: Ship, owned: OwnedShip): number {
  const damageFraction = 1 - (owned.currentHp / owned.maxHp);
  return Math.ceil(damageFraction * ship.costGp * 0.5);
}

/** Days to repair at a shipyard (10 gp of work per shipwright per day) */
export function repairDays(costGp: number, shipwrights: number = 1): number {
  if (costGp <= 0) return 0;
  return Math.ceil(costGp / (10 * shipwrights));
}

// ── Create an OwnedShip ─────────────────────────────────────────────────────

/** Create a new owned ship from a ship template */
export function purchaseShip(shipId: string, playerName: string, dockedHex: { q: number; r: number }): OwnedShip | null {
  const template = getShip(shipId);
  if (!template) return null;
  const totalHp = template.sectionHp * template.totalSections;
  return {
    shipId,
    name: playerName,
    currentHp: totalHp,
    maxHp: totalHp,
    riggingHp: template.riggingHp,
    maxRiggingHp: template.riggingHp,
    dockedAt: dockedHex,
    crewAssigned: [],
    cargo: [],
    damaged: false,
  };
}
