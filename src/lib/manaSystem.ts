// Tales of Tasern — Mana & Cooldown System
// Manages mana pools, cooldown tracking, ability slot equipping, and level-up unlocks.

import type { ClassAbility } from "./classAbilitySystem";
import { getClassAbilities, getUnlockedAbilities, getAbilityAtLevel } from "./classAbilitySystem";

// ── Mana Pool Configuration ───────────────────────────────────────────────────

/** Base mana per class. Casters get more, martial classes get less. */
const CLASS_BASE_MANA: Record<string, number> = {
  fighter:     20,
  wizard:      60,
  rogue:       25,
  cleric:      50,
  ranger:      30,
  paladin:     35,
  barbarian:   15,
  bard:        45,
  druid:       50,
  monk:        35,
  necromancer: 55,
  warlock:     50,
};

/** Mana gained per character level */
const CLASS_MANA_PER_LEVEL: Record<string, number> = {
  fighter:     2,
  wizard:      8,
  rogue:       3,
  cleric:      6,
  ranger:      4,
  paladin:     4,
  barbarian:   2,
  bard:        6,
  druid:       6,
  monk:        4,
  necromancer: 7,
  warlock:     6,
};

/** Which stat gives bonus mana per modifier point */
const CLASS_MANA_STAT: Record<string, "int" | "wis" | "cha"> = {
  fighter:     "con" as "int",  // fighters use CON but typed as the union
  wizard:      "int",
  rogue:       "int",
  cleric:      "wis",
  ranger:      "wis",
  paladin:     "cha",
  barbarian:   "con" as "int",
  bard:        "cha",
  druid:       "wis",
  monk:        "wis",
  necromancer: "int",
  warlock:     "cha",
};

/** Mana bonus per point of stat modifier */
const MANA_PER_STAT_MOD = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ManaPool = {
  current: number;
  max: number;
  regenPerRound: number;
};

export type CooldownTracker = Record<string, number>;  // abilityId → turns remaining

export type AbilitySlotConfig = {
  /** Max number of abilities that can be equipped for combat at once */
  maxSlots: number;
  /** Currently equipped ability IDs */
  equipped: string[];
};

export type LevelUpNotification = {
  level: number;
  abilityUnlocked: ClassAbility;
  message: string;
};

export type CombatManaState = {
  pool: ManaPool;
  cooldowns: CooldownTracker;
  slots: AbilitySlotConfig;
};

// ── Ability modifier helper ───────────────────────────────────────────────────

function aMod(stat: number): number {
  return Math.floor(Math.max(0, stat) / 2);
}

// ── Mana Pool Calculations ────────────────────────────────────────────────────

/** Calculate max mana for a character */
export function calculateMaxMana(
  classId: string,
  level: number,
  stats: { int: number; wis: number; cha: number; con: number }
): number {
  const baseMana = CLASS_BASE_MANA[classId] ?? 30;
  const perLevel = CLASS_MANA_PER_LEVEL[classId] ?? 4;
  const manaStat = CLASS_MANA_STAT[classId] ?? "int";

  // Get the stat value for mana calculation
  let statValue: number;
  switch (manaStat) {
    case "int": statValue = stats.int; break;
    case "wis": statValue = stats.wis; break;
    case "cha": statValue = stats.cha; break;
    default: statValue = stats.int;
  }

  const statBonus = aMod(statValue) * MANA_PER_STAT_MOD;
  return baseMana + (perLevel * (level - 1)) + statBonus;
}

/** Calculate mana regen per round (happens at start of turn) */
export function calculateManaRegen(classId: string, level: number, wisMod: number): number {
  // Base regen: 1-3 per round depending on class
  const baseRegen = classId === "wizard" || classId === "necromancer" || classId === "warlock"
    ? 3
    : classId === "cleric" || classId === "druid" || classId === "bard"
      ? 2
      : 1;
  // +1 per 5 levels, +1 per 2 WIS mod
  return baseRegen + Math.floor(level / 5) + Math.floor(Math.max(0, wisMod) / 2);
}

/** Create a fresh mana pool for combat start */
export function createManaPool(
  classId: string,
  level: number,
  stats: { int: number; wis: number; cha: number; con: number }
): ManaPool {
  const max = calculateMaxMana(classId, level, stats);
  const wisMod = aMod(stats.wis);
  return {
    current: max,  // start combat at full mana
    max,
    regenPerRound: calculateManaRegen(classId, level, wisMod),
  };
}

// ── Cooldown Management ───────────────────────────────────────────────────────

/** Create empty cooldown tracker */
export function createCooldownTracker(): CooldownTracker {
  return {};
}

/** Put an ability on cooldown */
export function startCooldown(tracker: CooldownTracker, abilityId: string, turns: number): CooldownTracker {
  if (turns <= 0) return tracker;
  return { ...tracker, [abilityId]: turns };
}

/** Tick all cooldowns down by 1 (call at start of each turn) */
export function tickCooldowns(tracker: CooldownTracker): CooldownTracker {
  const next: CooldownTracker = {};
  for (const [id, remaining] of Object.entries(tracker)) {
    if (remaining > 1) {
      next[id] = remaining - 1;
    }
    // If remaining is 1, it expires this tick — don't include it
  }
  return next;
}

/** Check if an ability is on cooldown */
export function isOnCooldown(tracker: CooldownTracker, abilityId: string): boolean {
  return (tracker[abilityId] ?? 0) > 0;
}

/** Get remaining cooldown turns for an ability */
export function getCooldownRemaining(tracker: CooldownTracker, abilityId: string): number {
  return tracker[abilityId] ?? 0;
}

// ── Ability Slot System ───────────────────────────────────────────────────────

/** Max ability slots by character level */
function getMaxSlots(level: number): number {
  if (level >= 15) return 8;
  if (level >= 12) return 7;
  if (level >= 9) return 6;
  if (level >= 7) return 5;
  if (level >= 5) return 4;
  if (level >= 3) return 3;
  return 2;  // level 1-2: can equip 2 abilities
}

/** Create ability slot config for a character */
export function createAbilitySlots(classId: string, level: number): AbilitySlotConfig {
  const maxSlots = getMaxSlots(level);
  // Auto-equip all unlocked abilities up to max slots
  const unlocked = getUnlockedAbilities(classId, level);
  const equipped = unlocked.slice(0, maxSlots).map(a => a.id);
  return { maxSlots, equipped };
}

/** Equip an ability into a slot (replacing if full) */
export function equipAbility(
  slots: AbilitySlotConfig,
  abilityId: string,
  classId: string,
  level: number
): AbilitySlotConfig {
  // Verify the ability is unlocked
  const unlocked = getUnlockedAbilities(classId, level);
  if (!unlocked.some(a => a.id === abilityId)) return slots;
  // Already equipped?
  if (slots.equipped.includes(abilityId)) return slots;
  // If at capacity, cannot add (must unequip first)
  if (slots.equipped.length >= slots.maxSlots) return slots;
  return { ...slots, equipped: [...slots.equipped, abilityId] };
}

/** Unequip an ability from slots */
export function unequipAbility(slots: AbilitySlotConfig, abilityId: string): AbilitySlotConfig {
  return { ...slots, equipped: slots.equipped.filter(id => id !== abilityId) };
}

/** Swap an equipped ability for another */
export function swapAbility(
  slots: AbilitySlotConfig,
  removeId: string,
  addId: string,
  classId: string,
  level: number
): AbilitySlotConfig {
  const unlocked = getUnlockedAbilities(classId, level);
  if (!unlocked.some(a => a.id === addId)) return slots;
  const equipped = slots.equipped.map(id => id === removeId ? addId : id);
  return { ...slots, equipped };
}

// ── Ability Availability Check ────────────────────────────────────────────────

export type AbilityAvailability = {
  abilityId: string;
  available: boolean;
  reason?: string;
};

/** Check if a specific ability can be used right now */
export function canUseAbility(
  ability: ClassAbility,
  manaPool: ManaPool,
  cooldowns: CooldownTracker,
  slots: AbilitySlotConfig,
  hasActed: boolean,
  hasBonusActed: boolean
): AbilityAvailability {
  const id = ability.id;

  // Must be equipped
  if (!slots.equipped.includes(id)) {
    return { abilityId: id, available: false, reason: "Not equipped" };
  }

  // Check mana
  if (manaPool.current < ability.manaCost) {
    return { abilityId: id, available: false, reason: `Need ${ability.manaCost} mana (have ${manaPool.current})` };
  }

  // Check cooldown
  if (isOnCooldown(cooldowns, id)) {
    const remaining = getCooldownRemaining(cooldowns, id);
    return { abilityId: id, available: false, reason: `On cooldown (${remaining} turns)` };
  }

  // Check action economy
  if (ability.actionType === "standard" && hasActed) {
    return { abilityId: id, available: false, reason: "Standard action already used" };
  }
  if (ability.actionType === "bonus" && hasBonusActed) {
    return { abilityId: id, available: false, reason: "Bonus action already used" };
  }

  return { abilityId: id, available: true };
}

/** Get all available abilities for the current turn */
export function getAvailableAbilitiesFromSlots(
  classId: string,
  level: number,
  manaPool: ManaPool,
  cooldowns: CooldownTracker,
  slots: AbilitySlotConfig,
  hasActed: boolean,
  hasBonusActed: boolean
): { ability: ClassAbility; availability: AbilityAvailability }[] {
  const all = getClassAbilities(classId);
  return slots.equipped
    .map(id => all.find(a => a.id === id))
    .filter((a): a is ClassAbility => a !== undefined && a.levelRequired <= level)
    .map(ability => ({
      ability,
      availability: canUseAbility(ability, manaPool, cooldowns, slots, hasActed, hasBonusActed),
    }));
}

// ── Mana Spending ─────────────────────────────────────────────────────────────

/** Spend mana for an ability. Returns updated pool or null if insufficient. */
export function spendMana(pool: ManaPool, cost: number): ManaPool | null {
  if (pool.current < cost) return null;
  return { ...pool, current: pool.current - cost };
}

/** Regenerate mana at start of turn */
export function regenMana(pool: ManaPool): ManaPool {
  return {
    ...pool,
    current: Math.min(pool.max, pool.current + pool.regenPerRound),
  };
}

/** Restore mana by a specific amount (potions, Dark Pact, etc.) */
export function restoreMana(pool: ManaPool, amount: number): ManaPool {
  return {
    ...pool,
    current: Math.min(pool.max, pool.current + amount),
  };
}

// ── Level-Up System ───────────────────────────────────────────────────────────

/** Check if leveling up unlocks a new ability */
export function checkLevelUpUnlock(classId: string, newLevel: number): LevelUpNotification | null {
  const ability = getAbilityAtLevel(classId, newLevel);
  if (!ability) return null;
  return {
    level: newLevel,
    abilityUnlocked: ability,
    message: `Level ${newLevel} reached! New ability unlocked: ${ability.name} — ${ability.description}`,
  };
}

/** Get all level-up notifications from level 1 to current level (for recap) */
export function getAllUnlockNotifications(classId: string, currentLevel: number): LevelUpNotification[] {
  const notifications: LevelUpNotification[] = [];
  const abilities = getClassAbilities(classId);
  for (const ability of abilities) {
    if (ability.levelRequired <= currentLevel) {
      notifications.push({
        level: ability.levelRequired,
        abilityUnlocked: ability,
        message: `Level ${ability.levelRequired}: ${ability.name} — ${ability.description}`,
      });
    }
  }
  return notifications;
}

// ── Full Combat State Creation ────────────────────────────────────────────────

/** Create the full mana combat state for a unit entering combat */
export function createCombatManaState(
  classId: string,
  level: number,
  stats: { int: number; wis: number; cha: number; con: number }
): CombatManaState {
  return {
    pool: createManaPool(classId, level, stats),
    cooldowns: createCooldownTracker(),
    slots: createAbilitySlots(classId, level),
  };
}

/** Process start-of-turn: regen mana and tick cooldowns */
export function processStartOfTurn(state: CombatManaState): CombatManaState {
  return {
    ...state,
    pool: regenMana(state.pool),
    cooldowns: tickCooldowns(state.cooldowns),
  };
}

/** Process ability use: spend mana and start cooldown */
export function processAbilityUse(
  state: CombatManaState,
  ability: ClassAbility
): CombatManaState | null {
  const newPool = spendMana(state.pool, ability.manaCost);
  if (!newPool) return null;
  return {
    ...state,
    pool: newPool,
    cooldowns: startCooldown(state.cooldowns, ability.id, ability.cooldownTurns),
  };
}
