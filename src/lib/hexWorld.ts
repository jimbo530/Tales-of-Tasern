// hexWorld.ts — Infinite Procedural Hex World Generator for Tales of Tasern
// Deterministic seed-based generation. Same seed = same world, always.
// Chunks are 16x16 hexes generated on demand. Kardov's Gate fixed at (36, 32).

// ============================================================================
//  SIMPLEX NOISE (2D) — self-contained, no external deps
// ============================================================================

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD3: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

class SimplexNoise {
  private perm: Uint8Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    // Seed-based permutation using xorshift
    let s = seed >>> 0;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const j = (s >>> 0) % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x: number, y: number): number {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = this.perm[ii + this.perm[jj]] % 12;
      n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
      n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
      n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
    }

    // Returns value in [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }
}

// ============================================================================
//  SEEDED RNG — deterministic random from coordinates
// ============================================================================

function hashCoord(q: number, r: number, seed: number): number {
  // Murmur-inspired hash for coordinate-based randomness
  let h = seed ^ 0xdeadbeef;
  h = Math.imul(h ^ q, 0x9e3779b9);
  h = Math.imul(h ^ r, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff; // [0, 1)
}

function hashCoordN(q: number, r: number, seed: number, n: number): number {
  // Nth random value for a coordinate (varies the seed)
  return hashCoord(q * 7 + n * 13, r * 11 + n * 17, seed + n * 31);
}

// ============================================================================
//  TYPES
// ============================================================================

export type Coord = { q: number; r: number };

export type Terrain =
  | "grass" | "forest" | "mountain" | "desert" | "swamp"
  | "water" | "snow" | "volcanic" | "fungal" | "cursed"
  | "highlands" | "jungle" | "coast" | "plains";

export type Biome =
  | "ocean" | "lake" | "coast" | "desert" | "savanna"
  | "plains" | "grassland" | "forest" | "jungle" | "swamp"
  | "marsh" | "highlands" | "mountain" | "snow_peak"
  | "tundra" | "volcanic" | "fungal_forest" | "cursed_lands"
  | "crystal_caves";

export type Resource =
  | "timber" | "stone" | "iron" | "gold_ore" | "gems"
  | "herbs" | "mushrooms" | "fish" | "game" | "water"
  | "clay" | "salt" | "obsidian" | "crystals" | "peat";

export type POIType =
  | "village" | "dungeon" | "ruins" | "shrine" | "camp"
  | "cave" | "tower" | "port" | "fort" | "mine"
  | "monastery" | "crossroads" | "oasis" | "grove";

export type POI = {
  type: POIType;
  name: string;
  q: number;
  r: number;
  dangerLevel: number;
  description: string;
  discovered: boolean;
};

export type HexData = {
  q: number;
  r: number;
  terrain: Terrain;
  biome: Biome;
  elevation: number;       // 0-10
  moisture: number;        // 0-1 (raw noise value, normalized)
  temperature: number;     // 0-1 (raw noise value, normalized)
  movementCost: number;    // 1-4
  visibility: number;      // how many hexes you can see from here
  dangerLevel: number;     // 0-10
  resources: Resource[];
  poi: POI | null;
  description: string;
  revealed: boolean;
};

export type Encounter = {
  monsterIds: string[];
  count: number;
  dangerLevel: number;
  terrain: Terrain;
  description: string;
  isBoss: boolean;
};

export type ChunkCoord = { cq: number; cr: number };

// ============================================================================
//  CONSTANTS
// ============================================================================

const CHUNK_SIZE = 16;
const KARDOV_GATE: Coord = { q: 36, r: 32 };

// Movement costs by terrain
const MOVEMENT_COSTS: Record<Terrain, number> = {
  grass: 1, plains: 1, coast: 1,
  forest: 2, highlands: 2, jungle: 2,
  desert: 2, swamp: 3, fungal: 2,
  mountain: 3, snow: 3, volcanic: 3,
  cursed: 3, water: 4,
};

// Visibility range by terrain (how far you can see FROM this hex)
const VISIBILITY_RANGE: Record<Terrain, number> = {
  plains: 4, grass: 3, coast: 4, desert: 5,
  highlands: 5, mountain: 6, snow: 4,
  forest: 2, jungle: 1, swamp: 2, fungal: 2,
  cursed: 1, volcanic: 3, water: 5,
};

// Monsters by terrain affinity
const TERRAIN_MONSTERS: Record<Terrain, string[]> = {
  grass: ["wolf", "dire_rat", "goblin", "kobold", "giant_bee"],
  plains: ["wolf", "gnoll", "orc", "giant_ant_worker", "hyena"],
  forest: ["wolf", "bear", "dire_rat", "spider", "stirge", "goblin", "fenmaw"],
  jungle: ["spider", "snake", "stirge", "lizardfolk", "giant_centipede"],
  desert: ["scorpion", "gnoll", "mummy", "jackal", "hyena"],
  swamp: ["lizardfolk", "stirge", "giant_frog", "crocodile", "will_o_wisp"],
  mountain: ["orc", "ogre", "hobgoblin", "griffin", "wyvern"],
  highlands: ["hobgoblin", "orc", "wolf", "giant_eagle"],
  snow: ["winter_wolf", "yeti", "frost_giant", "dire_wolf"],
  volcanic: ["fire_elemental", "salamander", "hell_hound", "magma_mephit"],
  coast: ["sahuagin", "crab", "merfolk", "pirate"],
  water: ["shark", "merfolk", "kraken", "sea_serpent"],
  fungal: ["myconid", "violet_fungus", "shrieker", "spore_zombie"],
  cursed: ["skeleton", "zombie", "wraith", "ghoul", "shadow", "spectre"],
};

// Village name parts for procedural generation
const VILLAGE_PREFIXES = [
  "Ash", "Elm", "Oak", "Iron", "Stone", "River", "Mill", "Black",
  "Red", "Green", "White", "Grey", "Silver", "Gold", "Copper", "Salt",
  "Thorn", "Moss", "Fern", "Bramble", "Hawk", "Wolf", "Bear", "Crow",
  "Wind", "Storm", "Sun", "Moon", "Star", "Frost", "Marsh", "Hill",
];
const VILLAGE_SUFFIXES = [
  "ford", "wick", "stead", "haven", "dale", "ton", "ham", "worth",
  "bridge", "hollow", "reach", "moor", "fell", "keep", "gate", "wall",
  "watch", "hold", "rest", "well", "cross", "field", "wood", "bury",
];

const DUNGEON_NAMES = [
  "The Forgotten Depths", "Tomb of the Hollow King", "Sunken Vault",
  "The Iron Maw", "Crypts of Ashen Memory", "The Drowned Passage",
  "Halls of the Pale", "The Shattered Sanctum", "Pit of Wailing Stones",
  "The Blighted Warren", "Chambers of Lost Years", "The Gnawing Dark",
  "Vault of the Bone Warden", "The Weeping Galleries", "Nest of the Eyeless",
  "The Strangled Mine", "Crucible of the Damned", "The Hollow Throne",
];

const RUINS_NAMES = [
  "Collapsed Watchtower", "Overgrown Temple", "Fallen Keep",
  "Broken Bridge Pillars", "Shattered Obelisk", "Crumbled Granary",
  "Ancient Foundation Stones", "Toppled Colossus", "Burned Village",
  "Buried Amphitheater", "Eroded Aqueduct", "Sunken Courtyard",
];

const SHRINE_BLESSINGS = [
  "Strength of the Mountain", "Swiftness of the Wind", "Endurance of Stone",
  "Wisdom of the Deep", "Charm of the Fey", "Insight of the Stars",
  "Protection from Harm", "Fortune's Favor", "Hunter's Eye",
  "Healing Waters", "Traveler's Rest", "Warrior's Resolve",
];

// ============================================================================
//  WORLD GENERATOR CLASS
// ============================================================================

export class HexWorld {
  private seed: number;
  private noiseElevation: SimplexNoise;
  private noiseMoisture: SimplexNoise;
  private noiseTemperature: SimplexNoise;
  private noiseSpecial: SimplexNoise;
  private chunks: Map<string, HexData[]>;
  private revealedHexes: Set<string>;
  private poiCache: Map<string, POI>;

  constructor(seed: number = 42) {
    this.seed = seed;
    this.noiseElevation = new SimplexNoise(seed);
    this.noiseMoisture = new SimplexNoise(seed + 1000);
    this.noiseTemperature = new SimplexNoise(seed + 2000);
    this.noiseSpecial = new SimplexNoise(seed + 3000);
    this.chunks = new Map();
    this.revealedHexes = new Set();
    this.poiCache = new Map();
    this.loadRevealedHexes();
  }

  // ==========================================================================
  //  PUBLIC API
  // ==========================================================================

  /** Get full hex data for a single coordinate. Generates chunk if needed. */
  getHex(q: number, r: number): HexData {
    const chunk = this.ensureChunk(q, r);
    const localQ = ((q % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localR = ((r % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = localR * CHUNK_SIZE + localQ;
    return chunk[idx];
  }

  /** Get all hexes in a chunk (generates if needed). */
  getChunk(chunkQ: number, chunkR: number): HexData[] {
    const key = `${chunkQ},${chunkR}`;
    if (!this.chunks.has(key)) {
      this.chunks.set(key, this.generateChunk(chunkQ, chunkR));
    }
    return this.chunks.get(key)!;
  }

  /** Get all hexes visible from a position (based on terrain visibility). */
  getVisibleHexes(fromQ: number, fromR: number, overrideRange?: number): HexData[] {
    const origin = this.getHex(fromQ, fromR);
    const range = overrideRange ?? origin.visibility;
    const results: HexData[] = [];
    // Use cube coordinate ring iteration
    for (let dq = -range; dq <= range; dq++) {
      for (let dr = -range; dr <= range; dr++) {
        if (Math.abs(dq + dr) > range) continue;
        const hex = this.getHex(fromQ + dq, fromR + dr);
        results.push(hex);
      }
    }
    return results;
  }

  /** A* pathfinding between two coordinates. Returns path or empty if unreachable. */
  getPath(from: Coord, to: Coord, maxCost: number = 200): Coord[] {
    const key = (c: Coord) => `${c.q},${c.r}`;
    const heuristic = (a: Coord, b: Coord) => hexDistanceAxial(a, b);

    const openSet = new Map<string, { coord: Coord; f: number; g: number }>();
    const cameFrom = new Map<string, Coord>();
    const gScore = new Map<string, number>();

    const startKey = key(from);
    gScore.set(startKey, 0);
    openSet.set(startKey, { coord: from, f: heuristic(from, to), g: 0 });

    while (openSet.size > 0) {
      // Find lowest f-score in open set
      let current: { coord: Coord; f: number; g: number } | null = null;
      let currentKey = "";
      for (const [k, v] of openSet) {
        if (!current || v.f < current.f) {
          current = v;
          currentKey = k;
        }
      }
      if (!current) break;

      if (current.coord.q === to.q && current.coord.r === to.r) {
        // Reconstruct path
        const path: Coord[] = [to];
        let step = key(to);
        while (cameFrom.has(step)) {
          const prev = cameFrom.get(step)!;
          path.unshift(prev);
          step = key(prev);
        }
        return path;
      }

      openSet.delete(currentKey);

      for (const neighbor of this.getNeighbors(current.coord)) {
        const nHex = this.getHex(neighbor.q, neighbor.r);
        // Cannot path through deep water without a ship
        if (nHex.terrain === "water" && nHex.elevation < 1) continue;

        const tentativeG = current.g + nHex.movementCost;
        if (tentativeG > maxCost) continue;

        const nKey = key(neighbor);
        const prevG = gScore.get(nKey) ?? Infinity;

        if (tentativeG < prevG) {
          cameFrom.set(nKey, current.coord);
          gScore.set(nKey, tentativeG);
          const f = tentativeG + heuristic(neighbor, to);
          openSet.set(nKey, { coord: neighbor, f, g: tentativeG });
        }
      }
    }

    return []; // No path found
  }

  /** Get all POIs within radius hexes. */
  getNearbyPOIs(q: number, r: number, radius: number): POI[] {
    const results: POI[] = [];
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dq + dr) > radius) continue;
        const hex = this.getHex(q + dq, r + dr);
        if (hex.poi) results.push(hex.poi);
      }
    }
    return results;
  }

  /** Roll for a random encounter based on hex data and player level. */
  generateEncounter(hex: HexData, playerLevel: number): Encounter | null {
    // No encounters in safe zones (near villages)
    if (this.isInSafeZone(hex.q, hex.r)) return null;

    // Encounter rate: dangerLevel * 1.5% base, max ~15%
    const rate = Math.min(0.15, hex.dangerLevel * 0.015);
    const roll = hashCoord(hex.q + playerLevel, hex.r + playerLevel, this.seed + 9999);
    if (roll > rate) return null;

    // Check for boss hex (very rare, deterministic)
    const isBoss = hashCoord(hex.q, hex.r, this.seed + 7777) < 0.005;

    const monsters = TERRAIN_MONSTERS[hex.terrain] || TERRAIN_MONSTERS.grass;
    const monsterIdx = Math.floor(hashCoordN(hex.q, hex.r, this.seed, 10) * monsters.length);
    const monsterId = monsters[monsterIdx];

    // Scale count by danger + player level
    const baseCount = isBoss ? 1 : Math.max(1, Math.floor(hex.dangerLevel / 3) + 1);
    const levelScale = Math.floor(playerLevel / 4);
    const count = Math.min(baseCount + levelScale, isBoss ? 1 : 8);

    const descriptions = this.getEncounterDescription(hex.terrain, monsterId, isBoss);

    return {
      monsterIds: [monsterId],
      count,
      dangerLevel: isBoss ? 10 : hex.dangerLevel,
      terrain: hex.terrain,
      description: descriptions,
      isBoss,
    };
  }

  /** Mark a hex as revealed (fog of war). */
  revealHex(q: number, r: number): void {
    const key = `${q},${r}`;
    this.revealedHexes.add(key);
    const hex = this.getHex(q, r);
    hex.revealed = true;
    this.persistRevealedHexes();
  }

  /** Reveal all hexes visible from a position. */
  revealFrom(q: number, r: number): HexData[] {
    const visible = this.getVisibleHexes(q, r);
    for (const hex of visible) {
      this.revealHex(hex.q, hex.r);
    }
    return visible;
  }

  /** Get exploration statistics. */
  getExplorationStats(): { revealed: number; villages: number; dungeons: number; pois: number } {
    let villages = 0;
    let dungeons = 0;
    let pois = 0;
    for (const [, poi] of this.poiCache) {
      if (poi.discovered) {
        pois++;
        if (poi.type === "village") villages++;
        if (poi.type === "dungeon") dungeons++;
      }
    }
    return {
      revealed: this.revealedHexes.size,
      villages,
      dungeons,
      pois,
    };
  }

  /** Check if a hex has been revealed. */
  isRevealed(q: number, r: number): boolean {
    return this.revealedHexes.has(`${q},${r}`);
  }

  /** Get the 6 axial neighbors of a hex (no bounds restriction — infinite world). */
  getNeighbors(coord: Coord): Coord[] {
    const { q, r } = coord;
    return [
      { q: q + 1, r },     { q: q - 1, r },
      { q, r: r + 1 },     { q, r: r - 1 },
      { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 },
    ];
  }

  /** Get distance from Kardov's Gate. */
  distanceFromGate(q: number, r: number): number {
    return hexDistanceAxial({ q, r }, KARDOV_GATE);
  }

  /** Reset fog of war (for new game). */
  resetExploration(): void {
    this.revealedHexes.clear();
    for (const [, poi] of this.poiCache) {
      poi.discovered = false;
    }
    this.persistRevealedHexes();
  }

  // ==========================================================================
  //  CHUNK GENERATION
  // ==========================================================================

  private ensureChunk(q: number, r: number): HexData[] {
    const cq = Math.floor(q / CHUNK_SIZE);
    const cr = Math.floor(r / CHUNK_SIZE);
    return this.getChunk(cq, cr);
  }

  private generateChunk(chunkQ: number, chunkR: number): HexData[] {
    const hexes: HexData[] = [];
    const baseQ = chunkQ * CHUNK_SIZE;
    const baseR = chunkR * CHUNK_SIZE;

    for (let lr = 0; lr < CHUNK_SIZE; lr++) {
      for (let lq = 0; lq < CHUNK_SIZE; lq++) {
        const q = baseQ + lq;
        const r = baseR + lr;
        hexes.push(this.generateHex(q, r));
      }
    }
    return hexes;
  }

  private generateHex(q: number, r: number): HexData {
    // Special case: Kardov's Gate
    if (q === KARDOV_GATE.q && r === KARDOV_GATE.r) {
      return this.createKardovGate();
    }

    // Sample layered noise
    const elevation = this.sampleElevation(q, r);
    const moisture = this.sampleMoisture(q, r);
    const temperature = this.sampleTemperature(q, r);
    const special = this.noiseSpecial.noise2D(q * 0.03, r * 0.03);

    // Derive biome from noise layers
    const biome = this.deriveBiome(elevation, moisture, temperature, special);
    const terrain = this.biomeToTerrain(biome);

    // Distance from gate affects danger scaling
    const distFromGate = hexDistanceAxial({ q, r }, KARDOV_GATE);
    const dangerLevel = this.calculateDanger(distFromGate, terrain, elevation);

    // Resources
    const resources = this.generateResources(terrain, biome, q, r);

    // POI (deterministic check)
    const poi = this.generatePOI(q, r, terrain, biome, dangerLevel);

    const hex: HexData = {
      q, r,
      terrain,
      biome,
      elevation: Math.round(elevation * 10),
      moisture,
      temperature,
      movementCost: MOVEMENT_COSTS[terrain],
      visibility: VISIBILITY_RANGE[terrain],
      dangerLevel,
      resources,
      poi,
      description: this.generateDescription(terrain, biome, elevation, poi),
      revealed: this.revealedHexes.has(`${q},${r}`),
    };

    if (poi) {
      poi.discovered = hex.revealed;
      this.poiCache.set(`${q},${r}`, poi);
    }

    return hex;
  }

  // ==========================================================================
  //  NOISE SAMPLING (multi-octave for natural terrain)
  // ==========================================================================

  private sampleElevation(q: number, r: number): number {
    const scale1 = 0.02;  // continental
    const scale2 = 0.05;  // regional
    const scale3 = 0.12;  // local detail

    const n1 = this.noiseElevation.noise2D(q * scale1, r * scale1) * 0.6;
    const n2 = this.noiseElevation.noise2D(q * scale2, r * scale2) * 0.3;
    const n3 = this.noiseElevation.noise2D(q * scale3, r * scale3) * 0.1;

    // Normalize to [0, 1]
    return clamp01((n1 + n2 + n3 + 1) / 2);
  }

  private sampleMoisture(q: number, r: number): number {
    const scale1 = 0.025;
    const scale2 = 0.08;

    const n1 = this.noiseMoisture.noise2D(q * scale1, r * scale1) * 0.7;
    const n2 = this.noiseMoisture.noise2D(q * scale2, r * scale2) * 0.3;

    return clamp01((n1 + n2 + 1) / 2);
  }

  private sampleTemperature(q: number, r: number): number {
    const scale1 = 0.015;
    const scale2 = 0.06;

    const n1 = this.noiseTemperature.noise2D(q * scale1, r * scale1) * 0.7;
    const n2 = this.noiseTemperature.noise2D(q * scale2, r * scale2) * 0.3;

    // Temperature decreases with elevation
    const elevation = this.sampleElevation(q, r);
    const base = clamp01((n1 + n2 + 1) / 2);
    return clamp01(base - elevation * 0.3);
  }

  // ==========================================================================
  //  BIOME DERIVATION
  // ==========================================================================

  private deriveBiome(elev: number, moist: number, temp: number, special: number): Biome {
    // Special biomes (rare noise anomalies)
    if (special > 0.75 && moist > 0.6) return "fungal_forest";
    if (special < -0.8 && temp < 0.4) return "cursed_lands";
    if (special > 0.82 && elev > 0.5) return "crystal_caves";

    // Volcanic (high elevation + specific noise pattern)
    if (elev > 0.8 && temp > 0.6 && special > 0.4) return "volcanic";

    // Water bodies
    if (elev < 0.15) return "ocean";
    if (elev < 0.22 && moist > 0.6) return "lake";
    if (elev < 0.28) return "coast";

    // Snow/tundra (high elevation + cold)
    if (elev > 0.8 && temp < 0.3) return "snow_peak";
    if (temp < 0.2 && elev > 0.5) return "tundra";

    // Mountains
    if (elev > 0.75) return "mountain";

    // Highlands
    if (elev > 0.6) return "highlands";

    // Desert (dry + warm)
    if (moist < 0.2 && temp > 0.6) return "desert";
    if (moist < 0.3 && temp > 0.5) return "savanna";

    // Swamp/marsh (low elevation + wet)
    if (elev < 0.35 && moist > 0.7) return "swamp";
    if (elev < 0.4 && moist > 0.6) return "marsh";

    // Forest types
    if (moist > 0.6 && temp > 0.7) return "jungle";
    if (moist > 0.5) return "forest";

    // Plains/grassland
    if (moist > 0.3) return "grassland";
    return "plains";
  }

  private biomeToTerrain(biome: Biome): Terrain {
    const mapping: Record<Biome, Terrain> = {
      ocean: "water",
      lake: "water",
      coast: "coast",
      desert: "desert",
      savanna: "plains",
      plains: "plains",
      grassland: "grass",
      forest: "forest",
      jungle: "jungle",
      swamp: "swamp",
      marsh: "swamp",
      highlands: "highlands",
      mountain: "mountain",
      snow_peak: "snow",
      tundra: "snow",
      volcanic: "volcanic",
      fungal_forest: "fungal",
      cursed_lands: "cursed",
      crystal_caves: "mountain",
    };
    return mapping[biome];
  }

  // ==========================================================================
  //  DANGER LEVEL
  // ==========================================================================

  private calculateDanger(distFromGate: number, terrain: Terrain, elevation: number): number {
    // Base danger from distance (scales 0-7 over 50 hexes)
    const distDanger = Math.min(7, distFromGate / 7);

    // Terrain modifiers
    const terrainMod: Record<Terrain, number> = {
      grass: 0, plains: 0, coast: 0.5,
      forest: 1, highlands: 1, desert: 1.5,
      jungle: 2, swamp: 2, mountain: 1.5,
      snow: 2, volcanic: 3, fungal: 2,
      cursed: 3, water: 1,
    };

    const danger = distDanger + (terrainMod[terrain] || 0);
    return Math.min(10, Math.max(0, Math.round(danger)));
  }

  // ==========================================================================
  //  RESOURCE GENERATION
  // ==========================================================================

  private generateResources(terrain: Terrain, biome: Biome, q: number, r: number): Resource[] {
    const resources: Resource[] = [];
    const roll1 = hashCoordN(q, r, this.seed, 20);
    const roll2 = hashCoordN(q, r, this.seed, 21);

    const terrainResources: Record<Terrain, Resource[]> = {
      grass: ["herbs", "game"],
      plains: ["herbs", "game", "water"],
      forest: ["timber", "herbs", "mushrooms", "game"],
      jungle: ["timber", "herbs", "mushrooms"],
      desert: ["stone", "salt", "obsidian"],
      swamp: ["peat", "herbs", "mushrooms", "fish"],
      mountain: ["stone", "iron", "gold_ore", "gems"],
      highlands: ["stone", "iron", "herbs"],
      snow: ["stone", "iron"],
      volcanic: ["obsidian", "gems", "iron"],
      coast: ["fish", "salt", "clay"],
      water: ["fish"],
      fungal: ["mushrooms", "herbs", "crystals"],
      cursed: ["crystals", "obsidian"],
    };

    const available = terrainResources[terrain] || [];
    // 60% chance of first resource, 25% chance of second
    if (roll1 < 0.6 && available.length > 0) {
      const idx = Math.floor(roll1 / 0.6 * available.length);
      resources.push(available[Math.min(idx, available.length - 1)]);
    }
    if (roll2 < 0.25 && available.length > 1) {
      const idx = Math.floor(roll2 / 0.25 * available.length);
      const res = available[Math.min(idx, available.length - 1)];
      if (!resources.includes(res)) resources.push(res);
    }

    return resources;
  }

  // ==========================================================================
  //  POI GENERATION
  // ==========================================================================

  private generatePOI(q: number, r: number, terrain: Terrain, biome: Biome, danger: number): POI | null {
    // Kardov's Gate is manually defined, no procedural POI here
    if (q === KARDOV_GATE.q && r === KARDOV_GATE.r) return null;

    const roll = hashCoord(q, r, this.seed + 5000);

    // Village: ~3.5% chance on suitable terrain (every ~28 hexes on average)
    if (terrain !== "water" && terrain !== "volcanic" && terrain !== "snow") {
      const villageChance = (terrain === "plains" || terrain === "grass") ? 0.045 : 0.025;
      if (roll < villageChance) {
        return this.createVillage(q, r, terrain, danger);
      }
    }

    // Dungeon: ~2% chance, more common in mountains/swamps
    const dungeonBoost = (terrain === "mountain" || terrain === "swamp" || terrain === "cursed") ? 0.015 : 0;
    if (roll >= 0.05 && roll < 0.05 + 0.02 + dungeonBoost) {
      return this.createDungeon(q, r, terrain, danger);
    }

    // Ruins: ~2.5% chance, more common in desert/cursed
    const ruinsBoost = (terrain === "desert" || terrain === "cursed") ? 0.02 : 0;
    if (roll >= 0.10 && roll < 0.10 + 0.025 + ruinsBoost) {
      return this.createRuins(q, r, terrain, danger);
    }

    // Shrine: ~1% chance
    if (roll >= 0.15 && roll < 0.16) {
      return this.createShrine(q, r, terrain);
    }

    // Camp: ~2% chance, scales with danger
    if (danger > 3 && roll >= 0.18 && roll < 0.18 + danger * 0.003) {
      return this.createCamp(q, r, terrain, danger);
    }

    // Cave: mountain/highlands only, ~4%
    if ((terrain === "mountain" || terrain === "highlands") && roll >= 0.22 && roll < 0.26) {
      return this.createCave(q, r, danger);
    }

    // Tower: ~1.5% on highlands/plains
    if ((terrain === "highlands" || terrain === "plains") && roll >= 0.28 && roll < 0.295) {
      return this.createTower(q, r, danger);
    }

    // Port: coast only, ~5%
    if (terrain === "coast" && roll >= 0.30 && roll < 0.35) {
      return this.createPort(q, r, danger);
    }

    return null;
  }

  private createVillage(q: number, r: number, terrain: Terrain, danger: number): POI {
    const nameIdx1 = Math.floor(hashCoordN(q, r, this.seed, 30) * VILLAGE_PREFIXES.length);
    const nameIdx2 = Math.floor(hashCoordN(q, r, this.seed, 31) * VILLAGE_SUFFIXES.length);
    const name = VILLAGE_PREFIXES[nameIdx1] + VILLAGE_SUFFIXES[nameIdx2];
    return {
      type: "village",
      name,
      q, r,
      dangerLevel: 0,
      description: `A ${terrain === "forest" ? "woodland" : terrain === "coast" ? "coastal" : "small"} settlement called ${name}. Smoke rises from chimneys and the sounds of daily life carry on the breeze.`,
      discovered: false,
    };
  }

  private createDungeon(q: number, r: number, terrain: Terrain, danger: number): POI {
    const nameIdx = Math.floor(hashCoordN(q, r, this.seed, 32) * DUNGEON_NAMES.length);
    const name = DUNGEON_NAMES[nameIdx];
    return {
      type: "dungeon",
      name,
      q, r,
      dangerLevel: Math.min(10, danger + 2),
      description: `An entrance to ${name}. Dark stone stairs descend into the earth. The air rising from below is cold and carries the smell of old death.`,
      discovered: false,
    };
  }

  private createRuins(q: number, r: number, terrain: Terrain, danger: number): POI {
    const nameIdx = Math.floor(hashCoordN(q, r, this.seed, 33) * RUINS_NAMES.length);
    const name = RUINS_NAMES[nameIdx];
    return {
      type: "ruins",
      name,
      q, r,
      dangerLevel: Math.min(10, danger + 1),
      description: `The remains of a ${name}. Time and weather have taken their toll, but valuables may still lie buried beneath the rubble.`,
      discovered: false,
    };
  }

  private createShrine(q: number, r: number, terrain: Terrain): POI {
    const blessingIdx = Math.floor(hashCoordN(q, r, this.seed, 34) * SHRINE_BLESSINGS.length);
    const blessing = SHRINE_BLESSINGS[blessingIdx];
    return {
      type: "shrine",
      name: `Shrine of ${blessing}`,
      q, r,
      dangerLevel: 0,
      description: `A weathered stone shrine stands here, overgrown but still intact. Faded carvings promise the blessing of ${blessing} to those who offer tribute.`,
      discovered: false,
    };
  }

  private createCamp(q: number, r: number, terrain: Terrain, danger: number): POI {
    const isMonster = hashCoordN(q, r, this.seed, 35) > 0.5;
    const campType = isMonster ? "Monster" : "Bandit";
    return {
      type: "camp",
      name: `${campType} Camp`,
      q, r,
      dangerLevel: danger,
      description: isMonster
        ? "A crude encampment of monsters. Bones and filth mark their territory. They have not seen you yet."
        : "A bandit hideout — lean-to shelters, a cold fire pit, and stolen goods piled in the center.",
      discovered: false,
    };
  }

  private createCave(q: number, r: number, danger: number): POI {
    const hasMonster = hashCoordN(q, r, this.seed, 36) > 0.4;
    return {
      type: "cave",
      name: hasMonster ? "Occupied Cave" : "Mountain Cave",
      q, r,
      dangerLevel: hasMonster ? danger : Math.max(0, danger - 2),
      description: hasMonster
        ? "A dark cave mouth in the rock face. Claw marks score the stone and a foul smell drifts outward."
        : "A natural cave opening in the hillside. Mineral deposits glitter in what light reaches the walls.",
      discovered: false,
    };
  }

  private createTower(q: number, r: number, danger: number): POI {
    const occupied = hashCoordN(q, r, this.seed, 37) > 0.5;
    return {
      type: "tower",
      name: occupied ? "Occupied Tower" : "Abandoned Watchtower",
      q, r,
      dangerLevel: occupied ? danger : 0,
      description: occupied
        ? "A stone tower with a light burning in the upper window. Someone — or something — has claimed it."
        : "A crumbling watchtower from a forgotten age. The view from the top would be excellent.",
      discovered: false,
    };
  }

  private createPort(q: number, r: number, danger: number): POI {
    const nameIdx1 = Math.floor(hashCoordN(q, r, this.seed, 38) * VILLAGE_PREFIXES.length);
    const name = VILLAGE_PREFIXES[nameIdx1] + " Harbor";
    return {
      type: "port",
      name,
      q, r,
      dangerLevel: 0,
      description: `${name} — a small port with wooden docks and a few fishing boats. Ships occasionally stop here for supplies and crew.`,
      discovered: false,
    };
  }

  // ==========================================================================
  //  SAFE ZONES
  // ==========================================================================

  private isInSafeZone(q: number, r: number): boolean {
    // Check if within 3 hexes of Kardov's Gate
    if (hexDistanceAxial({ q, r }, KARDOV_GATE) <= 3) return true;

    // Check if within 2 hexes of any village
    for (let dq = -2; dq <= 2; dq++) {
      for (let dr = -2; dr <= 2; dr++) {
        if (Math.abs(dq + dr) > 2) continue;
        const checkKey = `${q + dq},${r + dr}`;
        const poi = this.poiCache.get(checkKey);
        if (poi && (poi.type === "village" || poi.type === "port")) return true;
      }
    }
    return false;
  }

  // ==========================================================================
  //  HEX DESCRIPTIONS
  // ==========================================================================

  private generateDescription(terrain: Terrain, biome: Biome, elevation: number, poi: POI | null): string {
    if (poi) return poi.description;

    const descriptions: Record<Terrain, string[]> = {
      grass: [
        "Rolling grasslands stretch in every direction. The wind makes waves in the tall stalks.",
        "Open meadows dotted with wildflowers. A pleasant place to rest.",
        "Flat green country. You can see far in every direction.",
      ],
      plains: [
        "Dry, open plains under a wide sky. The ground is hard-packed earth and scrub.",
        "Sparse grassland with rocky outcroppings. Game trails cross your path.",
        "Windswept flatlands. The horizon seems impossibly far away.",
      ],
      forest: [
        "Dense woodland. Shafts of light pierce the canopy far above.",
        "Ancient trees crowd close, their roots tangling across the path.",
        "A green cathedral of oak and elm. Birdsong echoes overhead.",
      ],
      jungle: [
        "Thick, humid jungle. Vines hang like curtains and the air is heavy with moisture.",
        "Tangled vegetation in every direction. Insects drone ceaselessly.",
        "Oppressive heat and darkness beneath a canopy so dense the sky is invisible.",
      ],
      desert: [
        "Sand and stone under a merciless sun. The air shimmers with heat.",
        "Barren wasteland. The only movement is the slow crawl of shadows.",
        "Dunes of pale sand stretch endlessly. Your water will not last forever.",
      ],
      swamp: [
        "Stagnant water and rotting vegetation. The ground squelches with every step.",
        "Murky bog threaded with uncertain paths. Something moves beneath the surface.",
        "Dead trees rise from brackish pools. The stench is overwhelming.",
      ],
      mountain: [
        "Steep rocky slopes. The air thins and the wind cuts like a blade.",
        "Sheer cliffs and narrow ledges. One misstep here would be your last.",
        "Mountain crags loom above. Eagles circle on thermals far overhead.",
      ],
      highlands: [
        "High moors of heather and stone. The wind never stops up here.",
        "Rocky uplands with sweeping views. Hardy scrub clings to the thin soil.",
        "Windswept plateau. You can see for leagues from this vantage.",
      ],
      snow: [
        "Blinding white in every direction. The cold seeps through every layer.",
        "Snow-covered peaks. The silence is absolute except for the wind.",
        "Frozen wasteland. Ice crystals hang in the air like diamond dust.",
      ],
      volcanic: [
        "The ground is warm beneath your feet. Cracks glow with molten light.",
        "Ash and cinder crunch underfoot. The air smells of sulfur.",
        "A desolate landscape of black rock and smoking vents. Nothing grows here.",
      ],
      coast: [
        "Salt wind off the sea. Waves crash against rocks below.",
        "Sandy shore with driftwood and shells. Gulls wheel overhead.",
        "Coastal cliffs look out over endless grey-green water.",
      ],
      water: [
        "Open water. Waves roll endlessly toward the horizon.",
        "Deep water, dark and cold. No land in sight.",
        "The sea stretches in all directions. You would need a boat to cross.",
      ],
      fungal: [
        "Giant mushrooms tower overhead, their caps blocking the sky. The air is thick with spores.",
        "Bioluminescent fungi paint everything in eerie blue-green light.",
        "A forest of fungus — shelf mushrooms the size of shields grow from ancient stumps.",
      ],
      cursed: [
        "The land itself feels wrong here. Colors are muted, sounds are deadened.",
        "A pall hangs over this place. The ground is grey and nothing living stirs.",
        "Twisted, blackened earth. The very air seems to resist your presence.",
      ],
    };

    const options = descriptions[terrain] || descriptions.grass;
    const idx = Math.floor(hashCoordN(elevation * 100, terrain.length, this.seed, 50) * options.length);
    return options[idx % options.length];
  }

  private getEncounterDescription(terrain: Terrain, monsterId: string, isBoss: boolean): string {
    if (isBoss) {
      return `A terrifying presence fills this place. Something ancient and powerful has made its lair here. This is no ordinary encounter.`;
    }
    const flavors: Record<Terrain, string> = {
      grass: "Movement in the tall grass alerts you to danger.",
      plains: "Figures appear on the horizon, moving toward you with purpose.",
      forest: "Branches crack nearby. You are not alone in these woods.",
      jungle: "The undergrowth erupts with hostile movement.",
      desert: "They emerge from behind the dunes, sun-baked and hungry.",
      swamp: "Shapes rise from the murky water, blocking your path.",
      mountain: "Rocks clatter above — something is coming down toward you.",
      highlands: "They appear over the ridge line, silhouetted against the sky.",
      snow: "Dark shapes in the white — closing fast.",
      volcanic: "They emerge from the smoke and ash, eyes burning.",
      coast: "They surge from the surf, salt-crusted and hostile.",
      water: "Something breaches the surface, coming straight for you.",
      fungal: "They shamble from the fungal growth, spore-mad and aggressive.",
      cursed: "They materialize from the corrupted earth itself, dead eyes fixed on you.",
    };
    return flavors[terrain] || "Danger appears before you.";
  }

  // ==========================================================================
  //  KARDOV'S GATE (fixed starting hex)
  // ==========================================================================

  private createKardovGate(): HexData {
    return {
      q: KARDOV_GATE.q,
      r: KARDOV_GATE.r,
      terrain: "plains",
      biome: "grassland",
      elevation: 4,
      moisture: 0.5,
      temperature: 0.6,
      movementCost: 1,
      visibility: 4,
      dangerLevel: 0,
      resources: ["water"],
      poi: {
        type: "village",
        name: "Kardov's Gate",
        q: KARDOV_GATE.q,
        r: KARDOV_GATE.r,
        dangerLevel: 0,
        description: "The gritty port city of Kardov's Gate. Iron-hulled ships crowd the harbor, dock workers haul cargo through muddy streets, and the Iron Maw prison looms above it all. This is where your journey begins.",
        discovered: true,
      },
      description: "The gritty port city of Kardov's Gate. Iron-hulled ships crowd the harbor, dock workers haul cargo through muddy streets, and the Iron Maw prison looms above it all. This is where your journey begins.",
      revealed: true,
    };
  }

  // ==========================================================================
  //  PERSISTENCE (localStorage)
  // ==========================================================================

  private loadRevealedHexes(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(`tot-revealed-${this.seed}`);
      if (stored) {
        const keys: string[] = JSON.parse(stored);
        for (const k of keys) this.revealedHexes.add(k);
      }
    } catch (err) {
      console.error("[HexWorld] Failed to load revealed hexes:", err);
    }
  }

  private persistRevealedHexes(): void {
    if (typeof window === "undefined") return;
    try {
      const keys = Array.from(this.revealedHexes);
      localStorage.setItem(`tot-revealed-${this.seed}`, JSON.stringify(keys));
    } catch (err) {
      console.error("[HexWorld] Failed to persist revealed hexes:", err);
    }
  }
}

// ============================================================================
//  UTILITY FUNCTIONS (exported)
// ============================================================================

/** Hex distance using axial coordinates (infinite grid, no bounds). */
export function hexDistanceAxial(a: Coord, b: Coord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Convert axial to cube coordinates. */
export function axialToCube(coord: Coord): { x: number; y: number; z: number } {
  return { x: coord.q, y: -coord.q - coord.r, z: coord.r };
}

/** Convert cube to axial coordinates. */
export function cubeToAxial(x: number, y: number, z: number): Coord {
  return { q: x, r: z };
}

/** Get the chunk coordinate for a world hex coordinate. */
export function worldToChunk(q: number, r: number): ChunkCoord {
  return {
    cq: Math.floor(q / CHUNK_SIZE),
    cr: Math.floor(r / CHUNK_SIZE),
  };
}

/** Get all hexes in a ring at distance `radius` from center. */
export function hexRing(center: Coord, radius: number): Coord[] {
  if (radius === 0) return [center];
  const results: Coord[] = [];
  // Start at one corner and walk the 6 edges of the ring
  const directions: Coord[] = [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
  ];
  let hex: Coord = { q: center.q - radius, r: center.r + radius };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = { q: hex.q + directions[side].q, r: hex.r + directions[side].r };
    }
  }
  return results;
}

/** Get all hexes within distance `radius` from center (filled). */
export function hexSpiral(center: Coord, radius: number): Coord[] {
  const results: Coord[] = [center];
  for (let r = 1; r <= radius; r++) {
    results.push(...hexRing(center, r));
  }
  return results;
}

/** Clamp a number to [0, 1]. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ============================================================================
//  DEFAULT WORLD INSTANCE
// ============================================================================

/** The shared world instance. Use this unless you need a custom seed. */
let defaultWorld: HexWorld | null = null;

export function getWorld(seed: number = 42): HexWorld {
  if (!defaultWorld || (defaultWorld as any).seed !== seed) {
    defaultWorld = new HexWorld(seed);
  }
  return defaultWorld;
}
