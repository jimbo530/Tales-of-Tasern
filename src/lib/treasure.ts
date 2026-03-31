// ============================================================
// treasure.ts — D&D 3.5 DMG Random Treasure Generation
// Based on DMG Tables 3-5 (Treasure), 3-7 (Gems), 3-8 (Art Objects)
// All values in copper pieces internally.
// ============================================================

import type { Coins } from "./saveSystem";

// ── Dice helpers ────────────────────────────────────────────────────────────

export function d(sides: number): number { return Math.floor(Math.random() * sides) + 1; }
export function nd(n: number, sides: number): number { let t = 0; for (let i = 0; i < n; i++) t += d(sides); return t; }
function d100(): number { return d(100); }

// ── Gems (DMG Table 3-7) ───────────────────────────────────────────────────

type GemTier = { valueCp: () => number; names: string[] };

const GEM_TIERS: { maxRoll: number; tier: GemTier }[] = [
  { maxRoll: 25, tier: {
    valueCp: () => nd(4, 4) * 100,  // 4d4 gp (4-16gp)
    names: ["azurite", "banded agate", "blue quartz", "eye agate", "hematite", "lapis lazuli",
            "malachite", "moss agate", "obsidian", "rhodochrosite", "tiger eye turquoise"],
  }},
  { maxRoll: 50, tier: {
    valueCp: () => nd(2, 4) * 1000,  // 2d4×10 gp (20-80gp)
    names: ["bloodstone", "carnelian", "chalcedony", "chrysoprase", "citrine", "jasper",
            "moonstone", "onyx", "peridot", "rock crystal", "sard", "sardonyx",
            "rose quartz", "smoky quartz", "star rose quartz", "zircon"],
  }},
  { maxRoll: 70, tier: {
    valueCp: () => nd(4, 4) * 1000,  // 4d4×10 gp (40-160gp)
    names: ["amber", "amethyst", "chrysoberyl", "coral", "red garnet", "jade",
            "jet", "white pearl", "red spinel", "tourmaline"],
  }},
  { maxRoll: 90, tier: {
    valueCp: () => nd(2, 4) * 10000,  // 2d4×100 gp (200-800gp)
    names: ["alexandrite", "aquamarine", "violet garnet", "black pearl",
            "deep blue spinel", "golden yellow topaz"],
  }},
  { maxRoll: 99, tier: {
    valueCp: () => nd(4, 4) * 10000,  // 4d4×100 gp (400-1600gp)
    names: ["emerald", "white opal", "black opal", "fire opal", "blue sapphire",
            "fiery yellow corundum", "rich purple corundum", "star ruby", "star sapphire"],
  }},
  { maxRoll: 100, tier: {
    valueCp: () => nd(2, 4) * 100000,  // 2d4×1000 gp (2000-8000gp)
    names: ["clearest bright green emerald", "diamond", "jacinth", "ruby"],
  }},
];

export type TreasureGem = { name: string; valueCp: number };

function rollGem(): TreasureGem {
  const roll = d100();
  const entry = GEM_TIERS.find(g => roll <= g.maxRoll)!;
  const name = entry.tier.names[Math.floor(Math.random() * entry.tier.names.length)];
  return { name, valueCp: entry.tier.valueCp() };
}

// ── Art Objects (DMG Table 3-8) ─────────────────────────────────────────────

type ArtTier = { valueCp: () => number; names: string[] };

const ART_TIERS: { maxRoll: number; tier: ArtTier }[] = [
  { maxRoll: 10, tier: {
    valueCp: () => d(10) * 1000,  // 1d10×10 gp
    names: ["silver ewer", "carved bone statuette", "small gold bracelet",
            "cloth-of-silver vestments", "painted wooden shield"],
  }},
  { maxRoll: 25, tier: {
    valueCp: () => nd(3, 6) * 1000,  // 3d6×10 gp
    names: ["cloth-of-gold vestments", "black velvet mask with silver thread",
            "silver chalice with lapis lazuli gems", "silver-chased steel knife"],
  }},
  { maxRoll: 40, tier: {
    valueCp: () => d(6) * 10000,  // 1d6×100 gp
    names: ["large wool tapestry", "brass mug with jade inlay", "silver comb with moonstones",
            "silver-plated helm", "carved ivory drinking horn"],
  }},
  { maxRoll: 50, tier: {
    valueCp: () => d(10) * 10000,  // 1d10×100 gp
    names: ["silver-plated longsword with jet on hilt", "carved harp of exotic wood with ivory inlay",
            "solid gold idol (small)", "gold and silver flask"],
  }},
  { maxRoll: 60, tier: {
    valueCp: () => nd(2, 6) * 10000,  // 2d6×100 gp
    names: ["gold music box", "gold jewelry box with platinum filigree",
            "jeweled electrum ring", "gold and ruby pendant"],
  }},
  { maxRoll: 70, tier: {
    valueCp: () => nd(3, 6) * 10000,  // 3d6×100 gp
    names: ["golden circlet with aquamarines", "sapphire eye patch with moonstone",
            "fire opal pendant on fine gold chain", "old masterpiece painting"],
  }},
  { maxRoll: 80, tier: {
    valueCp: () => nd(4, 6) * 10000,  // 4d6×100 gp
    names: ["embroidered silk and velvet mantle with moonstones",
            "gold dragon comb with red garnet eye", "jeweled anklet"],
  }},
  { maxRoll: 85, tier: {
    valueCp: () => nd(5, 6) * 10000,  // 5d6×100 gp
    names: ["jeweled gem-studded gold decanter", "gold dragon figurine",
            "platinum and ruby ring"],
  }},
  { maxRoll: 90, tier: {
    valueCp: () => d(4) * 100000,  // 1d4×1000 gp
    names: ["gold and topaz bottle stopper", "ceremonial electrum dagger with star ruby",
            "eyepatch with mock sapphire eye"],
  }},
  { maxRoll: 95, tier: {
    valueCp: () => d(6) * 100000,  // 1d6×1000 gp
    names: ["jeweled gold crown", "gold and sapphire pendant",
            "bejeweled platinum ring"],
  }},
  { maxRoll: 99, tier: {
    valueCp: () => nd(2, 4) * 100000,  // 2d4×1000 gp
    names: ["jeweled gold crown with diamonds", "jeweled platinum scepter"],
  }},
  { maxRoll: 100, tier: {
    valueCp: () => nd(2, 6) * 100000,  // 2d6×1000 gp
    names: ["gold statuette set with rubies and diamonds", "royal platinum scepter with emeralds"],
  }},
];

export type TreasureArt = { name: string; valueCp: number };

function rollArt(): TreasureArt {
  const roll = d100();
  const entry = ART_TIERS.find(a => roll <= a.maxRoll)!;
  const name = entry.tier.names[Math.floor(Math.random() * entry.tier.names.length)];
  return { name, valueCp: entry.tier.valueCp() };
}

// ── Coin Treasure by CR (DMG Table 3-5, simplified) ────────────────────────
// Each CR tier defines a coin roll function returning Coins.
// Lower CRs give more copper/silver, higher CRs give more gold/platinum.

type CoinRoll = { maxRoll: number; roll: () => Coins };

function noCoins(): Coins { return { gp: 0, sp: 0, cp: 0 }; }

// CR 1-3: mostly copper and silver, some gold
const COINS_LOW: CoinRoll[] = [
  { maxRoll: 14, roll: noCoins },
  { maxRoll: 29, roll: () => ({ gp: 0, sp: 0, cp: nd(1, 6) * 1000 }) },         // 1d6×1000 cp
  { maxRoll: 52, roll: () => ({ gp: 0, sp: nd(1, 8) * 100, cp: 0 }) },           // 1d8×100 sp
  { maxRoll: 95, roll: () => ({ gp: nd(2, 8) * 10, sp: 0, cp: 0 }) },            // 2d8×10 gp
  { maxRoll: 100, roll: () => ({ gp: nd(1, 4) * 10, sp: nd(2, 6) * 10, cp: nd(3, 6) * 100 }) }, // mixed
];

// CR 4-6: more gold, still some silver
const COINS_MID: CoinRoll[] = [
  { maxRoll: 11, roll: noCoins },
  { maxRoll: 21, roll: () => ({ gp: 0, sp: nd(3, 10) * 100, cp: nd(1, 10) * 1000 }) },  // mixed sp+cp
  { maxRoll: 80, roll: () => ({ gp: nd(4, 10) * 10, sp: nd(2, 6) * 10, cp: 0 }) },      // gp+sp
  { maxRoll: 95, roll: () => ({ gp: nd(2, 8) * 100, sp: 0, cp: 0 }) },                   // big gp
  { maxRoll: 100, roll: () => ({ gp: nd(1, 4) * 100, sp: nd(3, 6) * 100, cp: nd(2, 8) * 1000 }) }, // mixed all
];

// CR 7-10: heavy gold
const COINS_HIGH: CoinRoll[] = [
  { maxRoll: 11, roll: noCoins },
  { maxRoll: 18, roll: () => ({ gp: 0, sp: nd(4, 10) * 100, cp: nd(2, 10) * 1000 }) },
  { maxRoll: 75, roll: () => ({ gp: nd(6, 10) * 100, sp: 0, cp: 0 }) },
  { maxRoll: 95, roll: () => ({ gp: nd(1, 4) * 1000, sp: nd(2, 8) * 100, cp: 0 }) },
  { maxRoll: 100, roll: () => ({ gp: nd(2, 4) * 1000, sp: 0, cp: 0 }) },
];

// CR 11+: massive gold hoards
const COINS_EPIC: CoinRoll[] = [
  { maxRoll: 8, roll: noCoins },
  { maxRoll: 14, roll: () => ({ gp: 0, sp: nd(4, 10) * 1000, cp: nd(4, 10) * 10000 }) },
  { maxRoll: 75, roll: () => ({ gp: nd(4, 10) * 1000, sp: 0, cp: 0 }) },
  { maxRoll: 95, roll: () => ({ gp: nd(2, 4) * 10000, sp: nd(4, 10) * 1000, cp: 0 }) },
  { maxRoll: 100, roll: () => ({ gp: nd(4, 4) * 10000, sp: 0, cp: 0 }) },
];

function rollCoins(cr: number): Coins {
  const table = cr <= 3 ? COINS_LOW : cr <= 6 ? COINS_MID : cr <= 10 ? COINS_HIGH : COINS_EPIC;
  const roll = d100();
  const entry = table.find(e => roll <= e.maxRoll)!;
  return entry.roll();
}

// ── Goods (gems/art) by CR ──────────────────────────────────────────────────

function rollGoods(cr: number): { gems: TreasureGem[]; art: TreasureArt[] } {
  const gems: TreasureGem[] = [];
  const art: TreasureArt[] = [];
  const roll = d100();

  // Chance of goods increases with CR
  const goodsChance = cr <= 3 ? 10 : cr <= 6 ? 20 : cr <= 10 ? 30 : 40;
  if (roll > goodsChance) return { gems, art };

  // Number of items scales with CR
  const count = cr <= 3 ? 1 : cr <= 6 ? d(3) : cr <= 10 ? d(4) : d(6);

  for (let i = 0; i < count; i++) {
    if (d(2) === 1) {
      gems.push(rollGem());
    } else {
      art.push(rollArt());
    }
  }
  return { gems, art };
}

// ── Main Treasure Generation ────────────────────────────────────────────────

export type TreasureHoard = {
  coins: Coins;
  gems: TreasureGem[];
  art: TreasureArt[];
  totalCp: number;        // total value of everything in copper
  description: string;    // flavor text for what was found
};

/** Roll a random treasure hoard for a given CR (challenge rating / encounter level) */
export function rollTreasure(cr: number): TreasureHoard {
  const coins = rollCoins(cr);
  const { gems, art } = rollGoods(cr);

  const coinTotal = coins.gp * 100 + coins.sp * 10 + coins.cp;
  const gemTotal = gems.reduce((s, g) => s + g.valueCp, 0);
  const artTotal = art.reduce((s, a) => s + a.valueCp, 0);
  const total = coinTotal + gemTotal + artTotal;

  // Build description
  const parts: string[] = [];

  if (coinTotal > 0) {
    const coinParts: string[] = [];
    if (coins.gp > 0) coinParts.push(`${coins.gp}gp`);
    if (coins.sp > 0) coinParts.push(`${coins.sp}sp`);
    if (coins.cp > 0) coinParts.push(`${coins.cp}cp`);
    parts.push(coinParts.join(", "));
  }

  for (const g of gems) {
    const gpVal = Math.round(g.valueCp / 100);
    parts.push(`${g.name} (worth ~${gpVal}gp)`);
  }

  for (const a of art) {
    const gpVal = Math.round(a.valueCp / 100);
    parts.push(`${a.name} (worth ~${gpVal}gp)`);
  }

  const description = parts.length > 0
    ? `Found: ${parts.join("; ")}`
    : "The hoard is empty — picked clean.";

  return { coins, gems, art, totalCp: total, description };
}

/** Quick treasure for world exploration — lighter than full hoard, CR-scaled */
export function rollFieldTreasure(cr: number): TreasureHoard {
  // Field finds are smaller: halve the CR for coin table, lower gem chance
  const coins = rollCoins(Math.max(1, Math.floor(cr / 2)));

  // Small chance of a single gem or art piece
  const gems: TreasureGem[] = [];
  const art: TreasureArt[] = [];
  const goodsRoll = d100();
  if (goodsRoll <= 5 + cr * 2) {
    if (d(2) === 1) gems.push(rollGem());
    else art.push(rollArt());
  }

  const coinTotal = coins.gp * 100 + coins.sp * 10 + coins.cp;
  const gemTotal = gems.reduce((s, g) => s + g.valueCp, 0);
  const artTotal = art.reduce((s, a) => s + a.valueCp, 0);
  const total = coinTotal + gemTotal + artTotal;

  const parts: string[] = [];
  if (coinTotal > 0) {
    const coinParts: string[] = [];
    if (coins.gp > 0) coinParts.push(`${coins.gp}gp`);
    if (coins.sp > 0) coinParts.push(`${coins.sp}sp`);
    if (coins.cp > 0) coinParts.push(`${coins.cp}cp`);
    parts.push(coinParts.join(", "));
  }
  for (const g of gems) parts.push(`a ${g.name}`);
  for (const a of art) parts.push(`a ${a.name}`);

  const description = parts.length > 0
    ? `You find ${parts.join(" and ")}.`
    : "Nothing of value.";

  return { coins, gems, art, totalCp: total, description };
}
