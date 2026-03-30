"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { type CharacterSave, travel, FOOD_PER_DAY } from "@/lib/saveSystem";
import type { NftCharacter } from "@/hooks/useNftStats";
import { getZone, getLevelRange, generateFightEncounter, generateLootDrop, type EncounterData, type LootDrop } from "@/lib/encounters";
import { getShopsForLocation, getAvailableItems, type Shop, type ShopItem } from "@/lib/shops";

// ── Types ────────────────────────────────────────────────────────────────────

type HexType = "town" | "forest" | "desert" | "jungle" | "swamp" | "water" | "mountain" | "plains" | "coast";

type HexTag = "road" | "dirt_road" | "farm" | "bridge" | "forest_1" | "forest_2" | "forest_3" | "dungeon" | "coral_forest" | "fungi_floor" | "desert_region" | "black_swamps" | "shoreline_peaks" | "magic_lake";

type MapHex = {
  q: number;
  r: number;
  type: HexType;
  name?: string;
  description?: string;
  tags?: HexTag[];
};

// ── d20 Encounter System ──────────────────────────────────────────────────
// Roll when entering any non-city hex:
//   1–2  = fight (difficulty from terrain + distance)
//   3–4  = lost time (flavored by terrain)
//   19–20 = find something/someone useful
//   5–18  = uneventful

export type EncounterResult = {
  roll: number;
  type: "safe" | "fight" | "lost_time" | "find";
  difficulty?: "easy" | "medium" | "hard";
  description: string;
};

// ── Unified World Luck System ───────────────────────────────────────────
// Every hex interaction (travel, rest, search) triggers:
//   1. World Luck d20 — what's potentially there
//   2. Skill Check d20 + WIS mod — do you find it / does it find you
//
// World Luck table:
//   1-3   = danger lurking (monster, trap, hazard)
//   4-6   = minor trouble (delay, small hazard)
//   7-14  = nothing special
//   15-17 = something minor here (small loot, useful herbs)
//   18-20 = something valuable here (treasure, rare find)
//
// Skill check determines outcome:
//   Danger: high check = avoid it, low check = it finds you
//   Treasure: high check = you find it, low check = you miss it
//   Search action gets +5 bonus to skill check (actively looking)
//   Rest action gets -2 penalty (guard is down)

export type HexInteraction = "travel" | "rest" | "search";

export type WorldLuckResult = {
  worldRoll: number;          // d20 world luck
  skillRoll: number;          // d20 + WIS mod + action bonus
  skillDC: number;            // difficulty to beat
  interaction: HexInteraction;
  outcome: "nothing" | "fight" | "hazard" | "minor_find" | "major_find" | "avoided_danger" | "missed_loot";
  difficulty?: "easy" | "medium" | "hard";
  description: string;
  hpChange: number;
  goldChange: number;
  foodChange: number;
  xpChange: number;
  encounter?: EncounterData;  // populated when outcome is "fight"
  loot?: LootDrop;           // populated when outcome is "minor_find" or "major_find"
};

const DANGER_DESC: Record<HexType, string[]> = {
  town:     ["Pickpockets eye you in the crowd.", "A shady figure follows you through an alley."],
  forest:   ["Wolves stalk you through the trees.", "A massive spider drops from above!"],
  desert:   ["Sandworms sense your footsteps.", "Raiders ambush from behind a dune!"],
  jungle:   ["A venomous serpent coils to strike!", "Tribal hunters surround you."],
  swamp:    ["Something massive moves beneath the water.", "Bog creatures rise from the muck!"],
  mountain: ["A rockslide triggers — or was it pushed?", "Mountain trolls block the path!"],
  plains:   ["Bandits spring from the tall grass!", "A wild beast charges from nowhere!"],
  coast:    ["Pirates wade ashore with blades drawn!", "Sea creatures emerge from the shallows!"],
  water:    ["Something drags at you from below!", "River serpents surface around you!"],
};

const HAZARD_DESC: Record<HexType, string[]> = {
  town:     ["You get lost in winding streets.", "A merchant dispute blocks your way."],
  forest:   ["Dense undergrowth slows you to a crawl.", "A fallen tree forces a long detour."],
  desert:   ["A sandstorm forces you to shelter.", "You follow a mirage and lose your bearings."],
  jungle:   ["Quicksand nearly swallows your pack.", "Venomous insects swarm you."],
  swamp:    ["You sink waist-deep in muck.", "Poisonous gas forces you back."],
  mountain: ["A rockslide blocks the pass.", "Thick fog rolls in — you wait it out."],
  plains:   ["A sudden downpour floods the trail.", "You lose the path and wander."],
  coast:    ["The tide cuts off your path.", "Slippery rocks slow your progress."],
  water:    ["Strong current sweeps you off course.", "Unexpected depth forces you back."],
};

const MINOR_FIND_DESC: Record<HexType, string[]> = {
  town:     ["You find a few coins dropped in the gutter.", "A shopkeeper gives you a sample."],
  forest:   ["You spot edible berries along the path.", "A small herb cache beneath a log."],
  desert:   ["You find a half-buried water skin.", "Wind-polished stones worth a bit of coin."],
  jungle:   ["Exotic mushrooms — edible and valuable.", "You find a monkey's abandoned fruit stash."],
  swamp:    ["Peat moss with healing properties.", "Something small glints in shallow water."],
  mountain: ["A small ore deposit catches your eye.", "Mountain herbs growing in a crevice."],
  plains:   ["A patch of wild grain ready to harvest.", "A traveler's lost coin pouch."],
  coast:    ["Shells and driftwood worth a few coins.", "A small catch of fish in a tidal pool."],
  water:    ["You fish up something small but useful.", "Smooth river stones with minor value."],
};

const MAJOR_FIND_DESC: Record<HexType, string[]> = {
  town:     ["You discover a hidden cache behind loose bricks!", "A grateful citizen rewards your good deed."],
  forest:   ["An ancient chest half-buried in roots!", "A rare medicinal herb worth serious gold."],
  desert:   ["You unearth a buried treasure vault!", "Ancient artifacts poke from the sand."],
  jungle:   ["A lost temple alcove with offerings!", "Glowing fungi worth a fortune to alchemists."],
  swamp:    ["A sunken chest rises from the mire!", "Rare swamp orchids — alchemists pay dearly."],
  mountain: ["A rich vein of precious ore!", "An abandoned mine with leftover riches."],
  plains:   ["A merchant's lost strongbox in the grass!", "An old battlefield yields valuable relics."],
  coast:    ["Shipwreck debris washes ashore — treasure!", "A sealed chest from a sunken vessel."],
  water:    ["You pull up a waterlogged treasure chest!", "Ancient coins glitter on the riverbed."],
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function rollWorldLuck(
  hex: MapHex,
  interaction: HexInteraction,
  wismod: number,
  distFromCity: number,
): WorldLuckResult {
  const worldRoll = Math.floor(Math.random() * 20) + 1;
  const rawSkill = Math.floor(Math.random() * 20) + 1;
  const actionBonus = interaction === "search" ? 5 : interaction === "rest" ? -2 : 0;
  const skillRoll = rawSkill + wismod + actionBonus;

  const isFarm = hex.tags?.includes("farm");
  const isDungeon = hex.tags?.includes("dungeon");
  const isTown = hex.type === "town";

  // Zone-based level range for encounter/loot scaling
  const levelRange = getLevelRange(hex.q, hex.r, distFromCity);

  // Towns are safe — no danger, but can still find things
  const dangerCeiling = isTown ? 0 : isFarm ? 2 : isDungeon ? 5 : 3;
  const hazardCeiling = isTown ? 0 : isFarm ? 4 : 6;
  const minorFloor = isFarm ? 13 : isDungeon ? 13 : 15;
  const majorFloor = isDungeon ? 17 : 18;

  // ── Danger (world 1-dangerCeiling) ──
  if (worldRoll <= dangerCeiling) {
    const dc = isFarm ? 8 : isDungeon ? 14 : 10 + Math.min(distFromCity, 10);
    if (skillRoll >= dc) {
      return {
        worldRoll, skillRoll, skillDC: dc, interaction, outcome: "avoided_danger",
        description: interaction === "rest"
          ? "You hear something approaching but stay hidden."
          : "You spot danger ahead and slip away unnoticed.",
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 5,
      };
    }
    // Failed — fight. Generate actual encounter with monsters.
    let difficulty: "easy" | "medium" | "hard";
    if (isFarm) difficulty = "easy";
    else if (distFromCity <= 6) difficulty = "easy";
    else if (distFromCity <= 15) difficulty = "medium";
    else difficulty = "hard";
    if (["swamp", "mountain", "jungle"].includes(hex.type) && difficulty !== "hard") {
      difficulty = difficulty === "easy" ? "medium" : "hard";
    }
    const encounter = generateFightEncounter(hex.type, levelRange, difficulty);
    return {
      worldRoll, skillRoll, skillDC: dc, interaction, outcome: "fight", difficulty,
      description: encounter.description,
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
      encounter,
    };
  }

  // ── Hazard / minor trouble (world dangerCeiling+1 to hazardCeiling) ──
  if (worldRoll <= hazardCeiling) {
    const dc = 10;
    if (skillRoll >= dc) {
      return {
        worldRoll, skillRoll, skillDC: dc, interaction, outcome: "nothing",
        description: "You notice a hazard and avoid it.",
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 2,
      };
    }
    const dmg = isDungeon ? Math.floor(Math.random() * 3) + 1 : 1;
    return {
      worldRoll, skillRoll, skillDC: dc, interaction, outcome: "hazard",
      description: pick(HAZARD_DESC[hex.type] ?? HAZARD_DESC.plains),
      hpChange: -dmg, goldChange: 0, foodChange: 0, xpChange: 0,
    };
  }

  // ── Nothing special (world hazardCeiling+1 to minorFloor-1) ──
  if (worldRoll < minorFloor) {
    const nothingDescs = [
      "Nothing eventful happens.",
      "The area is quiet.",
      "You find no trace of anything unusual.",
    ];
    return {
      worldRoll, skillRoll, skillDC: 0, interaction, outcome: "nothing",
      description: pick(nothingDescs),
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
    };
  }

  // ── Minor find (world minorFloor to majorFloor-1) ──
  if (worldRoll < majorFloor) {
    const dc = isFarm ? 8 : 12;
    if (skillRoll >= dc) {
      const lootDrop = generateLootDrop(hex.type, levelRange, "minor_find");
      const gold = Math.round(lootDrop.totalValue) + (Math.floor(Math.random() * 3));
      const food = isFarm ? Math.floor(Math.random() * 2) + 1 : (Math.random() < 0.4 ? 1 : 0);
      return {
        worldRoll, skillRoll, skillDC: dc, interaction, outcome: "minor_find",
        description: lootDrop.flavor + " " + lootDrop.items.map(i => i.name).join(", ") + ".",
        hpChange: 0, goldChange: gold, foodChange: food, xpChange: 3,
        loot: lootDrop,
      };
    }
    return {
      worldRoll, skillRoll, skillDC: dc, interaction, outcome: "missed_loot",
      description: "You sense something nearby but can't locate it.",
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 1,
    };
  }

  // ── Major find (world majorFloor+) ──
  const dc = isDungeon ? 10 : 14;
  if (skillRoll >= dc) {
    const lootDrop = generateLootDrop(hex.type, levelRange, "major_find");
    const gold = Math.round(lootDrop.totalValue) + (isDungeon ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 5));
    const food = isFarm ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 2) + 1;
    return {
      worldRoll, skillRoll, skillDC: dc, interaction, outcome: "major_find",
      description: lootDrop.flavor + " " + lootDrop.items.map(i => i.name).join(", ") + "!",
      hpChange: 0, goldChange: gold, foodChange: food, xpChange: 10,
      loot: lootDrop,
    };
  }
  return {
    worldRoll, skillRoll, skillDC: dc, interaction, outcome: "missed_loot",
    description: "Something valuable was here... but you just missed it.",
    hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 2,
  };
}

const LOST_TIME: Record<HexType, string[]> = {
  desert:   ["A sandstorm forces you to shelter for hours.", "You follow a mirage and lose your bearings."],
  forest:   ["A fallen tree blocks the path — you detour.", "Dense undergrowth slows you to a crawl."],
  jungle:   ["Quicksand nearly swallows your pack.", "Venomous insects force a wide detour."],
  mountain: ["A rockslide blocks the pass.", "Thick fog rolls in — you wait it out."],
  swamp:    ["You sink waist-deep in muck.", "Poisonous gas forces you back."],
  plains:   ["A sudden downpour floods the trail.", "You lose the trail and wander."],
  coast:    ["The tide cuts off your path.", "Slippery rocks slow your progress."],
  town:     [], water: [],
};

const FIND_SOMETHING: string[] = [
  "You find a cache of supplies hidden under a rock.",
  "A wandering merchant offers rare goods.",
  "You discover medicinal herbs growing nearby.",
  "An old traveler shares useful knowledge.",
  "You stumble upon a small pouch of gold.",
  "A shortcut through the terrain saves time.",
];

export function rollEncounter(hex: MapHex, distFromCity: number): EncounterResult {
  if (hex.type === "town") return { roll: 10, type: "safe", description: "The city is safe." };

  const isFarm = hex.tags?.includes("farm");
  const roll = Math.floor(Math.random() * 20) + 1;

  // Farmland: only roll 1 triggers a fight (petty thieves, pests).
  // Wilds: 1–2 triggers a fight.
  const fightThreshold = isFarm ? 1 : 2;

  if (roll <= fightThreshold) {
    let difficulty: "easy" | "medium" | "hard";
    if (isFarm) {
      difficulty = "easy"; // farmland fights are always easy — bandits, wolves, crop pests
    } else if (distFromCity <= 6) difficulty = "easy";
    else if (distFromCity <= 15) difficulty = "medium";
    else difficulty = "hard";
    // Dangerous terrain bumps difficulty
    if (["swamp", "mountain", "jungle"].includes(hex.type) && difficulty !== "hard") {
      difficulty = difficulty === "easy" ? "medium" : "hard";
    }
    const desc = isFarm
      ? `Bandits ambush you on the farm road! (${difficulty})`
      : `Hostile creatures attack! (${difficulty})`;
    return { roll, type: "fight", difficulty, description: desc };
  }

  // Farmland: 2–3 = lost time (instead of 3–4). Farm-specific flavor.
  // Wilds: 3–4 = lost time.
  const lostTimeLow = isFarm ? 2 : fightThreshold + 1;
  const lostTimeHigh = lostTimeLow + 1;

  if (roll >= lostTimeLow && roll <= lostTimeHigh) {
    if (isFarm) {
      const farmLost = [
        "A farmer's cart blocks the road — you help move it.",
        "You stop to help round up escaped livestock.",
        "A flooded irrigation ditch forces a detour.",
        "A local dispute over land boundaries delays your passage.",
      ];
      return { roll, type: "lost_time", description: farmLost[Math.floor(Math.random() * farmLost.length)] };
    }
    const pool = LOST_TIME[hex.type] ?? LOST_TIME.plains;
    const desc = pool.length ? pool[Math.floor(Math.random() * pool.length)] : "You lose time to local hazards.";
    return { roll, type: "lost_time", description: desc };
  }

  // Farmland: 18–20 = find something (wider range — farms are generous).
  // Wilds: 19–20.
  const findThreshold = isFarm ? 18 : 19;

  if (roll >= findThreshold) {
    if (isFarm) {
      const farmFind = [
        "A farmer offers you fresh food for the road.",
        "You find ripe crops growing wild along the roadside.",
        "A grateful farmer rewards you for scaring off pests.",
        "You stumble upon a hidden root cellar with supplies.",
      ];
      return { roll, type: "find", description: farmFind[Math.floor(Math.random() * farmFind.length)] };
    }
    const desc = FIND_SOMETHING[Math.floor(Math.random() * FIND_SOMETHING.length)];
    return { roll, type: "find", description: desc };
  }

  return { roll, type: "safe", description: "Travel is uneventful." };
}

// ── Grid calibration ────────────────────────────────────────────────────────
// Tuned to align with the hex grid baked into kardovs-gate-map.jpg (2048×2048).
// Pointy-top hexes, size ≈ 25.5 px at 2048 → 7.47 in 600×600 viewBox.
// ~48 cols × 55 rows.  Image pixel analysis: hSpacing = 44 px, vSpacing ≈ 38 px.

const HEX_SIZE = 7.47;
const VB = 600;
const OX = 0;
const OY = 0;
const COLS = 48;
const ROWS = 55;

// ── Hex math (pointy-top, odd-r offset) ─────────────────────────────────────

function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = OX + HEX_SIZE * Math.sqrt(3) * (q + 0.5 * (r & 1));
  const y = OY + HEX_SIZE * 1.5 * r;
  return { x, y };
}

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  // Offset (odd-r) → cube conversion for pointy-top hexes
  function toCube(q: number, r: number) {
    const x = q - (r - (r & 1)) / 2;
    const z = r;
    const y = -x - z;
    return { x, y, z };
  }
  const ac = toCube(a.q, a.r);
  const bc = toCube(b.q, b.r);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

function hexPolygon(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

// ── Island boundary (600×600 coords) ────────────────────────────────────────
// Approximate polygon tracing the coastline of Kardov's Gate.

const ISLAND_POLY: [number, number][] = [
  [175, 48], [205, 36], [255, 28], [305, 26], [355, 28], [405, 34], [445, 46], [468, 58],
  [488, 78], [502, 108], [510, 148], [514, 188], [512, 238], [507, 278],
  [500, 318], [490, 352], [477, 382], [460, 412], [440, 438], [418, 458],
  [392, 476], [367, 488], [342, 496], [312, 502], [282, 506], [252, 502], [227, 492], [207, 478],
  [188, 456], [170, 428], [154, 393], [142, 353], [132, 308], [124, 263],
  [120, 218], [122, 173], [130, 133], [142, 98], [157, 70], [172, 50],
];

// Kardov's Gate Lake — large central lake (the glowing feature)
const GATE_LAKE_CX = 305;
const GATE_LAKE_CY = 240;
const GATE_LAKE_R = 52;

// East lake — smaller turquoise lake on the east side
const EAST_LAKE_CX = 400;
const EAST_LAKE_CY = 310;
const EAST_LAKE_R = 28;

function pointInPoly(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ── Points of Interest ─────────────────────────────────────────────────────

export const KARDOVS_GATE_HEX = { q: 36, r: 32 };

// POI coordinates mapped to pointy-top grid
const POIS: Record<string, Omit<MapHex, "q" | "r">> = {
  "19,11": { type: "town",     name: "Desert Camp", description: "A dusty outpost on the edge of the Sun Wastes.", tags: ["desert_region"] },
  "11,23": { type: "mountain", name: "Iron Crag", description: "A jagged peak rich with ore. Miners beware.", tags: ["coral_forest", "fungi_floor"] },
  "15,40": { type: "swamp",   name: "Black Mire", description: "Fog-shrouded marshes where strange lights flicker.", tags: ["forest_2"] },
  "26,15": { type: "swamp",   name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "35,19": { type: "forest",  name: "Thornwood", description: "Twisted trees with bark like blades." },
  "25,28": { type: "plains",  name: "Gate Road", description: "A worn path connecting the Gate to the eastern settlements." },
  "39,26": { type: "coast",   name: "East Shore", description: "Rocky beach. Ships sometimes anchor offshore." },
  "18,37": { type: "swamp",   name: "Witch's Bog", description: "Locals say a witch lives within. Few return.", tags: ["forest_2"] },
  "28,40": { type: "plains",  name: "Farm Fields", description: "Fertile land south of town. Crops feed Newbsberd." },
  "23,8":  { type: "desert",  name: "Sun Wastes", description: "Endless sand dunes. Travel light or don't travel at all." },
  "9,20":  { type: "mountain", name: "West Cliffs", description: "Sheer cliffs overlooking the western sea.", tags: ["coral_forest", "fungi_floor"] },
  "26,39": { type: "forest",  name: "South Road", description: "A dirt track through Forest Area 1.", tags: ["dirt_road", "forest_1"] },
  "18,26": { type: "forest",  name: "Deep Wood", description: "The canopy is so thick, daylight barely reaches the floor." },
  "32,10": { type: "desert",  name: "Scorched Ridge", description: "Blackened stone. Something burned here long ago." },
  "15,14": { type: "jungle",  name: "Mushroom Grove", description: "Bioluminescent fungi light the canopy. Beautiful and dangerous.", tags: ["desert_region"] },
  "35,37": { type: "forest",  name: "East Fields", description: "Open fields at the edge of Forest Area 1.", tags: ["forest_1"] },
  "23,43": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "33,27": { type: "plains",  name: "Farmland", description: "Fertile fields surrounding Kardov's Gate." },
  "27,22": { type: "plains",  name: "Crossroads", description: "Three paths meet here. Travellers rest and trade news." },
  // ── King's Road (stone brick, remains outside city) ──
  "30,30": { type: "plains",  name: "King's Road", description: "Well-maintained stone brick road connecting Kardov's Gate to the realm.", tags: ["road"] },
  "29,30": { type: "plains",  name: "King's Road", description: "Well-maintained stone brick road connecting Kardov's Gate to the realm.", tags: ["road"] },
  "25,32": { type: "plains",  name: "King's Road", description: "Well-maintained stone brick road connecting Kardov's Gate to the realm.", tags: ["road"] },
  // ── Kardov's Gate city hexes ──
  "37,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "36,31": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,30": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "34,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "33,31": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "33,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "32,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "30,31": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "29,31": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "28,31": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "28,30": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "27,30": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "27,31": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "27,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "26,31": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "26,32": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "26,33": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  "26,29": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "25,33": { type: "town", name: "Kardov's Gate", description: "The sprawling city on the lakeshore." },
  // ── Farmland surrounding Kardov's Gate ──
  "34,35": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "36,34": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["farm"] },
  "33,33": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "31,31": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,30": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,29": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "31,28": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "34,28": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "36,29": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["farm"] },
  "37,28": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["farm"] },
  "30,27": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,26": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "33,26": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,29": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "31,26": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,28": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "29,27": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,31": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "33,30": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "34,30": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "28,32": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "29,33": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,32": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "27,33": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "27,34": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "27,35": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "26,34": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "26,35": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "27,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "28,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "27,37": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "28,37": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "29,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "29,37": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "29,34": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,35": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,33": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "31,33": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "32,34": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "31,35": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "31,36": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,35": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "31,37": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,37": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "30,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "31,38": { type: "plains", name: "Farmland", description: "Fertile fields surrounding Kardov's Gate.", tags: ["farm"] },
  "32,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  "32,37": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["farm", "magic_lake"] },
  // ── Coral River ──
  "36,32": { type: "town", name: "Kardov's Gate", description: "The capital city. Inns, shops, and services beyond anywhere else on the island." },
  "35,32": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "34,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "34,29": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "35,28": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "34,27": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "34,26": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "32,25": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "31,25": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "30,25": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "30,26": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "29,28": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "28,29": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "27,29": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "26,30": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "25,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "24,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "23,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "22,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "20,33": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "20,32": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "19,31": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "19,30": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "18,30": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  "17,29": { type: "water", name: "Coral River", description: "A wide river flowing through the heart of the realm." },
  // ── Salt Water Marsh ──
  "25,30": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "25,29": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "26,28": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "26,27": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "27,28": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "28,28": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "27,27": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "28,27": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "29,26": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "29,25": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "28,25": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "30,24": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "31,24": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "32,24": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "32,23": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "31,23": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "30,23": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "33,25": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "34,25": { type: "swamp", name: "Salt Water Marsh", description: "Brackish wetlands where the river meets the salt flats." },
  "35,25": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  // ── Dirt Roads ──
  "24,33": { type: "forest", name: "Forest Dirt Road", description: "A dirt road through Forest Area 1.", tags: ["dirt_road", "forest_1"] },
  "24,34": { type: "forest", name: "Forest Dirt Road", description: "A dirt road through Forest Area 1.", tags: ["dirt_road", "forest_1"] },
  "23,34": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees. Forest Area 1.", tags: ["dirt_road", "forest_1", "dungeon"] },
  "29,32": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "28,33": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "28,34": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "28,35": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "29,35": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "30,34": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "31,34": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "32,27": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "31,27": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "33,28": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "31,30": { type: "town",   name: "City Dirt Road", description: "A dirt road within Kardov's Gate.", tags: ["dirt_road"] },
  "31,29": { type: "town",   name: "City Dirt Road", description: "A dirt road within Kardov's Gate.", tags: ["dirt_road"] },
  "32,28": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "35,33": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "34,33": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "35,34": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "34,34": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "35,35": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "33,29": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "35,31": { type: "town",   name: "City Dirt Road", description: "A dirt road within Kardov's Gate.", tags: ["dirt_road"] },
  "35,30": { type: "town",   name: "City Dirt Road", description: "A dirt road within Kardov's Gate.", tags: ["dirt_road"] },
  "35,29": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  "36,28": { type: "plains", name: "Farm Dirt Road", description: "A dirt road cutting through cultivated fields.", tags: ["dirt_road", "farm"] },
  // ── Forest Areas 1, 2, 3 ──
  "24,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "21,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "25,34": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["forest_1", "magic_lake"] },
  "25,35": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["forest_1", "magic_lake"] },
  "24,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "24,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "25,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "26,36": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["forest_1", "magic_lake"] },
  "25,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "26,37": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["forest_1", "magic_lake"] },
  "27,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "26,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "27,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "28,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["forest_1", "magic_lake"] },
  "28,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "25,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "24,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "25,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "22,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "23,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "24,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "24,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "23,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "21,37": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees. Forest Area 1+2.", tags: ["forest_1", "forest_2", "dungeon"] },
  "22,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "21,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "21,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "20,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "21,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "20,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "19,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "19,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "18,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "19,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "19,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "20,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "20,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "21,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "21,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "23,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1", "forest_2"] },
  "35,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "36,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "34,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "35,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "34,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_1"] },
  "22,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "16,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "16,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "16,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "16,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "16,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "17,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "19,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "19,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "20,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "20,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "20,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "19,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "19,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "17,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "18,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "17,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "16,41": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "16,40": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "16,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "15,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "15,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "16,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "16,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "14,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "15,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "19,38": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees. Forest Area 2.", tags: ["forest_2", "dungeon"] },
  "14,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "14,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "14,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "13,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "13,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "12,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "12,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "13,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "12,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "12,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "12,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2", "forest_3"] },
  "11,39": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_2"] },
  "12,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,38": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "8,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,37": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "6,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "6,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "5,34": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["forest_3"] },
  "4,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "5,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "4,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "3,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "5,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "6,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "6,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "7,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "8,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "8,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,36": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,35": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,34": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "8,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "8,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "9,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "10,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,34": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees. Forest Area 3.", tags: ["forest_3", "dungeon"] },
  "12,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "13,32": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "13,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "11,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "12,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "13,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "13,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "14,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "14,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "16,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "15,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "16,33": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["forest_3"] },
  "14,36": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees. Forest Area 3.", tags: ["forest_3", "dungeon"] },
  "18,34": { type: "forest", name: "Dungeon", description: "A dark entrance looms among the trees.", tags: ["dungeon"] },
  // ── Giant Forest (extended) ──
  "3,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "5,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "4,31": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "6,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "9,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "10,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "7,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "5,30": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,28": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "7,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "5,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "6,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "4,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,19": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,18": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,17": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,18": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "8,18": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "7,19": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,18": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,17": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "6,16": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  "4,17": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "5,19": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "7,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "7,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "7,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "7,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "10,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "11,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "11,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "12,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: [] },
  // ── Coral Forest hexes ──
  "10,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,26": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "8,19": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "8,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "9,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "10,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "9,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "8,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "10,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "10,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "10,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "11,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "12,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "12,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "12,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "14,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  "13,21": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest", "fungi_floor"] },
  "11,20": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["coral_forest"] },
  // ── Fungi Floor hexes ──
  "13,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "12,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "11,25": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,22": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,23": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,24": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,27": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,29": { type: "forest", name: "Giant Forest", description: "Dense woodland.", tags: ["fungi_floor"] },
  "3,25": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["fungi_floor"] },
  // ── Desert ──
  "5,13":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "6,14":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,14":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,15":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,15":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,16": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,16": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,16": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,15": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,15": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,15": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,15":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,14":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,14":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,13":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,13":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "6,13":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,12":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,12":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,11":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,10":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,9":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "7,8":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,8":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,7":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "15,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,7":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "21,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "22,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "24,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "25,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "24,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "24,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "23,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "23,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "23,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "22,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "22,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "22,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "22,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "21,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "21,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,15": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,15": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "21,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "21,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "20,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,14": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "19,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "18,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "17,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "15,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "16,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "15,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "15,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "15,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "14,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "13,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,13": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,13":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,12":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,11":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,10":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,8":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,12": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,11":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,11": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "12,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,8":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "11,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,9":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "10,10": { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,10":  { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "9,9":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  "8,9":   { type: "desert", name: "Desert", description: "Arid wasteland of sand and scorching heat.", tags: [] },
  // ── Black Swamps ──
  "25,9":  { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: ["desert_region"] },
  "25,20": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,20": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,19": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,20": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,19": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,18": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "31,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,11": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,11": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "28,10": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,9":  { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,10": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,11": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,11": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,10": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,10": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,11": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,12": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "27,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,18": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,18": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "23,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "22,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "26,14": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "25,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "24,13": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,15": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,16": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "29,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,17": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "30,18": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  "31,18": { type: "swamp", name: "Black Swamps", description: "Dark, treacherous marshland.", tags: [] },
  // ── Shoreline Peaks ──
  "31,16": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,15": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,16": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,17": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,17": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "33,18": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "33,17": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,18": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "33,19": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,19": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,20": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,20": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,21": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,21": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,22": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,23": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,22": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,23": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,24": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,24": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,25": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "37,26": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "37,27": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,27": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "38,28": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "37,29": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "37,30": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,14": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,13": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,12": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,11": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "30,11": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "30,10": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "29,10": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "28,9":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "27,9":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["black_swamps"] },
  "27,8":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "25,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "26,8":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "24,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "23,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "24,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "22,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "23,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "21,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "20,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "19,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "18,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["desert_region"] },
  "18,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "17,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "17,7":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["desert_region"] },
  "16,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "15,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "14,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "13,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "12,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "11,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "10,6":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "9,6":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "8,7":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["desert_region"] },
  "6,7":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "7,7":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: ["desert_region"] },
  "6,8":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,9":   { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,10":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,11":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,12":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "5,12":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "4,13":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,13":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,14":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,15":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "4,16":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,17":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "4,18":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,19":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "4,20":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,21":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,21":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,22":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,23":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,24":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,25":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,26":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,27":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,28":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,30":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,29":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,31":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,32":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "2,33":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "3,34":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "4,34":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "5,35":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,36":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "6,37":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "7,38":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "8,38":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "9,38":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "8,39":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "8,40":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "8,41":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "9,42":  { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "10,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "11,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "12,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "12,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "13,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "14,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "15,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "16,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "17,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "18,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "19,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "20,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "21,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "20,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "22,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "23,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "24,44": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "18,43": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "17,43": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "18,44": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "24,45": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "25,44": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "25,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "25,45": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "26,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "27,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "29,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "28,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "26,47": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "30,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,45": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,44": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,46": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,44": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "30,45": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,43": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "32,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "33,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,42": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "34,41": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,40": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "35,39": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,38": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,37": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "37,36": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "36,35": { type: "mountain", name: "Shoreline Peaks", description: "Rugged coastal mountains.", tags: [] },
  "31,32": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "32,33": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,34": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,35": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "34,36": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,36": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,37": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "34,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "33,39": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "32,39": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "32,40": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "31,39": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "30,39": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "29,39": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
  "29,38": { type: "water", name: "Magic Lake", description: "An enchanted lake shimmering with arcane energy.", tags: ["magic_lake"] },
};

// ── Seeded random (deterministic per hex) ──────────────────────────────────

function seededRand(q: number, r: number): number {
  let h = (q * 374761393 + r * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ── Procedural terrain ─────────────────────────────────────────────────────

function classifyHex(q: number, r: number): MapHex {
  const { x, y } = hexToPixel(q, r);
  const key = `${q},${r}`;
  const poi = POIS[key];
  if (poi) return { q, r, ...poi };

  // Outside island → water
  if (!pointInPoly(x, y, ISLAND_POLY)) return { q, r, type: "water" };

  // Kardov's Gate Lake (central)
  if (dist2(x, y, GATE_LAKE_CX, GATE_LAKE_CY) < GATE_LAKE_R) return { q, r, type: "water", name: r === 21 && q === 23 ? "Kardov's Gate" : undefined };

  // East lake
  if (dist2(x, y, EAST_LAKE_CX, EAST_LAKE_CY) < EAST_LAKE_R) return { q, r, type: "water", name: r === 28 && q === 31 ? "East Lake" : undefined };

  // Coast detection: check 10px outward — if outside polygon, we're near coast
  const dx = x - 300, dy = y - 270;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  if (!pointInPoly(x + (dx / len) * 10, y + (dy / len) * 10, ISLAND_POLY)) {
    return { q, r, type: "coast" };
  }

  const rand = seededRand(q, r);

  // ── Terrain zones mapped to actual map artwork ──────────────────────────
  //
  //  NORTH:  desert/sand (y < ~140, east of the jungle)
  //  WEST:   exotic jungle with mushrooms & purple flora (x < ~180, y 80–380)
  //  W-EDGE: mountain cliffs along west coast (x < ~140, rocky)
  //  CENTER: Kardov's Gate lake (handled above) + surrounding forest
  //  EAST:   plains/farmland around Newbsberd & east lake (x > ~320, y 180–400)
  //  SOUTH:  dense dark forest (y > ~300, except east plains)
  //  S-EDGE: swamp in low-lying southern areas (y > ~410, wet zones)
  //  RING:   coast (handled above)

  let type: HexType;

  // Jungle — exotic western forest (colorful mushrooms, purple flora)
  if (x < 180 && y > 80 && y < 380) {
    type = "jungle";
  }
  // Mountains — west coast cliffs
  else if (x < 150 && (y < 80 || y >= 380)) {
    type = "mountain";
  }
  // Desert — northern sand expanse (right of jungle)
  else if (y < 120 && x >= 180) {
    type = "desert";
  }
  // Desert transition — fades into grassland
  else if (y < 170 && x >= 180 && x < 400 && rand < 0.6) {
    type = "desert";
  }
  // Plains/farmland — east side around Newbsberd & east lake
  else if (x > 320 && y > 170 && y < 420) {
    type = rand < 0.15 ? "forest" : "plains";
  }
  // Swamp — low-lying wet southern areas & river margins
  else if (y > 410 && rand < 0.5) {
    type = "swamp";
  }
  // Swamp — around river connections between lakes
  else if (x > 260 && x < 360 && y > 260 && y < 330 && rand < 0.35) {
    type = "swamp";
  }
  // Forest — everything else on land (center, south, scattered)
  else {
    type = "forest";
  }

  return { q, r, type };
}

// ── Generate full grid (runs once) ──────────────────────────────────────────

const ALL_HEXES: MapHex[] = (() => {
  const out: MapHex[] = [];
  for (let q = 0; q < COLS; q++) for (let r = 0; r < ROWS; r++) out.push(classifyHex(q, r));
  return out;
})();

const LAND_HEXES = ALL_HEXES.filter(h => h.type !== "water");

// Kardov's Gate center for distance calculations
const CITY_CENTER = { q: 36, r: 32 };

// ── Colours ────────────────────────────────────────────────────────────────

const TYPE_FILL: Record<HexType, string> = {
  town:     "rgba(251,191,36,0.28)",
  forest:   "rgba(34,197,94,0.08)",
  desert:   "rgba(234,179,8,0.10)",
  jungle:   "rgba(168,85,247,0.10)",
  swamp:    "rgba(120,53,15,0.14)",
  water:    "rgba(0,0,0,0)",
  mountain: "rgba(156,163,175,0.12)",
  plains:   "rgba(201,168,76,0.05)",
  coast:    "rgba(59,130,246,0.04)",
};

const TYPE_EMOJI: Record<HexType, string> = {
  town: "\u{1F3D8}\uFE0F", forest: "\u{1F332}", desert: "\u{1F3DC}\uFE0F", jungle: "\u{1F334}",
  swamp: "\u{1FAB8}", water: "\u{1F30A}", mountain: "\u26F0\uFE0F", plains: "\u{1F33E}", coast: "\u{1F3D6}\uFE0F",
};

// ── Component ───────────────────────────────────────────────────────────────

export type HexAction = "rest" | "search";

export type ActionResult = {
  action: HexAction;
  roll?: number;
  description: string;
  daysCost: number;
  foodCost: number;
  hpChange: number;
  goldChange: number;
  foodChange: number;
};

export function performAction(action: HexAction, hex: MapHex, save: Pick<CharacterSave, "level" | "current_hp" | "max_hp" | "food" | "day">, con: number): ActionResult {
  if (action === "rest") {
    const foodCost = Math.min(save.food, FOOD_PER_DAY);
    const hasFoodForDay = save.food >= FOOD_PER_DAY;
    const healPerDay = Math.floor(Math.max(1, con) / 2) + save.level;
    const hpHealed = hasFoodForDay ? healPerDay : 0;
    const desc = hasFoodForDay
      ? `You rest for the day and recover ${hpHealed} HP.`
      : save.food > 0
        ? "You rest but don't have enough food to heal properly."
        : "You rest hungry. No healing without food.";
    return { action: "rest", description: desc, daysCost: 1, foodCost, hpChange: hpHealed, goldChange: 0, foodChange: 0 };
  }

  // Search — d20 roll, terrain-flavored
  const roll = Math.floor(Math.random() * 20) + 1;
  const isFarm = hex.tags?.includes("farm");
  const isDungeon = hex.tags?.includes("dungeon");

  if (roll >= 18) {
    // Great find
    const gold = isDungeon ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 10) + 3;
    const food = isFarm ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 1;
    const descs: Record<HexType, string> = {
      town: "You find a hidden stash in a back alley.",
      forest: "You discover a cache beneath a hollow tree.",
      desert: "Half-buried in the sand, you find supplies.",
      jungle: "You find exotic herbs worth good coin.",
      swamp: "Something gleams in the muck — treasure!",
      mountain: "You find a vein of ore in the rock face.",
      plains: isFarm ? "A farmer rewards you for helping out." : "You find a traveler's lost pack.",
      coast: "The tide reveals something washed ashore.",
      water: "You fish up something valuable.",
    };
    return { action: "search", roll, description: descs[hex.type] ?? "You find something useful!", daysCost: 1, foodCost: 0, hpChange: 0, goldChange: gold, foodChange: food };
  }

  if (roll <= 3) {
    // Bad outcome
    const dmg = isDungeon ? Math.floor(Math.random() * 3) + 2 : 1;
    const descs: Record<HexType, string> = {
      town: "You stumble into trouble and get roughed up.",
      forest: "A snake strikes from the undergrowth!",
      desert: "The heat exhausts you. You lose time and health.",
      jungle: "Poisonous thorns scratch you as you search.",
      swamp: "You step into a sinkhole and barely escape.",
      mountain: "Loose rocks tumble — you take a hit.",
      plains: "You twist your ankle in a hidden hole.",
      coast: "A wave knocks you against sharp rocks.",
      water: "The current pulls you under briefly.",
    };
    return { action: "search", roll, description: descs[hex.type] ?? "Your search goes badly.", daysCost: 1, foodCost: 0, hpChange: -dmg, goldChange: 0, foodChange: 0 };
  }

  // Nothing special
  return { action: "search", roll, description: "You search the area but find nothing of note.", daysCost: 1, foodCost: 0, hpChange: 0, goldChange: 0, foodChange: 0 };
}

type Props = {
  save: CharacterSave;
  character: NftCharacter | null;
  onTravel: (hex: { q: number; r: number }, result: ReturnType<typeof travel>, destHex: MapHex, encounter: WorldLuckResult) => void;
  onAction: (result: WorldLuckResult) => void;
  onBuyItem: (item: ShopItem) => void;
  onBattle: (difficulty: "easy" | "medium" | "hard") => void;
  onBack: () => void;
};

// ── Travel speed by terrain ─────────────────────────────────────────────
// Multiplier on hex cost: 1 hex normally = 1 day. Higher = slower.
// Roads (plains near towns) are fastest, mountains/jungle/swamp slowest.
const TERRAIN_SPEED: Record<HexType, number> = {
  town:     0.5,  // roads, safe
  plains:   0.75, // open ground, some roads
  coast:    1,    // sandy but passable
  desert:   1.25, // hot, tiring
  forest:   1,    // standard
  jungle:   1.5,  // dense, slow going
  mountain: 1.5,  // steep, treacherous
  swamp:    1.5,  // boggy, exhausting
  water:    2,    // fording/swimming — very slow on foot
};

const MAX_TRAVEL = 9; // ~same physical distance as old 5-hex limit on denser grid
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;

export function WorldMap({ save, character, onTravel, onAction, onBuyItem, onBattle, onBack }: Props) {
  const [selectedHex, setSelectedHex] = useState<MapHex | null>(null);
  const [zoom, setZoom] = useState(2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mappingMode, setMappingMode] = useState(false);
  const [markedHexes, setMarkedHexes] = useState<Set<string>>(new Set());
  const [lastAction, setLastAction] = useState<WorldLuckResult | null>(null);
  const [cityDistrict, setCityDistrict] = useState<string | null>(null); // "market" | "temple" | "high" | "low"
  const [cityShop, setCityShop] = useState<string | null>(null);         // shop or temple id
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const didCenter = useRef(false);

  const currentHex = ALL_HEXES.find(h => h.q === save.map_hex.q && h.r === save.map_hex.r);
  const con = character ? Math.max(1, character.stats.con) : 1;
  const wis = character ? Math.max(1, character.stats.wis) : 1;
  const wismod = Math.floor((wis - 10) / 2); // D&D-style ability modifier
  const playerPx = hexToPixel(save.map_hex.q, save.map_hex.r);
  const distFromCity = hexDistance(save.map_hex, CITY_CENTER);

  // Reachable hexes within MAX_TRAVEL (all terrain, including water)
  const reachableSet = useMemo(() => {
    const set = new Set<string>();
    ALL_HEXES.forEach(h => {
      const d = hexDistance(save.map_hex, h);
      if (d >= 1 && d <= MAX_TRAVEL) set.add(`${h.q},${h.r}`);
    });
    return set;
  }, [save.map_hex]);

  // Center on player
  const centerOnPlayer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Convert player viewBox coords to fraction of map, then offset so player is centered
    const px = -(playerPx.x / VB) * VB * zoom + rect.width / 2;
    const py = -(playerPx.y / VB) * VB * zoom + rect.height / 2;
    setPan({ x: px, y: py });
  }, [zoom, playerPx.x, playerPx.y]);

  // Auto-center on mount and when player moves
  useEffect(() => {
    if (!didCenter.current) {
      // Small delay to ensure container is rendered
      requestAnimationFrame(() => { centerOnPlayer(); didCenter.current = true; });
    } else {
      centerOnPlayer();
    }
  }, [centerOnPlayer]);

  // Mouse wheel → zoom (centered on cursor)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const oldZoom = zoom;
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(oldZoom + delta).toFixed(1)));
      if (newZoom === oldZoom) return;

      // Zoom toward cursor: adjust pan so the point under cursor stays fixed
      const scale = newZoom / oldZoom;
      setPan(p => ({
        x: mx - scale * (mx - p.x),
        y: my - scale * (my - p.y),
      }));
      setZoom(newZoom);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom]);

  // Click+drag to pan (suppress hex click if dragged > 5px)
  const wasDrag = useRef(false);
  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    wasDrag.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDrag.current = true;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function handleHexClick(hex: MapHex) {
    if (wasDrag.current) return; // ignore clicks after drag
    if (mappingMode) {
      const key = `${hex.q},${hex.r}`;
      setMarkedHexes(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      return;
    }
    setSelectedHex(prev => prev?.q === hex.q && prev?.r === hex.r ? null : hex);
  }

  /** Effective travel days = hex distance × terrain speed × road modifier */
  function travelDays(dist: number, hex: MapHex): number {
    let speed = TERRAIN_SPEED[hex.type] ?? 1;
    // Roads make travel faster
    if (hex.tags?.includes("road")) speed *= 0.5;       // King's Road — stone brick, fastest
    else if (hex.tags?.includes("dirt_road")) speed *= 0.7; // Dirt roads — still faster than open terrain
    return Math.max(1, Math.round(dist * speed));
  }

  function handleTravel() {
    if (!selectedHex) return;
    const dist = hexDistance(save.map_hex, selectedHex);
    if (dist === 0 || dist > MAX_TRAVEL) return;
    const effectiveDays = travelDays(dist, selectedHex);
    const result = travel(effectiveDays, save, con);
    const destDist = hexDistance(selectedHex, CITY_CENTER);
    const encounter = rollWorldLuck(selectedHex, "travel", wismod, destDist);
    onTravel({ q: selectedHex.q, r: selectedHex.r }, result, selectedHex, encounter);
    setSelectedHex(null);
  }

  function changeZoom(delta: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const oldZoom = zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(oldZoom + delta).toFixed(1)));
    const scale = newZoom / oldZoom;
    setPan(p => ({ x: cx - scale * (cx - p.x), y: cy - scale * (cy - p.y) }));
    setZoom(newZoom);
  }

  const mapSize = VB * zoom;

  return (
    <div className="flex flex-col gap-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg flex-wrap gap-2"
        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={onBack} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Back
        </button>
        <span className="text-sm font-black tracking-widest uppercase"
          style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Kardov&apos;s Gate
        </span>
        <div className="flex gap-3 text-xs" style={{ color: "rgba(232,213,176,0.6)" }}>
          <span>Lv{save.level}</span>
          <span>Day {save.day}</span>
          <span>{"\u{1F356}"}{save.food}</span>
          <span>{"\u2764\uFE0F"}{save.current_hp}/{save.max_hp}</span>
          <span>{"\u{1FA99}"}{save.gold}</span>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="flex gap-2 flex-col lg:flex-row">
        {/* Zoomable map container */}
        <div className="flex-1 flex flex-col gap-1">
          <div ref={containerRef} className="overflow-hidden rounded-lg select-none"
            style={{ height: "min(70vh, 560px)", background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.1)", cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div className="relative" style={{ width: mapSize, height: mapSize, transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kardovs-gate-map.jpg" alt="Kardov's Gate"
                className="absolute inset-0 w-full h-full" style={{ opacity: 0.8 }} draggable={false} />
              <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
                {ALL_HEXES.map(hex => {
                  const { x, y } = hexToPixel(hex.q, hex.r);
                  const key = `${hex.q},${hex.r}`;
                  const isCurrent = hex.q === save.map_hex.q && hex.r === save.map_hex.r;
                  const isReachable = reachableSet.has(key);
                  const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r;
                  const dist = hexDistance(save.map_hex, hex);

                  if (hex.type === "water" && !hex.name && !mappingMode && !markedHexes.has(key)) return null; // skip plain water

                  let fill = TYPE_FILL[hex.type];
                  let stroke = "rgba(201,168,76,0.06)";
                  let sw = 0.2;

                  const isMarked = markedHexes.has(key);

                  if (isMarked) { fill = "rgba(255,0,255,0.35)"; stroke = "rgba(255,0,255,0.9)"; sw = 0.8; }
                  else if (isCurrent) { fill = "rgba(96,165,250,0.35)"; stroke = "rgba(96,165,250,0.9)"; sw = 0.8; }
                  else if (isSelected) { fill = "rgba(251,191,36,0.25)"; stroke = "rgba(251,191,36,0.8)"; sw = 0.8; }
                  else if (isReachable && hex.type !== "water") { stroke = "rgba(74,222,128,0.45)"; sw = 0.5; }

                  return (
                    <g key={key} style={{ pointerEvents: "all", cursor: mappingMode ? "crosshair" : hex.type !== "water" ? "pointer" : "default" }}
                      onClick={() => handleHexClick(hex)}>
                      <polygon points={hexPolygon(x, y, HEX_SIZE * 0.95)} fill={fill} stroke={stroke} strokeWidth={sw} />
                      {isCurrent && (
                        <text x={x} y={y + 0.8} textAnchor="middle" dominantBaseline="central"
                          fontSize={5} style={{ pointerEvents: "none" }}>
                          {"\u{1F9D9}"}
                        </text>
                      )}
                      {!isCurrent && isReachable && hex.type !== "water" && (
                        <text x={x} y={y - HEX_SIZE * 0.15} textAnchor="middle"
                          fontSize={2.2} fill="rgba(74,222,128,0.9)" fontWeight="bold"
                          style={{ pointerEvents: "none" }}>
                          {dist}d
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => changeZoom(-0.3)} className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.6)", border: "1px solid rgba(201,168,76,0.15)" }}>
              -
            </button>
            <span className="text-xs" style={{ color: "rgba(201,168,76,0.4)" }}>{zoom.toFixed(1)}x</span>
            <button onClick={() => changeZoom(0.3)} className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.6)", border: "1px solid rgba(201,168,76,0.15)" }}>
              +
            </button>
            <button onClick={centerOnPlayer} className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.7)", border: "1px solid rgba(96,165,250,0.2)" }}>
              Center
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-64 flex flex-col gap-2">
          {/* Mapping mode */}
          <div className="px-3 py-2 rounded-lg" style={{ background: mappingMode ? "rgba(255,0,255,0.1)" : "rgba(0,0,0,0.2)", border: `1px solid ${mappingMode ? "rgba(255,0,255,0.4)" : "rgba(201,168,76,0.1)"}` }}>
            <button onClick={() => setMappingMode(m => !m)}
              className="w-full px-2 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: mappingMode ? "rgba(255,0,255,0.2)" : "rgba(255,255,255,0.05)", color: mappingMode ? "rgba(255,0,255,0.9)" : "rgba(201,168,76,0.6)", border: `1px solid ${mappingMode ? "rgba(255,0,255,0.5)" : "rgba(201,168,76,0.15)"}` }}>
              {mappingMode ? "Mapping ON" : "Map Mode"}
            </button>
            {mappingMode && markedHexes.size > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: "0.5rem", color: "rgba(255,0,255,0.7)" }}>{markedHexes.size} hex{markedHexes.size > 1 ? "es" : ""} marked</span>
                  <div className="flex gap-1">
                    <button onClick={() => { navigator.clipboard.writeText([...markedHexes].join("\n")); }}
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ fontSize: "0.45rem", background: "rgba(255,0,255,0.15)", color: "rgba(255,0,255,0.8)", border: "1px solid rgba(255,0,255,0.3)" }}>
                      Copy
                    </button>
                    <button onClick={() => setMarkedHexes(new Set())}
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ fontSize: "0.45rem", background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.3)" }}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" style={{ fontSize: "0.5rem", fontFamily: "monospace", color: "rgba(255,0,255,0.8)" }}>
                  {[...markedHexes].map(k => <span key={k} className="px-1 rounded" style={{ background: "rgba(255,0,255,0.1)" }}>{k}</span>)}
                </div>
              </div>
            )}
          </div>
          {/* Current location */}
          <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(96,165,250,0.8)", fontSize: "0.55rem" }}>
                Current Location
              </span>
              <span style={{ fontSize: "0.5rem", color: "rgba(96,165,250,0.5)", fontFamily: "monospace" }}>
                {save.map_hex.q},{save.map_hex.r}
              </span>
            </div>
            <div className="text-sm font-bold" style={{ color: "rgba(232,213,176,0.9)" }}>
              {TYPE_EMOJI[currentHex?.type ?? "plains"]} {currentHex?.name ?? currentHex?.type ?? "Unknown"}
            </div>
            {currentHex?.description && (
              <div className="mt-1" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.5)", lineHeight: 1.4 }}>
                {currentHex.description}
              </div>
            )}
            {currentHex && currentHex.type !== "town" && (() => {
              const zone = getZone(currentHex.q, currentHex.r);
              const lvRange = getLevelRange(currentHex.q, currentHex.r, distFromCity);
              return (
                <div className="mt-1 flex items-center gap-2" style={{ fontSize: "0.5rem" }}>
                  <span style={{ color: "rgba(232,213,176,0.4)" }}>World Luck on travel/rest/search</span>
                  <span className="px-1 rounded" style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.7)", fontSize: "0.4rem" }}>
                    {zone ? zone.name : "Wilds"} Lv{lvRange[0]}-{lvRange[1]}
                  </span>
                </div>
              );
            })()}
            {/* ── City District System ── */}
            {currentHex?.type === "town" && (() => {
              const isKardov = currentHex.name === "Kardov\u2019s Gate" || currentHex.name === "Kardov's Gate";
              const healPerDay = Math.floor(Math.max(1, con) / 2) + save.level;
              const commonCost = 1;  // PHB: common inn 5sp + meal 3sp ≈ 1gp
              const luxuryCost = 3;  // PHB: good inn 2gp + meal 5sp ≈ 3gp
              const luxuryHealBonus = Math.floor(save.level / 2) + 2;

              const districts = [
                { id: "market", name: "Market District", emoji: "\u{1F6D2}", desc: "Shops and merchants" },
                { id: "temple", name: "Temple District", emoji: "\u26EA", desc: "Places of worship and power" },
                { id: "high", name: "High District", emoji: "\u{1F451}", desc: "Luxury services" },
                { id: "low", name: "Low District", emoji: "\u{1F3DA}\uFE0F", desc: "Common folk, cheap rest" },
              ];

              const temples = [
                { id: "earth", name: "Temple of the Earthmother", emoji: "\u{1F30D}", desc: "Blessings of stone and soil. Healing and endurance rituals." },
                { id: "air", name: "Temple of the Windcaller", emoji: "\u{1F32C}\uFE0F", desc: "Prayers carried on the breeze. Speed and evasion blessings." },
                { id: "water", name: "Temple of the Tidewarden", emoji: "\u{1F30A}", desc: "The cleansing waters restore body and spirit." },
                { id: "sun", name: "Temple of the Dawnfire", emoji: "\u2600\uFE0F", desc: "The sun's radiance burns away corruption." },
                ...(isKardov ? [
                  { id: "base", name: "Temple of BASE Power", emoji: "\u{1F535}", desc: "Channel the power of the Base chain. Power-ups for your NFT heroes." },
                  { id: "pol", name: "Temple of POL Power", emoji: "\u{1F7E3}", desc: "Tap into Polygon's energy. Power-ups for your NFT heroes." },
                ] : []),
              ];

              const shops = getShopsForLocation(isKardov);

              // ── No district selected: show district buttons ──
              if (!cityDistrict) {
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div style={{ fontSize: "0.45rem", color: "rgba(74,222,128,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                      City Districts
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {districts.map(d => (
                        <button key={d.id} onClick={() => { setCityDistrict(d.id); setCityShop(null); }}
                          className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all hover:scale-105"
                          style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                          <span style={{ fontSize: "0.8rem" }}>{d.emoji}</span>
                          <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.45rem" }}>{d.name}</span>
                          <span style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.35)" }}>{d.desc}</span>
                        </button>
                      ))}
                    </div>
                    {/* Quick actions always visible */}
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => {
                          const result = rollWorldLuck(currentHex, "rest", wismod, distFromCity);
                          setLastAction(result); onAction(result);
                        }}
                        disabled={save.food === 0 && save.current_hp >= save.max_hp}
                        className="flex-1 px-2 py-1 rounded text-xs"
                        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,213,176,0.4)", border: "1px solid rgba(201,168,76,0.08)", fontSize: "0.45rem", opacity: save.food === 0 && save.current_hp >= save.max_hp ? 0.3 : 1 }}>
                        Street Rest
                      </button>
                      <button onClick={() => {
                          const result = rollWorldLuck(currentHex, "search", wismod, distFromCity);
                          setLastAction(result); onAction(result);
                        }}
                        className="flex-1 px-2 py-1 rounded text-xs"
                        style={{ background: "rgba(251,191,36,0.05)", color: "rgba(251,191,36,0.5)", border: "1px solid rgba(251,191,36,0.1)", fontSize: "0.45rem" }}>
                        Search Streets
                      </button>
                    </div>
                  </div>
                );
              }

              // ── Market District ──
              if (cityDistrict === "market") {
                if (!cityShop) {
                  return (
                    <div className="mt-2 flex flex-col gap-1">
                      <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                        ← Back to Districts
                      </button>
                      <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                        {"\u{1F6D2}"} Market District
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {shops.map(shop => (
                          <button key={shop.id} onClick={() => setCityShop(shop.id)}
                            className="w-full text-left px-2 py-1.5 rounded transition-all hover:bg-white/5"
                            style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.08)" }}>
                            <span style={{ fontSize: "0.55rem" }}>{shop.emoji}</span>
                            <span className="ml-1 text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.5rem" }}>{shop.name}</span>
                            <span className="ml-1" style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.35)" }}>— {shop.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                // ── Inside a shop ──
                const shop = shops.find(s => s.id === cityShop);
                if (!shop) { setCityShop(null); return null; }
                const items = getAvailableItems(shop, save.day, isKardov);
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex gap-1">
                      <button onClick={() => setCityShop(null)} className="px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                        ← Shops
                      </button>
                      <button onClick={() => { setCityDistrict(null); setCityShop(null); }} className="px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.3)", border: "1px solid rgba(201,168,76,0.06)", fontSize: "0.4rem" }}>
                        ← Districts
                      </button>
                    </div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.8)" }} className="font-bold">
                      {shop.emoji} {shop.name}
                    </div>
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
                      {items.map(item => {
                        const canBuy = save.gold >= item.buyPrice;
                        return (
                          <div key={item.id} className="flex items-center gap-1 px-2 py-1 rounded"
                            style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.06)" }}>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold truncate" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.5rem" }}>{item.name}</div>
                              <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.35)" }}>{item.description}</div>
                              {item.effect && <div style={{ fontSize: "0.35rem", color: "rgba(96,165,250,0.5)" }}>{item.effect}</div>}
                            </div>
                            <button onClick={() => { if (canBuy) onBuyItem(item); }}
                              disabled={!canBuy}
                              className="px-2 py-0.5 rounded whitespace-nowrap"
                              style={{
                                background: canBuy ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.02)",
                                color: canBuy ? "rgba(74,222,128,0.8)" : "rgba(232,213,176,0.2)",
                                border: `1px solid ${canBuy ? "rgba(74,222,128,0.2)" : "rgba(201,168,76,0.05)"}`,
                                fontSize: "0.45rem",
                              }}>
                              {item.buyPrice}g
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // ── Temple District ──
              if (cityDistrict === "temple") {
                if (!cityShop) {
                  return (
                    <div className="mt-2 flex flex-col gap-1">
                      <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                        ← Back to Districts
                      </button>
                      <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                        {"\u26EA"} Temple District
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {temples.map(t => (
                          <button key={t.id} onClick={() => setCityShop(t.id)}
                            className="w-full text-left px-2 py-1.5 rounded transition-all hover:bg-white/5"
                            style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.08)" }}>
                            <span style={{ fontSize: "0.55rem" }}>{t.emoji}</span>
                            <span className="ml-1 text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.5rem" }}>{t.name}</span>
                            <div style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.35)" }}>{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                // ── Inside a temple ──
                const temple = temples.find(t => t.id === cityShop);
                if (!temple) { setCityShop(null); return null; }
                const isElemental = ["earth", "air", "water", "sun"].includes(temple.id);
                const isPower = ["base", "pol"].includes(temple.id);
                const blessingCost = { earth: 5, air: 5, water: 10, sun: 15 }[temple.id] ?? 5;
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex gap-1">
                      <button onClick={() => setCityShop(null)} className="px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                        ← Temples
                      </button>
                      <button onClick={() => { setCityDistrict(null); setCityShop(null); }} className="px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.3)", border: "1px solid rgba(201,168,76,0.06)", fontSize: "0.4rem" }}>
                        ← Districts
                      </button>
                    </div>
                    <div style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.8)" }} className="font-bold">
                      {temple.emoji} {temple.name}
                    </div>
                    <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.45)", lineHeight: 1.4 }}>{temple.desc}</div>
                    {isElemental && (
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => {
                            if (save.gold >= blessingCost) {
                              const healAmt = save.max_hp - save.current_hp;
                              const result: WorldLuckResult = {
                                worldRoll: 0, skillRoll: 0, skillDC: 0,
                                interaction: "rest", outcome: "nothing",
                                description: `The priests restore your body. Full HP restored.`,
                                hpChange: healAmt, goldChange: -blessingCost, foodChange: 0, xpChange: 0,
                              };
                              setLastAction(result); onAction(result);
                            }
                          }}
                          disabled={save.gold < blessingCost || save.current_hp >= save.max_hp}
                          className="px-2 py-1.5 rounded text-xs font-bold"
                          style={{
                            background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)",
                            border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.5rem",
                            opacity: save.gold < blessingCost || save.current_hp >= save.max_hp ? 0.4 : 1,
                          }}>
                          Healing Prayer ({blessingCost}g) — Full HP
                        </button>
                        <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.3)" }}>
                          More blessings coming soon...
                        </div>
                      </div>
                    )}
                    {isPower && (
                      <div className="flex flex-col gap-1">
                        <div className="px-2 py-2 rounded text-center"
                          style={{ background: temple.id === "base" ? "rgba(59,130,246,0.08)" : "rgba(139,92,246,0.08)", border: `1px solid ${temple.id === "base" ? "rgba(59,130,246,0.2)" : "rgba(139,92,246,0.2)"}` }}>
                          <div style={{ fontSize: "0.5rem", color: temple.id === "base" ? "rgba(59,130,246,0.8)" : "rgba(139,92,246,0.8)" }} className="font-bold">
                            {temple.id === "base" ? "BASE Chain" : "Polygon Chain"} Power-Ups
                          </div>
                          <div style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.35)", marginTop: 4 }}>
                            Enhance your NFT hero with on-chain power. Requires wallet connection.
                          </div>
                          <button onClick={() => onBack()}
                            className="mt-2 px-3 py-1 rounded text-xs font-bold uppercase"
                            style={{
                              background: temple.id === "base" ? "rgba(59,130,246,0.15)" : "rgba(139,92,246,0.15)",
                              color: temple.id === "base" ? "rgba(59,130,246,0.9)" : "rgba(139,92,246,0.9)",
                              border: `1px solid ${temple.id === "base" ? "rgba(59,130,246,0.3)" : "rgba(139,92,246,0.3)"}`,
                              fontSize: "0.45rem",
                            }}>
                            Visit Power-Up Altar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // ── High District (luxury inn, guild hall future) ──
              if (cityDistrict === "high") {
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                      style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                      ← Back to Districts
                    </button>
                    <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                      {"\u{1F451}"} High District
                    </div>
                    {isKardov && (
                      <button onClick={() => {
                          const totalHeal = healPerDay + luxuryHealBonus;
                          const result: WorldLuckResult = {
                            worldRoll: 0, skillRoll: 0, skillDC: 0,
                            interaction: "rest", outcome: "nothing",
                            description: `A private room at the luxury inn. Fine wine, roast beef, and a feather bed restore ${totalHeal} HP.`,
                            hpChange: totalHeal, goldChange: -luxuryCost, foodChange: 0, xpChange: 0,
                          };
                          setLastAction(result); onAction(result);
                        }}
                        disabled={save.gold < luxuryCost}
                        className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{ background: "rgba(201,168,76,0.15)", color: "rgba(201,168,76,0.9)", border: "1px solid rgba(201,168,76,0.4)", opacity: save.gold < luxuryCost ? 0.4 : 1 }}>
                        Luxury Inn (1d, {luxuryCost}g) — Safe, extra healing
                      </button>
                    )}
                    <div className="px-2 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.1)", border: "1px solid rgba(201,168,76,0.06)" }}>
                      <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.4)" }}>
                        {"\u{1F3DB}\uFE0F"} Guild Hall — <span style={{ color: "rgba(201,168,76,0.3)" }}>Coming soon</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Low District (common inn, street rest, tavern) ──
              if (cityDistrict === "low") {
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                      style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                      ← Back to Districts
                    </button>
                    <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                      {"\u{1F3DA}\uFE0F"} Low District
                    </div>
                    <button onClick={() => {
                        const result: WorldLuckResult = {
                          worldRoll: 0, skillRoll: 0, skillDC: 0,
                          interaction: "rest", outcome: "nothing",
                          description: `A raised bed by the hearth at the common inn. Chicken stew and watered ale restore ${healPerDay} HP.`,
                          hpChange: healPerDay, goldChange: -commonCost, foodChange: 0, xpChange: 0,
                        };
                        setLastAction(result); onAction(result);
                      }}
                      disabled={save.gold < commonCost}
                      className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                      style={{ background: "rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.9)", border: "1px solid rgba(96,165,250,0.3)", opacity: save.gold < commonCost ? 0.4 : 1 }}>
                      Common Inn (1d, {commonCost}g) — Safe
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => {
                          const result = rollWorldLuck(currentHex, "rest", wismod, distFromCity);
                          setLastAction(result); onAction(result);
                        }}
                        disabled={save.food === 0 && save.current_hp >= save.max_hp}
                        className="flex-1 px-2 py-1 rounded text-xs"
                        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,213,176,0.5)", border: "1px solid rgba(201,168,76,0.08)", fontSize: "0.45rem", opacity: save.food === 0 && save.current_hp >= save.max_hp ? 0.3 : 1 }}>
                        Street Rest (free)
                      </button>
                      <button onClick={() => {
                          const result = rollWorldLuck(currentHex, "search", wismod, distFromCity);
                          setLastAction(result); onAction(result);
                        }}
                        className="flex-1 px-2 py-1 rounded text-xs"
                        style={{ background: "rgba(251,191,36,0.05)", color: "rgba(251,191,36,0.5)", border: "1px solid rgba(251,191,36,0.08)", fontSize: "0.45rem" }}>
                        Search Streets
                      </button>
                    </div>
                    <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.25)" }}>
                      Inns are safe. Street rest uses food and rolls world luck.
                    </div>
                    <div className="px-2 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.1)", border: "1px solid rgba(201,168,76,0.06)" }}>
                      <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.4)" }}>
                        {"\u{1F37A}"} Tavern (rumors & quests) — <span style={{ color: "rgba(201,168,76,0.3)" }}>Coming soon</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })()}
            {currentHex && currentHex.type !== "town" && (
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const result = rollWorldLuck(currentHex, "rest", wismod, distFromCity);
                      setLastAction(result);
                      onAction(result);
                    }}
                    disabled={currentHex.type === "water" || (save.food === 0 && save.current_hp >= save.max_hp)}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                    style={{
                      background: "rgba(96,165,250,0.15)",
                      color: "rgba(96,165,250,0.9)",
                      border: "1px solid rgba(96,165,250,0.3)",
                      opacity: currentHex.type === "water" || (save.food === 0 && save.current_hp >= save.max_hp) ? 0.4 : 1,
                    }}>
                    Rest (1d)
                  </button>
                  <button
                    onClick={() => {
                      const result = rollWorldLuck(currentHex, "search", wismod, distFromCity);
                      setLastAction(result);
                      onAction(result);
                    }}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                    style={{
                      background: "rgba(251,191,36,0.15)",
                      color: "rgba(251,191,36,0.9)",
                      border: "1px solid rgba(251,191,36,0.3)",
                    }}>
                    Search (1d)
                  </button>
                </div>
                {currentHex.type === "water" && (
                  <div style={{ fontSize: "0.45rem", color: "rgba(220,38,38,0.6)" }}>
                    Can&apos;t rest on water without a boat
                  </div>
                )}
              </div>
            )}

            {/* Last action result */}
            {lastAction && (
              <div className="mt-1.5 px-2 py-1.5 rounded" style={{
                background: lastAction.outcome === "fight" ? "rgba(220,38,38,0.15)"
                  : lastAction.outcome === "minor_find" || lastAction.outcome === "major_find" ? "rgba(74,222,128,0.1)"
                  : lastAction.outcome === "hazard" ? "rgba(251,191,36,0.1)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${lastAction.outcome === "fight" ? "rgba(220,38,38,0.3)"
                  : lastAction.outcome === "minor_find" || lastAction.outcome === "major_find" ? "rgba(74,222,128,0.2)"
                  : "rgba(251,191,36,0.2)"}`,
                fontSize: "0.5rem", color: "rgba(232,213,176,0.7)", lineHeight: 1.4,
              }}>
                <div className="font-bold mb-0.5" style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.5)" }}>
                  {lastAction.interaction.toUpperCase()} — {lastAction.outcome.replace("_", " ").toUpperCase()}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    (luck:{lastAction.worldRoll} skill:{lastAction.skillRoll}{lastAction.skillDC > 0 ? ` vs DC${lastAction.skillDC}` : ""})
                  </span>
                </div>
                {lastAction.description}
                {/* Monster details for fights */}
                {lastAction.encounter && (
                  <div className="mt-0.5" style={{ fontSize: "0.45rem", color: "rgba(220,38,38,0.7)" }}>
                    {lastAction.encounter.monsters.map((m, i) => (
                      <span key={i}>
                        {m.count > 1 ? `${m.count}x ` : ""}{m.monster.name}
                        {" "}(HP:{m.monster.hp} AC:{m.monster.ac} ATK:{m.monster.attack})
                      </span>
                    ))}
                  </div>
                )}
                {/* Loot details for finds */}
                {lastAction.loot && lastAction.loot.items.length > 0 && (
                  <div className="mt-0.5" style={{ fontSize: "0.45rem", color: "rgba(74,222,128,0.7)" }}>
                    {lastAction.loot.items.map((item, i) => (
                      <div key={i}>{item.name} ({item.value}g) — {item.description}</div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-0.5" style={{ color: "rgba(232,213,176,0.5)" }}>
                  {lastAction.hpChange !== 0 && <span>{lastAction.hpChange > 0 ? "+" : ""}{lastAction.hpChange} HP</span>}
                  {lastAction.goldChange > 0 && <span>+{lastAction.goldChange} gold</span>}
                  {lastAction.foodChange > 0 && <span>+{lastAction.foodChange} food</span>}
                  {lastAction.xpChange > 0 && <span>+{lastAction.xpChange} XP</span>}
                </div>
              </div>
            )}
          </div>

          {/* Selected hex info */}
          {selectedHex && !(selectedHex.q === save.map_hex.q && selectedHex.r === save.map_hex.r) && (
            <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.8)", fontSize: "0.55rem" }}>
                  {TYPE_EMOJI[selectedHex.type]} {selectedHex.name ?? selectedHex.type}
                </span>
                <span style={{ fontSize: "0.5rem", color: "rgba(251,191,36,0.5)", fontFamily: "monospace" }}>
                  {selectedHex.q},{selectedHex.r}
                </span>
              </div>
              {selectedHex.description && (
                <div style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.5)", lineHeight: 1.4 }}>
                  {selectedHex.description}
                </div>
              )}
              <div className="mt-1" style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.35)" }}>
                {selectedHex.type === "town" ? "Safe zone" : (() => {
                  const z = getZone(selectedHex.q, selectedHex.r);
                  const lr = getLevelRange(selectedHex.q, selectedHex.r, hexDistance(selectedHex, CITY_CENTER));
                  return `World Luck on entry · ${z ? z.name : "Wilds"} Lv${lr[0]}-${lr[1]}`;
                })()}
              </div>
              {(() => {
                const dist = hexDistance(save.map_hex, selectedHex);
                if (dist === 0) return null;
                const days = travelDays(dist, selectedHex);
                const preview = travel(days, save, con);
                const hasRoad = selectedHex.tags?.includes("road") || selectedHex.tags?.includes("dirt_road");
                const speedLabel = hasRoad ? "road" : (TERRAIN_SPEED[selectedHex.type] ?? 1) < 1 ? "fast" : (TERRAIN_SPEED[selectedHex.type] ?? 1) === 1 ? "normal" : "slow";
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
                      <span>Distance:</span><span className="font-bold">{dist} hex{dist > 1 ? "es" : ""}</span>
                      <span>Travel time:</span><span className="font-bold">{days} day{days > 1 ? "s" : ""} ({speedLabel})</span>
                      <span>Food cost:</span><span className="font-bold">{days * FOOD_PER_DAY} {"\u{1F356}"}{preview.starving ? " (!)" : ""}</span>
                      <span>Healing:</span><span className="font-bold">+{preview.hpHealed} HP</span>
                    </div>
                    {dist <= MAX_TRAVEL && (
                      <button onClick={handleTravel}
                        className="mt-1 w-full px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{
                          background: preview.starving ? "rgba(220,38,38,0.15)" : "rgba(74,222,128,0.15)",
                          color: preview.starving ? "rgba(220,38,38,0.9)" : "rgba(74,222,128,0.9)",
                          border: `1px solid ${preview.starving ? "rgba(220,38,38,0.4)" : "rgba(74,222,128,0.4)"}`,
                        }}>
                        {"\u{1F6B6}"} Travel ({days}d)
                      </button>
                    )}
                    {dist > MAX_TRAVEL && (
                      <div className="mt-1 text-center" style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)" }}>
                        Too far — max {MAX_TRAVEL} hexes per move
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Supplies */}
          <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>Supplies</div>
            <div className="grid grid-cols-2 gap-0.5" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
              <span>{"\u{1F356}"} Food</span><span className="font-bold">{save.food} ({Math.floor(save.food / FOOD_PER_DAY)} days)</span>
              <span>{"\u2764\uFE0F"} Health</span><span className="font-bold">{save.current_hp}/{save.max_hp}</span>
              <span>{"\u{1FA99}"} Gold</span><span className="font-bold">{save.gold}</span>
              <span>{"\u{1F4C5}"} Day</span><span className="font-bold">{save.day}</span>
              <span>{"\u2B50"} XP</span><span className="font-bold">{save.xp}</span>
              <span>{"\u{1F3AF}"} Heal/day</span><span className="font-bold">{Math.floor(con / 2) + save.level} HP</span>
            </div>
          </div>

          {/* Character info */}
          {character && (
            <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>Character</div>
              <div className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)" }}>{character.name}</div>
              <div className="flex flex-wrap gap-1 mt-1" style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.4)" }}>
                <span>STR {character.stats.str.toFixed(0)}</span>
                <span>DEX {character.stats.dex.toFixed(0)}</span>
                <span>CON {character.stats.con.toFixed(0)}</span>
                <span>INT {character.stats.int.toFixed(0)}</span>
                <span>WIS {character.stats.wis.toFixed(0)}</span>
                <span>CHA {character.stats.cha.toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
