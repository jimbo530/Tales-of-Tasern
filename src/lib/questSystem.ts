// questSystem.ts — NPC and Quest system for Tales of Tasern
//
// 30 unique NPCs across Kardov's Gate, wilderness, dungeons, and faction leaders.
// 40 quests: 8 main story (chain), 20 side quests, 12 repeatable bounties.
// Integrates with: hexWorld (Coord), saveSystem (quest_flags, quest_cooldowns, Coins),
// factions (faction_rep), skills (skill checks), shops (ShopItem).
//
// Quest state lives in save.quest_flags (Record<string, boolean>) and
// save.quest_cooldowns (Record<string, string> ISO timestamps).
// This mirrors the artifactQuests.ts pattern already in use.

import type { Coord } from "./hexWorld";
import type { Coins } from "./saveSystem";
import type { ShopItem } from "./shops";

// ============================================================================
//  TYPES
// ============================================================================

// ── NPC Portrait (procedural description for rendering) ──────────────────────

export type NPCPortrait = {
  race: "human" | "elf" | "dwarf" | "halfling" | "gnome" | "half-orc" | "tiefling";
  gender: "male" | "female";
  age: "young" | "middle" | "old" | "ancient";
  build: "thin" | "average" | "stocky" | "muscular" | "heavy";
  hair: string;         // "bald", "long gray", "cropped red", etc.
  distinguishing: string; // "scar across left eye", "missing three fingers", etc.
  attire: string;       // "salt-stained leather apron", "moth-eaten robes", etc.
};

// ── Services NPCs can offer ─────────────────────────────────────────────────

export type ServiceType = "heal" | "identify" | "transport" | "repair" | "train" | "rest" | "resurrect" | "remove_curse";

export type Service = {
  type: ServiceType;
  name: string;
  costCp: number;      // cost in copper pieces
  description: string;
  minRep?: number;     // minimum faction rep required (-100 to 100)
};

// ── Dialogue ─────────────────────────────────────────────────────────────────

export type Condition =
  | { type: "flag"; flag: string; value: boolean }
  | { type: "level"; min: number }
  | { type: "rep"; faction: string; min: number }
  | { type: "item"; itemId: string; qty?: number }
  | { type: "coins"; minCp: number }
  | { type: "class"; classId: string }
  | { type: "quest_active"; questId: string }
  | { type: "quest_complete"; questId: string }
  | { type: "skill"; skillId: string; minRanks: number };

export type Effect =
  | { type: "set_flag"; flag: string; value: boolean }
  | { type: "give_item"; itemId: string; qty: number }
  | { type: "take_item"; itemId: string; qty: number }
  | { type: "give_coins"; coins: Coins }
  | { type: "take_coins"; costCp: number }
  | { type: "give_xp"; amount: number }
  | { type: "change_rep"; faction: string; amount: number }
  | { type: "accept_quest"; questId: string }
  | { type: "complete_quest"; questId: string }
  | { type: "change_disposition"; npcId: string; amount: number }
  | { type: "unlock_service"; npcId: string; serviceType: ServiceType }
  | { type: "teleport"; destination: Coord };

export type DialogueOption = {
  text: string;
  nextNode: string;       // node ID to jump to, or "END" to close dialogue
  conditions?: Condition[];
  skillCheck?: { stat: string; dc: number; successNode: string; failNode: string };
  effects?: Effect[];
};

export type DialogueNode = {
  id: string;
  text: string;
  speaker: "npc" | "player";
  options: DialogueOption[];
  conditions?: Condition[];    // only show this node if conditions met
  effects?: Effect[];          // apply when reaching this node
};

export type DialogueTree = {
  startNode: string;
  nodes: Record<string, DialogueNode>;
};

// ── NPC ──────────────────────────────────────────────────────────────────────

export type NPCCategory = "city" | "wilderness" | "dungeon" | "faction_leader";

export type NPC = {
  id: string;
  name: string;
  title: string;
  location: Coord;
  locationName: string;         // human-readable: "Iron Maw Tavern", "Fungal Forest"
  category: NPCCategory;
  disposition: number;          // -100 to 100 (hostile to friendly)
  dialogue: DialogueTree;
  quests: string[];             // quest IDs this NPC can give
  shop?: ShopItem[];            // if they sell goods
  services?: Service[];
  portrait: NPCPortrait;
  faction?: string;             // faction ID, if affiliated
  movesHexes?: boolean;         // true for wandering NPCs
  activeHours?: [number, number]; // [start, end] — NPC only available during these hours
};

// ── Quest Objectives ─────────────────────────────────────────────────────────

export type ObjectiveType = "kill" | "collect" | "visit" | "talk" | "survive" | "escort" | "craft" | "deliver" | "explore" | "win_fight";

export type Objective = {
  id: string;
  type: ObjectiveType;
  description: string;
  target: string;              // monster ID, item ID, NPC ID, hex "q,r", etc.
  count: number;               // how many (kills, items, etc.)
  current?: number;            // current progress (tracked in quest state)
  optional?: boolean;          // bonus objectives
};

// ── Quest Rewards ────────────────────────────────────────────────────────────

export type Reward = {
  type: "xp" | "coins" | "item" | "reputation" | "unlock_area" | "unlock_npc" | "unlock_service" | "companion" | "title" | "mount" | "spell";
  value: number | string;      // XP amount, item ID, faction ID, area name, etc.
  qty?: number;                // for items
  coins?: Coins;               // for coin rewards specifically
  faction?: string;            // for reputation rewards
  description: string;         // human-readable reward text
};

// ── Quest ────────────────────────────────────────────────────────────────────

export type QuestType = "main" | "side" | "bounty";

export type QuestStatus = "available" | "active" | "completed" | "failed";

export type Quest = {
  id: string;
  name: string;
  description: string;
  giver: string;               // NPC id
  type: QuestType;
  objectives: Objective[];
  rewards: Reward[];
  level: number;               // recommended level
  chain?: string;              // quest chain id (sequential quests)
  chainOrder?: number;         // position in chain (0-indexed)
  prerequisites?: string[];    // quest IDs that must be completed first
  timeLimit?: number;          // in-game hours before auto-fail (0 = no limit)
  repeatable: boolean;
  cooldownHours?: number;      // for repeatable quests, hours between completions
  faction?: string;            // faction this quest benefits
  repReward?: number;          // rep gained with faction on completion
  repPenalty?: { faction: string; amount: number }[]; // rep lost with rival factions
};

// ── Quest Log State (stored in save) ─────────────────────────────────────────

export type QuestProgress = {
  questId: string;
  status: QuestStatus;
  objectiveProgress: Record<string, number>; // objective ID → current count
  acceptedHour: number;        // in-game hour when accepted
  completedHour?: number;      // in-game hour when completed/failed
};

export type QuestLog = {
  active: QuestProgress[];
  completed: string[];         // quest IDs
  failed: string[];            // quest IDs
};

// ============================================================================
//  NPC DATA — 30 UNIQUE NPCs
// ============================================================================

// ── Helper: minimal dialogue for NPCs whose full trees are below ─────────────

function simpleDialogue(greeting: string, options: { text: string; response: string }[]): DialogueTree {
  const nodes: Record<string, DialogueNode> = {
    start: {
      id: "start",
      text: greeting,
      speaker: "npc",
      options: options.map((o, i) => ({
        text: o.text,
        nextNode: `response_${i}`,
      })).concat([{ text: "Farewell.", nextNode: "END" }]),
    },
  };
  options.forEach((o, i) => {
    nodes[`response_${i}`] = {
      id: `response_${i}`,
      text: o.response,
      speaker: "npc",
      options: [{ text: "I see.", nextNode: "start" }, { text: "Farewell.", nextNode: "END" }],
    };
  });
  return { startNode: "start", nodes };
}

// ── KARDOV'S GATE NPCs (8) ──────────────────────────────────────────────────

export const NPC_HARBOR_MASTER: NPC = {
  id: "npc_harbor_master",
  name: "Dorek Saltblood",
  title: "Harbor Master",
  location: { q: 36, r: 32 },
  locationName: "Kardov's Gate Harbor",
  category: "city",
  disposition: 30,
  faction: "temple_tidewarden",
  quests: ["quest_smuggler_cove", "quest_sea_beast", "quest_lost_cargo"],
  services: [
    { type: "transport", name: "Book Coastal Passage", costCp: 5000, description: "Arrange transport to any known coastal settlement." },
  ],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "stocky",
    hair: "salt-and-pepper, tied back with a leather cord",
    distinguishing: "Anchor tattoo on the left forearm, walks with a heavy limp from an old harpoon wound",
    attire: "Oil-stained leather coat over a faded blue tunic, brass spyglass hanging from his belt",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "The harbor master looks up from his ledger, one eye squinting against the salt wind. \"Another adventurer with coin to spend and nowhere to sail? Or have you got actual business at my docks?\"",
        speaker: "npc",
        options: [
          { text: "I need passage along the coast.", nextNode: "transport" },
          { text: "Any work for a capable sword?", nextNode: "work" },
          { text: "What can you tell me about the harbor?", nextNode: "lore" },
          { text: "Nothing. Farewell.", nextNode: "END" },
        ],
      },
      transport: {
        id: "transport",
        text: "\"Fifty gold buys you a bunk on the next merchantman headed south. North costs the same but takes twice as long — currents fight you the whole way. You want something faster, you buy your own ship. I know a man who sells 'em, if your purse is fat enough.\"",
        speaker: "npc",
        options: [
          { text: "Who sells ships?", nextNode: "ship_seller" },
          { text: "Tell me about work instead.", nextNode: "work" },
          { text: "I'll think about it.", nextNode: "END" },
        ],
      },
      ship_seller: {
        id: "ship_seller",
        text: "\"Old Garus at the drydock. He's got everything from fishing skiffs to retired war galleys. Tell him Dorek sent you and he might shave a few silver off the price. Might.\"",
        speaker: "npc",
        options: [
          { text: "Thanks. Any jobs available?", nextNode: "work" },
          { text: "Good to know. Farewell.", nextNode: "END" },
        ],
      },
      work: {
        id: "work",
        text: "\"Always something needs doing around a port this busy.\" He flips through a stack of water-stained notices. \"Smugglers have been running contraband through the sea caves south of here. A beast's been spotted in the deep channel — scared three fishing crews back to dock before dawn. And there's a merchant screaming about lost cargo that never arrived from the west. Take your pick.\"",
        speaker: "npc",
        options: [
          { text: "Tell me about the smugglers.", nextNode: "smugglers" },
          { text: "What kind of beast?", nextNode: "beast" },
          { text: "Lost cargo — what's the pay?", nextNode: "cargo" },
          { text: "I'll come back later.", nextNode: "END" },
        ],
      },
      smugglers: {
        id: "smugglers",
        text: "\"Runners from the Shadow Coast. They slip through the sea caves at low tide with sealed crates — poisons, cursed trinkets, things the Guild declared contraband years ago. Clear 'em out and there's a bounty of thirty gold from the city watch, plus whatever you find in those crates that isn't actively evil.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "quest_smuggler_cove_available", value: true }],
        options: [
          { text: "I'll handle it. [Accept quest]", nextNode: "accept_smuggler", effects: [{ type: "accept_quest", questId: "quest_smuggler_cove" }] },
          { text: "What about the other jobs?", nextNode: "work" },
          { text: "Not interested right now.", nextNode: "END" },
        ],
      },
      accept_smuggler: {
        id: "accept_smuggler",
        text: "\"Good. The caves are south along the coast — two hexes, maybe three. Go at low tide or you'll drown before you find anyone to fight. Bring me proof they're cleared and the gold is yours.\"",
        speaker: "npc",
        options: [{ text: "Consider it done.", nextNode: "END" }],
      },
      beast: {
        id: "beast",
        text: "\"Something big. Tentacles, the fishermen say, though half of 'em were probably drunk. But three boats came back with hull damage in the same week. Whatever it is lives in the deep channel between here and the eastern shoals. Kill it or drive it off — I don't care which — and there's forty gold waiting.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "quest_sea_beast_available", value: true }],
        options: [
          { text: "I'll deal with it. [Accept quest]", nextNode: "accept_beast", effects: [{ type: "accept_quest", questId: "quest_sea_beast" }] },
          { text: "Anything else?", nextNode: "work" },
          { text: "Not my kind of fight.", nextNode: "END" },
        ],
      },
      accept_beast: {
        id: "accept_beast",
        text: "\"You'll need a boat. Borrow one from the eastern pier — tell 'em I sent you. Bring back a tentacle or a tooth and I'll pay out. Bring back nothing and I'll assume it ate you.\"",
        speaker: "npc",
        options: [{ text: "Understood.", nextNode: "END" }],
      },
      cargo: {
        id: "cargo",
        text: "\"Merchant named Pallav — spice trader, rich as sin, loud as a gull. His shipment from the western settlements never arrived. Could be bandits, could be the ship sank, could be his captain sold it all and ran. Twenty gold to find it, thirty if you bring it back intact.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "quest_lost_cargo_available", value: true }],
        options: [
          { text: "I'll track it down. [Accept quest]", nextNode: "accept_cargo", effects: [{ type: "accept_quest", questId: "quest_lost_cargo" }] },
          { text: "Not worth the trouble.", nextNode: "END" },
        ],
      },
      accept_cargo: {
        id: "accept_cargo",
        text: "\"Check the western coast road first. If the ship went down, wreckage would've washed up by now. If it was bandits, someone in the villages will have seen something. Report back here when you know.\"",
        speaker: "npc",
        options: [{ text: "I'll find out what happened.", nextNode: "END" }],
      },
      lore: {
        id: "lore",
        text: "\"Kardov's Gate has the deepest natural harbor on the island. The sea chain can seal us shut in under a minute — hasn't been raised in anger for twelve years, though. The Iron Maw keeps watch over everything that floats in or out. As for me, I keep the berths filled, the tariffs paid, and the drunken sailors from burning down the warehouses. It's not glamorous work, but it keeps the city fed.\"",
        speaker: "npc",
        options: [
          { text: "Any work available?", nextNode: "work" },
          { text: "Interesting. Farewell.", nextNode: "END" },
        ],
      },
    },
  },
};

export const NPC_TAVERN_KEEPER: NPC = {
  id: "npc_tavern_keeper",
  name: "Brenna Ashwick",
  title: "Keeper of the Iron Maw Tavern",
  location: { q: 36, r: 32 },
  locationName: "Iron Maw Tavern",
  category: "city",
  disposition: 50,
  quests: ["quest_rat_cellar", "quest_missing_patron", "quest_tavern_debt"],
  services: [
    { type: "rest", name: "Rent a Room", costCp: 500, description: "A clean bed, warm meal, and locked door until dawn." },
    { type: "heal", name: "Hot Meal & Ale", costCp: 50, description: "Restores 1d6 HP. Good food, better company." },
  ],
  portrait: {
    race: "human", gender: "female", age: "middle", build: "stocky",
    hair: "auburn, pinned up beneath a stained headscarf",
    distinguishing: "Burn scar on the right hand from a grease fire, sharp green eyes that miss nothing",
    attire: "Heavy apron over a wool dress, a wooden cudgel tucked into the apron string",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "The tavern keeper slides a cloth across the bar with practiced ease, her eyes already measuring you up. \"You look like you could use a drink, a bed, or trouble. I sell two of those. The third finds you on its own around here.\"",
        speaker: "npc",
        options: [
          { text: "A room for the night.", nextNode: "room" },
          { text: "What rumors are floating around?", nextNode: "rumors" },
          { text: "I'm looking for work.", nextNode: "work" },
          { text: "Just passing through.", nextNode: "END" },
        ],
      },
      room: {
        id: "room",
        text: "\"Five gold gets you the back room — clean sheets, a bolt on the door, and breakfast before the cock crows. I don't allow weapons at the table and I don't allow killing under my roof. Everything else is between you and the gods.\"",
        speaker: "npc",
        options: [
          { text: "I'll take it. [5 gp]", nextNode: "room_paid", effects: [{ type: "take_coins", costCp: 500 }] },
          { text: "Too rich for my blood.", nextNode: "start" },
        ],
      },
      room_paid: {
        id: "room_paid",
        text: "She pockets the coins and tosses you a brass key. \"Up the stairs, second door. Don't lose the key — replacement costs a silver.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "rested_iron_maw", value: true }],
        options: [{ text: "Thanks.", nextNode: "END" }],
      },
      rumors: {
        id: "rumors",
        text: "She leans in, voice dropping beneath the din of the common room. \"Three things worth knowing tonight. Something's been eating the stores in my cellar — not rats, something bigger. A regular of mine hasn't shown his face in five days and his wife is frantic. And Councillor Threkk owes me sixty gold he swore he'd pay a month ago. Any of that pique your interest?\"",
        speaker: "npc",
        options: [
          { text: "Something in your cellar?", nextNode: "cellar" },
          { text: "Tell me about the missing man.", nextNode: "missing" },
          { text: "A councillor who doesn't pay his debts?", nextNode: "debt" },
          { text: "I'll keep my ears open.", nextNode: "END" },
        ],
      },
      cellar: {
        id: "cellar",
        text: "\"It's been three nights. Something down there is getting into the grain stores and the salted meat. I went down with a lantern and saw claw marks on the barrels — deep ones, like a dog's but wrong somehow. I'm not paying a hunter's guild fee for what might be a badger. Clear it out and I'll waive your room for a week.\"",
        speaker: "npc",
        options: [
          { text: "I'll check it out. [Accept quest]", nextNode: "accept_cellar", effects: [{ type: "accept_quest", questId: "quest_rat_cellar" }] },
          { text: "What about the other things?", nextNode: "rumors" },
        ],
      },
      accept_cellar: {
        id: "accept_cellar",
        text: "\"Door to the cellar's behind the kitchen. Here's the key.\" She presses a rusted iron key into your palm. \"Whatever's down there, kill it quiet. I've got paying customers.\"",
        speaker: "npc",
        options: [{ text: "Quietly. Got it.", nextNode: "END" }],
      },
      missing: {
        id: "missing",
        text: "\"Harren the cooper. Came in every night for his half-pint like clockwork for six years. Five days ago he walked out the door and vanished. His wife says he never came home. City watch shrugged — grown man, probably left. But Harren wouldn't. I know the man. Something happened to him between here and his shop on Chandler Street.\"",
        speaker: "npc",
        options: [
          { text: "I'll look into it. [Accept quest]", nextNode: "accept_missing", effects: [{ type: "accept_quest", questId: "quest_missing_patron" }] },
          { text: "Anything else?", nextNode: "rumors" },
        ],
      },
      accept_missing: {
        id: "accept_missing",
        text: "\"Start at his shop. Talk to his wife, the neighbours. Somebody saw something. Bring him back breathing and I owe you a favour — the kind that's worth more than gold in this city.\"",
        speaker: "npc",
        options: [{ text: "I'll find him.", nextNode: "END" }],
      },
      debt: {
        id: "debt",
        text: "\"Threkk sits on the city council, thinks that makes him above paying for his ale. Sixty gold — three months of tabs he swore were 'on the house account.' There is no house account. I want my money. Collect it from him — keep ten gold for yourself — and I don't care how you do it as long as nobody dies.\"",
        speaker: "npc",
        options: [
          { text: "I'll get your money. [Accept quest]", nextNode: "accept_debt", effects: [{ type: "accept_quest", questId: "quest_tavern_debt" }] },
          { text: "Not my kind of problem.", nextNode: "rumors" },
        ],
      },
      accept_debt: {
        id: "accept_debt",
        text: "\"He lives in the upper district — big house with a blue door. You can talk sweet, threaten, or bring proof he owes. I have his signed tabs if you want 'em.\" She slides a bundle of parchment across the bar.",
        speaker: "npc",
        effects: [{ type: "give_item", itemId: "threkk_signed_tabs", qty: 1 }],
        options: [{ text: "I'll handle it.", nextNode: "END" }],
      },
      work: {
        id: "work",
        text: "\"I post bounties on the board by the door. Anyone can take 'em, first come first served. Right now I've got the cellar situation, a missing regular, and a debt to collect. Beyond that, buy a drink and listen — half the jobs in this city start as someone else's drunken confession.\"",
        speaker: "npc",
        options: [
          { text: "Tell me about the bounties.", nextNode: "rumors" },
          { text: "I'll check the board later.", nextNode: "END" },
        ],
      },
    },
  },
};

export const NPC_GUILD_MASTER: NPC = {
  id: "npc_guild_master",
  name: "Sevran Ashborne",
  title: "Guild Master of the Alchemist Guild",
  location: { q: 36, r: 32 },
  locationName: "Alchemist Guild Hall",
  category: "city",
  disposition: 20,
  faction: "alchemist_guild",
  quests: ["quest_vessel_namaris_1", "quest_guild_reagents", "quest_guild_trial"],
  services: [
    { type: "train", name: "Arcane Training", costCp: 10000, description: "Gain access to advanced spell research. Requires Honored standing." , minRep: 50 },
    { type: "identify", name: "Identify Magical Properties", costCp: 2500, description: "Reveal the true nature of any enchanted item." },
  ],
  portrait: {
    race: "human", gender: "male", age: "old", build: "thin",
    hair: "white, cropped close to the skull",
    distinguishing: "Chemical stains on both hands up to the wrists, one eye replaced with a glass orb that faintly glows amber",
    attire: "Immaculate dark blue robes with silver thread, a bandolier of small vials across the chest",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "The Guild Master regards you from behind a desk cluttered with distillation apparatus and leather-bound tomes. His glass eye catches the lamplight and seems to peer into you independently. \"You stand in the hall of the Alchemist Guild. We deal in knowledge, not faith. State your purpose.\"",
        speaker: "npc",
        options: [
          { text: "I'm here about the Vessel of Namaris.", nextNode: "vessel" },
          { text: "I need something identified.", nextNode: "identify" },
          { text: "I want to join the Guild.", nextNode: "join" },
          { text: "My apologies. Wrong hall.", nextNode: "END" },
        ],
      },
      vessel: {
        id: "vessel",
        text: "His jaw tightens almost imperceptibly. \"The Vessel. Yes. The crier's announcement was... premature. But the need is real.\" He folds his stained fingers together. \"It lies in the Blackwood Ruins, northwest of the city. An artifact of transmutation — capable of converting base matter into pure elements on a scale we've never achieved. The temples want it destroyed. We want it studied. I need someone who understands the difference.\"",
        speaker: "npc",
        options: [
          { text: "What's the pay?", nextNode: "vessel_pay" },
          { text: "What's the danger?", nextNode: "vessel_danger" },
          { text: "I'll retrieve it. [Accept quest]", nextNode: "vessel_accept", effects: [{ type: "accept_quest", questId: "quest_vessel_namaris_1" }] },
          { text: "I need to think about it.", nextNode: "END" },
        ],
      },
      vessel_pay: {
        id: "vessel_pay",
        text: "\"One hundred gold upon delivery. Access to our restricted library. And my personal guarantee of protection from the temples, who will be... displeased. The Guild protects its agents. That's not an empty promise.\"",
        speaker: "npc",
        options: [
          { text: "What's the danger?", nextNode: "vessel_danger" },
          { text: "Done. I'll bring it back. [Accept quest]", nextNode: "vessel_accept", effects: [{ type: "accept_quest", questId: "quest_vessel_namaris_1" }] },
          { text: "I'll consider it.", nextNode: "END" },
        ],
      },
      vessel_danger: {
        id: "vessel_danger",
        text: "\"The Blackwood is overrun with aberrations — twisted creatures drawn to the Vessel's latent energy. The ruins themselves are trapped by the original builders. And you won't be alone out there — others heard the crier. Some will try to take it from you if you find it first. Come prepared or don't come at all.\"",
        speaker: "npc",
        options: [
          { text: "I can handle it. [Accept quest]", nextNode: "vessel_accept", effects: [{ type: "accept_quest", questId: "quest_vessel_namaris_1" }] },
          { text: "I need to prepare first.", nextNode: "END" },
        ],
      },
      vessel_accept: {
        id: "vessel_accept",
        text: "He produces a sealed scroll case from his desk and slides it toward you. \"A map of the known approaches to the Blackwood Ruins. My scribe marked the safer paths — though 'safer' is relative. Return with the Vessel intact. Do not attempt to use it. Do not let the temples take it. That is all.\"",
        speaker: "npc",
        effects: [
          { type: "give_item", itemId: "blackwood_map", qty: 1 },
          { type: "set_flag", flag: "vessel_namaris_started", value: true },
        ],
        options: [{ text: "It will be done.", nextNode: "END" }],
      },
      identify: {
        id: "identify",
        text: "\"Twenty-five gold per item. Place it on the bench and step back. Some artifacts react... poorly to proximity during analysis.\"",
        speaker: "npc",
        options: [
          { text: "Here's my item. [25 gp]", nextNode: "identify_done", effects: [{ type: "take_coins", costCp: 2500 }] },
          { text: "Too expensive. Maybe later.", nextNode: "start" },
        ],
      },
      identify_done: {
        id: "identify_done",
        text: "He examines the item through a series of lenses, muttering formulae under his breath. After a moment he sets it down and nods. \"The enchantment is catalogued. You may retrieve your property.\"",
        speaker: "npc",
        options: [{ text: "Thank you.", nextNode: "END" }],
      },
      join: {
        id: "join",
        text: "\"Membership requires demonstrated competence. Bring me three bundles of moonwort moss and a vial of basilisk venom — proof you can handle fieldwork. Complete that, and we discuss your application further.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "quest_guild_trial_available", value: true }],
        options: [
          { text: "I'll gather what you need. [Accept quest]", nextNode: "join_accept", effects: [{ type: "accept_quest", questId: "quest_guild_trial" }] },
          { text: "That's a tall order. I'll think about it.", nextNode: "END" },
        ],
      },
      join_accept: {
        id: "join_accept",
        text: "\"Moonwort grows in the fungal forests to the east. Basilisks inhabit the rocky highlands north of the farmlands. Do not get bitten — we don't stock enough antivenom to waste on applicants.\"",
        speaker: "npc",
        options: [{ text: "Understood.", nextNode: "END" }],
      },
    },
  },
};

export const NPC_HIGH_LUMINAR: NPC = {
  id: "npc_high_luminar",
  name: "Archon Malachar",
  title: "High Luminar of the Dawnfire Temple",
  location: { q: 36, r: 32 },
  locationName: "Temple of Dawn",
  category: "city",
  disposition: 40,
  faction: "temple_dawnfire",
  quests: ["quest_undead_crypt", "quest_shadow_cult", "quest_purify_shrine"],
  services: [
    { type: "heal", name: "Divine Healing", costCp: 1000, description: "Full HP restoration through prayer." },
    { type: "resurrect", name: "Raise the Fallen", costCp: 50000, description: "Return a dead party member to life. Requires Honored standing.", minRep: 50 },
    { type: "remove_curse", name: "Break Curse", costCp: 5000, description: "Remove a single curse from one creature or item." },
  ],
  portrait: {
    race: "human", gender: "male", age: "old", build: "average",
    hair: "shaved head, bearing the sunburst brand of the Dawnfire",
    distinguishing: "Radiant golden eyes that glow faintly in dim light, deep lines carved by decades of fasting",
    attire: "White and gold vestments over chain mail, a mace of office hung from a sash of woven sunlight",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "The High Luminar stands at the altar, hands folded in prayer. As you approach, he turns with an expression that is equal parts warmth and judgment. \"The light sees all who enter here. Speak your need — but know that the Dawnfire burns lies as readily as darkness.\"",
        speaker: "npc",
        options: [
          { text: "I need healing.", nextNode: "healing" },
          { text: "I've heard of a shadow cult in the city.", nextNode: "shadow" },
          { text: "The undead are growing bolder outside the walls.", nextNode: "undead" },
          { text: "I seek only wisdom.", nextNode: "wisdom" },
          { text: "Forgive the intrusion.", nextNode: "END" },
        ],
      },
      healing: {
        id: "healing",
        text: "\"The light heals all who come in good faith. Ten gold is the customary offering — not payment, but gratitude. The temple has many who depend on those offerings for their daily bread.\"",
        speaker: "npc",
        options: [
          { text: "I offer freely. [10 gp]", nextNode: "healed", effects: [{ type: "take_coins", costCp: 1000 }] },
          { text: "I cannot afford it now.", nextNode: "start" },
        ],
      },
      healed: {
        id: "healed",
        text: "Golden light flows from his outstretched palm. Your wounds close, your fatigue lifts, and for a brief moment you feel the weight of something vast and patient watching over you. \"Go in the light. And try not to need this again so soon.\"",
        speaker: "npc",
        options: [{ text: "Thank you, Luminar.", nextNode: "END" }],
      },
      shadow: {
        id: "shadow",
        text: "His golden eyes narrow. \"So. You've heard whispers. Good — it means they're getting careless.\" He lowers his voice. \"The Temple of Shadow operates beneath this city. They corrupt the faithful, steal relics, and poison wells of divine power. I need proof — names, locations, ritual sites. Bring me evidence and I will bring the dawn's full wrath upon them.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "quest_shadow_cult_available", value: true }],
        options: [
          { text: "I'll root them out. [Accept quest]", nextNode: "shadow_accept", effects: [{ type: "accept_quest", questId: "quest_shadow_cult" }] },
          { text: "That sounds dangerous.", nextNode: "shadow_warn" },
          { text: "Not my fight.", nextNode: "END" },
        ],
      },
      shadow_accept: {
        id: "shadow_accept",
        text: "\"Begin in the underbelly — the dockside cellars, the abandoned granary on Mill Street. They mark their dens with a crescent scratched into the doorframe. Be careful. They know my agents by sight, but a stranger... a stranger they might underestimate.\"",
        speaker: "npc",
        effects: [{ type: "change_rep", faction: "temple_dawnfire", amount: 5 }],
        options: [{ text: "I'll report what I find.", nextNode: "END" }],
      },
      shadow_warn: {
        id: "shadow_warn",
        text: "\"It is. They've killed three of my acolytes this year alone. But the alternative is letting them fester until they're strong enough to act openly. I would rather lose soldiers than a city.\"",
        speaker: "npc",
        options: [
          { text: "Then I'll do it. [Accept quest]", nextNode: "shadow_accept", effects: [{ type: "accept_quest", questId: "quest_shadow_cult" }] },
          { text: "I understand, but not today.", nextNode: "END" },
        ],
      },
      undead: {
        id: "undead",
        text: "\"The dead do not rise without cause. Something feeds them — an anchor, a necromancer, perhaps a forgotten burial ground whose wards have weakened. The old crypt beneath Millhaven was sealed a century ago. I fear those seals are failing. Go there, find what wakes them, and end it. The Temple will reward you generously.\"",
        speaker: "npc",
        options: [
          { text: "I'll put them to rest. [Accept quest]", nextNode: "undead_accept", effects: [{ type: "accept_quest", questId: "quest_undead_crypt" }] },
          { text: "How generously?", nextNode: "undead_reward" },
          { text: "Not now.", nextNode: "END" },
        ],
      },
      undead_accept: {
        id: "undead_accept",
        text: "\"The crypt entrance is two hexes north, at the base of Millhaven hill. Take this — holy water, blessed this morning. It burns the undead like oil burns flesh.\"",
        speaker: "npc",
        effects: [{ type: "give_item", itemId: "holy_water", qty: 3 }],
        options: [{ text: "The dead will stay dead.", nextNode: "END" }],
      },
      undead_reward: {
        id: "undead_reward",
        text: "\"Thirty gold and the Temple's blessing — which opens doors in this city that gold cannot. We remember those who serve the light.\"",
        speaker: "npc",
        options: [
          { text: "Good enough. I'll do it. [Accept quest]", nextNode: "undead_accept", effects: [{ type: "accept_quest", questId: "quest_undead_crypt" }] },
          { text: "I'll think on it.", nextNode: "END" },
        ],
      },
      wisdom: {
        id: "wisdom",
        text: "\"Then hear this: the world does not reward the righteous. It rewards the persistent. The Dawnfire teaches us that light must be carried into darkness deliberately — it does not spread on its own. Whatever quest drives you, carry it with purpose. Half-measures will get you killed.\"",
        speaker: "npc",
        options: [{ text: "Wise words. Thank you.", nextNode: "END" }],
      },
    },
  },
};

export const NPC_BLACKSMITH: NPC = {
  id: "npc_blacksmith",
  name: "Korrin Ironjaw",
  title: "Master Smith",
  location: { q: 36, r: 32 },
  locationName: "Ironjaw Forge, Artisans' District",
  category: "city",
  disposition: 35,
  quests: ["quest_dragonsteel_forge", "quest_ore_shipment"],
  services: [
    { type: "repair", name: "Repair Equipment", costCp: 200, description: "Fix damaged weapons and armor to full condition." },
  ],
  portrait: {
    race: "dwarf", gender: "male", age: "middle", build: "muscular",
    hair: "black, braided into his beard with iron rings",
    distinguishing: "Missing the tip of his left ear, forearms thick as fence posts and covered in old burn marks",
    attire: "Leather apron blackened by forge soot, bare arms despite the cold, iron-shod boots",
  },
  dialogue: simpleDialogue(
    "The dwarf doesn't look up from the blade he's grinding. Sparks shower the stone floor. \"Buying, selling, or wasting my time? Pick one.\"",
    [
      { text: "I need something repaired.",
        response: "\"Two gold per item. Set it on the bench. Come back in an hour — or watch, I don't care. Just don't touch anything that's glowing.\"" },
      { text: "I'm looking for special work — dragonsteel.",
        response: "His head snaps up. \"Dragonsteel. You know what that costs? Not just gold — the ore only comes from the volcanic reaches far to the north. Bring me three ingots of volcanic iron and a dragon's heartstone, and I'll forge you something that'll outlast your grandchildren. That's not a promise I make lightly.\"" },
      { text: "Do you have ore shipments coming in?",
        response: "\"I had one. Three days late now. The miners up at Craghollow swore it shipped, but the wagon never arrived. Road bandits, probably. If you're headed northwest and you spot my iron — six crates stamped with a jawbone mark — bring 'em here. I'll pay weight in silver for every crate returned.\"" },
    ],
  ),
};

export const NPC_ALCHEMIST: NPC = {
  id: "npc_alchemist",
  name: "Yssa Thornveil",
  title: "Alchemist & Scroll Merchant",
  location: { q: 36, r: 32 },
  locationName: "Thornveil Apothecary",
  category: "city",
  disposition: 45,
  faction: "alchemist_guild",
  quests: ["quest_mushroom_harvest", "quest_basilisk_eyes"],
  services: [
    { type: "identify", name: "Identify Potion", costCp: 500, description: "Determine the effects of an unknown potion or elixir." },
  ],
  portrait: {
    race: "elf", gender: "female", age: "middle", build: "thin",
    hair: "silver-white, loose to her waist, often singed at the tips",
    distinguishing: "Pupils permanently dilated from decades of fume exposure, fingers stained violet from reagents",
    attire: "A patchwork of leather smocks layered over each other, pockets bulging with vials and dried herbs",
  },
  dialogue: simpleDialogue(
    "The shop smells of sulfur and mint in equal measure. The elf behind the counter doesn't blink — literally — as she watches you enter. \"Potions, scrolls, or reagents. Everything's labelled. If you can't read, point and I'll tell you what it does before it kills you.\"",
    [
      { text: "I need healing potions.",
        response: "\"Cure Light Wounds — fifty gold each. I brew them fresh every three days. They're better than the temple's prayers because they don't come with a sermon attached.\"" },
      { text: "Any work for a forager?",
        response: "\"Always. I burn through mushroom caps faster than the forest grows them. Moonwort specifically — it only grows in the fungal forests east of here. Five silver per cap, and I'll buy as many as you bring. I also need basilisk eyes for a paralysis cure. Those are harder. Twenty gold per pair, if you've got the stomach for it.\"" },
      { text: "Can you identify this potion?",
        response: "\"Five gold.\" She holds out her hand. \"I'll taste it, smell it, and tell you exactly what it does. If it's poison, I'll know that too — my tolerance for toxins is professionally high.\"" },
    ],
  ),
};

export const NPC_SHADY_DEALER: NPC = {
  id: "npc_shady_dealer",
  name: "Silk",
  title: "Information Broker",
  location: { q: 36, r: 32 },
  locationName: "The Underbelly, Behind the Nameless Tavern",
  category: "city",
  disposition: 0,
  faction: "temple_shadow",
  quests: ["quest_stolen_ledger", "quest_blackmail_evidence"],
  activeHours: [20, 4],
  portrait: {
    race: "halfling", gender: "male", age: "young", build: "thin",
    hair: "dark, hidden beneath a deep hood",
    distinguishing: "Three gold teeth, a constant nervous energy, never sits with his back to a door",
    attire: "Layer upon layer of dark cloth — impossible to tell where pockets end and clothes begin",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "A small figure materializes from the shadows between two barrels. Gold teeth flash in the lamplight. \"You're either lost, law, or looking for something the shops upstairs don't sell. Which is it?\"",
        speaker: "npc",
        options: [
          { text: "I need information.", nextNode: "info" },
          { text: "I have goods to sell. Quietly.", nextNode: "fence" },
          { text: "I'm looking for work. The kind that doesn't get posted on boards.", nextNode: "dark_work" },
          { text: "Wrong alley. Forget you saw me.", nextNode: "END" },
        ],
      },
      info: {
        id: "info",
        text: "\"Information costs. Copper for gossip, silver for secrets, gold for the kind of truth that gets people killed. What do you want to know?\"",
        speaker: "npc",
        options: [
          { text: "The Shadow Temple — where do they meet?", nextNode: "shadow_info", conditions: [{ type: "quest_active", questId: "quest_shadow_cult" }] },
          { text: "Who's making money in this city?", nextNode: "money_info" },
          { text: "Never mind.", nextNode: "END" },
        ],
      },
      shadow_info: {
        id: "shadow_info",
        text: "He stiffens. \"You're asking about things that make people disappear. Ten gold and I'll tell you about a cellar door on Mill Street that shouldn't exist. That's all I'm saying on the matter.\"",
        speaker: "npc",
        options: [
          { text: "Here's your ten. [10 gp]", nextNode: "shadow_reveal", effects: [{ type: "take_coins", costCp: 1000 }] },
          { text: "Too much. I'll find another way.", nextNode: "END" },
        ],
      },
      shadow_reveal: {
        id: "shadow_reveal",
        text: "He snatches the gold and leans close. \"Mill Street, third building from the tannery. There's a crescent scratch on the doorframe — look low, near the ground. Don't go alone and don't go at midnight. That's when they're all there.\" He melts back into the shadows. \"We never spoke.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "shadow_lair_known", value: true }],
        options: [{ text: "[Leave silently]", nextNode: "END" }],
      },
      money_info: {
        id: "money_info",
        text: "\"Everyone's always looking for easy coin. Councillor Threkk is drowning in debts he thinks nobody knows about. The Harbor Master has a locked chest he won't let anyone near — not even the customs officers. And the Alchemist Guild just paid triple market rate for a shipment of nightshade. Draw your own conclusions. Two silver for the tip.\"",
        speaker: "npc",
        options: [
          { text: "Fair enough. [2 sp]", nextNode: "END", effects: [{ type: "take_coins", costCp: 20 }] },
          { text: "Useful. Tell me about work.", nextNode: "dark_work" },
        ],
      },
      fence: {
        id: "fence",
        text: "\"I buy anything that doesn't have a tracking enchantment on it. Sixty percent of market value — forty if it's still warm. Show me what you've got.\"",
        speaker: "npc",
        options: [
          { text: "[Show stolen goods]", nextNode: "END" },
          { text: "Maybe later.", nextNode: "END" },
        ],
      },
      dark_work: {
        id: "dark_work",
        text: "\"Quiet work for quiet people. I've got two things right now.\" He holds up two fingers. \"A ledger was stolen from a merchant — she wants it back without anyone knowing it went missing. And there's a noble who's being blackmailed. He wants the evidence destroyed, no questions asked. Pay's good for both. Interested?\"",
        speaker: "npc",
        options: [
          { text: "The stolen ledger.", nextNode: "ledger", effects: [{ type: "accept_quest", questId: "quest_stolen_ledger" }] },
          { text: "The blackmail job.", nextNode: "blackmail", effects: [{ type: "accept_quest", questId: "quest_blackmail_evidence" }] },
          { text: "Not tonight.", nextNode: "END" },
        ],
      },
      ledger: {
        id: "ledger",
        text: "\"The thief's a dockworker named Cren. Big lad, stupid. He took it thinking it listed hidden gold but it's just shipping manifests and customs evasions. He's got it in his bunk at the sailors' flophouse. Get it back — don't kill him, or I lose a useful idiot. Twenty gold.\"",
        speaker: "npc",
        options: [{ text: "Done.", nextNode: "END" }],
      },
      blackmail: {
        id: "blackmail",
        text: "\"A painter in the Artisans' District has... compromising portraits of Lord Voss. Voss is paying through the nose to keep them hidden. Find the paintings and burn them. The painter's studio is above the Gilded Frame shop. Thirty gold from Voss, delivered here. You never met him.\"",
        speaker: "npc",
        options: [{ text: "Consider it handled.", nextNode: "END" }],
      },
    },
  },
};

export const NPC_BEGGAR_KING: NPC = {
  id: "npc_beggar_king",
  name: "Old Nails",
  title: "Beggar King",
  location: { q: 36, r: 32 },
  locationName: "The Warrens, beneath Kardov's Gate",
  category: "city",
  disposition: -10,
  quests: ["quest_pickpocket_ring", "quest_sewer_map"],
  activeHours: [18, 6],
  portrait: {
    race: "human", gender: "male", age: "ancient", build: "thin",
    hair: "filthy gray wisps, crawling with lice",
    distinguishing: "Blind in both eyes — milky white — yet navigates perfectly, fingernails grown long and sharp like talons",
    attire: "A king's ransom in stolen rings beneath layers of rags so filthy they've become a kind of armor",
  },
  dialogue: simpleDialogue(
    "The blind man sits on a throne of broken furniture in the sewer junction, surrounded by children and rats in equal measure. He smiles without warmth when you approach. \"I smell someone who still bathes. You're either brave or stupid to come to my court uninvited. Impress me quickly.\"",
    [
      { text: "I'm looking for work that requires... delicacy.",
        response: "\"Delicacy.\" He laughs — a dry, rattling sound. \"My little fingers have been getting pinched by the city watch. Someone's feeding them information about our routes. Find the rat among my rats — the one talking to the guard captain — and bring them to me alive. I pay in secrets, which are worth more than gold down here.\"" },
      { text: "I need to get somewhere without being seen.",
        response: "\"The sewers go everywhere in this city. I know every tunnel, every grate, every forgotten passage. But maps of my kingdom aren't free. Bring me something interesting — a guard's patrol schedule, a merchant's route list, or ten gold — and I'll draw you a path to wherever you need to be.\"" },
      { text: "I want to join the thieves' guild.",
        response: "\"There is no thieves' guild.\" The children around him snicker. \"There is only me, my family, and the understanding that what happens below the streets stays below the streets. Prove your worth — steal the watch captain's badge and bring it here — and we'll talk about... family membership.\"" },
    ],
  ),
};

// ── WILDERNESS NPCs (12) ─────────────────────────────────────────────────────

export const NPC_WANDERING_MERCHANT: NPC = {
  id: "npc_wandering_merchant",
  name: "Priya of the Long Road",
  title: "Wandering Merchant",
  location: { q: 34, r: 30 },
  locationName: "The King's Road (moves)",
  category: "wilderness",
  disposition: 60,
  movesHexes: true,
  quests: ["quest_escort_merchant"],
  services: [
    { type: "repair", name: "Patch Job", costCp: 300, description: "Quick field repair on weapons and armor. Not as good as a proper smith." },
  ],
  portrait: {
    race: "human", gender: "female", age: "middle", build: "average",
    hair: "black, braided with trade beads from a dozen nations",
    distinguishing: "Weathered tan skin, a merchant's scale tattooed on her wrist, always smiling",
    attire: "Colorful but road-worn traveling clothes, a pack mule's worth of goods strapped to her back",
  },
  dialogue: simpleDialogue(
    "A woman with a towering pack waves from the roadside, her mule braying in greeting. \"Hail, traveler! Priya has what you need — blades, balms, rations, and rumors. All for fair prices. Well... mostly fair.\"",
    [
      { text: "Show me your wares.",
        response: "\"Certainly! I carry healing salves, trail rations, rope, torches, and whatever curiosities I've picked up between here and the coast. Prices are a touch higher than city shops — call it a convenience fee for not having to walk back to Kardov's Gate.\"" },
      { text: "Any news from the road?",
        response: "\"Bandits on the western stretch have been growing bold — hit two caravans last week. The fungal forest is spreading east faster than usual. And I heard the hermit on Ashfall Peak is offering spell scrolls to anyone who can answer his riddles. Useful information, that. First one's free. Second costs a silver.\"" },
      { text: "I could escort you somewhere, for a fee.",
        response: "\"Actually... I was going to ask. The road to Millhaven village has gotten dangerous. A pack of gnolls moved in near the bridge crossing. If you'll walk with me for the next two hexes, I'll give you first pick from my rare stock when we arrive. And a twenty percent discount for life. Deal?\"" },
    ],
  ),
};

export const NPC_HERMIT_SAGE: NPC = {
  id: "npc_hermit_sage",
  name: "Urzen the Undying",
  title: "Hermit Sage",
  location: { q: 30, r: 28 },
  locationName: "Ashfall Peak",
  category: "wilderness",
  disposition: 10,
  quests: ["quest_sage_riddle", "quest_forgotten_spell"],
  services: [
    { type: "identify", name: "Ancient Lore", costCp: 0, description: "Will identify any magical item for free — if you can answer a riddle." },
  ],
  portrait: {
    race: "human", gender: "male", age: "ancient", build: "thin",
    hair: "white beard reaching his knees, tied with copper wire",
    distinguishing: "Skin like parchment stretched over bone, eyes that change color when he speaks of magic",
    attire: "Robes that might have been fine a century ago, now more patch than original cloth, a staff of twisted driftwood",
  },
  dialogue: simpleDialogue(
    "The old man sits cross-legged before a fire that burns without fuel. He doesn't look up. \"You climbed the peak. That means you want something badly enough to bleed for it. Ask your question — but know that I trade in riddles, not charity.\"",
    [
      { text: "I seek knowledge of the arcane.",
        response: "\"Knowledge. Everyone wants knowledge. Nobody wants wisdom, which is knowing when to stop seeking knowledge.\" His eyes shift from blue to amber. \"I have spell scrolls — old ones, powerful ones. Bring me a riddle I haven't heard before, and I'll trade you one. Bring me a boring riddle and I'll turn you into a newt for wasting my time. Probably.\"" },
      { text: "What do you know about the Vessel of Namaris?",
        response: "He finally looks at you, and his eyes go dark as coal. \"The Vessel is not what the Guild thinks it is. It does not transmute — it consumes. The original builders sealed it away for a reason. But nobody listens to old men on mountains.\" He turns back to his impossible fire. \"That warning is free. The next answer costs a riddle.\"" },
      { text: "Can you identify this item for me?",
        response: "\"I can. But first — answer me this: What has cities but no houses, forests but no trees, and water but no fish?\" He watches you with those shifting eyes. \"A map. If you knew that already, you're clever enough to deserve my help. Show me what you carry.\"" },
    ],
  ),
};

export const NPC_RANGER_GUIDE: NPC = {
  id: "npc_ranger_guide",
  name: "Kael Swiftbow",
  title: "Ranger of the Outer Reaches",
  location: { q: 32, r: 26 },
  locationName: "Ranger Outpost, Northern Forest",
  category: "wilderness",
  disposition: 30,
  faction: "temple_windcaller",
  quests: ["quest_track_beast", "quest_map_wilderness"],
  services: [
    { type: "transport", name: "Guide Through Wilderness", costCp: 1500, description: "Safely escort through dangerous terrain. Halves random encounter chance for 3 hexes." },
  ],
  portrait: {
    race: "half-orc", gender: "male", age: "young", build: "muscular",
    hair: "short black mohawk, sides shaved clean",
    distinguishing: "Tusks filed to points, a living hawk perched perpetually on his shoulder",
    attire: "Green-dyed leather armor blending with the forest, a bow longer than most men are tall",
  },
  dialogue: simpleDialogue(
    "The ranger drops from a tree branch without a sound, landing in a crouch before you. His hawk screams once. \"Easy. I'm not hunting you. But something is — there are tracks following yours from two hexes back. Want to know what's on your trail, or would you rather be surprised?\"",
    [
      { text: "What's following me?",
        response: "\"A pack of hill wolves. Four of them, from the size of the prints. They've been shadowing you since you passed the standing stones. They won't attack while you're alert, but the moment you sleep without a fire...\" He shrugs. \"I can guide you through safer territory. Or I can teach you to read tracks well enough to avoid them yourself. Your choice.\"" },
      { text: "I need someone to help me map this area.",
        response: "\"I've walked every hex within twenty miles of this outpost. For a fee, I'll mark your map with safe routes, water sources, and the places where things with too many teeth live. Fifteen gold gets you the whole northern region. Or — help me track a creature that's been killing the deer herds, and I'll do it for free.\"" },
      { text: "I've been sent to find you — a letter from Kardov's Gate.",
        response: "He takes the letter and reads it without expression, then tucks it into his belt. \"The city wants me to come back. They always want me to come back. Tell them what I always tell them: the forest needs me more than their walls do. But if they've got work that involves the wild — tracking, scouting, hunting something dangerous — send it this way. I'll listen.\"" },
    ],
  ),
};

export const NPC_BANDIT_CHIEF: NPC = {
  id: "npc_bandit_chief",
  name: "Redtooth Varras",
  title: "Bandit Chief",
  location: { q: 28, r: 34 },
  locationName: "Broken Bridge Camp",
  category: "wilderness",
  disposition: -30,
  quests: ["quest_bandit_toll", "quest_rival_camp"],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "heavy",
    hair: "shaved head, a crude crown tattooed around his temples",
    distinguishing: "Front teeth filed to points and stained red with some herb, a necklace of knuckle bones",
    attire: "Mismatched armor looted from a dozen victims, a greatsword too large for most men strapped to his back",
  },
  dialogue: {
    startNode: "start",
    nodes: {
      start: {
        id: "start",
        text: "A wall of armed men blocks the road. Their leader steps forward — a mountain of scarred flesh wearing dead men's armor. He grins, revealing filed red teeth. \"Toll road. Twenty gold or everything you're carrying. Your choice how this goes.\"",
        speaker: "npc",
        options: [
          { text: "Here's your twenty. [20 gp]", nextNode: "pay", effects: [{ type: "take_coins", costCp: 2000 }] },
          { text: "[Intimidate DC 18] I'd rethink that demand.", nextNode: "intimidate",
            skillCheck: { stat: "intimidate", dc: 18, successNode: "intimidate_success", failNode: "intimidate_fail" } },
          { text: "[Diplomacy DC 20] What if I had something better than gold?", nextNode: "negotiate",
            skillCheck: { stat: "diplomacy", dc: 20, successNode: "negotiate_success", failNode: "negotiate_fail" } },
          { text: "Try and take it.", nextNode: "fight" },
        ],
      },
      pay: {
        id: "pay",
        text: "He snatches the coins and bites one. \"Smart. You can pass. Tell anyone on the road that Redtooth's toll is fair — pay and you walk. Fight and you don't. Good for business.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "paid_redtooth", value: true }],
        options: [{ text: "[Continue on the road]", nextNode: "END" }],
      },
      intimidate_success: {
        id: "intimidate_success",
        text: "Something in your eyes gives him pause. His grin falters. \"...Right. Well. Professional courtesy, then. Pass freely. This time.\" His men shift uneasily as they part to let you through.",
        speaker: "npc",
        effects: [{ type: "change_disposition", npcId: "npc_bandit_chief", amount: 10 }],
        options: [{ text: "[Walk through without looking back]", nextNode: "END" }],
      },
      intimidate_fail: {
        id: "intimidate_fail",
        text: "He laughs — loud, genuine, delighted. \"Oh, I LIKE you. But no. Twenty gold or steel. Those are still the options.\"",
        speaker: "npc",
        options: [
          { text: "Fine. Twenty gold. [20 gp]", nextNode: "pay", effects: [{ type: "take_coins", costCp: 2000 }] },
          { text: "Steel it is.", nextNode: "fight" },
        ],
      },
      negotiate_success: {
        id: "negotiate_success",
        text: "His eyes narrow with interest. \"Talk. Quickly.\" You explain that you know about a rival bandit camp — one that's been poaching his territory. His expression shifts from greed to fury. \"WHERE? Tell me where they are and you pass free — now and forever. My word on it.\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "bandit_alliance", value: true }],
        options: [
          { text: "I'll bring you their location. [Accept quest]", nextNode: "rival_accept", effects: [{ type: "accept_quest", questId: "quest_rival_camp" }] },
          { text: "West of the river fork. Three days' march.", nextNode: "rival_told" },
        ],
      },
      rival_accept: {
        id: "rival_accept",
        text: "\"Find their camp — a group called the Thornbacks, led by a woman named Ash. They've been hitting MY merchants on MY road. Bring me their banner or their leader's ear, and you're a friend of Redtooth forever. Free passage, discounted... services.\"",
        speaker: "npc",
        options: [{ text: "I'll find them.", nextNode: "END" }],
      },
      rival_told: {
        id: "rival_told",
        text: "\"West of the fork...\" He commits it to memory. \"Good. You pass — today, tomorrow, always. Redtooth remembers his friends.\" He waves his men aside with a meaty hand.",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "redtooth_friend", value: true }],
        options: [{ text: "[Continue on the road]", nextNode: "END" }],
      },
      negotiate_fail: {
        id: "negotiate_fail",
        text: "\"Nice try. But I've heard better from men with knives at their throats. Twenty gold. Last time I'm asking politely.\"",
        speaker: "npc",
        options: [
          { text: "Fine. [20 gp]", nextNode: "pay", effects: [{ type: "take_coins", costCp: 2000 }] },
          { text: "Then we do this the hard way.", nextNode: "fight" },
        ],
      },
      fight: {
        id: "fight",
        text: "He draws his greatsword with a sound like a coffin lid sliding open. \"I was hoping you'd say that. BOYS! DINNER!\"",
        speaker: "npc",
        effects: [{ type: "set_flag", flag: "bandit_fight_triggered", value: true }],
        options: [{ text: "[Combat begins]", nextNode: "END" }],
      },
    },
  },
};

export const NPC_DRUID_ELDER: NPC = {
  id: "npc_druid_elder",
  name: "Grandmother Thornweave",
  title: "Elder of the Druid Circle",
  location: { q: 30, r: 26 },
  locationName: "The Sacred Grove",
  category: "wilderness",
  disposition: 25,
  faction: "temple_earthmother",
  quests: ["quest_corrupted_spring", "quest_animal_companion"],
  services: [
    { type: "heal", name: "Nature's Balm", costCp: 500, description: "Herbal healing — slower but thorough. Removes poison and disease as well." },
    { type: "remove_curse", name: "Purification Ritual", costCp: 3000, description: "A day-long ritual to cleanse curses using moonlight and sacred water." },
  ],
  portrait: {
    race: "human", gender: "female", age: "ancient", build: "thin",
    hair: "white, woven with living vines and small flowers",
    distinguishing: "Bark-like skin on her hands and forearms, speaks to animals and they answer",
    attire: "Layered robes of undyed wool and woven grass, a staff crowned with a living acorn that glows green",
  },
  dialogue: simpleDialogue(
    "The old woman sits among tree roots that curve around her like a throne. A fox sleeps in her lap. Butterflies orbit her head in a lazy spiral. \"The forest told me you were coming. Sit. Tell me why you carry so much iron — it offends the old trees.\"",
    [
      { text: "The spring to the north — something's wrong with it.",
        response: "\"Yes. I have felt it for weeks. A corruption — not natural decay, but something injected. Poison magic, or perhaps an alchemical spill from the Guild's experiments.\" Her expression hardens. \"Find the source and cleanse it. The spring feeds three villages downstream. If it dies, they die. I'll teach you the purification rite if you lack the skill.\"" },
      { text: "I'd like an animal companion.",
        response: "\"Animals are not possessions. They are partners. But...\" She studies you for a long moment. \"Prove you understand them. Spend a day in the forest without weapon or armor. Sleep on the ground. Eat only what the land provides. If something comes to you — willingly — then it chose you. That is the only way.\"" },
      { text: "I seek your healing arts.",
        response: "\"Lay your hands upon the oak root and be still.\" Warmth flows through the wood into your bones. It doesn't feel like magic — it feels like the tree remembering what wholeness is. \"Five gold for the temple's coffers. Not mine — the grove needs nothing. But the temple feeds children in winter.\"" },
    ],
  ),
};

export const NPC_WOUNDED_KNIGHT: NPC = {
  id: "npc_wounded_knight",
  name: "Sir Aldric Crane",
  title: "Knight of the Dawn",
  location: { q: 33, r: 35 },
  locationName: "Roadside (wounded)",
  category: "wilderness",
  disposition: 50,
  faction: "temple_dawnfire",
  quests: ["quest_escort_knight"],
  portrait: {
    race: "human", gender: "male", age: "young", build: "muscular",
    hair: "blonde, matted with blood",
    distinguishing: "A deep gash across his shield arm, the Dawnfire symbol branded on his cheek",
    attire: "Dented plate armor missing the left pauldron, a holy sword still clutched in his good hand",
  },
  dialogue: simpleDialogue(
    "A knight in battered armor leans against a milestone, one arm hanging useless and dark with blood. He tries to stand when he sees you and nearly falls. \"Wait — please. I'm not... I'm not a bandit. I'm Sir Aldric, of the Dawnfire order. I was ambushed. My horse is dead. I need help reaching the temple or I'll bleed out before nightfall.\"",
    [
      { text: "I'll get you to the temple. Lean on me.",
        response: "Relief floods his pale face. \"The gods sent you. I swear it. Get me to the High Luminar and I'll see you rewarded — the Order remembers those who aid its own. It's two hexes east... I can make it if you help.\"" },
      { text: "What ambushed you?",
        response: "\"Gnolls. A war party, eight or ten strong. They came from the treeline without warning — my horse took the first javelin.\" He winces. \"They're moving toward the farmlands. Someone needs to warn the villages... but I can barely stand. Will you help me?\"" },
      { text: "I can treat your wound first. [Heal check]",
        response: "You bind the wound with strips of his own cloak. The bleeding slows. \"Better. Thank you.\" He breathes more steadily. \"I still need to reach the temple, but I won't die in the next hour at least. If you can spare the time to escort me...\"" },
    ],
  ),
};

export const NPC_MYSTERIOUS_STRANGER: NPC = {
  id: "npc_mysterious_stranger",
  name: "The Hooded Figure",
  title: "Unknown",
  location: { q: 31, r: 30 },
  locationName: "The Crossroads",
  category: "wilderness",
  disposition: 0,
  quests: ["quest_vessel_namaris_3", "quest_true_nature"],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "average",
    hair: "hidden beneath a deep cowl",
    distinguishing: "Face entirely in shadow regardless of light source, voice seems to come from everywhere at once",
    attire: "A cloak the color of twilight — not quite blue, not quite gray — that seems to absorb light rather than reflect it",
  },
  dialogue: simpleDialogue(
    "A figure stands at the crossroads where no one stood a moment ago. Their face is shadow. Their voice reaches you like wind through a keyhole. \"You carry the weight of a quest not yet understood. The Vessel is not a prize to be won. It is a door to be sealed. Choose your next steps carefully — the Guild and the Temple both lie about what it is.\"",
    [
      { text: "Who are you?",
        response: "\"Someone who was there when the Vessel was sealed the first time. Someone who will be there when it opens again — one way or another.\" The shadow where a face should be tilts. \"Names have power. I will not give you mine. Not yet. Earn the answer.\"" },
      { text: "What is the Vessel really?",
        response: "\"Not a tool of transmutation. Not a weapon. It is a cage — and the thing inside it has been dreaming for nine hundred years. The Guild thinks they can study it. The Temple thinks they can destroy it. Both are wrong. Only silence keeps it sleeping.\" The figure begins to fade. \"Find the Hermit. He knows part of the truth.\"" },
      { text: "I don't trust cryptic strangers.",
        response: "A sound that might be laughter. \"Good. Distrust is the first armor of the wise. But consider: I could have let you walk into the Blackwood blind. I chose not to. Make of that what you will.\" The figure is gone. A single raven feather lies where they stood." },
    ],
  ),
};

export const NPC_MINE_FOREMAN: NPC = {
  id: "npc_mine_foreman",
  name: "Guldric Picksworth",
  title: "Foreman of Craghollow Mine",
  location: { q: 29, r: 27 },
  locationName: "Craghollow Mine",
  category: "wilderness",
  disposition: 40,
  quests: ["quest_mine_spiders", "quest_ore_delivery"],
  portrait: {
    race: "dwarf", gender: "male", age: "middle", build: "stocky",
    hair: "red, perpetually dusted with rock powder",
    distinguishing: "Three fingers missing on left hand (mining accident), wears a helmet with two candles mounted on it",
    attire: "Reinforced leather work clothes, tool belt heavy with hammers and chisels, steel-toed boots",
  },
  dialogue: simpleDialogue(
    "A squat dwarf with a candled helmet pushes through the mine entrance, coughing dust. \"What? Who's — oh. An adventurer. Good. I've got problems only a sword can solve and my miners don't carry 'em. Come to work or come to buy ore?\"",
    [
      { text: "What kind of problems?",
        response: "\"Spiders. Big ones — dog-sized, and they've webbed off the lower tunnels where our best iron vein runs. Lost two men last week before we sealed the passage. Clear 'em out and I'll pay you in iron ingots or coin — your choice. Twenty gold or sixty pounds of raw iron.\"" },
      { text: "I need to transport ore somewhere.",
        response: "\"If you're heading to Kardov's Gate, I've got six crates ready for the smiths there. Korrin Ironjaw's been screaming for his shipment but I can't spare men for escort duty while those spiders are in the lower shafts. Deliver 'em and Korrin'll pay you on arrival. Tell him Guldric sends his regards and his apologies.\"" },
      { text: "Just buying. What ore do you have?",
        response: "\"Iron, mostly. Some copper. Occasionally we hit a silver pocket, but those go straight to the Guild's order. For adventurers I can sell raw iron at two gold per ingot, or copper at five silver. Good quality — Craghollow iron makes the best steel east of the mountains.\"" },
    ],
  ),
};

export const NPC_FARMER: NPC = {
  id: "npc_farmer",
  name: "Tommas Greenfield",
  title: "Farmer",
  location: { q: 34, r: 35 },
  locationName: "Greenfield Farm",
  category: "wilderness",
  disposition: 50,
  faction: "farmers",
  quests: ["quest_wolf_pack", "quest_harvest_delivery"],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "stocky",
    hair: "sun-bleached brown, perpetually windswept",
    distinguishing: "Hands like leather from decades of fieldwork, a permanent squint from staring at horizons",
    attire: "Homespun wool shirt, patched trousers, heavy boots caked with field mud",
  },
  dialogue: simpleDialogue(
    "The farmer straightens from his work, wiping sweat from his brow with a callused hand. \"Adventurer, eh? Don't get many of your sort out here. You looking to buy food, or are you the type that solves problems? Because I've got both.\"",
    [
      { text: "What problems?",
        response: "\"Wolves. A pack moved down from the highlands last month — took three of my sheep and killed my best dog. They den somewhere in the rocks north of here. Drive 'em off or kill 'em, I don't care which. I can't pay much — ten gold and all the fresh food you can carry. But my wife makes a stew that's worth more than gold to a hungry man.\"" },
      { text: "I could haul goods to market for you.",
        response: "\"Could you? Harvest is in and I've got three wagons of grain that need to reach Kardov's Gate before the rains hit. Road's normally safe, but those bloody bandits at the bridge have been bold lately. Get my grain to the market hall and I'll pay you eight gold plus a share of the sale price. Fair?\"" },
      { text: "What do you know about the Vessel of Namaris?",
        response: "He snorts. \"Fairy tales to lure young fools into the wilderness. Half my farmhands ran off last week chasing that rumor. Want my opinion? It's the Guild drumming up business — they need adventurers to scout the Blackwood for them and this is cheaper than paying proper soldiers. But don't tell 'em I said that.\"" },
    ],
  ),
};

export const NPC_PRIEST: NPC = {
  id: "npc_priest",
  name: "Brother Calwen",
  title: "Traveling Priest",
  location: { q: 32, r: 33 },
  locationName: "Roadside Shrine",
  category: "wilderness",
  disposition: 55,
  faction: "temple_tidewarden",
  quests: ["quest_bless_shrines", "quest_undead_farmstead"],
  services: [
    { type: "heal", name: "Lay On Hands", costCp: 200, description: "Basic healing through faith. Restores 2d6 HP." },
    { type: "remove_curse", name: "Lesser Exorcism", costCp: 2000, description: "Remove minor curses and possession." },
  ],
  portrait: {
    race: "human", gender: "male", age: "young", build: "average",
    hair: "tonsured brown, freshly trimmed",
    distinguishing: "Kind, tired eyes, a water-drop holy symbol that actually drips — an ongoing minor miracle",
    attire: "Simple blue robes of the Tidewarden order, sandals despite the cold, a walking staff topped with a coral shell",
  },
  dialogue: simpleDialogue(
    "A young priest kneels before a roadside shrine, murmuring prayers while his holy symbol drips steady water onto the offering stone. He rises with a gentle smile. \"Blessings of the Tide upon you, traveler. You look weary. May I offer rest or healing?\"",
    [
      { text: "I need healing.",
        response: "\"The Tidewarden gives freely to those who ask. Two gold covers the temple's tithe — the healing itself is a gift.\" He places his damp hands on your wounds, and the water from his symbol seems to flow through you. Warmth and coolness simultaneously, like a fever breaking. \"Go gently. The body remembers its hurts even after the flesh forgets.\"" },
      { text: "Are there other shrines like this that need tending?",
        response: "\"Seven shrines between here and the eastern coast, and I can only visit each one once a month. Three haven't been blessed in over two months — I fear they're drawing undead. If you carry holy water and know the blessing rite — or if you'll learn it from me — tending those shrines would be a service to every traveler on these roads. I can pay a small stipend from the temple fund.\"" },
      { text: "I've heard of undead near the farmsteads.",
        response: "\"Yes. I've seen them too — risen dead from the old burial grounds. The wards are failing because the shrines go untended. But there's more to it than neglect. Someone is actively desecrating the graves. I found dig marks — fresh, with tool marks. Someone is raising them deliberately. I don't have the strength to fight. But you might.\"" },
    ],
  ),
};

export const NPC_PIRATE_CAPTAIN: NPC = {
  id: "npc_pirate_captain",
  name: "Captain Morrigan Blacktide",
  title: "Pirate Captain",
  location: { q: 38, r: 34 },
  locationName: "Hidden Cove, East Coast",
  category: "wilderness",
  disposition: -20,
  quests: ["quest_sunken_treasure", "quest_navy_chart"],
  portrait: {
    race: "human", gender: "female", age: "middle", build: "muscular",
    hair: "black and wild, decorated with shells and a single braided gold chain",
    distinguishing: "A curved scar from temple to jaw, both ears pierced with shark teeth, one hand replaced with a steel hook",
    attire: "Long red coat over a breastplate, sea-stained boots, a cutlass and three pistol-crossbows at her belt",
  },
  dialogue: simpleDialogue(
    "The pirate captain lounges on a rock like a queen on a throne, her crew busy careening their ship in the cove below. She levels a crossbow-pistol at you with casual ease. \"Private beach. State your business before my patience runs out — which it does, quickly.\"",
    [
      { text: "I'm no threat to you. I'm looking for work.",
        response: "\"Work. On my ship?\" She laughs. \"I don't need swords — I need a diver. There's a wreck in the deep channel, too far down for my crew. Ancient galleon, loaded with temple gold when it sank. I'll split it sixty-forty — my favor — if you can get down there and crack the hold. Interested, or are you afraid of the dark water?\"" },
      { text: "The Harbor Master is looking for you.",
        response: "Her grin turns to ice. \"Old Saltblood can look all he likes. He's never caught me in twenty years and he won't start now.\" She taps the crossbow against her hook. \"But tell me — did he offer a bounty? If it's less than a hundred gold, I'm insulted. If it's more, maybe I should turn myself in and escape. Either way, don't bring the law to my cove again.\"" },
      { text: "I need passage to somewhere the regular ships won't go.",
        response: "\"Now THAT'S interesting.\" She leans forward. \"I go where I please and nobody checks my manifests. But passage on the Blacktide costs. Fifty gold and a favour — one job, my choice, no questions. I'll take you anywhere on the coast, including the places the maps say 'here be monsters.' Deal?\"" },
    ],
  ),
};

export const NPC_REFUGEE: NPC = {
  id: "npc_refugee",
  name: "Essara",
  title: "Displaced Villager",
  location: { q: 35, r: 36 },
  locationName: "South Road (fleeing)",
  category: "wilderness",
  disposition: 40,
  quests: ["quest_escort_refugees"],
  portrait: {
    race: "human", gender: "female", age: "young", build: "thin",
    hair: "dark, hastily covered with a headscarf",
    distinguishing: "Hollow eyes from days without sleep, clutching a bundled infant, ash smudges on her face",
    attire: "What was once a decent homespun dress, now torn and singed at the hem, carrying everything she owns in a single sack",
  },
  dialogue: simpleDialogue(
    "A young woman hurries down the road with a baby on her hip and terror in her eyes. She flinches when she sees you, then stops — too exhausted to run further. \"Please — are you from the city? We need help. Our village burned. There are more of us in the woods, hiding. The children...\"",
    [
      { text: "What happened? Take a breath.",
        response: "\"Gnolls. A raiding party — they came at dawn. Burned the granary, killed anyone who fought. My husband... he stayed so we could run.\" She swallows hard. \"There are twelve of us in the treeline back there. Six children. We need to reach Kardov's Gate but the road isn't safe. If those gnolls catch up... please. I have nothing to pay but I'll work. Anything.\"" },
      { text: "I'll escort you. How far are the others?",
        response: "\"Half a mile back, in the thick brush off the road. They're afraid to move in daylight.\" Relief breaks across her face like sunrise. \"The city is maybe four hexes from here? If you can walk with us, keep the gnolls off our backs... the children are slowing us down. We can't fight. We just need someone between us and whatever's out there.\"" },
      { text: "Here — take this food and these coins.",
        response: "She stares at the offering, then at you, then bursts into tears. The baby fusses. \"Thank you. Thank you. But food won't save us if the gnolls find our trail. We need protection more than charity. Will you... will you walk with us? Please?\"" },
    ],
  ),
};

// ── DUNGEON NPCs (5) ─────────────────────────────────────────────────────────

export const NPC_TRAPPED_ADVENTURER: NPC = {
  id: "npc_trapped_adventurer",
  name: "Hazel Quickfoot",
  title: "Trapped Adventurer",
  location: { q: 0, r: 0 }, // placed dynamically in dungeons
  locationName: "Dungeon (varies)",
  category: "dungeon",
  disposition: 70,
  quests: ["quest_free_adventurer"],
  portrait: {
    race: "halfling", gender: "female", age: "young", build: "thin",
    hair: "red curls, matted with cobwebs and dungeon grime",
    distinguishing: "Quick, darting eyes assessing every exit, fidgets constantly",
    attire: "Leather armor with half the buckles broken, a dagger still strapped to one boot",
  },
  dialogue: simpleDialogue(
    "\"HEY! Over here! In the cage!\" A small figure rattles the bars of a rusted iron cage suspended from the ceiling. \"Get me out of here before whatever put me in comes back! I've got lockpicks in my boot — if I could REACH them — but the cage is too small to bend. Help me and I'll split my stash with you. It's hidden two rooms back. Real treasure, I swear!\"",
    [
      { text: "Hold still — I'll break the lock. [Open Lock DC 15 or STR DC 18]",
        response: "The lock gives with a screech of rust. She drops to the floor, rolls, and comes up grinning. \"You beauty! I'm Hazel — Hazel Quickfoot. Been stuck up there three days. My partner ran off and left me. When I find him...\" She cracks her knuckles. \"Come on — I said I'd split the stash and I meant it. This way.\"" },
      { text: "What's in it for me?",
        response: "\"Practical type? I respect that. Two rooms back there's a hidden panel — I found it before the trap caught me. Inside: a gold necklace, some gems, and a scroll that glowed blue. Yours to split. Plus — I'm useful. Quick fingers, sharp eyes, small enough to fit where you can't. Free me and I'll stick with you through this dungeon. Deal?\"" },
      { text: "How do I know this isn't a trap?",
        response: "\"Look at me! I'm three feet tall, covered in dirt, and stuck in a BIRD CAGE. If this is a trap, it's the worst one ever designed!\" She rattles the bars again for emphasis. \"I just want out. Please. I can hear something shuffling in the dark and I really, really don't want to be hanging here when it arrives.\"" },
    ],
  ),
};

export const NPC_DUNGEON_MERCHANT: NPC = {
  id: "npc_dungeon_merchant",
  name: "Ghazrik",
  title: "Dungeon Merchant",
  location: { q: 0, r: 0 }, // placed dynamically in dungeons
  locationName: "Dungeon (varies)",
  category: "dungeon",
  disposition: 35,
  quests: [],
  services: [
    { type: "repair", name: "Emergency Repair", costCp: 500, description: "Battlefield fix. It'll hold — probably." },
  ],
  portrait: {
    race: "gnome", gender: "male", age: "old", build: "thin",
    hair: "wispy white tufts poking from beneath a ridiculous feathered cap",
    distinguishing: "One eye permanently squinting through a jeweler's loupe, smells strongly of pipe smoke",
    attire: "A coat with more pockets than fabric, each one bulging with merchandise, tiny bells jingling with every movement",
  },
  dialogue: simpleDialogue(
    "In a cleared alcove of the dungeon, a gnome sits behind a folding table covered in goods, calmly smoking a pipe as if this were a market stall. A sign reads: \"GHAZRIK'S EMPORIUM - PRICES FAIR (for a dungeon)\". He waves cheerfully. \"Customer! Welcome, welcome. Everything's double city price — danger markup, you understand. Supply and demand, mostly demand.\"",
    [
      { text: "How are you even alive in here?",
        response: "\"Trade secret. Let's just say the things in this dungeon and I have an... arrangement. They don't eat me, I don't sell adventurers the maps to their lairs. Everybody's happy.\" He puffs his pipe. \"Except my customers. They're usually bleeding. Speaking of which — healing potions, torches, rope? Name your need.\"" },
      { text: "Show me what you've got.",
        response: "\"Healing potions — one hundred gold each. Torches, ten gold a bundle. Rope, fifteen gold for fifty feet. Antidotes, seventy gold. Yes, it's expensive. You're welcome to go back to the surface and buy cheaper. I'll wait.\" He grins. \"Still here? Then let's do business.\"" },
      { text: "Do you know anything about what's deeper in?",
        response: "\"I know exactly what's deeper in. I also know that information is my most valuable commodity.\" He taps his loupe. \"Five gold per question, answers guaranteed accurate. Or buy twenty gold worth of goods and I'll throw in one tip for free. Gnomish hospitality.\"" },
    ],
  ),
};

export const NPC_GHOST: NPC = {
  id: "npc_ghost",
  name: "The Weeping Lady",
  title: "Restless Spirit",
  location: { q: 0, r: 0 }, // placed dynamically in dungeons
  locationName: "Dungeon (varies)",
  category: "dungeon",
  disposition: 20,
  quests: ["quest_ghost_remains"],
  portrait: {
    race: "human", gender: "female", age: "young", build: "thin",
    hair: "translucent silver, floating as if underwater",
    distinguishing: "Semi-transparent, faint blue glow, tear tracks permanently etched on spectral cheeks",
    attire: "A funeral gown from a century past, moth-holes that glow with inner light",
  },
  dialogue: simpleDialogue(
    "The air drops ten degrees. A figure materializes from the wall — a young woman in ancient burial clothes, weeping without sound. She sees you and the tears stop. Her lips move, and the words arrive a moment after. \"You... can see me. No one sees me. No one has seen me in so long...\"",
    [
      { text: "Who are you? Why are you here?",
        response: "\"I was... I am... Elara. I was buried here. Alive.\" The temperature drops further. \"My family — they said I was dead. I wasn't. I woke in the dark. In the stone.\" Her form flickers with anger, then settles to sadness. \"I cannot leave. My bones are here, somewhere. If you find them — if you take them to the surface, to real earth and real sky — I could finally rest.\"" },
      { text: "Do you know the way deeper into this place?",
        response: "\"I know every stone. I've had centuries to count them.\" Her ghostly hand points to the left wall. \"The passage behind the third sconce leads down. The door with the iron face is trapped — push the left eye, not the right. And the creature in the flooded room is blind but hears everything. Walk softly.\" She begins to fade. \"Help me, and I'll guide you wherever you need to go.\"" },
      { text: "Are there others like you down here?",
        response: "\"Others? Yes. But not like me.\" Her expression shifts to fear. \"The angry ones — the ones who died in pain — they won't talk. They'll claw at you, try to make you join them in the dark. I was different. I died of despair, not violence. That left me... softer.\" She reaches toward you but her hand passes through. \"Be careful of the angry dead.\"" },
    ],
  ),
};

export const NPC_IMPRISONED_NOBLE: NPC = {
  id: "npc_imprisoned_noble",
  name: "Lord Veyren Ashmore",
  title: "Imprisoned Nobleman",
  location: { q: 0, r: 0 }, // placed dynamically in dungeons
  locationName: "Dungeon (varies)",
  category: "dungeon",
  disposition: 60,
  quests: ["quest_noble_ransom"],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "average",
    hair: "once-fine dark hair now lank and greasy",
    distinguishing: "Signet ring on his finger (too tight to remove — his captors tried), patrician nose, haunted eyes",
    attire: "Remnants of expensive clothes reduced to rags, bare feet, bruises visible on arms and face",
  },
  dialogue: simpleDialogue(
    "In a cell at the dungeon's heart, a man in ruined finery presses against the bars. His voice cracks from disuse. \"Thank the gods — a living soul. I am Lord Veyren Ashmore of the Eastern Holdings. I've been held here for... I don't know how long. Weeks? Months? Please — my family will pay whatever you ask. Just get me out of here alive.\"",
    [
      { text: "Who captured you?",
        response: "\"Bandits — but organized ones. They knew my route, knew my guard rotation. This was planned. They sent a ransom demand to my wife but...\" He swallows. \"I don't know if she received it. Or if she can pay. Two hundred gold they asked for. If you bring me to Kardov's Gate, I'll pay you fifty gold from my family's accounts. I swear it on my name.\"" },
      { text: "I'll get you out. Stay close and stay quiet.",
        response: "\"Yes. Yes — anything you say. I can't fight, I'm sorry — they broke two of my fingers and I can barely stand. But I won't slow you down, I swear. Just... keep me between you and whatever else lives in this pit.\" He grips the bars with white knuckles. \"Please don't leave me here.\"" },
      { text: "Fifty gold isn't much for a lord's life.",
        response: "He flinches. \"I... you're right. Seventy-five. And a letter of introduction to the Eastern Trading Company — that's worth more than gold in the long term. My family controls shipping routes. Please. Name your price. Within reason, it's yours. I just want to see sunlight again.\"" },
    ],
  ),
};

export const NPC_RIVAL_EXPLORER: NPC = {
  id: "npc_rival_explorer",
  name: "Castellan Vex",
  title: "Rival Explorer",
  location: { q: 0, r: 0 }, // placed dynamically in dungeons
  locationName: "Dungeon (varies)",
  category: "dungeon",
  disposition: -10,
  quests: ["quest_race_to_treasure"],
  portrait: {
    race: "tiefling", gender: "female", age: "young", build: "muscular",
    hair: "cropped red with small horns curving back from the temples",
    distinguishing: "Golden eyes with slit pupils, a confident smirk, tail wrapped around her waist like a belt",
    attire: "Expensive but practical explorer's gear — leather, brass buckles, many pouches, a rapier at her hip",
  },
  dialogue: simpleDialogue(
    "Around the corner, you nearly collide with another explorer — a tiefling woman mapping the walls with chalk. She looks you up and down with obvious amusement. \"Well, well. Competition. I was hoping to have this place to myself, but that was optimistic.\" She flourishes a half-drawn map. \"Tell you what — race you to the treasure room. Winner takes the best piece. Loser gets scraps. Unless you'd prefer to cooperate?\"",
    [
      { text: "Cooperate how?",
        response: "\"I've mapped the upper levels. You've presumably cleared the lower passages I heard fighting from. We share notes, split the haul fifty-fifty, and neither of us has to watch their back for the other. It's efficient.\" She extends a hand. \"Castellan Vex. Professional explorer, occasional thief, full-time pragmatist. Partners?\"" },
      { text: "A race? You're on.",
        response: "Her grin widens. \"Excellent. I do love a motivated opponent.\" She tucks her map away. \"Rules: first one to the deepest chamber claims the primary treasure. Anything you pick up along the way is yours. No sabotage, no collapsing passages behind you. I like to win fair — it's more satisfying.\" She takes off at a sprint. \"See you there!\"" },
      { text: "Stay out of my way and I'll stay out of yours.",
        response: "\"Cold but fair. I'll take the left passages, you take the right. If we meet at the bottom... well, we'll sort it out then.\" She marks something on her map and heads left without looking back. \"Try not to die — I'd hate to find your corpse blocking a doorway.\"" },
    ],
  ),
};

// ── FACTION LEADERS (5) — WoW Integration ───────────────────────────────────

export const NPC_KING_ALDRIC: NPC = {
  id: "npc_king_aldric",
  name: "King Aldric Stormhold",
  title: "Ruler of the Northern Reach",
  location: { q: 25, r: 22 },
  locationName: "Stormhold Keep",
  category: "faction_leader",
  disposition: 20,
  quests: ["quest_northern_alliance", "quest_defend_border"],
  portrait: {
    race: "human", gender: "male", age: "middle", build: "muscular",
    hair: "iron gray, cropped military short",
    distinguishing: "Battle scars visible even on his face, a crown forged from enemy swords",
    attire: "Full plate armor even at court, a fur-trimmed cloak, a warhammer leaning against his throne",
  },
  dialogue: simpleDialogue(
    "The King of the Northern Reach sits his throne like a soldier sits a horse — ready to move at any moment. Guards twice your size flank him. He speaks without preamble. \"State your name, your business, and why I shouldn't have you thrown out. I'm a busy man.\"",
    [
      { text: "I seek alliance. Your borders are threatened.",
        response: "\"Tell me something I don't know.\" But he leans forward. \"The south moves against us. The eastern kingdoms play games. If you have intelligence — real intelligence, not tavern gossip — I'll hear it. And if you're willing to carry a message to my generals in the field, there's gold and titles in it for you. The North rewards those who serve.\"" },
      { text: "I've come to offer my sword.",
        response: "\"One more sword doesn't win wars. But one good spy? One agent who moves freely where my army cannot?\" He studies you. \"Prove yourself. There's a border fort three days north — Fort Graymark. It's gone silent. Find out why. If it's fallen, I need to know to whom. Report back here and you'll have the North's ear.\"" },
      { text: "I'm merely passing through your lands.",
        response: "\"Then pass quickly and quietly. The roads are watched. My people are nervous. Don't give them cause to be more so.\" He waves a dismissive hand. \"If you change your mind about usefulness, speak to my chancellor. The door is that way.\"" },
    ],
  ),
};

export const NPC_QUEEN_LYANA: NPC = {
  id: "npc_queen_lyana",
  name: "Queen Lyana Verdain",
  title: "Sovereign of the Green Marches",
  location: { q: 22, r: 35 },
  locationName: "Verdain Palace",
  category: "faction_leader",
  disposition: 35,
  quests: ["quest_green_diplomacy", "quest_trade_route"],
  portrait: {
    race: "elf", gender: "female", age: "middle", build: "thin",
    hair: "golden-brown, woven with living leaves that change with the seasons",
    distinguishing: "Speaks in a voice like wind through branches, eyes the deep green of old forest",
    attire: "Armor made of layered bark and living vines, a crown of antlers, a longbow worth more than most houses",
  },
  dialogue: simpleDialogue(
    "The Queen of the Green Marches receives you in a throne room grown rather than built — living trees forming walls, a canopy of leaves for a ceiling. She studies you with the patience of someone who has centuries to make decisions. \"Few outsiders earn audience here. You carry an interesting scent — blood, road dust, and purpose. Speak.\"",
    [
      { text: "I carry a message from another kingdom.",
        response: "\"From whom?\" She tilts her head like a hawk. \"The North offers war alliances. The East offers trade routes. The South offers nothing but threats wrapped in courtesy. I am tired of all three. But if you carry something genuine — something that doesn't insult my intelligence — I'll listen. And I'll remember who brought it.\"" },
      { text: "Your trade routes are being disrupted. I can help.",
        response: "\"The forest tells me this already. Bandits at the river crossings, monsters on the eastern road, and a very convenient series of 'natural' landslides on the mountain pass. Someone wants the Green Marches isolated.\" Her eyes narrow. \"Find me proof of who orchestrates it, and I'll open the old trade road for your use. That alone is worth a fortune.\"" },
      { text: "I seek only safe passage through your lands.",
        response: "\"Granted — on condition that you harm nothing that grows. My rangers will know if you do.\" She raises a hand and a hawk descends to her wrist from the canopy above. \"Follow the marked paths. Stray into the deep wood and I cannot guarantee your safety. The old things that live there answer to no crown.\"" },
    ],
  ),
};

export const NPC_WARLORD_ZETH: NPC = {
  id: "npc_warlord_zeth",
  name: "Warlord Zeth Ironfang",
  title: "Conqueror of the Eastern Wastes",
  location: { q: 42, r: 28 },
  locationName: "The Iron Citadel",
  category: "faction_leader",
  disposition: -20,
  quests: ["quest_eastern_tribute", "quest_arena_champion"],
  portrait: {
    race: "half-orc", gender: "male", age: "middle", build: "heavy",
    hair: "shaved except for a single long topknot braided with iron wire",
    distinguishing: "Lower tusks capped with iron, ritual scars covering his chest and arms, eyes like burning coals",
    attire: "Spiked plate armor that seems fused to his skin, a throne made of captured weapons, a massive iron mace",
  },
  dialogue: simpleDialogue(
    "The Warlord doesn't rise from his weapon-throne. He doesn't need to — his presence fills the hall like smoke. Warriors kneel in rows before him. He looks at you the way a butcher looks at livestock. \"You're either an envoy, a challenger, or lost. Envoys kneel. Challengers die. Choose.\"",
    [
      { text: "I come bearing tribute. [Diplomacy]",
        response: "\"Tribute.\" A flicker of interest in those coal-fire eyes. \"The civilized lands usually send soft words, not gifts. Show me what you bring. If it pleases me, you leave with your life and my temporary goodwill. If it insults me...\" He hefts his mace one-handed. \"Well. My arena always needs new fighters.\"" },
      { text: "I challenge your arena champion.",
        response: "For the first time, he shows something like respect. \"Bold. Stupid, but bold. My champion has killed forty-three opponents. You'd be forty-four.\" He drums iron fingers on his throne. \"But I appreciate audacity. Win three fights in my pit and you earn an audience — a real one, not this formality. Lose and your skull decorates my gate. Terms?\"" },
      { text: "I bring a message from the western kingdoms.",
        response: "\"Western weakness. They always send words because they're afraid to send steel.\" But he extends a massive hand. \"Give it. I can't read their scratching but my scholar will translate. If they want peace, the price is iron tribute — twenty wagons of raw ore monthly. If they want war...\" His grin reveals iron-capped tusks. \"I'm always ready for war.\"" },
    ],
  ),
};

export const NPC_DUCHESS_SERA: NPC = {
  id: "npc_duchess_sera",
  name: "Duchess Sera Nighthollow",
  title: "Mistress of the Southern Dominion",
  location: { q: 36, r: 42 },
  locationName: "Nighthollow Manor",
  category: "faction_leader",
  disposition: 10,
  quests: ["quest_southern_spy", "quest_noble_favor"],
  portrait: {
    race: "human", gender: "female", age: "middle", build: "thin",
    hair: "raven black, elaborately styled with silver pins",
    distinguishing: "Pale as marble, lips always curved in a knowing smile, never blinks at a normal rate",
    attire: "Black silk gown worth more than a warship, a spider-silk shawl, rings on every finger",
  },
  dialogue: simpleDialogue(
    "The Duchess receives you in a parlor that smells of nightshade and expensive perfume. She doesn't stand, merely gestures to a chair with one ring-laden hand. \"Sit. I know why you're here — I know why everyone is anywhere. The question is whether you're useful enough to leave this room with more than you entered it.\"",
    [
      { text: "I have information to trade.",
        response: "\"Everyone thinks they have information. Most have gossip.\" She sips dark wine. \"But I'm listening. If your intelligence is genuine — troop movements, trade secrets, something I can use — I pay in favors. And my favors open doors that gold cannot. Test me with something small. If it's real, we'll discuss a longer arrangement.\"" },
      { text: "I need your influence for something.",
        response: "\"Influence costs. What do you need? A pardon? An introduction? A rival quietly removed from your path?\" She smiles. \"Everything is possible in the Southern Dominion. But nothing is free. Complete a task for me first — a small thing, beneath my attention but not yours — and then we'll discuss what my influence can do for you.\"" },
      { text: "The other kingdoms are moving against you.",
        response: "\"Of course they are. They always are. And I am always moving against them. It's a dance, dear — you simply haven't been invited to the ball until now.\" She sets down her wine. \"But if you have specifics — names, dates, positions — that would accelerate my preparations. And accelerated preparations mean generous rewards for the one who provided them.\"" },
    ],
  ),
};

export const NPC_ARCHON_KELUVAR: NPC = {
  id: "npc_archon_keluvar",
  name: "Archon Keluvar the Unbroken",
  title: "Defender of the Coastal Freehold",
  location: { q: 40, r: 36 },
  locationName: "The Freehold Lighthouse",
  category: "faction_leader",
  disposition: 40,
  quests: ["quest_coastal_defense", "quest_trade_alliance"],
  portrait: {
    race: "dwarf", gender: "male", age: "old", build: "heavy",
    hair: "white beard braided with sea-glass beads, salt-stiffened",
    distinguishing: "Missing his left eye (covered by a sapphire eyepatch), hands scarred from decades of rope and rigging work",
    attire: "Admiral's coat over chain mail, a trident that crackles with faint lightning, boots that have never been dry",
  },
  dialogue: simpleDialogue(
    "The Archon stands at the lighthouse's peak, wind howling around him, gazing out at a sea that seems to obey his glare. He turns at your approach. \"A land-walker. In my lighthouse. Either you've come with purpose or you've climbed a very long staircase for the view. The view IS spectacular, I'll grant you.\"",
    [
      { text: "The Freehold's shipping lanes are threatened.",
        response: "\"Aye, and have been for months. Pirates from the south, sea monsters from the deep, and 'legitimate' blockades from kingdoms that want our trade for themselves.\" He stamps his trident against the stone. \"I need allies who can fight on water. If you've got a ship — or can get one — I'll grant you a privateer's charter. Everything you take from our enemies is yours to keep. Fair terms for dangerous work.\"" },
      { text: "I seek a trade alliance between our peoples.",
        response: "\"Trade? Good. The Freehold's strength IS trade. We don't conquer — we buy, sell, and protect the routes.\" He pulls a weather-beaten ledger from his coat. \"Bring me a signed compact from any inland kingdom — guaranteed grain prices in exchange for guaranteed shipping rates — and I'll cut you in for three percent of the route's profits. Permanently. My word is iron.\"" },
      { text: "Just enjoying the view. You're right — it's spectacular.",
        response: "He laughs — a booming sound that fights the wind. \"Ha! An honest soul. Rare.\" He claps you on the shoulder hard enough to stagger. \"Stay for a drink, then. The whiskey up here is better because the altitude makes your head lighter. And if you decide you want work — the Freehold always needs capable hands. Sea or shore, there's always something that needs doing.\"" },
    ],
  ),
};

// ============================================================================
//  NPC REGISTRY — all 30 NPCs
// ============================================================================

export const ALL_NPCS: NPC[] = [
  // Kardov's Gate (8)
  NPC_HARBOR_MASTER,
  NPC_TAVERN_KEEPER,
  NPC_GUILD_MASTER,
  NPC_HIGH_LUMINAR,
  NPC_BLACKSMITH,
  NPC_ALCHEMIST,
  NPC_SHADY_DEALER,
  NPC_BEGGAR_KING,
  // Wilderness (12)
  NPC_WANDERING_MERCHANT,
  NPC_HERMIT_SAGE,
  NPC_RANGER_GUIDE,
  NPC_BANDIT_CHIEF,
  NPC_DRUID_ELDER,
  NPC_WOUNDED_KNIGHT,
  NPC_MYSTERIOUS_STRANGER,
  NPC_MINE_FOREMAN,
  NPC_FARMER,
  NPC_PRIEST,
  NPC_PIRATE_CAPTAIN,
  NPC_REFUGEE,
  // Dungeon (5)
  NPC_TRAPPED_ADVENTURER,
  NPC_DUNGEON_MERCHANT,
  NPC_GHOST,
  NPC_IMPRISONED_NOBLE,
  NPC_RIVAL_EXPLORER,
  // Faction Leaders (5)
  NPC_KING_ALDRIC,
  NPC_QUEEN_LYANA,
  NPC_WARLORD_ZETH,
  NPC_DUCHESS_SERA,
  NPC_ARCHON_KELUVAR,
];

export const NPC_BY_ID: Record<string, NPC> = Object.fromEntries(ALL_NPCS.map(n => [n.id, n]));

// ============================================================================
//  QUEST DATA — 40 QUESTS
// ============================================================================

// ── MAIN STORY CHAIN (8 quests) — The Vessel of Namaris Arc ──────────────────

const MAIN_QUESTS: Quest[] = [
  {
    id: "quest_vessel_namaris_1",
    name: "The Crier's Call",
    description: "The Alchemist Guild seeks the Vessel of Namaris in the Blackwood Ruins. Speak with Guild Master Sevran Ashborne to learn what he knows.",
    giver: "npc_guild_master",
    type: "main",
    objectives: [
      { id: "vn1_talk", type: "talk", description: "Speak with Guild Master Ashborne about the Vessel", target: "npc_guild_master", count: 1 },
      { id: "vn1_prepare", type: "collect", description: "Gather supplies for the journey (5 rations, 3 torches)", target: "travel_ration", count: 5 },
    ],
    rewards: [
      { type: "xp", value: 200, description: "200 XP for accepting the quest" },
      { type: "item", value: "blackwood_map", qty: 1, description: "Map of approaches to the Blackwood Ruins" },
      { type: "reputation", value: 10, faction: "alchemist_guild", description: "+10 reputation with the Alchemist Guild" },
    ],
    level: 1,
    chain: "vessel_of_namaris",
    chainOrder: 0,
    repeatable: false,
    faction: "alchemist_guild",
    repReward: 10,
  },
  {
    id: "quest_vessel_namaris_2",
    name: "Into the Blackwood",
    description: "Follow the Guild's map to the Blackwood Ruins. The forest is crawling with twisted creatures drawn to the Vessel's power. Reach the outer wall of the ruins.",
    giver: "npc_guild_master",
    type: "main",
    objectives: [
      { id: "vn2_reach", type: "visit", description: "Reach the Blackwood Ruins entrance", target: "28,25", count: 1 },
      { id: "vn2_survive", type: "survive", description: "Survive the journey through the Blackwood", target: "blackwood", count: 3 },
    ],
    rewards: [
      { type: "xp", value: 400, description: "400 XP for reaching the ruins" },
      { type: "coins", value: 0, coins: { gp: 15, sp: 0, cp: 0 }, description: "15 gp (found among the dead)" },
    ],
    level: 2,
    chain: "vessel_of_namaris",
    chainOrder: 1,
    prerequisites: ["quest_vessel_namaris_1"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_3",
    name: "Whispers in the Ruins",
    description: "The Mysterious Stranger's warning echoes: the Vessel is not a tool but a cage. Explore the outer ruins and find evidence of what was truly sealed here.",
    giver: "npc_mysterious_stranger",
    type: "main",
    objectives: [
      { id: "vn3_explore", type: "explore", description: "Search the outer ruins for inscriptions", target: "blackwood_ruins", count: 3 },
      { id: "vn3_find", type: "collect", description: "Collect fragments of the Sealing Record", target: "sealing_fragment", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 600, description: "600 XP for uncovering the truth" },
      { type: "item", value: "sealing_record_assembled", qty: 1, description: "The assembled Sealing Record — reveals the Vessel's true nature" },
    ],
    level: 3,
    chain: "vessel_of_namaris",
    chainOrder: 2,
    prerequisites: ["quest_vessel_namaris_2"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_4",
    name: "The Hermit's Truth",
    description: "The Sealing Record is incomplete. The Hermit Sage on Ashfall Peak knows a piece of the truth. Climb the peak and earn his knowledge.",
    giver: "npc_hermit_sage",
    type: "main",
    objectives: [
      { id: "vn4_climb", type: "visit", description: "Reach Ashfall Peak", target: "30,28", count: 1 },
      { id: "vn4_riddle", type: "talk", description: "Answer the Hermit's riddle correctly", target: "npc_hermit_sage", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 500, description: "500 XP" },
      { type: "spell", value: "seal_ward", description: "Learn the Seal Ward incantation (needed to contain the Vessel)" },
      { type: "reputation", value: 5, faction: "alchemist_guild", description: "+5 Guild rep for gathering intel" },
    ],
    level: 4,
    chain: "vessel_of_namaris",
    chainOrder: 3,
    prerequisites: ["quest_vessel_namaris_3"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_5",
    name: "Descent into Darkness",
    description: "Armed with the Seal Ward, descend into the deep vaults beneath the Blackwood Ruins. The Vessel's guardian must be overcome to reach the inner chamber.",
    giver: "npc_guild_master",
    type: "main",
    objectives: [
      { id: "vn5_enter", type: "visit", description: "Enter the deep vaults", target: "blackwood_vault", count: 1 },
      { id: "vn5_kill", type: "kill", description: "Defeat the Vault Guardian", target: "vault_guardian", count: 1 },
      { id: "vn5_reach", type: "visit", description: "Reach the inner chamber", target: "blackwood_inner", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 800, description: "800 XP for surviving the vaults" },
      { type: "coins", value: 0, coins: { gp: 50, sp: 0, cp: 0 }, description: "50 gp in ancient coins from the vault" },
    ],
    level: 5,
    chain: "vessel_of_namaris",
    chainOrder: 4,
    prerequisites: ["quest_vessel_namaris_4"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_6",
    name: "The Choice",
    description: "The Vessel lies before you. The Guild wants it studied. The Temple wants it destroyed. The Stranger says it must remain sealed. What you do next will shape the fate of Kardov's Gate.",
    giver: "npc_mysterious_stranger",
    type: "main",
    objectives: [
      { id: "vn6_choose", type: "talk", description: "Make your choice regarding the Vessel", target: "vessel_choice", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 1000, description: "1000 XP for making your choice" },
      { type: "title", value: "vessel_decider", description: "Title: 'Decider of Fates'" },
    ],
    level: 5,
    chain: "vessel_of_namaris",
    chainOrder: 5,
    prerequisites: ["quest_vessel_namaris_5"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_7",
    name: "Consequences",
    description: "Your choice echoes across the land. Return to Kardov's Gate and face the consequences — those who agree will praise you, those who don't may seek vengeance.",
    giver: "npc_guild_master",
    type: "main",
    objectives: [
      { id: "vn7_return", type: "visit", description: "Return to Kardov's Gate", target: "36,32", count: 1 },
      { id: "vn7_report", type: "talk", description: "Report to your faction leader", target: "faction_leader", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 800, description: "800 XP" },
      { type: "coins", value: 0, coins: { gp: 100, sp: 0, cp: 0 }, description: "100 gp reward from your chosen faction" },
      { type: "reputation", value: 25, faction: "player_choice", description: "+25 rep with your chosen faction, -25 with opposed" },
    ],
    level: 6,
    chain: "vessel_of_namaris",
    chainOrder: 6,
    prerequisites: ["quest_vessel_namaris_6"],
    repeatable: false,
  },
  {
    id: "quest_vessel_namaris_8",
    name: "Storm the Iron Maw",
    description: "The consequences of your choice have spiraled into crisis. A faction betrayed by your decision has seized the Iron Maw fortress. Take it back before Kardov's Gate falls to siege.",
    giver: "npc_high_luminar",
    type: "main",
    objectives: [
      { id: "vn8_rally", type: "talk", description: "Rally allies for the assault", target: "allies", count: 3 },
      { id: "vn8_breach", type: "visit", description: "Breach the Iron Maw gates", target: "iron_maw_gates", count: 1 },
      { id: "vn8_boss", type: "kill", description: "Defeat the usurper commander", target: "maw_commander", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 2000, description: "2000 XP for saving Kardov's Gate" },
      { type: "coins", value: 0, coins: { gp: 200, sp: 0, cp: 0 }, description: "200 gp — the city's gratitude" },
      { type: "title", value: "hero_of_kardov", description: "Title: 'Hero of Kardov's Gate'" },
      { type: "unlock_area", value: "iron_maw_interior", description: "Permanent access to Iron Maw fortress interior" },
    ],
    level: 7,
    chain: "vessel_of_namaris",
    chainOrder: 7,
    prerequisites: ["quest_vessel_namaris_7"],
    repeatable: false,
  },
];

// ── SIDE QUESTS (20) ─────────────────────────────────────────────────────────

const SIDE_QUESTS: Quest[] = [
  // --- Fetch ---
  {
    id: "quest_mushroom_harvest",
    name: "The Alchemist's Harvest",
    description: "Yssa Thornveil needs moonwort mushroom caps from the Fungal Forest for her reagent stock. The forest is thick with spores and territorial creatures.",
    giver: "npc_alchemist",
    type: "side",
    objectives: [
      { id: "mh_collect", type: "collect", description: "Gather moonwort mushroom caps", target: "moonwort_cap", count: 8 },
    ],
    rewards: [
      { type: "xp", value: 150, description: "150 XP" },
      { type: "coins", value: 0, coins: { gp: 4, sp: 0, cp: 0 }, description: "4 gp (5 sp per cap)" },
      { type: "reputation", value: 5, faction: "alchemist_guild", description: "+5 Alchemist Guild reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 72,
    faction: "alchemist_guild",
    repReward: 5,
  },
  // --- Kill ---
  {
    id: "quest_undead_crypt",
    name: "Rest for the Restless",
    description: "The High Luminar reports that the dead are rising from the old Millhaven crypt. Find the source of the necromantic disturbance and destroy it.",
    giver: "npc_high_luminar",
    type: "side",
    objectives: [
      { id: "uc_enter", type: "visit", description: "Enter the Millhaven Crypt", target: "35,30", count: 1 },
      { id: "uc_kill", type: "kill", description: "Destroy undead in the crypt", target: "skeleton", count: 8 },
      { id: "uc_boss", type: "kill", description: "Destroy the necromantic focus", target: "necro_crystal", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 400, description: "400 XP" },
      { type: "coins", value: 0, coins: { gp: 30, sp: 0, cp: 0 }, description: "30 gp from the Temple of Dawn" },
      { type: "reputation", value: 15, faction: "temple_dawnfire", description: "+15 Dawnfire reputation" },
    ],
    level: 3,
    repeatable: false,
    faction: "temple_dawnfire",
    repReward: 15,
  },
  // --- Escort ---
  {
    id: "quest_escort_knight",
    name: "A Knight's Last Mile",
    description: "Sir Aldric Crane lies wounded on the road, his escort slain by gnolls. Help him reach the Temple of Dawn in Kardov's Gate before his wounds claim him.",
    giver: "npc_wounded_knight",
    type: "side",
    objectives: [
      { id: "ek_escort", type: "escort", description: "Escort Sir Aldric to Kardov's Gate", target: "36,32", count: 1 },
      { id: "ek_survive", type: "survive", description: "Keep Sir Aldric alive during travel", target: "sir_aldric", count: 2 },
    ],
    rewards: [
      { type: "xp", value: 300, description: "300 XP" },
      { type: "coins", value: 0, coins: { gp: 25, sp: 0, cp: 0 }, description: "25 gp from the Dawnfire Order" },
      { type: "reputation", value: 10, faction: "temple_dawnfire", description: "+10 Dawnfire reputation" },
      { type: "item", value: "knight_recommendation", qty: 1, description: "Letter of recommendation (unlocks Dawnfire quests)" },
    ],
    level: 2,
    repeatable: false,
    faction: "temple_dawnfire",
    repReward: 10,
  },
  // --- Escort (refugees) ---
  {
    id: "quest_escort_refugees",
    name: "Ashes at Their Backs",
    description: "A group of refugees fleeing a gnoll raid need protection on the road to Kardov's Gate. Twelve souls — six of them children — depend on you.",
    giver: "npc_refugee",
    type: "side",
    objectives: [
      { id: "er_escort", type: "escort", description: "Guide the refugees to Kardov's Gate", target: "36,32", count: 1 },
      { id: "er_defend", type: "kill", description: "Defeat gnoll pursuers", target: "gnoll", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 350, description: "350 XP" },
      { type: "reputation", value: 10, faction: "farmers", description: "+10 Farmer reputation" },
      { type: "reputation", value: 5, faction: "temple_dawnfire", description: "+5 Dawnfire reputation (for saving innocents)" },
      { type: "title", value: "protector_of_the_weak", description: "Title: 'Protector of the Weak'" },
    ],
    level: 2,
    repeatable: false,
    faction: "farmers",
    repReward: 10,
  },
  // --- Explore ---
  {
    id: "quest_map_wilderness",
    name: "Charting the Unknown",
    description: "Ranger Kael needs the eastern reaches mapped for the Windcaller Temple's records. Explore uncharted hexes and mark landmarks.",
    giver: "npc_ranger_guide",
    type: "side",
    objectives: [
      { id: "mw_explore", type: "explore", description: "Explore uncharted hexes in the eastern reaches", target: "eastern_hex", count: 6 },
    ],
    rewards: [
      { type: "xp", value: 300, description: "300 XP" },
      { type: "coins", value: 0, coins: { gp: 15, sp: 0, cp: 0 }, description: "15 gp from the Ranger Outpost" },
      { type: "reputation", value: 10, faction: "temple_windcaller", description: "+10 Windcaller reputation" },
      { type: "unlock_npc", value: "npc_ranger_guide", description: "Kael offers permanent guide services at discount" },
    ],
    level: 2,
    repeatable: false,
    faction: "temple_windcaller",
    repReward: 10,
  },
  // --- Puzzle ---
  {
    id: "quest_sage_riddle",
    name: "The Hermit's Game",
    description: "Urzen the Undying trades knowledge for riddles. Bring him a riddle he hasn't heard in his centuries of isolation, and he'll reward you with a spell scroll from his collection.",
    giver: "npc_hermit_sage",
    type: "side",
    objectives: [
      { id: "sr_find", type: "collect", description: "Find an ancient riddle (libraries, ruins, or travelers)", target: "rare_riddle", count: 1 },
      { id: "sr_present", type: "talk", description: "Present the riddle to Urzen", target: "npc_hermit_sage", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 250, description: "250 XP" },
      { type: "item", value: "spell_scroll_random", qty: 1, description: "A random spell scroll from Urzen's collection" },
    ],
    level: 3,
    repeatable: true,
    cooldownHours: 168,
  },
  // --- Delivery ---
  {
    id: "quest_ore_delivery",
    name: "Iron for the Forge",
    description: "The mine foreman Guldric has six crates of iron ore ready for Korrin Ironjaw in Kardov's Gate. The delivery is overdue and the road isn't safe.",
    giver: "npc_mine_foreman",
    type: "side",
    objectives: [
      { id: "od_pickup", type: "collect", description: "Collect the iron crates from Craghollow", target: "iron_crate", count: 6 },
      { id: "od_deliver", type: "deliver", description: "Deliver crates to Korrin Ironjaw", target: "npc_blacksmith", count: 6 },
    ],
    rewards: [
      { type: "xp", value: 200, description: "200 XP" },
      { type: "coins", value: 0, coins: { gp: 18, sp: 0, cp: 0 }, description: "18 gp (3 gp per crate)" },
      { type: "reputation", value: 5, faction: "farmers", description: "+5 Farmer reputation (supporting trade)" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 120,
    faction: "farmers",
    repReward: 5,
  },
  // --- Investigation ---
  {
    id: "quest_missing_patron",
    name: "The Cooper Who Vanished",
    description: "Harren the cooper disappeared between the Iron Maw Tavern and his shop five days ago. His wife is frantic. The city watch doesn't care. You should.",
    giver: "npc_tavern_keeper",
    type: "side",
    objectives: [
      { id: "mp_clue1", type: "explore", description: "Search Chandler Street for clues", target: "chandler_street", count: 1 },
      { id: "mp_clue2", type: "talk", description: "Question the neighbours", target: "chandler_neighbours", count: 3 },
      { id: "mp_find", type: "visit", description: "Find Harren", target: "harren_location", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 350, description: "350 XP" },
      { type: "item", value: "tavern_favor_token", qty: 1, description: "Brenna's Favor — free room and board for a month" },
      { type: "reputation", value: 5, faction: "farmers", description: "+5 Farmer reputation" },
    ],
    level: 2,
    repeatable: false,
  },
  // --- Gather Intel ---
  {
    id: "quest_shadow_cult",
    name: "Shadows Beneath the City",
    description: "The High Luminar suspects a shadow cult operates beneath Kardov's Gate. Find their lair, gather evidence of their rituals, and report back to the Temple of Dawn.",
    giver: "npc_high_luminar",
    type: "side",
    objectives: [
      { id: "sc_find", type: "visit", description: "Locate the Shadow Temple's entrance", target: "shadow_lair", count: 1 },
      { id: "sc_evidence", type: "collect", description: "Gather ritual evidence", target: "shadow_evidence", count: 3 },
      { id: "sc_report", type: "talk", description: "Report findings to the High Luminar", target: "npc_high_luminar", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 500, description: "500 XP" },
      { type: "coins", value: 0, coins: { gp: 40, sp: 0, cp: 0 }, description: "40 gp from the Temple treasury" },
      { type: "reputation", value: 20, faction: "temple_dawnfire", description: "+20 Dawnfire reputation" },
      { type: "unlock_area", value: "shadow_lair", description: "Knowledge of the Shadow Temple location" },
    ],
    level: 4,
    repeatable: false,
    faction: "temple_dawnfire",
    repReward: 20,
    repPenalty: [{ faction: "temple_shadow", amount: -30 }],
  },
  // --- Craft ---
  {
    id: "quest_dragonsteel_forge",
    name: "The Dragonsteel Commission",
    description: "Korrin Ironjaw can forge dragonsteel — but only with volcanic iron ingots and a dragon's heartstone. Gather these impossibly rare materials for a weapon of legend.",
    giver: "npc_blacksmith",
    type: "side",
    objectives: [
      { id: "df_iron", type: "collect", description: "Obtain volcanic iron ingots", target: "volcanic_iron", count: 3 },
      { id: "df_heart", type: "collect", description: "Obtain a dragon's heartstone", target: "dragon_heartstone", count: 1 },
      { id: "df_forge", type: "talk", description: "Return materials to Korrin", target: "npc_blacksmith", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 800, description: "800 XP" },
      { type: "item", value: "dragonsteel_weapon", qty: 1, description: "A dragonsteel weapon of your choice (masterwork)" },
    ],
    level: 6,
    repeatable: false,
  },
  // --- Arena ---
  {
    id: "quest_arena_champion",
    name: "Blood and Iron",
    description: "Warlord Zeth's arena awaits challengers. Win three consecutive fights to earn an audience with the Warlord himself — and the riches that come with his respect.",
    giver: "npc_warlord_zeth",
    type: "side",
    objectives: [
      { id: "ac_fight1", type: "win_fight", description: "Win arena fight 1", target: "arena_1", count: 1 },
      { id: "ac_fight2", type: "win_fight", description: "Win arena fight 2", target: "arena_2", count: 1 },
      { id: "ac_fight3", type: "win_fight", description: "Win arena fight 3", target: "arena_3", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 600, description: "600 XP" },
      { type: "coins", value: 0, coins: { gp: 75, sp: 0, cp: 0 }, description: "75 gp arena purse" },
      { type: "title", value: "iron_champion", description: "Title: 'Iron Champion of the Eastern Wastes'" },
      { type: "unlock_npc", value: "npc_warlord_zeth", description: "Audience with Warlord Zeth (diplomacy quests unlock)" },
    ],
    level: 5,
    repeatable: false,
  },
  // --- Cellar monster ---
  {
    id: "quest_rat_cellar",
    name: "Something in the Cellar",
    description: "The Iron Maw Tavern has an uninvited guest in its cellar — something bigger than a rat with claws that score oak barrels. Clear it out quietly.",
    giver: "npc_tavern_keeper",
    type: "side",
    objectives: [
      { id: "rc_enter", type: "visit", description: "Enter the tavern cellar", target: "tavern_cellar", count: 1 },
      { id: "rc_kill", type: "kill", description: "Kill the cellar beast", target: "dire_badger", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 100, description: "100 XP" },
      { type: "item", value: "tavern_room_key", qty: 1, description: "Free room at the Iron Maw for one week" },
    ],
    level: 1,
    repeatable: false,
  },
  // --- Debt collection ---
  {
    id: "quest_tavern_debt",
    name: "Debts Owed",
    description: "Councillor Threkk owes Brenna sixty gold in unpaid tabs. Collect the debt — by charm, threat, or proof. No killing.",
    giver: "npc_tavern_keeper",
    type: "side",
    objectives: [
      { id: "td_confront", type: "talk", description: "Confront Councillor Threkk", target: "threkk", count: 1 },
      { id: "td_collect", type: "collect", description: "Collect 60 gold owed", target: "threkk_debt", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 200, description: "200 XP" },
      { type: "coins", value: 0, coins: { gp: 10, sp: 0, cp: 0 }, description: "10 gp (your cut)" },
    ],
    level: 2,
    repeatable: false,
  },
  // --- Sea quest ---
  {
    id: "quest_sea_beast",
    name: "Terror in the Deep Channel",
    description: "A creature lurks in the deep channel east of the harbor, damaging fishing boats and threatening trade. Kill it or drive it away.",
    giver: "npc_harbor_master",
    type: "side",
    objectives: [
      { id: "sb_boat", type: "visit", description: "Take a boat into the deep channel", target: "deep_channel", count: 1 },
      { id: "sb_kill", type: "kill", description: "Defeat the sea creature", target: "sea_beast", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 450, description: "450 XP" },
      { type: "coins", value: 0, coins: { gp: 40, sp: 0, cp: 0 }, description: "40 gp bounty" },
      { type: "reputation", value: 10, faction: "temple_tidewarden", description: "+10 Tidewarden reputation" },
    ],
    level: 4,
    repeatable: false,
    faction: "temple_tidewarden",
    repReward: 10,
  },
  // --- Smuggler cave ---
  {
    id: "quest_smuggler_cove",
    name: "The Smuggler's Caves",
    description: "Shadow Coast runners use the sea caves south of Kardov's Gate to move contraband. Clear them out at low tide.",
    giver: "npc_harbor_master",
    type: "side",
    objectives: [
      { id: "sc2_enter", type: "visit", description: "Enter the sea caves at low tide", target: "sea_caves", count: 1 },
      { id: "sc2_kill", type: "kill", description: "Defeat the smugglers", target: "smuggler", count: 5 },
      { id: "sc2_evidence", type: "collect", description: "Seize contraband as evidence", target: "contraband", count: 3 },
    ],
    rewards: [
      { type: "xp", value: 350, description: "350 XP" },
      { type: "coins", value: 0, coins: { gp: 30, sp: 0, cp: 0 }, description: "30 gp city watch bounty" },
      { type: "item", value: "smuggler_map", qty: 1, description: "Smuggler's coastal route map (reveals hidden coves)" },
    ],
    level: 3,
    repeatable: false,
  },
  // --- Corrupted spring (nature) ---
  {
    id: "quest_corrupted_spring",
    name: "The Poisoned Spring",
    description: "Grandmother Thornweave senses corruption in the northern spring. Three villages depend on it for drinking water. Find and eliminate the source before people start dying.",
    giver: "npc_druid_elder",
    type: "side",
    objectives: [
      { id: "cs_find", type: "visit", description: "Reach the corrupted spring", target: "29,25", count: 1 },
      { id: "cs_source", type: "explore", description: "Find the source of corruption", target: "corruption_source", count: 1 },
      { id: "cs_cleanse", type: "kill", description: "Destroy the corrupted elemental", target: "corrupted_water_elemental", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 400, description: "400 XP" },
      { type: "coins", value: 0, coins: { gp: 20, sp: 0, cp: 0 }, description: "20 gp (village collection)" },
      { type: "reputation", value: 15, faction: "temple_earthmother", description: "+15 Earthmother reputation" },
      { type: "reputation", value: 5, faction: "farmers", description: "+5 Farmer reputation (saved their water)" },
    ],
    level: 3,
    repeatable: false,
    faction: "temple_earthmother",
    repReward: 15,
  },
  // --- Wolf pack ---
  {
    id: "quest_wolf_pack",
    name: "Fangs at the Fold",
    description: "A pack of highland wolves has descended on Tommas Greenfield's farm. They've killed sheep and his best dog. Drive them out or put them down.",
    giver: "npc_farmer",
    type: "side",
    objectives: [
      { id: "wp_track", type: "explore", description: "Track the wolf pack to their den", target: "wolf_den", count: 1 },
      { id: "wp_kill", type: "kill", description: "Kill or drive off the wolves", target: "wolf", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 150, description: "150 XP" },
      { type: "coins", value: 0, coins: { gp: 10, sp: 0, cp: 0 }, description: "10 gp from Tommas" },
      { type: "item", value: "wolf_pelt", qty: 2, description: "2 wolf pelts (trade value)" },
      { type: "reputation", value: 5, faction: "farmers", description: "+5 Farmer reputation" },
    ],
    level: 1,
    repeatable: false,
    faction: "farmers",
    repReward: 5,
  },
  // --- Ghost quest ---
  {
    id: "quest_ghost_remains",
    name: "Bones Beneath the Stone",
    description: "The Weeping Lady was buried alive centuries ago. Find her remains in the dungeon and bring them to the surface for a proper burial, granting her rest at last.",
    giver: "npc_ghost",
    type: "side",
    objectives: [
      { id: "gr_find", type: "explore", description: "Search the dungeon for Elara's remains", target: "ghost_bones", count: 1 },
      { id: "gr_surface", type: "visit", description: "Bring the remains to the surface", target: "surface_exit", count: 1 },
      { id: "gr_bury", type: "visit", description: "Bury the remains in consecrated ground", target: "graveyard", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 300, description: "300 XP" },
      { type: "item", value: "ghost_locket", qty: 1, description: "Elara's Locket (grants +2 WIS when worn)" },
      { type: "reputation", value: 10, faction: "temple_tidewarden", description: "+10 Tidewarden reputation (laid a soul to rest)" },
    ],
    level: 3,
    repeatable: false,
    faction: "temple_tidewarden",
    repReward: 10,
  },
  // --- Lost cargo ---
  {
    id: "quest_lost_cargo",
    name: "The Merchant's Missing Spices",
    description: "A spice shipment bound for Kardov's Gate never arrived. It could be pirates, bandits, or a treacherous captain. Track it down along the western coast.",
    giver: "npc_harbor_master",
    type: "side",
    objectives: [
      { id: "lc_coast", type: "explore", description: "Search the western coast road for clues", target: "western_coast", count: 3 },
      { id: "lc_find", type: "visit", description: "Locate the cargo", target: "cargo_location", count: 1 },
      { id: "lc_return", type: "deliver", description: "Return the cargo to Kardov's Gate", target: "npc_harbor_master", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 250, description: "250 XP" },
      { type: "coins", value: 0, coins: { gp: 30, sp: 0, cp: 0 }, description: "30 gp (full recovery bonus)" },
    ],
    level: 2,
    repeatable: false,
  },
];

// ── REPEATABLE BOUNTIES (12) ─────────────────────────────────────────────────

const BOUNTIES: Quest[] = [
  {
    id: "bounty_hunt_undead",
    name: "Bounty: Cleanse the Undead",
    description: "The Temple of Dawn offers standing bounties for putting the restless dead back in the ground. Any undead killed in the wild counts.",
    giver: "npc_high_luminar",
    type: "bounty",
    objectives: [
      { id: "bu_kill", type: "kill", description: "Destroy undead creatures", target: "undead", count: 5 },
    ],
    rewards: [
      { type: "xp", value: 150, description: "150 XP" },
      { type: "coins", value: 0, coins: { gp: 10, sp: 0, cp: 0 }, description: "10 gp per bounty" },
      { type: "reputation", value: 3, faction: "temple_dawnfire", description: "+3 Dawnfire reputation" },
    ],
    level: 2,
    repeatable: true,
    cooldownHours: 24,
    faction: "temple_dawnfire",
    repReward: 3,
  },
  {
    id: "bounty_hunt_beasts",
    name: "Bounty: Thin the Beast Packs",
    description: "The Farmers' Council pays for every dangerous beast cleared from the roads. Wolves, bears, and giant insects all qualify.",
    giver: "npc_farmer",
    type: "bounty",
    objectives: [
      { id: "bb_kill", type: "kill", description: "Kill dangerous beasts", target: "beast", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 100, description: "100 XP" },
      { type: "coins", value: 0, coins: { gp: 6, sp: 0, cp: 0 }, description: "6 gp" },
      { type: "reputation", value: 2, faction: "farmers", description: "+2 Farmer reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 24,
    faction: "farmers",
    repReward: 2,
  },
  {
    id: "bounty_hunt_bandits",
    name: "Bounty: Road Bandits Wanted",
    description: "The city watch posts regular bounties for clearing bandits from the trade roads. Dead or alive — they don't specify.",
    giver: "npc_harbor_master",
    type: "bounty",
    objectives: [
      { id: "hb_kill", type: "kill", description: "Defeat bandits on the roads", target: "bandit", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 120, description: "120 XP" },
      { type: "coins", value: 0, coins: { gp: 8, sp: 0, cp: 0 }, description: "8 gp" },
    ],
    level: 2,
    repeatable: true,
    cooldownHours: 24,
  },
  {
    id: "bounty_delivery_grain",
    name: "Bounty: Grain Delivery",
    description: "Farmers need their grain delivered to Kardov's Gate market. Simple escort work — if the roads cooperate.",
    giver: "npc_farmer",
    type: "bounty",
    objectives: [
      { id: "dg_pickup", type: "collect", description: "Collect grain shipment from farmlands", target: "grain_shipment", count: 1 },
      { id: "dg_deliver", type: "deliver", description: "Deliver grain to Kardov's Gate market", target: "kardov_market", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 80, description: "80 XP" },
      { type: "coins", value: 0, coins: { gp: 5, sp: 0, cp: 0 }, description: "5 gp" },
      { type: "reputation", value: 2, faction: "farmers", description: "+2 Farmer reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 48,
    faction: "farmers",
    repReward: 2,
  },
  {
    id: "bounty_delivery_potions",
    name: "Bounty: Potion Delivery",
    description: "The Alchemist Guild needs potions delivered to remote outposts and shrines. Quick work for reliable couriers.",
    giver: "npc_alchemist",
    type: "bounty",
    objectives: [
      { id: "dp_pickup", type: "collect", description: "Collect potion crate from Thornveil Apothecary", target: "potion_crate", count: 1 },
      { id: "dp_deliver", type: "deliver", description: "Deliver to designated outpost", target: "guild_outpost", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 80, description: "80 XP" },
      { type: "coins", value: 0, coins: { gp: 7, sp: 0, cp: 0 }, description: "7 gp" },
      { type: "reputation", value: 2, faction: "alchemist_guild", description: "+2 Guild reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 48,
    faction: "alchemist_guild",
    repReward: 2,
  },
  {
    id: "bounty_clear_dungeon",
    name: "Bounty: Dungeon Clearing",
    description: "Any dungeon cleared earns a standing bounty from the Adventurer's Board. Bring proof of completion (boss trophy).",
    giver: "npc_tavern_keeper",
    type: "bounty",
    objectives: [
      { id: "cd_clear", type: "kill", description: "Clear a dungeon (defeat the boss)", target: "dungeon_boss", count: 1 },
      { id: "cd_proof", type: "collect", description: "Collect boss trophy as proof", target: "boss_trophy", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 200, description: "200 XP" },
      { type: "coins", value: 0, coins: { gp: 15, sp: 0, cp: 0 }, description: "15 gp" },
    ],
    level: 3,
    repeatable: true,
    cooldownHours: 48,
  },
  {
    id: "bounty_arena_fight",
    name: "Bounty: Arena Victory",
    description: "The fighting pits always welcome new blood. Win a match and collect your purse.",
    giver: "npc_warlord_zeth",
    type: "bounty",
    objectives: [
      { id: "af_win", type: "win_fight", description: "Win an arena fight", target: "arena_opponent", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 100, description: "100 XP" },
      { type: "coins", value: 0, coins: { gp: 10, sp: 0, cp: 0 }, description: "10 gp purse" },
    ],
    level: 2,
    repeatable: true,
    cooldownHours: 24,
  },
  {
    id: "bounty_herb_gathering",
    name: "Bounty: Reagent Gathering",
    description: "The Guild always needs fresh reagents. Gather herbs from the wild — the rarer the better.",
    giver: "npc_alchemist",
    type: "bounty",
    objectives: [
      { id: "hg_collect", type: "collect", description: "Gather wild reagents", target: "wild_herb", count: 5 },
    ],
    rewards: [
      { type: "xp", value: 75, description: "75 XP" },
      { type: "coins", value: 0, coins: { gp: 3, sp: 0, cp: 0 }, description: "3 gp" },
      { type: "reputation", value: 1, faction: "alchemist_guild", description: "+1 Guild reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 24,
    faction: "alchemist_guild",
    repReward: 1,
  },
  {
    id: "bounty_shrine_blessing",
    name: "Bounty: Tend the Shrines",
    description: "Brother Calwen can't reach all the roadside shrines alone. Bless any untended shrine you find in your travels.",
    giver: "npc_priest",
    type: "bounty",
    objectives: [
      { id: "sb2_bless", type: "visit", description: "Bless an untended roadside shrine", target: "untended_shrine", count: 1 },
    ],
    rewards: [
      { type: "xp", value: 60, description: "60 XP" },
      { type: "coins", value: 0, coins: { gp: 2, sp: 0, cp: 0 }, description: "2 gp temple stipend" },
      { type: "reputation", value: 2, faction: "temple_tidewarden", description: "+2 Tidewarden reputation" },
    ],
    level: 1,
    repeatable: true,
    cooldownHours: 24,
    faction: "temple_tidewarden",
    repReward: 2,
  },
  {
    id: "bounty_hunt_gnolls",
    name: "Bounty: Gnoll Extermination",
    description: "Gnoll raiding parties have been hitting farmsteads and roads. Every gnoll killed makes the land safer. Bring their ear-rings as proof.",
    giver: "npc_ranger_guide",
    type: "bounty",
    objectives: [
      { id: "hg2_kill", type: "kill", description: "Kill gnolls", target: "gnoll", count: 4 },
    ],
    rewards: [
      { type: "xp", value: 130, description: "130 XP" },
      { type: "coins", value: 0, coins: { gp: 8, sp: 0, cp: 0 }, description: "8 gp" },
      { type: "reputation", value: 2, faction: "temple_windcaller", description: "+2 Windcaller reputation" },
    ],
    level: 2,
    repeatable: true,
    cooldownHours: 24,
    faction: "temple_windcaller",
    repReward: 2,
  },
  {
    id: "bounty_sunken_salvage",
    name: "Bounty: Salvage from the Deep",
    description: "Ships sink. Cargo remains. If you can dive and retrieve goods from the wrecks near the harbor, the merchants will pay.",
    giver: "npc_pirate_captain",
    type: "bounty",
    objectives: [
      { id: "ss_dive", type: "collect", description: "Salvage goods from a wreck", target: "salvage_goods", count: 3 },
    ],
    rewards: [
      { type: "xp", value: 120, description: "120 XP" },
      { type: "coins", value: 0, coins: { gp: 12, sp: 0, cp: 0 }, description: "12 gp" },
    ],
    level: 3,
    repeatable: true,
    cooldownHours: 72,
  },
  {
    id: "bounty_escort_merchant",
    name: "Bounty: Merchant Escort",
    description: "Priya the wandering merchant needs escort through dangerous hexes. Walk with her and keep the road clear.",
    giver: "npc_wandering_merchant",
    type: "bounty",
    objectives: [
      { id: "em_escort", type: "escort", description: "Escort the merchant through dangerous terrain", target: "npc_wandering_merchant", count: 2 },
    ],
    rewards: [
      { type: "xp", value: 100, description: "100 XP" },
      { type: "coins", value: 0, coins: { gp: 8, sp: 0, cp: 0 }, description: "8 gp + merchant discount" },
    ],
    level: 2,
    repeatable: true,
    cooldownHours: 48,
  },
];

// ============================================================================
//  QUEST REGISTRY
// ============================================================================

export const ALL_QUESTS: Quest[] = [...MAIN_QUESTS, ...SIDE_QUESTS, ...BOUNTIES];

export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(ALL_QUESTS.map(q => [q.id, q]));

// ============================================================================
//  API — Quest & NPC Runtime Functions
// ============================================================================

/**
 * Get all NPCs at a specific hex location.
 * Checks activeHours if provided (uses in-game hour).
 */
export function getNPCsAtLocation(hex: Coord, gameHour?: number): NPC[] {
  return ALL_NPCS.filter(npc => {
    if (npc.location.q !== hex.q || npc.location.r !== hex.r) return false;
    if (npc.activeHours && gameHour !== undefined) {
      const [start, end] = npc.activeHours;
      const hourMod = gameHour % 24;
      if (start < end) {
        // Normal range (e.g., 8-18)
        if (hourMod < start || hourMod >= end) return false;
      } else {
        // Overnight range (e.g., 20-4)
        if (hourMod < start && hourMod >= end) return false;
      }
    }
    return true;
  });
}

/**
 * Start dialogue with an NPC. Returns the first dialogue node.
 * Filters nodes based on conditions (quest flags, level, etc.).
 */
export function startDialogue(
  npcId: string,
  playerState: { level: number; questFlags: Record<string, boolean>; factionRep: Record<string, number>; inventory: string[]; classId: string; skillRanks: Record<string, number> },
): DialogueNode | null {
  const npc = NPC_BY_ID[npcId];
  if (!npc) return null;

  const startNode = npc.dialogue.nodes[npc.dialogue.startNode];
  if (!startNode) return null;

  // Filter options based on conditions
  return filterNodeOptions(startNode, playerState, npc.dialogue.nodes);
}

/**
 * Select a dialogue option by index. Returns the next node.
 */
export function selectOption(
  npcId: string,
  currentNodeId: string,
  optionIndex: number,
  playerState: { level: number; questFlags: Record<string, boolean>; factionRep: Record<string, number>; inventory: string[]; classId: string; skillRanks: Record<string, number> },
): DialogueNode | null {
  const npc = NPC_BY_ID[npcId];
  if (!npc) return null;

  const currentNode = npc.dialogue.nodes[currentNodeId];
  if (!currentNode) return null;

  const visibleOptions = getVisibleOptions(currentNode.options, playerState);
  if (optionIndex < 0 || optionIndex >= visibleOptions.length) return null;

  const chosen = visibleOptions[optionIndex];
  if (chosen.nextNode === "END") return null;

  const nextNode = npc.dialogue.nodes[chosen.nextNode];
  if (!nextNode) return null;

  return filterNodeOptions(nextNode, playerState, npc.dialogue.nodes);
}

/**
 * Get quests available to the player from all NPCs at their location.
 * Filters by level, prerequisites, completion state, and cooldowns.
 */
export function getAvailableQuests(
  playerLevel: number,
  completedQuests: string[],
  activeQuests: string[],
  questCooldowns: Record<string, string>,
  currentHour: number,
  hex: Coord,
): Quest[] {
  const npcsHere = getNPCsAtLocation(hex);
  const npcIds = new Set(npcsHere.map(n => n.id));

  return ALL_QUESTS.filter(quest => {
    // Must be given by an NPC at this location
    if (!npcIds.has(quest.giver)) return false;
    // Not already active
    if (activeQuests.includes(quest.id)) return false;
    // Level check
    if (playerLevel < quest.level - 1) return false; // allow 1 level below recommended
    // Prerequisites
    if (quest.prerequisites && !quest.prerequisites.every(p => completedQuests.includes(p))) return false;
    // Completion check (for non-repeatable)
    if (!quest.repeatable && completedQuests.includes(quest.id)) return false;
    // Cooldown check (for repeatable)
    if (quest.repeatable && quest.cooldownHours && questCooldowns[quest.id]) {
      const cooldownEnd = new Date(questCooldowns[quest.id]).getTime();
      const now = Date.now();
      if (now < cooldownEnd) return false;
    }
    return true;
  });
}

/**
 * Accept a quest — returns the quest data or null if not available.
 */
export function acceptQuest(questId: string): Quest | null {
  return QUEST_BY_ID[questId] ?? null;
}

/**
 * Check if a game event progresses any active quest objective.
 * Returns updated progress for affected quests.
 */
export function checkObjectiveProgress(
  activeQuests: QuestProgress[],
  event: { type: ObjectiveType; target: string; count?: number },
): { questId: string; objectiveId: string; newCount: number; completed: boolean }[] {
  const updates: { questId: string; objectiveId: string; newCount: number; completed: boolean }[] = [];

  for (const progress of activeQuests) {
    const quest = QUEST_BY_ID[progress.questId];
    if (!quest) continue;

    for (const obj of quest.objectives) {
      if (obj.type !== event.type) continue;
      // Match target (supports both exact match and category match)
      if (obj.target !== event.target && !event.target.includes(obj.target)) continue;

      const current = progress.objectiveProgress[obj.id] ?? 0;
      const increment = event.count ?? 1;
      const newCount = Math.min(current + increment, obj.count);

      if (newCount > current) {
        updates.push({
          questId: progress.questId,
          objectiveId: obj.id,
          newCount,
          completed: newCount >= obj.count,
        });
      }
    }
  }

  return updates;
}

/**
 * Check if all objectives for a quest are complete.
 */
export function isQuestComplete(questId: string, progress: QuestProgress): boolean {
  const quest = QUEST_BY_ID[questId];
  if (!quest) return false;

  return quest.objectives
    .filter(o => !o.optional)
    .every(obj => (progress.objectiveProgress[obj.id] ?? 0) >= obj.count);
}

/**
 * Complete a quest — returns the rewards.
 * Caller is responsible for applying rewards to save state.
 */
export function completeQuest(questId: string): Reward[] | null {
  const quest = QUEST_BY_ID[questId];
  if (!quest) return null;
  return quest.rewards;
}

/**
 * Get a structured quest log from raw quest progress data.
 */
export function getQuestLog(
  activeQuests: QuestProgress[],
  completedQuestIds: string[],
  failedQuestIds: string[],
): { active: (Quest & { progress: QuestProgress })[]; completed: Quest[]; failed: Quest[] } {
  return {
    active: activeQuests
      .map(p => {
        const quest = QUEST_BY_ID[p.questId];
        return quest ? { ...quest, progress: p } : null;
      })
      .filter((q): q is Quest & { progress: QuestProgress } => q !== null),
    completed: completedQuestIds
      .map(id => QUEST_BY_ID[id])
      .filter((q): q is Quest => q !== undefined),
    failed: failedQuestIds
      .map(id => QUEST_BY_ID[id])
      .filter((q): q is Quest => q !== undefined),
  };
}

/**
 * Check if any active quests have exceeded their time limit.
 * Returns quest IDs that should be failed.
 */
export function checkQuestTimeouts(activeQuests: QuestProgress[], currentHour: number): string[] {
  const failed: string[] = [];
  for (const progress of activeQuests) {
    const quest = QUEST_BY_ID[progress.questId];
    if (!quest || !quest.timeLimit) continue;
    if (currentHour - progress.acceptedHour >= quest.timeLimit) {
      failed.push(progress.questId);
    }
  }
  return failed;
}

/**
 * Get all quests in a chain, ordered by chainOrder.
 */
export function getQuestChain(chainId: string): Quest[] {
  return ALL_QUESTS
    .filter(q => q.chain === chainId)
    .sort((a, b) => (a.chainOrder ?? 0) - (b.chainOrder ?? 0));
}

/**
 * Scale a bounty's difficulty based on player level.
 * Returns modified objective counts and rewards.
 */
export function scaleBounty(questId: string, playerLevel: number): { objectives: Objective[]; rewards: Reward[] } | null {
  const quest = QUEST_BY_ID[questId];
  if (!quest || quest.type !== "bounty") return null;

  const levelScale = Math.max(1, Math.floor(playerLevel / 3));

  const scaledObjectives = quest.objectives.map(obj => ({
    ...obj,
    count: obj.type === "kill" ? obj.count + levelScale : obj.count,
  }));

  const scaledRewards = quest.rewards.map(reward => {
    if (reward.type === "xp") {
      return { ...reward, value: (reward.value as number) + levelScale * 50, description: `${(reward.value as number) + levelScale * 50} XP` };
    }
    if (reward.type === "coins" && reward.coins) {
      const bonusGp = levelScale * 2;
      return { ...reward, coins: { ...reward.coins, gp: reward.coins.gp + bonusGp }, description: `${reward.coins.gp + bonusGp} gp` };
    }
    return reward;
  });

  return { objectives: scaledObjectives, rewards: scaledRewards };
}

// ============================================================================
//  HELPERS (internal)
// ============================================================================

type PlayerState = {
  level: number;
  questFlags: Record<string, boolean>;
  factionRep: Record<string, number>;
  inventory: string[];
  classId: string;
  skillRanks: Record<string, number>;
};

function checkCondition(condition: Condition, state: PlayerState): boolean {
  switch (condition.type) {
    case "flag": return (state.questFlags[condition.flag] ?? false) === condition.value;
    case "level": return state.level >= condition.min;
    case "rep": return (state.factionRep[condition.faction] ?? 0) >= condition.min;
    case "item": return state.inventory.includes(condition.itemId);
    case "coins": return true; // coin check done at transaction time
    case "class": return state.classId === condition.classId;
    case "quest_active": return state.questFlags[`quest_active_${condition.questId}`] ?? false;
    case "quest_complete": return state.questFlags[`quest_complete_${condition.questId}`] ?? false;
    case "skill": return (state.skillRanks[condition.skillId] ?? 0) >= condition.minRanks;
    default: return true;
  }
}

function getVisibleOptions(options: DialogueOption[], state: PlayerState): DialogueOption[] {
  return options.filter(opt => {
    if (!opt.conditions) return true;
    return opt.conditions.every(c => checkCondition(c, state));
  });
}

function filterNodeOptions(
  node: DialogueNode,
  state: PlayerState,
  allNodes: Record<string, DialogueNode>,
): DialogueNode {
  // Check node-level conditions
  if (node.conditions && !node.conditions.every(c => checkCondition(c, state))) {
    // If node conditions fail, return a fallback
    return {
      ...node,
      text: "...",
      options: [{ text: "[Leave]", nextNode: "END" }],
    };
  }

  return {
    ...node,
    options: getVisibleOptions(node.options, state),
  };
}
