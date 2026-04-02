"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { type CharacterSave, type Coins, type Equipment, travel, HOURS_PER_ACTION, formatCoins, totalCp, canAfford, cpToCoins, coinWeight, exchangeUp, isQuestOnCooldown, isQuestOnDayCooldown, dayCooldownRemaining, xpToNextLevel, getExhaustionPoints, exhaustedStat, lowestExhaustedStat } from "@/lib/saveSystem";
import type { NftCharacter } from "@/hooks/useNftStats";
import { getZone, getLevelRange, generateFightEncounter, generateLootDrop, type EncounterData, type LootDrop } from "@/lib/encounters";
import { getShopsForLocation, getAvailableItems, type Shop, type ShopItem } from "@/lib/shops";
import { SKILLS, abilityMod as calcAbilityMod } from "@/lib/skills";
import { hireFollower, FACTION_TEMPLATES, maxFollowers, type Follower } from "@/lib/party";
import { rollFieldTreasure, rollTreasure, d, nd } from "@/lib/treasure";
import { MONSTERS } from "@/lib/monsters";
import { createMonsterSpec, type EnemySpec } from "@/lib/hexCombat";
import { FEATS, getSkillFocusBonus } from "@/lib/feats";
import { getClassById } from "@/lib/classes";
import { getCarryThresholds, getEncumbrance } from "@/lib/battleStats";
import { getItemInfo, getItemWeight } from "@/lib/itemRegistry";
import { rollFarmDrop, rollWildernessFoodDrop, rollHuntedFood, type FoodItem, type FreshFoodItem } from "@/lib/foodItems";
import type { QuestEncounter } from "@/components/HexBattle";

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
  difficulty?: "easy" | "medium" | "hard" | "deadly";
  description: string;
  hpChange?: number;
  goldChange?: number;
  coinReward?: Coins;
  foodChange?: number;
  xpChange?: number;
  foodDrop?: FoodItem[];     // specific food items found (farms, foraging)
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

export type HexInteraction = "travel" | "rest" | "skill";

// Skills usable in the field — grouped by purpose
export const FIELD_SKILLS = {
  // Broad search — finds widest range of things (traps, doors, clues, loot)
  search:           { id: "search",           name: "Search",            emoji: "🔍", ability: "int" as const, desc: "Find hidden things — loot, traps, doors, clues" },
  // Social — information, quests, rumors, trade tips
  diplomacy:        { id: "diplomacy",        name: "Diplomacy",         emoji: "🤝", ability: "cha" as const, desc: "Talk to locals — quests, rumors, information" },
  gatherInformation:{ id: "gatherInformation",name: "Gather Info",       emoji: "👂", ability: "cha" as const, desc: "Pick up rumors and learn about the area" },
  intimidate:       { id: "intimidate",       name: "Intimidate",        emoji: "💀", ability: "cha" as const, desc: "Threaten locals for information or tribute" },
  // Wilderness — food, herbs, tracking, animals
  survival:         { id: "survival",          name: "Survival",         emoji: "🌿", ability: "wis" as const, desc: "Forage food, find herbs, track animals" },
  handleAnimal:     { id: "handleAnimal",      name: "Handle Animal",    emoji: "🐾", ability: "cha" as const, desc: "Befriend or tame wild creatures" },
  // Awareness — spot danger, hear approaching threats
  spot:             { id: "spot",              name: "Spot",             emoji: "👁️", ability: "wis" as const, desc: "Notice hidden dangers or distant details" },
  listen:           { id: "listen",            name: "Listen",           emoji: "👂", ability: "wis" as const, desc: "Hear approaching creatures or hidden sounds" },
  // Knowledge — identify things, recall lore
  knowledge:        { id: "knowledge",         name: "Knowledge",        emoji: "📖", ability: "int" as const, desc: "Recall lore about the area, creatures, or history" },
  // Physical — climbing, swimming exploration
  climb:            { id: "climb",             name: "Climb",            emoji: "🧗", ability: "str" as const, desc: "Scale cliffs to reach hidden areas" },
  swim:             { id: "swim",              name: "Swim",             emoji: "🏊", ability: "str" as const, desc: "Dive underwater to find submerged things" },
  // Medical
  heal:             { id: "heal",              name: "Heal",             emoji: "❤️‍🩹", ability: "wis" as const, desc: "Gather healing herbs, treat wounds" },
  // Thievery
  openLock:         { id: "openLock",          name: "Open Lock",        emoji: "🔓", ability: "dex" as const, desc: "Pick locks on chests, doors, and cages" },
  disableDevice:    { id: "disableDevice",     name: "Disable Device",   emoji: "🪤", ability: "int" as const, desc: "Disarm traps and bypass mechanisms" },
  // Crafting
  craft:            { id: "craft",             name: "Craft",            emoji: "🔨", ability: "int" as const, desc: "Craft items from gathered materials" },
  // Performance
  perform:          { id: "perform",           name: "Perform",          emoji: "🎵", ability: "cha" as const, desc: "Busk for coin or entertain for favors" },
} as const;

export type FieldSkillId = keyof typeof FIELD_SKILLS;

export type WorldLuckResult = {
  worldRoll: number;          // d20 world luck — HIDDEN from player (DM knowledge)
  skillRoll: number;          // d20 + ability mod + ranks — SHOWN to player
  rawD20?: number;            // the raw d20 roll (shown to player)
  skillMod?: number;          // total modifier (ranks + ability mod + feats)
  skillUsed?: string;         // which skill was used (shown to player)
  skillDC: number;            // difficulty to beat (internal)
  interaction: HexInteraction;
  outcome: "nothing" | "fight" | "thug_fight" | "hazard" | "avoided_danger"
    | "find_food" | "find_coins" | "find_valuable" | "find_rare"
    | "find_quest" | "find_dungeon";
  difficulty?: "easy" | "medium" | "hard" | "deadly";
  description: string;
  hpChange: number;
  goldChange: number;           // flat copper change (costs negative, tips positive)
  coinReward?: Coins;           // mixed denomination coin find (preserves cp/sp/gp weight)
  foodChange: number;
  xpChange: number;
  fameChange?: number;          // performer renown gained (Perform skill only)
  factionRepChange?: { factionId: string; amount: number }; // faction rep from performing, crafting, etc.
  enemyCount?: number;        // pre-rolled count for generated encounters (thugs, etc.)
  encounter?: EncounterData;  // populated when outcome is "fight"
  loot?: LootDrop;           // populated on valuable/rare finds
  treasureDesc?: string;     // detailed treasure breakdown text
  foodDrop?: FoodItem[];     // specific food items found (farms, foraging)
  huntedFood?: FreshFoodItem[];  // fresh hunted/foraged food (spoils, terrain-specific)
  newFollower?: Follower;        // recruited follower to add to party
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

// Skill 25+: food, herbs, crafting materials
const FIND_FOOD_DESC: Record<HexType, string[]> = {
  town:     ["You find discarded but edible food behind a tavern.", "A kind baker hands you day-old bread."],
  forest:   ["You spot edible berries along the path.", "A small herb cache beneath a log.", "You gather useful bark and kindling."],
  desert:   ["You find a half-buried water skin.", "Dried cactus fruit — edible and hydrating."],
  jungle:   ["Exotic mushrooms — edible and valuable.", "You find a monkey's abandoned fruit stash.", "Useful vines and fibres for crafting."],
  swamp:    ["Peat moss with healing properties.", "Edible reeds and marsh tubers.", "Frog legs — not glamorous, but filling."],
  mountain: ["Mountain herbs growing in a crevice.", "You find a sheltered patch of alpine berries.", "Flint and useful stone for crafting."],
  plains:   ["A patch of wild grain ready to harvest.", "Rabbit burrow — fresh game.", "Useful fibres and wild flax."],
  coast:    ["A small catch of fish in a tidal pool.", "Edible seaweed and shellfish.", "Driftwood and rope — useful materials."],
  water:    ["You fish up something edible.", "Fresh water clams along the bank.", "Reeds and rushes for crafting."],
};

// Skill 30+: silver, gold coins
const FIND_COINS_DESC: Record<HexType, string[]> = {
  town:     ["You find a coin pouch dropped in the gutter.", "A grateful merchant tips you well."],
  forest:   ["A traveler's lost purse hangs from a branch.", "Old coins scattered around a long-dead campfire."],
  desert:   ["Wind-scoured coins glint in the sand.", "A buried satchel with silver coins."],
  jungle:   ["Gold coins spill from a rotted leather bag.", "An offering bowl with silver left by locals."],
  swamp:    ["Something metallic glints in shallow water.", "Coins in the pocket of a long-dead traveler."],
  mountain: ["A small ore deposit catches your eye — silver!", "A miner's forgotten coin stash in a crevice."],
  plains:   ["A traveler's lost coin pouch in the grass.", "Old battlefield — coins among the bones."],
  coast:    ["Coins washed ashore from a wreck.", "A barnacle-crusted coin purse in a tide pool."],
  water:    ["Gold coins glitter on the riverbed.", "A coin purse tangled in submerged roots."],
};

// Skill 35+: valuable items
const FIND_VALUABLE_DESC: Record<HexType, string[]> = {
  town:     ["You discover a hidden cache behind loose bricks!", "A grateful citizen rewards your good deed."],
  forest:   ["An ancient chest half-buried in roots!", "A rare medicinal herb worth serious gold."],
  desert:   ["Ancient artifacts poke from the sand.", "A jeweled dagger half-buried in a dune."],
  jungle:   ["A lost temple alcove with offerings!", "Glowing fungi worth a fortune to alchemists."],
  swamp:    ["Rare swamp orchids — alchemists pay dearly.", "A preserved chest rises from the mire."],
  mountain: ["A rich vein of precious ore!", "Gemstones embedded in a cave wall."],
  plains:   ["A merchant's lost strongbox in the grass!", "An old battlefield yields valuable relics."],
  coast:    ["Shipwreck debris washes ashore — treasure!", "A sealed chest from a sunken vessel."],
  water:    ["You pull up a waterlogged treasure chest!", "A gleaming weapon stuck in the riverbed."],
};

// Skill 40+: very valuable, possible magic items
const FIND_RARE_DESC: Record<HexType, string[]> = {
  town:     ["A hidden vault behind a false wall — someone's forgotten fortune!", "An enchanted trinket pulses faintly in a junk pile."],
  forest:   ["A faintly glowing weapon rests in a sacred grove.", "You uncover a druid's cache of potent magical herbs."],
  desert:   ["You unearth an ancient sarcophagus with golden relics!", "A djinn's ring gleams in the sand."],
  jungle:   ["A jade idol radiates faint magic!", "An enchanted orchid that never wilts — alchemists would kill for this."],
  swamp:    ["A black iron chest sealed with arcane wards!", "A staff of twisted bog-oak hums with power."],
  mountain: ["A dragon's forgotten hoard in a narrow crevice!", "Mithral ore — the rarest metal in the world."],
  plains:   ["A hero's tomb with a magical blade resting atop it!", "An ancient war standard that inspires courage."],
  coast:    ["A cursed captain's treasure — gold, gems, and a glowing cutlass!", "A pearl the size of a fist, faintly warm."],
  water:    ["A sunken shrine with an enchanted relic!", "A mermaid's gift — a ring that glows beneath the waves."],
};

// Quest discovery descriptions
const FIND_QUEST_DESC: Record<HexType, string[]> = {
  town:     ["A desperate note pinned to a board catches your eye.", "A wounded traveler begs for help before passing out."],
  forest:   ["Strange claw marks on the trees lead deeper into the wood.", "A woodcutter's abandoned camp — signs of a struggle."],
  desert:   ["A half-buried map points to something beyond the dunes.", "Caravaner tracks end abruptly — something happened here."],
  jungle:   ["Tribal totems mark a forbidden path.", "A journal page describes a hidden temple deeper in."],
  swamp:    ["Will-o'-wisps flicker in a pattern — almost like a trail.", "A hermit's journal describes a creature terrorizing the marsh."],
  mountain: ["Smoke rises from a cave that should be abandoned.", "Dwarven trail markers lead to a sealed door."],
  plains:   ["A farmer's plea for help, scratched into a fencepost.", "Wagon tracks veer off the road toward something."],
  coast:    ["A message in a bottle washes ashore.", "A lighthouse keeper's distress signal flickers in the dark."],
  water:    ["Strange lights glow beneath the surface.", "A fisherman's tale etched into a riverside stone."],
};

// Dungeon discovery descriptions
const FIND_DUNGEON_DESC: Record<HexType, string[]> = {
  town:     ["A hidden trapdoor beneath old flagstones leads into darkness.", "Sewer grates rumble — something vast moves below the city."],
  forest:   ["An ancient stone staircase descends into the earth between gnarled roots.", "A hollow tree trunk opens into a cavern system."],
  desert:   ["The sand collapses into a buried structure — stairs lead down.", "Wind exposes the entrance to a forgotten tomb."],
  jungle:   ["Vines part to reveal a carved stone doorway into a pyramid.", "A cenote drops into an underground temple complex."],
  swamp:    ["The bog drains into an underground passage.", "A ruined watchtower's basement connects to deeper tunnels."],
  mountain: ["A crack in the cliff face opens into a vast underground hall.", "A mine shaft descends far deeper than any mine should."],
  plains:   ["A sinkhole reveals worked stone passages below.", "A barrow mound's entrance yawns open after recent rains."],
  coast:    ["A sea cave at low tide reveals carved passages beyond.", "Cliff erosion exposes an entrance sealed for centuries."],
  water:    ["The river current pulls toward a submerged cave entrance.", "A whirlpool guards the entrance to something below."],
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function rollWorldLuck(
  hex: MapHex,
  interaction: HexInteraction,
  stats: Record<string, number>,  // { str, dex, con, int, wis, cha }
  skillRanks: Record<string, number>,
  distFromCity: number,
  fieldSkillId?: FieldSkillId,    // which skill the player chose (for "skill" interaction)
  partySize?: number,             // number of heroes in party (for thug encounters)
  fame?: number,                  // performer renown (for Perform skill)
  exhaustionPoints?: number,      // each point = -1 to all stats
  feats?: string[],               // feat IDs for skill bonuses (e.g. "skill-focus:diplomacy")
  playerName?: string,            // hero/NFT name for NPC dialogue
  factionName?: string,           // player's faction name for NPC dialogue
): WorldLuckResult {
  // ── Two rolls: world (hidden) + skill check (shown to player) ──
  const worldRoll = Math.floor(Math.random() * 20) + 1;
  const rawD20 = Math.floor(Math.random() * 20) + 1;
  const exh = exhaustionPoints ?? 0;
  const exhStat = (v: number) => Math.max(1, Math.floor(v) - exh);

  // Compute skill check: d20 + ability mod (exhaustion-reduced) + ranks + feat bonuses
  let skillRoll: number;
  let skillName: string | undefined;
  let skillMod = 0;
  if (interaction === "skill" && fieldSkillId) {
    const fs = FIELD_SKILLS[fieldSkillId];
    const abilScore = exhStat(stats[fs.ability] ?? 10);
    const ranks = skillRanks[fs.id] ?? 0;
    const focusBonus = feats ? getSkillFocusBonus(feats, fs.id) : 0;
    skillMod = calcAbilityMod(abilScore) + ranks + focusBonus;
    skillRoll = rawD20 + skillMod;
    skillName = fs.name;
  } else if (interaction === "rest") {
    // Rest uses WIS with a penalty
    skillMod = calcAbilityMod(exhStat(stats.wis ?? 10)) - 2;
    skillRoll = rawD20 + skillMod;
  } else {
    // Travel uses WIS
    skillMod = calcAbilityMod(exhStat(stats.wis ?? 10));
    skillRoll = rawD20 + skillMod;
  }

  const isFarm = hex.tags?.includes("farm");
  const isDungeon = hex.tags?.includes("dungeon");
  const isTown = hex.type === "town";

  // Zone-based level range for encounter/loot scaling
  const levelRange = getLevelRange(hex.q, hex.r, distFromCity);

  // ── Helpers used by multiple branches ──
  const sid = fieldSkillId ?? "search";
  const pn = playerName ?? "traveler";  // hero name for NPC dialogue
  const fn = factionName ?? "your company"; // faction name for NPC dialogue
  const r = (o: Omit<WorldLuckResult, "worldRoll" | "skillRoll" | "rawD20" | "skillMod" | "skillUsed" | "interaction">): WorldLuckResult =>
    ({ worldRoll, skillRoll, rawD20, skillMod, skillUsed: skillName, interaction, ...o });

  // ── World roll determines DANGER (hidden from player) ──
  // Towns are mostly safe — but thugs lurk in alleys
  const dangerCeiling = isTown ? 0 : isFarm ? 2 : isDungeon ? 5 : 3;
  const hazardCeiling = isTown ? 0 : isFarm ? 4 : 6;

  // Town thugs — worldRoll 1-2 in town = mugging attempt
  // Diplomacy or Intimidate (DC 12) talks them down; otherwise fight
  if (isTown && worldRoll <= 2) {
    const canTalk = ["diplomacy", "intimidate"].includes(sid);
    const dc = 12;
    if (canTalk && skillRoll >= dc) {
      return r({
        skillDC: dc, outcome: "avoided_danger",
        description: pick([
          sid === "diplomacy"
            ? `A gang of thugs blocks your path, but ${pn}'s calm words convince them ${fn} isn't worth the trouble.`
            : `${pn} locks eyes with the lead thug and growls. They back off, muttering curses.`,
          `Street toughs size up ${pn}, but think better of it when ${fn} stands their ground.`,
          `"Hand over your coin!" demands a rough voice — but ${pn}'s ${sid === "diplomacy" ? "silver tongue" : "menacing glare"} sends them slinking away.`,
        ]),
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 10,
      });
    }
    // Thug fight — enemies generated in useEffect from this outcome
    const ps = Math.max(1, partySize ?? 1);
    const thugCount = ps + d(6);
    return r({
      skillDC: dc, outcome: "thug_fight",
      enemyCount: thugCount,
      description: pick([
        `${thugCount} street thugs step out from a dark alley. "Your money or your life, ${pn}!"`,
        `A gang of ${thugCount} armed ruffians corners ${fn} near the docks. "Empty your pockets."`,
        `${thugCount} thugs with clubs and knives block the street. "Nice gear, ${pn}. Hand it over."`,
      ]),
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
    });
  }

  // Danger zone (world 1-dangerCeiling)
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
    // World roll drives encounter difficulty:
    // 1 = deadly (CR+1, class levels), 2 = hard, 3-4 = easy (treasure with extra steps)
    let difficulty: "easy" | "medium" | "hard" | "deadly";
    if (worldRoll === 1) {
      difficulty = "deadly";
    } else if (worldRoll === 2) {
      difficulty = "hard";
    } else {
      // worldRoll 3+ in danger range = easy pickings
      difficulty = "easy";
    }
    // Terrain and distance can bump medium→hard but never override deadly
    if (difficulty !== "deadly" && difficulty !== "easy") {
      if (["swamp", "mountain", "jungle"].includes(hex.type)) {
        difficulty = "hard";
      }
    }
    const encounter = generateFightEncounter(hex.type, levelRange, difficulty);
    return {
      worldRoll, skillRoll, skillDC: dc, interaction, outcome: "fight", difficulty,
      description: encounter.description,
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
      encounter,
    };
  }

  // Hazard zone (world dangerCeiling+1 to hazardCeiling)
  if (worldRoll <= hazardCeiling) {
    const dc = 10;
    if (skillRoll >= dc) {
      return {
        worldRoll, skillRoll, skillDC: dc, interaction, outcome: "avoided_danger",
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

  // ── Skill total determines FINDS — what you find depends on WHICH skill you used ──
  // Town rats quest — easy find via any social or search skill
  if (isTown && interaction === "skill" && skillRoll >= 10 &&
      ["search", "diplomacy", "gatherInformation"].includes(sid)) {
    return r({
      skillDC: 10, outcome: "find_quest",
      description: pick([
        "A tavern keeper waves you over. \"Giant rats in my cellar! I'll pay you to clear them out.\"",
        "A notice board reads: REWARD — Rat infestation in the cellars. Inquire within.",
        "An old woman tugs your sleeve. \"Please, the rats down below are the size of dogs!\"",
        "A warehouse foreman shouts for help. \"The cellar's overrun! Rats everywhere!\"",
      ]),
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 5,
    });
  }

  // ── Skill-specific find tables ──
  // Social skills (diplomacy, gatherInformation, intimidate, perform) — info, quests, rumors
  const isSocial = ["diplomacy", "gatherInformation", "intimidate"].includes(sid); // perform has its own handler above
  // Wilderness skills (survival, handleAnimal, heal) — food, herbs, animals
  const isWild = ["survival", "handleAnimal", "heal"].includes(sid);
  // Awareness skills (spot, listen) — detect danger, find hidden things
  const isAware = ["spot", "listen"].includes(sid);
  // Physical skills (climb, swim) — reach inaccessible places
  const isPhysical = ["climb", "swim"].includes(sid);
  // Thievery (openLock, disableDevice) — bypass locks, traps → loot
  const isThief = ["openLock", "disableDevice"].includes(sid);
  // Knowledge — recall lore, identify findings
  const isKnow = sid === "knowledge";
  // Craft — make items from materials
  const isCraft = sid === "craft";

  // Quest/dungeon discovery: high world roll + high skill
  if (worldRoll >= 19 && skillRoll >= 35 && !isTown && Math.random() < 0.3) {
    const desc = isAware ? "Your keen senses detect a hidden passage — a dungeon entrance!"
      : isWild ? "Animal tracks lead to a cave entrance concealed by brush."
      : isKnow ? "You recall ancient texts describing a ruin in this exact location."
      : isPhysical ? "Scaling a difficult face, you find a hidden entrance in the cliff."
      : pick(FIND_DUNGEON_DESC[hex.type] ?? FIND_DUNGEON_DESC.plains);
    return r({ skillDC: 35, outcome: "find_dungeon", description: desc, hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 15 });
  }
  if (worldRoll >= 18 && skillRoll >= 30 && Math.random() < 0.25) {
    const desc = isSocial ? pick(isTown ? [
      "A drunk noble whispers about a hidden vault beneath the city.",
      "A retiring adventurer offers the location of their greatest find.",
      "A merchant leans close. \"I know someone who can get you into places most can't.\"",
    ] : [
      "A farmer tells you about strange lights in the fields at night.",
      "An old shepherd recalls a cave entrance that collapsed years ago.",
    ]) : isKnow ? "Your studies remind you of a quest mentioned in historical records."
      : pick(FIND_QUEST_DESC[hex.type] ?? FIND_QUEST_DESC.plains);
    return r({ skillDC: 30, outcome: "find_quest", description: desc, hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 10 });
  }

  // ── PERFORM ─────────────────────────────────────────────────────────────────
  // Uses COMBINED = worldRoll + skillRoll (2-die system, range ~2-50).
  // Cities: money + fame (Kardov's Gate pays best). Good shows → faction favor.
  // Farms: little coin, food tips, faction favor (farmers).
  // Wilderness: just practicing unless combined >= 35 (stranger helps).
  // Combined < 5 in the wild → a monster hears you!
  if (sid === "perform") {
    const fameBonus = Math.floor((fame ?? 0) / 25); // +1 per 25 fame
    const currentFame = fame ?? 0;
    const isKardov = hex.name?.includes("Kardov");
    const combined = worldRoll + skillRoll + fameBonus; // both dice + fame

    // Fame tier labels for flavor
    const fameTitle = currentFame >= 75 ? "legendary" : currentFame >= 50 ? "famous"
      : currentFame >= 25 ? "well-known" : currentFame >= 10 ? "local" : "unknown";

    // ── WILDERNESS — just practice unless exceptional or disastrous ──
    if (!isTown && !isFarm) {
      // Combined < 5 → a monster hears your music!
      if (combined < 5) {
        const diff = distFromCity <= 6 ? "easy" as const : distFromCity <= 15 ? "medium" as const : "hard" as const;
        return r({ skillDC: 0, outcome: "fight", difficulty: diff,
          description: pick([
            "Your music echoes through the wilds. Something heard you — something hungry.",
            "A predator stalks toward the sound of your playing. Too late to run.",
            "Your song attracts unwanted attention. Hostile creatures burst from the undergrowth!",
            "The melody carries far on the wind. Glowing eyes appear in the shadows.",
          ]),
          hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0 });
      }

      // Combined >= 35 → a traveling stranger is moved by your music
      if (combined >= 35) {
        const strangerCoins: Coins = { gp: d(3), sp: nd(1, 6), cp: nd(2, 8) };
        return r({ skillDC: 35, outcome: "find_coins",
          description: pick([
            "A hooded stranger stops on the road, entranced. When you finish, they leave a pouch of coin and a nod of respect before vanishing.",
            "A traveling merchant pauses his caravan to listen. \"You have real talent. Take this — you've earned it.\" He leaves gold.",
            "An old bard, weathered by the road, listens silently. \"Not bad, not bad at all.\" They share wine, stories, and a handful of coin.",
            "A wealthy pilgrim weeps at your ballad. \"That song... my mother used to sing it.\" They press gold into your hands.",
          ]),
          hpChange: 0, goldChange: 0, coinReward: strangerCoins, foodChange: Math.random() < 0.5 ? 1 : 0,
          xpChange: 8, fameChange: 1 });
      }

      // Otherwise: just practicing — gain XP from the effort, nothing else
      const practiceXp = combined >= 25 ? 3 : combined >= 15 ? 2 : combined >= 8 ? 1 : 0;
      return r({ skillDC: 0, outcome: "nothing",
        description: pick([
          "You practice your craft under the open sky. No audience, but the repetition sharpens your skill.",
          "Your music mingles with birdsong. Good practice, even if nobody's listening.",
          "You play to the trees and the wind. The solitude lets you try new techniques.",
          "An afternoon of practice. No coins, but you feel sharper for it.",
        ]),
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: practiceXp, fameChange: 0 });
    }

    // ── FARM — food, small coin, farmer faction points ──
    // Combined DCs: 30+ great, 22+ good, 14+ okay, below 14 = meh
    if (isFarm) {
      if (combined >= 30) {
        return r({ skillDC: 30, outcome: "find_coins",
          description: pick([
            "The entire village gathers. Farmers pull out coins they've been saving. Children dance. You're invited to stay for the feast.",
            "Old farmers weep at your ballad. They pass a hat of their own — every family contributes.",
            "The village elder insists you stay. \"Play at the harvest festival!\" Food and goodwill in abundance.",
          ]),
          hpChange: 0, goldChange: 0,
          coinReward: { gp: 0, sp: nd(1, 4), cp: nd(2, 8) },
          foodChange: nd(1, 3) + 1, xpChange: 7, fameChange: 1,
          factionRepChange: { factionId: "farmers", amount: 3 } });
      }
      if (combined >= 22) {
        return r({ skillDC: 22, outcome: "find_coins",
          description: pick([
            "The farmhands enjoy your tune. A few toss copper and someone brings bread and cheese.",
            "Your music carries across the fields. Workers set down their tools to listen. They share their lunch.",
          ]),
          hpChange: 0, goldChange: 0,
          coinReward: { gp: 0, sp: d(3), cp: nd(1, 8) },
          foodChange: 1, xpChange: 5, fameChange: 0,
          factionRepChange: { factionId: "farmers", amount: 2 } });
      }
      if (combined >= 14) {
        const drops = rollFarmDrop();
        return r({ skillDC: 14, outcome: "find_food",
          description: pick([
            "A couple of farmhands tap their feet. One shares a piece of bread.",
            "The farm dogs come to listen. A kindly farmer gives you an apple and some cheese.",
          ]) + " They give you: " + drops.map(f => f.name).join(", ") + ".",
          hpChange: 0, goldChange: 0,
          coinReward: { gp: 0, sp: 0, cp: nd(1, 6) },
          foodChange: 1, xpChange: 3, fameChange: 0, foodDrop: drops,
          factionRepChange: { factionId: "farmers", amount: 1 } });
      }
      // Below 14 on farms — polite indifference
      return r({ skillDC: 14, outcome: "nothing",
        description: pick([
          "The farmhands glance over, shrug, and go back to work.",
          "A farmer's dog howls along. The farmer shoos you both away, but not unkindly.",
        ]),
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 1, fameChange: 0 });
    }

    // ── TOWN — best money & fame. Kardov's Gate pays double. ──
    // Combined DCs: 38+ extraordinary, 32+ memorable, 27+ great, 23+ enjoyable, 20+ copper
    // Below 20 = failed, no coin.
    const goldMult = isKardov ? 2 : 1;

    // ── Extraordinary (38+) ──
    if (combined >= 38) {
      const coins: Coins = {
        gp: nd(3, 6) * goldMult,
        sp: nd(2, 10) * goldMult,
        cp: nd(3, 10),
      };
      const fameGain = isKardov ? 4 : 3;
      return r({ skillDC: 38, outcome: "find_coins",
        description: pick(isKardov ? [
          "A standing ovation in Kardov's Gate! The crowd roars. A merchant's wife sends a servant with gold.",
          "The tavern erupts in applause. A noble drops gold in your hat. \"Play at my estate — name your price.\"",
          "The crowd is entranced. Hardened dockworkers weep openly. Your hat overflows with coin.",
          fameTitle === "legendary" ? "\"It's THEM!\" The crowd presses in. Guards keep order as gold pours in." : "Word spreads — people run from nearby streets to hear you play.",
        ] : [
          "A standing ovation! The crowd roars and coins rain into your hat.",
          "Your performance leaves the room speechless, then erupting in applause. Gold and silver fill your hat.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: coins, foodChange: 1,
        xpChange: 10, fameChange: fameGain });
    }

    // ── Memorable (32+) ──
    if (combined >= 32) {
      const coins: Coins = {
        gp: nd(1, 6) * goldMult,
        sp: nd(2, 8) * goldMult,
        cp: nd(3, 10),
      };
      const fameGain = isKardov ? 3 : 2;
      return r({ skillDC: 32, outcome: "find_coins",
        description: pick(isKardov ? [
          "The crowd cheers and claps along. Silver and gold clink into your hat. \"Come back tomorrow!\"",
          "A memorable show! People buy you drinks and press coins into your hands.",
          "The tavern keeper waives your tab. \"Play like that every night and you eat free.\"",
          fameTitle === "unknown" ? "People start asking your name. \"Who IS that?\"" : `\"I've heard of you!\" shouts someone in the crowd.`,
        ] : [
          "The crowd cheers and claps along. Your hat fills with silver and gold.",
          "A memorable performance. The innkeeper waives your tab and tips generously.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: coins, foodChange: 0,
        xpChange: 7, fameChange: fameGain });
    }

    // ── Great (27+) ──
    if (combined >= 27) {
      const coins: Coins = {
        gp: 0,
        sp: nd(3, 10) * goldMult,
        cp: nd(2, 10),
      };
      const fameGain = isKardov ? 2 : 1;
      return r({ skillDC: 27, outcome: "find_coins",
        description: pick(isKardov ? [
          "A solid performance draws a decent crowd in Kardov's Gate. Silver clinks into your hat.",
          "The crowd nods along approvingly. Several toss coins your way.",
        ] : [
          "A solid performance. The crowd tips respectably.",
          "People stop to listen. Not your best, but the tips are decent.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: coins, foodChange: 0,
        xpChange: 5, fameChange: fameGain });
    }

    // ── Enjoyable (23+) ──
    if (combined >= 23) {
      const coins: Coins = {
        gp: 0,
        sp: nd(1, 10) * goldMult,
        cp: nd(2, 8),
      };
      return r({ skillDC: 23, outcome: "find_coins",
        description: pick(isKardov ? [
          "A few people pause to listen in the busy streets. Some copper and silver land in your hat.",
          "Your performance is pleasant enough. Passersby toss a few coins.",
        ] : [
          "A handful of listeners toss some copper and silver.",
          "Your playing is decent. A few coins for the effort.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: coins, foodChange: 0,
        xpChange: 3, fameChange: 0 });
    }

    // ── Copper (20+) — bare minimum to earn anything ──
    if (combined >= 20) {
      const coins: Coins = { gp: 0, sp: 0, cp: nd(1, 10) * goldMult };
      return r({ skillDC: 20, outcome: "find_coins",
        description: pick([
          "A few people toss copper out of pity more than appreciation.",
          "Your playing is adequate. A child drops a copper in your hat.",
          "Not your best work. A couple of coppers for the effort.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: coins, foodChange: 0,
        xpChange: 1, fameChange: 0 });
    }

    // ── Failed (below 20) — no coin in town ──
    return r({ skillDC: 20, outcome: "nothing",
      description: pick([
        "Your performance falls flat. People hurry past, avoiding eye contact.",
        "A drunk heckles you mercilessly. You pack up with an empty hat.",
        "You fumble a chord and the small crowd disperses. Someone throws a rotten tomato.",
        "The crowd watches for a moment, then drifts away. Not even pity copper today.",
      ]),
      hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0, fameChange: 0 });
  }

  // ── 40+: Very valuable / magic item tier ──
  if (skillRoll >= 40) {
    const cr = Math.max(1, Math.floor((levelRange[0] + levelRange[1]) / 2));
    if (isWild) {
      const t = rollTreasure(cr);
      return r({ skillDC: 40, outcome: "find_rare",
        description: "You discover an extraordinarily rare herb with magical properties — alchemists would pay a fortune.",
        hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
        foodChange: Math.floor(Math.random() * 3) + 2, xpChange: 15, treasureDesc: t.description });
    }
    if (isSocial) {
      return r({ skillDC: 40, outcome: "find_quest",
        description: pick(isTown ? [
          "A noble confides a dangerous secret. \"Do me a favor, and I'll open doors for you.\"",
          "An information broker reveals a dungeon location — for the right price, which you negotiate to free.",
        ] : ["A farmer reveals a hidden cellar beneath the old mill — untouched for decades."]),
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 15 });
    }
    if (isThief) {
      const lootDrop = generateLootDrop(hex.type, levelRange, "major_find");
      const t = rollTreasure(cr);
      return r({ skillDC: 40, outcome: "find_rare",
        description: "You crack open a masterfully hidden cache — " + lootDrop.items.map(i => i.name).join(", ") + "!",
        hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
        foodChange: 0, xpChange: 15, loot: lootDrop, treasureDesc: t.description });
    }
    const lootDrop = generateLootDrop(hex.type, levelRange, "major_find");
    const t = rollTreasure(cr);
    return r({ skillDC: 40, outcome: "find_rare",
      description: pick(FIND_RARE_DESC[hex.type] ?? FIND_RARE_DESC.plains),
      hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
      foodChange: 0, xpChange: 15, loot: lootDrop, treasureDesc: t.description });
  }

  // ── 35-39: Valuable finds ──
  if (skillRoll >= 35) {
    const cr = Math.max(1, Math.floor((levelRange[0] + levelRange[1]) / 2));
    if (isWild) {
      // Survival in wilderness: large game hunt (fresh, spoils in 2 days, lots of food)
      if (sid === "survival" && !isTown && !isFarm) {
        const hunted = rollHuntedFood(hex.type, "large_game");
        const isAquatic = ["coast", "swamp"].includes(hex.type);
        const t = rollFieldTreasure(cr);
        return r({ skillDC: 35, outcome: "find_valuable",
          description: pick(isAquatic
            ? ["You land a massive catch — enough to feed everyone.", "A huge fish breaks the surface and you bring it in."]
            : ["You track a large animal to its den and make a clean kill — meat for days.", "A successful stalk ends with a big kill. Fresh meat for the whole party."]
          ) + ` Caught: ${hunted.name}.`,
          hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
          foodChange: hunted.foodValue, xpChange: 10, huntedFood: [hunted], treasureDesc: t.description });
      }
      const food = Math.floor(Math.random() * 4) + 3;
      const t = rollFieldTreasure(cr);
      return r({ skillDC: 35, outcome: "find_valuable",
        description: pick(["You track a deer to its den and make a clean kill — meat for days.", "A grove of rare medicinal herbs, carefully harvested.", "You find a bee colony — fresh honey and beeswax, valuable trade goods."]),
        hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
        foodChange: food, xpChange: 10, treasureDesc: t.description });
    }
    if (isSocial) {
      return r({ skillDC: 35, outcome: "find_valuable",
        description: pick(isTown ? [
          "A guard mentions a merchant caravan was robbed nearby. \"Their goods are probably still out there.\"",
          "A bard sings of a forgotten tomb in the hills. You get enough details to find it.",
          "A retired soldier tells you about a weapons cache from the old war — never recovered.",
        ] : [
          "A farmer says there's an abandoned homestead to the north. \"They left everything behind.\"",
          "A woodcutter tells you about a grove where rare herbs grow wild.",
        ]),
        hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 10 });
    }
    if (sid === "heal") {
      const t = rollFieldTreasure(cr);
      return r({ skillDC: 35, outcome: "find_valuable",
        description: "You identify rare healing herbs — enough to brew several potent remedies.",
        hpChange: Math.floor(Math.random() * 4) + 3, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
        foodChange: 0, xpChange: 10, treasureDesc: t.description });
    }
    const lootDrop = generateLootDrop(hex.type, levelRange, "major_find");
    const t = rollFieldTreasure(cr);
    return r({ skillDC: 35, outcome: "find_valuable",
      description: pick(FIND_VALUABLE_DESC[hex.type] ?? FIND_VALUABLE_DESC.plains) + " " + lootDrop.items.map(i => i.name).join(", ") + "!",
      hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
      foodChange: 0, xpChange: 10, loot: lootDrop, treasureDesc: t.description });
  }

  // ── 30-34: Coins / solid finds ──
  if (skillRoll >= 30) {
    if (isWild) {
      // Survival in wilderness: small game hunt (fresh, spoils in 2 days)
      if (sid === "survival" && !isTown && !isFarm) {
        const hunted = rollHuntedFood(hex.type, "small_game");
        const isAquatic = ["coast", "swamp"].includes(hex.type);
        return r({ skillDC: 30, outcome: "find_food",
          description: pick(isAquatic
            ? ["You set a line and land a good catch.", "You spot fish in the shallows and spear them.", "You wade in and pull out a fine catch."]
            : ["You track small game and bring it down.", "You set a snare and catch something.", "Fresh tracks lead you to a successful hunt."]
          ) + ` Caught: ${hunted.name}.`,
          hpChange: 0, goldChange: 0, foodChange: hunted.foodValue, xpChange: 5, huntedFood: [hunted] });
      }
      const food = isFarm ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 2;
      const drops = isFarm ? rollFarmDrop() : rollWildernessFoodDrop();
      return r({ skillDC: 30, outcome: "find_food",
        description: pick(["You track game and make a successful hunt.", "A patch of wild vegetables and tubers — a solid haul.", "You find a clean spring and edible plants growing nearby."]) + " Found: " + drops.map(f => f.name).join(", ") + ".",
        hpChange: 0, goldChange: 0, foodChange: food, xpChange: 5, foodDrop: drops });
    }
    if (isSocial) {
      // Tips come as mixed small coins — mostly copper and silver from common folk
      const tipCoins: Coins = isTown
        ? { gp: 0, sp: nd(1, 6), cp: nd(2, 10) }
        : { gp: 0, sp: Math.random() < 0.5 ? d(3) : 0, cp: nd(2, 8) };
      const food = (isTown || isFarm) ? (Math.random() < 0.4 ? 1 : 0) : 0;
      return r({ skillDC: 30, outcome: "find_coins",
        description: pick(isTown ? [
          "A chatty merchant reveals which roads are safest and tips you for your company.",
          "A guard lets slip where the best foraging spots are outside the walls.",
          "A grateful innkeeper gives you food and a few coins for hearing out her troubles.",
        ] : [
          "A farmer gives you produce as thanks for the company.",
          "A shepherd points out where wild game gathers. You also earn a small tip.",
        ]),
        hpChange: 0, goldChange: 0, coinReward: tipCoins, foodChange: food, xpChange: 5 });
    }
    if (sid === "heal") {
      return r({ skillDC: 30, outcome: "find_food",
        description: "You gather useful healing herbs and treat minor wounds.",
        hpChange: Math.floor(Math.random() * 3) + 1, goldChange: 0, foodChange: 1, xpChange: 5 });
    }
    // (Perform is handled by its own dedicated block above)
    // General coin find — scales with distance (wilder areas = older, richer caches)
    const cr = Math.max(1, Math.floor((levelRange[0] + levelRange[1]) / 2));
    const t = rollFieldTreasure(cr);
    return r({ skillDC: 30, outcome: "find_coins",
      description: pick(FIND_COINS_DESC[hex.type] ?? FIND_COINS_DESC.plains),
      hpChange: 0, goldChange: t.totalCp - (t.coins.gp * 100 + t.coins.sp * 10 + t.coins.cp), coinReward: t.coins,
      foodChange: 0, xpChange: 5, treasureDesc: t.description });
  }

  // ── 25-29: Food / crafting materials ──
  if (skillRoll >= 25) {
    if (isWild) {
      // Survival in wilderness: forage berries/tubers (fresh, spoils in 1 day)
      if (sid === "survival" && !isTown && !isFarm) {
        const hunted = rollHuntedFood(hex.type, "forage");
        return r({ skillDC: 25, outcome: "find_food",
          description: pick(["You forage edible roots and berries.", "You identify safe mushrooms and wild herbs.", "You find edible plants growing nearby.", "You dig up tubers from the forest floor."]) + ` Found: ${hunted.name}.`,
          hpChange: 0, goldChange: 0, foodChange: hunted.foodValue, xpChange: 2, huntedFood: [hunted] });
      }
      const food = isFarm ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 1;
      const drops = isFarm ? rollFarmDrop() : rollWildernessFoodDrop();
      return r({ skillDC: 25, outcome: "find_food",
        description: pick(["You forage edible roots and berries.", "Animal tracks lead to a small catch.", "You identify safe mushrooms and wild herbs.", "A clean water source and edible plants nearby."]) + " Found: " + drops.map(f => f.name).join(", ") + ".",
        hpChange: 0, goldChange: 0, foodChange: food, xpChange: 2, foodDrop: drops });
    }
    if (isSocial && (isTown || isFarm)) {
      const food = isFarm ? 1 : (Math.random() < 0.4 ? 1 : 0);
      const drops = isFarm ? rollFarmDrop() : undefined;
      return r({ skillDC: 25, outcome: "find_food",
        description: pick(isTown ? [
          "You chat with locals. Nothing earth-shattering, but someone shares a meal.",
          "An old woman feeds you soup and tells you about her grandchildren.",
          "A fellow traveler swaps road stories over shared bread.",
        ] : [
          "A farmer shares bread and cheese while complaining about the weather.",
          "A local child shows you their favorite fishing spot.",
        ]) + (drops ? " They give you: " + drops.map(f => f.name).join(", ") + "." : ""),
        hpChange: 0, goldChange: 0, foodChange: food, xpChange: 2, foodDrop: drops });
    }
    if (sid === "heal") {
      return r({ skillDC: 25, outcome: "find_food",
        description: "You find common medicinal herbs — useful for treating minor ailments.",
        hpChange: 1, goldChange: 0, foodChange: 0, xpChange: 2 });
    }
    if (isCraft) {
      return r({ skillDC: 25, outcome: "find_food",
        description: "You gather useful raw materials — wood, fibres, and stone for crafting.",
        hpChange: 0, goldChange: 50, foodChange: 0, xpChange: 2 });
    }
    const food = isFarm ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 1;
    const gold = Math.random() < 0.3 ? (Math.floor(Math.random() * 2) + 1) * 100 : 0;
    const drops = isFarm ? rollFarmDrop() : rollWildernessFoodDrop();
    return r({ skillDC: 25, outcome: "find_food",
      description: pick(FIND_FOOD_DESC[hex.type] ?? FIND_FOOD_DESC.plains) + " Found: " + drops.map(f => f.name).join(", ") + ".",
      hpChange: 0, goldChange: gold, foodChange: food, xpChange: 2, foodDrop: drops });
  }

  // ── Below 25: nothing found — skill-flavored failure ──
  const failDesc = isSocial ? pick(isTown ? [
    "People eye you suspiciously and keep their distance.",
    "A merchant shoos you away. \"Buy something or move along.\"",
    "The locals clam up when you approach.",
  ] : ["The farmers are too busy to chat.", "The locals are polite but unhelpful."])
    : isWild ? pick(["You search for tracks but find nothing.", "The land yields nothing useful today.", "No edible plants or game in sight."])
    : isAware ? "You scan the area carefully but notice nothing unusual."
    : isPhysical ? "You look for a way up but find no viable route."
    : isThief ? "Nothing here to pick or disarm."
    : pick(["Nothing eventful happens.", "The area is quiet.", "Your efforts turn up nothing of interest.", "Time passes uneventfully."]);
  return r({ skillDC: 0, outcome: "nothing", description: failDesc, hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0 });
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
    // World roll drives difficulty: 1 = deadly, 2 = hard, 3-4 = easy
    let difficulty: "easy" | "medium" | "hard" | "deadly";
    if (isFarm) {
      difficulty = "easy"; // farmland fights are always easy — bandits, wolves, crop pests
    } else if (roll === 1) {
      difficulty = "deadly";
    } else {
      difficulty = "easy";
    }
    // Dangerous terrain can bump non-deadly, non-easy fights
    if (difficulty !== "deadly" && difficulty !== "easy") {
      if (["swamp", "mountain", "jungle"].includes(hex.type)) {
        difficulty = "hard";
      }
    }
    const desc = isFarm
      ? `Bandits ambush you on the farm road! (${difficulty})`
      : difficulty === "deadly"
        ? `Something terrible stirs nearby... (deadly)`
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
      const drops = rollFarmDrop();
      const farmFind = [
        "A farmer offers you fresh food for the road.",
        "You find ripe crops growing wild along the roadside.",
        "A grateful farmer rewards you for scaring off pests.",
        "You stumble upon a hidden root cellar with supplies.",
      ];
      const desc = farmFind[Math.floor(Math.random() * farmFind.length)];
      const totalFood = drops.reduce((sum, f) => sum + f.foodValue, 0);
      return { roll, type: "find", description: desc + " Found: " + drops.map(f => f.name).join(", ") + ".", foodDrop: drops, foodChange: Math.max(1, totalFood) };
    }
    // Low-level wilderness finds include foraged food
    if (distFromCity <= 8) {
      const drops = rollWildernessFoodDrop();
      const desc = FIND_SOMETHING[Math.floor(Math.random() * FIND_SOMETHING.length)];
      const totalFood = drops.reduce((sum, f) => sum + f.foodValue, 0);
      return { roll, type: "find", description: desc + " Also found: " + drops.map(f => f.name).join(", ") + ".", foodDrop: drops, foodChange: Math.max(1, totalFood) };
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
  "34,32": { type: "town", description: "A quiet city district with modest homes and small workshops." },
  "33,31": { type: "town", description: "Narrow streets wind between old stone buildings." },
  "33,32": { type: "town", description: "A residential quarter with clotheslines and small gardens." },
  "32,32": { type: "town", description: "A worn district on the city outskirts. Stray dogs roam the alleys." },
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
  "32,31": { type: "mountain", name: "Goblin Hills", description: "Rocky hills overlooking Kardov's Gate. Goblin raids are a constant threat.", tags: ["dungeon"] },
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
    const foodCost = Math.min(save.food, 1);  // 1 food per 8hr rest
    const hasFoodForDay = save.food >= 1;
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
    const gold = (isDungeon ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 10) + 3) * 100;
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
  characters?: NftCharacter[];       // all NFT characters (for party images)
  onTravel: (hex: { q: number; r: number }, result: ReturnType<typeof travel>, destHex: MapHex, encounter: WorldLuckResult) => void;
  onAction: (result: WorldLuckResult) => void;
  onBuyItem: (item: ShopItem) => void;
  onBattle: (difficulty: "easy" | "medium" | "hard" | "deadly") => void;
  onQuestBattle: (encounter: QuestEncounter) => void;
  onExhaustionCollapse: (isSafe: boolean) => void;  // collapse from exhaustion; isSafe = town/farm (infirmary)
  onInventory: () => void;
  onEquip?: (itemId: string, slot: keyof Equipment) => void;
  onUnequip?: (slot: keyof Equipment) => void;
  onSwitchParty?: (newIndex: number) => void;  // switch active party
  onCreateParty?: (nftAddress: string) => void; // create new party led by this NFT
  onExchange?: (parties: Props["save"]["parties"], coins: { gp: number; sp: number; cp: number }, food: number) => void;
  onSetAutoAction?: (partyIndex: number, action: { type: "rest" | "skill"; skill?: string } | null) => void;
  onBack: () => void;
  onPowerUp?: () => void;
};

// ── Travel speed by terrain ─────────────────────────────────────────────
// Multiplier on base 8 hrs/hex. Higher = slower.
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
const MAX_ZOOM = 3.5;

/** Determine which equipment slot an item can go in, or null if not equippable */
function getEquipSlot(itemId: string, info: { category: string; name: string } | undefined): keyof Equipment | null {
  if (!info) return null;
  const id = itemId.toLowerCase();
  const name = info.name.toLowerCase();
  // Shields → shield slot
  if (name.includes("shield") || id.includes("shield") || id.includes("buckler") || name.includes("buckler")) return "shield";
  // Weapons
  if (info.category === "weapon") return "weapon";
  // Armor (non-shield armor items)
  if (info.category === "armor") return "armor";
  // Accessories: amulets, rings, cloaks, bracers
  if (name.includes("amulet") || name.includes("ring") || name.includes("cloak") || name.includes("bracer") || name.includes("necklace") || name.includes("pendant")) return "accessory";
  return null;
}

export function WorldMap({ save, character, characters, onTravel, onAction, onBuyItem, onBattle, onQuestBattle, onExhaustionCollapse, onInventory, onEquip, onUnequip, onSwitchParty, onCreateParty, onExchange, onSetAutoAction, onBack, onPowerUp }: Props) {
  const [selectedHex, setSelectedHex] = useState<MapHex | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mappingMode, setMappingMode] = useState(false);
  const [markedHexes, setMarkedHexes] = useState<Set<string>>(new Set());
  const [lastAction, setLastAction] = useState<WorldLuckResult | null>(null);
  const [pendingQuest, setPendingQuest] = useState<QuestEncounter | null>(null);
  const [escapeResult, setEscapeResult] = useState<{ roll: number; dc: number; success: boolean } | null>(null);
  const [cityDistrict, setCityDistrict] = useState<string | null>(null); // "market" | "temple" | "high" | "low"
  const [cityShop, setCityShop] = useState<string | null>(null);         // shop or temple id
  const [leftPanel, setLeftPanel] = useState<"sheet" | "inventory" | "party">("sheet");
  const [selectedFollowerId, setSelectedFollowerId] = useState<string | null>(null);
  const [gameLog, setGameLog] = useState<WorldLuckResult[]>([]);
  const [showNewPartyPicker, setShowNewPartyPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Block all actions when a fight is pending — must fight or escape first
  const fightBlocking = !!(pendingQuest && lastAction && (lastAction.outcome === "fight" || lastAction.outcome === "thug_fight"));

  /** Minimum zoom so the map always fills the container (no empty edges) */
  const getMinZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    return Math.max(rect.width / VB, rect.height / VB, 1);
  }, []);

  // Multi-party: active party position (falls back to save.map_hex for saves without parties)
  const activeParty = save.parties?.[save.active_party_index ?? 0];
  const activeMapHex = activeParty?.map_hex ?? save.map_hex;
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const didCenter = useRef(false);

  // Append to game log when a new action happens
  useEffect(() => {
    if (lastAction) {
      setGameLog(prev => [lastAction, ...prev].slice(0, 50));
      setEscapeResult(null);
    }
  }, [lastAction]);

  // Generate quest/encounter data when lastAction changes (stable, doesn't re-roll on re-render)
  useEffect(() => {
    if (!lastAction) { setPendingQuest(null); return; }

    // Rats in the cellar
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("rat")) {
      const direRat = MONSTERS.find(m => m.id === "dire_rat");
      if (!direRat) return;
      const heroCount = Math.max(1, save.party.heroes.length);
      let ratCount = 0;
      for (let i = 0; i < heroCount * save.level; i++) ratCount += Math.floor(Math.random() * 6) + 1;
      const ratNft = characters?.find(c => c.name === "Rats");
      const rats: EnemySpec[] = Array.from({ length: ratCount }, () => ({
        ...createMonsterSpec(direRat, "\uD83D\uDC00"), // 🐀
        imageUrl: ratNft?.imageUrl || "/enemy-rat.jpg",
      }));
      setPendingQuest({
        questId: "rats_in_cellar",
        questName: "Rats in the Cellar",
        enemies: rats,
        mapImage: "/cellar_1.png",
        difficulty: "easy",
      });
      return;
    }

    // ── Tavern quest: Giant spiders in the warehouse ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("spider")) {
      const spider = MONSTERS.find(m => m.id === "small_spider") ?? MONSTERS.find(m => m.id === "tiny_monstrous_spider");
      if (spider) {
        const count = Math.floor(Math.random() * 3) + 2 + save.level;
        const enemies: EnemySpec[] = Array.from({ length: count }, () => createMonsterSpec(spider, "\uD83D\uDD77\uFE0F"));
        setPendingQuest({ questId: "tavern_pests", questName: "Warehouse Pests", enemies, difficulty: "easy" });
        return;
      }
    }

    // ── Tavern quest: Run off street thugs ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("thugs have been shaking")) {
      const thugCount = Math.floor(Math.random() * 3) + 2 + Math.floor(save.level / 2);
      const thugNames = ["Scarface", "Knuckles", "Ratbone", "Grinner", "Nail", "Crooked Tom", "Shiv", "Guttersnipe"];
      const usedN = new Set<string>();
      const thugs: EnemySpec[] = Array.from({ length: thugCount }, () => {
        let name: string;
        do { name = thugNames[Math.floor(Math.random() * thugNames.length)]; } while (usedN.has(name) && usedN.size < thugNames.length);
        usedN.add(name);
        return { name, imageEmoji: "\uD83D\uDC4A", stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5, ac: 13, atk: 1, speed: 30, lightningDmg: 0, fireDmg: 0 }, subtypes: [], hpOverride: 8 + Math.floor(Math.random() * 4) + 1 };
      });
      setPendingQuest({ questId: "tavern_thugs", questName: "Street Shakedown", enemies: thugs, difficulty: "medium" });
      return;
    }

    // ── Tavern quest: Skeletons in the old crypt ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("crypt")) {
      const skeleton = MONSTERS.find(m => m.id === "skeleton");
      if (skeleton) {
        const count = Math.floor(Math.random() * 3) + 3 + save.level;
        const enemies: EnemySpec[] = Array.from({ length: count }, () => createMonsterSpec(skeleton, "\uD83D\uDC80"));
        setPendingQuest({ questId: "tavern_undead", questName: "Crypt Clearing", enemies, mapImage: "/cellar_1.png", difficulty: "medium" });
        return;
      }
    }

    // ── Tavern quest: Wolf pack den ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("wolves")) {
      const wolf = MONSTERS.find(m => m.id === "wolf");
      if (wolf) {
        const count = Math.floor(Math.random() * 3) + 2 + Math.floor(save.level / 2);
        const enemies: EnemySpec[] = Array.from({ length: count }, () => createMonsterSpec(wolf, "\uD83D\uDC3A"));
        setPendingQuest({ questId: "tavern_wolves", questName: "Wolf Pack Den", enemies, difficulty: "medium" });
        return;
      }
    }

    // ── Rumor quest: Smuggler's cave ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("smuggler")) {
      const thugCount = Math.floor(Math.random() * 3) + 3 + save.level;
      const smugglerNames = ["Silvertongue", "The Eel", "Dockrat", "Barnacle", "Longfinger", "Whisper", "Cutpurse", "Saltblood"];
      const usedN = new Set<string>();
      const enemies: EnemySpec[] = Array.from({ length: thugCount }, () => {
        let name: string;
        do { name = smugglerNames[Math.floor(Math.random() * smugglerNames.length)]; } while (usedN.has(name) && usedN.size < smugglerNames.length);
        usedN.add(name);
        return { name, imageEmoji: "\uD83D\uDDE1\uFE0F", stats: { str: 6, dex: 7, con: 5, int: 5, wis: 5, cha: 5, ac: 14, atk: 2, speed: 30, lightningDmg: 0, fireDmg: 0 }, subtypes: [], hpOverride: 10 + Math.floor(Math.random() * 6) + 1 };
      });
      setPendingQuest({ questId: "rumor_smugglers", questName: "Smuggler's Cave", enemies, difficulty: "medium" });
      return;
    }

    // ── Rumor quest: Haunted manor ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("manor")) {
      const skeleton = MONSTERS.find(m => m.id === "skeleton");
      const wight = MONSTERS.find(m => m.id === "wight");
      const enemies: EnemySpec[] = [];
      if (skeleton) {
        const skelCount = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < skelCount; i++) enemies.push(createMonsterSpec(skeleton, "\uD83D\uDC80"));
      }
      if (wight) enemies.push(createMonsterSpec(wight, "\uD83D\uDC7B")); // boss
      setPendingQuest({ questId: "rumor_haunted_manor", questName: "Haunted Manor", enemies, difficulty: "hard" });
      return;
    }

    // ── Rumor quest: Shadow cultists in the sewers ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("shadow temple")) {
      const cultistCount = Math.floor(Math.random() * 3) + 3 + save.level;
      const enemies: EnemySpec[] = Array.from({ length: cultistCount }, (_, i) => ({
        name: i === 0 ? "Shadow Priest" : `Cultist ${i}`,
        imageEmoji: i === 0 ? "\uD83E\uDDD9" : "\uD83D\uDC64",
        stats: i === 0
          ? { str: 5, dex: 6, con: 6, int: 8, wis: 8, cha: 7, ac: 16, atk: 3, speed: 30, lightningDmg: 0, fireDmg: 0 }
          : { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5, ac: 13, atk: 1, speed: 30, lightningDmg: 0, fireDmg: 0 },
        subtypes: [] as string[],
        hpOverride: i === 0 ? 20 + save.level * 2 : 8 + Math.floor(Math.random() * 4),
      }));
      setPendingQuest({ questId: "rumor_cultists", questName: "Sewer Cult", enemies, difficulty: "hard" });
      return;
    }

    // ── Rumor quest: Gnoll bounty on King's Road ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("gnoll raider")) {
      const gnoll = MONSTERS.find(m => m.id === "gnoll");
      if (gnoll) {
        const count = Math.floor(Math.random() * 2) + 2 + Math.floor(save.level / 2);
        const enemies: EnemySpec[] = Array.from({ length: count }, (_, i) => {
          const spec = createMonsterSpec(gnoll, "\uD83D\uDC3A");
          return i === 0 ? { ...spec, name: "Gnoll Raider Chief", hpOverride: (spec.hpOverride ?? 10) + 8 } : spec;
        });
        setPendingQuest({ questId: "rumor_bounty", questName: "Gnoll Raider Bounty", enemies, difficulty: "medium" });
        return;
      }
    }

    // ── Rumor quest: Lost caravan ──
    if (lastAction.outcome === "find_quest" && lastAction.description.toLowerCase().includes("caravan vanished")) {
      const goblin = MONSTERS.find(m => m.id === "goblin");
      const hobgoblin = MONSTERS.find(m => m.id === "hobgoblin");
      const enemies: EnemySpec[] = [];
      if (goblin) {
        const gobCount = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < gobCount; i++) enemies.push(createMonsterSpec(goblin, "\uD83D\uDC7A"));
      }
      if (hobgoblin) enemies.push(createMonsterSpec(hobgoblin, "\u2694\uFE0F")); // leader
      setPendingQuest({ questId: "rumor_lost_caravan", questName: "Lost Caravan", enemies, difficulty: "medium" });
      return;
    }

    // Thug fight — use the pre-rolled count from calculateWorldLuck
    if (lastAction.outcome === "thug_fight") {
      const thugCount = lastAction.enemyCount ?? (Math.max(1, save.party.heroes.length) + Math.floor(Math.random() * 6) + 1);
      const combatFeats = FEATS.filter(f => f.category === "combat" && !f.prereqs.feat && !f.prereqs.minBAB && !f.prereqs.classOnly);
      const thugNames = ["Scarface", "Knuckles", "Ratbone", "Grinner", "Nail", "Crooked Tom", "Shiv", "Guttersnipe",
        "Brick", "Fang", "Weasel", "Scar", "Blackjack", "Dirk", "Mugsy", "Stubs"];
      const usedNames = new Set<string>();
      const thugs: EnemySpec[] = Array.from({ length: thugCount }, () => {
        let name: string;
        do { name = thugNames[Math.floor(Math.random() * thugNames.length)]; } while (usedNames.has(name) && usedNames.size < thugNames.length);
        usedNames.add(name);
        const feat = combatFeats[Math.floor(Math.random() * combatFeats.length)];
        return {
          name: `${name} (${feat.name})`,
          imageEmoji: "\uD83D\uDC4A",  // 👊
          stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5, ac: 13, atk: 1, speed: 30, lightningDmg: 0, fireDmg: 0 },
          subtypes: [],
          hpOverride: 8 + Math.floor(Math.random() * 4) + 1,
        };
      });
      setPendingQuest({
        questId: "thug_ambush",
        questName: "Street Ambush",
        enemies: thugs,
        difficulty: "medium",
      });
      return;
    }

    // Random encounter fight — build enemies from encounter data
    if (lastAction.outcome === "fight" && lastAction.encounter) {
      const enemies: EnemySpec[] = [];
      const terrainEmoji: Record<string, string> = {
        forest: "\u{1F43B}", desert: "\u{1F982}", jungle: "\u{1F40D}", swamp: "\u{1F40A}",
        mountain: "\u{1F9CC}", plains: "\u{1F43A}", coast: "\u{1F419}", town: "\u{1F5E1}\u{FE0F}",
      };
      const hex = ALL_HEXES.find(h => h.q === activeMapHex.q && h.r === activeMapHex.r);
      const emoji = terrainEmoji[hex?.type ?? "plains"] ?? "\u{1F47E}";
      for (const group of lastAction.encounter.monsters) {
        for (let i = 0; i < group.count; i++) {
          enemies.push(createMonsterSpec(group.monster, emoji));
        }
      }
      if (enemies.length > 0) {
        setPendingQuest({
          questId: "random_encounter",
          questName: "Encounter",
          enemies,
          difficulty: lastAction.difficulty ?? "easy",
        });
        return;
      }
    }

    setPendingQuest(null);
  }, [lastAction, save.party.heroes.length, save.level, activeMapHex.q, activeMapHex.r]);

  const [selectedSkill, setSelectedSkill] = useState<FieldSkillId>("search");
  const currentHex = ALL_HEXES.find(h => h.q === activeMapHex.q && h.r === activeMapHex.r);
  const con = character ? Math.max(1, character.stats.con) : 1;
  const charStats: Record<string, number> = character
    ? { str: character.stats.str, dex: character.stats.dex, con: character.stats.con, int: character.stats.int, wis: character.stats.wis, cha: character.stats.cha }
    : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const skillRanks = save.skill_ranks ?? {};
  const heroCount = Math.max(1, save.party.heroes.length);
  const playerPx = hexToPixel(activeMapHex.q, activeMapHex.r);
  const distFromCity = hexDistance(activeMapHex, CITY_CENTER);
  // For existing saves without last_rest_hour/last_ate_hour, treat as fresh
  const exhaustion = getExhaustionPoints(save.hour ?? 0, save.last_rest_hour ?? (save.hour ?? 0), save.last_ate_hour ?? (save.hour ?? 0));
  const exhPts = exhaustion.points;  // -1 to all stats per point

  // ── Auto-repeat: fire the party's saved action when it becomes active ──
  // Serialize auto_action to a string so React can compare deps reliably (objects fail Object.is)
  const autoKey = activeParty?.auto_action ? `${activeParty.auto_action.type}:${activeParty.auto_action.skill ?? ""}` : "";
  useEffect(() => {
    if (!autoKey || !activeParty?.auto_action || activeParty.has_acted) return;
    if (fightBlocking) return; // must resolve fight before auto continues
    if (!currentHex) return;
    // Safety: stop auto if out of food, can't afford followers, or critically low HP
    const totalCp = save.coins.gp * 100 + save.coins.sp * 10 + save.coins.cp;
    const dailyFollowerCost = save.party.heroes.reduce((sum, h) =>
      sum + h.followers.filter(f => f.alive).reduce((s, f) => s + f.dailyCost, 0), 0);
    const dailyFollowerFood = save.party.heroes.reduce((sum, h) =>
      sum + h.followers.filter(f => f.alive).reduce((s, f) => s + f.foodCost, 0), 0);
    const cantAfford = totalCp < dailyFollowerCost || save.food < 1 + dailyFollowerFood;
    if (save.food <= 0 || save.current_hp <= 1 || cantAfford) {
      onSetAutoAction?.(save.active_party_index ?? 0, null);
      return;
    }
    const timer = setTimeout(() => {
      const aa = activeParty.auto_action!;
      // Rest at night (hour 16-23 each day) instead of using skill
      const isNight = ((save.hour ?? 0) % 24) >= 16;
      const doRest = aa.type === "rest" || isNight;
      const result = doRest
        ? rollWorldLuck(currentHex, "rest", charStats, skillRanks, distFromCity, undefined, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name)
        : rollWorldLuck(currentHex, "skill", charStats, skillRanks, distFromCity, (aa.skill ?? "search") as FieldSkillId, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);

      // Interrupting outcomes — cancel auto
      const INTERRUPTS = new Set(["fight", "thug_fight", "find_quest", "find_dungeon", "hazard"]);
      if (INTERRUPTS.has(result.outcome)) {
        onSetAutoAction?.(save.active_party_index ?? 0, null);
      }
      setLastAction(result);
      onAction(result);
    }, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.hour, save.active_party_index, autoKey, fightBlocking]);

  // Encumbrance check — blocks travel when overloaded
  // Followers with carry_bonus abilities increase party capacity
  const playerStr = character ? Math.max(1, character.stats.str) : 10;
  const followerCarryBonus = save.party.heroes.reduce((sum, h) =>
    h.followers.filter(f => f.alive).reduce((s, f) => {
      if (f.abilities.includes("carry_bonus_50")) return s + 0.5;
      if (f.abilities.includes("carry_bonus_30")) return s + 0.3;
      return s;
    }, sum), 0);
  const effectiveStr = Math.round(playerStr * (1 + followerCarryBonus));
  const playerInvWeight = save.inventory.reduce((s, it) => s + (it.itemWeight ?? getItemWeight(it.id)) * it.qty, 0);
  const playerEqWeight = (["weapon", "armor", "shield", "accessory"] as (keyof Equipment)[]).reduce((s, sl) => {
    const id = save.equipment[sl as keyof Equipment]; return id ? s + getItemWeight(id) : s;
  }, 0);
  const playerCoinWeight = coinWeight(save.coins);
  const playerTotalWeight = playerInvWeight + playerEqWeight + playerCoinWeight;
  const playerEncumbrance = getEncumbrance(effectiveStr, playerTotalWeight);

  // Auto-collapse when any stat hits 1 from exhaustion (only on change, not mount)
  const prevExhPts = useRef(exhPts);
  useEffect(() => {
    if (prevExhPts.current === exhPts) return; // skip mount
    prevExhPts.current = exhPts;
    if (!character || exhPts <= 0) return;
    const minStat = lowestExhaustedStat(charStats, exhPts);
    if (minStat <= 1) {
      const isSafe = currentHex?.type === "town" || (currentHex?.tags?.includes("farm") ?? false);
      // Defer to avoid alert during render
      setTimeout(() => onExhaustionCollapse(isSafe), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exhPts]);

  // Reachable hexes within MAX_TRAVEL (all terrain, including water)
  const reachableSet = useMemo(() => {
    const set = new Set<string>();
    ALL_HEXES.forEach(h => {
      const d = hexDistance(activeMapHex, h);
      if (d >= 1 && d <= MAX_TRAVEL) set.add(`${h.q},${h.r}`);
    });
    return set;
  }, [activeMapHex]);

  // Center on player
  const centerOnPlayer = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ms = VB * zoom;
    // Convert player viewBox coords to pixel offset, then center in viewport
    const px = -playerPx.x * zoom + rect.width / 2;
    const py = -playerPx.y * zoom + rect.height / 2;
    setPan({
      x: Math.min(0, Math.max(rect.width - ms, px)),
      y: Math.min(0, Math.max(rect.height - ms, py)),
    });
  }, [zoom, playerPx.x, playerPx.y]);

  // Auto-center on mount and when player moves
  useEffect(() => {
    if (!didCenter.current) {
      // Small delay to ensure container is rendered and we can measure it
      requestAnimationFrame(() => {
        const minZ = getMinZoom();
        if (zoom < minZ) setZoom(minZ);
        centerOnPlayer();
        didCenter.current = true;
      });
    } else {
      centerOnPlayer();
    }
  }, [centerOnPlayer, getMinZoom]);

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
      const newZoom = Math.min(MAX_ZOOM, Math.max(getMinZoom(), +(oldZoom + delta).toFixed(1)));
      if (newZoom === oldZoom) return;

      // Zoom toward cursor: adjust pan so the point under cursor stays fixed
      const scale = newZoom / oldZoom;
      const newMapSize = VB * newZoom;
      const newP = { x: mx - scale * (mx - pan.x), y: my - scale * (my - pan.y) };
      // Clamp inline since mapSize changes with new zoom
      newP.x = Math.min(0, Math.max(rect.width - newMapSize, newP.x));
      newP.y = Math.min(0, Math.max(rect.height - newMapSize, newP.y));
      setPan(newP);
      setZoom(newZoom);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, pan, getMinZoom]);

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
    setPan(clampPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy }));
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

  /** Effective travel hexes with terrain speed factored in (for food/starvation calc) */
  function travelCost(dist: number, hex: MapHex): number {
    let speed = TERRAIN_SPEED[hex.type] ?? 1;
    if (hex.tags?.includes("road")) speed *= 0.5;
    else if (hex.tags?.includes("dirt_road")) speed *= 0.7;
    return Math.max(1, Math.round(dist * speed));
  }

  /** Hours display for travel */
  function travelHours(dist: number, hex: MapHex): number {
    return travelCost(dist, hex) * HOURS_PER_ACTION;
  }

  function handleTravel() {
    if (!selectedHex) return;
    if (fightBlocking) return; // must resolve fight first
    if (playerEncumbrance === "over") return; // overloaded — cannot travel
    const dist = hexDistance(activeMapHex, selectedHex);
    if (dist === 0 || dist > MAX_TRAVEL) return;
    const effectiveHexes = travelCost(dist, selectedHex);
    const result = travel(effectiveHexes, save, con);
    const destDist = hexDistance(selectedHex, CITY_CENTER);
    const encounter = rollWorldLuck(selectedHex, "travel", charStats, skillRanks, destDist, undefined, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
    onTravel({ q: selectedHex.q, r: selectedHex.r }, result, selectedHex, encounter);
    // If travel encounter is a fight, set lastAction so fightBlocking activates and fight UI shows
    if (encounter.outcome === "fight" || encounter.outcome === "thug_fight") {
      setLastAction(encounter);
    }
    setSelectedHex(null);
  }

  function changeZoom(delta: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const oldZoom = zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(getMinZoom(), +(oldZoom + delta).toFixed(1)));
    const scale = newZoom / oldZoom;
    const newMapSize = VB * newZoom;
    setPan(p => {
      const nx = cx - scale * (cx - p.x);
      const ny = cy - scale * (cy - p.y);
      return { x: Math.min(0, Math.max(rect.width - newMapSize, nx)), y: Math.min(0, Math.max(rect.height - newMapSize, ny)) };
    });
    setZoom(newZoom);
  }

  const mapSize = VB * zoom;

  /** Clamp pan so the map always covers the visible container (no empty edges) */
  const clampPan = useCallback((p: { x: number; y: number }) => {
    const el = containerRef.current;
    if (!el) return p;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.min(0, Math.max(rect.width - mapSize, p.x)),
      y: Math.min(0, Math.max(rect.height - mapSize, p.y)),
    };
  }, [mapSize]);

  return (
    <div className="flex flex-col gap-2" style={{ height: "calc(100vh - 120px)", minHeight: 400, overflow: "hidden" }}>
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
          {activeParty && <span style={{ color: "rgba(96,165,250,0.8)" }}>{activeParty.name}</span>}
          <span>Lv{save.level}</span>
          <span>Day {Math.floor((save.hour ?? 0) / 24) + 1} — {(() => {
            const h = (save.hour ?? 0) % 24;
            if (h < 6) return "Night";
            if (h < 12) return "Morning";
            if (h < 18) return "Afternoon";
            return "Evening";
          })()}</span>
          <span>{"\u{1F356}"}{save.food}</span>
          <span>{"\u2764\uFE0F"}{save.current_hp}/{save.max_hp}</span>
          <span>{"\u{1FA99}"}{formatCoins(save.coins)}</span>
        </div>
        <button onClick={onInventory} className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(251,191,36,0.1)", color: "rgba(251,191,36,0.7)", border: "1px solid rgba(251,191,36,0.25)" }}>
          Pack
        </button>
      </div>

      {/* Party selector bar — always visible */}
      {save.parties && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg overflow-x-auto relative"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(201,168,76,0.1)" }}>
          <span className="text-xs font-bold uppercase tracking-widest shrink-0" style={{ color: "rgba(201,168,76,0.4)", fontSize: "0.5rem" }}>
            Parties
          </span>
          {save.parties.map((p, i) => {
            const isActive = i === (save.active_party_index ?? 0);
            const partyNft = characters?.find(c => c.contractAddress.toLowerCase() === p.heroes[0]?.nft_address);
            return (
              <button key={p.id} onClick={() => onSwitchParty?.(i)}
                className="flex items-center gap-1.5 px-2 py-1 rounded shrink-0"
                style={{
                  background: isActive ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? "rgba(96,165,250,0.5)" : "rgba(201,168,76,0.1)"}`,
                  opacity: p.has_acted && !isActive ? 0.4 : 1,
                }}>
                {partyNft?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={partyNft.imageUrl} alt="" className="rounded-full" style={{ width: 18, height: 18, objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "0.7rem" }}>{"\u{1F6E1}\uFE0F"}</span>
                )}
                <span className="text-xs" style={{ color: isActive ? "rgba(96,165,250,0.9)" : "rgba(232,213,176,0.6)", fontSize: "0.55rem" }}>
                  {p.name}
                </span>
                {p.auto_action && <span style={{ fontSize: "0.45rem", color: "rgba(251,146,60,0.7)" }}>{"\u27F3"}</span>}
                {p.has_acted && <span style={{ fontSize: "0.5rem", color: "rgba(74,222,128,0.6)" }}>{"\u2713"}</span>}
              </button>
            );
          })}
          {/* New party button */}
          <button onClick={() => setShowNewPartyPicker(v => !v)}
            className="flex items-center justify-center shrink-0 rounded"
            style={{ width: 24, height: 24, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "rgba(74,222,128,0.8)", fontSize: "0.8rem", fontWeight: "bold" }}>
            +
          </button>
        </div>
      )}
      {/* NFT picker — inline below party bar so it isn't clipped by overflow:hidden */}
      {showNewPartyPicker && (() => {
        const usedAddresses = new Set(save.parties?.map(p => p.heroes[0]?.nft_address) ?? []);
        const available = characters?.filter(c => c.owned && !usedAddresses.has(c.contractAddress.toLowerCase())) ?? [];
        return (
          <div className="rounded-lg p-2 flex flex-wrap gap-1 items-center"
            style={{ background: "rgba(15,10,5,0.95)", border: "1px solid rgba(201,168,76,0.3)" }}>
            <span className="text-xs font-bold uppercase tracking-widest px-1 shrink-0" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>
              Choose NFT Leader
            </span>
            {available.length === 0 && (
              <span className="text-xs px-1" style={{ color: "rgba(232,213,176,0.4)" }}>No available owned NFTs</span>
            )}
            {available.map(nft => (
              <button key={nft.contractAddress} className="flex items-center gap-1.5 px-2 py-1 rounded shrink-0"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)" }}
                onClick={() => { onCreateParty?.(nft.contractAddress.toLowerCase()); setShowNewPartyPicker(false); }}>
                {nft.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={nft.imageUrl} alt="" className="rounded-full" style={{ width: 20, height: 20, objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "0.7rem" }}>{"\u{1F6E1}\uFE0F"}</span>
                )}
                <span className="text-xs" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.55rem" }}>{nft.name || "Hero"}</span>
              </button>
            ))}
            <button onClick={() => setShowNewPartyPicker(false)}
              className="text-xs px-2 py-1 rounded shrink-0"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,213,176,0.4)", fontSize: "0.55rem" }}>
              Cancel
            </button>
          </div>
        );
      })()}

      {/* Main layout: left panel + map + side panel */}
      <div className="flex gap-2 flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* ── Left panel: Character Sheet / Inventory ── */}
        <div className="hidden lg:flex flex-col gap-1" style={{ width: 640, minWidth: 640 }}>
          <div className="flex gap-1">
            <button onClick={() => setLeftPanel("sheet")}
              className="flex-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: leftPanel === "sheet" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)", color: leftPanel === "sheet" ? "rgba(201,168,76,0.9)" : "rgba(201,168,76,0.4)", border: `1px solid ${leftPanel === "sheet" ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.1)"}` }}>
              Character
            </button>
            <button onClick={() => setLeftPanel("inventory")}
              className="flex-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: leftPanel === "inventory" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)", color: leftPanel === "inventory" ? "rgba(201,168,76,0.9)" : "rgba(201,168,76,0.4)", border: `1px solid ${leftPanel === "inventory" ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.1)"}` }}>
              Inventory
            </button>
            <button onClick={() => setLeftPanel("party")}
              className="flex-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: leftPanel === "party" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)", color: leftPanel === "party" ? "rgba(201,168,76,0.9)" : "rgba(201,168,76,0.4)", border: `1px solid ${leftPanel === "party" ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.1)"}` }}>
              Party
            </button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
            {leftPanel === "sheet" && character && (() => {
              const leaderHero = save.party.heroes.find(h => h.isLeader) ?? save.party.heroes[0];
              const prog = leaderHero?.progression;
              const cls = prog ? getClassById(prog.class_levels[0]?.class_id ?? save.class_id) : getClassById(save.class_id);
              const classLabel = prog && prog.class_levels.length > 1
                ? prog.class_levels.map(cl => { const c = getClassById(cl.class_id); return `${c?.name ?? cl.class_id} ${cl.levels}`; }).join(" / ")
                : `${cls?.name ?? save.class_id}`;
              const xpInfo = xpToNextLevel(prog?.total_level ?? save.level, prog?.xp ?? save.xp);
              const fameBonus = Math.floor((save.fame ?? 0) / 25);
              const fameTier = (save.fame ?? 0) >= 75 ? "Legendary" : (save.fame ?? 0) >= 50 ? "Famous" : (save.fame ?? 0) >= 25 ? "Well-known" : (save.fame ?? 0) >= 10 ? "Local" : "Unknown";
              const stats = character.stats;
              const mod = (v: number) => { const m = calcAbilityMod(v); return m >= 0 ? `+${m}` : `${m}`; };
              const rankedSkills = SKILLS.filter(s => (save.skill_ranks[s.id] ?? 0) > 0)
                .sort((a, b) => (save.skill_ranks[b.id] ?? 0) - (save.skill_ranks[a.id] ?? 0));
              const charFeats = save.feats.map(fid => FEATS.find(f => f.id === fid)).filter(Boolean);
              return (
                <div className="p-2 flex flex-col gap-2" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.7)" }}>
                  {/* Name + Class */}
                  <div>
                    <div className="text-sm font-bold" style={{ color: "rgba(232,213,176,0.9)" }}>{character.name}</div>
                    <div style={{ color: "rgba(201,168,76,0.6)" }}>Level {prog?.total_level ?? save.level} {classLabel}</div>
                  </div>
                  {/* HP + XP bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><span>HP</span><span className="font-bold">{save.current_hp}/{save.max_hp}</span></div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, (save.current_hp / save.max_hp) * 100)}%`, height: "100%", background: save.current_hp / save.max_hp > 0.5 ? "rgba(74,222,128,0.6)" : save.current_hp / save.max_hp > 0.25 ? "rgba(251,191,36,0.6)" : "rgba(220,38,38,0.6)", borderRadius: 2 }} />
                    </div>
                    <div className="flex justify-between"><span>XP</span><span className="font-bold">{save.xp}/{xpInfo.needed}</span></div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, xpInfo.progress * 100)}%`, height: "100%", background: "rgba(96,165,250,0.6)", borderRadius: 2 }} />
                    </div>
                  </div>
                  {/* Ability Scores */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Abilities</div>
                    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                      {(["str", "dex", "con", "int", "wis", "cha"] as const).map(ab => {
                        const base = Math.floor(stats[ab]);
                        const eff = exhaustedStat(base, exhPts);
                        const reduced = eff < base;
                        return (
                          <div key={ab} className="flex justify-between">
                            <span className="uppercase" style={{ color: "rgba(232,213,176,0.5)" }}>{ab}</span>
                            <span className="font-bold" style={reduced ? { color: "rgba(220,38,38,0.8)" } : undefined}>
                              {reduced ? eff : base} <span style={{ color: reduced ? "rgba(220,38,38,0.5)" : "rgba(96,165,250,0.6)" }}>({mod(eff)})</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Combat stats */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Combat</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <span>AC</span><span className="font-bold">{stats.ac}</span>
                      <span>Attack</span><span className="font-bold">+{stats.atk}</span>
                      <span>Speed</span><span className="font-bold">{stats.speed} ft</span>
                    </div>
                  </div>
                  {/* Carry Weight */}
                  {(() => {
                    const thresh = getCarryThresholds(effectiveStr);
                    const encCol = playerEncumbrance === "over" ? "rgba(220,38,38,0.8)" : playerEncumbrance === "heavy" ? "rgba(251,191,36,0.8)" : playerEncumbrance === "medium" ? "rgba(251,191,36,0.6)" : "rgba(74,222,128,0.6)";
                    return (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="font-bold uppercase tracking-widest" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Carry Weight</span>
                          <span className="font-bold" style={{ color: encCol }}>{playerTotalWeight.toFixed(1)}/{thresh.heavy} lbs</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(100, (playerTotalWeight / Math.max(1, thresh.heavy)) * 100)}%`, height: "100%", background: encCol, borderRadius: 2 }} />
                        </div>
                        {playerEncumbrance === "over" && <div style={{ fontSize: "0.4rem", color: "rgba(220,38,38,0.9)", marginTop: 2 }}>OVERLOADED — cannot travel!</div>}
                        {playerEncumbrance === "heavy" && <div style={{ fontSize: "0.4rem", color: "rgba(251,191,36,0.7)", marginTop: 2 }}>Heavy load — movement slowed</div>}
                        {followerCarryBonus > 0 && <div style={{ fontSize: "0.4rem", color: "rgba(96,165,250,0.6)", marginTop: 1 }}>+{Math.round(followerCarryBonus * 100)}% from followers</div>}
                      </div>
                    );
                  })()}
                  {/* Supplies */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Supplies</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <span>{"\u{1F356}"} Food</span><span className="font-bold">{save.food} ({Math.floor(save.food / 3)}d)</span>
                      <span>{"\u{1FA99}"} Purse</span><span className="font-bold">{formatCoins(save.coins)}</span>
                      <span>{"\u{1F4C5}"} Day</span><span className="font-bold">{Math.floor((save.hour ?? 0) / 24) + 1}</span>
                      <span>{"\u2B50"} Fame</span><span className="font-bold">{save.fame ?? 0} <span style={{ color: "rgba(251,191,36,0.6)" }}>({fameTier})</span></span>
                    </div>
                  </div>
                  {/* Exhaustion */}
                  {exhPts > 0 && (() => {
                    const minStat = character ? lowestExhaustedStat(charStats, exhPts) : 10 - exhPts;
                    const critical = minStat <= 2;
                    const severe = minStat <= 4;
                    return (
                      <div className="px-2 py-1 rounded" style={{
                        background: critical ? "rgba(220,38,38,0.2)" : severe ? "rgba(220,38,38,0.1)" : "rgba(251,191,36,0.08)",
                        border: `1px solid ${critical ? "rgba(220,38,38,0.4)" : severe ? "rgba(220,38,38,0.25)" : "rgba(251,191,36,0.2)"}`,
                      }}>
                        <div className="font-bold uppercase" style={{ fontSize: "0.45rem", color: critical ? "rgba(220,38,38,0.9)" : severe ? "rgba(220,38,38,0.7)" : "rgba(251,191,36,0.7)" }}>
                          EXHAUSTION {exhPts} — all stats -{exhPts}
                        </div>
                        <div style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.5)" }}>
                          {exhaustion.sleepPoints > 0 && <>{exhaustion.sleepPoints} from no sleep ({exhaustion.hoursAwake}h) </>}
                          {exhaustion.hungerPoints > 0 && <>{exhaustion.hungerPoints} from hunger ({exhaustion.hoursSinceFood}h) </>}
                          {critical ? "— REST AND EAT or you will die!" : severe ? "— dangerously fatigued!" : ""}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Skills with ranks */}
                  {rankedSkills.length > 0 && (
                    <div>
                      <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Skills</div>
                      <div className="flex flex-col gap-0.5">
                        {rankedSkills.map(s => {
                          const ranks = save.skill_ranks[s.id] ?? 0;
                          const abilScore = stats[s.ability as keyof typeof stats] ?? 10;
                          const total = ranks + calcAbilityMod(abilScore);
                          return (
                            <div key={s.id} className="flex justify-between">
                              <span>{s.name}</span>
                              <span className="font-bold">+{total} <span style={{ color: "rgba(232,213,176,0.35)" }}>({ranks}r)</span></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Feats */}
                  {charFeats.length > 0 && (
                    <div>
                      <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Abilities</div>
                      <div className="flex flex-wrap gap-1">
                        {charFeats.map(f => f && (
                          <span key={f.id} className="px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "rgba(168,85,247,0.7)", fontSize: "0.45rem" }}>
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Equipment */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Equipment</div>
                    <div className="flex flex-col gap-0.5">
                      {(["weapon", "armor", "shield", "accessory"] as (keyof Equipment)[]).map(slot => {
                        const itemId = save.equipment[slot];
                        const info = itemId ? getItemInfo(itemId) : null;
                        return (
                          <div key={slot} className="flex justify-between">
                            <span className="capitalize" style={{ color: "rgba(232,213,176,0.4)" }}>{slot}</span>
                            <span className="font-bold">{info?.name ?? (itemId || "—")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {leftPanel === "inventory" && (() => {
              const thresholds = getCarryThresholds(effectiveStr);
              const encColor = playerEncumbrance === "over" ? "rgba(220,38,38,0.8)" : playerEncumbrance === "heavy" ? "rgba(251,191,36,0.8)" : playerEncumbrance === "medium" ? "rgba(251,191,36,0.6)" : "rgba(74,222,128,0.6)";
              const cWeight = playerCoinWeight;
              return (
                <div className="p-2 flex flex-col gap-2" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.7)" }}>
                  {/* Carry weight bar */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-bold uppercase tracking-widest" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Carry Weight</span>
                      <span className="font-bold" style={{ color: encColor }}>{playerTotalWeight.toFixed(1)} / {thresholds.heavy} lbs ({playerEncumbrance})</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(100, (playerTotalWeight / Math.max(1, thresholds.heavy)) * 100)}%`, height: "100%", background: encColor, borderRadius: 3 }} />
                    </div>
                    {followerCarryBonus > 0 && <div style={{ fontSize: "0.4rem", color: "rgba(96,165,250,0.6)", marginTop: 2 }}>+{Math.round(followerCarryBonus * 100)}% capacity from followers</div>}
                  </div>
                  {/* Coin purse */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Coin Purse</div>
                    <div className="flex justify-between">
                      <span>{formatCoins(save.coins)}</span>
                      <span style={{ color: "rgba(232,213,176,0.4)" }}>{cWeight.toFixed(1)} lbs</span>
                    </div>
                  </div>
                  {/* Equipment */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Equipped</div>
                    {(["weapon", "armor", "shield", "accessory"] as (keyof Equipment)[]).map(slot => {
                      const itemId = save.equipment[slot];
                      const info = itemId ? getItemInfo(itemId) : null;
                      return (
                        <div key={slot} className="flex items-center justify-between gap-1">
                          <span className="capitalize" style={{ color: "rgba(232,213,176,0.4)" }}>{slot}</span>
                          <div className="flex items-center gap-1">
                            <span>{info?.name ?? (itemId || "—")}{info ? ` (${getItemWeight(itemId!)}lb)` : ""}</span>
                            {itemId && onUnequip && (
                              <button onClick={() => onUnequip(slot)}
                                className="px-1 rounded text-[0.45rem] font-bold"
                                style={{ background: "rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.8)", border: "1px solid rgba(239,68,68,0.3)" }}>
                                X
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Food */}
                  <div className="flex justify-between">
                    <span className="font-bold">{"\u{1F356}"} Food Supply</span>
                    <span className="font-bold">{save.food} ({Math.floor(save.food / 3)} days)</span>
                  </div>
                  {/* Item list */}
                  <div>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>Items ({save.inventory.length})</div>
                    {save.inventory.length === 0 ? (
                      <div style={{ color: "rgba(232,213,176,0.3)" }}>No items</div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {save.inventory.map(item => {
                          const info = getItemInfo(item.id);
                          const w = item.itemWeight ?? getItemWeight(item.id);
                          const slot = getEquipSlot(item.id, info);
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-1">
                              <span className="truncate">{info?.name ?? item.id}{item.qty > 1 ? ` x${item.qty}` : ""}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {slot && onEquip && (
                                  <button onClick={() => onEquip(item.id, slot)}
                                    className="px-1 rounded text-[0.45rem] font-bold"
                                    style={{ background: "rgba(74,222,128,0.15)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.3)" }}>
                                    Equip
                                  </button>
                                )}
                                <span style={{ color: "rgba(232,213,176,0.4)" }}>{(w * item.qty).toFixed(1)}lb</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Full inventory button */}
                  <button onClick={onInventory}
                    className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest mt-1"
                    style={{ background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.7)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    Full Inventory
                  </button>
                </div>
              );
            })()}
            {leftPanel === "party" && (() => {
              const roleEmoji: Record<string, string> = { melee: "\u2694\uFE0F", ranged: "\u{1F3F9}", specialist: "\u{1F9EA}", labor: "\u{1F4E6}", pet: "\u{1F43E}", faction: "\u{1F6E1}\uFE0F" };
              return (
                <div className="p-2 flex flex-col gap-3" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.7)" }}>
                  {/* Faction banner */}
                  {save.faction_name && (
                    <div className="text-center px-2 py-1.5 rounded" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                      <div className="font-bold uppercase tracking-widest" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Faction</div>
                      <div className="font-bold" style={{ fontSize: "0.65rem", color: "rgba(251,191,36,0.9)" }}>{save.faction_name}</div>
                    </div>
                  )}
                  {save.party.heroes.map((hero, hIdx) => {
                    const hProg = hero.progression;
                    const hLevel = hProg?.total_level ?? save.level;
                    const hXp = hProg?.xp ?? save.xp;
                    const hXpInfo = xpToNextLevel(hLevel, hXp);
                    const hClassLabel = hProg && hProg.class_levels.length > 0
                      ? hProg.class_levels.map(cl => { const c = getClassById(cl.class_id); return `${c?.name ?? cl.class_id} ${cl.levels}`; }).join(" / ")
                      : (getClassById(save.class_id)?.name ?? save.class_id);
                    const charForHero = characters?.find(c => c.contractAddress === hero.nft_address);
                    const aliveFollowers = hero.followers.filter(f => f.alive);
                    return (
                      <div key={hero.nft_address}>
                        {/* Hero header */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-t" style={{ background: hero.isLeader ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${hero.isLeader ? "rgba(251,191,36,0.2)" : "rgba(201,168,76,0.1)"}` }}>
                          <div className="flex-1">
                            <div className="font-bold" style={{ color: hero.isLeader ? "rgba(251,191,36,0.9)" : "rgba(232,213,176,0.9)", fontSize: "0.65rem" }}>
                              {hero.isLeader ? "\u{1F451} " : ""}{charForHero?.name ?? hero.nft_address.slice(0, 8)}
                            </div>
                            <div style={{ color: "rgba(201,168,76,0.6)" }}>Lv{hLevel} {hClassLabel}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span style={{ color: "rgba(74,222,128,0.7)" }}>XP {hXp}/{hXpInfo.needed}</span>
                              {hProg && <span style={{ color: "rgba(96,165,250,0.6)" }}>HP {hProg.current_hp}/{hProg.max_hp}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Followers */}
                        {aliveFollowers.length > 0 ? (
                          <div className="flex flex-col" style={{ borderLeft: "2px solid rgba(201,168,76,0.1)", marginLeft: 8 }}>
                            {aliveFollowers.map(f => {
                              const fLevel = f.progression?.total_level ?? f.level;
                              const fXp = f.progression?.xp ?? f.xp ?? 0;
                              const fXpInfo = xpToNextLevel(fLevel, fXp);
                              const fClassLabel = f.progression && f.progression.class_levels.length > 0
                                ? f.progression.class_levels.map(cl => { const c = getClassById(cl.class_id); return `${c?.name ?? cl.class_id} ${cl.levels}`; }).join("/")
                                : (getClassById(f.class_id)?.name ?? f.class_id ?? "Warrior");
                              const loyaltyColor = (f.loyalty ?? 0) >= 80 ? "rgba(74,222,128,0.7)" : (f.loyalty ?? 0) >= 50 ? "rgba(251,191,36,0.7)" : "rgba(220,38,38,0.7)";
                              const isSelected = selectedFollowerId === f.id;
                              return (
                                <div key={f.id}>
                                  <div
                                    className="flex items-start gap-1.5 px-2 py-1 cursor-pointer"
                                    style={{ borderBottom: "1px solid rgba(201,168,76,0.05)", background: isSelected ? "rgba(201,168,76,0.08)" : "transparent" }}
                                    onClick={() => setSelectedFollowerId(isSelected ? null : f.id)}
                                  >
                                    <span style={{ fontSize: "0.7rem" }}>{roleEmoji[f.role] ?? "\u2694\uFE0F"}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold truncate" style={{ color: "rgba(232,213,176,0.8)" }}>{f.name}</span>
                                        <span style={{ color: "rgba(201,168,76,0.4)", fontSize: "0.45rem" }}>{f.role}</span>
                                        <span style={{ color: "rgba(201,168,76,0.3)", fontSize: "0.45rem", marginLeft: "auto" }}>{isSelected ? "\u25B2" : "\u25BC"}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-x-2 gap-y-0">
                                        <span>Lv{fLevel} {fClassLabel}</span>
                                        <span style={{ color: "rgba(74,222,128,0.6)" }}>HP {f.hp}/{f.maxHp}</span>
                                        <span style={{ color: "rgba(96,165,250,0.6)" }}>XP {fXp}/{fXpInfo.needed}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Expanded detail panel */}
                                  {isSelected && (
                                    <div className="px-3 py-2 flex flex-col gap-1.5" style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(201,168,76,0.1)", marginLeft: 8 }}>
                                      {/* Equipment */}
                                      <div>
                                        <div className="font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Equipment</div>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Weapon</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.weapon ?? "Unarmed"}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Armor</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.armor && f.armor !== "None" ? f.armor : "Unarmored"}</span>
                                        </div>
                                      </div>
                                      {/* Combat Stats */}
                                      <div>
                                        <div className="font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Combat</div>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>AC</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.progression?.equipment ? "from gear" : f.ac}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Attack</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>+{f.progression ? (() => { let bab = 0; for (const cl of f.progression!.class_levels) { const cd = getClassById(cl.class_id); if (cd) { const rate = cd.bab === "good" ? 1 : cd.bab === "average" ? 0.75 : 0.5; bab += Math.floor(cl.levels * rate); } } return bab; })() : f.attack}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>HP</span>
                                          <span style={{ color: f.hp > f.maxHp * 0.5 ? "rgba(74,222,128,0.8)" : f.hp > 0 ? "rgba(251,191,36,0.8)" : "rgba(220,38,38,0.8)" }}>{f.hp} / {f.maxHp}</span>
                                        </div>
                                      </div>
                                      {/* Status */}
                                      <div>
                                        <div className="font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Status</div>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Morale</span>
                                          <span style={{ color: f.morale >= 50 ? "rgba(74,222,128,0.8)" : "rgba(220,38,38,0.8)" }}>{f.morale}/100</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Loyalty</span>
                                          <span style={{ color: loyaltyColor }}>{f.loyalty ?? 0}/100{(f.loyalty ?? 0) >= 80 ? " (Loyal)" : ""}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>XP</span>
                                          <span style={{ color: "rgba(96,165,250,0.8)" }}>{fXp} / {fXpInfo.needed}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Pay</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.dailyCost > 0 ? formatCoins(cpToCoins(f.dailyCost)) + "/day" : "Free"}</span>
                                          <span style={{ color: "rgba(201,168,76,0.5)" }}>Food</span>
                                          <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.foodCost}/day</span>
                                        </div>
                                      </div>
                                      {/* Abilities */}
                                      {f.abilities.length > 0 && (
                                        <div>
                                          <div className="font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Abilities</div>
                                          <div className="flex flex-wrap gap-1">
                                            {f.abilities.map((a, i) => (
                                              <span key={i} className="px-1 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)", color: "rgba(232,213,176,0.7)", fontSize: "0.45rem" }}>
                                                {a.replace(/_/g, " ")}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Skills/Feats (if progression exists) */}
                                      {f.progression && f.progression.feats.length > 0 && (
                                        <div>
                                          <div className="font-bold uppercase tracking-widest mb-0.5" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Feats</div>
                                          <div className="flex flex-wrap gap-1">
                                            {f.progression.feats.map((ft, i) => (
                                              <span key={i} className="px-1 py-0.5 rounded" style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.7)", fontSize: "0.45rem" }}>
                                                {ft.replace(/_/g, " ")}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-2 py-1 ml-2" style={{ color: "rgba(232,213,176,0.3)", fontSize: "0.45rem" }}>No followers</div>
                        )}
                      </div>
                    );
                  })}
                  {/* Party summary */}
                  <div className="px-2 py-1.5 rounded" style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.08)" }}>
                    <div className="font-bold uppercase tracking-widest mb-1" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.4)" }}>Party Summary</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <span>Heroes</span><span className="font-bold">{save.party.heroes.length}</span>
                      <span>Followers</span><span className="font-bold">{save.party.heroes.reduce((s, h) => s + h.followers.filter(f => f.alive).length, 0)}</span>
                      <span>Daily Cost</span><span className="font-bold">{formatCoins(cpToCoins(save.party.heroes.reduce((s, h) => s + h.followers.filter(f => f.alive).reduce((a, f) => a + f.dailyCost, 0), 0)))}</span>
                      <span>Daily Food</span><span className="font-bold">{1 + save.party.heroes.reduce((s, h) => s + h.followers.filter(f => f.alive).reduce((a, f) => a + f.foodCost, 0), 0)}/day</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Zoomable map container */}
        <div className="flex-1 flex flex-col gap-1 min-h-0">
          <div ref={containerRef} className="overflow-hidden rounded-lg select-none flex-1"
            style={{ minHeight: 200, background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.1)", cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div className="relative" style={{ width: mapSize, height: mapSize, transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kardovs-gate-map.jpg" alt="Kardov's Gate"
                className="absolute inset-0 w-full h-full" style={{ opacity: 0.8 }} draggable={false} />
              <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
                {ALL_HEXES.map(hex => {
                  const { x, y } = hexToPixel(hex.q, hex.r);
                  const key = `${hex.q},${hex.r}`;
                  const isCurrent = hex.q === activeMapHex.q && hex.r === activeMapHex.r;
                  const isReachable = reachableSet.has(key);
                  const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r;
                  const dist = hexDistance(activeMapHex, hex);

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
                        character?.imageUrl ? (
                          <g style={{ pointerEvents: "none" }}>
                            <defs>
                              <clipPath id="hex-avatar">
                                <circle cx={x} cy={y} r={HEX_SIZE * 0.7} />
                              </clipPath>
                            </defs>
                            <image
                              href={character.imageUrl}
                              x={x - HEX_SIZE * 0.7} y={y - HEX_SIZE * 0.7}
                              width={HEX_SIZE * 1.4} height={HEX_SIZE * 1.4}
                              clipPath="url(#hex-avatar)"
                              preserveAspectRatio="xMidYMid slice"
                            />
                            <circle cx={x} cy={y} r={HEX_SIZE * 0.7}
                              fill="none" stroke="rgba(96,165,250,0.9)" strokeWidth={0.6} />
                          </g>
                        ) : (
                          <text x={x} y={y + 0.8} textAnchor="middle" dominantBaseline="central"
                            fontSize={5} style={{ pointerEvents: "none" }}>
                            {"\u{1F9D9}"}
                          </text>
                        )
                      )}
                      {!isCurrent && isReachable && hex.type !== "water" && (
                        <text x={x} y={y - HEX_SIZE * 0.15} textAnchor="middle"
                          fontSize={2.2} fill="rgba(74,222,128,0.9)" fontWeight="bold"
                          style={{ pointerEvents: "none" }}>
                          {dist}d
                        </text>
                      )}
                      {/* Other (non-active) party markers */}
                      {!isCurrent && save.parties?.filter((p, i) => i !== (save.active_party_index ?? 0) && p.map_hex.q === hex.q && p.map_hex.r === hex.r).map((p) => {
                        const partyNft = characters?.find(c => c.contractAddress.toLowerCase() === p.heroes[0]?.nft_address);
                        return (
                          <g key={p.id} style={{ pointerEvents: "all", cursor: "pointer", opacity: 0.6 }}
                            onClick={(e) => { e.stopPropagation(); onSwitchParty?.(save.parties!.indexOf(p)); }}>
                            {partyNft?.imageUrl ? (
                              <>
                                <defs><clipPath id={`clip-${p.id}`}><circle cx={x} cy={y} r={HEX_SIZE * 0.55} /></clipPath></defs>
                                <image href={partyNft.imageUrl} x={x - HEX_SIZE * 0.55} y={y - HEX_SIZE * 0.55}
                                  width={HEX_SIZE * 1.1} height={HEX_SIZE * 1.1}
                                  clipPath={`url(#clip-${p.id})`} preserveAspectRatio="xMidYMid slice" />
                                <circle cx={x} cy={y} r={HEX_SIZE * 0.55}
                                  fill="none" stroke="rgba(201,168,76,0.7)" strokeWidth={0.4} />
                              </>
                            ) : (
                              <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central"
                                fontSize={4}>{"\u{1F6E1}\uFE0F"}</text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
              {/* Night dimming overlay */}
              {(() => {
                const h = (save.hour ?? 0) % 24;
                // Gradual transitions: dusk 18-21, full night 21-5, dawn 5-7
                let opacity = 0;
                if (h >= 21 || h < 5) opacity = 0.45;        // deep night
                else if (h >= 18) opacity = 0.15 * (h - 18); // dusk: 0→0.45
                else if (h < 7) opacity = 0.45 - 0.225 * (h - 5); // dawn: 0.45→0
                if (opacity > 0) return (
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `rgba(10,10,40,${opacity})`, mixBlendMode: "multiply" }} />
                );
                return null;
              })()}
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
        <div className="w-full lg:w-[640px] flex flex-col gap-2">
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
                {activeMapHex.q},{activeMapHex.r}
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
              const commonCost = 80;  // PHB: common inn 5sp + meal 3sp = 80cp
              const luxuryCost = 250;  // PHB: good inn 2gp + meal 5sp = 250cp
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
                    {/* Exhaustion warning */}
                    {exhPts > 0 && (() => {
                      const minStat = character ? lowestExhaustedStat(charStats, exhPts) : 10 - exhPts;
                      const critical = minStat <= 2;
                      return (
                        <div className="mt-1 px-2 py-1 rounded" style={{
                          background: critical ? "rgba(220,38,38,0.2)" : "rgba(251,191,36,0.08)",
                          border: `1px solid ${critical ? "rgba(220,38,38,0.4)" : "rgba(251,191,36,0.2)"}`,
                          fontSize: "0.45rem", color: critical ? "rgba(220,38,38,0.9)" : "rgba(251,191,36,0.8)",
                        }}>
                          Exhaustion {exhPts} — all stats -{exhPts}
                          {exhaustion.sleepPoints > 0 && <> ({exhaustion.sleepPoints} sleep)</>}
                          {exhaustion.hungerPoints > 0 && <> ({exhaustion.hungerPoints} hunger)</>}
                          {critical ? " — REST NOW or you will collapse!" : ""}
                        </div>
                      );
                    })()}
                    {/* Skill picker + rest */}
                    <div className="flex flex-col gap-1 mt-1">
                      {(
                        <div className="flex flex-wrap gap-0.5">
                          {Object.values(FIELD_SKILLS).map(fs => (
                            <button key={fs.id} onClick={() => setSelectedSkill(fs.id as FieldSkillId)}
                              className="px-1.5 py-0.5 rounded transition-all"
                              style={{
                                background: selectedSkill === fs.id ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.03)",
                                color: selectedSkill === fs.id ? "rgba(251,191,36,0.9)" : "rgba(232,213,176,0.4)",
                                border: `1px solid ${selectedSkill === fs.id ? "rgba(251,191,36,0.4)" : "rgba(201,168,76,0.08)"}`,
                                fontSize: "0.4rem",
                              }}>
                              {fs.emoji} {fs.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {fightBlocking && (
                        <div className="px-2 py-1 rounded text-center" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.4rem", color: "rgba(220,38,38,0.7)" }}>
                          Resolve the encounter first!
                        </div>
                      )}
                      {!fightBlocking && <div className="flex gap-1">
                        {(
                          <button onClick={() => {
                              const result = rollWorldLuck(currentHex, "skill", charStats, skillRanks, distFromCity, selectedSkill, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                              setLastAction(result); onAction(result);
                            }}
                            className="flex-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-widest"
                            style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.3)", fontSize: "0.45rem" }}>
                            Use {FIELD_SKILLS[selectedSkill].name} (8h)
                          </button>
                        )}
                        <button onClick={() => {
                            const result = rollWorldLuck(currentHex, "rest", charStats, skillRanks, distFromCity, undefined, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                            setLastAction(result); onAction(result);
                          }}
                          disabled={save.food === 0 && save.current_hp >= save.max_hp}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,213,176,0.4)", border: "1px solid rgba(201,168,76,0.08)", fontSize: "0.45rem", opacity: save.food === 0 && save.current_hp >= save.max_hp ? 0.3 : 1 }}>
                          Rest (8h)
                        </button>
                        {save.parties && save.parties.length >= 1 && (() => {
                          const isAuto = !!activeParty?.auto_action;
                          return (
                            <button onClick={() => {
                                onSetAutoAction?.(save.active_party_index ?? 0, isAuto ? null : { type: "skill", skill: selectedSkill });
                              }}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: isAuto ? "rgba(251,146,60,0.25)" : "rgba(139,92,246,0.1)", color: isAuto ? "rgba(251,146,60,0.9)" : "rgba(139,92,246,0.8)", border: `1px solid ${isAuto ? "rgba(251,146,60,0.4)" : "rgba(139,92,246,0.2)"}`, fontSize: "0.45rem" }}>
                              {isAuto ? "Stop" : "Auto"}
                            </button>
                          );
                        })()}
                      </div>}
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
                        const canBuy = totalCp(save.coins) >= item.buyPrice;
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
                              {formatCoins(cpToCoins(item.buyPrice))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Money Changer — merchants take 5% */}
                    <button onClick={() => {
                        const total = totalCp(save.coins);
                        if (total <= 0) return;
                        const newCoins = exchangeUp(save.coins, 0.05);
                        const fee = total - totalCp(newCoins);
                        const result: WorldLuckResult = {
                          worldRoll: 0, skillRoll: 0, skillDC: 0,
                          interaction: "rest", outcome: "nothing",
                          description: `The jeweler exchanges your coin. ${formatCoins(save.coins)} → ${formatCoins(newCoins)} (5% fee).`,
                          hpChange: 0, goldChange: -fee, foodChange: 0, xpChange: 0,
                        };
                        setLastAction(result); onAction(result);
                      }}
                      disabled={save.coins.sp + save.coins.cp <= 0}
                      className="px-2 py-1.5 rounded text-xs font-bold mt-1"
                      style={{
                        background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.7)",
                        border: "1px solid rgba(251,191,36,0.2)", fontSize: "0.5rem",
                        opacity: save.coins.sp + save.coins.cp <= 0 ? 0.4 : 1,
                      }}>
                      {"\u{1F48E}"} Jeweler&apos;s Exchange (5% fee — consolidate coin)
                    </button>
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
                const blessingCost = { earth: 500, air: 500, water: 1000, sun: 1500 }[temple.id] ?? 500;
                const templeFactionId: Record<string, string> = { earth: "temple_earthmother", air: "temple_windcaller", water: "temple_tidewarden", sun: "temple_dawnfire" };
                const factionId = templeFactionId[temple.id];
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
                            if (totalCp(save.coins) >= blessingCost) {
                              const healAmt = save.max_hp - save.current_hp;
                              const result: WorldLuckResult = {
                                worldRoll: 0, skillRoll: 0, skillDC: 0,
                                interaction: "rest", outcome: "nothing",
                                description: `The priests tend to ${character?.name ?? "the leader"}'s wounds. Full HP restored.`,
                                hpChange: healAmt, goldChange: -blessingCost, foodChange: 0, xpChange: 0,
                              };
                              setLastAction(result); onAction(result);
                            }
                          }}
                          disabled={totalCp(save.coins) < blessingCost || save.current_hp >= save.max_hp}
                          className="px-2 py-1.5 rounded text-xs font-bold"
                          style={{
                            background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)",
                            border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.5rem",
                            opacity: totalCp(save.coins) < blessingCost || save.current_hp >= save.max_hp ? 0.4 : 1,
                          }}>
                          Healing Prayer ({formatCoins(cpToCoins(blessingCost))}) — Full HP
                        </button>
                        {/* Money Changer — temples take 10% but grant favor */}
                        <button onClick={() => {
                            const total = totalCp(save.coins);
                            if (total <= 0) return;
                            const newCoins = exchangeUp(save.coins, 0.10);
                            const fee = total - totalCp(newCoins);
                            const result: WorldLuckResult = {
                              worldRoll: 0, skillRoll: 0, skillDC: 0,
                              interaction: "rest", outcome: "nothing",
                              description: `The temple changes your coin. ${formatCoins(save.coins)} → ${formatCoins(newCoins)} (10% tithe).`,
                              hpChange: 0, goldChange: -fee, foodChange: 0, xpChange: 0,
                              factionRepChange: factionId ? { factionId, amount: Math.max(1, Math.floor(fee / 100)) } : undefined,
                            };
                            setLastAction(result); onAction(result);
                          }}
                          disabled={save.coins.sp + save.coins.cp <= 0}
                          className="px-2 py-1.5 rounded text-xs font-bold"
                          style={{
                            background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.7)",
                            border: "1px solid rgba(251,191,36,0.2)", fontSize: "0.5rem",
                            opacity: save.coins.sp + save.coins.cp <= 0 ? 0.4 : 1,
                          }}>
                          Money Changer (10% tithe — earns temple favor)
                        </button>
                        {/* Recruit Help — diplomacy check to find a temple follower */}
                        {factionId && (() => {
                          const rep = (save.faction_rep ?? {})[factionId] ?? 0;
                          const templates = FACTION_TEMPLATES.filter(t => t.factionId === factionId);
                          const chaScore = character?.stats.cha ?? 10;
                          const leaderHero = save.party.heroes.find(h => h.isLeader) ?? save.party.heroes[0];
                          const currentFollowers = leaderHero?.followers.filter(f => f.alive).length ?? 0;
                          const maxF = maxFollowers(chaScore);
                          const partyFull = currentFollowers >= maxF;
                          const dipRanks = save.skill_ranks?.diplomacy ?? 0;
                          const dc = rep >= 25 ? 15 : 20; // easier if Friendly+
                          return (
                            <button onClick={() => {
                                const roll = Math.floor(Math.random() * 20) + 1;
                                const chaMod = calcAbilityMod(chaScore);
                                const total = roll + chaMod + dipRanks;
                                if (total >= dc) {
                                  // Pick a random template from this temple
                                  const tmpl = templates[Math.floor(Math.random() * templates.length)];
                                  const follower = hireFollower(tmpl, undefined, rep);
                                  const result: WorldLuckResult = {
                                    worldRoll: 0, skillRoll: total, skillDC: dc,
                                    skillMod: chaMod + dipRanks, skillUsed: "Diplomacy",
                                    interaction: "rest", outcome: "nothing",
                                    description: `Diplomacy ${total} vs DC ${dc} — Success! ${follower.name} the ${tmpl.name} agrees to join ${save.faction_name ?? "your cause"}.`,
                                    hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 25,
                                    newFollower: follower,
                                    factionRepChange: { factionId, amount: 1 },
                                  };
                                  setLastAction(result); onAction(result);
                                } else {
                                  const result: WorldLuckResult = {
                                    worldRoll: 0, skillRoll: total, skillDC: dc,
                                    skillMod: chaMod + dipRanks, skillUsed: "Diplomacy",
                                    interaction: "rest", outcome: "nothing",
                                    description: `Diplomacy ${total} vs DC ${dc} — No one at the temple is willing to join ${save.faction_name ?? "your company"} right now. Try improving your standing.`,
                                    hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 10,
                                  };
                                  setLastAction(result); onAction(result);
                                }
                              }}
                              disabled={partyFull || templates.length === 0}
                              className="px-2 py-1.5 rounded text-xs font-bold"
                              style={{
                                background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.8)",
                                border: "1px solid rgba(96,165,250,0.2)", fontSize: "0.5rem",
                                opacity: partyFull || templates.length === 0 ? 0.4 : 1,
                              }}>
                              Recruit Help (Diplomacy DC {dc}){partyFull ? " — Party Full" : ""}
                            </button>
                          );
                        })()}
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
                          <button onClick={() => onPowerUp?.()}
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

              // ── High District (gated — requires pass) ──
              if (cityDistrict === "high") {
                const hasPass = save.inventory.some(i => i.id === "high_district_pass");

                if (!hasPass) {
                  return (
                    <div className="mt-2 flex flex-col gap-1">
                      <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                        style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                        ← Back to Districts
                      </button>
                      <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                        {"\u{1F451}"} High District — GATED
                      </div>
                      <div className="px-2 py-2 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
                        <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.7)" }}>
                          A guard blocks the gate. &quot;No pass, no entry. Passes are granted by the nobility for services rendered, or so I hear, certain vendors around the island deal in... unofficial ones.&quot;
                        </div>
                        <div className="mt-1" style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.4)" }}>
                          Earn a High District Pass by completing favors for nobles, or find a shady vendor willing to sell one.
                          Try speaking with locals or searching thoroughly across the island.
                        </div>
                      </div>
                    </div>
                  );
                }

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
                        disabled={totalCp(save.coins) < luxuryCost}
                        className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{ background: "rgba(201,168,76,0.15)", color: "rgba(201,168,76,0.9)", border: "1px solid rgba(201,168,76,0.4)", opacity: totalCp(save.coins) < luxuryCost ? 0.4 : 1 }}>
                        Luxury Inn (8h, {formatCoins(cpToCoins(luxuryCost))}) — Safe, extra healing
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

              // ── Low District (common inn, artisan workshops, tavern) ──
              if (cityDistrict === "low") {
                // Artisan workshops — each sells a few basic items below market price
                // Helper: create a cheap artisan ware as a proper ShopItem
                // Helper: artisan ware as ShopItem. Price is in COPPER PIECES.
                const aw = (id: string, name: string, buyCp: number, cat: ShopItem["category"], wt: number): ShopItem => ({
                  id, name, category: cat, value: buyCp / 100, weight: wt, description: "",
                  buyPrice: buyCp, sellPrice: Math.max(0, Math.floor(buyCp / 2)),
                });
                const ARTISANS: { id: string; name: string; emoji: string; location: string; desc: string; chaDC: number; wares: ShopItem[] }[] = [
                  { id: "smithy",      name: "Blacksmith",      emoji: "\u{1F525}", location: "smithy",        desc: "Anvil, forge, and quenching trough. Best for metal weapons and armor.",     chaDC: 12, wares: [
                    aw("shop_dagger",        "Dagger",        150, "weapon", 1),   // PHB 2gp, artisan 1g5s
                    aw("shop_light_hammer",  "Light Hammer",   80, "weapon", 2),   // PHB 1gp, artisan 8s
                    aw("shop_iron_pot",      "Iron Pot",       50, "gear",   3),   // artisan 5s
                    aw("shop_pitons",        "Pitons (10)",    80, "gear",   5),   // PHB 1gp, artisan 8s
                  ]},
                  { id: "carpentry",   name: "Carpenter",       emoji: "\u{1FAB5}", location: "workshop",      desc: "Sturdy workbench with saws, planes, and chisels. Bows, shafts, shields.",  chaDC: 10, wares: [
                    aw("shop_club",          "Club",            5, "weapon", 3),   // offcuts, 5cp
                    aw("shop_quarterstaff",  "Quarterstaff",   20, "weapon", 4),   // artisan 2s
                    aw("shop_wood_shield",   "Light Wooden Shield", 250, "armor", 5), // PHB 3gp, artisan 2g5s
                    aw("shop_pole",          "10-ft Pole",     15, "gear",   8),   // artisan 1s5c
                  ]},
                  { id: "tannery",     name: "Tanner",          emoji: "\u{1F9F4}", location: "workshop",      desc: "Stretching frames and curing vats. Leather armor, bags, and straps.",      chaDC: 10, wares: [
                    aw("shop_leather",       "Leather Armor", 800, "armor",  15),  // PHB 10gp, artisan 8gp
                    aw("shop_waterskin",     "Waterskin",      80, "gear",    4),   // artisan 8s
                    aw("shop_belt_pouch",    "Belt Pouch",     80, "gear",    0),   // artisan 8s
                    aw("shop_sling",         "Sling",          10, "weapon",  0),   // leather scraps, 1s
                  ]},
                  { id: "alch_bench",  name: "Alchemist Bench", emoji: "\u2697\uFE0F", location: "alchemist_lab", desc: "Glassware, burners, and distillation flasks. Potions and compounds.",   chaDC: 14, wares: [
                    aw("shop_torch_5",       "Torches (5)",     5, "gear",        5),  // 5cp (tallow scraps)
                    aw("shop_tindertwigs",   "Tindertwigs (5)", 400, "alchemical", 0), // PHB 5gp, artisan 4gp
                    aw("shop_smokestick",    "Smokestick",    1600, "alchemical",  0), // PHB 20gp, artisan 16gp
                    aw("shop_antitoxin",     "Antitoxin",     4000, "alchemical",  0), // PHB 50gp, artisan 40gp
                  ]},
                  { id: "kitchen",     name: "Common Kitchen",  emoji: "\u{1F372}", location: "workshop",     desc: "Fire pit, pots, and a cutting board. Cook meals and dry rations.",         chaDC: 8, wares: [
                    aw("shop_rations_1",     "Trail Rations (1 day)",  40, "consumable", 1),  // PHB 5sp, artisan 4s
                    aw("shop_rations_7",     "Trail Rations (7 days)", 250, "consumable", 7), // bulk 2g5s
                    aw("shop_waterskin_k",   "Waterskin",              80, "gear",       4),  // artisan 8s
                  ]},
                ];

                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <button onClick={() => setCityDistrict(null)} className="self-start px-2 py-0.5 rounded text-xs"
                      style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
                      ← Back to Districts
                    </button>
                    <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
                      {"\u{1F3DA}\uFE0F"} Low District
                    </div>

                    {/* Common Inn */}
                    <button onClick={() => {
                        const result: WorldLuckResult = {
                          worldRoll: 0, skillRoll: 0, skillDC: 0,
                          interaction: "rest", outcome: "nothing",
                          description: `A raised bed by the hearth at the common inn. Chicken stew and watered ale restore ${healPerDay} HP.`,
                          hpChange: healPerDay, goldChange: -commonCost, foodChange: 0, xpChange: 0,
                        };
                        setLastAction(result); onAction(result);
                      }}
                      disabled={totalCp(save.coins) < commonCost}
                      className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                      style={{ background: "rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.9)", border: "1px solid rgba(96,165,250,0.3)", opacity: totalCp(save.coins) < commonCost ? 0.4 : 1 }}>
                      Common Inn (1d, {formatCoins(cpToCoins(commonCost))}) — Safe
                    </button>

                    {/* Look for Work */}
                    <button onClick={() => {
                        const wRoll = Math.floor(Math.random() * 20) + 1;
                        const perfRanks = skillRanks["perform"] ?? 0;
                        const diploRanks = skillRanks["diplomacy"] ?? 0;
                        const sRoll = Math.floor(Math.random() * 20) + 1 + calcAbilityMod(charStats.cha ?? 10) + diploRanks;
                        const combined = wRoll + sRoll + Math.floor((save.fame ?? 0) / 25);
                        const leaderH = save.party.heroes.find(h => h.isLeader) ?? save.party.heroes[0];
                        const isBard = leaderH?.progression
                          ? leaderH.progression.class_levels.some(cl => cl.class_id === "bard")
                          : save.class_id === "bard";
                        const isKardovHere = currentHex.name?.includes("Kardov");
                        const qFlags = save.quest_flags ?? {};
                        const qCooldowns = save.quest_cooldowns ?? {};

                        // ── Tavern Quest Board ──────────────────────────────────
                        // Repeatable quests (cooldown) — available if not on cooldown
                        // One-time rumors — available if not already done (quest_flags)
                        // Higher combined → better quests offered

                        // Repeatable quests pool (cooldown-gated)
                        type TavernQuest = { id: string; minCombined: number; cooldownMin: number; desc: string };
                        const repeatableQuests: TavernQuest[] = [
                          { id: "tavern_rats", minCombined: 0, cooldownMin: 60,
                            desc: `The innkeeper sighs. "Rats again. Cellar's overrun. I'll pay you to clear them out."` },
                          { id: "tavern_pests", minCombined: 18, cooldownMin: 120,
                            desc: `A warehouse owner slams his fist on the bar. "Giant spiders in my storeroom! Eating the grain sacks! Someone deal with this!"` },
                          { id: "tavern_thugs", minCombined: 22, cooldownMin: 180,
                            desc: `A worried merchant pulls you aside. "Thugs have been shaking down shops on my street. Run them off and I'll make it worth your while."` },
                          { id: "tavern_undead", minCombined: 28, cooldownMin: 360,
                            desc: `A pale-faced gravedigger whispers over his ale. "Something's moving in the old crypt. Skeletons, I tell you. The watch won't go near it."` },
                          { id: "tavern_wolves", minCombined: 24, cooldownMin: 240,
                            desc: `A farmer at the bar pleads for help. "Wolves have been killing our livestock every night. We tracked the pack to a den outside the walls."` },
                        ];

                        // One-time rumor quests (flag-gated)
                        type RumorQuest = { id: string; flag: string; minCombined: number; desc: string };
                        const rumorQuests: RumorQuest[] = [
                          { id: "rumor_smugglers", flag: "heard_smuggler_rumor", minCombined: 26,
                            desc: `A drunk sailor leans in. "There's a smuggler's cave under the docks. They move stolen goods at night. Nobody talks about it but everyone knows."` },
                          { id: "rumor_haunted_manor", flag: "heard_manor_rumor", minCombined: 30,
                            desc: `An old woman clutches your arm. "The abandoned manor on the hill — people hear screaming at night. My grandson went to look. He never came back."` },
                          { id: "rumor_cultists", flag: "heard_cultist_rumor", minCombined: 32,
                            desc: `A hooded figure whispers from the corner booth. "The Shadow Temple is recruiting. They meet in the sewers beneath the market. People go in and don't come out."` },
                          { id: "rumor_bounty", flag: "heard_bounty_rumor", minCombined: 20,
                            desc: `A retired guard shows you a crumpled notice. "There's a bounty on a gnoll raider harassing caravans on the King's Road. Fifty gold, dead or alive."` },
                          { id: "rumor_lost_caravan", flag: "heard_caravan_rumor", minCombined: 24,
                            desc: `A weeping merchant tells anyone who'll listen: "My partner's caravan vanished on the road three days ago. All hands, cargo, everything. Please, find them."` },
                        ];

                        // Filter available quests
                        const availRepeatable = repeatableQuests.filter(q =>
                          combined >= q.minCombined && !isQuestOnCooldown(qCooldowns, q.id));
                        const availRumors = rumorQuests.filter(q =>
                          combined >= q.minCombined && !qFlags[q.flag]);

                        // Roll for what you hear: quests first (30% chance if available), then bard gig, then normal work
                        const questRoll = Math.random();
                        const offerRumor = availRumors.length > 0 && questRoll < 0.15;
                        const offerRepeatable = !offerRumor && availRepeatable.length > 0 && questRoll < 0.35;

                        let result: WorldLuckResult;

                        if (offerRumor) {
                          // One-time rumor — mysterious lead
                          const rumor = availRumors[Math.floor(Math.random() * availRumors.length)];
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: rumor.minCombined,
                            interaction: "skill", outcome: "find_quest",
                            description: rumor.desc,
                            hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 5,
                          };
                        } else if (offerRepeatable) {
                          // Repeatable job posting
                          const quest = availRepeatable[Math.floor(Math.random() * availRepeatable.length)];
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: quest.minCombined,
                            interaction: "skill", outcome: "find_quest",
                            description: quest.desc,
                            hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 3,
                          };
                        } else if (isBard && (isKardovHere ? Math.random() < 0.2 && combined >= 32 : Math.random() < 0.5)) {
                          // Bard gig — Kardov's pays double, more fame
                          const days = Math.floor(Math.random() * 3) + 2;
                          const payPerDay = isKardovHere ? nd(2, 6) * 10 : nd(1, 6) * 10;
                          const totalSp = payPerDay * days;
                          const coins: Coins = { gp: Math.floor(totalSp / 10), sp: totalSp % 10, cp: 0 };
                          const fameGain = isKardovHere ? days * 2 : Math.ceil(days / 2);
                          const perfCheck = Math.floor(Math.random() * 20) + 1 + calcAbilityMod(charStats.cha ?? 10) + perfRanks;
                          result = {
                            worldRoll: wRoll, skillRoll: isKardovHere ? perfCheck : sRoll,
                            skillUsed: "Perform", skillDC: isKardovHere ? 32 : 0,
                            interaction: "skill", outcome: "find_coins",
                            description: pick(isKardovHere ? [
                              `"You want to play the Gate stage? Bold. ${days} nights, ${formatCoins(coins)}, room and board. Don't embarrass us."`,
                              `"A bard who can handle the Kardov's crowd? ${days} nights, ${formatCoins(coins)}. This is the big leagues."`,
                              `"We had a cancellation. ${days} nights on the main stage, ${formatCoins(coins)} plus meals."`,
                            ] : [
                              `"You play? We could use entertainment for ${days} days. ${formatCoins(coins)} and food."`,
                              `"A bard! Play for us at suppertime. ${days} days, ${formatCoins(coins)}, and you eat with us."`,
                              `The tavern keeper grins. "Live music! ${days} nights, ${formatCoins(coins)}, meals on the house."`,
                            ]),
                            hpChange: 0, goldChange: 0, coinReward: coins, foodChange: days, xpChange: days * 3,
                            fameChange: fameGain,
                          };
                        } else if (isBard && isKardovHere && Math.random() < 0.3) {
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: 32,
                            interaction: "skill", outcome: "nothing",
                            description: pick([
                              `"The stage? Ha. You're not ready for Kardov's Gate. Try busking on the streets first."`,
                              `"We book professionals, friend. Come back when you've got fame behind you."`,
                              `"No openings on the stage. Play the common room for tips if you like."`,
                            ]),
                            hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
                          };
                        } else if (combined >= 28) {
                          const payCp = isKardovHere ? nd(2, 6) * 10 + 50 : nd(1, 8) * 10 + 30;
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: 28,
                            interaction: "skill", outcome: "find_coins",
                            description: pick([
                              `"You look capable. Help me load cargo and I'll pay well." Honest work for ${formatCoins(cpToCoins(payCp))}.`,
                              `The innkeeper needs a bouncer tonight. "Keep the drunks in line. ${formatCoins(cpToCoins(payCp))} and a meal."`,
                              `A merchant hires you to guard a delivery within the city. ${formatCoins(cpToCoins(payCp))} for a few hours' work.`,
                            ]),
                            hpChange: 0, goldChange: payCp, foodChange: 1, xpChange: 3,
                          };
                        } else if (combined >= 20) {
                          const payCp = isKardovHere ? nd(1, 6) * 10 + 20 : nd(1, 4) * 10 + 10;
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: 20,
                            interaction: "skill", outcome: "find_coins",
                            description: pick([
                              `"Dishes need washing. ${formatCoins(cpToCoins(payCp))} and leftover stew." Not glamorous, but honest.`,
                              `You help the innkeeper haul barrels from the cellar. ${formatCoins(cpToCoins(payCp))} and a hot meal.`,
                              `"Sweep the floors and clean the rooms. ${formatCoins(cpToCoins(payCp))} and you can sleep in the common room."`,
                            ]),
                            hpChange: 0, goldChange: payCp, foodChange: 1, xpChange: 2,
                          };
                        } else {
                          result = {
                            worldRoll: wRoll, skillRoll: sRoll, skillUsed: "Diplomacy", skillDC: 20,
                            interaction: "skill", outcome: "nothing",
                            description: pick([
                              `"Nothing today. Try again tomorrow." The innkeeper shrugs.`,
                              `"We're fully staffed. Ask around the docks, maybe." No luck here.`,
                              `You ask around but nobody's hiring right now.`,
                            ]),
                            hpChange: 0, goldChange: 0, foodChange: 0, xpChange: 0,
                          };
                        }
                        setLastAction(result); onAction(result);
                      }}
                      className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                      style={{ background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.8)", border: "1px solid rgba(251,191,36,0.2)" }}>
                      Look for Work (8h){((save.party.heroes.find(h => h.isLeader) ?? save.party.heroes[0])?.progression?.class_levels.some(cl => cl.class_id === "bard") ?? save.class_id === "bard") ? " — Bard may get a gig!" : ""}
                    </button>

                    {/* Artisan Workshops */}
                    <div style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.08em", marginTop: 4 }} className="font-bold uppercase">
                      Artisan Workshops
                    </div>
                    <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.25)", marginBottom: 2 }}>
                      Convince an artisan to let you use their workstation (CHA check). Fail and they&apos;ll ask you to do a task first.
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {ARTISANS.map(a => {
                        const chaScore = charStats.cha ?? 10;
                        const chaRanks = skillRanks["diplomacy"] ?? 0;
                        return (
                          <div key={a.id} className="px-2 py-1 rounded"
                            style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.08)" }}>
                            {/* Header row */}
                            <div className="flex items-center gap-1">
                              <span style={{ fontSize: "0.5rem" }}>{a.emoji}</span>
                              <span className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.45rem" }}>{a.name}</span>
                              <button onClick={() => {
                                  const d20 = Math.floor(Math.random() * 20) + 1;
                                  const chaCheck = d20 + calcAbilityMod(chaScore) + chaRanks;
                                  const passed = chaCheck >= a.chaDC;
                                  const result: WorldLuckResult = {
                                    worldRoll: 0, skillRoll: chaCheck, skillUsed: "Diplomacy", skillDC: a.chaDC,
                                    interaction: "skill", outcome: passed ? "nothing" : "find_quest",
                                    description: passed
                                      ? `The ${a.name.toLowerCase()} nods approvingly. "Aye, you seem the capable sort. Use the ${a.id === "smithy" ? "forge" : "bench"} as long as you need." You have access to the ${a.name} workshop.`
                                      : `The ${a.name.toLowerCase()} eyes you skeptically. "I don't let just anyone touch my tools. Tell you what — do something for me first, and we'll talk." A task has been offered.`,
                                    hpChange: 0, goldChange: 0, foodChange: 0, xpChange: passed ? 2 : 5,
                                  };
                                  setLastAction(result); onAction(result);
                                }}
                                className="ml-auto px-1.5 py-0.5 rounded hover:bg-white/5 transition-all"
                                style={{ fontSize: "0.35rem", color: "rgba(96,165,250,0.6)", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)" }}>
                                Use Workshop (DC {a.chaDC})
                              </button>
                            </div>
                            <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.3)", marginTop: 1 }}>{a.desc}</div>

                            {/* Artisan wares — cheap items for sale */}
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                              {a.wares.map(w => {
                                const canBuy = totalCp(save.coins) >= w.buyPrice;
                                return (
                                  <button key={w.id} onClick={() => { if (canBuy) onBuyItem(w); }}
                                    disabled={!canBuy}
                                    className="flex items-center gap-1 px-1 py-0.5 rounded transition-all hover:bg-white/5"
                                    style={{
                                      background: canBuy ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.01)",
                                      border: `1px solid ${canBuy ? "rgba(74,222,128,0.1)" : "rgba(201,168,76,0.04)"}`,
                                      opacity: canBuy ? 1 : 0.4,
                                    }}>
                                    <span style={{ fontSize: "0.33rem", color: "rgba(232,213,176,0.55)" }}>{w.name}</span>
                                    <span style={{ fontSize: "0.33rem", color: canBuy ? "rgba(74,222,128,0.7)" : "rgba(232,213,176,0.2)", fontWeight: 700 }}>
                                      {w.buyPrice === 0 ? "Free" : formatCoins(cpToCoins(w.buyPrice))}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Exhaustion warning (town) */}
                    {exhPts > 0 && (() => {
                      const minStat = character ? lowestExhaustedStat(charStats, exhPts) : 10 - exhPts;
                      const critical = minStat <= 2;
                      return (
                        <div className="mt-1 px-2 py-1 rounded" style={{
                          background: critical ? "rgba(220,38,38,0.2)" : "rgba(251,191,36,0.08)",
                          border: `1px solid ${critical ? "rgba(220,38,38,0.4)" : "rgba(251,191,36,0.2)"}`,
                          fontSize: "0.45rem", color: critical ? "rgba(220,38,38,0.9)" : "rgba(251,191,36,0.8)",
                        }}>
                          Exhaustion {exhPts} — all stats -{exhPts}
                          {exhaustion.sleepPoints > 0 && <> ({exhaustion.sleepPoints} sleep)</>}
                          {exhaustion.hungerPoints > 0 && <> ({exhaustion.hungerPoints} hunger)</>}
                          {critical ? " — REST NOW or you will collapse!" : ""}
                        </div>
                      );
                    })()}
                    {/* Street actions */}
                    <div className="flex gap-1 mt-1">
                      {(
                        <button onClick={() => {
                            const result = rollWorldLuck(currentHex, "skill", charStats, skillRanks, distFromCity, selectedSkill, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                            setLastAction(result); onAction(result);
                          }}
                          className="flex-1 px-2 py-1 rounded text-xs font-bold"
                          style={{ background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.7)", border: "1px solid rgba(251,191,36,0.15)", fontSize: "0.45rem" }}>
                          {FIELD_SKILLS[selectedSkill].emoji} {FIELD_SKILLS[selectedSkill].name} (8h)
                        </button>
                      )}
                      <button onClick={() => {
                          const result = rollWorldLuck(currentHex, "rest", charStats, skillRanks, distFromCity, undefined, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                          setLastAction(result); onAction(result);
                        }}
                        disabled={save.food === 0 && save.current_hp >= save.max_hp}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(232,213,176,0.5)", border: "1px solid rgba(201,168,76,0.08)", fontSize: "0.45rem", opacity: save.food === 0 && save.current_hp >= save.max_hp ? 0.3 : 1 }}>
                        Street Rest (free)
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
                {/* Exhaustion warning (wilderness) */}
                {exhPts > 0 && (() => {
                  const minStat = character ? lowestExhaustedStat(charStats, exhPts) : 10 - exhPts;
                  const critical = minStat <= 2;
                  return (
                    <div className="px-2 py-1 rounded" style={{
                      background: critical ? "rgba(220,38,38,0.2)" : "rgba(251,191,36,0.08)",
                      border: `1px solid ${critical ? "rgba(220,38,38,0.4)" : "rgba(251,191,36,0.2)"}`,
                      fontSize: "0.45rem", color: critical ? "rgba(220,38,38,0.9)" : "rgba(251,191,36,0.8)",
                    }}>
                      Exhaustion {exhPts} — all stats -{exhPts}
                      {exhaustion.sleepPoints > 0 && <> ({exhaustion.sleepPoints} sleep)</>}
                      {exhaustion.hungerPoints > 0 && <> ({exhaustion.hungerPoints} hunger)</>}
                      {critical ? " — REST NOW or you will collapse!" : ""}
                    </div>
                  );
                })()}
                {/* Skill picker grid */}
                {(
                  <div className="flex flex-wrap gap-0.5">
                    {Object.values(FIELD_SKILLS).map(fs => (
                      <button key={fs.id} onClick={() => setSelectedSkill(fs.id as FieldSkillId)}
                        className="px-1.5 py-0.5 rounded transition-all"
                        title={fs.desc}
                        style={{
                          background: selectedSkill === fs.id ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.03)",
                          color: selectedSkill === fs.id ? "rgba(251,191,36,0.9)" : "rgba(232,213,176,0.4)",
                          border: `1px solid ${selectedSkill === fs.id ? "rgba(251,191,36,0.4)" : "rgba(201,168,76,0.08)"}`,
                          fontSize: "0.4rem",
                        }}>
                        {fs.emoji} {fs.name}
                      </button>
                    ))}
                  </div>
                )}
                {(
                  <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.3)" }}>
                    {FIELD_SKILLS[selectedSkill].desc}
                  </div>
                )}
                {fightBlocking && (
                  <div className="px-2 py-1.5 rounded text-center" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.45rem", color: "rgba(220,38,38,0.7)" }}>
                    Resolve the encounter first!
                  </div>
                )}
                {!fightBlocking && <div className="flex gap-1">
                  {(
                    <button
                      onClick={() => {
                        const result = rollWorldLuck(currentHex, "skill", charStats, skillRanks, distFromCity, selectedSkill, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                        setLastAction(result);
                        onAction(result);
                      }}
                      className="flex-1 px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                      style={{
                        background: "rgba(251,191,36,0.15)",
                        color: "rgba(251,191,36,0.9)",
                        border: "1px solid rgba(251,191,36,0.3)",
                      }}>
                      {FIELD_SKILLS[selectedSkill].emoji} {FIELD_SKILLS[selectedSkill].name} (8h)
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const result = rollWorldLuck(currentHex, "rest", charStats, skillRanks, distFromCity, undefined, heroCount, save.fame ?? 0, exhPts, save.feats, character?.name, save.faction_name);
                      setLastAction(result);
                      onAction(result);
                    }}
                    disabled={(currentHex.type === "water" || (save.food === 0 && save.current_hp >= save.max_hp))}
                    className="px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                    style={{ background: "rgba(96,165,250,0.15)", color: "rgba(96,165,250,0.9)", border: "1px solid rgba(96,165,250,0.3)", opacity: currentHex.type === "water" || (save.food === 0 && save.current_hp >= save.max_hp) ? 0.4 : 1 }}>
                    Rest (8h)
                  </button>
                  {save.parties && save.parties.length >= 1 && (() => {
                    const isAuto = !!activeParty?.auto_action;
                    return (
                      <button
                        onClick={() => {
                          onSetAutoAction?.(save.active_party_index ?? 0, isAuto ? null : { type: "skill", skill: selectedSkill });
                        }}
                        className="px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{ background: isAuto ? "rgba(251,146,60,0.2)" : "rgba(139,92,246,0.15)", color: isAuto ? "rgba(251,146,60,0.9)" : "rgba(139,92,246,0.9)", border: `1px solid ${isAuto ? "rgba(251,146,60,0.4)" : "rgba(139,92,246,0.3)"}` }}>
                        {isAuto ? "Stop" : "Auto"}
                      </button>
                    );
                  })()}
                </div>}
                {currentHex.type === "water" && (
                  <div style={{ fontSize: "0.45rem", color: "rgba(220,38,38,0.6)" }}>
                    Can&apos;t rest on water without a boat
                  </div>
                )}
                {/* Location-specific dungeon quests */}
                {currentHex.name === "Goblin Hills" && (() => {
                  const goblinCooldownDays = 60;
                  const cooldownKey = "goblin_hills_raid";
                  const currentDay = Math.floor((save.hour ?? 0) / 24) + 1;
                  const onCooldown = isQuestOnDayCooldown(save.quest_cooldowns ?? {}, cooldownKey, currentDay);
                  const daysLeft = dayCooldownRemaining(save.quest_cooldowns ?? {}, cooldownKey, currentDay);
                  return (
                    <div className="mt-1">
                      <button onClick={() => {
                          const goblin = MONSTERS.find(m => m.id === "goblin");
                          const hobgoblin = MONSTERS.find(m => m.id === "hobgoblin");
                          if (!goblin) return;
                          const gobCount = Math.floor(Math.random() * 4) + 3 + save.level;
                          const enemies: EnemySpec[] = Array.from({ length: gobCount }, (_, i) => {
                            if (i === 0 && hobgoblin) return { ...createMonsterSpec(hobgoblin, "\u2694\uFE0F"), name: "Goblin Warchief" };
                            return createMonsterSpec(goblin, "\uD83D\uDC7A");
                          });
                          const quest: QuestEncounter = {
                            questId: cooldownKey,
                            questName: "Goblin Hills Raid",
                            enemies,
                            difficulty: "medium",
                          };
                          onQuestBattle(quest);
                        }}
                        disabled={onCooldown}
                        className="w-full px-2 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{
                          background: onCooldown ? "rgba(220,38,38,0.05)" : "rgba(220,38,38,0.15)",
                          color: onCooldown ? "rgba(220,38,38,0.4)" : "rgba(220,38,38,0.9)",
                          border: `1px solid ${onCooldown ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.4)"}`,
                        }}>
                        {onCooldown
                          ? `Goblin Hills — Cleared (${daysLeft}d until goblins return)`
                          : "Raid the Goblin Hills"}
                      </button>
                      <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.3)", marginTop: 2 }}>
                        Goblins raid from these hills. Clear them out to protect the city. Resets every {goblinCooldownDays} days.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>

          {/* ── Party Exchange — when 2+ parties share a hex ── */}
          {(() => {
            if (!save.parties || save.parties.length < 2) return null;
            const activeIdx = save.active_party_index ?? 0;
            const active = save.parties[activeIdx];
            const collocated = save.parties
              .map((p, i) => ({ party: p, index: i }))
              .filter(({ party: p, index: i }) => i !== activeIdx && p.map_hex.q === active.map_hex.q && p.map_hex.r === active.map_hex.r);
            if (collocated.length === 0) return null;

            return collocated.map(({ party: other, index: otherIdx }) => {
              const otherNft = characters?.find(c => c.contractAddress.toLowerCase() === other.heroes[0]?.nft_address);
              const activeFollowers = active.heroes.flatMap(h => h.followers.filter(f => f.alive));
              const otherFollowers = other.heroes.flatMap(h => h.followers.filter(f => f.alive));
              const otherCoins = other.coins ?? { gp: 0, sp: 0, cp: 0 };
              const otherFood = other.food ?? 0;

              function doTransfer(type: "coin" | "food" | "follower", amount: number, followerId?: string) {
                if (!save.parties || !onExchange) return;
                const parties = [...save.parties];
                let coins = { ...save.coins };
                let food = save.food;

                if (type === "coin") {
                  // amount > 0 = give TO other, < 0 = take FROM other
                  const oc = parties[otherIdx].coins ?? { gp: 0, sp: 0, cp: 0 };
                  if (amount > 0) {
                    const total = coins.gp * 100 + coins.sp * 10 + coins.cp;
                    if (total < amount) return;
                    // Subtract from active (smallest first)
                    let rem = amount;
                    let cp = coins.cp; let sp = coins.sp; let gp = coins.gp;
                    const fromCp = Math.min(cp, rem); cp -= fromCp; rem -= fromCp;
                    const fromSp10 = Math.min(sp * 10, rem); sp -= Math.ceil(fromSp10 / 10); rem -= fromSp10;
                    if (rem > 0) { gp -= Math.ceil(rem / 100); }
                    coins = { gp: Math.max(0, gp), sp: Math.max(0, sp), cp: Math.max(0, cp) };
                    // Add to other as mixed denominations
                    const addGp = Math.floor(amount / 100);
                    const addSp = Math.floor((amount % 100) / 10);
                    const addCp = amount % 10;
                    parties[otherIdx] = { ...parties[otherIdx], coins: { gp: oc.gp + addGp, sp: oc.sp + addSp, cp: oc.cp + addCp } };
                  } else {
                    const take = -amount;
                    const otherTotal = oc.gp * 100 + oc.sp * 10 + oc.cp;
                    if (otherTotal < take) return;
                    let rem = take;
                    let cp = oc.cp; let sp = oc.sp; let gp = oc.gp;
                    const fromCp = Math.min(cp, rem); cp -= fromCp; rem -= fromCp;
                    const fromSp10 = Math.min(sp * 10, rem); sp -= Math.ceil(fromSp10 / 10); rem -= fromSp10;
                    if (rem > 0) { gp -= Math.ceil(rem / 100); }
                    parties[otherIdx] = { ...parties[otherIdx], coins: { gp: Math.max(0, gp), sp: Math.max(0, sp), cp: Math.max(0, cp) } };
                    const addGp = Math.floor(take / 100);
                    const addSp = Math.floor((take % 100) / 10);
                    const addCp = take % 10;
                    coins = { gp: coins.gp + addGp, sp: coins.sp + addSp, cp: coins.cp + addCp };
                  }
                } else if (type === "food") {
                  const of = parties[otherIdx].food ?? 0;
                  if (amount > 0) {
                    if (food < amount) return;
                    food -= amount;
                    parties[otherIdx] = { ...parties[otherIdx], food: of + amount };
                  } else {
                    const take = -amount;
                    if (of < take) return;
                    parties[otherIdx] = { ...parties[otherIdx], food: of - take };
                    food += take;
                  }
                } else if (type === "follower" && followerId) {
                  // Move follower from active → other (amount > 0) or other → active (amount < 0)
                  if (amount > 0) {
                    let found: typeof activeFollowers[0] | null = null;
                    const newActiveHeroes = active.heroes.map(h => ({
                      ...h,
                      followers: h.followers.filter(f => {
                        if (!found && f.id === followerId) { found = f; return false; }
                        return true;
                      }),
                    }));
                    if (!found) return;
                    const newOtherHeroes = other.heroes.map((h, i) =>
                      i === 0 ? { ...h, followers: [...h.followers, found!] } : h
                    );
                    parties[activeIdx] = { ...parties[activeIdx], heroes: newActiveHeroes };
                    parties[otherIdx] = { ...parties[otherIdx], heroes: newOtherHeroes };
                  } else {
                    let found: typeof otherFollowers[0] | null = null;
                    const newOtherHeroes = other.heroes.map(h => ({
                      ...h,
                      followers: h.followers.filter(f => {
                        if (!found && f.id === followerId) { found = f; return false; }
                        return true;
                      }),
                    }));
                    if (!found) return;
                    const newActiveHeroes = active.heroes.map((h, i) =>
                      i === 0 ? { ...h, followers: [...h.followers, found!] } : h
                    );
                    parties[activeIdx] = { ...parties[activeIdx], heroes: newActiveHeroes };
                    parties[otherIdx] = { ...parties[otherIdx], heroes: newOtherHeroes };
                  }
                }
                // Also stash active party's updated coins/food back
                parties[activeIdx] = { ...parties[activeIdx], coins, food };
                onExchange(parties, coins, food);
              }

              return (
                <div key={other.id} className="px-3 py-2 rounded-lg flex flex-col gap-2"
                  style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.25)" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "0.55rem", color: "rgba(74,222,128,0.9)" }} className="font-black uppercase tracking-widest">
                      Exchange with {other.name}
                    </span>
                    {otherNft?.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={otherNft.imageUrl} alt="" className="rounded-full" style={{ width: 18, height: 18, objectFit: "cover" }} />
                    )}
                  </div>

                  {/* Coins */}
                  <div className="flex items-center justify-between gap-1" style={{ fontSize: "0.55rem" }}>
                    <span style={{ color: "rgba(201,168,76,0.7)" }}>{"\u{1FA99}"} You: {formatCoins(save.coins)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => doTransfer("coin", 10)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.45rem" }}>
                        Give 1s
                      </button>
                      <button onClick={() => doTransfer("coin", 100)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.45rem" }}>
                        Give 1g
                      </button>
                      <button onClick={() => doTransfer("coin", -10)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.45rem" }}>
                        Take 1s
                      </button>
                      <button onClick={() => doTransfer("coin", -100)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.45rem" }}>
                        Take 1g
                      </button>
                    </div>
                    <span style={{ color: "rgba(201,168,76,0.5)" }}>Them: {formatCoins(otherCoins)}</span>
                  </div>

                  {/* Food */}
                  <div className="flex items-center justify-between gap-1" style={{ fontSize: "0.55rem" }}>
                    <span style={{ color: "rgba(232,213,176,0.7)" }}>{"\u{1F356}"} You: {save.food}</span>
                    <div className="flex gap-1">
                      <button onClick={() => doTransfer("food", 1)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.45rem" }}>
                        Give 1
                      </button>
                      <button onClick={() => doTransfer("food", 3)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.45rem" }}>
                        Give 3
                      </button>
                      <button onClick={() => doTransfer("food", -1)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.45rem" }}>
                        Take 1
                      </button>
                      <button onClick={() => doTransfer("food", -3)} className="px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.45rem" }}>
                        Take 3
                      </button>
                    </div>
                    <span style={{ color: "rgba(232,213,176,0.5)" }}>Them: {otherFood}</span>
                  </div>

                  {/* Guards / Followers */}
                  {(activeFollowers.length > 0 || otherFollowers.length > 0) && (
                    <div style={{ fontSize: "0.55rem" }}>
                      <span className="font-bold uppercase tracking-widest" style={{ color: "rgba(201,168,76,0.6)", fontSize: "0.45rem" }}>Guards</span>
                      {activeFollowers.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span style={{ color: "rgba(96,165,250,0.5)", fontSize: "0.4rem" }}>YOUR PARTY</span>
                          {activeFollowers.map(f => (
                            <div key={f.id} className="flex items-center justify-between px-1 py-0.5 rounded"
                              style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.1)" }}>
                              <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.name} (Lv{f.level})</span>
                              <button onClick={() => doTransfer("follower", 1, f.id)} className="px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.2)", fontSize: "0.4rem" }}>
                                Send {"\u2192"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {otherFollowers.length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span style={{ color: "rgba(74,222,128,0.5)", fontSize: "0.4rem" }}>THEIR PARTY</span>
                          {otherFollowers.map(f => (
                            <div key={f.id} className="flex items-center justify-between px-1 py-0.5 rounded"
                              style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)" }}>
                              <span style={{ color: "rgba(232,213,176,0.8)" }}>{f.name} (Lv{f.level})</span>
                              <button onClick={() => doTransfer("follower", -1, f.id)} className="px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.8)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "0.4rem" }}>
                                {"\u2190"} Take
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Selected hex info */}
          {selectedHex && !(selectedHex.q === activeMapHex.q && selectedHex.r === activeMapHex.r) && (
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
                const dist = hexDistance(activeMapHex, selectedHex);
                if (dist === 0) return null;
                const hexCost = travelCost(dist, selectedHex);
                const hours = travelHours(dist, selectedHex);
                const preview = travel(hexCost, save, con);
                const hasRoad = selectedHex.tags?.includes("road") || selectedHex.tags?.includes("dirt_road");
                const speedLabel = hasRoad ? "road" : (TERRAIN_SPEED[selectedHex.type] ?? 1) < 1 ? "fast" : (TERRAIN_SPEED[selectedHex.type] ?? 1) === 1 ? "normal" : "slow";
                const timeStr = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`;
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
                      <span>Distance:</span><span className="font-bold">{dist} hex{dist > 1 ? "es" : ""}</span>
                      <span>Travel time:</span><span className="font-bold">{timeStr} ({speedLabel})</span>
                      <span>Food cost:</span><span className="font-bold">{hexCost} {"\u{1F356}"}{preview.starving ? " (!)" : ""}</span>
                    </div>
                    {playerEncumbrance === "over" && (
                      <div className="mt-1 text-center px-2 py-1 rounded" style={{ fontSize: "0.5rem", color: "rgba(220,38,38,0.9)", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" }}>
                        Overloaded! Drop items or give to followers before traveling.
                      </div>
                    )}
                    {dist <= MAX_TRAVEL && playerEncumbrance !== "over" && (
                      <button onClick={handleTravel}
                        className="mt-1 w-full px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
                        style={{
                          background: preview.starving ? "rgba(220,38,38,0.15)" : "rgba(74,222,128,0.15)",
                          color: preview.starving ? "rgba(220,38,38,0.9)" : "rgba(74,222,128,0.9)",
                          border: `1px solid ${preview.starving ? "rgba(220,38,38,0.4)" : "rgba(74,222,128,0.4)"}`,
                        }}>
                        {"\u{1F6B6}"} Travel ({timeStr})
                      </button>
                    )}
                    {dist > MAX_TRAVEL && playerEncumbrance !== "over" && (
                      <div className="mt-1 text-center" style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)" }}>
                        Too far — max {MAX_TRAVEL} hexes per move
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* ── Game Log Footer ── */}
      <div className="rounded-lg overflow-hidden shrink-0" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)", minHeight: 80, maxHeight: 160 }}>
        <div className="flex items-center justify-between px-3 py-1" style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(201,168,76,0.5)", fontSize: "0.5rem" }}>Game Log</span>
          {gameLog.length > 0 && (
            <button onClick={() => setGameLog([])} className="px-1.5 py-0.5 rounded"
              style={{ fontSize: "0.4rem", background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.5)", border: "1px solid rgba(220,38,38,0.15)" }}>
              Clear
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-3 py-1 flex flex-col gap-1" style={{ maxHeight: 148 }}>
          {gameLog.length === 0 && (
            <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.3)", padding: "8px 0" }}>No actions yet. Travel, rest, or use a skill to begin.</div>
          )}
          {gameLog.map((entry, idx) => {
            const isFind = entry.outcome.startsWith("find_");
            const isFight = entry.outcome === "fight" || entry.outcome === "thug_fight";
            const isHazard = entry.outcome === "hazard";
            const isQuest = entry.outcome === "find_quest";
            const isDungeon = entry.outcome === "find_dungeon";
            const bg = isFight ? "rgba(220,38,38,0.1)" : isFind ? "rgba(74,222,128,0.06)" : isHazard ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.02)";
            const border = isFight ? "rgba(220,38,38,0.2)" : isFind ? "rgba(74,222,128,0.15)" : "rgba(201,168,76,0.08)";
            const label = entry.outcome === "thug_fight" ? "AMBUSH" : isFight ? "COMBAT" : isHazard ? "HAZARD"
              : entry.outcome === "avoided_danger" ? "AVOIDED" : entry.outcome === "find_food" ? "FORAGED"
              : entry.outcome === "find_coins" ? "COINS" : entry.outcome === "find_valuable" ? "VALUABLE"
              : entry.outcome === "find_rare" ? "RARE" : isQuest ? "QUEST" : isDungeon ? "DUNGEON" : "—";
            return (
              <div key={idx} className="flex gap-2 items-start px-2 py-1 rounded" style={{ background: bg, border: `1px solid ${border}`, fontSize: "0.5rem", color: "rgba(232,213,176,0.7)", lineHeight: 1.4 }}>
                <div className="shrink-0 flex flex-col items-center" style={{ minWidth: 44 }}>
                  <span className="font-bold" style={{ fontSize: "0.4rem", color: (isQuest || isDungeon) ? "rgba(168,85,247,0.8)" : isFight ? "rgba(220,38,38,0.7)" : "rgba(201,168,76,0.5)" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: "0.4rem", color: "rgba(96,165,250,0.5)", fontFamily: "monospace" }}>
                    {entry.skillUsed ?? entry.interaction}
                  </span>
                </div>
                <div className="flex-1">
                  <span>{entry.description}</span>
                  {entry.rawD20 != null && (
                    <span className="ml-1" style={{ color: "rgba(168,85,247,0.7)", fontSize: "0.45rem", fontFamily: "monospace" }}>
                      [d20({entry.rawD20}){entry.skillMod != null ? `${entry.skillMod >= 0 ? "+" : ""}${entry.skillMod}` : ""}={entry.skillRoll}]
                    </span>
                  )}
                  <span className="ml-2" style={{ color: "rgba(232,213,176,0.4)", fontSize: "0.45rem" }}>
                    {entry.hpChange !== 0 && <>{entry.hpChange > 0 ? "+" : ""}{entry.hpChange}HP </>}
                    {entry.coinReward && (entry.coinReward.gp > 0 || entry.coinReward.sp > 0 || entry.coinReward.cp > 0) && <>+{formatCoins(entry.coinReward)} </>}
                    {entry.goldChange > 0 && <>+{formatCoins(cpToCoins(entry.goldChange))} </>}
                    {entry.foodChange > 0 && <>+{entry.foodChange}food </>}
                    {entry.xpChange > 0 && <>+{entry.xpChange}XP </>}
                    {entry.fameChange && entry.fameChange > 0 && <span style={{ color: "rgba(251,191,36,0.6)" }}>+{entry.fameChange}Fame </span>}
                  </span>
                </div>
                {idx === 0 && (isQuest || entry.outcome === "thug_fight") && pendingQuest && (
                  <button onClick={() => onQuestBattle(pendingQuest)}
                    className="shrink-0 px-2 py-1 rounded text-xs font-bold uppercase"
                    style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.9)", border: "1px solid rgba(220,38,38,0.4)", fontSize: "0.45rem" }}>
                    Fight!
                  </button>
                )}
                {idx === 0 && entry.outcome === "fight" && pendingQuest && !escapeResult && (() => {
                  // Determine which skills can avoid this encounter based on monster type
                  const monsterType = entry.encounter?.monsters?.[0]?.monster?.type ?? "beast";
                  const escapeSkills: { skill: string; ability: string; label: string }[] = [
                    { skill: "hide", ability: "dex", label: "Hide" }, // always available — sneak away
                  ];
                  if (monsterType === "humanoid") {
                    escapeSkills.push({ skill: "diplomacy", ability: "cha", label: "Diplomacy" });
                    escapeSkills.push({ skill: "intimidate", ability: "cha", label: "Intimidate" });
                    escapeSkills.push({ skill: "bluff", ability: "cha", label: "Bluff" });
                  }
                  if (monsterType === "beast" || monsterType === "magical_beast") {
                    escapeSkills.push({ skill: "handle_animal", ability: "cha", label: "Handle Animal" });
                    escapeSkills.push({ skill: "climb", ability: "str", label: "Climb" });
                  }
                  if (monsterType === "undead" || monsterType === "aberration") {
                    escapeSkills.push({ skill: "knowledge_religion", ability: "int", label: "Kn: Religion" });
                  }
                  if (monsterType === "fey" || monsterType === "plant") {
                    escapeSkills.push({ skill: "knowledge_nature", ability: "wis", label: "Kn: Nature" });
                  }
                  if (monsterType === "vermin" || monsterType === "swarm") {
                    escapeSkills.push({ skill: "survival", ability: "wis", label: "Survival" });
                  }
                  const dc = entry.skillDC ?? 12;
                  return (
                    <div className="shrink-0 flex flex-col gap-1">
                      <button onClick={() => onQuestBattle(pendingQuest)}
                        className="px-2 py-1 rounded text-xs font-bold uppercase"
                        style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.9)", border: "1px solid rgba(220,38,38,0.4)", fontSize: "0.45rem" }}>
                        Fight!
                      </button>
                      <div className="flex flex-wrap gap-0.5">
                        {escapeSkills.map(es => {
                          const abilityKey = es.ability as keyof typeof charStats;
                          const abilityScore = charStats[abilityKey] ?? 10;
                          const ranks = (skillRanks as Record<string, number>)[es.skill] ?? 0;
                          const mod = calcAbilityMod(abilityScore) + ranks;
                          return (
                            <button key={es.skill} onClick={() => {
                              const roll = Math.floor(Math.random() * 20) + 1;
                              const total = roll + mod;
                              if (total >= dc) {
                                setEscapeResult({ roll: total, dc, success: true });
                                setPendingQuest(null);
                                setGameLog(prev => [{ ...prev[0], outcome: "avoided_danger" as const, description: `${es.label} succeeds! (${total} vs DC ${dc}) You avoid the encounter.` }, ...prev.slice(1)]);
                              } else {
                                setEscapeResult({ roll: total, dc, success: false });
                              }
                            }}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.8)", border: "1px solid rgba(96,165,250,0.3)", fontSize: "0.38rem" }}>
                              {es.label} {mod >= 0 ? "+" : ""}{mod}
                            </button>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.3)" }}>DC {dc} — one attempt</span>
                    </div>
                  );
                })()}
                {idx === 0 && entry.outcome === "fight" && escapeResult && !escapeResult.success && pendingQuest && (
                  <div className="shrink-0 flex flex-col gap-1 items-center">
                    <span style={{ fontSize: "0.4rem", color: "rgba(220,38,38,0.8)" }}>Escape failed! ({escapeResult.roll} vs DC {escapeResult.dc})</span>
                    <button onClick={() => { setEscapeResult(null); onQuestBattle(pendingQuest); }}
                      className="px-2 py-1 rounded text-xs font-bold uppercase"
                      style={{ background: "rgba(220,38,38,0.15)", color: "rgba(220,38,38,0.9)", border: "1px solid rgba(220,38,38,0.4)", fontSize: "0.45rem" }}>
                      Fight!
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
