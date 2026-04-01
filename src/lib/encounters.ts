// Tales of Tasern — Zone-based encounter system
// Maps hex coordinates to level zones and provides encounter generation.

import { pickEncounterGroup, type Monster } from "./monsters";
import { rollLootDrop, getTerrainLootFlavor, type LootItem } from "./loot";

// ── Zone Definitions ────────────────────────────────────────────────────────
// Each zone maps a set of hex coordinates to a level range.
// Monsters and loot scale to the zone's level range.

export type LevelZone = {
  id: string;
  name: string;
  levelRange: [number, number];
  hexes: Set<string>;  // "q,r" keys
};

/** Helper: generate hex keys for row q across columns rStart..rEnd */
function hr(q: number, rStart: number, rEnd: number): string[] {
  const a: string[] = [];
  for (let r = rStart; r <= rEnd; r++) a.push(`${q},${r}`);
  return a;
}

// CR ranges per zone — maps level range to appropriate monster CRs
function crRange(levelRange: [number, number]): [number, number] {
  const [, hi] = levelRange;
  if (hi <= 3) return [0.25, 2];    // levels 1-3: CR 1/4 to CR 2
  if (hi <= 5) return [1, 3];       // levels 3-5: CR 1 to CR 3
  if (hi <= 8) return [2, 5];       // levels 5-8: CR 2 to CR 5
  return [3, 8];                     // levels 8+: CR 3 to CR 8
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEVEL 1-3 ZONES — Starter areas near Kardov's Gate
// ══════════════════════════════════════════════════════════════════════════════

const KARDOVS_OUTSKIRTS_KEYS = [
  "36,32","35,33","34,33","33,33","35,32","34,32","34,31","33,31",
  "33,32","32,32","32,31","31,31","31,30","30,31","30,30","30,29",
  "30,28","29,27","30,27","31,26","31,27","31,28","32,28","32,29",
  "31,29","32,30","33,30","34,30","33,29","34,28","33,28","33,27",
  "32,27","32,26","33,26",
  "34,34","35,34","36,34","35,35","34,35",
];

const KINGS_ROAD_KEYS = ["25,32","29,30","30,30"];

const FARMLAND_KEYS = [
  "26,29","26,34","26,35",
  "27,33","27,34","27,35","27,36",
  "28,32","28,36","28,37",
  "29,27","29,33","29,34","29,36","29,37",
  ...hr(30, 27, 29),"30,32","30,33",...hr(30, 35, 37),
  "31,26","31,28","31,31",...hr(31, 35, 38),
  "32,26","32,29","32,30","32,36",
  "33,26","33,27","33,30","33,33",
  "34,28","34,30","34,35",
];

const FARM_DIRT_ROAD_KEYS = [
  ...hr(28, 33, 35),
  "29,32","29,35","30,34",
  "31,27","31,34",
  "32,27","32,28","33,28","33,29",
  "34,33","34,34",
  "35,29",...hr(35, 33, 35),"36,28",
];

const CITY_DIRT_ROAD_KEYS = ["31,29","31,30","35,30","35,31"];
const GATE_ROAD_KEYS = ["25,28"];
const GOBLIN_HILLS_KEYS = ["32,31"];

// ══════════════════════════════════════════════════════════════════════════════
//  LEVEL 3-5 ZONES — Outer regions, forest edges, marshes
// ══════════════════════════════════════════════════════════════════════════════

const OUTER_FARMLANDS_KEYS = [
  "29,30","29,31","30,32","30,33","31,34","31,35","32,36","31,37",
  "31,38","30,37","29,37","30,36","31,36","30,35","29,36","28,36",
  "27,35","27,34","26,35","29,35","28,35","30,34","29,34","29,33",
  "29,32","28,33","28,34","27,33","28,32","28,31","28,30","27,30",
  "27,31","27,32","26,31","26,33","25,33","26,32","26,34","26,29",
];

const THORNWOOD_KEYS = ["35,19"];
const CROSSROADS_KEYS = ["27,22"];
const EAST_FIELDS_KEYS = ["35,37"];
const SOUTH_ROAD_KEYS = ["26,39"];
const FOREST_DIRT_ROAD_KEYS = ["24,33","24,34"];
const FARM_FIELDS_KEYS = ["28,40"];

const SALT_WATER_MARSH_KEYS = [
  "25,29","25,30","26,27","26,28","27,27","27,28",
  "28,25","28,27","28,28","29,25","29,26",
  "30,23","30,24","31,23","31,24","32,23","32,24",
  "33,25","34,25",
];

const CORAL_RIVER_KEYS = [
  "17,29","18,30","19,30","19,31","20,32","20,33",
  "22,31","23,31","24,31","25,31","26,30","27,29","28,29","29,28",
  "30,25","30,26","31,25","32,25",
  "34,26","34,27","34,29","34,31","35,28","35,32",
];

// ══════════════════════════════════════════════════════════════════════════════
//  LEVEL 5-8 ZONES — Deep wilderness, mountains, swamps, desert
// ══════════════════════════════════════════════════════════════════════════════

const DEEP_WOOD_KEYS = ["18,26"];
const IRON_CRAG_KEYS = ["11,23"];
const WEST_CLIFFS_KEYS = ["9,20"];
const SUN_WASTES_KEYS = ["23,8"];
const SCORCHED_RIDGE_KEYS = ["32,10"];
const BLACK_MIRE_KEYS = ["15,40"];
const WITCHS_BOG_KEYS = ["18,37"];
const MUSHROOM_GROVE_KEYS = ["15,14"];
const DESERT_CAMP_KEYS = ["19,11"];

const GIANT_FOREST_KEYS = [
  "3,22","3,23","3,24","3,27","3,29","3,31","3,33",
  "4,17",...hr(4, 21, 33),
  ...hr(5, 17, 33),
  ...hr(6, 16, 35),
  ...hr(7, 18, 37),
  ...hr(8, 18, 28),...hr(8, 32, 36),
  ...hr(9, 21, 28),...hr(9, 31, 37),
  ...hr(10, 20, 26),"10,29","10,30",...hr(10, 32, 37),
  ...hr(11, 20, 22),"11,24","11,25",...hr(11, 29, 33),...hr(11, 35, 39),
  ...hr(12, 20, 24),...hr(12, 27, 39),
  "13,21","13,22",...hr(13, 27, 39),
  "14,20",...hr(14, 28, 35),...hr(14, 37, 39),
  ...hr(15, 30, 39),
  ...hr(16, 30, 41),
  "17,30","17,31",...hr(17, 35, 40),
  "18,31","18,32","18,35","18,36",...hr(18, 38, 40),
  ...hr(19, 32, 37),"19,39","19,40",
  ...hr(20, 34, 40),
  ...hr(21, 33, 36),"21,38","21,39",
  ...hr(22, 32, 40),
  ...hr(23, 32, 40),
  "24,32",...hr(24, 35, 39),
  ...hr(25, 36, 39),
  "26,38","27,38","27,39","28,39",
  "34,37","34,39","35,36","35,38","36,36",
];

const DESERT_KEYS = [
  "5,13","6,13","6,14",
  ...hr(7, 8, 15),
  ...hr(8, 8, 15),
  ...hr(9, 7, 15),
  ...hr(10, 7, 16),
  ...hr(11, 7, 16),
  ...hr(12, 7, 16),
  ...hr(13, 7, 14),
  ...hr(14, 7, 14),
  ...hr(15, 7, 11),
  ...hr(16, 7, 14),
  ...hr(17, 8, 14),
  ...hr(18, 8, 14),
  ...hr(19, 8, 15),
  ...hr(20, 8, 15),
  ...hr(21, 8, 12),
  ...hr(22, 8, 12),
  ...hr(23, 9, 11),
  ...hr(24, 8, 10),
  "25,8",
];

const BLACK_SWAMPS_KEYS = [
  "22,15",
  ...hr(23, 15, 20),
  ...hr(24, 13, 17),"24,20",
  ...hr(25, 9, 11),...hr(25, 13, 20),
  ...hr(26, 9, 18),
  ...hr(27, 10, 17),
  ...hr(28, 10, 16),
  ...hr(29, 11, 17),
  "30,12",...hr(30, 14, 18),
  "31,12","31,18",
];

const SHORELINE_PEAKS_KEYS = [
  ...hr(2, 21, 31),"2,33",
  ...hr(3, 13, 15),"3,17","3,19","3,21","3,25","3,26","3,32","3,34",
  "4,13","4,16","4,18","4,20","4,34",
  "5,12","5,34","5,35",
  ...hr(6, 7, 12),...hr(6, 36, 37),
  "7,7","7,38",
  "8,7",...hr(8, 38, 41),
  "9,6","9,38","9,42",
  "10,6","10,42","11,6","11,42",
  "12,6","12,41","12,42","13,6","13,41",
  "14,6","14,42","15,6","15,42","16,6","16,42",
  "17,6","17,7","17,42","17,43",
  "18,6","18,7",...hr(18, 42, 44),
  "19,7","19,42","20,7","20,41","20,42",
  "21,7","21,41","22,7","22,41",
  "23,6","23,7","23,42","23,43",
  "24,6","24,7",...hr(24, 44, 45),
  "25,7",...hr(25, 44, 46),
  "26,8",...hr(26, 46, 47),
  "27,8","27,9","27,46","28,9","28,46",
  "29,10","29,46","30,10","30,11","30,45","30,46",
  "31,11",...hr(31, 15, 17),...hr(31, 43, 46),
  ...hr(32, 12, 14),"32,16","32,17","32,42","32,44",
  ...hr(33, 17, 19),"33,42",
  ...hr(34, 18, 23),"34,41","34,42",
  ...hr(35, 20, 25),"35,39","35,40","35,42",
  "36,24","36,25","36,27","36,37","36,38",
  ...hr(37, 26, 30),"37,36","38,28",
];

// ══════════════════════════════════════════════════════════════════════════════
//  LEVEL 8+ ZONES — Endgame areas
// ══════════════════════════════════════════════════════════════════════════════

const MAGIC_LAKE_KEYS = [
  "25,34","25,35","26,36","26,37","27,37","28,38",
  "29,38","29,39","30,31","30,38","30,39",
  "31,32","31,33","31,39",
  ...hr(32, 33, 35),...hr(32, 37, 40),
  ...hr(33, 34, 39),
  "34,36","34,38",
];

const EAST_SHORE_KEYS = ["39,26"];

// ── Zone Objects ────────────────────────────────────────────────────────────

// Level 1-3
const Z_KARDOVS_OUTSKIRTS: LevelZone = { id: "kardovs-outskirts", name: "Kardov's Outskirts", levelRange: [1, 3], hexes: new Set(KARDOVS_OUTSKIRTS_KEYS) };
const Z_KINGS_ROAD: LevelZone = { id: "kings-road", name: "King's Road", levelRange: [1, 3], hexes: new Set(KINGS_ROAD_KEYS) };
const Z_FARMLAND: LevelZone = { id: "farmland", name: "Farmland", levelRange: [1, 3], hexes: new Set(FARMLAND_KEYS) };
const Z_FARM_DIRT_ROAD: LevelZone = { id: "farm-dirt-road", name: "Farm Dirt Road", levelRange: [1, 3], hexes: new Set(FARM_DIRT_ROAD_KEYS) };
const Z_CITY_DIRT_ROAD: LevelZone = { id: "city-dirt-road", name: "City Dirt Road", levelRange: [1, 3], hexes: new Set(CITY_DIRT_ROAD_KEYS) };
const Z_GATE_ROAD: LevelZone = { id: "gate-road", name: "Gate Road", levelRange: [1, 3], hexes: new Set(GATE_ROAD_KEYS) };
const Z_GOBLIN_HILLS: LevelZone = { id: "goblin-hills", name: "Goblin Hills", levelRange: [1, 3], hexes: new Set(GOBLIN_HILLS_KEYS) };

// Level 3-5
const Z_OUTER_FARMLANDS: LevelZone = { id: "outer-farmlands", name: "Outer Farmlands", levelRange: [3, 5], hexes: new Set(OUTER_FARMLANDS_KEYS) };
const Z_THORNWOOD: LevelZone = { id: "thornwood", name: "Thornwood", levelRange: [3, 5], hexes: new Set(THORNWOOD_KEYS) };
const Z_CROSSROADS: LevelZone = { id: "crossroads", name: "Crossroads", levelRange: [3, 5], hexes: new Set(CROSSROADS_KEYS) };
const Z_EAST_FIELDS: LevelZone = { id: "east-fields", name: "East Fields", levelRange: [3, 5], hexes: new Set(EAST_FIELDS_KEYS) };
const Z_SOUTH_ROAD: LevelZone = { id: "south-road", name: "South Road", levelRange: [3, 5], hexes: new Set(SOUTH_ROAD_KEYS) };
const Z_FOREST_DIRT_ROAD: LevelZone = { id: "forest-dirt-road", name: "Forest Dirt Road", levelRange: [3, 5], hexes: new Set(FOREST_DIRT_ROAD_KEYS) };
const Z_FARM_FIELDS: LevelZone = { id: "farm-fields", name: "Farm Fields", levelRange: [3, 5], hexes: new Set(FARM_FIELDS_KEYS) };
const Z_SALT_WATER_MARSH: LevelZone = { id: "salt-water-marsh", name: "Salt Water Marsh", levelRange: [3, 5], hexes: new Set(SALT_WATER_MARSH_KEYS) };
const Z_CORAL_RIVER: LevelZone = { id: "coral-river", name: "Coral River", levelRange: [3, 5], hexes: new Set(CORAL_RIVER_KEYS) };

// Level 5-8
const Z_DEEP_WOOD: LevelZone = { id: "deep-wood", name: "Deep Wood", levelRange: [5, 8], hexes: new Set(DEEP_WOOD_KEYS) };
const Z_IRON_CRAG: LevelZone = { id: "iron-crag", name: "Iron Crag", levelRange: [5, 8], hexes: new Set(IRON_CRAG_KEYS) };
const Z_WEST_CLIFFS: LevelZone = { id: "west-cliffs", name: "West Cliffs", levelRange: [5, 8], hexes: new Set(WEST_CLIFFS_KEYS) };
const Z_SUN_WASTES: LevelZone = { id: "sun-wastes", name: "Sun Wastes", levelRange: [5, 8], hexes: new Set(SUN_WASTES_KEYS) };
const Z_SCORCHED_RIDGE: LevelZone = { id: "scorched-ridge", name: "Scorched Ridge", levelRange: [5, 8], hexes: new Set(SCORCHED_RIDGE_KEYS) };
const Z_DESERT_CAMP: LevelZone = { id: "desert-camp", name: "Desert Camp", levelRange: [5, 8], hexes: new Set(DESERT_CAMP_KEYS) };
const Z_BLACK_MIRE: LevelZone = { id: "black-mire", name: "Black Mire", levelRange: [5, 8], hexes: new Set(BLACK_MIRE_KEYS) };
const Z_WITCHS_BOG: LevelZone = { id: "witchs-bog", name: "Witch's Bog", levelRange: [5, 8], hexes: new Set(WITCHS_BOG_KEYS) };
const Z_MUSHROOM_GROVE: LevelZone = { id: "mushroom-grove", name: "Mushroom Grove", levelRange: [5, 8], hexes: new Set(MUSHROOM_GROVE_KEYS) };
const Z_GIANT_FOREST: LevelZone = { id: "giant-forest", name: "Giant Forest", levelRange: [5, 8], hexes: new Set(GIANT_FOREST_KEYS) };
const Z_DESERT: LevelZone = { id: "desert", name: "Desert", levelRange: [5, 8], hexes: new Set(DESERT_KEYS) };
const Z_BLACK_SWAMPS: LevelZone = { id: "black-swamps", name: "Black Swamps", levelRange: [5, 8], hexes: new Set(BLACK_SWAMPS_KEYS) };
const Z_SHORELINE_PEAKS: LevelZone = { id: "shoreline-peaks", name: "Shoreline Peaks", levelRange: [5, 8], hexes: new Set(SHORELINE_PEAKS_KEYS) };

// Level 8+
const Z_MAGIC_LAKE: LevelZone = { id: "magic-lake", name: "Magic Lake", levelRange: [8, 12], hexes: new Set(MAGIC_LAKE_KEYS) };
const Z_EAST_SHORE: LevelZone = { id: "east-shore", name: "East Shore", levelRange: [8, 12], hexes: new Set(EAST_SHORE_KEYS) };

// Zone lookup order: specific/small zones first, large terrain zones last.
// First match wins, so near-city zones override large area zones for shared hexes.
export const LEVEL_ZONES: LevelZone[] = [
  // Level 1-3 (near Kardov's Gate)
  Z_KARDOVS_OUTSKIRTS, Z_KINGS_ROAD, Z_FARMLAND, Z_FARM_DIRT_ROAD,
  Z_CITY_DIRT_ROAD, Z_GATE_ROAD, Z_GOBLIN_HILLS,
  // Level 3-5
  Z_OUTER_FARMLANDS, Z_THORNWOOD, Z_CROSSROADS, Z_EAST_FIELDS,
  Z_SOUTH_ROAD, Z_FOREST_DIRT_ROAD, Z_FARM_FIELDS,
  Z_SALT_WATER_MARSH, Z_CORAL_RIVER,
  // Level 5-8 (specific POIs first, then large terrain)
  Z_DEEP_WOOD, Z_IRON_CRAG, Z_WEST_CLIFFS, Z_SUN_WASTES,
  Z_SCORCHED_RIDGE, Z_DESERT_CAMP, Z_BLACK_MIRE, Z_WITCHS_BOG,
  Z_MUSHROOM_GROVE,
  Z_GIANT_FOREST, Z_DESERT, Z_BLACK_SWAMPS, Z_SHORELINE_PEAKS,
  // Level 8+
  Z_MAGIC_LAKE, Z_EAST_SHORE,
];

// ── Lookup ──────────────────────────────────────────────────────────────────

/** Get the level zone for a hex, or null if not in any zone (default to distance-based) */
export function getZone(q: number, r: number): LevelZone | null {
  const key = `${q},${r}`;
  for (const zone of LEVEL_ZONES) {
    if (zone.hexes.has(key)) return zone;
  }
  return null;
}

/** Get the level range for a hex. Falls back to distance-based scaling. */
export function getLevelRange(q: number, r: number, distFromCity: number): [number, number] {
  const zone = getZone(q, r);
  if (zone) return zone.levelRange;
  // Fallback: scale by distance from Kardov's Gate
  if (distFromCity <= 8) return [1, 3];
  if (distFromCity <= 16) return [3, 5];
  if (distFromCity <= 24) return [5, 8];
  return [8, 12];
}

// ── Encounter Generation ────────────────────────────────────────────────────

export type EncounterData = {
  monsters: { monster: Monster; count: number }[];
  difficulty: "easy" | "medium" | "hard";
  description: string;
};

/** Generate a fight encounter appropriate for the zone and terrain */
export function generateFightEncounter(
  terrain: string,
  levelRange: [number, number],
  difficulty: "easy" | "medium" | "hard",
): EncounterData {
  const [minCR, maxCR] = crRange(levelRange);

  // Adjust CR range by difficulty
  let adjMin = minCR;
  let adjMax = maxCR;
  if (difficulty === "easy") {
    adjMax = Math.max(minCR, maxCR - 1);
  } else if (difficulty === "hard") {
    adjMin = Math.max(minCR, maxCR - 1);
  }

  const group = pickEncounterGroup(terrain, adjMin, adjMax);
  const monster = group.monsters[0];

  const desc = group.count > 1
    ? `${group.count} ${monster.name}s attack! ${monster.description}`
    : `A ${monster.name} attacks! ${monster.description}`;

  return {
    monsters: [{ monster, count: group.count }],
    difficulty,
    description: desc,
  };
}

// ── Loot Generation ─────────────────────────────────────────────────────────

export type LootDrop = {
  items: LootItem[];
  flavor: string;
  totalValue: number;
};

/** Generate loot for a find event */
export function generateLootDrop(
  terrain: string,
  levelRange: [number, number],
  outcome: "minor_find" | "major_find",
): LootDrop {
  const tier = outcome === "minor_find" ? "minor" : "major";
  const items = rollLootDrop(levelRange, outcome);
  const flavor = getTerrainLootFlavor(terrain, tier);
  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  return { items, flavor, totalValue };
}
