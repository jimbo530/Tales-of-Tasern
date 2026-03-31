import { supabase } from "./supabase";
import { type Party, type AdventureParty, defaultParty, createAdventureParty } from "./party";

// ── Types ────────────────────────────────────────────────────────────────────

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
};

export type Equipment = {
  weapon?: string;
  armor?: string;
  shield?: string;
  accessory?: string;
};

// ── Currency (D&D 3.5) ──────────────────────────────────────────────────────
// 1gp = 10sp = 100cp.  50 coins of any denomination = 1 lb.
// Money changers at cities/temples convert denominations for a cut.

export type Coins = { gp: number; sp: number; cp: number };

/** Total value of a purse in copper pieces */
export function totalCp(c: Coins): number {
  return c.gp * 100 + c.sp * 10 + c.cp;
}

/** Weight of coins in pounds (50 coins = 1 lb regardless of type) */
export function coinWeight(c: Coins): number {
  return (c.gp + c.sp + c.cp) / 50;
}

/** Display coins as "Xg Ys Zc", omitting zero denominations */
export function formatCoins(c: Coins): string {
  const parts: string[] = [];
  if (c.gp > 0) parts.push(`${c.gp}g`);
  if (c.sp > 0) parts.push(`${c.sp}s`);
  if (c.cp > 0) parts.push(`${c.cp}c`);
  return parts.join(" ") || "0c";
}

/** Convert a copper amount to the highest denominations */
export function cpToCoins(cp: number): Coins {
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  return { gp, sp, cp: cp % 10 };
}

/** Add copper to a purse — reward arrives as the highest denominations */
export function addCp(coins: Coins, cp: number): Coins {
  const total = totalCp(coins) + cp;
  return cpToCoins(total);
}

/** Subtract a cost (in cp) from purse, breaking larger coins for change. Returns null if can't afford. */
export function subtractCp(coins: Coins, costCp: number): Coins | null {
  const total = totalCp(coins);
  if (total < costCp) return null;
  let remaining = costCp;
  let { gp, sp, cp } = { ...coins };
  // Pay from smallest denomination up
  const fromCp = Math.min(cp, remaining);
  cp -= fromCp; remaining -= fromCp;
  if (remaining > 0) {
    const spNeeded = Math.ceil(remaining / 10);
    const fromSp = Math.min(sp, spNeeded);
    sp -= fromSp;
    const paid = fromSp * 10;
    if (paid >= remaining) { cp += paid - remaining; remaining = 0; }
    else { remaining -= paid; }
  }
  if (remaining > 0) {
    const gpNeeded = Math.ceil(remaining / 100);
    gp -= gpNeeded;
    const change = gpNeeded * 100 - remaining;
    sp += Math.floor(change / 10);
    cp += change % 10;
  }
  return { gp, sp, cp };
}

/** Money changer: consolidate all coins to highest denominations, minus a fee (e.g. 0.05 = 5%) */
export function exchangeUp(coins: Coins, feePercent: number): Coins {
  const total = totalCp(coins);
  const afterFee = Math.floor(total * (1 - feePercent));
  return cpToCoins(afterFee);
}

/** Check if purse can afford a cost in cp */
export function canAfford(coins: Coins, costCp: number): boolean {
  return totalCp(coins) >= costCp;
}

/** Add coins directly — preserves denominations (copper stays copper until exchanged) */
export function addCoinsRaw(purse: Coins, reward: Coins): Coins {
  return { gp: purse.gp + reward.gp, sp: purse.sp + reward.sp, cp: purse.cp + reward.cp };
}

export type CharacterSave = {
  wallet: string;
  nft_address: string;
  class_id: string;
  level: number;
  xp: number;
  skill_ranks: Record<string, number>;
  feats: string[];                        // feat ids (called "abilities" in UI)
  // ── Spellcasting ──
  known_spells: string[];                  // spell IDs known (sorcerer, bard — permanent choices)
  prepared_spells: string[];               // spell IDs prepared today (wizard, cleric, druid, paladin, ranger)
  spellbook: string[];                     // wizard spellbook — all spells learned (superset of prepared)
  spell_slots_used: number[];              // slots expended today, indexed by spell level [0th, 1st, ...]
  domains: [string, string] | null;        // cleric domain IDs (exactly 2), null for non-clerics
  school_specialization: string | null;    // wizard specialization school ID, null if generalist
  prohibited_schools: string[];            // wizard prohibited schools (2 for specialist, 0 for generalist)
  quest_flags: Record<string, boolean>;
  quest_cooldowns: Record<string, string>;  // ISO timestamps
  faction_rep: Record<string, number>;      // faction id → rep (-100 to 100, 0 = neutral)
  inventory: InventoryItem[];
  equipment: Equipment;
  party: Party;                            // up to 4 NFT heroes + followers each
  map_region: string;
  map_node: string;
  map_hex: { q: number; r: number };       // current hex on world map
  world_layer: number;
  day: number;                              // in-game days elapsed (derived: Math.floor(hour / 24) + 1)
  hour: number;                             // in-game hours elapsed (0-based, each action costs hours)
  food: number;                             // food items carried
  current_hp: number;                       // current HP (persists between battles)
  max_hp: number;                           // max HP (recalculated from stats + class)
  coins: Coins;                           // purse — separate gp/sp/cp (50 coins = 1 lb)
  fame: number;                     // performer renown (0+), unlocks venues & tips
  last_rest_hour: number;           // hour when the player last rested (for exhaustion)
  last_ate_hour: number;            // hour when the player last ate (for starvation exhaustion)
  battles_won: number;
  battles_lost: number;
  total_play_time: number;
  // ── Multi-Party Adventuring ──
  parties: AdventureParty[];         // multiple parties exploring independently
  active_party_index: number;        // which party is currently selected
  created_at: string;
  updated_at: string;
};

// ── XP & Leveling ────────────────────────────────────────────────────────────
// D&D 3.5 PHB Table 3-2: XP needed from level N to N+1 = N × 1,000.
// Total XP at level N = N*(N-1)/2 * 1000.

export function xpForLevel(level: number): number {
  return level * 1000;
}

export function xpToNextLevel(currentLevel: number, currentXp: number): { needed: number; progress: number } {
  const needed = xpForLevel(currentLevel);
  return { needed, progress: Math.min(currentXp / needed, 1) };
}

/** Calculate how many levels gained and leftover XP */
export function addXp(currentLevel: number, currentXp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let level = currentLevel;
  let xp = currentXp + gained;
  let levelsGained = 0;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    levelsGained++;
  }

  return { level, xp, levelsGained };
}

// ── Time & Travel ────────────────────────────────────────────────────────────
// Each action costs hours: travel = 8hrs/hex, rest = 8hrs, search = 8hrs.
// 1 food consumed per 8-hour action. Healing on rest = floor(CON/2) + level.

export const HOURS_PER_ACTION = 8;  // travel 1 hex, rest, or search
export const FOOD_PER_DAY = 3;      // legacy compat — 3 food = 1 full day (3 actions)

// ── Exhaustion ─────────────────────────────────────────────────────────────
// Two sources of exhaustion, both stack:
//   Sleep: +1 point per 24 hours without rest
//   Hunger: +1 point per 24 hours without food (after 24h grace period, so first at 48h)
// Each point = −1 to ALL ability scores (min 1 — won't kill, but warns).
// Forced marches are always allowed.

export function getExhaustionPoints(
  currentHour: number,
  lastRestHour: number,
  lastAteHour?: number,
): { points: number; sleepPoints: number; hungerPoints: number; hoursAwake: number; hoursSinceFood: number } {
  const hoursAwake = Math.max(0, currentHour - lastRestHour);
  const hoursSinceFood = Math.max(0, currentHour - (lastAteHour ?? currentHour));
  const sleepPoints = Math.floor(hoursAwake / 24);
  // 24h grace before starvation kicks in, then +1 per 24h after that
  const hungerPoints = hoursSinceFood > 24 ? Math.floor((hoursSinceFood - 24) / 24) : 0;
  return { points: sleepPoints + hungerPoints, sleepPoints, hungerPoints, hoursAwake, hoursSinceFood };
}

/** Apply exhaustion to a stat value (floor 1) */
export function exhaustedStat(base: number, exhaustionPoints: number): number {
  return Math.max(1, Math.floor(base) - exhaustionPoints);
}

/** How close is the lowest stat to bottoming out? Returns the minimum effective stat. */
export function lowestExhaustedStat(stats: Record<string, number>, exhaustionPoints: number): number {
  let min = Infinity;
  for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
    min = Math.min(min, exhaustedStat(stats[key] ?? 10, exhaustionPoints));
  }
  return min;
}

export type TravelResult = {
  hoursElapsed: number;
  foodConsumed: number;
  hpHealed: number;
  starving: boolean;   // true if not enough food
  newHp: number;
  newFood: number;
  newHour: number;
  newDay: number;
};

/** Calculate result of traveling N hexes (8 hrs per hex, 1 food per hex) */
export function travel(
  hexes: number,
  save: Pick<CharacterSave, "hour" | "food" | "current_hp" | "max_hp" | "level">,
  con: number,
): TravelResult {
  const hours = hexes * HOURS_PER_ACTION;
  const foodNeeded = hexes;  // 1 food per 8-hour action
  const foodAvailable = Math.min(save.food, foodNeeded);
  const actionsWithFood = foodAvailable;
  const starving = foodAvailable < foodNeeded;

  // No healing during travel — only during rest
  // Starving actions deal 1 damage each
  const starvingActions = hexes - actionsWithFood;
  const starveDmg = starvingActions;

  const newHp = Math.min(save.max_hp, Math.max(1, save.current_hp - starveDmg));
  const newHour = save.hour + hours;

  return {
    hoursElapsed: hours,
    foodConsumed: foodAvailable,
    hpHealed: 0,
    starving,
    newHp,
    newFood: save.food - foodAvailable,
    newHour,
    newDay: Math.floor(newHour / 24) + 1,
  };
}

// ── Battle Rewards ───────────────────────────────────────────────────────────

// D&D 3.5 DMG Table 2-6 (simplified): CR = level → 300 XP per character.
// Easy ≈ CR below level, Medium ≈ CR equal, Hard ≈ CR above.
export function battleRewards(difficulty: "easy" | "medium" | "hard", playerLevel: number): { xp: number; goldCp: number } {
  const base = { easy: 150, medium: 300, hard: 600 };
  const goldBase = { easy: 500, medium: 1500, hard: 3000 }; // in copper
  // Scale with level so higher-level fights stay rewarding
  const scale = 1 + (playerLevel - 1) * 0.15;
  return {
    xp: Math.round(base[difficulty] * scale),
    goldCp: Math.round(goldBase[difficulty] * scale),
  };
}

// ── Default Save ─────────────────────────────────────────────────────────────

export function defaultSave(
  wallet: string,
  nftAddress: string,
  classId: string,
  skillRanks: Record<string, number> = {},
  feats: string[] = [],
): Omit<CharacterSave, "created_at" | "updated_at"> {
  return {
    wallet: wallet.toLowerCase(),
    nft_address: nftAddress.toLowerCase(),
    class_id: classId,
    level: 1,
    xp: 0,
    skill_ranks: skillRanks,
    feats,
    known_spells: [],
    prepared_spells: [],
    spellbook: [],
    spell_slots_used: [],
    domains: null,
    school_specialization: null,
    prohibited_schools: [],
    quest_flags: {},
    quest_cooldowns: {},
    faction_rep: {},
    inventory: [],
    equipment: {},
    party: defaultParty(nftAddress),
    map_region: "kardovs-gate",
    map_node: "tavern",
    map_hex: { q: 36, r: 32 },  // starting hex — Kardov's Gate (central city)
    world_layer: 1,
    day: 1,
    hour: 0,                    // start of day 1
    food: 9,                    // 3 days of food to start
    current_hp: 12,
    max_hp: 12,
    coins: { gp: 0, sp: 0, cp: 0 },
    fame: 0,
    last_rest_hour: 0,
    last_ate_hour: 0,
    battles_won: 0,
    battles_lost: 0,
    total_play_time: 0,
    parties: [createAdventureParty("party-0", "Main Party", nftAddress, { q: 36, r: 32 })],
    active_party_index: 0,
  };
}

// ── Split Authority ──────────────────────────────────────────────────────────
//
//   LP stats (STR, DEX, AC...)  →  chain is truth, cloud cache, local cache
//   RPG data (class, XP, inv...)  →  LOCAL is truth, cloud is backup
//
// On load:  local RPG data wins. Cloud only used if no local save exists.
// On save:  local saves instantly, pushes to cloud as backup.
// On conflict: local RPG always wins. LP stats always come from chain.
// Offline:  fully playable with cached LP stats + local RPG save.
// Back online: local RPG pushes to cloud. LP stats refresh from chain.

// ── localStorage (RPG authority) ─────────────────────────────────────────────

const SAVE_CACHE_KEY = "tot-character-save";

export function getLocalSave(wallet: string): CharacterSave | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${SAVE_CACHE_KEY}-${wallet.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as CharacterSave;
  } catch { return null; }
}

export function setLocalSave(save: CharacterSave) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SAVE_CACHE_KEY}-${save.wallet.toLowerCase()}`, JSON.stringify(save));
  } catch {}
}

// ── Load (local-first for RPG, chain-first for stats) ────────────────────────

export async function loadCharacterSave(wallet: string): Promise<CharacterSave | null> {
  const local = getLocalSave(wallet);

  // Try cloud backup
  let cloud: CharacterSave | null = null;
  try {
    const { data, error } = await supabase
      .from("character_saves")
      .select("*")
      .eq("wallet", wallet.toLowerCase())
      .single();
    if (!error && data) cloud = data as CharacterSave;
  } catch {
    // Offline — that's fine, local is authority anyway
  }

  // LOCAL wins for RPG data. Cloud is only used if no local save exists.
  if (local) {
    // If cloud has a newer nft_address (player switched NFT on another device),
    // keep it — but all RPG progression stays local.
    return local;
  }

  // No local save — use cloud if available (first login on this device)
  if (cloud) {
    setLocalSave(cloud);
    return cloud;
  }

  return null;
}

// ── Save (local instant + cloud backup) ──────────────────────────────────────

export async function saveCharacter(save: Partial<CharacterSave> & { wallet: string }): Promise<boolean> {
  const wallet = save.wallet.toLowerCase();
  const now = new Date().toISOString();

  // Always save locally first (instant, works offline)
  const existing = getLocalSave(wallet);
  const merged: CharacterSave = { ...(existing ?? {} as CharacterSave), ...save, wallet, updated_at: now } as CharacterSave;
  setLocalSave(merged);

  // Push to cloud as backup (best-effort, non-blocking if offline)
  try {
    const { error } = await supabase
      .from("character_saves")
      .upsert({ ...merged, updated_at: now }, { onConflict: "wallet" });
    return !error;
  } catch {
    // Offline — queued in local, will sync next time
    return true; // local save succeeded, that's what matters
  }
}

// ── Sync local → cloud (call when coming back online) ────────────────────────

export async function syncToCloud(wallet: string): Promise<boolean> {
  const local = getLocalSave(wallet);
  if (!local) return false;

  try {
    const { error } = await supabase
      .from("character_saves")
      .upsert({ ...local, updated_at: new Date().toISOString() }, { onConflict: "wallet" });
    return !error;
  } catch {
    return false;
  }
}

// ── Battle Log ───────────────────────────────────────────────────────────────

export async function logBattle(entry: {
  wallet: string;
  nft_address: string;
  class_id: string;
  level: number;
  difficulty: string;
  enemies: string[];
  result: "victory" | "defeat" | "retreat";
  rounds: number;
  xp_earned: number;
  gold_earned: number;
}): Promise<boolean> {
  const { error } = await supabase
    .from("battle_log")
    .insert({
      ...entry,
      wallet: entry.wallet.toLowerCase(),
      nft_address: entry.nft_address.toLowerCase(),
    });
  return !error;
}

// ── Quest Cooldown Helpers ───────────────────────────────────────────────────

export function isQuestOnCooldown(cooldowns: Record<string, string>, questId: string): boolean {
  const expiry = cooldowns[questId];
  if (!expiry) return false;
  return new Date(expiry) > new Date();
}

export function setQuestCooldown(cooldowns: Record<string, string>, questId: string, minutes: number): Record<string, string> {
  const expiry = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  return { ...cooldowns, [questId]: expiry };
}

/** Set a quest cooldown based on in-game days (stores "day:X" in the cooldown slot) */
export function setQuestCooldownDays(cooldowns: Record<string, string>, questId: string, currentDay: number, daysUntilReset: number): Record<string, string> {
  return { ...cooldowns, [questId]: `day:${currentDay + daysUntilReset}` };
}

/** Check if a quest is on in-game-day cooldown (format "day:X") */
export function isQuestOnDayCooldown(cooldowns: Record<string, string>, questId: string, currentDay: number): boolean {
  const val = cooldowns[questId];
  if (!val || !val.startsWith("day:")) return false;
  const expiryDay = parseInt(val.slice(4), 10);
  return currentDay < expiryDay;
}

/** Days remaining on an in-game-day cooldown */
export function dayCooldownRemaining(cooldowns: Record<string, string>, questId: string, currentDay: number): number {
  const val = cooldowns[questId];
  if (!val || !val.startsWith("day:")) return 0;
  const expiryDay = parseInt(val.slice(4), 10);
  return Math.max(0, expiryDay - currentDay);
}

export function cooldownRemaining(cooldowns: Record<string, string>, questId: string): number {
  const expiry = cooldowns[questId];
  if (!expiry) return 0;
  return Math.max(0, new Date(expiry).getTime() - Date.now());
}
