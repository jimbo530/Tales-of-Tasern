// Tales of Tasern — Zone-based encounter system
// Maps hex coordinates to level zones and provides encounter generation.

import { MONSTERS, pickEncounterGroup, type Monster } from "./monsters";
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
  if (hi <= 3) return [0.25, 1];    // levels 1-3: CR 1/4 to CR 1 (starter-friendly)
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
  difficulty: "easy" | "medium" | "hard" | "deadly";
  description: string;
  crBoost?: number;
  classLevels?: string;
};

// ── Random Encounter Tables ──────────────────────────────────────────────────
// Each zone has EASY (world roll 2-3), HARD (world roll 1), and GOOD tables.
// Undead are dungeon-only — never appear on the surface around Kardov's Gate.
// Weight is relative — a weight-3 entry is 3× as likely as weight-1.

type EncounterTableEntry = {
  weight: number;
  monsterIds: string[];       // monster id(s) — first is main
  count: number | [number, number];  // fixed or [min, max]
  flavor: string;             // thematic description
};

export type GoodEncounterEntry = {
  weight: number;
  description: string;
  foodChange?: number;
  goldCp?: number;      // reward in copper pieces
  hpChange?: number;
  xpChange?: number;
  fameChange?: number;
};

function rollTable<T extends { weight: number }>(table: T[]): T {
  const totalWeight = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return table[table.length - 1];
}

function resolveCount(c: number | [number, number]): number {
  if (typeof c === "number") return c;
  return c[0] + Math.floor(Math.random() * (c[1] - c[0] + 1));
}

// ══════════════════════════════════════════════════════════════════════════════
//  FARMLAND — Kardov's Outskirts & surrounding farms (Level 1-3)
// ══════════════════════════════════════════════════════════════════════════════

const FARM_EASY: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["dire_rat"],          count: [2, 3], flavor: "Dire rats scurry from a drainage ditch, hissing and baring filthy teeth." },
  { weight: 3, monsterIds: ["giant_fire_beetle"],  count: [1, 2], flavor: "A pair of glowing beetles waddle out of a plowed furrow, clicking irritably." },
  { weight: 3, monsterIds: ["stirge"],             count: [1, 2], flavor: "A stirge darts from a barn rafter, proboscis extended. Just one — but it's fast." },
  { weight: 2, monsterIds: ["giant_ant_worker"],   count: [1, 2], flavor: "Worker ants the size of dogs emerge from a collapsed burrow near the fence line." },
  { weight: 2, monsterIds: ["giant_bee"],          count: 1,      flavor: "A lone giant bee, agitated by the harvest smoke, buzzes angrily toward you." },
  { weight: 1, monsterIds: ["badger"],             count: 1,      flavor: "A badger defending its burrow — small, furious, and surprisingly tough." },
];

const FARM_HARD: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],             count: [3, 5], flavor: "A goblin raiding party from the hills! They've set a farmhouse ablaze for cover." },
  { weight: 3, monsterIds: ["wolf"],               count: [2, 3], flavor: "Wolves — a whole pack. They've been killing livestock for weeks and now they want more." },
  { weight: 3, monsterIds: ["stirge"],             count: [3, 5], flavor: "A whirring swarm of stirges erupts from a collapsed barn. Blood-mad and relentless." },
  { weight: 2, monsterIds: ["orc"],                count: [1, 2], flavor: "Orcs! Deserters from a warband, desperate enough to raid this close to the city." },
  { weight: 2, monsterIds: ["giant_ant_worker"],   count: [3, 4], flavor: "A giant ant column — the whole nest is on the move. You're standing on their trail." },
  { weight: 1, monsterIds: ["gnoll"],              count: [1, 2], flavor: "Gnolls raiding a farmstead. They've already butchered the animals — now they see you." },
];

const FARM_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "A grateful farmer offers you a meal and fresh provisions for the road.", foodChange: 2 },
  { weight: 3, description: "You find a basket of vegetables left by the road — someone's forgotten haul.", foodChange: 1 },
  { weight: 3, description: "An old farmhand points out a shortcut through the hedgerows. 'Faster and safer,' he says.", xpChange: 5 },
  { weight: 2, description: "A farmer's wife presses a few coins into your hand. 'For dealing with those goblins last week — word travels.'", goldCp: 30 },
  { weight: 2, description: "Wild herbs grow thick along the fence line — feverfew, comfrey, yarrow. You gather what you can.", foodChange: 1, xpChange: 3 },
  { weight: 2, description: "A merchant's wagon has thrown a wheel. You help push it free and he shares his lunch.", foodChange: 2, xpChange: 5 },
  { weight: 1, description: "An apple orchard in full fruit. You fill your pack with as much as you can carry.", foodChange: 3 },
  { weight: 1, description: "A farmer hires you to help move hay bales. Easy work, honest coin.", goldCp: 50, xpChange: 5 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  ROADS — King's Road, farm dirt roads, gate road (Level 1-3)
// ══════════════════════════════════════════════════════════════════════════════

const ROAD_EASY: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],             count: [1, 3], flavor: "Goblins crouching behind a fallen log — the worst ambush you've ever seen." },
  { weight: 3, monsterIds: ["dire_rat"],           count: [2, 3], flavor: "Dire rats swarm from a collapsed culvert, startled by your footsteps." },
  { weight: 2, monsterIds: ["kobold"],             count: [2, 4], flavor: "Kobolds with slings, lurking in a ditch. They spring the trap too early." },
  { weight: 2, monsterIds: ["giant_fire_beetle"],  count: [1, 2], flavor: "Beetles with glowing abdomens wander onto the road from the brush." },
  { weight: 1, monsterIds: ["stirge"],             count: [1, 2], flavor: "A stirge drops from a roadside tree, drawn by the warmth of your blood." },
];

const ROAD_HARD: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],     count: [4, 6], flavor: "A proper goblin ambush — ropes across the road, archers in the trees." },
  { weight: 3, monsterIds: ["orc"],        count: [2, 3], flavor: "Orc raiders block the road. They've been hitting caravans all week." },
  { weight: 3, monsterIds: ["hobgoblin"],  count: [2, 3], flavor: "Hobgoblin soldiers in formation. A roadblock with military precision." },
  { weight: 2, monsterIds: ["gnoll"],      count: [2, 3], flavor: "A gnoll hunting party — they've dragged something across the road as bait." },
  { weight: 2, monsterIds: ["wolf"],       count: [3, 4], flavor: "A large wolf pack. They've learned that travelers on this road carry food." },
  { weight: 1, monsterIds: ["bugbear"],    count: 1,      flavor: "A bugbear drops from the rocks above the road. It's been picking off lone travelers." },
];

const ROAD_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "A passing merchant tosses you a waterskin. 'Safe travels, friend.'", foodChange: 1 },
  { weight: 3, description: "A patrol of Kardov's Gate guards nods as they pass. The road feels safer.", xpChange: 3 },
  { weight: 3, description: "You find a coin purse in the mud — someone dropped it in a hurry.", goldCp: 25 },
  { weight: 2, description: "A traveling tinker offers to mend your gear for free. 'You look like you need it.'", xpChange: 5 },
  { weight: 2, description: "A milestone marker — you're making better time than expected. The shortcut worked.", xpChange: 5 },
  { weight: 2, description: "A caravan guard shares dried meat and road gossip. 'Watch out past the bridge — goblins.'", foodChange: 1, xpChange: 3 },
  { weight: 1, description: "An overturned cart on the roadside. The owner is long gone, but some goods remain.", goldCp: 40, foodChange: 1 },
  { weight: 1, description: "A traveling priest blesses your journey. You feel refreshed.", hpChange: 2, xpChange: 3 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  TOWN — Kardov's Gate city streets (Level 1-3)
//  Single d20 chart. The city is busy and fairly safe — bad stuff only on 1-2.
//  Thugs are handled separately in rollWorldLuck (not in this table).
//  This table is for non-thug city encounters only.
// ══════════════════════════════════════════════════════════════════════════════

// Bad (fights) — only roll 1-2
const TOWN_EASY: EncounterTableEntry[] = [
  { weight: 3, monsterIds: ["dire_rat"],  count: [2, 3], flavor: "Sewer rats! Fat and aggressive, pouring from a storm grate near the market." },
  { weight: 2, monsterIds: ["stirge"],    count: [1, 2], flavor: "A stirge swoops from a condemned tenement. The city really should tear that place down." },
];

const TOWN_HARD: EncounterTableEntry[] = [
  { weight: 3, monsterIds: ["dire_rat"],  count: [4, 6], flavor: "The sewers are overflowing! A massive swarm of dire rats floods the street." },
  { weight: 2, monsterIds: ["stirge"],    count: [3, 5], flavor: "A stirge nest in the clock tower — the whole colony descends at dusk." },
];

// Good (rolls 3-20) — the busy city life of Kardov's Gate
const TOWN_GOOD: GoodEncounterEntry[] = [
  // 3-5: Minor lucky breaks
  { weight: 3, description: "A street vendor gives you a sample. 'Tell your friends!' It's actually quite good.", foodChange: 1 },
  { weight: 3, description: "You find a few coppers in the gutter. Someone's loss, your gain.", goldCp: 8 },
  { weight: 3, description: "A city guard nods and waves you through. 'Stay out of the alleys after dark.'", xpChange: 2 },
  // 6-9: City life encounters
  { weight: 3, description: "A dock worker shares news from the harbor. Ships from the south brought spices and rumors.", xpChange: 5 },
  { weight: 3, description: "A fishmonger is closing up and sells the last of his catch cheap.", foodChange: 2, goldCp: -5 },
  { weight: 2, description: "Children chase a runaway chicken through the market. You help catch it — the owner is grateful.", goldCp: 10, xpChange: 3 },
  { weight: 2, description: "A traveling bard plays in the square. You listen and learn a thing or two.", xpChange: 5, fameChange: 1 },
  // 10-13: Moderate fortune
  { weight: 2, description: "A grateful citizen presses coins into your hand. 'For what you did last time — word travels.'", goldCp: 30 },
  { weight: 2, description: "An old sailor buys you an ale and tells tales of the coast. Useful knowledge.", xpChange: 8, foodChange: 1 },
  { weight: 2, description: "A baker's apprentice drops a tray of fresh rolls. He can't sell them now — you split the haul.", foodChange: 2 },
  { weight: 2, description: "A merchant argues with a dock hand over counting. You settle it fairly and both tip you.", goldCp: 25, xpChange: 3 },
  // 14-16: Good luck
  { weight: 1, description: "The public baths are free today — some noble's charity. You feel genuinely refreshed.", hpChange: 3, xpChange: 3 },
  { weight: 1, description: "A noble's servant drops a silver piece and doesn't notice. Your gain.", goldCp: 100 },
  { weight: 1, description: "A temple acolyte offers a free blessing. The warmth lingers.", hpChange: 2, xpChange: 5 },
  // 17-18: Great luck
  { weight: 1, description: "A merchant caravan arrives and prices drop. You stock up on provisions at half cost.", foodChange: 3, goldCp: -15 },
  { weight: 1, description: "An old woman recognizes your faction's colors. 'My son wore those once.' She gives you his old coin purse.", goldCp: 75 },
  // 19-20: Exceptional
  { weight: 1, description: "A drunk nobleman bets you can't arm-wrestle his bodyguard. You win. He pays handsomely and laughs about it.", goldCp: 150, xpChange: 10 },
  { weight: 1, description: "A festival day! Free food, street performers, and the city guard is extra vigilant. The best day in Kardov's Gate.", foodChange: 3, hpChange: 2, xpChange: 10, fameChange: 1 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  KARDOV'S GATE — Layered d20 City System (exported)
//  1st roll (Day's Luck): 1-2 bad guys, 3-19 nothing, 20 good stuff
//  2nd roll (Bad):  1 = killers (fight to death), 2-20 = muggers (can talk down)
//  2nd roll (Good): d20 on KARDOV_GOOD_D20 — varied goods, not just coin
// ══════════════════════════════════════════════════════════════════════════════

export type CityD20Entry = {
  description: string;
  foodChange?: number;
  goldCp?: number;
  hpChange?: number;
  xpChange?: number;
  fameChange?: number;
};

/** Mundane city flavor for rolls 3-19 — nothing eventful, just busy city life. */
export const KARDOV_NOTHING: string[] = [
  "A pickpocket bumps into you near the market. You check your purse — all there. Barely.",
  "You step in something foul near the fish market. The smell clings to your boots all day.",
  "The market is packed shoulder-to-shoulder. You make it through, but it costs you half the morning.",
  "A street preacher shouts dire prophecies about the Iron Maw. The crowd ignores him. So do you.",
  "City guards break up a brawl outside a dockside tavern. You give them a wide berth.",
  "The smell of fresh bread wafts from a bakery. Carts rattle, hawkers shout. Just another day.",
  "A wagon threw an axle on the main road. You detour through the alleys.",
  "Dock workers argue over cargo manifests. Ships from the south brought rumors, nothing more.",
  "Children chase a stray dog through the market, scattering a fishmonger's display. Life in the city.",
  "A merchant insists this rope is 'genuine elven weave.' It's clearly just hemp. You pass.",
  "You find a bench in a temple courtyard. A rare moment of peace in the chaos.",
  "A city crier announces increased patrols near the docks. The High Luminar is cracking down.",
  "A cartwright repairs a broken wheel in the middle of the road. Traffic backs up for an hour.",
  "Sailors sing bawdy songs outside a tavern. The city guard doesn't seem to care.",
  "A funeral procession winds through the streets. You step aside and wait.",
  "Rain clouds gather over the harbor. Everyone hurries indoors. You find an awning.",
  "Two merchants argue loudly over a disputed shipment. Neither notices you.",
  "A cat knocks a clay pot off a windowsill. It shatters at your feet. The owner shrugs.",
  "The temple bells ring the hour. You count them — later than you thought.",
  "A group of sailors haul crates up from the docks. They look exhausted. So does the city.",
];

/** Good encounter sub-table — rolled when Day's Luck = 20.
 *  Varied rewards: food, herbs, healing, information, services, goods. Not just coin. */
export const KARDOV_GOOD_D20: CityD20Entry[] = [
  // 1 — Leftover food
  { description: "A street vendor hands you leftover bread and cheese. 'Can't sell it tomorrow — take it.'", foodChange: 1 },
  // 2 — Herbs
  { description: "Wild herbs grow between the cobblestones near the temple — mint and thyme. You gather what you can.", foodChange: 1 },
  // 3 — Temple healing
  { description: "A temple acolyte offers a free poultice for your scrapes. 'Namaris provides, traveler.'", hpChange: 2 },
  // 4 — Old remedy
  { description: "An old woman shares her grandmother's remedy — warm broth with a bitter herb that numbs the aches.", hpChange: 1, foodChange: 1 },
  // 5 — Useful information
  { description: "A dock worker tips you off about a merchant hiring escorts south. Knowledge that could pay later.", xpChange: 8 },
  // 6 — Cheap fish
  { description: "A fishmonger is closing up shop and practically gives away his last catch. You eat well tonight.", foodChange: 2 },
  // 7 — Healer's blessing
  { description: "A traveling healer in the temple square blesses passersby. The warmth lingers in your bones.", hpChange: 3 },
  // 8 — Trade goods
  { description: "A rope-maker's apprentice gives you a scrap of quality cord and some nails. Worth something in trade.", goldCp: 15 },
  // 9 — Veteran's wisdom
  { description: "A retired soldier shares hard-won knowledge of the roads and trails beyond the gate.", xpChange: 10 },
  // 10 — Baker's accident
  { description: "A baker's tray of rolls tumbles to the cobblestones — can't sell them now. You split the haul.", foodChange: 2 },
  // 11 — Herbalist's gift
  { description: "An herbalist teaching apprentices gives you dried feverfew and comfrey. 'Good for fevers and wounds.'", foodChange: 1, hpChange: 1 },
  // 12 — Priestly healing
  { description: "A traveling priest performs a minor healing in the square. 'No charge — the gods provide.'", hpChange: 3 },
  // 13 — Leather scraps
  { description: "A tanner offers leather scraps — belt material, boot patches, waterproofing. Tradeable.", goldCp: 20 },
  // 14 — Adventurer's tales
  { description: "A retired adventurer buys you ale and shares tales of the wilds. You learn something valuable.", xpChange: 12 },
  // 15 — Shopkeeper's generosity
  { description: "A kind shopkeeper presses candles, flint, and twine into your hands. 'The roads are dark, friend.'", goldCp: 15, xpChange: 3 },
  // 16 — Charity kitchen
  { description: "The charity kitchen has extra portions today — hot stew, fresh bread, and a cup of clean water.", foodChange: 2, hpChange: 1 },
  // 17 — Medicinal plants
  { description: "An herbalist gives you a bundle of yarrow and chamomile. Useful for treating wounds on the road.", foodChange: 1, hpChange: 2 },
  // 18 — Grateful merchant
  { description: "A grateful merchant remembers a past favor. 'Here — for your trouble.' A pouch of mixed coin.", goldCp: 40 },
  // 19 — Festival day!
  { description: "Festival day in Kardov's Gate! Free stew and bread from the stalls, an herbalist handing out dried feverfew, temple healers blessing the crowd, and a bard singing tales of your faction's deeds. The best day the city has to offer.",
    foodChange: 3, hpChange: 3, xpChange: 15, goldCp: 50, fameChange: 1 },
  // 20 — placeholder (social encounter handled in WorldMap.tsx)
  { description: "An interesting encounter unfolds in the city streets..." },
];

// ══════════════════════════════════════════════════════════════════════════════
//  KARDOV'S GATE — Social Encounters (Good d20 sub-roll = 20)
//  Layered: Day's Luck 20 → Good sub-roll 20 → pick one of these
//  Each has preferred skills (lower DC) and a fallback DC for any skill.
// ══════════════════════════════════════════════════════════════════════════════

export type CitySocialEncounter = {
  id: string;
  description: string;
  skillOptions: string[];   // preferred skills — use lower DC
  dc: number;               // DC for preferred skills
  fallbackDc: number;       // DC for any other skill
  successDesc: string;
  failDesc: string;
  // Success rewards
  foodChange?: number;
  goldCp?: number;
  hpChange?: number;
  xpChange?: number;
  fameChange?: number;
  magicItemReward?: boolean;  // pick random uncommon wizard gift
  // Fail consolation
  failXp?: number;
};

export const KARDOV_SOCIAL: CitySocialEncounter[] = [
  {
    id: "drunk_wizard",
    description: "A robed old man stumbles out of a tavern clutching a gnarled staff, muttering half-finished incantations. Sparks flicker from his fingers. He's absolutely hammered. 'The shtairs... the shtreets keep moving...'",
    skillOptions: ["diplomacy", "sense_motive"],
    dc: 10, fallbackDc: 14,
    successDesc: "You guide the wizard safely through the winding streets to his tower. He sobers up enough to rummage through a cluttered trunk. 'For your trouble, friend. And please — don't tell my apprentice about this.'",
    failDesc: "The old wizard waves you off and staggers into an alley. You hear a loud crash, a startled cat, and a puff of green smoke. He's probably fine. Probably.",
    xpChange: 15,
    magicItemReward: true,
    failXp: 5,
  },
  {
    id: "lost_noble_child",
    description: "A well-dressed child — maybe eight years old — stands crying near the dock market, clutching a velvet purse. 'I can't find Ser Davith! He was right here!' Clearly the ward of some noble house, separated from their escort.",
    skillOptions: ["diplomacy", "spot", "search"],
    dc: 10, fallbackDc: 14,
    successDesc: "You find the child's escort — a panicked knight in house livery — three streets over. He practically weeps with relief. The next morning, a servant arrives at your lodging with a heavy coin purse and a note: 'House Veldaren remembers its debts.'",
    failDesc: "You try to help, but the child doesn't trust strangers and runs off before you can find the escort. A city guard steps in eventually. At least the kid is safe.",
    goldCp: 200, xpChange: 10, fameChange: 1,
    failXp: 5,
  },
  {
    id: "wounded_soldier",
    description: "A soldier in battered armor sits against a wall, pressing a bloody cloth to her side. She grits her teeth. 'Bandit ambush on the south road. Patrol's scattered. I just need to get to the garrison...'",
    skillOptions: ["heal", "survival"],
    dc: 8, fallbackDc: 12,
    successDesc: "You bind her wounds and help her to the garrison. The watch-captain thanks you personally and hands over a pouch. The soldier insists you take her trail rations — 'I'll eat hot food tonight, you won't.' She remembers your name.",
    failDesc: "You try to help but her wound needs real attention. A passing healer takes over. She nods thanks as you leave — you did what you could.",
    foodChange: 3, goldCp: 100, xpChange: 10,
    failXp: 5,
  },
  {
    id: "sea_captains_wager",
    description: "A grizzled sea captain holds court at a harborside tavern, a crowd of sailors watching. He slaps a pile of silver on the table. 'I'll wager any traveler here can't beat me at Three-Dragon Ante! Sit down if you've got the nerve.'",
    skillOptions: ["diplomacy", "sense_motive", "perform", "appraise"],
    dc: 12, fallbackDc: 16,
    successDesc: "You play shrewdly — reading his bluffs, pressing your advantages. The old captain laughs and pushes the silver toward you. 'Haven't lost to a landlubber in years! Come find me again — Captain Harsk always pays his debts.' The crowd cheers.",
    failDesc: "The captain is too good. He reads you like a chart and cleans you out of the hand. He buys you a drink afterward. 'Don't feel bad — I've been playing since before you were born.'",
    goldCp: 300, xpChange: 12, fameChange: 1,
    failXp: 3,
  },
];

/** Uncommon magic items a drunk wizard might fish out of a trunk.
 *  Consumables and one-use trinkets — he wouldn't give away permanent gear. */
export const WIZARD_GIFTS: { id: string; name: string; weight: number }[] = [
  { id: "pot_invisibility", name: "Potion of Invisibility", weight: 0.1 },
  { id: "pot_darkvision", name: "Potion of Darkvision", weight: 0.1 },
  { id: "pot_spider_climb", name: "Potion of Spider Climb", weight: 0.1 },
  { id: "pot_blur", name: "Potion of Blur", weight: 0.1 },
  { id: "pot_levitate", name: "Potion of Levitate", weight: 0.1 },
  { id: "pot_foxs_cunning", name: "Potion of Fox's Cunning", weight: 0.1 },
  { id: "pot_owls_wisdom", name: "Potion of Owl's Wisdom", weight: 0.1 },
  { id: "won_feather_token_bird", name: "Feather Token (Bird)", weight: 0 },
  { id: "won_feather_token_whip", name: "Feather Token (Whip)", weight: 0 },
  { id: "won_silversheen", name: "Silversheen", weight: 0 },
  { id: "won_elixir_vision", name: "Elixir of Vision", weight: 0.1 },
  { id: "won_elixir_hiding", name: "Elixir of Hiding", weight: 0.1 },
  { id: "won_dust_tracelessness", name: "Dust of Tracelessness", weight: 0 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  PLAINS — Open grassland near Kardov's Gate (Level 1-3)
// ══════════════════════════════════════════════════════════════════════════════

const PLAINS_EASY: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],             count: [2, 3], flavor: "Goblins foraging in the grass. They see you and fumble for their weapons." },
  { weight: 3, monsterIds: ["giant_fire_beetle"],  count: [2, 3], flavor: "Beetles nesting in a termite mound scatter when you walk too close." },
  { weight: 2, monsterIds: ["giant_ant_worker"],   count: [1, 2], flavor: "A pair of giant ants hauling a dead rabbit. They don't want to share." },
  { weight: 2, monsterIds: ["badger"],             count: 1,      flavor: "You've stepped near a badger den. The occupant disagrees with your path." },
  { weight: 2, monsterIds: ["wolf"],               count: 1,      flavor: "A lone wolf, separated from its pack. Hungry and desperate." },
  { weight: 1, monsterIds: ["giant_bee"],          count: [1, 2], flavor: "Giant bees — you've stumbled near their ground nest." },
];

const PLAINS_HARD: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],    count: [4, 6], flavor: "A full goblin warband on the march. They've seen you — no cover in the open." },
  { weight: 3, monsterIds: ["wolf"],      count: [3, 4], flavor: "A wolf pack in hunting formation. They're flanking you through the tall grass." },
  { weight: 3, monsterIds: ["gnoll"],     count: [2, 3], flavor: "Gnolls! Hyena-headed marauders. They're laughing — they think this will be easy." },
  { weight: 2, monsterIds: ["orc"],       count: [2, 3], flavor: "Orc outriders on foot. Scouts for a larger force — but dangerous enough on their own." },
  { weight: 2, monsterIds: ["hobgoblin"], count: [2, 3], flavor: "A hobgoblin patrol. They're disciplined, armored, and not interested in talking." },
  { weight: 1, monsterIds: ["worg"],      count: [1, 2], flavor: "Worgs — intelligent wolf-like predators. They've been stalking you for an hour." },
];

const PLAINS_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "Wild onions and tubers grow thick here. Easy foraging.", foodChange: 1 },
  { weight: 3, description: "A rabbit bolts from the grass. Easy catch — dinner tonight.", foodChange: 1 },
  { weight: 3, description: "You find the remains of a goblin camp. They left in a hurry — some copper scattered about.", goldCp: 20 },
  { weight: 2, description: "A shepherd waves you over. 'Sit, eat — I've got more than I need today.'", foodChange: 2 },
  { weight: 2, description: "Wildflowers carpet the hillside. Beautiful and peaceful — a rare moment of calm.", hpChange: 1, xpChange: 3 },
  { weight: 2, description: "An abandoned camp with a still-smoldering fire. Someone left dried meat hanging.", foodChange: 2 },
  { weight: 1, description: "A bird of prey drops a rabbit at your feet and flies off. Gift from the gods?", foodChange: 1, xpChange: 5 },
  { weight: 1, description: "You stumble on an old hunter's cache — rope, flint, and some jerky wrapped in cloth.", foodChange: 2, goldCp: 15 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  GOBLIN HILLS — Rocky dungeon hex overlooking Kardov's Gate (Level 1-3)
// ══════════════════════════════════════════════════════════════════════════════

const HILLS_EASY: EncounterTableEntry[] = [
  { weight: 5, monsterIds: ["goblin"],    count: [2, 4], flavor: "Goblin sentries! They blow a crude horn — but no reinforcements come." },
  { weight: 3, monsterIds: ["kobold"],    count: [3, 4], flavor: "Kobolds picking through rubble. Scrawny, but they fight dirty." },
  { weight: 2, monsterIds: ["dire_rat"],  count: [2, 3], flavor: "Rats nesting in the goblin refuse piles. Even goblins hate them." },
];

const HILLS_HARD: EncounterTableEntry[] = [
  { weight: 5, monsterIds: ["goblin"],     count: [4, 6], flavor: "Goblins pour from a crevice in the rocks, shrieking war-cries. It's an ambush!" },
  { weight: 3, monsterIds: ["hobgoblin"],  count: [2, 3], flavor: "A hobgoblin squad patrolling their territory. Armed, armored, organized." },
  { weight: 2, monsterIds: ["worg"],       count: [1, 2], flavor: "Worgs prowling the hilltops — goblin riding beasts without riders. Still deadly." },
  { weight: 2, monsterIds: ["orc"],        count: [2, 3], flavor: "Orcs competing with the goblins for the hills. They attack anyone they see." },
  { weight: 1, monsterIds: ["bugbear"],    count: 1,      flavor: "A bugbear enforcer — the goblins' muscle. It's been waiting for exactly this." },
];

const HILLS_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "A dead goblin with a coin pouch. Someone else cleared this one for you.", goldCp: 20 },
  { weight: 3, description: "A rocky overhang offers perfect shelter. You rest safely with a view of the valley.", hpChange: 1, xpChange: 3 },
  { weight: 2, description: "You find a goblin weapon cache — crude, but the metal has scrap value.", goldCp: 30 },
  { weight: 2, description: "Mushrooms growing in a shaded crevice. Edible — barely — but food is food.", foodChange: 1 },
  { weight: 1, description: "A vantage point reveals goblin patrol routes. Knowledge that will keep you alive.", xpChange: 10 },
  { weight: 1, description: "An old dwarven trail marker, half-buried. It hints at tunnels below the hills.", xpChange: 8 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  SALT WATER MARSH (Level 3-5)
// ══════════════════════════════════════════════════════════════════════════════

const MARSH_EASY: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["stirge"],             count: [2, 3], flavor: "Stirges rise from the reeds — a small cluster, not the full swarm." },
  { weight: 3, monsterIds: ["giant_fire_beetle"],  count: [2, 3], flavor: "Bioluminescent beetles swarm from a rotting log. The marsh glows." },
  { weight: 2, monsterIds: ["dire_rat"],           count: [2, 4], flavor: "Marsh rats, larger than city ones. Crusted in salt and mud." },
  { weight: 2, monsterIds: ["giant_ant_worker"],   count: [1, 2], flavor: "Giant ants foraging at the marsh edge. They guard their trail aggressively." },
  { weight: 1, monsterIds: ["badger"],             count: 1,      flavor: "A marsh badger in the reeds — squat, wet, and absolutely furious." },
];

const MARSH_HARD: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["stirge"],       count: [4, 6], flavor: "The full stirge colony rises from the brackish water like a living cloud." },
  { weight: 3, monsterIds: ["troglodyte"],   count: [2, 4], flavor: "The stench hits first. Troglodytes — they've been hunting in the marsh reeds." },
  { weight: 3, monsterIds: ["gnoll"],        count: [2, 3], flavor: "Gnolls camped on a dry hummock. They've been eating something — you don't want to know." },
  { weight: 2, monsterIds: ["wolf"],         count: [3, 4], flavor: "Swamp wolves — lean, desperate, and hunting in a pack through the mud." },
  { weight: 1, monsterIds: ["bugbear"],      count: [1, 2], flavor: "Bugbears wading through the marsh. They've been raiding the outer farms." },
];

const MARSH_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "Edible marsh tubers grow thick here. Filling, if bland.", foodChange: 2 },
  { weight: 3, description: "A fisherman's abandoned camp — lines still in the water. You pull in a decent catch.", foodChange: 2, xpChange: 3 },
  { weight: 2, description: "Salt deposits crusting the rocks. Worth something to the right buyer.", goldCp: 25 },
  { weight: 2, description: "A dry island in the marsh with old fire rings. A safe place to rest if needed.", hpChange: 2, xpChange: 3 },
  { weight: 2, description: "Medicinal leeches in a clear pool. Disgusting, but healers pay well for these.", goldCp: 40 },
  { weight: 1, description: "A half-sunken crate from a river barge. Still sealed — someone's lost cargo.", goldCp: 60, foodChange: 1 },
  { weight: 1, description: "Rare marsh orchids in bloom. Beautiful and valuable to alchemists.", goldCp: 50, xpChange: 5 },
];

// ══════════════════════════════════════════════════════════════════════════════
//  CORAL RIVER (Level 3-5)
// ══════════════════════════════════════════════════════════════════════════════

const RIVER_EASY: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],             count: [2, 3], flavor: "Goblins fishing at the ford. They panic when they see you." },
  { weight: 3, monsterIds: ["stirge"],             count: [1, 2], flavor: "A stirge nesting under the bridge pilings. Just one — it's territorial." },
  { weight: 2, monsterIds: ["dire_rat"],           count: [2, 3], flavor: "Rats living under the riverbank. The water has made them bold." },
  { weight: 2, monsterIds: ["giant_fire_beetle"],  count: [1, 2], flavor: "Beetles sheltering in the damp river rocks. Startled, they glow bright." },
  { weight: 1, monsterIds: ["wolf"],               count: 1,      flavor: "A lone wolf drinking at the river. It snarls — you're too close to its water." },
];

const RIVER_HARD: EncounterTableEntry[] = [
  { weight: 4, monsterIds: ["goblin"],     count: [4, 5], flavor: "Goblins holding the ford! They've built a crude barricade of river stones." },
  { weight: 3, monsterIds: ["orc"],        count: [2, 3], flavor: "Orcs fording the river spot you. They charge through the shallows, roaring." },
  { weight: 2, monsterIds: ["wolf"],       count: [3, 4], flavor: "Wolves — the whole pack is drinking here. They see you as competition." },
  { weight: 2, monsterIds: ["gnoll"],      count: [2, 3], flavor: "Gnolls camped at the river crossing. This is their territory now." },
  { weight: 1, monsterIds: ["bugbear"],    count: 1,      flavor: "A bugbear lurking under the bridge. It's been ambushing travelers for weeks." },
  { weight: 1, monsterIds: ["hobgoblin"],  count: [2, 3], flavor: "Hobgoblin soldiers holding the bridge. They demand tribute to cross." },
];

const RIVER_GOOD: GoodEncounterEntry[] = [
  { weight: 4, description: "Fresh fish practically jump into your hands at this stretch of the river.", foodChange: 2 },
  { weight: 3, description: "A rope ferry left by some earlier traveler. Saves hours of walking to the ford.", xpChange: 5 },
  { weight: 3, description: "Watercress and river mint grow along the banks. Good eating.", foodChange: 1 },
  { weight: 2, description: "You spot something glinting in the shallows — coins, washed downriver from who knows where.", goldCp: 30 },
  { weight: 2, description: "A fisherman upstream waves you over and shares his catch. 'Plenty today!'", foodChange: 2, xpChange: 3 },
  { weight: 1, description: "A small chest wedged between river rocks. Waterlogged but the coins inside are fine.", goldCp: 75 },
  { weight: 1, description: "The river is crystal clear here, and cool. You wash off days of grime and feel renewed.", hpChange: 2, xpChange: 3 },
];

// ── Zone-to-table mapping ───────────────────────────────────────────────────

type ZoneTables = { easy: EncounterTableEntry[]; hard: EncounterTableEntry[]; good: GoodEncounterEntry[] };

const ZONE_ENCOUNTER_TABLES: Record<string, ZoneTables> = {
  "kardovs-outskirts": { easy: FARM_EASY,   hard: FARM_HARD,   good: FARM_GOOD },
  "kings-road":        { easy: ROAD_EASY,   hard: ROAD_HARD,   good: ROAD_GOOD },
  "farmland":          { easy: FARM_EASY,   hard: FARM_HARD,   good: FARM_GOOD },
  "farm-dirt-road":    { easy: ROAD_EASY,   hard: ROAD_HARD,   good: ROAD_GOOD },
  "city-dirt-road":    { easy: TOWN_EASY,   hard: TOWN_HARD,   good: TOWN_GOOD },
  "gate-road":         { easy: ROAD_EASY,   hard: ROAD_HARD,   good: ROAD_GOOD },
  "goblin-hills":      { easy: HILLS_EASY,  hard: HILLS_HARD,  good: HILLS_GOOD },
  "outer-farmlands":   { easy: FARM_EASY,   hard: FARM_HARD,   good: FARM_GOOD },
  "salt-water-marsh":  { easy: MARSH_EASY,  hard: MARSH_HARD,  good: MARSH_GOOD },
  "coral-river":       { easy: RIVER_EASY,  hard: RIVER_HARD,  good: RIVER_GOOD },
};

// Terrain fallback tables (when no zone-specific table exists)
const TERRAIN_ENCOUNTER_TABLES: Record<string, ZoneTables> = {
  "farm":    { easy: FARM_EASY,   hard: FARM_HARD,   good: FARM_GOOD },
  "road":    { easy: ROAD_EASY,   hard: ROAD_HARD,   good: ROAD_GOOD },
  "town":    { easy: TOWN_EASY,   hard: TOWN_HARD,   good: TOWN_GOOD },
  "plains":  { easy: PLAINS_EASY, hard: PLAINS_HARD,  good: PLAINS_GOOD },
  "swamp":   { easy: MARSH_EASY,  hard: MARSH_HARD,  good: MARSH_GOOD },
};

/** Roll a good encounter for a zone. Returns null if no table exists. */
export function rollGoodEncounter(zoneId?: string, terrain?: string): GoodEncounterEntry | null {
  const tables = (zoneId && ZONE_ENCOUNTER_TABLES[zoneId]) || (terrain && TERRAIN_ENCOUNTER_TABLES[terrain]);
  if (!tables) return null;
  return rollTable(tables.good);
}

// Class-level templates for deadly encounters (world roll 1)
// Any monster can get martial classes; caster classes require minimum mental stats
type ClassLevel = {
  label: string;
  hpBonus: number; acBonus: number; atkBonus: number; dmgBonus: number;
  reqInt?: number;
  reqWis?: number;
  reqCha?: number;
};
const CLASS_LEVELS: ClassLevel[] = [
  // Martial — any monster can get these
  // Modest stat bumps — the class features (rage, sneak attack, etc.) are the real threat
  { label: "Fighter 2",   hpBonus: 6, acBonus: 1, atkBonus: 1, dmgBonus: 1 },
  { label: "Barbarian 1", hpBonus: 8, acBonus: 0, atkBonus: 1, dmgBonus: 1 },
  { label: "Ranger 2",    hpBonus: 6, acBonus: 0, atkBonus: 1, dmgBonus: 1 },
  { label: "Rogue 2",     hpBonus: 4, acBonus: 0, atkBonus: 1, dmgBonus: 1 },
  // Caster — need mental stats
  { label: "Cleric 1",    hpBonus: 6, acBonus: 1, atkBonus: 0, dmgBonus: 0, reqWis: 3 },
  { label: "Wizard 1",    hpBonus: 3, acBonus: 0, atkBonus: 0, dmgBonus: 0, reqInt: 3 },
  { label: "Sorcerer 1",  hpBonus: 3, acBonus: 0, atkBonus: 0, dmgBonus: 0, reqCha: 3 },
  { label: "Druid 1",     hpBonus: 6, acBonus: 0, atkBonus: 0, dmgBonus: 0, reqWis: 3 },
];

/** Pick a class the monster qualifies for based on its stats */
function pickClassForMonster(m: Monster): ClassLevel {
  const eligible = CLASS_LEVELS.filter(c =>
    (!c.reqInt || m.int >= c.reqInt) &&
    (!c.reqWis || m.wis >= c.reqWis) &&
    (!c.reqCha || m.cha >= c.reqCha)
  );
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/** Apply class levels to a monster — returns a boosted copy */
function applyClassLevels(base: Monster, cls: ClassLevel): Monster {
  return {
    ...base,
    name: `${base.name} (${cls.label})`,
    hp: base.hp + cls.hpBonus,
    ac: base.ac + cls.acBonus,
    str: base.str + cls.dmgBonus,
    dex: base.dex + cls.atkBonus,
    cr: base.cr + 1,
  };
}

/** Build a war band leader — same race, class leveled to match the zone. */
function buildWarBandLeader(base: Monster, zoneHi: number): { leader: Monster; classLabel: string } {
  const cls = pickClassForMonster(base);
  const leaderLevel = Math.max(2, zoneHi - Math.floor(Math.random() * 2));
  const label = cls.label.replace(/\d+$/, String(leaderLevel));
  const leader: Monster = {
    ...base,
    name: `${base.name} Chieftain (${label})`,
    hp: base.hp + cls.hpBonus * leaderLevel,
    ac: base.ac + cls.acBonus + Math.floor(leaderLevel / 3),
    str: base.str + cls.dmgBonus * Math.ceil(leaderLevel / 2),
    dex: base.dex + cls.atkBonus * Math.ceil(leaderLevel / 2),
    con: base.con + Math.floor(leaderLevel / 3),
    cr: base.cr + leaderLevel,
  };
  return { leader, classLabel: label };
}

/** Generate a fight encounter appropriate for the zone and terrain */
export function generateFightEncounter(
  terrain: string,
  levelRange: [number, number],
  difficulty: "easy" | "medium" | "hard" | "deadly",
  zoneId?: string,
): EncounterData {
  const [minCR, maxCR] = crRange(levelRange);
  const [, zoneHi] = levelRange;

  // ── Table-based encounter ──
  // Use weighted encounter tables when available for this zone/terrain
  const tables = (zoneId && ZONE_ENCOUNTER_TABLES[zoneId]) || TERRAIN_ENCOUNTER_TABLES[terrain];
  if (tables && difficulty !== "deadly") {
    const subTable = (difficulty === "hard") ? tables.hard : tables.easy;
    const entry = rollTable(subTable);
    const count = resolveCount(entry.count);
    const monster = MONSTERS.find(m => m.id === entry.monsterIds[0]);
    if (monster) {
      let finalMonster = monster;
      let classLabel: string | undefined;
      if (difficulty === "hard") {
        // Hard: apply class levels to make tougher
        const cls = pickClassForMonster(monster);
        finalMonster = applyClassLevels(monster, cls);
        classLabel = cls.label;
      }
      return {
        monsters: [{ monster: finalMonster, count }],
        difficulty,
        description: entry.flavor,
        crBoost: difficulty === "hard" ? 1 : undefined,
        classLevels: classLabel,
      };
    }
  }

  // ── Roving horde check ──
  // In zones above level 3, 30% chance to get a large band of low-CR monsters
  // with class levels. Each war band has a leader leveled to the zone.
  if (zoneHi > 3 && Math.random() < 0.3 && difficulty !== "easy") {
    const horde = pickEncounterGroup(terrain, 0.25, 1);
    const baseMonster = horde.monsters[0];

    // Chieftain: zone-level martial leader
    const { leader, classLabel: leaderLabel } = buildWarBandLeader(baseMonster, zoneHi);

    // Advisor: shaman / witch doctor — evil cleric or druid, 2 levels below chief
    const advisorLevel = Math.max(1, zoneHi - 2);
    const advisorCls = (baseMonster.wis >= 3)
      ? (Math.random() < 0.5
          ? CLASS_LEVELS.find(c => c.label.startsWith("Cleric"))!
          : CLASS_LEVELS.find(c => c.label.startsWith("Druid"))!)
      : CLASS_LEVELS.find(c => c.label.startsWith("Cleric"))!;
    const advisorLabel = advisorCls.label.replace(/\d+$/, String(advisorLevel));
    const advisor: Monster = {
      ...baseMonster,
      name: `${baseMonster.name} Shaman (${advisorLabel})`,
      hp: baseMonster.hp + advisorCls.hpBonus * advisorLevel,
      ac: baseMonster.ac + advisorCls.acBonus + Math.floor(advisorLevel / 4),
      wis: baseMonster.wis + Math.ceil(advisorLevel / 2),
      con: baseMonster.con + Math.floor(advisorLevel / 4),
      cr: baseMonster.cr + advisorLevel,
    };

    // Grunts: mix of level 1 and level 2 warriors — AOE/cleave fodder
    const gruntCls = pickClassForMonster(baseMonster);
    const grunt1 = applyClassLevels(baseMonster, gruntCls);
    const grunt2Label = gruntCls.label.replace(/\d+$/, "2");
    const grunt2: Monster = {
      ...baseMonster,
      name: `${baseMonster.name} (${grunt2Label})`,
      hp: baseMonster.hp + gruntCls.hpBonus * 2,
      ac: baseMonster.ac + gruntCls.acBonus,
      str: baseMonster.str + gruntCls.dmgBonus,
      dex: baseMonster.dex + gruntCls.atkBonus,
      cr: baseMonster.cr + 2,
    };
    const totalGrunts = zoneHi <= 5
      ? 4 + Math.floor(Math.random() * 3)
      : zoneHi <= 8
        ? 6 + Math.floor(Math.random() * 4)
        : 8 + Math.floor(Math.random() * 4);
    const lvl2Count = Math.floor(totalGrunts / 2);
    const lvl1Count = totalGrunts - lvl2Count;

    const desc = `A roving war band! A ${leader.name} and their ${advisor.name} lead ${totalGrunts} warriors. The chieftain looks as dangerous as any adventurer.`;
    return {
      monsters: [
        { monster: leader, count: 1 },
        { monster: advisor, count: 1 },
        { monster: grunt2, count: lvl2Count },
        { monster: grunt1, count: lvl1Count },
      ],
      difficulty: difficulty === "deadly" ? "deadly" : "hard",
      description: desc,
      crBoost: 1,
      classLevels: leaderLabel,
    };
  }

  // ── Normal encounter ──
  let adjMin = minCR;
  let adjMax = maxCR;
  if (difficulty === "easy") {
    adjMax = Math.max(minCR, maxCR - 1);
  } else if (difficulty === "hard") {
    adjMin = Math.max(minCR, maxCR - 1);
  } else if (difficulty === "deadly") {
    adjMin = maxCR;
    adjMax = maxCR + 1;
  }

  const group = pickEncounterGroup(terrain, adjMin, adjMax);
  let monster = group.monsters[0];
  let classLabel: string | undefined;

  if (difficulty === "deadly") {
    const cls = pickClassForMonster(monster);
    monster = applyClassLevels(monster, cls);
    classLabel = cls.label;
  }

  let desc: string;
  if (difficulty === "deadly") {
    desc = group.count > 1
      ? `${group.count} battle-hardened ${monster.name}s ambush you! These are no ordinary foes.`
      : `A veteran ${monster.name} blocks your path. This one has seen real combat.`;
  } else if (difficulty === "easy") {
    desc = group.count > 1
      ? `${group.count} scraggly ${monster.name}s stumble into view. They look half-starved — easy pickings.`
      : `A lone ${monster.name} wanders nearby, oblivious to your presence. ${monster.description}`;
  } else {
    desc = group.count > 1
      ? `${group.count} ${monster.name}s attack! ${monster.description}`
      : `A ${monster.name} attacks! ${monster.description}`;
  }

  return {
    monsters: [{ monster, count: group.count }],
    difficulty,
    description: desc,
    crBoost: difficulty === "deadly" ? 1 : undefined,
    classLevels: classLabel,
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
