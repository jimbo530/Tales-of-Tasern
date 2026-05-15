// dungeons.ts — Modular plug-in dungeon templates
// Dungeons are multi-room sequences. Each quest leg can reference a dungeon theme,
// and the game picks a random template from that theme for variety.
//
// For enemies with count: "scale", WorldMap calculates:
//   Math.floor(Math.random() * 3) + 2 + Math.floor(save.level / 2)

import { DEFAULT_BOON_FIELDS } from "./computeD20Stats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DungeonRoom = {
  roomId: string;
  name: string;
  description: string;
  enemies: DungeonEnemyDef[];
  lootChance: number;
  lootTier: "minor" | "moderate" | "major";
  canRest: boolean;
  isBossRoom: boolean;
};

export type DungeonEnemyDef =
  | { type: "monster"; monsterId: string; emoji: string; count: number | "scale"; nameOverride?: string; hpBoost?: number }
  | { type: "custom"; name: string; emoji: string; stats: Record<string, unknown>; subtypes: string[]; hpOverride: number };

export type DungeonTemplate = {
  id: string;
  name: string;
  theme: string;
  minLevel: number;
  maxLevel: number;
  rooms: DungeonRoom[];
  completionText: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a random dungeon template matching theme + player level */
export function pickDungeon(theme: string, playerLevel: number): DungeonTemplate | null {
  const eligible = DUNGEON_TEMPLATES.filter(
    (d) => d.theme === theme && playerLevel >= d.minLevel && playerLevel <= d.maxLevel,
  );
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/** All unique dungeon themes currently registered */
export function availableThemes(): string[] {
  return Array.from(new Set(DUNGEON_TEMPLATES.map((d) => d.theme)));
}

/** All templates for a given theme, regardless of level */
export function templatesByTheme(theme: string): DungeonTemplate[] {
  return DUNGEON_TEMPLATES.filter((d) => d.theme === theme);
}

// ---------------------------------------------------------------------------
// CRYPT theme — undead, tombs, darkness (levels 2-7)
// ---------------------------------------------------------------------------

const CRYPT_1: DungeonTemplate = {
  id: "crypt_1",
  name: "The Forgotten Crypt",
  theme: "crypt",
  minLevel: 2,
  maxLevel: 5,
  rooms: [
    {
      roomId: "crypt_1_r1",
      name: "Entrance Hall",
      description:
        "Stone steps descend into a vaulted passage choked with cobwebs thick as sailcloth. The air tastes of mildew and old copper, and your torchlight catches the glint of bones scattered across the flagstones. Something rattles in the dark ahead — the dry click of joints that no longer need tendons.",
      enemies: [
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: "scale" },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "crypt_1_r2",
      name: "Burial Chamber",
      description:
        "Rows of stone sarcophagi line both walls, their lids cracked or shoved aside. The stench of decay hangs like a curtain — not ancient dust but something fresher, wetter. Pale shapes shamble between the coffins while a figure in corroded chainmail watches from the far archway with eyes that burn cold blue.",
      enemies: [
        { type: "monster", monsterId: "wight", emoji: "\uD83E\uDDDF", count: 1 },
        { type: "monster", monsterId: "zombie", emoji: "\uD83E\uDDDF\u200D\u2642\uFE0F", count: "scale" },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "crypt_1_r3",
      name: "The Ossuary",
      description:
        "The walls are made of bones. Femurs stacked like cordwood, skulls mortared into columns, rib cages woven into grotesque arches. The room reeks of carrion and something sweeter underneath — paralytic venom. A hunched shape crouches atop a throne of skulls, its long tongue tasting the air as you enter. It grins with too many teeth.",
      enemies: [
        {
          type: "custom",
          name: "Ossuary Ghast",
          emoji: "\uD83D\uDC80",
          stats: {
            str: 8, dex: 6, con: 7, int: 4, wis: 3, cha: 5,
            ac: 17, naturalArmor: 3, atk: 5, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "boss"],
          hpOverride: 38,
        },
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 3 },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Ossuary Ghast collapses in a heap of cracked bone and rotting sinew, its death rattle echoing through the charnel house. Silence returns to the crypt — true silence, the kind that follows the end of something that should never have stirred. Among the scattered remains you find grave goods the dead no longer need.",
};

const CRYPT_2: DungeonTemplate = {
  id: "crypt_2",
  name: "Tomb of the Iron Priests",
  theme: "crypt",
  minLevel: 4,
  maxLevel: 7,
  rooms: [
    {
      roomId: "crypt_2_r1",
      name: "Antechamber",
      description:
        "The entrance is sealed behind a slab of iron-banded stone carved with prayers to a god whose name has been chiseled away. Beyond it, the antechamber stretches wide and low, its ceiling blackened by centuries of torch soot. Skeletons in rusted priestly vestments stand in alcoves along the walls, their empty sockets tracking your movement.",
      enemies: [
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: "scale", nameOverride: "Priestly Skeleton" },
      ],
      lootChance: 0.25,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "crypt_2_r2",
      name: "Prayer Hall",
      description:
        "Rows of stone pews face a shattered altar, its surface stained black with something that was once blood. The frescoes on the walls depict burial rites — washing the dead, binding their jaws, filling their mouths with iron coins. The dead here did not stay washed. Shambling corpses kneel in the pews as if at prayer, and when your light touches them they rise with a gurgling moan.",
      enemies: [
        { type: "monster", monsterId: "zombie", emoji: "\uD83E\uDDDF\u200D\u2642\uFE0F", count: "scale" },
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 2, nameOverride: "Armored Skeleton", hpBoost: 4 },
      ],
      lootChance: 0.35,
      lootTier: "minor",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "crypt_2_r3",
      name: "Inner Sanctum",
      description:
        "Past the prayer hall, iron doors hang from broken hinges. The inner sanctum smells of embalming spice and old incense — and underneath, the wet-dog stench of ghouls. A wight in ceremonial plate stands before a sealed reliquary, flanked by two ghouls that crouch on all fours like hounds. The wight raises a corroded mace and speaks in a voice like grinding gravel: words in a dead language, but the meaning is clear enough.",
      enemies: [
        {
          type: "custom",
          name: "Iron Priest Wight",
          emoji: "\uD83E\uDDDF",
          stats: {
            str: 8, dex: 5, con: 7, int: 4, wis: 5, cha: 6,
            ac: 17, naturalArmor: 3, atk: 5, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead"],
          hpOverride: 42,
        },
        { type: "monster", monsterId: "ghoul", emoji: "\uD83E\uDDDF\u200D\u2642\uFE0F", count: 2 },
      ],
      lootChance: 0.5,
      lootTier: "moderate",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "crypt_2_r4",
      name: "The Reliquary",
      description:
        "The sealed door gives way to reveal a chamber of polished black stone. Gold-inlaid shelves hold funeral urns, votive icons, and a single iron sarcophagus at the center, wrapped in chains etched with binding sigils. The chains are broken. The lid stands open. From inside, linen wrappings stir as something ancient and desiccated pulls itself upright, eyes burning with amber malice beneath a death mask of hammered iron.",
      enemies: [
        {
          type: "custom",
          name: "The Iron Mummy",
          emoji: "\uD83D\uDC51",
          stats: {
            str: 10, dex: 4, con: 9, int: 5, wis: 6, cha: 8,
            ac: 19, naturalArmor: 5, atk: 6, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "boss"],
          hpOverride: 55,
        },
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 2, nameOverride: "Guardian Skeleton", hpBoost: 3 },
      ],
      lootChance: 0.8,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Iron Mummy crumbles to dust within its wrappings, the death mask clanging against the sarcophagus rim. The amber light dies, and the reliquary is just a room again — cold stone and old gold. The funeral urns hold offerings that the Iron Priests meant to carry into the afterlife. They won't be needing them.",
};

const CRYPT_3: DungeonTemplate = {
  id: "crypt_3",
  name: "The Whispering Barrow",
  theme: "crypt",
  minLevel: 3,
  maxLevel: 6,
  rooms: [
    {
      roomId: "crypt_3_r1",
      name: "Barrow Entry",
      description:
        "The barrow mouth gapes in the hillside like a wound, ringed with standing stones crusted with lichen. Inside, the passage narrows to a crawl, reeking of animal musk and rotting straw. Dire rats scatter from your torchlight, their eyes reflecting red, while stirges cling to the ceiling like fleshy bats, proboscises twitching at the scent of warm blood.",
      enemies: [
        { type: "monster", monsterId: "dire_rat", emoji: "\uD83D\uDC00", count: "scale" },
        { type: "monster", monsterId: "stirge", emoji: "\uD83E\uDD9F", count: 3 },
      ],
      lootChance: 0.2,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "crypt_3_r2",
      name: "Bone Tunnel",
      description:
        "The passage widens into a tunnel shored up with femur bones lashed together with wire and sinew. The floor is a carpet of finger bones that crunch underfoot. A cold draft carries the sound of clicking teeth and low, rattling moans. Shapes move at the edge of your torchlight — a skeleton dragging a rusted sword, and behind it, a ghoul hunched over something it doesn't want to share.",
      enemies: [
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 3 },
        { type: "monster", monsterId: "ghoul", emoji: "\uD83E\uDDDF\u200D\u2642\uFE0F", count: 2 },
      ],
      lootChance: 0.35,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "crypt_3_r3",
      name: "Burial King's Chamber",
      description:
        "The tunnel opens into a domed chamber of packed earth and ancient timber. At the center, a burial platform holds the remains of a warrior-king in corroded bronze armor, his longsword laid across his chest. The whispers you've been hearing since the entrance crescendo here — a hundred dead voices murmuring in a language older than the city above. The king's eyes snap open, cold and white, and his skeleton guards stir from their alcoves.",
      enemies: [
        {
          type: "custom",
          name: "The Burial King",
          emoji: "\uD83D\uDC51",
          stats: {
            str: 9, dex: 5, con: 8, int: 4, wis: 5, cha: 7,
            ac: 18, naturalArmor: 4, atk: 6, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "boss"],
          hpOverride: 48,
        },
        { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 4, nameOverride: "Barrow Guard", hpBoost: 3 },
      ],
      lootChance: 0.75,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Burial King falls, and the whispers stop — all at once, like a door slamming shut. The bronze armor splits as the body within crumbles to nothing. Silence fills the barrow for the first time in centuries. The grave goods of a forgotten chieftain lie scattered among the bones of his court.",
};

// ---------------------------------------------------------------------------
// SEWER theme — rats, oozes, cultists (levels 1-6)
// ---------------------------------------------------------------------------

const SEWER_1: DungeonTemplate = {
  id: "sewer_1",
  name: "Rat King's Domain",
  theme: "sewer",
  minLevel: 1,
  maxLevel: 4,
  rooms: [
    {
      roomId: "sewer_1_r1",
      name: "Storm Drain",
      description:
        "The iron grate groans as you pry it open. Below, ankle-deep water carries a stench that makes your eyes water — raw sewage, rotting food, and something sharper, like ammonia. The tunnel is lined with slick brick, and the squeaking starts almost immediately. Dozens of red eyes reflect your light from ledges and overflow pipes. The rats here are the size of terriers, and they are not afraid of you.",
      enemies: [
        { type: "monster", monsterId: "dire_rat", emoji: "\uD83D\uDC00", count: "scale" },
      ],
      lootChance: 0.2,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "sewer_1_r2",
      name: "The Cistern",
      description:
        "The tunnel opens into a vast cistern, the ceiling lost in darkness above. A central pillar of corroded iron rises from waist-deep water that churns with movement. Rat swarms boil across the surface like a living carpet, and near the far wall something large and tentacled stirs in a mound of refuse — an otyugh, half-submerged, its eye-stalk tracking you with lazy malice.",
      enemies: [
        { type: "monster", monsterId: "rat_swarm", emoji: "\uD83D\uDC00", count: 2 },
        { type: "monster", monsterId: "otyugh", emoji: "\uD83D\uDC19", count: 1 },
      ],
      lootChance: 0.35,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "sewer_1_r3",
      name: "Throne of Filth",
      description:
        "Beyond the cistern, a dry alcove has been built into a grotesque parody of a throne room. Bones, rags, and refuse are piled into a mound topped by a chair of lashed-together scrap metal. On it sits the Rat King — a massive dire rat the size of a pony, its fur matted with filth, its tail a knotted mass tangled with the tails of a dozen lesser rats. It regards you with intelligence that no rat should possess, and bares teeth as long as your fingers.",
      enemies: [
        { type: "monster", monsterId: "dire_rat", emoji: "\uD83D\uDC00", count: 4, nameOverride: "Giant Sewer Rat" },
        {
          type: "custom",
          name: "The Rat King",
          emoji: "\uD83D\uDC00",
          stats: {
            str: 7, dex: 7, con: 6, int: 3, wis: 4, cha: 5,
            ac: 16, naturalArmor: 3, atk: 4, speed: 35,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["animal", "boss"],
          hpOverride: 35,
        },
      ],
      lootChance: 0.6,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Rat King shrieks and topples from its filthy throne, the knotted tails tearing loose in a spray of blood. The lesser rats scatter, leaderless, pouring into drain pipes and cracks in the masonry. The stench is appalling, but among the refuse mound you spot the glint of coins and lost possessions dragged down from the streets above.",
};

const SEWER_2: DungeonTemplate = {
  id: "sewer_2",
  name: "The Undercity",
  theme: "sewer",
  minLevel: 3,
  maxLevel: 6,
  rooms: [
    {
      roomId: "sewer_2_r1",
      name: "Collapsed Tunnel",
      description:
        "A section of sewer tunnel has collapsed into older foundations — stonework from a city that existed before Kardov's Gate. Kobolds have shored up the rubble with stolen timber and turned the passage into a checkpoint. Crude barricades block the way forward, and you can hear their chittering from behind the fortifications. They were expecting someone, but not you.",
      enemies: [
        { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: "scale" },
      ],
      lootChance: 0.25,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "sewer_2_r2",
      name: "Fungal Grotto",
      description:
        "Past the kobold checkpoint, the tunnel opens into a natural cavern carpeted in luminous fungus — pale blues and sickly greens that pulse with a slow rhythm like breathing. The air is thick with spores that taste of rot and copper. Mushroom stalks the height of a man sway without wind, and among them, shapes that look like mushrooms but move like men turn toward you. Their bodies split open to reveal mouths full of grinding teeth.",
      enemies: [
        {
          type: "custom",
          name: "Fungal Shambler",
          emoji: "\uD83C\uDF44",
          stats: {
            str: 6, dex: 2, con: 7, int: 1, wis: 2, cha: 1,
            ac: 14, naturalArmor: 3, atk: 3, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 28,
        },
        {
          type: "custom",
          name: "Fungal Shambler",
          emoji: "\uD83C\uDF44",
          stats: {
            str: 6, dex: 2, con: 7, int: 1, wis: 2, cha: 1,
            ac: 14, naturalArmor: 3, atk: 3, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 28,
        },
        {
          type: "custom",
          name: "Sporeling",
          emoji: "\uD83C\uDF44",
          stats: {
            str: 4, dex: 3, con: 5, int: 1, wis: 1, cha: 1,
            ac: 12, naturalArmor: 2, atk: 2, speed: 15,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 15,
        },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "sewer_2_r3",
      name: "Cultist Hideout",
      description:
        "Behind the fungal grotto, someone has bricked up a section of old foundation and turned it into a hidden meeting hall. Black candles guttered in iron sconces, their wax pooling on a floor painted with ritual circles in dried blood. Robed figures stand at crude desks covered in profane texts and alchemical apparatus. They turn as one when you enter, reaching for curved daggers and muttering invocations.",
      enemies: [
        {
          type: "custom",
          name: "Sewer Cultist",
          emoji: "\uD83E\uDDD9",
          stats: {
            str: 4, dex: 5, con: 4, int: 4, wis: 3, cha: 3,
            ac: 14, naturalArmor: 0, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid"],
          hpOverride: 22,
        },
        {
          type: "custom",
          name: "Sewer Cultist",
          emoji: "\uD83E\uDDD9",
          stats: {
            str: 4, dex: 5, con: 4, int: 4, wis: 3, cha: 3,
            ac: 14, naturalArmor: 0, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid"],
          hpOverride: 22,
        },
        {
          type: "custom",
          name: "Cult Enforcer",
          emoji: "\uD83D\uDDE1\uFE0F",
          stats: {
            str: 7, dex: 5, con: 6, int: 2, wis: 2, cha: 2,
            ac: 16, naturalArmor: 1, atk: 4, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid"],
          hpOverride: 30,
        },
      ],
      lootChance: 0.45,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "sewer_2_r4",
      name: "Dark Altar",
      description:
        "A spiral staircase of ancient stone descends from the hideout into a vaulted chamber that predates every building in Kardov's Gate. An altar of black basalt dominates the room, its surface slick with fresh blood that runs in channels to a central basin. Before it stands a figure in layered robes of shadow-dark silk, hands raised in supplication to something you cannot see. The air crackles with wrongness. The Shadow Priest turns, and the darkness around him moves with purpose.",
      enemies: [
        {
          type: "custom",
          name: "The Shadow Priest",
          emoji: "\u2620\uFE0F",
          stats: {
            str: 5, dex: 6, con: 6, int: 8, wis: 7, cha: 8,
            ac: 18, naturalArmor: 2, atk: 5, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid", "boss"],
          hpOverride: 48,
        },
        {
          type: "custom",
          name: "Shadow Tendril",
          emoji: "\uD83D\uDDA4",
          stats: {
            str: 5, dex: 7, con: 3, int: 1, wis: 1, cha: 1,
            ac: 15, naturalArmor: 1, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "shadow"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Shadow Tendril",
          emoji: "\uD83D\uDDA4",
          stats: {
            str: 5, dex: 7, con: 3, int: 1, wis: 1, cha: 1,
            ac: 15, naturalArmor: 1, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "shadow"],
          hpOverride: 18,
        },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Shadow Priest screams as his connection to whatever answered his prayers is severed. He crumbles inward, robes collapsing around a body that seems decades older than it was moments ago. The altar cracks down the middle with a sound like a gunshot, and the blood in the basin evaporates in a hiss of foul steam. The undercity is quiet again — for now.",
};

// ---------------------------------------------------------------------------
// CAVE theme — beasts, spiders, natural (levels 2-7)
// ---------------------------------------------------------------------------

const CAVE_1: DungeonTemplate = {
  id: "cave_1",
  name: "Spider Nest",
  theme: "cave",
  minLevel: 2,
  maxLevel: 5,
  rooms: [
    {
      roomId: "cave_1_r1",
      name: "Web-Choked Entry",
      description:
        "The cave mouth is curtained with webs so thick they've caught leaves, bird bones, and what looks like a human boot. The silk is sticky and impossibly strong — you have to cut your way through. Beyond the curtain, the passage narrows, its walls furred with smaller webs. Spiders the size of your fist skitter away from your torch, but the ones deeper in hold their ground, mandibles clicking.",
      enemies: [
        { type: "monster", monsterId: "small_spider", emoji: "\uD83D\uDD77\uFE0F", count: "scale" },
      ],
      lootChance: 0.2,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "cave_1_r2",
      name: "Egg Chamber",
      description:
        "The tunnel widens into a chamber draped floor-to-ceiling in dense webbing. Hundreds of pale egg sacs hang from the ceiling like grotesque lanterns, some pulsing with movement inside. Medium-sized spiders patrol between the clusters, their legs making a dry ticking sound on the stone. The air is warm and humid, thick with a sour chemical smell. Disturbing the eggs would be unwise — but there is no path that avoids them.",
      enemies: [
        { type: "monster", monsterId: "medium_spider", emoji: "\uD83D\uDD77\uFE0F", count: 2 },
        { type: "monster", monsterId: "small_spider", emoji: "\uD83D\uDD77\uFE0F", count: "scale" },
      ],
      lootChance: 0.35,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "cave_1_r3",
      name: "Queen's Lair",
      description:
        "The deepest chamber is a cathedral of silk. Webs span the cavern in geometric patterns that catch the torchlight like crystalline architecture. At the center, suspended in a cradle of the thickest silk, sits the Broodmother — a spider as large as a cart horse, her abdomen swollen with eggs, her eight eyes reflecting your light in emerald clusters. She drops from her web with terrible grace and a sound like ripping canvas.",
      enemies: [
        {
          type: "custom",
          name: "The Broodmother",
          emoji: "\uD83D\uDD77\uFE0F",
          stats: {
            str: 8, dex: 7, con: 7, int: 2, wis: 4, cha: 3,
            ac: 17, naturalArmor: 4, atk: 5, speed: 35,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["vermin", "boss"],
          hpOverride: 45,
        },
        { type: "monster", monsterId: "small_spider", emoji: "\uD83D\uDD77\uFE0F", count: 3, nameOverride: "Brood Guardian" },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Broodmother curls inward, legs twitching, venom pooling beneath her. The smaller spiders flee into cracks in the rock, suddenly leaderless. The egg sacs sway in the still air, their contents mercifully dormant. Wrapped in silk cocoons around the lair you find the possessions of less fortunate adventurers — their bones picked clean, but their gear intact.",
};

const CAVE_2: DungeonTemplate = {
  id: "cave_2",
  name: "The Deep Warren",
  theme: "cave",
  minLevel: 3,
  maxLevel: 7,
  rooms: [
    {
      roomId: "cave_2_r1",
      name: "Narrow Passage",
      description:
        "The cave system begins as a tight fissure in a cliff face, wide enough for one person at a time. Tool marks on the walls suggest someone — or something — has been widening it. Crude torches gutter in sconces of hammered tin. The passage smells of smoke, damp fur, and the sharp tang of goblin musk. Voices echo from ahead, arguing in two different guttural languages.",
      enemies: [
        { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: 3 },
        { type: "monster", monsterId: "goblin", emoji: "\uD83D\uDC7A", count: "scale" },
      ],
      lootChance: 0.25,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "cave_2_r2",
      name: "Mushroom Forest",
      description:
        "The narrow passage opens into a vast cavern where bioluminescent mushrooms grow as tall as trees. Their caps cast a pale blue-green glow over everything, and the air is heavy with spores that taste like wet earth. Among the giant stalks, squat figures with mottled grey-green skin and fungal growths on their bodies watch you with eyes like dark marbles. Myconids — the mushroom folk. They are territorial, and you are trespassing.",
      enemies: [
        {
          type: "custom",
          name: "Myconid Guard",
          emoji: "\uD83C\uDF44",
          stats: {
            str: 7, dex: 3, con: 7, int: 3, wis: 5, cha: 2,
            ac: 15, naturalArmor: 4, atk: 4, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 32,
        },
        {
          type: "custom",
          name: "Myconid Guard",
          emoji: "\uD83C\uDF44",
          stats: {
            str: 7, dex: 3, con: 7, int: 3, wis: 5, cha: 2,
            ac: 15, naturalArmor: 4, atk: 4, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 32,
        },
        {
          type: "custom",
          name: "Myconid Sprout",
          emoji: "\uD83C\uDF31",
          stats: {
            str: 3, dex: 2, con: 4, int: 2, wis: 3, cha: 1,
            ac: 12, naturalArmor: 2, atk: 2, speed: 15,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["plant"],
          hpOverride: 12,
        },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "cave_2_r3",
      name: "Underground River",
      description:
        "A subterranean river cuts through the cavern, black water rushing over smooth stone with a roar that drowns out conversation. A crude rope bridge spans the gap, and on the far side, lizardfolk crouch on the riverbank. Their scales glisten with moisture, and their eyes are adapted to the dark — they saw you long before you saw them. Spears leveled, they hiss a challenge across the water.",
      enemies: [
        { type: "monster", monsterId: "lizardfolk", emoji: "\uD83E\uDD8E", count: "scale" },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "cave_2_r4",
      name: "Crystal Cavern",
      description:
        "Past the river, the cave opens into a glittering vault of natural crystal formations — quartz pillars, amethyst clusters, and veins of something that glows with its own faint warmth. The beauty is ruined by the smell — a thick, animal reek that makes your stomach clench. A massive shape blocks the passage ahead, grey-green hide stretched over slabs of muscle, a face like a cliff face with deep-set eyes and a mouth full of broken-stone teeth. A cave troll, and it is very much at home.",
      enemies: [
        {
          type: "custom",
          name: "Crystal Cavern Troll",
          emoji: "\uD83E\uDDCC",
          stats: {
            str: 11, dex: 4, con: 10, int: 2, wis: 3, cha: 2,
            ac: 18, naturalArmor: 5, atk: 6, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["giant", "boss"],
          hpOverride: 58,
        },
        { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: 3, nameOverride: "Troll-Thrall Kobold" },
      ],
      lootChance: 0.75,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The troll crashes backward into a crystal pillar, shattering it in a shower of amethyst shards. It doesn't get up. The kobold thralls scatter, their master's dominance broken. The crystal cavern gleams around you, and among the troll's hoard — bones, broken weapons, and a truly impressive pile of dung — you find treasures it was too stupid to value.",
};

// ---------------------------------------------------------------------------
// TOWER theme — arcane, constructs, wizards (levels 4-8)
// ---------------------------------------------------------------------------

const TOWER_1: DungeonTemplate = {
  id: "tower_1",
  name: "The Shattered Spire",
  theme: "tower",
  minLevel: 4,
  maxLevel: 7,
  rooms: [
    {
      roomId: "tower_1_r1",
      name: "Ground Floor",
      description:
        "The tower door hangs off one hinge, scorched black by some past explosion. Inside, the ground floor is a ruin of overturned furniture and shattered glass. Soot stains climb the walls in patterns that suggest directed blasts, not random fire. Standing amid the wreckage, suits of plate armor hold formation — no bodies inside, just empty steel that moves with mechanical precision, swords rising as you enter.",
      enemies: [
        {
          type: "custom",
          name: "Animated Armor",
          emoji: "\uD83E\uDEE8",
          stats: {
            str: 8, dex: 2, con: 7, int: 1, wis: 1, cha: 1,
            ac: 17, naturalArmor: 5, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 32,
        },
        {
          type: "custom",
          name: "Animated Armor",
          emoji: "\uD83E\uDEE8",
          stats: {
            str: 8, dex: 2, con: 7, int: 1, wis: 1, cha: 1,
            ac: 17, naturalArmor: 5, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 32,
        },
        {
          type: "custom",
          name: "Flying Sword",
          emoji: "\u2694\uFE0F",
          stats: {
            str: 5, dex: 6, con: 3, int: 1, wis: 1, cha: 1,
            ac: 15, naturalArmor: 2, atk: 4, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 18,
        },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "tower_1_r2",
      name: "The Library",
      description:
        "Spiral stairs lead to a circular library that smells of ozone and old parchment. Books float between shelves on invisible currents, rearranging themselves in patterns that hurt to follow. An arcane guardian patrols the stacks — a humanoid shape woven from blue-white energy, its featureless face turning to track you. Runes on the floor pulse in warning. The library's defenses are very much still operational.",
      enemies: [
        {
          type: "custom",
          name: "Arcane Guardian",
          emoji: "\u2728",
          stats: {
            str: 6, dex: 7, con: 6, int: 6, wis: 5, cha: 4,
            ac: 17, naturalArmor: 3, atk: 5, speed: 30,
            lightningDmg: 2, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct", "arcane"],
          hpOverride: 38,
        },
        {
          type: "custom",
          name: "Arcane Guardian",
          emoji: "\u2728",
          stats: {
            str: 6, dex: 7, con: 6, int: 6, wis: 5, cha: 4,
            ac: 17, naturalArmor: 3, atk: 5, speed: 30,
            lightningDmg: 2, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct", "arcane"],
          hpOverride: 38,
        },
      ],
      lootChance: 0.5,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "tower_1_r3",
      name: "Summoning Circle",
      description:
        "The top of the spire is open to the sky — the roof blasted away in whatever catastrophe ruined this place. A summoning circle ten feet across is carved into the floor, its channels filled with quicksilver that still flows in slow spirals. At the circle's center, a shape of compressed fire and crackling lightning strains against invisible bonds. A bound elemental, left here when its summoner fled or died, and it has had a long time to grow angry.",
      enemies: [
        {
          type: "custom",
          name: "Bound Elemental",
          emoji: "\uD83D\uDD25",
          stats: {
            str: 9, dex: 8, con: 8, int: 3, wis: 4, cha: 5,
            ac: 19, naturalArmor: 4, atk: 6, speed: 35,
            lightningDmg: 3, fireDmg: 3,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["elemental", "boss"],
          hpOverride: 55,
        },
      ],
      lootChance: 0.75,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The elemental detonates in a burst of steam and ozone, the summoning circle cracking apart as the binding fails. Quicksilver sprays across the floor and cools into beads of silver. The sky is visible through the ruined roof, and for a moment the tower feels almost peaceful. The wizard who built this place left notes, reagents, and more than a few valuables behind.",
};

const TOWER_2: DungeonTemplate = {
  id: "tower_2",
  name: "Wizard's Folly",
  theme: "tower",
  minLevel: 5,
  maxLevel: 8,
  rooms: [
    {
      roomId: "tower_2_r1",
      name: "The Laboratory",
      description:
        "The tower's ground floor has been converted into an alchemical laboratory of staggering ambition and equally staggering disarray. Glass apparatus bubbles unattended, viscous liquids drip between retorts, and the air stings with chemical fumes. Scuttling between the apparatus are homunculi — small, malformed humanoids with oversized heads and grasping fingers, created as lab assistants and now defending their master's work with frantic, vicious energy.",
      enemies: [
        {
          type: "custom",
          name: "Frenzied Homunculus",
          emoji: "\uD83E\uDDEC",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 2, cha: 1,
            ac: 15, naturalArmor: 1, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Frenzied Homunculus",
          emoji: "\uD83E\uDDEC",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 2, cha: 1,
            ac: 15, naturalArmor: 1, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Alchemical Golem",
          emoji: "\uD83E\uDDEA",
          stats: {
            str: 8, dex: 3, con: 8, int: 1, wis: 1, cha: 1,
            ac: 16, naturalArmor: 4, atk: 4, speed: 20,
            lightningDmg: 0, fireDmg: 2,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct"],
          hpOverride: 35,
        },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "tower_2_r2",
      name: "Trophy Room",
      description:
        "The second floor is a gallery of petrified creatures displayed on marble pedestals — a wolf, a hawk, a goblin frozen mid-snarl. Display cases hold exotic specimens in preserving fluid. But the centerpiece stands on a raised dais near the staircase: a gargoyle of grey stone, wings folded, horned head tilted as if listening. It is not a trophy. The scratches on the floor around its pedestal suggest it moves when visitors aren't watching.",
      enemies: [
        { type: "monster", monsterId: "gargoyle", emoji: "\uD83E\uDEA8", count: 2 },
      ],
      lootChance: 0.35,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "tower_2_r3",
      name: "The Observatory",
      description:
        "The top floor is an observatory with a domed glass ceiling that shows stars even at midday — wrong stars, in wrong constellations. Brass instruments track celestial bodies that don't exist in your sky. At the center, hunched over a desk covered in star charts and scrawled calculations, is the wizard's former apprentice. He hasn't eaten in weeks and doesn't seem to notice. His eyes are solid black, reflecting those wrong stars. When he speaks, his voice has harmonics that suggest something else is speaking with him.",
      enemies: [
        {
          type: "custom",
          name: "Malachar, the Mad Apprentice",
          emoji: "\uD83E\uDDD9",
          stats: {
            str: 4, dex: 7, con: 6, int: 10, wis: 3, cha: 7,
            ac: 18, naturalArmor: 2, atk: 6, speed: 30,
            lightningDmg: 3, fireDmg: 2,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid", "aberrant", "boss"],
          hpOverride: 52,
        },
        {
          type: "custom",
          name: "Star Wisp",
          emoji: "\u2B50",
          stats: {
            str: 1, dex: 8, con: 2, int: 3, wis: 3, cha: 3,
            ac: 16, naturalArmor: 1, atk: 4, speed: 40,
            lightningDmg: 2, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "arcane"],
          hpOverride: 15,
        },
        {
          type: "custom",
          name: "Star Wisp",
          emoji: "\u2B50",
          stats: {
            str: 1, dex: 8, con: 2, int: 3, wis: 3, cha: 3,
            ac: 16, naturalArmor: 1, atk: 4, speed: 40,
            lightningDmg: 2, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "arcane"],
          hpOverride: 15,
        },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "Malachar collapses as the black drains from his eyes, leaving them bloodshot and terribly human. The wrong stars above flicker and are replaced by honest daylight through cracked glass. He's alive but barely conscious, muttering about 'the space between stars' and 'the things that swim there.' The observatory is full of arcane instruments, rare reagents, and research notes that the Magisters would pay handsomely for.",
};

// ---------------------------------------------------------------------------
// DWARVEN theme — goblinoids, constructs, stone (levels 3-9)
// ---------------------------------------------------------------------------

const DWARVEN_1: DungeonTemplate = {
  id: "dwarven_1",
  name: "Collapsed Mine",
  theme: "dwarven",
  minLevel: 3,
  maxLevel: 6,
  rooms: [
    {
      roomId: "dwarven_1_r1",
      name: "Mine Entrance",
      description:
        "The mine entrance is framed by timber beams carved with dwarven runes of safe passage — ironic, given the state of things. The first chamber is a staging area, carts overturned, pick-axes scattered, and the stink of goblin fires. They've claimed the mine as a stronghold, blocking the tunnels with crude barricades of mine carts and rubble. Green-skinned figures peer over the top, bows drawn.",
      enemies: [
        { type: "monster", monsterId: "goblin", emoji: "\uD83D\uDC7A", count: "scale" },
        { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: 3 },
      ],
      lootChance: 0.25,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "dwarven_1_r2",
      name: "Ore Vein",
      description:
        "Deeper in, the mine opens into a natural seam of iron ore, the walls glittering with metallic flecks. The goblins haven't come this far — something else has. A bugbear crouches in the shadows near a collapsed side passage, gnawing on something you don't want to identify. Giant ants have burrowed into the ore vein from below, their mandibles carving tunnels with mechanical efficiency. The bugbear doesn't seem to mind them. You, it minds.",
      enemies: [
        { type: "monster", monsterId: "bugbear", emoji: "\uD83D\uDC3B", count: 1 },
        { type: "monster", monsterId: "giant_ant_worker", emoji: "\uD83D\uDC1C", count: "scale" },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "dwarven_1_r3",
      name: "Forge Room",
      description:
        "At the deepest point of the mine, you find something the goblins never reached: an intact dwarven forge. The bellows still work, the anvil still rings when struck, and the coals in the forge pit glow with a warmth that has endured centuries. Guarding it is a construct of stone and iron — a sentinel shaped in the image of a dwarven warrior, runes blazing across its chest. It activates as you cross the threshold, stone grinding on stone as it raises a hammer the size of a man.",
      enemies: [
        {
          type: "custom",
          name: "Stone Sentinel",
          emoji: "\uD83E\uDEA8",
          stats: {
            str: 10, dex: 2, con: 10, int: 1, wis: 4, cha: 1,
            ac: 19, naturalArmor: 6, atk: 6, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct", "earth", "boss"],
          hpOverride: 52,
        },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Stone Sentinel crumbles, runes fading, its duty finally ended. The forge room is intact — a treasure in itself, with dwarven-forged tools, ingots of refined ore, and craft secrets pressed into clay tablets. The forge coals dim slightly, as if mourning their guardian, but they don't go out. They've been burning for centuries. They'll burn for centuries more.",
};

const DWARVEN_2: DungeonTemplate = {
  id: "dwarven_2",
  name: "Halls of the Mountain King",
  theme: "dwarven",
  minLevel: 5,
  maxLevel: 9,
  rooms: [
    {
      roomId: "dwarven_2_r1",
      name: "Gate Hall",
      description:
        "The great doors of the Mountain King's halls still stand — fifteen feet of iron-banded stone carved with images of dwarven armies marching to war. They've been pried open just wide enough for the hobgoblin warband that now uses the gate hall as a barracks. Military discipline is evident: bedrolls in neat rows, weapons racked, sentries posted. These aren't raiders; they're an occupying force, and they react to your intrusion like soldiers.",
      enemies: [
        { type: "monster", monsterId: "hobgoblin", emoji: "\uD83D\uDDE1\uFE0F", count: "scale" },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "dwarven_2_r2",
      name: "Feast Hall",
      description:
        "Past the gate, the feast hall stretches long enough to seat a hundred dwarves. The stone tables are still standing, now covered in the remains of cruder meals — gnawed bones, spilled grog, grease stains. An ogre has claimed the head of the table, sitting in the Mountain King's stone chair with its legs propped up on the table, belly distended with recent eating. Goblins scurry around it like servants, clearing plates and filling cups. The ogre sees you and grins with stained teeth.",
      enemies: [
        { type: "monster", monsterId: "ogre", emoji: "\uD83E\uDDCC", count: 1 },
        { type: "monster", monsterId: "goblin", emoji: "\uD83D\uDC7A", count: "scale" },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "dwarven_2_r3",
      name: "The Armory",
      description:
        "The dwarven armory is a vaulted chamber of weapon racks and armor stands, most stripped bare by the goblinoid occupiers. But the inner vault remains sealed — and guarded. Before the vault door stands a dwarven construct of bronze and granite, its eyes glowing with steady amber light. Unlike the crude occupiers outside, this thing was built to endure. Runes of warding flare along its arms as it registers your presence. It doesn't distinguish between intruders. You are all intruders.",
      enemies: [
        {
          type: "custom",
          name: "Dwarven Warden",
          emoji: "\uD83E\uDD16",
          stats: {
            str: 10, dex: 3, con: 9, int: 3, wis: 5, cha: 1,
            ac: 19, naturalArmor: 6, atk: 6, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["construct", "boss"],
          hpOverride: 55,
        },
        { type: "monster", monsterId: "hobgoblin", emoji: "\uD83D\uDDE1\uFE0F", count: 2, nameOverride: "Hobgoblin Raider" },
      ],
      lootChance: 0.55,
      lootTier: "moderate",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "dwarven_2_r4",
      name: "Throne Room",
      description:
        "The throne room is the heart of the mountain — a circular chamber with a domed ceiling lost in shadow, its walls carved with the history of the dwarven kingdom from founding to fall. The throne itself is carved from a single block of mithral-veined granite, and on it sits a figure in full dwarven regalia. The crown is tarnished, the armor corroded, and the king has been dead for a very long time. But something lingers — a curse, an oath, a grudge that outlasted the flesh. His eyes blaze white, and when he stands, the mountain groans.",
      enemies: [
        {
          type: "custom",
          name: "The Cursed King",
          emoji: "\uD83D\uDC51",
          stats: {
            str: 12, dex: 4, con: 11, int: 6, wis: 7, cha: 10,
            ac: 20, naturalArmor: 5, atk: 8, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "dwarf", "boss"],
          hpOverride: 75,
        },
        {
          type: "custom",
          name: "Cursed Honor Guard",
          emoji: "\uD83D\uDEE1\uFE0F",
          stats: {
            str: 8, dex: 3, con: 8, int: 2, wis: 3, cha: 2,
            ac: 18, naturalArmor: 4, atk: 5, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "dwarf"],
          hpOverride: 38,
        },
        {
          type: "custom",
          name: "Cursed Honor Guard",
          emoji: "\uD83D\uDEE1\uFE0F",
          stats: {
            str: 8, dex: 3, con: 8, int: 2, wis: 3, cha: 2,
            ac: 18, naturalArmor: 4, atk: 5, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["undead", "dwarf"],
          hpOverride: 38,
        },
      ],
      lootChance: 0.8,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Cursed King sinks to one knee, the white fire leaving his eyes. For a heartbeat, something like recognition crosses the ancient face — gratitude, perhaps, or simply relief. Then he is dust and tarnished metal, the crown rolling across the flagstones with a sound like a bell. The mountain falls quiet. The throne room's carvings seem brighter, as if a shadow has lifted from the stone. The Mountain King's treasury lies behind the throne, sealed for centuries, waiting.",
};

// ---------------------------------------------------------------------------
// DEMONIC theme — fiends, corruption, fire (levels 5-9)
// ---------------------------------------------------------------------------

const DEMONIC_1: DungeonTemplate = {
  id: "demonic_1",
  name: "The Bleeding Gate",
  theme: "demonic",
  minLevel: 5,
  maxLevel: 8,
  rooms: [
    {
      roomId: "demonic_1_r1",
      name: "Desecrated Chapel",
      description:
        "The chapel was consecrated to a god of mercy once — you can tell by the shattered stained glass and the defaced holy symbols. Now the pews are firewood, the altar is an abattoir, and the walls weep a dark substance that hisses when it touches the floor. Lesser imps perch in the rafters like obscene pigeons, their tiny eyes bright with malice. The air is fever-hot and tastes of iron and sulfur.",
      enemies: [
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "demonic_1_r2",
      name: "Summoning Pit",
      description:
        "Below the chapel, stairs descend into a natural cave that has been carved into a ritual chamber. A pit yawns in the center, its edges ringed with sigils that glow like coals. Heat rises from below in waves that distort the air. Prowling the pit's edge are fiendish hounds — coal-black, flame-eyed, their breath leaving scorch marks on the stone. An imp perches on a lectern nearby, reading from a profane text in a shrieking falsetto, directing the summoning.",
      enemies: [
        {
          type: "custom",
          name: "Fiendish Hound",
          emoji: "\uD83D\uDC3A",
          stats: {
            str: 7, dex: 6, con: 6, int: 2, wis: 3, cha: 2,
            ac: 16, naturalArmor: 3, atk: 5, speed: 40,
            lightningDmg: 0, fireDmg: 2,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil", "fire"],
          hpOverride: 30,
        },
        {
          type: "custom",
          name: "Fiendish Hound",
          emoji: "\uD83D\uDC3A",
          stats: {
            str: 7, dex: 6, con: 6, int: 2, wis: 3, cha: 2,
            ac: 16, naturalArmor: 3, atk: 5, speed: 40,
            lightningDmg: 0, fireDmg: 2,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil", "fire"],
          hpOverride: 30,
        },
        {
          type: "custom",
          name: "Summoner Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 6, con: 4, int: 6, wis: 4, cha: 5,
            ac: 16, naturalArmor: 2, atk: 4, speed: 30,
            lightningDmg: 0, fireDmg: 2,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 25,
        },
      ],
      lootChance: 0.45,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "demonic_1_r3",
      name: "The Gate",
      description:
        "At the bottom of the pit, the air itself bleeds. A rift hangs in the chamber's center — not a door but a wound, its edges ragged and weeping heat and light the color of infected blood. Something massive presses against the other side, its silhouette visible through the rift like a shadow behind stained glass. A lieutenant of the pit — a towering fiend of muscle and flame, horns curving from a skull wreathed in balefire — forces its way through, the rift screaming as it widens. It is here, and it is furious.",
      enemies: [
        {
          type: "custom",
          name: "Pit Fiend Lieutenant",
          emoji: "\uD83D\uDC7A",
          stats: {
            str: 11, dex: 6, con: 10, int: 7, wis: 6, cha: 9,
            ac: 20, naturalArmor: 5, atk: 7, speed: 30,
            lightningDmg: 0, fireDmg: 4,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil", "fire", "boss"],
          hpOverride: 65,
        },
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
        {
          type: "custom",
          name: "Lesser Imp",
          emoji: "\uD83D\uDE08",
          stats: {
            str: 3, dex: 7, con: 3, int: 4, wis: 3, cha: 4,
            ac: 15, naturalArmor: 2, atk: 3, speed: 30,
            lightningDmg: 0, fireDmg: 1,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["outsider", "evil"],
          hpOverride: 18,
        },
      ],
      lootChance: 0.75,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Pit Fiend Lieutenant roars as it is pulled back through the rift, its claws leaving gouges in the stone floor. The wound in the air spasms and seals with a sound like tearing meat, leaving behind a scorch mark in the shape of a screaming mouth. The temperature drops. The bleeding stops. Whatever was trying to come through has been denied — for now. The chapel above can be reconsecrated, though nobody will want to pray here for a long time.",
};

const DEMONIC_2: DungeonTemplate = {
  id: "demonic_2",
  name: "Corruption's Heart",
  theme: "demonic",
  minLevel: 6,
  maxLevel: 9,
  rooms: [
    {
      roomId: "demonic_2_r1",
      name: "Tainted Grove",
      description:
        "The forest clearing should be beautiful — ancient oaks, a carpet of moss, shafts of light through the canopy. Instead, the trees are black and weeping sap the color of tar. The moss is spongy with corruption, and the light has a reddish tinge that makes everything look bruised. A shambling mound of rotting vegetation lurches between the trees, and assassin vines hang from branches like nooses, their tendrils twitching with predatory patience. The corruption is spreading. You can feel it in the soil beneath your boots.",
      enemies: [
        { type: "monster", monsterId: "shambling_mound", emoji: "\uD83C\uDF3F", count: 1 },
        { type: "monster", monsterId: "assassin_vine", emoji: "\uD83C\uDF3F", count: 2 },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "demonic_2_r2",
      name: "Blood Pool",
      description:
        "At the center of the tainted grove, the ground slopes into a natural depression filled with liquid that is not water. It's blood — warm, slow-moving, and deep enough to wade in. The surface ripples with movement from below. A corrupted water elemental rises from the pool, its form a churning column of blood and bile, eyes like air bubbles floating in crimson suspension. It smells like a battlefield three days after the fighting stopped.",
      enemies: [
        {
          type: "custom",
          name: "Corrupted Elemental",
          emoji: "\uD83E\uDE78",
          stats: {
            str: 9, dex: 6, con: 9, int: 2, wis: 3, cha: 4,
            ac: 18, naturalArmor: 4, atk: 6, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["elemental", "corrupted"],
          hpOverride: 50,
        },
        {
          type: "custom",
          name: "Blood Tendril",
          emoji: "\uD83E\uDE78",
          stats: {
            str: 5, dex: 5, con: 4, int: 1, wis: 1, cha: 1,
            ac: 14, naturalArmor: 2, atk: 4, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["elemental", "corrupted"],
          hpOverride: 20,
        },
        {
          type: "custom",
          name: "Blood Tendril",
          emoji: "\uD83E\uDE78",
          stats: {
            str: 5, dex: 5, con: 4, int: 1, wis: 1, cha: 1,
            ac: 14, naturalArmor: 2, atk: 4, speed: 20,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["elemental", "corrupted"],
          hpOverride: 20,
        },
      ],
      lootChance: 0.45,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "demonic_2_r3",
      name: "Heart Chamber",
      description:
        "Below the blood pool, a tunnel of pulsing organic matter — it looks like the inside of a body, walls slick and warm and rhythmically contracting — leads to the source. The Heart Chamber is exactly what it sounds like: a cavern dominated by a massive, beating organ of corrupted flesh, threaded with veins of dark energy that extend into the surrounding earth like roots. Before it stands the Corruption Avatar — a towering figure of fused flesh, bone, and shadow, the corruption given will and terrible purpose. It turns to face you with a sound like wet meat tearing from bone.",
      enemies: [
        {
          type: "custom",
          name: "Corruption Avatar",
          emoji: "\uD83D\uDDA4",
          stats: {
            str: 12, dex: 5, con: 11, int: 6, wis: 5, cha: 10,
            ac: 20, naturalArmor: 5, atk: 8, speed: 25,
            lightningDmg: 0, fireDmg: 3,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "corrupted", "boss"],
          hpOverride: 80,
        },
        {
          type: "custom",
          name: "Corruption Spawn",
          emoji: "\uD83E\uDDA0",
          stats: {
            str: 6, dex: 5, con: 5, int: 1, wis: 1, cha: 1,
            ac: 14, naturalArmor: 2, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "corrupted"],
          hpOverride: 22,
        },
        {
          type: "custom",
          name: "Corruption Spawn",
          emoji: "\uD83E\uDDA0",
          stats: {
            str: 6, dex: 5, con: 5, int: 1, wis: 1, cha: 1,
            ac: 14, naturalArmor: 2, atk: 4, speed: 25,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["aberration", "corrupted"],
          hpOverride: 22,
        },
      ],
      lootChance: 0.8,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Corruption Avatar collapses into a heap of dissolving flesh, and the great heart behind it shudders, slows, and stops. The veins of dark energy retract from the earth like a dying tree shedding its roots. The organic tunnel begins to dry and crack, and above, you can imagine the tainted grove already beginning to heal — black sap running clear, dead moss greening. It will take years, but the wound will close. In the remnants of the Avatar you find things it consumed and could not digest: steel, gold, and magic.",
};

// ---------------------------------------------------------------------------
// FOREST theme — spiders, fey, beasts, overgrown ruins (levels 2-6)
// ---------------------------------------------------------------------------

const FOREST_1: DungeonTemplate = {
  id: "forest_1",
  name: "The Webwood Hollow",
  theme: "forest",
  minLevel: 2,
  maxLevel: 5,
  rooms: [
    {
      roomId: "forest_1_r1",
      name: "Overgrown Entrance",
      description:
        "A cleft in the hillside choked with hanging moss and silk strands thick as rope. Broken branches and animal bones litter the threshold. The webs vibrate faintly with each step you take, sending signals deeper into the dark. Something is home, and it knows you are here.",
      enemies: [
        { type: "monster", monsterId: "small_spider", emoji: "\uD83D\uDD77\uFE0F", count: "scale" },
      ],
      lootChance: 0.2,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "forest_1_r2",
      name: "Cocoon Chamber",
      description:
        "The passage widens into a natural cavern carpeted in pale silk. Dozens of cocoons hang from the ceiling, some still twitching. An ettercap crouches in the center, methodically wrapping a deer carcass while spiders the size of dogs patrol the perimeter. The air is thick with the sweet-rot smell of venom-dissolved prey.",
      enemies: [
        { type: "monster", monsterId: "ettercap", emoji: "\uD83D\uDD77\uFE0F", count: 1 },
        { type: "monster", monsterId: "medium_spider", emoji: "\uD83D\uDD77\uFE0F", count: "scale" },
      ],
      lootChance: 0.4,
      lootTier: "minor",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "forest_1_r3",
      name: "The Broodmother's Den",
      description:
        "A vast underground grotto lit by bioluminescent fungi. In its center squats an enormous spider, her abdomen pulsing with egg sacs. Webs connect every surface in a three-dimensional lattice that trembles with the weight of her brood. She raises her forelegs and hisses — a sound like water on hot iron.",
      enemies: [
        {
          type: "custom",
          name: "Broodmother Spider",
          emoji: "\uD83D\uDD77\uFE0F",
          stats: {
            str: 7, dex: 7, con: 6, int: 1, wis: 3, cha: 1,
            ac: 16, naturalArmor: 3, atk: 5, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["vermin", "boss"],
          hpOverride: 36,
        },
        { type: "monster", monsterId: "small_spider", emoji: "\uD83D\uDD77\uFE0F", count: 4 },
      ],
      lootChance: 0.7,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Broodmother curls inward as her legs give way, ichor pooling beneath her massive body. The web network sags and tears, dropping cocoons that split open to reveal only desiccated husks — her victims, not her young. The egg sacs are cold and still. Whatever drove her to nest here, her line ends today. Among the wrapped remains of past adventurers you find gear that still has life in it.",
};

const FOREST_2: DungeonTemplate = {
  id: "forest_2",
  name: "The Green Hag's Grove",
  theme: "forest",
  minLevel: 4,
  maxLevel: 7,
  rooms: [
    {
      roomId: "forest_2_r1",
      name: "Thornwall Gate",
      description:
        "A ring of blackthorn hedge twenty feet high encircles a clearing where no birds sing. The thorns are wrong — too long, too sharp, and some of them are bone. Wolves with matted, bark-like fur pace inside the hedge, their eyes reflecting green light that has no source. They do not growl. They wait.",
      enemies: [
        { type: "monster", monsterId: "dire_wolf", emoji: "\uD83D\uDC3A", count: 2 },
        { type: "monster", monsterId: "wolf", emoji: "\uD83D\uDC3A", count: "scale" },
      ],
      lootChance: 0.2,
      lootTier: "minor",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "forest_2_r2",
      name: "The Rotting Garden",
      description:
        "Past the hedge, a garden grows in defiance of season and sense. Black roses bloom beside white mushrooms the size of chairs. A shambling mound of animated compost patrols the rows, tending the garden with appendages that were once human arms. The vegetables here have teeth.",
      enemies: [
        { type: "monster", monsterId: "shambling_mound", emoji: "\uD83C\uDF3F", count: 1 },
        { type: "monster", monsterId: "assassin_vine", emoji: "\uD83C\uDF3F", count: 2 },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "forest_2_r3",
      name: "The Hag's Cottage",
      description:
        "A cottage that should not exist grows from a living oak, its walls of woven branches, its chimney a hollow trunk belching green smoke. Inside, a green hag stirs a cauldron of something that screams when she pokes it. She looks up with yellow eyes and smiles with a mouth full of iron teeth. 'Company,' she says. 'How thoughtful. I was just running low on ingredients.'",
      enemies: [
        { type: "monster", monsterId: "green_hag", emoji: "\uD83E\uDDD9\u200D\u2640\uFE0F", count: 1 },
        { type: "monster", monsterId: "worg", emoji: "\uD83D\uDC3A", count: 2, nameOverride: "Hag's Worg" },
      ],
      lootChance: 0.8,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The hag shrieks as your final blow connects, her illusions peeling away to reveal the true cottage — a rotting hollow stump full of stolen children's shoes and jars of pickled eyes. Her cauldron cracks and spills, the green fire dying to mundane smoke. The thorns around the grove are already withering, and somewhere beyond them, birds begin to sing again. In her hoard you find things taken from better folk.",
};

// ---------------------------------------------------------------------------
// COASTAL theme — smugglers, pirates, sea creatures (levels 3-7)
// ---------------------------------------------------------------------------

const COASTAL_1: DungeonTemplate = {
  id: "coastal_1",
  name: "The Smuggler's Caves",
  theme: "coastal",
  minLevel: 3,
  maxLevel: 6,
  rooms: [
    {
      roomId: "coastal_1_r1",
      name: "Tidal Entrance",
      description:
        "A sea cave accessible only at low tide, the entrance crusted with barnacles and the floor slick with kelp. Crates stamped with foreign ports are stacked against the walls, their contents half-unloaded. The smugglers left in a hurry — but not all of them left. Figures with drawn cutlasses emerge from behind the cargo, and they do not look interested in negotiation.",
      enemies: [
        { type: "monster", monsterId: "hobgoblin", emoji: "\u2694\uFE0F", count: "scale", nameOverride: "Smuggler" },
      ],
      lootChance: 0.35,
      lootTier: "minor",
      canRest: true,
      isBossRoom: false,
    },
    {
      roomId: "coastal_1_r2",
      name: "Flooded Passage",
      description:
        "The cave descends into knee-deep salt water that surges with each distant wave. Phosphorescent algae paints the walls in shifting blue-green light. Sahuagin — fish-folk with tridents and dead black eyes — rise from the water without a ripple. They were using the smugglers' tunnel long before the smugglers found it.",
      enemies: [
        { type: "monster", monsterId: "sahuagin", emoji: "\uD83D\uDC1F", count: "scale" },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "coastal_1_r3",
      name: "The Captain's Grotto",
      description:
        "A natural cavern converted into a smuggler's throne room. Stolen tapestries hang on the damp walls, a mahogany desk sits on a raised stone platform, and a brass-bound chest overflows with coin. The smuggler captain stands behind the desk with a brace of pistols and a smile that doesn't reach his eyes. His pet crocodile basks in the shallows beside him, one eye open.",
      enemies: [
        {
          type: "custom",
          name: "Captain Blacktide",
          emoji: "\uD83C\uDFF4\u200D\u2620\uFE0F",
          stats: {
            str: 6, dex: 8, con: 5, int: 5, wis: 4, cha: 6,
            ac: 17, naturalArmor: 2, atk: 6, speed: 30,
            lightningDmg: 0, fireDmg: 0,
            ...DEFAULT_BOON_FIELDS,
          },
          subtypes: ["humanoid", "boss"],
          hpOverride: 42,
        },
        { type: "monster", monsterId: "crocodile", emoji: "\uD83D\uDC0A", count: 1 },
        { type: "monster", monsterId: "hobgoblin", emoji: "\u2694\uFE0F", count: 2, nameOverride: "First Mate" },
      ],
      lootChance: 0.85,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "Captain Blacktide falls against his own desk, knocking the brass chest to the floor in a cascade of stolen gold. His crocodile, sensing the shift in power, slides into the water and vanishes into a flooded tunnel. The surviving crew throw down their weapons. The cave is yours — and with it, the captain's ledger documenting every bribed harbormaster and corrupt customs official on the Iron Coast.",
};

const COASTAL_2: DungeonTemplate = {
  id: "coastal_2",
  name: "The Drowned Temple",
  theme: "coastal",
  minLevel: 5,
  maxLevel: 8,
  rooms: [
    {
      roomId: "coastal_2_r1",
      name: "Sunken Narthex",
      description:
        "Stone steps descend into a flooded temple half-swallowed by the sea. Saltwater laps at carved pillars depicting storm gods whose names were old when Kardov's Gate was mud huts. The ceiling drips with mineral deposits like frozen rain. In the murky water, shapes circle — too large for fish, too deliberate for debris.",
      enemies: [
        { type: "monster", monsterId: "sahuagin", emoji: "\uD83D\uDC1F", count: "scale", nameOverride: "Temple Guard" },
        { type: "monster", monsterId: "giant_constrictor", emoji: "\uD83D\uDC0D", count: 1, nameOverride: "Sea Serpent" },
      ],
      lootChance: 0.3,
      lootTier: "minor",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "coastal_2_r2",
      name: "Hall of Tides",
      description:
        "A vast hall where the tide rushes in through broken walls on a schedule older than memory. The floor is a mosaic depicting a kraken embracing the world, its tiles worn smooth by centuries of salt water. Giant scorpions have nested in the dry alcoves, their carapaces encrusted with coral. They click and hiss as the water rises around their legs.",
      enemies: [
        { type: "monster", monsterId: "monstrous_scorpion_lg", emoji: "\uD83E\uDD82", count: 2, nameOverride: "Reef Scorpion" },
        { type: "monster", monsterId: "sahuagin", emoji: "\uD83D\uDC1F", count: 3, nameOverride: "Sahuagin Raider" },
      ],
      lootChance: 0.4,
      lootTier: "moderate",
      canRest: false,
      isBossRoom: false,
    },
    {
      roomId: "coastal_2_r3",
      name: "The Storm Altar",
      description:
        "The innermost sanctum is impossibly dry despite being below the waterline. A wall of force holds the ocean at bay on three sides, revealing the seafloor and the dark water beyond like windows into the abyss. On a basalt altar, a hydra coils — five heads swaying independently, each watching a different approach. Lightning plays across the ceiling in arcs that smell of ozone and old magic. This thing was put here to guard something. It has not moved from this spot in a hundred years, and it is very, very hungry.",
      enemies: [
        { type: "monster", monsterId: "hydra_5head", emoji: "\uD83D\uDC32", count: 1, nameOverride: "Storm Hydra", hpBoost: 10 },
      ],
      lootChance: 0.9,
      lootTier: "major",
      canRest: false,
      isBossRoom: true,
    },
  ],
  completionText:
    "The Storm Hydra's last head hits the altar with a crack that splits the basalt. The wall of force flickers — for one heart-stopping moment the ocean presses inward — then stabilizes, holding. Whatever ancient magic powers it will outlast you all. On the altar, beneath the hydra's coils, you find the thing it was guarding: a reliquary of storm-blackened silver, its contents still humming with divine charge after centuries underwater.",
};

// ---------------------------------------------------------------------------
// Master Template Array
// ---------------------------------------------------------------------------

export const DUNGEON_TEMPLATES: DungeonTemplate[] = [
  // Crypt (3)
  CRYPT_1,
  CRYPT_2,
  CRYPT_3,
  // Sewer (2)
  SEWER_1,
  SEWER_2,
  // Cave (2)
  CAVE_1,
  CAVE_2,
  // Tower (2)
  TOWER_1,
  TOWER_2,
  // Dwarven (2)
  DWARVEN_1,
  DWARVEN_2,
  // Demonic (2)
  DEMONIC_1,
  DEMONIC_2,
  // Forest (2)
  FOREST_1,
  FOREST_2,
  // Coastal (2)
  COASTAL_1,
  COASTAL_2,
];
