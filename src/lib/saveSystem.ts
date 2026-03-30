import { supabase } from "./supabase";

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

export type CharacterSave = {
  wallet: string;
  nft_address: string;
  class_id: string;
  level: number;
  xp: number;
  skill_ranks: Record<string, number>;
  feats: string[];                        // feat ids (called "abilities" in UI)
  quest_flags: Record<string, boolean>;
  quest_cooldowns: Record<string, string>;  // ISO timestamps
  inventory: InventoryItem[];
  equipment: Equipment;
  map_region: string;
  map_node: string;
  map_hex: { q: number; r: number };       // current hex on world map
  world_layer: number;
  day: number;                              // in-game days elapsed
  food: number;                             // food items carried
  current_hp: number;                       // current HP (persists between battles)
  max_hp: number;                           // max HP (recalculated from stats + class)
  gold: number;
  battles_won: number;
  battles_lost: number;
  total_play_time: number;
  created_at: string;
  updated_at: string;
};

// ── XP & Leveling ────────────────────────────────────────────────────────────
// XP curve: each level costs more. Level 1→2 = 100 XP, doubles every 5 levels.

export function xpForLevel(level: number): number {
  const bracket = Math.floor((level - 1) / 5);
  const base = 100 * Math.pow(2, bracket);
  return base;
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

// ── Travel & Food ────────────────────────────────────────────────────────────
// 1 hex = 1 day travel. 3 food per day to heal. Healing = floor(CON/2) + level.

export const FOOD_PER_DAY = 3;

export type TravelResult = {
  daysElapsed: number;
  foodConsumed: number;
  hpHealed: number;
  starving: boolean;   // true if not enough food
  newHp: number;
  newFood: number;
  newDay: number;
};

/** Calculate result of traveling N hexes */
export function travel(
  hexes: number,
  save: Pick<CharacterSave, "day" | "food" | "current_hp" | "max_hp" | "level">,
  con: number,
): TravelResult {
  const days = hexes; // 1 hex = 1 day
  const foodNeeded = days * FOOD_PER_DAY;
  const foodAvailable = Math.min(save.food, foodNeeded);
  const daysWithFood = Math.floor(foodAvailable / FOOD_PER_DAY);
  const starving = foodAvailable < foodNeeded;

  // Heal on days with full food: floor(CON/2) + level per day
  const healPerDay = Math.floor(Math.max(1, con) / 2) + save.level;
  const hpHealed = daysWithFood * healPerDay;

  // Starving days deal 1 damage per day
  const starvingDays = days - daysWithFood;
  const starveDmg = starvingDays;

  const newHp = Math.min(save.max_hp, Math.max(1, save.current_hp + hpHealed - starveDmg));

  return {
    daysElapsed: days,
    foodConsumed: foodAvailable,
    hpHealed,
    starving,
    newHp,
    newFood: save.food - foodAvailable,
    newDay: save.day + days,
  };
}

// ── Battle Rewards ───────────────────────────────────────────────────────────

export function battleRewards(difficulty: "easy" | "medium" | "hard", playerLevel: number): { xp: number; gold: number } {
  const base = { easy: 25, medium: 60, hard: 120 };
  const goldBase = { easy: 5, medium: 15, hard: 30 };
  // Scale slightly with level so grinding stays worthwhile
  const scale = 1 + (playerLevel - 1) * 0.1;
  return {
    xp: Math.round(base[difficulty] * scale),
    gold: Math.round(goldBase[difficulty] * scale),
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
    quest_flags: {},
    quest_cooldowns: {},
    inventory: [],
    equipment: {},
    map_region: "kardovs-gate",
    map_node: "tavern",
    map_hex: { q: 36, r: 32 },  // starting hex — Kardov's Gate (central city)
    world_layer: 1,
    day: 1,
    food: 9,                    // 3 days of food to start
    current_hp: 12,
    max_hp: 12,
    gold: 0,
    battles_won: 0,
    battles_lost: 0,
    total_play_time: 0,
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

export function cooldownRemaining(cooldowns: Record<string, string>, questId: string): number {
  const expiry = cooldowns[questId];
  if (!expiry) return 0;
  return Math.max(0, new Date(expiry).getTime() - Date.now());
}
