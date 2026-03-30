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

// CR ranges per zone — maps level range to appropriate monster CRs
function crRange(levelRange: [number, number]): [number, number] {
  const [lo, hi] = levelRange;
  if (hi <= 3) return [0.25, 2];    // levels 1-3: CR 1/4 to CR 2
  if (hi <= 5) return [1, 3];       // levels 3-5: CR 1 to CR 3
  if (hi <= 8) return [2, 5];       // levels 5-8: CR 2 to CR 5
  return [3, 8];                     // levels 8+: CR 3 to CR 8
}

// ── Level 1-3 Zone: Kardov's Gate Surroundings ──────────────────────────────
const ZONE_1_3_KEYS = [
  "36,32","35,33","34,33","33,33","35,32","34,32","34,31","33,31",
  "33,32","32,32","32,31","31,31","31,30","30,31","30,30","30,29",
  "30,28","29,27","30,27","31,26","31,27","31,28","32,28","32,29",
  "31,29","32,30","33,30","34,30","33,29","34,28","33,28","33,27",
  "32,27","32,26","33,26",
  // Added hexes
  "34,34","35,34","36,34","35,35","34,35",
];

// ── Level 3-5 Zone: Outer Farmlands & Forest Edge ───────────────────────────
const ZONE_3_5_KEYS = [
  "29,30","29,31","30,32","30,33","31,34","31,35","32,36","31,37",
  "31,38","30,37","29,37","30,36","31,36","30,35","29,36","28,36",
  "27,35","27,34","26,35","29,35","28,35","30,34","29,34","29,33",
  "29,32","28,33","28,34","27,33","28,32","28,31","28,30","27,30",
  "27,31","27,32","26,31","26,33","25,33","26,32","26,34","26,29",
];

const ZONE_1_3: LevelZone = {
  id: "kardovs-outskirts",
  name: "Kardov's Outskirts",
  levelRange: [1, 3],
  hexes: new Set(ZONE_1_3_KEYS),
};

const ZONE_3_5: LevelZone = {
  id: "outer-farmlands",
  name: "Outer Farmlands",
  levelRange: [3, 5],
  hexes: new Set(ZONE_3_5_KEYS),
};

export const LEVEL_ZONES: LevelZone[] = [ZONE_1_3, ZONE_3_5];

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
