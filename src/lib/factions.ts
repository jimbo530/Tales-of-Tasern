// ============================================================
// factions.ts — Faction reputation system for Tales of Tasern
//
// Factions: Alchemist Guild + 4 elemental temples.
// Doing quests for a faction raises your standing.
// Some factions are rivals — helping one may lower another.
// Standing unlocks shop discounts, exclusive quests, and areas.
// ============================================================

// ── Reputation Tiers ────────────────────────────────────────────────────────
// Rep is an integer, starts at 0 (Neutral).
// Negative = hostile. Positive = friendly.
//
//   -100+  Hated       — attacked on sight, no services
//   -50    Hostile     — refused service, may be attacked
//   -25    Unfriendly  — higher prices, limited quests
//     0    Neutral     — default
//    25    Friendly    — small discounts, basic quests
//    50    Honored     — good discounts, mid-tier quests
//    75    Revered     — best prices, exclusive quests & items
//   100    Exalted     — faction champion, unique rewards

export type RepTier =
  | "hated"
  | "hostile"
  | "unfriendly"
  | "neutral"
  | "friendly"
  | "honored"
  | "revered"
  | "exalted";

export const REP_TIERS: { tier: RepTier; min: number; label: string; color: string }[] = [
  { tier: "hated",      min: -100, label: "Hated",      color: "rgba(220,38,38,0.9)" },
  { tier: "hostile",    min: -50,  label: "Hostile",     color: "rgba(220,38,38,0.7)" },
  { tier: "unfriendly", min: -25,  label: "Unfriendly",  color: "rgba(251,146,60,0.8)" },
  { tier: "neutral",    min: 0,    label: "Neutral",     color: "rgba(232,213,176,0.5)" },
  { tier: "friendly",   min: 25,   label: "Friendly",    color: "rgba(74,222,128,0.7)" },
  { tier: "honored",    min: 50,   label: "Honored",     color: "rgba(96,165,250,0.8)" },
  { tier: "revered",    min: 75,   label: "Revered",     color: "rgba(168,85,247,0.8)" },
  { tier: "exalted",    min: 100,  label: "Exalted",     color: "rgba(251,191,36,0.9)" },
];

export function getRepTier(rep: number): typeof REP_TIERS[number] {
  // Walk backwards from highest tier
  for (let i = REP_TIERS.length - 1; i >= 0; i--) {
    if (rep >= REP_TIERS[i].min) return REP_TIERS[i];
  }
  return REP_TIERS[0]; // hated
}

// ── Faction Definitions ─────────────────────────────────────────────────────

export type Faction = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rivals: string[];     // faction IDs — helping this faction slightly lowers these
  allies: string[];     // faction IDs — helping this faction slightly raises these
  hidden?: boolean;     // must be discovered before appearing in UI
};

// The core divide: Alchemist Guild = wizards & science. Temples = faith & magic.
// They clash on philosophical and political grounds. The 4 elemental temples
// are neutral with each other but all distrust the Guild's methods.
// Shadow and Death are hidden cults that ALL other factions oppose.
// Farmers are mostly indifferent to the magic-vs-science war — they just want
// peace and trade. Only Shadow and Death truly threaten their way of life.
// Buying/selling magic items from a faction affects reputation with them and rivals.

const DARK_TEMPLES = ["temple_shadow", "temple_death"];
const LIGHT_TEMPLES = ["temple_earthmother", "temple_windcaller", "temple_tidewarden", "temple_dawnfire"];
const ALL_TEMPLES = [...LIGHT_TEMPLES, ...DARK_TEMPLES];

export const FACTIONS: Record<string, Faction> = {
  alchemist_guild: {
    id: "alchemist_guild",
    name: "Alchemist Guild",
    emoji: "\u2697\uFE0F",
    description: "Wizards and scholars who trust science over prayer. They brew potions, study the arcane, and believe knowledge — not faith — shapes the world.",
    rivals: [...ALL_TEMPLES],       // Science vs faith — every temple distrusts them
    allies: [],
  },
  temple_earthmother: {
    id: "temple_earthmother",
    name: "Temple of the Earthmother",
    emoji: "\u{1F30D}",
    description: "Followers of stone and soil. They value endurance, farming, and the natural order. The Guild's meddling with nature offends them.",
    rivals: ["alchemist_guild", ...DARK_TEMPLES],
    allies: [],                     // Neutral with other light temples
  },
  temple_windcaller: {
    id: "temple_windcaller",
    name: "Temple of the Windcaller",
    emoji: "\u{1F32C}\uFE0F",
    description: "Devotees of freedom and speed. They favor scouts, travelers, and those who refuse to be bound. The Guild's rigid formulas stifle the spirit.",
    rivals: ["alchemist_guild", ...DARK_TEMPLES],
    allies: [],
  },
  temple_tidewarden: {
    id: "temple_tidewarden",
    name: "Temple of the Tidewarden",
    emoji: "\u{1F30A}",
    description: "Guardians of the cleansing waters. They heal, purify, and protect the faithful. The Guild's artificial remedies are an insult to divine healing.",
    rivals: ["alchemist_guild", ...DARK_TEMPLES],
    allies: [],
  },
  temple_dawnfire: {
    id: "temple_dawnfire",
    name: "Temple of the Dawnfire",
    emoji: "\u2600\uFE0F",
    description: "Zealots of the burning sun. They burn away corruption and demand purity of purpose. The Guild dabbles in forces mortals were never meant to wield.",
    rivals: ["alchemist_guild", ...DARK_TEMPLES],
    allies: [],
  },
  temple_shadow: {
    id: "temple_shadow",
    name: "Temple of Shadow",
    emoji: "\u{1F311}",
    description: "A hidden cult lurking in Kardov's Gate. They worship the absence of light and trade in secrets, blackmail, and forbidden knowledge.",
    rivals: [...LIGHT_TEMPLES, "alchemist_guild"],
    allies: ["temple_death"],       // Darkness and Death walk together
    hidden: true,                   // Must be discovered
  },
  temple_death: {
    id: "temple_death",
    name: "Temple of Death",
    emoji: "\u{1F480}",
    description: "Necromancers and death-worshippers hidden beneath Kardov's Gate. They believe death is not an end but a doorway to true power.",
    rivals: [...LIGHT_TEMPLES, "alchemist_guild"],
    allies: ["temple_shadow"],      // Death and Shadow walk together
    hidden: true,                   // Must be discovered
  },
  farmers: {
    id: "farmers",
    name: "Farmers & Villagers",
    emoji: "\u{1F33E}",
    description: "The common folk of the island. They care about harvests, trade, and keeping trouble away from their fields. They're mostly indifferent to the wizard-priest rivalries, but they despise the dark cults that threaten their families.",
    rivals: [...DARK_TEMPLES],      // Only hate Shadow and Death
    allies: [],                     // Neutral to everyone else
  },
};

export const FACTION_IDS = Object.keys(FACTIONS);

// ── Rep Change Helpers ──────────────────────────────────────────────────────

/** Clamp rep to [-100, 100] */
function clamp(n: number): number {
  return Math.max(-100, Math.min(100, n));
}

/**
 * Apply reputation change for completing a quest/action for a faction.
 * Returns a new faction_rep record with all changes applied:
 *   - Main faction gets full `amount`
 *   - Allied factions get +floor(amount/3)
 *   - Rival factions get -floor(amount/3)
 */
export function changeRep(
  factionRep: Record<string, number>,
  factionId: string,
  amount: number,
): { newRep: Record<string, number>; changes: { factionId: string; delta: number; newValue: number }[] } {
  const rep = { ...factionRep };
  const changes: { factionId: string; delta: number; newValue: number }[] = [];
  const faction = FACTIONS[factionId];
  if (!faction) return { newRep: rep, changes };

  // Main faction change
  const oldMain = rep[factionId] ?? 0;
  rep[factionId] = clamp(oldMain + amount);
  changes.push({ factionId, delta: amount, newValue: rep[factionId] });

  // Spillover to allies (+1/3 of amount)
  const spillover = Math.floor(Math.abs(amount) / 3) * Math.sign(amount);
  if (spillover !== 0) {
    for (const allyId of faction.allies) {
      const old = rep[allyId] ?? 0;
      rep[allyId] = clamp(old + spillover);
      changes.push({ factionId: allyId, delta: spillover, newValue: rep[allyId] });
    }
    // Rivals get opposite spillover
    for (const rivalId of faction.rivals) {
      const old = rep[rivalId] ?? 0;
      rep[rivalId] = clamp(old - spillover);
      changes.push({ factionId: rivalId, delta: -spillover, newValue: rep[rivalId] });
    }
  }

  return { newRep: rep, changes };
}

/** Get rep value for a faction (defaults to 0 / neutral) */
export function getRep(factionRep: Record<string, number>, factionId: string): number {
  return factionRep[factionId] ?? 0;
}

// ── Shop Price Modifier ─────────────────────────────────────────────────────
// Friendly = 5% off, Honored = 10%, Revered = 15%, Exalted = 20%
// Unfriendly = +10%, Hostile = +25%, Hated = refused service

export function priceModifier(rep: number): number {
  const tier = getRepTier(rep);
  switch (tier.tier) {
    case "exalted":  return 0.80;
    case "revered":  return 0.85;
    case "honored":  return 0.90;
    case "friendly": return 0.95;
    case "neutral":  return 1.00;
    case "unfriendly": return 1.10;
    case "hostile":  return 1.25;
    case "hated":    return Infinity; // refused
  }
}

/** Check if a faction will do business with you */
export function willServe(rep: number): boolean {
  return getRepTier(rep).tier !== "hated";
}

// ── Magic Item Trade Rep ────────────────────────────────────────────────────
// Buying or selling magic items from a faction-aligned shop affects reputation.
// Buying = small positive (+2 per trade). Selling = smaller (+1).
// Rival factions notice and disapprove (-1 per trade).
// Farmers don't care about magic item trades.

/** Map shop IDs to their owning faction (null = no faction affiliation) */
export const SHOP_FACTION: Record<string, string | null> = {
  shop_alchemist: "alchemist_guild",
  shop_magic: "alchemist_guild",      // magic shop is Guild-adjacent (wizards & science)
  shop_provisions: null,              // neutral — everyone eats
  shop_weapons: null,                 // neutral — everyone fights
  shop_armor: null,                   // neutral
  shop_general: null,                 // neutral
  shop_stables: null,                 // neutral
  shop_pets: null,                    // neutral
  shop_mercenary: null,               // general mercs have no faction loyalty
};

/**
 * Calculate rep changes from buying/selling a magic item at a faction shop.
 * Returns null if the shop has no faction affiliation.
 */
export function magicItemTradeRep(
  factionRep: Record<string, number>,
  shopId: string,
  isBuying: boolean,
): ReturnType<typeof changeRep> | null {
  const factionId = SHOP_FACTION[shopId];
  if (!factionId) return null;
  const amount = isBuying ? 2 : 1;
  return changeRep(factionRep, factionId, amount);
}
