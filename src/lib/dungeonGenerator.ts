// ============================================================
// dungeonGenerator.ts — Procedural Dungeon Generation System
// Generates grid-based multi-room dungeons with branching paths,
// puzzles, traps, loot, and bosses. Deterministic from seed.
// ============================================================

// ── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────
// Deterministic: same seed always produces the same dungeon.

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RNG = () => number;

function rngInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function rngPick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rngShuffle<T>(rng: RNG, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rngChance(rng: RNG, probability: number): boolean {
  return rng() < probability;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type Direction = "north" | "south" | "east" | "west";

export type RoomType =
  | "empty"
  | "combat"
  | "boss"
  | "treasure"
  | "puzzle"
  | "trap"
  | "shop"
  | "shrine"
  | "library"
  | "armory"
  | "prison"
  | "flooded"
  | "collapsed"
  | "garden"
  | "portal";

export type DungeonTheme =
  | "crypt"
  | "mine"
  | "sewer"
  | "temple"
  | "fortress"
  | "fungal"
  | "ice"
  | "volcanic";

export type DungeonSize = "small" | "medium" | "large";

export type PuzzleType =
  | "lever_sequence"
  | "pressure_plates"
  | "symbol_matching"
  | "riddle"
  | "lock_picking"
  | "color_mixing"
  | "math_puzzle"
  | "memory"
  | "chess_puzzle"
  | "musical";

export type TrapType =
  | "pit_trap"
  | "arrow_trap"
  | "poison_gas"
  | "crushing_walls"
  | "fire_jets"
  | "ice_floor"
  | "alarm"
  | "curse_glyph";

export type LootRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type EnemyDifficulty = "minion" | "standard" | "elite" | "boss";

export interface Enemy {
  name: string;
  difficulty: EnemyDifficulty;
  hp: number;
  ac: number;
  attack: number;
  damage: string;
  special?: string;
  subtypes: string[];
}

export interface Item {
  name: string;
  rarity: LootRarity;
  category: "weapon" | "armor" | "potion" | "scroll" | "gem" | "gold" | "reagent" | "key";
  value: number; // gp
  description: string;
  effect?: string;
}

export interface Trap {
  type: TrapType;
  dc: number; // difficulty class to detect/disarm
  damage: string;
  effect: string;
  disarmStat: "DEX" | "INT" | "WIS" | "STR";
  description: string;
}

export interface Puzzle {
  type: PuzzleType;
  dc: number;
  description: string;
  hint: string;
  solution: string;
  rewardDescription: string;
  checkStat: "INT" | "WIS" | "DEX" | "CHA";
}

export interface DungeonRoom {
  id: number;
  type: RoomType;
  connections: { north?: number; south?: number; east?: number; west?: number };
  enemies?: Enemy[];
  loot?: Item[];
  trap?: Trap;
  puzzle?: Puzzle;
  description: string;
  isRevealed: boolean;
  isCleared: boolean;
  gridX: number;
  gridY: number;
  depth: number; // distance from entrance on critical path
}

export interface Dungeon {
  seed: number;
  theme: DungeonTheme;
  size: DungeonSize;
  playerLevel: number;
  rooms: DungeonRoom[];
  entranceId: number;
  bossRoomId: number;
  treasureRoomIds: number[];
  puzzleRoomIds: number[];
  criticalPath: number[]; // room IDs from entrance to boss
  name: string;
  flavorIntro: string;
}

// ── Size Config ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<DungeonSize, { min: number; max: number }> = {
  small: { min: 5, max: 8 },
  medium: { min: 10, max: 15 },
  large: { min: 20, max: 30 },
};

// ── Dungeon Name Generation ──────────────────────────────────────────────────

const THEME_NAME_PARTS: Record<DungeonTheme, { prefixes: string[]; suffixes: string[] }> = {
  crypt: {
    prefixes: ["Forgotten", "Whispering", "Bone", "Midnight", "Silent", "Cursed", "Hollow"],
    suffixes: ["Crypt", "Tomb", "Sepulchre", "Barrow", "Ossuary", "Catacomb", "Mausoleum"],
  },
  mine: {
    prefixes: ["Deep", "Iron", "Collapsed", "Echoing", "Sunken", "Black", "Ore-Veined"],
    suffixes: ["Mine", "Shaft", "Delve", "Dig", "Tunnel", "Quarry", "Excavation"],
  },
  sewer: {
    prefixes: ["Festering", "Dripping", "Rat-Gnawed", "Flooded", "Foul", "Forgotten", "Hidden"],
    suffixes: ["Sewer", "Undercity", "Drain", "Cistern", "Canal", "Aqueduct", "Depths"],
  },
  temple: {
    prefixes: ["Desecrated", "Fallen", "Radiant", "Shadowed", "Ancient", "Profane", "Sacred"],
    suffixes: ["Temple", "Sanctuary", "Fane", "Shrine", "Cathedral", "Basilica", "Chapel"],
  },
  fortress: {
    prefixes: ["Iron", "Broken", "Last", "Black", "Storm", "War-Scarred", "Siege"],
    suffixes: ["Fortress", "Citadel", "Bastion", "Keep", "Stronghold", "Garrison", "Redoubt"],
  },
  fungal: {
    prefixes: ["Spore-Choked", "Luminous", "Rotting", "Mycelial", "Pulsing", "Blooming", "Toxic"],
    suffixes: ["Cavern", "Grotto", "Warren", "Colony", "Garden", "Depths", "Hollow"],
  },
  ice: {
    prefixes: ["Frozen", "Glacial", "Bitter", "Crystal", "Howling", "Frost-Bitten", "Pale"],
    suffixes: ["Cave", "Cavern", "Rift", "Chasm", "Vault", "Passage", "Abyss"],
  },
  volcanic: {
    prefixes: ["Burning", "Molten", "Scorched", "Ashen", "Magma", "Ember", "Slag"],
    suffixes: ["Pit", "Forge", "Caldera", "Vent", "Furnace", "Crucible", "Hearth"],
  },
};

function generateDungeonName(rng: RNG, theme: DungeonTheme): string {
  const parts = THEME_NAME_PARTS[theme];
  const prefix = rngPick(rng, parts.prefixes);
  const suffix = rngPick(rng, parts.suffixes);
  return `The ${prefix} ${suffix}`;
}

// ── Flavor Intro Generation ──────────────────────────────────────────────────

const THEME_INTROS: Record<DungeonTheme, string[]> = {
  crypt: [
    "The air turns cold and stale as you descend stone steps worn smooth by centuries of funeral processions. Torchlight catches the glint of bone and tarnished gold in the walls ahead.",
    "A rusted iron gate groans open, releasing the scent of embalming spice and ancient dust. The dead were meant to rest here. They did not.",
    "Tombstones lean at drunken angles above the entrance, their inscriptions worn to nothing. Below, the darkness breathes.",
  ],
  mine: [
    "Timber beams creak overhead as you enter the abandoned shaft. Pick marks score the walls, and the floor is littered with rusted tools and broken cart wheels. Something drove the miners out.",
    "The mine entrance is half-collapsed, shored up with desperate carpentry. Ore veins glitter in your torchlight, untouched for years. The silence is wrong.",
    "A caged canary skeleton hangs by the entrance. The air smells of damp rock and something metallic that is not ore.",
  ],
  sewer: [
    "The grate lifts with a screech of corroded metal. Below, black water flows in a channel carved before the city above existed. The stench is indescribable.",
    "You drop into ankle-deep filth that was once rainwater. The tunnel stretches in both directions, lit by phosphorescent slime. Something squeaks in the distance.",
    "The sewer entrance is hidden behind a butcher's shop. The passage beyond was not built by the city — it is far older, and far deeper.",
  ],
  temple: [
    "Stained glass crunches underfoot as you push through the shattered doors. The nave stretches ahead, pews overturned, altar defiled. The air hums with residual divine energy — or its absence.",
    "Prayer flags hang in tatters from pillars that still bear the scars of holy fire. Whatever was worshipped here left, but its guardians remained.",
    "The temple steps are slick with something that looks like blood but smells like lightning. The doors stand open, an invitation from something that should not be inviting.",
  ],
  fortress: [
    "The portcullis is jammed halfway, forcing you to duck beneath its iron teeth. Beyond, a military precision pervades — murder holes, arrow slits, killing corridors. This place was built to end lives efficiently.",
    "Siege damage scarred the outer walls decades ago. Inside, the garrison's last stand is preserved in dust and scattered equipment. Something else holds the fortress now.",
    "A war banner still flies from the gate tower, its colors unidentifiable beneath years of grime. The fortress was never officially abandoned. The reports just stopped.",
  ],
  fungal: [
    "The cave mouth exhales a warm, humid breath that tastes of rot and earth. Inside, bioluminescent fungi paint the walls in sick greens and blues. The ground is spongy with mycelium.",
    "Mushroom caps the size of wagon wheels crowd the entrance, their undersides dripping with luminous spores. The air is thick enough to chew.",
    "A carpet of white mycelium covers every surface, pulsing with slow rhythms. The cave is alive, and it knows you are here.",
  ],
  ice: [
    "Your breath crystallizes instantly as you enter the fissure. The walls are glass-smooth ice, ancient and blue, and the cold is a physical force pressing against your chest.",
    "Icicles hang from the ceiling like the teeth of some vast mouth. The floor is treacherous glass, and your torchlight refracts through the ice in blinding rainbows.",
    "The cave entrance is ringed with frost that never melts, even in summer. Inside, the temperature drops with every step. Something keeps this place cold deliberately.",
  ],
  volcanic: [
    "Heat hits you like a wall. The passage glows with a dull red light from below, and the stone underfoot is warm enough to feel through boot leather. The air smells of sulfur and molten metal.",
    "Rivers of lava flow in channels carved by forces older than the mountain. The ceiling drips with condensation that hisses on the hot stone. This place should not be survivable.",
    "Ash drifts like snow from vents in the ceiling. The walls pulse with veins of magma, and the air shimmers with heat. Fire elementals are common here — you can feel their attention.",
  ],
};

// ── Room Description Generation ──────────────────────────────────────────────

const ROOM_DESCRIPTIONS: Record<RoomType, Record<DungeonTheme, string[]>> = {
  empty: {
    crypt: [
      "A narrow alcove between larger chambers. Stone shelves hold candle stubs and offerings of tarnished coin, left by mourners who will never return.",
      "A small antechamber with crumbling frescoes depicting funeral rites. The paint flakes at your touch.",
    ],
    mine: [
      "A widening in the tunnel where miners once took their meals. Tin cups and broken clay pipes litter a rough-hewn bench.",
      "A natural cavity in the rock, dry and relatively clean. Tool marks on the walls suggest it was used as a staging area.",
    ],
    sewer: [
      "A maintenance alcove with rusted iron rungs leading to a sealed hatch above. Someone scratched tally marks into the wall — hundreds of them.",
      "A dry ledge above the waterline where workers once rested. Graffiti in a dozen languages covers the walls.",
    ],
    temple: [
      "A meditation cell with a stone bench and a niche for a candle. The walls are covered in faded prayers written in a desperate hand.",
      "A vestry where priests once robed for services. Empty hooks line the walls, and a cracked mirror reflects your torchlight.",
    ],
    fortress: [
      "A guard post with a wooden chair, a small table, and a cold brazier. Duty rosters pinned to the wall are decades out of date.",
      "A narrow corridor between fortified positions. Arrow loops on both sides let in thin blades of light.",
    ],
    fungal: [
      "A small pocket in the cave system where the fungal growth is sparse. The air is slightly cleaner here, and the mycelium carpet is thin enough to see stone beneath.",
      "A natural shelf of rock above the main cavern floor. The mushrooms here are small and dark, emitting no light.",
    ],
    ice: [
      "A hollow in the ice wall where wind does not reach. The temperature is merely freezing rather than lethal. Frost patterns on the walls form shapes almost like writing.",
      "A small chamber where the ice is milky white rather than clear. It feels fractionally warmer, and the floor is rough enough for sure footing.",
    ],
    volcanic: [
      "A ledge of cooled obsidian away from the lava flows. The heat is manageable here, and the rock is solid enough to rest on without burning.",
      "A natural chimney draws the worst of the sulfur fumes upward. The air is still hot but breathable.",
    ],
  },
  combat: {
    crypt: [
      "A burial chamber where the dead walk among their own coffins. Bones rattle against stone as skeletal forms turn toward the sound of living footsteps.",
      "A columbarium of shattered urns. Ash and bone fragments crunch underfoot, and the shadows between the niches move with purpose.",
    ],
    mine: [
      "A worked-out ore chamber now serving as a lair. Crude fortifications of overturned carts and stacked rubble block the far passage.",
      "A junction where three tunnels meet. The creatures here guard the intersection with territorial fury.",
    ],
    sewer: [
      "A cistern chamber where the water runs deeper and darker. Shapes move beneath the surface, and others crouch on the ledges above.",
      "A collapsed section where raw earth and sewage have mixed into a fetid swamp. Things live in the muck that should not exist.",
    ],
    temple: [
      "The nave of the temple, where pews have been arranged into barricades. The stained glass casts colored shadows over the creatures that now worship here.",
      "A chapel dedicated to a specific saint, their statue defaced and repurposed as a throne for something with too many limbs.",
    ],
    fortress: [
      "A barracks room with overturned bunks and scattered weapons. The current occupants have made it their own, and they react to intrusion like soldiers.",
      "A killing corridor lined with arrow slits. Enemies hold both ends, and there is no cover in between.",
    ],
    fungal: [
      "A cavern where the mushrooms grow tall and close, forming a claustrophobic forest. Things move between the stalks — things that look like mushrooms until they turn to face you.",
      "A chamber dominated by a massive fungal growth that pulses with bioluminescence. Spore clouds erupt as creatures stir beneath its canopy.",
    ],
    ice: [
      "A frozen lake within the cave, its surface smooth as glass. Things are trapped in the ice beneath — some of them still moving. Others patrol the surface with predatory grace.",
      "An ice-walled chamber where the ceiling weeps icicles like daggers. Frost-crusted creatures emerge from hollows in the walls.",
    ],
    volcanic: [
      "A chamber bisected by a river of lava. Stone bridges span the flow, and fire-resistant creatures patrol them with the confidence of beings immune to the heat that is killing you.",
      "A slag-floored cavern where pools of molten rock bubble and spit. The creatures here were born in fire and do not fear it.",
    ],
  },
  boss: {
    crypt: [
      "The central burial vault — a grand chamber with a vaulted ceiling and a massive sarcophagus on a raised dais. The lid is pushed aside. The occupant stands before you, ancient and terrible, power radiating like cold.",
      "A throne room of the dead. Bone columns support a ceiling lost in shadow. The lord of this domain awaits on a throne of fused skulls, patient as only the dead can be.",
    ],
    mine: [
      "The deepest chamber of the mine, where the richest ore vein gleams untouched. A massive creature has made its lair here, attracted by the mineral wealth or the darkness.",
      "An ancient dwarven forge chamber, its bellows still operational. The thing that claimed this place regards you from behind the anvil with the confidence of absolute territorial dominance.",
    ],
    sewer: [
      "A vast underground cistern, the ceiling lost in darkness above. In the center, on a mound of refuse and bones, something massive and patient has built its domain.",
      "The convergence of every sewer tunnel — a whirlpool chamber where all the city's filth collects. The lord of the undercity awaits in the eye of the maelstrom.",
    ],
    temple: [
      "The inner sanctum, where the altar still radiates power — corrupted or divine. Before it, the temple's true guardian manifests, drawing on centuries of accumulated faith or hatred.",
      "A domed chamber beneath the main temple, hidden from the faithful above. This is where the real worship happened, and what answered those prayers still lingers.",
    ],
    fortress: [
      "The command chamber at the fortress's heart. Maps cover every wall, war trophies hang from the ceiling, and the warlord who holds this place rises from the commander's chair with the slow confidence of one who has never been defeated in their own stronghold.",
      "The throne room of the fortress lord. Battle standards line the approach, and the stone floor is worn by generations of boots marching to receive orders.",
    ],
    fungal: [
      "The heart of the fungal colony — a vast cavern where a single enormous mushroom dominates like a tree. Its cap glows with hypnotic patterns, and at its base, the colony's intelligence manifests in physical form.",
      "A chamber where the mycelium network converges into a dense mass of neural tissue. The fungal overmind regards you through a hundred spore-eye clusters.",
    ],
    ice: [
      "A cathedral of ice — a natural vault of crystalline blue, ancient beyond reckoning. At its center, something is frozen in the thickest ice, and it is waking up. The frost around it cracks and reforms in patterns that are almost words.",
      "The glacier's heart, where the cold is not merely temperature but malevolence given form. The lord of this frozen domain steps from the wall of ice as if it were a curtain.",
    ],
    volcanic: [
      "The magma chamber itself — a cavern of liquid fire where islands of rock float on molten currents. On the largest island, wreathed in flame and fury, the lord of this inferno awaits with the patience of things that burn forever.",
      "A volcanic vent that descends into the world's furnace. The heat is lethal to anything not shielded by magic or born in fire. The thing that rules here is both.",
    ],
  },
  treasure: {
    crypt: [
      "A sealed vault of grave goods — gold, gems, and artifacts meant to follow the dead into the afterlife. The air is perfectly dry and still, preserving everything in timeless suspension.",
      "A hidden alcove behind a false wall. Inside, funeral offerings of staggering value are arranged with ritual precision on stone shelves.",
    ],
    mine: [
      "A vein of pure ore — gold, mithral, or something that defies identification — running through the chamber wall. Tools and sacks suggest someone was mining it in secret.",
      "A locked storage room where the mine's assay office kept samples and processed ingots. The door was sealed from outside.",
    ],
    sewer: [
      "A dry cache above the waterline, hidden behind a mortared wall. Someone bricked up their wealth and never came back for it. The mortar is centuries old.",
      "A smuggler's stash concealed in the sewer infrastructure. Waterproof cases hold goods that never passed through customs.",
    ],
    temple: [
      "The temple treasury — a room of gilded icons, jeweled reliquaries, and ritual implements of precious metal. The divine protections have faded, but the mundane locks held.",
      "A reliquary chamber where sacred objects were stored. Some still hum with residual power.",
    ],
    fortress: [
      "The garrison's payroll vault — a reinforced room of iron-banded chests. The soldiers who earned this coin never collected their last pay.",
      "A war trophy room. Captured banners, weapons of defeated champions, and tribute from conquered peoples fill the shelves.",
    ],
    fungal: [
      "A crystal-lined geode within the cave system, untouched by fungal growth. Mineral deposits of extraordinary purity coat every surface.",
      "A cache of alchemical ingredients — rare fungi, crystal formations, and bioluminescent samples — left by a researcher who documented everything meticulously.",
    ],
    ice: [
      "A frozen vault where treasure is preserved in ice. Gold coins, frozen solid, can be chipped free. Gems glitter in the ice like stars in a blue sky.",
      "A mammoth's graveyard — ivory tusks and bone as long as a man, worth a fortune to the right buyer. Frozen pelts of extinct beasts drape over the remains.",
    ],
    volcanic: [
      "A chamber of obsidian and gold — the volcanic heat has smelted raw ore into pools of cooled precious metal. Gems formed under pressure stud the walls like eyes.",
      "A dragon's hoard (dragon long gone, or is it?). Coins melted into slag piles, weapons warped by heat, but gems survive fire and here they are by the thousands.",
    ],
  },
  puzzle: {
    crypt: [
      "A sealed door covered in funerary inscriptions and rotating stone discs. The dead protected their secrets well — only the worthy may pass.",
      "A chamber of stone coffins arranged in a pattern. Symbols on their lids correspond to engravings on the walls. The correct sequence opens the way forward.",
    ],
    mine: [
      "A junction sealed by a dwarven mechanism — interlocking gears and counterweights that require a specific sequence to engage. The engineering is brilliant even in decay.",
      "A mine cart switching station with multiple levers and track plates. Only one combination leads to the correct destination.",
    ],
    sewer: [
      "A water gate controlled by a series of valves and flow regulators. The correct water levels open hidden passages.",
      "A mosaic floor depicting the city above. Stepping on the correct path of tiles opens the way; the wrong path floods the room.",
    ],
    temple: [
      "A ritual chamber where prayer wheels must be turned in the correct order. The walls depict the holy sequence, but corruption has obscured some symbols.",
      "An altar that requires offerings placed in the correct positions. Stone bowls ring the chamber, each marked with a different divine symbol.",
    ],
    fortress: [
      "A security checkpoint with a combination lock of military complexity. The mechanism involves rotating cylinders and pressure plates.",
      "A war room where tactical pieces must be arranged on a map table in the correct formation. The door responds to strategy, not strength.",
    ],
    fungal: [
      "A chamber where different-colored mushrooms emit spores when touched. The correct sequence produces a chemical reaction that clears the blocked passage.",
      "A mycelium network that responds to vibration. Striking the fungal columns in the right order creates a resonance that parts the living wall ahead.",
    ],
    ice: [
      "An ice puzzle — sliding blocks of frozen material that must be arranged in a pattern. The blocks are heavy and the floor is slick.",
      "Frozen runes on the walls that must be thawed in the correct order. Torchlight melts them, but they refreeze quickly.",
    ],
    volcanic: [
      "Lava channels that must be redirected using stone plugs and valves. The correct flow pattern cools a section of floor enough to cross.",
      "Pressure plates on stone islands in a lava lake. The correct stepping pattern raises a bridge of cooled obsidian.",
    ],
  },
  trap: {
    crypt: [
      "The floor tiles bear a warning pattern worn nearly invisible by time. The ancient builders protected their dead with mechanical fury.",
      "A passage narrowing between carved stone faces with open mouths. The engineering behind those mouths is not decorative.",
    ],
    mine: [
      "A section of tunnel where the shoring timbers are rigged — pressure triggers at the base, and the ceiling above is loose rubble held by nothing but prayer.",
      "A stretch of mine floor that sounds hollow underfoot. The shaft below is deeper than your torchlight reaches.",
    ],
    sewer: [
      "A section of tunnel where the water is suspiciously still and a chemical smell hangs in the air. The walls have recent scratch marks at head height.",
      "A narrowing in the tunnel where trip wires span the passage at ankle height. What they trigger is hidden in the ceiling.",
    ],
    temple: [
      "A corridor lined with saint statues whose hands are positioned as if holding something. The empty hands are not decorative — they are trigger mechanisms.",
      "A prayer hall where the floor tiles are inscribed with scripture. The incorrect path is punished with divine mechanical certainty.",
    ],
    fortress: [
      "A corridor designed as a kill zone — arrow slits on both sides, murder holes above, and the floor is a pressure plate.",
      "A doorway rigged with military-grade traps. The garrison protected their inner chambers with lethal engineering.",
    ],
    fungal: [
      "A patch of floor where the mushrooms grow in an unusual pattern — a perfect ring. The spores here are different. Thicker. More pungent.",
      "A section of cave where dangling fungal tendrils brush against anything that passes. They are not merely fungus.",
    ],
    ice: [
      "A section of floor that is smoother than the rest — polished to a mirror finish. One wrong step and gravity becomes your enemy.",
      "Icicles above that are too regular, too sharp, and positioned too perfectly above the narrowest part of the passage.",
    ],
    volcanic: [
      "A section of floor with hairline cracks from which heat radiates. The rock here is thin — beneath it, magma waits.",
      "Vents in the walls at regular intervals. The chemical smell suggests the gas is not merely volcanic.",
    ],
  },
  shop: {
    crypt: [
      "A ghoul merchant crouches in an alcove, surprisingly articulate, selling trinkets scavenged from the dead. It accepts coin — no questions about why you are here.",
      "A spectral shopkeeper materializes behind a counter of ectoplasm, offering goods from across the veil between life and death.",
    ],
    mine: [
      "A prospector who got lost years ago has set up shop at a junction, trading supplies to anyone passing through — living or otherwise.",
      "A kobold merchant (remarkably friendly for a kobold) has established a trading post in a side chamber, protected by a neutrality pact with local creatures.",
    ],
    sewer: [
      "A ratfolk trader sits behind a counter of stacked bricks, offering black-market goods in exchange for coin or information.",
      "A surprisingly clean alcove where a hooded figure sells supplies at premium prices. No names. Cash only. No refunds.",
    ],
    temple: [
      "A penitent monk maintains a small shrine here, selling blessed water, bandages, and prayer scrolls. They ask no questions about your purpose.",
      "An angelic merchant — or something pretending to be one — offers divine goods at prices that seem almost fair.",
    ],
    fortress: [
      "A deserter has set up shop in a storage room, selling military supplies liberated from the fortress armory. They want coin, not conversation.",
      "A mercenary quartermaster maintains a neutral trading post, selling to any side of whatever conflict once raged here.",
    ],
    fungal: [
      "A myconid trader communicates through spore clouds that carry meaning directly into your mind. Its wares include rare alchemical fungi and cave-crystal tools.",
      "A deep gnome herbalist has established a collection station here, trading processed fungal remedies and cave supplies.",
    ],
    ice: [
      "A frost-touched dwarf maintains a trading post in a heated alcove, selling cold-weather supplies and warmth enchantments at reasonable prices.",
      "An ice mephit entrepreneur (yes, really) trades crystalline goods and thermal potions. It drives a hard bargain.",
    ],
    volcanic: [
      "A salamander smith works a natural forge, crafting fire-resistant equipment and selling flame-ward potions to travelers.",
      "An azer merchant — an outsider of bronze and living flame — trades in fire opals, obsidian tools, and heat-shielding charms.",
    ],
  },
  shrine: {
    crypt: [
      "A small chapel dedicated to the god of death — proper death, the kind that stays permanent. The altar radiates a sense of finality. An offering might be answered.",
      "A mourning shrine where candles burn eternally without heat. Prayers whispered here have weight.",
    ],
    mine: [
      "A dwarven prayer alcove carved into the living rock. The runes invoke protection from cave-ins and wandering terrors. They still hold power.",
      "A miner's shrine to the earth spirits — rough-carved and sincere. Offerings of ore sit in the niche, and the air feels more stable here.",
    ],
    sewer: [
      "A hidden shrine to a forgotten water deity, maintained by hands you never see. Fresh flowers sit in the niche despite the surroundings.",
      "A carved symbol of protection glows faintly on the wall — someone with divine talent blessed this spot, and the blessing holds.",
    ],
    temple: [
      "A side chapel where the original deity's power still lingers despite the desecration elsewhere. The air is cleaner here, the shadows thinner.",
      "A hidden alcove behind a false wall where the true faithful hid their most sacred relic. Its power still hums.",
    ],
    fortress: [
      "A military chapel where soldiers prayed before battle. War-god symbols line the walls, and the air tastes of iron and oaths.",
      "A memorial wall listing names of the fallen. The stone radiates somber power — remembrance given form.",
    ],
    fungal: [
      "A circle of bioluminescent mushrooms that pulses in sync with your heartbeat. The pattern is deliberate, and the energy here is ancient.",
      "A natural formation where crystal meets fungus in a spiral pattern. The mycelium here glows differently — warm gold instead of cold blue.",
    ],
    ice: [
      "An ice formation shaped impossibly like a praying figure. The cold here is not hostile — it is contemplative. Offerings placed at its base freeze solid instantly.",
      "A chamber where the ice forms a perfect dome, and the acoustic properties turn any whisper into a chorus. Words spoken here carry weight.",
    ],
    volcanic: [
      "A basalt altar where the fire burns clean and white instead of red. The heat here is a comfort, not a threat. Something benevolent watches from the flames.",
      "A natural formation of volcanic glass shaped like an open hand. Heat radiates from the palm like a blessing.",
    ],
  },
  library: {
    crypt: [
      "A scriptorium where funerary records were kept — shelves of crumbling scrolls documenting every burial for centuries. Some entries are annotated with disturbing addenda about bodies that moved after interment.",
      "An archive of necromantic texts, carefully sealed in lead-lined cases. The knowledge here is dangerous but valuable.",
    ],
    mine: [
      "A surveyor's office with geological maps, ore assay records, and engineering blueprints. One set of plans shows chambers deeper than any known shaft.",
      "A foreman's library of mining manuals, geological surveys, and personal journals. The last entries describe sounds from below that no natural formation should produce.",
    ],
    sewer: [
      "A hidden archive belonging to the city's secret police — dossiers, maps of the undercity, and records of disappeared citizens. Some files are marked 'STILL ACTIVE.'",
      "A smuggler's log room with shipping manifests, tide charts, and coded messages. Cracking the code could reveal fortunes — or enemies.",
    ],
    temple: [
      "The temple library — illuminated manuscripts, prayer books, and theological treatises. Some texts are chained to their shelves. Others should be.",
      "A restricted section sealed behind silver-inlaid doors. The books here move on their own, rearranging themselves according to a logic that is not human.",
    ],
    fortress: [
      "A war room library of tactical manuals, siege engineering texts, and battle histories. Maps on the walls show campaigns planned but never fought.",
      "An intelligence archive with cipher keys, spy reports, and enemy assessments. The information is decades old but some of it is still relevant.",
    ],
    fungal: [
      "A research station where a mycologist lived and worked — notes, samples in crystal jars, and sketches of fungal species never catalogued. The researcher is gone. The notes remain.",
      "Flat fungal shelves growing from the walls hold preserved records — stone tablets, treated bark scrolls, and crystallized spore-memories that convey information when inhaled.",
    ],
    ice: [
      "A frozen library — scrolls and books preserved perfectly in ice for millennia. Thawing them carefully reveals knowledge from civilizations that predate recorded history.",
      "Runes carved directly into the ice walls in a spiral pattern. Reading them from beginning to end takes hours, but the knowledge they contain is otherwise lost to the world.",
    ],
    volcanic: [
      "A chamber lined with ceramic tiles inscribed with text — the heat has fired them into permanence. A pyromaniac scholar's fire-proof archive.",
      "Records carved into obsidian tablets, impervious to the heat. Volcanic glass preserves information perfectly — if you can read by lava-light.",
    ],
  },
  armory: {
    crypt: [
      "A burial chamber specifically for weapons — swords, maces, and armor interred with warrior-dead. Some pieces still gleam with enchantment. Others carry curses as old as their owners' grudges.",
      "A necromancer's preparation room where weapons were treated with necrotic energies. The blades here hunger for life.",
    ],
    mine: [
      "A dwarven weapons cache sealed behind a stone door. The arsenal is dusty but perfectly maintained by enchantments that outlasted their makers.",
      "A guard station where mining security stored their weapons. Heavy picks, reinforced helmets, and shields designed for tight tunnels.",
    ],
    sewer: [
      "A thief guild's hidden armory — poisoned blades, caltrops, smoke bombs, and assassin's tools. Everything here is designed for quiet killing.",
      "A cache of confiscated weapons from the city watch — everything from crude shivs to masterwork swords, stored and forgotten.",
    ],
    temple: [
      "A knight's preparation chamber where holy warriors armed themselves before descending into the undercrypt. Sacred weapons still hang on the walls, waiting for worthy hands.",
      "A cursed armory where weapons of fallen paladins are stored — each one carries the weight of a broken oath.",
    ],
    fortress: [
      "The main armory — racks of weapons in military order, armor on stands, and ammunition crates stacked to the ceiling. Most has been looted, but the hidden reserve compartment was never found.",
      "An elite guard's private weapons locker. Masterwork steel, enchanted ammunition, and armor fitted to specifications that suggest the wearer was not entirely human.",
    ],
    fungal: [
      "Weapons grown rather than forged — fungal-chitin blades, spore-sac grenades, and armor of hardened mushroom cap. Surprisingly effective.",
      "An adventurer's cache hidden in the cave system — weapons and armor sealed in oilcloth against the moisture. Whoever left these planned to return.",
    ],
    ice: [
      "An ancient armory where weapons are frozen in the walls — pulling them free requires breaking ice that has been forming for centuries. The steel beneath is perfect.",
      "Weapons of ice that never melt — forged by some arcane process. They burn cold to the touch and trail frost in the air.",
    ],
    volcanic: [
      "A forge-armory where weapons were quenched in magma. The surviving pieces are extraordinary — fire-hardened steel with properties no surface smith can replicate.",
      "An obsidian weapons cache — volcanic glass blades sharper than steel, brittle but devastating. Shields of slag-metal radiate residual heat.",
    ],
  },
  prison: {
    crypt: [
      "A row of sealed alcoves — not for the dead, but for those buried alive. Scratch marks on the inside of the stone slabs tell their own story. One alcove sounds occupied.",
      "An oubliette beneath the crypt floor. Something down there calls for help in a voice that might be human.",
    ],
    mine: [
      "A punishment cell where troublesome miners were locked away. The door is iron and the room is stone. The chains on the wall are occupied.",
      "A collapsed side tunnel sealed from outside. Behind the rubble, something paces back and forth with heavy, deliberate steps.",
    ],
    sewer: [
      "An illegal holding cell beneath the city — no records, no oversight. The occupant has been here long enough to forget their own name, but not long enough to die.",
      "A cage of corroded iron hanging over the water. Its occupant is either a prisoner or bait. Possibly both.",
    ],
    temple: [
      "A penitent's cell where heretics were confined for meditation. One cell is still occupied — the penitent within claims to have seen the truth, but their eyes are wrong.",
      "A binding chamber where evil was contained through faith. The binding circles are cracked. The containment is failing.",
    ],
    fortress: [
      "The dungeon proper — iron cells lining a corridor lit by a single guttering torch. Most cells are empty. Most.",
      "A prisoner-of-war holding area. The last war ended decades ago, but someone is still here, kept alive by means that defy nature.",
    ],
    fungal: [
      "A chamber where fungal growth has encased something alive — a humanoid shape cocooned in mycelium, still breathing, still blinking. It mouths words through the translucent membrane.",
      "A natural cage of crystal formations, too tight to squeeze through. Inside, something paces — freed from one prison and trapped in another.",
    ],
    ice: [
      "A figure frozen in a block of ice — perfectly preserved, expression caught mid-scream. The ice here is thinner than elsewhere. It could be broken.",
      "A crevasse serving as a natural prison. Something climbs the walls below, never quite reaching the top. It has been climbing for a very long time.",
    ],
    volcanic: [
      "A cage of volcanic rock suspended over a lava pool by cooling chains. The occupant is fire-resistant but not immune. They have burns.",
      "A chamber sealed by a lava flow that has since cooled to solid rock. Behind it, something pounds rhythmically — patient and tireless.",
    ],
  },
  flooded: {
    crypt: [
      "A burial chamber where groundwater has risen over centuries. Stone coffins are half-submerged, their contents bloated and mobile. The water is cold, dark, and tastes of death.",
      "A collapsed section where an underground stream has reclaimed the passage. Bones float in the current, and the bottom is deeper than it appears.",
    ],
    mine: [
      "A flooded shaft where the pumps failed. Black water fills the chamber to chest height, and the ceiling is too low for comfort. Things brush against your legs beneath the surface.",
      "A natural aquifer breached by mining. Crystal-clear water fills the lower passages, hiding the floor twenty feet below.",
    ],
    sewer: [
      "A junction where overflow has created a pool of waist-deep sewage. The water churns with unseen movement. What lives in this is adapted to filth.",
      "A pumping station that failed decades ago. The water has risen to the walkways, and the machinery below is home to things that prefer the dark.",
    ],
    temple: [
      "A baptismal chamber designed for full immersion. The sacred pool has become something else — the water is dark and moves against natural current.",
      "A flooded crypt beneath the temple floor, accessible only by diving. Air pockets exist between the arched ceiling and the water surface.",
    ],
    fortress: [
      "A moat tunnel — the fortress's water defenses extend underground. The tunnel is half-flooded and patrolled by things the garrison released for security.",
      "A cistern that provided the fortress's water supply. The water is pure but deep, and the bottom holds decades of things accidentally or deliberately dropped.",
    ],
    fungal: [
      "A flooded grotto where bioluminescent algae and aquatic fungi create an otherworldly glow beneath the surface. Beautiful and deeply treacherous.",
      "A section where underground streams feed the fungal growth. The water is warm, nutrient-rich, and home to aquatic fungal organisms of unsettling size.",
    ],
    ice: [
      "A partially frozen lake — surface ice thick enough to stand on, but dark water moves beneath. The ice groans and cracks with each step.",
      "A meltwater chamber where glacial runoff collects in pools of painfully cold water. The cold is dangerous in itself.",
    ],
    volcanic: [
      "A chamber where volcanic heat has turned groundwater into a near-boiling pool. Steam fills the air, and the water scalds anything that touches it.",
      "A hot spring cavern where mineral-rich water bubbles from the rock. Some pools are bathwater-warm. Others will cook meat on the bone.",
    ],
  },
  collapsed: {
    crypt: [
      "A section of ceiling has fallen, filling the passage with rubble and broken coffins. A gap at the top might be passable with effort — or strength.",
      "Earthquake damage has split this chamber in two. A wall of shattered stone and bone separates you from the passage beyond.",
    ],
    mine: [
      "A classic cave-in — timber shoring failed, bringing the ceiling down in a cascade of rock and dust. Clearing it is possible but dangerous.",
      "A blasting accident collapsed the tunnel ahead. The rubble is loose — it could be cleared, but it could also shift further.",
    ],
    sewer: [
      "A structural failure has dropped a building's foundation into the sewer tunnel. Stone blocks and broken pipes create a wall of debris.",
      "The tunnel ceiling has sagged to half height, forced down by the weight of the city above. Crawling through is possible but claustrophobic.",
    ],
    temple: [
      "A section of the temple has collapsed inward — pillars toppled, ceiling fallen in great slabs. A passage exists through the rubble for those strong enough to move stone.",
      "The dome above this chamber is cracked, rubble choking the far exit. Clearing it requires brute force or clever engineering.",
    ],
    fortress: [
      "Siege damage brought down this section of wall. Rubble fills the corridor, but the stones are loose enough to shift with sufficient strength.",
      "An interior wall has been deliberately collapsed — a defensive measure to seal off deeper sections. Breaking through is possible but loud.",
    ],
    fungal: [
      "A section of cave where fungal growth has filled the passage — not rubble but dense, woody mycelium as hard as wood. It can be cut or burned.",
      "A cave-in where fungal growth has partially stabilized the rubble, creating a living wall of stone and mushroom matter.",
    ],
    ice: [
      "An ice fall has sealed this passage — glacial ice tens of feet thick. It can be chipped through with tools, but it will take time and noise.",
      "The ceiling has collapsed into a pile of frozen rubble — ice and stone fused together by centuries of cold.",
    ],
    volcanic: [
      "A lava flow has cooled solid, sealing the passage in a wall of basalt. It is passable with heavy tools or significant force.",
      "A volcanic tremor brought down the ceiling. The rubble is hot to the touch but stable enough to clear.",
    ],
  },
  garden: {
    crypt: [
      "A crypt chamber where pale, phosphorescent fungi have colonized the graves — feeding on the dead, growing in unnatural abundance. Some may have alchemical value.",
      "A bone garden — someone planted the remains here deliberately, and from the calcium-rich soil, pallid herbs grow with disturbing vitality.",
    ],
    mine: [
      "A side chamber where crystal formations grow in mineral-rich pools. Some crystals have alchemical properties, glowing faintly with stored energy.",
      "A natural cavern where cave-adapted plants thrive near a geothermal vent — pale roots, luminous mosses, and mushrooms of medicinal value.",
    ],
    sewer: [
      "An illegal grow operation abandoned in the sewer system. Herb boxes lit by alchemical lamps still produce, tended by nothing but time and water.",
      "A section where sewer nutrients have created a garden of unusual vigor — medicinal herbs and useful fungi thriving in the filth.",
    ],
    temple: [
      "A meditation garden maintained by divine magic — plants that should not grow underground thrive here in permanent twilight. Healing herbs and rare reagents.",
      "A physic garden where temple healers grew their medicines. The plants survived the temple's fall through sheer magical momentum.",
    ],
    fortress: [
      "An indoor herb garden where the fortress alchemist grew reagents. The growth lamps still function, and the plants are thriving without anyone to tend them.",
      "A mushroom farm in the fortress cellars — military rations grown underground. Some varieties have developed unusual properties without harvest for decades.",
    ],
    fungal: [
      "The heart of the fungal ecosystem — a chamber of extraordinary biodiversity where hundreds of species compete and cooperate. Alchemical treasure grows on every surface.",
      "A cultivated garden of rare fungi — someone (or something) with expert knowledge has been breeding these specimens for specific properties.",
    ],
    ice: [
      "A geothermal pocket within the glacier where warmth allows hardy alpine plants to survive. Ice flowers bloom beside hot-spring mosses.",
      "A chamber where crystalline formations resemble a frozen garden — ice shaped like flowers, frost-ferns, and mineral deposits that mimic fruit.",
    ],
    volcanic: [
      "A chamber where volcanic soil and geothermal warmth create ideal growing conditions. Fire-resistant plants thrive here — ashen roses, ember-caps, and slag-lilies.",
      "A natural greenhouse where volcanic glass forms a transparent ceiling, letting in light while retaining heat. The plants here evolved in fire.",
    ],
  },
  portal: {
    crypt: [
      "A shimmering doorway of grey light stands in the center of a ritual circle. The inscriptions describe it as a 'way back for the lost.' Whether that means you or the dead is unclear.",
      "A mirror of polished obsidian reflects a room that is not this one. Touching the surface causes your hand to pass through.",
    ],
    mine: [
      "A section of wall where the ore vein forms a perfect spiral pattern that hurts to look at. The center is not solid — your hand passes through into cold air and distant light.",
      "An ancient arch of worked stone predating the mine by millennia. The air between its pillars shimmers with displaced space.",
    ],
    sewer: [
      "A whirlpool in the sewer channel that spins in defiance of current direction. Looking into it reveals somewhere else — not down, but across.",
      "A section of wall painted with a door by someone with genuine arcane talent. The painted door opens.",
    ],
    temple: [
      "A gateway arch inscribed with divine script. The space between the pillars shows another location — shimmering, uncertain, but navigable.",
      "A sacred circle that hums with transportation magic. Stepping into it could take you forward in the dungeon — or back to the entrance.",
    ],
    fortress: [
      "A siege engineer's emergency exit — a teleportation circle built into the floor, powered by ambient magic. Its destination is uncertain after decades without maintenance.",
      "A magic mirror on the war room wall that served as a communication device. It now shows rooms within the dungeon itself, and stepping through is possible.",
    ],
    fungal: [
      "A ring of mycelium that glows with coherent light, forming a portal in the air above it. The fungal network connects distant points in space.",
      "A massive mushroom cap whose gills form a spiral that draws the eye inward. Step beneath it and emerge somewhere else in the cave system.",
    ],
    ice: [
      "A section of ice so clear it seems to not exist. Looking through reveals another chamber — not adjacent, not connected by any passage. Stepping through the ice takes you there.",
      "A frozen waterfall where the water flows upward. Walking into the flow carries you to another location within the glacier.",
    ],
    volcanic: [
      "A ring of fire that burns without fuel, its center showing another place entirely. The heat at the edge is manageable; the center is not hot at all.",
      "A pool of lava with a surface that reflects impossibly — showing a room elsewhere in the dungeon. Touching the surface does not burn. It transports.",
    ],
  },
};

// ── Trap Generation ──────────────────────────────────────────────────────────

const TRAP_DEFINITIONS: Record<TrapType, {
  damage: (level: number) => string;
  effect: string;
  disarmStat: "DEX" | "INT" | "WIS" | "STR";
  descriptions: string[];
}> = {
  pit_trap: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 2))}d6 fall`,
    effect: "Prone at bottom of pit. Climbing out requires STR check.",
    disarmStat: "DEX",
    descriptions: [
      "A section of floor that gives way beneath your weight, revealing a shaft below.",
      "Hinged floor tiles concealing a deep drop. The edges are scored with previous victims' claw marks.",
    ],
  },
  arrow_trap: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 3) + 1)}d8 piercing`,
    effect: "Multiple projectiles. Each arrow requires a separate save.",
    disarmStat: "DEX",
    descriptions: [
      "Tiny holes in the walls at chest height. A pressure plate on the floor ahead.",
      "A corridor with suspicious regularity to its stonework. The mortar between certain blocks is fresh.",
    ],
  },
  poison_gas: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 2))}d4 poison`,
    effect: "Poisoned condition for 1d4 rounds. CON save each round to end.",
    disarmStat: "INT",
    descriptions: [
      "A faint yellowish tinge to the air. The torchlight flickers oddly near the floor.",
      "Dead insects litter the floor of this passage. The air tastes metallic.",
    ],
  },
  crushing_walls: {
    damage: (lvl) => `${Math.max(2, Math.floor(lvl / 2) + 1)}d8 bludgeoning`,
    effect: "Restrained between walls. STR check each round or take damage again.",
    disarmStat: "STR",
    descriptions: [
      "The corridor narrows ahead. Grinding sounds come from within the walls. Fresh scratches on the floor.",
      "A room with suspiciously clean walls — no debris, no dust, as if something scrapes them regularly.",
    ],
  },
  fire_jets: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 2))}d6 fire`,
    effect: "Combustible equipment may ignite. DEX save for half damage.",
    disarmStat: "DEX",
    descriptions: [
      "Small nozzles protrude from the walls at regular intervals. A faint smell of oil hangs in the air.",
      "Scorch marks pattern the floor in regular lines. The stone here is permanently blackened.",
    ],
  },
  ice_floor: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 3))}d6 cold + fall`,
    effect: "Prone. Movement halved for 1 round. Equipment may become brittle.",
    disarmStat: "DEX",
    descriptions: [
      "A section of floor so smooth it reflects like a mirror. The cold rises from it in visible waves.",
      "A gentle downward slope covered in a thin layer of what looks like water but is actually ice.",
    ],
  },
  alarm: {
    damage: () => "0 (no damage)",
    effect: "Summons 1d4+1 enemies from adjacent rooms. No surprise round for you.",
    disarmStat: "INT",
    descriptions: [
      "A wire stretched across the passage at shin height, connected to a mechanism in the wall.",
      "Runes on the floor that pulse faintly — a ward of detection, magical in nature.",
    ],
  },
  curse_glyph: {
    damage: (lvl) => `${Math.max(1, Math.floor(lvl / 3))}d6 necrotic`,
    effect: "Cursed: -2 to all ability checks until removed. WIS save to resist.",
    disarmStat: "WIS",
    descriptions: [
      "A symbol etched into the floor that seems to writhe at the edge of vision. Looking at it directly makes your eyes water.",
      "A doorway framed with script that shifts when not observed directly. The letters are wrong — subtly, deliberately wrong.",
    ],
  },
};

function generateTrap(rng: RNG, playerLevel: number, theme: DungeonTheme): Trap {
  const types: TrapType[] = ["pit_trap", "arrow_trap", "poison_gas", "crushing_walls", "fire_jets", "ice_floor", "alarm", "curse_glyph"];
  // Bias toward theme-appropriate traps
  const themeTraps: Partial<Record<DungeonTheme, TrapType[]>> = {
    crypt: ["curse_glyph", "poison_gas", "arrow_trap"],
    mine: ["pit_trap", "crushing_walls", "alarm"],
    sewer: ["poison_gas", "pit_trap", "alarm"],
    temple: ["curse_glyph", "fire_jets", "arrow_trap"],
    fortress: ["arrow_trap", "crushing_walls", "fire_jets"],
    fungal: ["poison_gas", "alarm", "pit_trap"],
    ice: ["ice_floor", "pit_trap", "crushing_walls"],
    volcanic: ["fire_jets", "pit_trap", "crushing_walls"],
  };

  const pool = rngChance(rng, 0.6) ? (themeTraps[theme] ?? types) : types;
  const type = rngPick(rng, pool);
  const def = TRAP_DEFINITIONS[type];
  const dc = 10 + Math.floor(playerLevel * 1.2) + rngInt(rng, -2, 2);

  return {
    type,
    dc: Math.max(8, Math.min(25, dc)),
    damage: def.damage(playerLevel),
    effect: def.effect,
    disarmStat: def.disarmStat,
    description: rngPick(rng, def.descriptions),
  };
}

// ── Puzzle Generation ────────────────────────────────────────────────────────

const PUZZLE_DEFINITIONS: Record<PuzzleType, {
  checkStat: "INT" | "WIS" | "DEX" | "CHA";
  templates: { description: string; hint: string; solution: string; reward: string }[];
}> = {
  lever_sequence: {
    checkStat: "INT",
    templates: [
      {
        description: "Four levers protrude from the wall, each marked with a symbol: sun, moon, star, crown. A plaque reads: 'First the night, then its jewels, then the day, then the ruler of all.'",
        hint: "The order is described in the plaque — night is moon, jewels are stars.",
        solution: "Moon, Star, Sun, Crown",
        reward: "The wall slides open revealing a hidden passage.",
      },
      {
        description: "Three iron levers marked I, II, III. Above them: 'The last shall be first, and the middle shall remain.' Currently all point down.",
        hint: "Reverse the sequence — pull III, then II stays, then I.",
        solution: "III, I (skip II)",
        reward: "A stone panel retracts from the floor revealing a stairway.",
      },
    ],
  },
  pressure_plates: {
    checkStat: "INT",
    templates: [
      {
        description: "A grid of nine floor tiles marked with numbers 1-9. A carved message reads: 'Walk the path of fifteen — row, column, and diagonal alike.'",
        hint: "It is a magic square. The center is always 5.",
        solution: "Step on tiles in magic square order: 2,7,6,9,5,1,4,3,8",
        reward: "The far door unlocks with a satisfying click.",
      },
      {
        description: "Five pressure plates in a line, each a different color: red, blue, green, yellow, white. 'Step where sky meets sea, then grass, then sun, then blood, then bone.'",
        hint: "Sky and sea are blue, grass is green, sun is yellow, blood is red, bone is white.",
        solution: "Blue, Green, Yellow, Red, White",
        reward: "A secret compartment opens in the wall beside the plates.",
      },
    ],
  },
  symbol_matching: {
    checkStat: "INT",
    templates: [
      {
        description: "Rotating stone discs on the wall, each with four symbols. A mosaic on the ceiling shows the correct alignment — but it is partially destroyed.",
        hint: "The surviving mosaic sections show the outer ring pattern. The inner follows the same logic.",
        solution: "Align all discs so the serpent symbols form a continuous line.",
        reward: "The discs lock into place and the sealed door grinds open.",
      },
      {
        description: "Six tiles can be flipped between two symbols each. The walls show three pairs of symbols that must all be visible simultaneously.",
        hint: "Each tile has one symbol from a pair on each side. Find the combination where all three pairs are showing.",
        solution: "Flip tiles 1, 3, and 5 to their alternate sides.",
        reward: "The tiles glow and a barrier of force dissipates.",
      },
    ],
  },
  riddle: {
    checkStat: "WIS",
    templates: [
      {
        description: "A stone face carved into the wall speaks: 'I have cities but no houses, forests but no trees, water but no fish. What am I?'",
        hint: "Think of something that represents these things without being them literally.",
        solution: "A map.",
        reward: "The stone face smiles and swings inward like a door.",
      },
      {
        description: "An inscription above a sealed door: 'The more you take, the more you leave behind. Name me, and I shall open.'",
        hint: "Consider what is created by the act of movement itself.",
        solution: "Footsteps.",
        reward: "The door dissolves into mist at the spoken word.",
      },
      {
        description: "A skeletal figure holds a scale. 'I am lighter than a feather, yet the strongest man cannot hold me for more than five minutes. Speak my name.'",
        hint: "It is not a physical object but something the body requires.",
        solution: "Breath.",
        reward: "The skeleton's jaw opens and drops a key.",
      },
    ],
  },
  lock_picking: {
    checkStat: "DEX",
    templates: [
      {
        description: "A complex lock with five tumblers, each requiring a different tension and angle. The mechanism is old but well-made — dwarven engineering.",
        hint: "Listen for the clicks. Each tumbler has a different sweet spot.",
        solution: "Sequential tumbler alignment through delicate manipulation.",
        reward: "The lock opens silently, as fine mechanisms do.",
      },
      {
        description: "A puzzle-lock with rotating rings that must align their notches simultaneously. Three rings, each with a different number of positions.",
        hint: "The rings have 3, 5, and 7 positions respectively. Only one alignment works.",
        solution: "Align the notches by feel — position 2, 3, 5.",
        reward: "The rings click into alignment and the bolt withdraws.",
      },
    ],
  },
  color_mixing: {
    checkStat: "INT",
    templates: [
      {
        description: "Three alchemical dispensers (red, blue, yellow liquid) over a basin. The door is sealed with purple resin. A note reads: 'Feed the seal its own color, and it shall dissolve.'",
        hint: "Purple is made from red and blue. No yellow needed.",
        solution: "Mix red and blue liquids in the basin, apply to seal.",
        reward: "The purple resin hisses and dissolves, freeing the door.",
      },
      {
        description: "Five colored crystals must be placed in a beam of white light to cast a specific shadow color on the lock-rune. The rune is green.",
        hint: "Green light requires the right crystal. Or remove all others from the beam.",
        solution: "Place only the green crystal in the light beam.",
        reward: "Green light strikes the rune, which flares and deactivates.",
      },
    ],
  },
  math_puzzle: {
    checkStat: "INT",
    templates: [
      {
        description: "A dial with numbers 0-9. Above it: 'I am a number. Double me and add six. Halve the result. Subtract my original self. What remains is always...'",
        hint: "The answer is the same regardless of what number you start with.",
        solution: "3. (2x + 6) / 2 - x = 3 always.",
        reward: "Dial clicks to 3 and the mechanism engages.",
      },
      {
        description: "Four number wheels (0-9 each) beside a door. An equation is carved above: 'The year the temple fell, minus the number of pillars in the entry hall (8), minus the cost of a prayer in copper (5).'",
        hint: "The temple's founding date is carved on the first pillar you passed: 1247. It fell 200 years later.",
        solution: "1447 - 8 - 5 = 1434. Set wheels to 1-4-3-4.",
        reward: "The wheels lock and the door swings inward.",
      },
    ],
  },
  memory: {
    checkStat: "WIS",
    templates: [
      {
        description: "A sequence of runes flashes on the wall — seven symbols in rapid succession — then fades. Seven blank tiles await your touch.",
        hint: "Focus on patterns and groupings. The first three form a common word in the runic script.",
        solution: "Reproduce the exact sequence of runes from memory.",
        reward: "The tiles glow in confirmation and a panel slides aside.",
      },
      {
        description: "A musical tone plays from the walls — five notes in sequence. Five tuned stones await striking. The sequence plays only once.",
        hint: "The notes descend, then rise, then descend again. Pattern: high, mid, low, mid, low.",
        solution: "Strike stones in the exact pitch sequence heard.",
        reward: "The resonance unlocks a frequency-sealed door.",
      },
    ],
  },
  chess_puzzle: {
    checkStat: "INT",
    templates: [
      {
        description: "A giant chessboard fills the room. A single knight piece stands at one corner. A plaque reads: 'The knight must visit every square exactly once to open the gate.'",
        hint: "A knight's tour. Start from the corner and plan ahead. The closed tour is not required.",
        solution: "Complete a valid knight's tour across the board.",
        reward: "The final square depresses and the gate rises.",
      },
      {
        description: "A 4x4 board with chess pieces. 'Place four queens so none threatens another.' The squares light when occupied correctly.",
        hint: "No two queens can share a row, column, or diagonal.",
        solution: "Queens at positions (1,2), (2,4), (3,1), (4,3) or equivalent.",
        reward: "All four squares glow gold and the door mechanism engages.",
      },
    ],
  },
  musical: {
    checkStat: "CHA",
    templates: [
      {
        description: "A pipe organ built into the wall, its keys labeled with elemental symbols. A score etched in the stone shows a melody: wind, fire, water, earth, wind, wind, fire.",
        hint: "Play the symbols in order. The doubled wind is not a mistake.",
        solution: "Strike keys in sequence: wind, fire, water, earth, wind, wind, fire.",
        reward: "The final chord resonates and a hidden door vibrates open.",
      },
      {
        description: "Crystal stalactites of different lengths hang from the ceiling. Striking them produces tones. A faded painting shows a musician playing five specific notes in sequence.",
        hint: "The stalactites are tuned — longest to shortest is lowest to highest. Match the painting's hand positions.",
        solution: "Strike stalactites in the order shown: 3rd, 1st, 5th, 2nd, 4th.",
        reward: "The cave wall resonates at the exact frequency needed to shatter a thin barrier.",
      },
    ],
  },
};

function generatePuzzle(rng: RNG, playerLevel: number): Puzzle {
  const types: PuzzleType[] = [
    "lever_sequence", "pressure_plates", "symbol_matching", "riddle",
    "lock_picking", "color_mixing", "math_puzzle", "memory",
    "chess_puzzle", "musical",
  ];
  const type = rngPick(rng, types);
  const def = PUZZLE_DEFINITIONS[type];
  const template = rngPick(rng, def.templates);
  const dc = 10 + Math.floor(playerLevel * 0.8) + rngInt(rng, -1, 3);

  return {
    type,
    dc: Math.max(8, Math.min(22, dc)),
    description: template.description,
    hint: template.hint,
    solution: template.solution,
    rewardDescription: template.reward,
    checkStat: def.checkStat,
  };
}

// ── Enemy Generation ─────────────────────────────────────────────────────────

const THEME_ENEMIES: Record<DungeonTheme, { minions: string[]; standards: string[]; elites: string[]; bosses: string[] }> = {
  crypt: {
    minions: ["Skeleton", "Crawling Claw", "Zombie Rat"],
    standards: ["Zombie", "Ghoul", "Wight"],
    elites: ["Wraith", "Mummy", "Ghast"],
    bosses: ["Lich Acolyte", "Death Knight", "Crypt Lord", "Bone Colossus"],
  },
  mine: {
    minions: ["Kobold Miner", "Giant Rat", "Cave Cricket"],
    standards: ["Goblin Sapper", "Rust Monster", "Giant Ant"],
    elites: ["Bugbear Foreman", "Earth Elemental", "Cave Troll"],
    bosses: ["Stone Golem", "Mine Wyrm", "The Collapsed King", "Deep Borer"],
  },
  sewer: {
    minions: ["Dire Rat", "Sewer Roach", "Slime Mold"],
    standards: ["Otyugh", "Rat Swarm", "Crocodile"],
    elites: ["Shambling Mound", "Gelatinous Cube", "Wererat"],
    bosses: ["Rat King", "Sewer Aboleth", "The Plague Bearer", "Otyugh Matriarch"],
  },
  temple: {
    minions: ["Animated Candle", "Prayer Wisp", "Temple Guard Ghost"],
    standards: ["Clay Golem Fragment", "Corrupted Acolyte", "Shadow"],
    elites: ["Stone Golem", "Spectral Priest", "Bone Devil"],
    bosses: ["Fallen Seraph", "Idol of Corruption", "The Heresiarch", "Wrath of the Forgotten God"],
  },
  fortress: {
    minions: ["Guard Dog", "Goblin Scout", "Skeleton Sentry"],
    standards: ["Hobgoblin Soldier", "Ogre Guard", "Animated Armor"],
    elites: ["War Troll", "Iron Golem Fragment", "Elite Knight"],
    bosses: ["Warlord Commander", "Siege Golem", "The Iron General", "Fortress Guardian"],
  },
  fungal: {
    minions: ["Sporeling", "Myconid Sprout", "Rot Grub"],
    standards: ["Fungal Shambler", "Violet Fungus", "Gas Spore"],
    elites: ["Myconid Sovereign", "Corpse Flower", "Spore Dragon"],
    bosses: ["The Overmind", "Zuggtmoy's Chosen", "Colony Heart", "The Rot Emperor"],
  },
  ice: {
    minions: ["Ice Mephit", "Frost Sprite", "Snow Rat"],
    standards: ["Yeti", "Ice Elemental", "Frozen Zombie"],
    elites: ["Frost Giant Runt", "Winter Wolf", "Ice Wraith"],
    bosses: ["Frost Wyrm", "The Frozen One", "Glacier Heart", "Winter's Wrath"],
  },
  volcanic: {
    minions: ["Fire Mephit", "Magma Mite", "Ember Beetle"],
    standards: ["Magmin", "Fire Elemental", "Salamander Scout"],
    elites: ["Efreeti", "Lava Golem", "Flameskull Collective"],
    bosses: ["Magma Dragon", "The Forge Father", "Inferno Elemental", "Ember Colossus"],
  },
};

function generateEnemy(rng: RNG, theme: DungeonTheme, difficulty: EnemyDifficulty, playerLevel: number): Enemy {
  const pool = THEME_ENEMIES[theme];
  let name: string;
  let hpMult: number;
  let acBase: number;
  let atkBase: number;

  switch (difficulty) {
    case "minion":
      name = rngPick(rng, pool.minions);
      hpMult = 0.4;
      acBase = 10;
      atkBase = 1;
      break;
    case "standard":
      name = rngPick(rng, pool.standards);
      hpMult = 1.0;
      acBase = 13;
      atkBase = 3;
      break;
    case "elite":
      name = rngPick(rng, pool.elites);
      hpMult = 1.8;
      acBase = 15;
      atkBase = 5;
      break;
    case "boss":
      name = rngPick(rng, pool.bosses);
      hpMult = 3.0;
      acBase = 17;
      atkBase = 7;
      break;
  }

  const levelScale = playerLevel * 2;
  const hp = Math.max(4, Math.floor((10 + levelScale) * hpMult + rngInt(rng, -2, 4)));
  const ac = acBase + Math.floor(playerLevel * 0.5) + rngInt(rng, -1, 1);
  const attack = atkBase + Math.floor(playerLevel * 0.7);
  const diceCount = Math.max(1, Math.floor(playerLevel / 3) + (difficulty === "boss" ? 2 : difficulty === "elite" ? 1 : 0));
  const damage = `${diceCount}d${difficulty === "boss" ? 10 : difficulty === "elite" ? 8 : 6}+${Math.floor(playerLevel / 2)}`;

  return {
    name,
    difficulty,
    hp,
    ac,
    attack,
    damage,
    subtypes: [theme],
    special: difficulty === "boss" ? rngPick(rng, [
      "Multi-attack (2 attacks per turn)",
      "Legendary resistance (1/day, auto-succeed a save)",
      "Frightful presence (WIS save or frightened)",
      "Regeneration (regains 5 HP at start of turn)",
      "Area attack (all adjacent, DEX save for half)",
    ]) : undefined,
  };
}

function generateCombatEncounter(rng: RNG, theme: DungeonTheme, playerLevel: number, depth: number): Enemy[] {
  const enemies: Enemy[] = [];
  const numMinions = rngInt(rng, 1, 2 + Math.floor(depth / 3));
  const numStandards = rngInt(rng, 1, 1 + Math.floor(depth / 4));

  for (let i = 0; i < numMinions; i++) {
    enemies.push(generateEnemy(rng, theme, "minion", playerLevel));
  }
  for (let i = 0; i < numStandards; i++) {
    enemies.push(generateEnemy(rng, theme, "standard", playerLevel));
  }
  if (depth > 3 && rngChance(rng, 0.3)) {
    enemies.push(generateEnemy(rng, theme, "elite", playerLevel));
  }
  return enemies;
}

function generateBossEncounter(rng: RNG, theme: DungeonTheme, playerLevel: number): Enemy[] {
  const enemies: Enemy[] = [];
  enemies.push(generateEnemy(rng, theme, "boss", playerLevel));
  // Add some minion support
  const minionCount = rngInt(rng, 2, 4);
  for (let i = 0; i < minionCount; i++) {
    enemies.push(generateEnemy(rng, theme, "minion", playerLevel));
  }
  if (rngChance(rng, 0.5)) {
    enemies.push(generateEnemy(rng, theme, "standard", playerLevel));
  }
  return enemies;
}

// ── Loot Generation ──────────────────────────────────────────────────────────

const THEME_LOOT_BIAS: Record<DungeonTheme, string[]> = {
  crypt: ["scroll", "gem", "gold", "armor"],
  mine: ["gem", "gold", "weapon", "reagent"],
  sewer: ["potion", "gold", "weapon", "key"],
  temple: ["scroll", "potion", "armor", "gem"],
  fortress: ["weapon", "armor", "gold", "potion"],
  fungal: ["reagent", "potion", "scroll", "gem"],
  ice: ["gem", "potion", "weapon", "gold"],
  volcanic: ["gem", "weapon", "armor", "gold"],
};

function generateItem(rng: RNG, rarity: LootRarity, theme: DungeonTheme, playerLevel: number): Item {
  const biasedCategories = THEME_LOOT_BIAS[theme] as Item["category"][];
  const category = rngPick(rng, biasedCategories);

  const valueMultiplier: Record<LootRarity, number> = {
    common: 1,
    uncommon: 5,
    rare: 25,
    epic: 100,
    legendary: 500,
  };

  const baseValue = (5 + playerLevel * 3) * valueMultiplier[rarity];
  const value = Math.floor(baseValue * (0.8 + rng() * 0.4));

  const ITEM_NAMES: Record<Item["category"], Record<LootRarity, string[]>> = {
    weapon: {
      common: ["Rusty Shortsword", "Wooden Club", "Bent Dagger"],
      uncommon: ["Fine Steel Longsword", "Balanced Hand Axe", "Sharp Hunting Bow"],
      rare: ["Enchanted Blade", "Flamebrand Dagger", "Thundercrack Mace"],
      epic: ["Vorpal Edge", "Dragonslayer", "Staff of the Archmage"],
      legendary: ["Godsteel Greatsword", "The Final Argument", "Soul Reaver"],
    },
    armor: {
      common: ["Patched Leather", "Dented Shield", "Rusty Chainmail Scraps"],
      uncommon: ["Studded Leather Vest", "Steel Buckler", "Chain Shirt"],
      rare: ["Mithral Chainmail", "Enchanted Plate Gauntlets", "Shield of the Faithful"],
      epic: ["Dragonscale Breastplate", "Aegis of the Undying", "Cloak of Shadows"],
      legendary: ["Armor of the Eternal Guardian", "The Living Shield", "Godplate"],
    },
    potion: {
      common: ["Weak Healing Potion", "Antitoxin", "Torchbright Elixir"],
      uncommon: ["Healing Potion", "Potion of Bull's Strength", "Invisibility Draught"],
      rare: ["Greater Healing Potion", "Potion of Haste", "Fire Resistance Elixir"],
      epic: ["Supreme Healing Potion", "Potion of Invulnerability", "Elixir of Life"],
      legendary: ["Potion of Divine Restoration", "Philosopher's Elixir", "Draught of Eternity"],
    },
    scroll: {
      common: ["Scroll of Light", "Scroll of Mending", "Scroll of Detect Magic"],
      uncommon: ["Scroll of Fireball", "Scroll of Cure Wounds", "Scroll of Shield"],
      rare: ["Scroll of Lightning Bolt", "Scroll of Teleportation", "Scroll of Raise Dead"],
      epic: ["Scroll of Disintegrate", "Scroll of True Resurrection", "Scroll of Wish Fragment"],
      legendary: ["Scroll of Divine Intervention", "Scroll of Reality Warp", "Primordial Scripture"],
    },
    gem: {
      common: ["Quartz Shard", "Agate Chip", "Uncut Garnet"],
      uncommon: ["Polished Amethyst", "Citrine", "Moonstone"],
      rare: ["Star Sapphire", "Fire Opal", "Black Pearl"],
      epic: ["Flawless Diamond", "Heart Ruby", "King's Emerald"],
      legendary: ["Prismatic Gem", "Soul Crystal", "Heart of the Mountain"],
    },
    gold: {
      common: ["Copper Purse", "Silver Handful", "Tarnished Coins"],
      uncommon: ["Gold Pouch", "Silver Bars", "Electrum Ingot"],
      rare: ["Platinum Coins", "Gold Bars", "Gem-Studded Coffer"],
      epic: ["Treasure Chest", "Golden Idol", "Royal Tribute"],
      legendary: ["Dragon's Hoard Fragment", "King's Ransom", "Vault of Ages"],
    },
    reagent: {
      common: ["Dried Mushroom", "Iron Shavings", "Sulfur Powder"],
      uncommon: ["Owlbear Feather", "Troll Blood Vial", "Moonpetal"],
      rare: ["Dragon Scale", "Unicorn Hair", "Elemental Essence"],
      epic: ["Phoenix Ash", "Lich Dust", "Void Crystal"],
      legendary: ["Primordial Spark", "God-Bone Fragment", "Quintessence"],
    },
    key: {
      common: ["Rusty Iron Key", "Brass Skeleton Key", "Wooden Token"],
      uncommon: ["Silver Key", "Enchanted Lockpick", "Warded Key"],
      rare: ["Crystal Key", "Shadowed Key", "Master Key"],
      epic: ["Mithral Skeleton Key", "Key of Opening", "Vault Sigil"],
      legendary: ["Key to Everything", "Dimensional Key", "God-Key"],
    },
  };

  const name = rngPick(rng, ITEM_NAMES[category][rarity]);

  const descriptions: Record<LootRarity, string[]> = {
    common: ["Unremarkable but functional.", "Well-worn but serviceable.", "Nothing special, but better than nothing."],
    uncommon: ["Above average quality.", "Crafted with some skill.", "A cut above the mundane."],
    rare: ["Exceptional craftsmanship.", "Radiates faint magic.", "Clearly the work of a master."],
    epic: ["Hums with power.", "Of legendary make.", "The kind of thing wars start over."],
    legendary: ["Reality bends around it.", "A relic of the gods.", "Its presence alone commands awe."],
  };

  return {
    name,
    rarity,
    category,
    value,
    description: rngPick(rng, descriptions[rarity]),
    effect: rarity === "rare" || rarity === "epic" || rarity === "legendary"
      ? `+${rarity === "rare" ? 1 : rarity === "epic" ? 2 : 3} to ${category === "weapon" ? "attack" : category === "armor" ? "AC" : "relevant checks"}`
      : undefined,
  };
}

function generateRoomLoot(rng: RNG, depth: number, playerLevel: number, theme: DungeonTheme, roomType: RoomType): Item[] {
  const items: Item[] = [];

  // Determine rarity based on depth and room type
  const rarityChance = rng();
  const depthBonus = depth * 0.05;
  let rarity: LootRarity;

  if (roomType === "boss") {
    // Boss always rare+
    if (rarityChance < 0.1 + depthBonus) rarity = "legendary";
    else if (rarityChance < 0.35 + depthBonus) rarity = "epic";
    else rarity = "rare";
    items.push(generateItem(rng, rarity, theme, playerLevel));
    // Boss drops 2-3 items
    items.push(generateItem(rng, rngChance(rng, 0.5) ? "rare" : "uncommon", theme, playerLevel));
    if (rngChance(rng, 0.6)) {
      items.push(generateItem(rng, "uncommon", theme, playerLevel));
    }
  } else if (roomType === "treasure") {
    // Treasure rooms: 2-4 items
    const count = rngInt(rng, 2, 4);
    for (let i = 0; i < count; i++) {
      if (rarityChance + i * 0.1 < 0.2 + depthBonus) rarity = "epic";
      else if (rarityChance + i * 0.1 < 0.5 + depthBonus) rarity = "rare";
      else rarity = "uncommon";
      items.push(generateItem(rng, rarity, theme, playerLevel));
    }
  } else {
    // Normal rooms: 0-2 items
    if (rngChance(rng, 0.4 + depthBonus * 0.5)) {
      if (rarityChance < 0.05 + depthBonus) rarity = "rare";
      else if (rarityChance < 0.3 + depthBonus) rarity = "uncommon";
      else rarity = "common";
      items.push(generateItem(rng, rarity, theme, playerLevel));
      if (rngChance(rng, 0.2)) {
        items.push(generateItem(rng, "common", theme, playerLevel));
      }
    }
  }

  return items;
}

// ── Layout Generation (Random Walk with Constraints) ─────────────────────────

type GridCell = { roomId: number } | null;

const OPPOSITE: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

const DIR_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

function generateLayout(rng: RNG, roomCount: number): {
  positions: { x: number; y: number }[];
  connections: { from: number; to: number; dir: Direction }[];
} {
  // Grid large enough to hold all rooms with room to spare
  const gridSize = Math.ceil(Math.sqrt(roomCount)) * 3;
  const grid: GridCell[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));

  const positions: { x: number; y: number }[] = [];
  const connections: { from: number; to: number; dir: Direction }[] = [];
  const directions: Direction[] = ["north", "south", "east", "west"];

  // Start in the center
  const startX = Math.floor(gridSize / 2);
  const startY = Math.floor(gridSize / 2);
  grid[startY][startX] = { roomId: 0 };
  positions.push({ x: startX, y: startY });

  // Random walk to place rooms
  let placed = 1;
  let attempts = 0;
  const maxAttempts = roomCount * 50;

  while (placed < roomCount && attempts < maxAttempts) {
    attempts++;
    // Pick a random existing room
    const fromIdx = Math.floor(rng() * positions.length);
    const from = positions[fromIdx];
    // Pick a random direction
    const dir = rngPick(rng, directions);
    const offset = DIR_OFFSET[dir];
    const nx = from.x + offset.dx;
    const ny = from.y + offset.dy;

    // Check bounds and vacancy
    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
    if (grid[ny][nx] !== null) {
      // Possibly add connection to existing room (side path)
      const existingRoom = grid[ny][nx]!;
      if (existingRoom.roomId !== fromIdx) {
        const alreadyConnected = connections.some(
          (c) => (c.from === fromIdx && c.to === existingRoom.roomId) ||
                 (c.from === existingRoom.roomId && c.to === fromIdx)
        );
        if (!alreadyConnected && rngChance(rng, 0.15)) {
          connections.push({ from: fromIdx, to: existingRoom.roomId, dir });
        }
      }
      continue;
    }

    // Place new room
    grid[ny][nx] = { roomId: placed };
    positions.push({ x: nx, y: ny });
    connections.push({ from: fromIdx, to: placed, dir });
    placed++;
  }

  // Ensure full connectivity (BFS check + fix)
  const visited = new Set<number>();
  const queue = [0];
  visited.add(0);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const conn of connections) {
      if (conn.from === current && !visited.has(conn.to)) {
        visited.add(conn.to);
        queue.push(conn.to);
      }
      if (conn.to === current && !visited.has(conn.from)) {
        visited.add(conn.from);
        queue.push(conn.from);
      }
    }
  }

  // Connect any unreachable rooms to a reachable neighbor
  for (let i = 0; i < positions.length; i++) {
    if (visited.has(i)) continue;
    const pos = positions[i];
    for (const dir of rngShuffle(rng, directions)) {
      const offset = DIR_OFFSET[dir];
      const nx = pos.x + offset.dx;
      const ny = pos.y + offset.dy;
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      const neighbor = grid[ny][nx];
      if (neighbor && visited.has(neighbor.roomId)) {
        connections.push({ from: i, to: neighbor.roomId, dir });
        visited.add(i);
        break;
      }
    }
  }

  return { positions, connections };
}

// ── Critical Path (BFS longest path from entrance) ───────────────────────────

function findCriticalPath(roomCount: number, connections: { from: number; to: number; dir: Direction }[]): number[] {
  // Build adjacency list
  const adj: Map<number, number[]> = new Map();
  for (let i = 0; i < roomCount; i++) adj.set(i, []);
  for (const conn of connections) {
    adj.get(conn.from)!.push(conn.to);
    adj.get(conn.to)!.push(conn.from);
  }

  // BFS from entrance (room 0) to find furthest room
  function bfs(start: number): { dist: Map<number, number>; farthest: number } {
    const dist = new Map<number, number>();
    const q = [start];
    dist.set(start, 0);
    let farthest = start;
    let maxDist = 0;

    while (q.length > 0) {
      const current = q.shift()!;
      const d = dist.get(current)!;
      if (d > maxDist) {
        maxDist = d;
        farthest = current;
      }
      for (const neighbor of adj.get(current)!) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, d + 1);
          q.push(neighbor);
        }
      }
    }
    return { dist, farthest };
  }

  const { farthest: bossRoom } = bfs(0);

  // BFS from boss back to entrance to get the path
  const parent = new Map<number, number>();
  const q = [bossRoom];
  const visited = new Set<number>([bossRoom]);
  parent.set(bossRoom, -1);

  while (q.length > 0) {
    const current = q.shift()!;
    if (current === 0) break;
    for (const neighbor of adj.get(current)!) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        q.push(neighbor);
      }
    }
  }

  // Reconstruct path
  const path: number[] = [];
  let node = 0;
  while (node !== -1 && node !== undefined) {
    path.push(node);
    if (node === bossRoom) break;
    node = parent.get(node) ?? -1;
  }

  // If path reconstruction fails, fallback to a straight line
  if (path[path.length - 1] !== bossRoom) {
    // Simple fallback: BFS path from 0 to bossRoom
    const pathFromBFS: number[] = [];
    const bfsParent = new Map<number, number>();
    const bfsQ = [0];
    const bfsVisited = new Set([0]);
    bfsParent.set(0, -1);
    while (bfsQ.length > 0) {
      const c = bfsQ.shift()!;
      if (c === bossRoom) break;
      for (const n of adj.get(c)!) {
        if (!bfsVisited.has(n)) {
          bfsVisited.add(n);
          bfsParent.set(n, c);
          bfsQ.push(n);
        }
      }
    }
    let cur: number | undefined = bossRoom;
    while (cur !== undefined && cur !== -1) {
      pathFromBFS.unshift(cur);
      cur = bfsParent.get(cur);
    }
    return pathFromBFS;
  }

  return path;
}

// ── Room Type Assignment ─────────────────────────────────────────────────────

function assignRoomTypes(rng: RNG, roomCount: number, criticalPath: number[], size: DungeonSize): Map<number, RoomType> {
  const types = new Map<number, RoomType>();

  // Entrance is always room 0
  types.set(0, "empty"); // Entrance is a safe room

  // Boss is always at end of critical path
  const bossId = criticalPath[criticalPath.length - 1];
  types.set(bossId, "boss");

  // Place mandatory rooms
  const criticalMiddle = criticalPath.slice(1, -1); // exclude entrance and boss
  const shuffledCritical = rngShuffle(rng, criticalMiddle);

  // At least 1 puzzle on critical path
  if (shuffledCritical.length > 0) {
    types.set(shuffledCritical[0], "puzzle");
  }

  // At least 1 combat on critical path
  if (shuffledCritical.length > 1) {
    types.set(shuffledCritical[1], "combat");
  }

  // Remaining critical path rooms: mix of combat and traps
  for (let i = 2; i < shuffledCritical.length; i++) {
    if (types.has(shuffledCritical[i])) continue;
    const roll = rng();
    if (roll < 0.4) types.set(shuffledCritical[i], "combat");
    else if (roll < 0.6) types.set(shuffledCritical[i], "trap");
    else if (roll < 0.75) types.set(shuffledCritical[i], "shrine");
    else types.set(shuffledCritical[i], "empty");
  }

  // Non-critical rooms: treasure, shops, libraries, etc.
  const sideRooms = Array.from({ length: roomCount }, (_, i) => i).filter((i) => !types.has(i));
  const shuffledSide = rngShuffle(rng, sideRooms);

  // Place at least 1 treasure room on side path
  let treasurePlaced = 0;
  const targetTreasure = size === "large" ? 3 : size === "medium" ? 2 : 1;

  const sideRoomTypes: RoomType[] = [
    "treasure", "shop", "library", "armory", "prison",
    "flooded", "collapsed", "garden", "portal",
    "combat", "trap", "shrine", "empty",
  ];

  // Weighted distribution for variety
  const weights: Record<RoomType, number> = {
    empty: 8,
    combat: 20,
    boss: 0,
    treasure: 6,
    puzzle: 8,
    trap: 10,
    shop: 4,
    shrine: 6,
    library: 5,
    armory: 5,
    prison: 4,
    flooded: 5,
    collapsed: 5,
    garden: 4,
    portal: 3,
  };

  for (const roomId of shuffledSide) {
    if (treasurePlaced < targetTreasure) {
      types.set(roomId, "treasure");
      treasurePlaced++;
      continue;
    }

    // Weighted random pick
    const totalWeight = sideRoomTypes.reduce((sum, t) => sum + weights[t], 0);
    let roll = rng() * totalWeight;
    let picked: RoomType = "combat";
    for (const t of sideRoomTypes) {
      roll -= weights[t];
      if (roll <= 0) {
        picked = t;
        break;
      }
    }
    types.set(roomId, picked);
  }

  return types;
}

// ── Room Depth Calculation ───────────────────────────────────────────────────

function calculateDepths(roomCount: number, connections: { from: number; to: number; dir: Direction }[]): Map<number, number> {
  const adj: Map<number, number[]> = new Map();
  for (let i = 0; i < roomCount; i++) adj.set(i, []);
  for (const conn of connections) {
    adj.get(conn.from)!.push(conn.to);
    adj.get(conn.to)!.push(conn.from);
  }

  const depths = new Map<number, number>();
  const queue = [0];
  depths.set(0, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = depths.get(current)!;
    for (const neighbor of adj.get(current)!) {
      if (!depths.has(neighbor)) {
        depths.set(neighbor, d + 1);
        queue.push(neighbor);
      }
    }
  }

  return depths;
}

// ── Main Generation Function ─────────────────────────────────────────────────

export function generateDungeon(
  seed: number,
  theme: DungeonTheme,
  size: DungeonSize,
  playerLevel: number,
): Dungeon {
  const rng = mulberry32(seed);
  const config = SIZE_CONFIG[size];
  const roomCount = rngInt(rng, config.min, config.max);

  // Generate layout
  const { positions, connections } = generateLayout(rng, roomCount);

  // Find critical path
  const criticalPath = findCriticalPath(roomCount, connections);
  const bossRoomId = criticalPath[criticalPath.length - 1];

  // Assign room types
  const roomTypes = assignRoomTypes(rng, roomCount, criticalPath, size);

  // Calculate depths
  const depths = calculateDepths(roomCount, connections);

  // Build connection maps per room
  const roomConnections: Map<number, DungeonRoom["connections"]> = new Map();
  for (let i = 0; i < roomCount; i++) roomConnections.set(i, {});
  for (const conn of connections) {
    const fromConns = roomConnections.get(conn.from)!;
    const toConns = roomConnections.get(conn.to)!;
    fromConns[conn.dir] = conn.to;
    toConns[OPPOSITE[conn.dir]] = conn.from;
  }

  // Generate rooms
  const rooms: DungeonRoom[] = [];
  const treasureRoomIds: number[] = [];
  const puzzleRoomIds: number[] = [];

  for (let i = 0; i < roomCount; i++) {
    const type = roomTypes.get(i) ?? "empty";
    const depth = depths.get(i) ?? 0;
    const pos = positions[i];

    // Description
    const themeDescs = ROOM_DESCRIPTIONS[type]?.[theme];
    const description = themeDescs ? rngPick(rng, themeDescs) : "A nondescript chamber.";

    // Content based on type
    let enemies: Enemy[] | undefined;
    let loot: Item[] | undefined;
    let trap: Trap | undefined;
    let puzzle: Puzzle | undefined;

    switch (type) {
      case "combat":
        enemies = generateCombatEncounter(rng, theme, playerLevel, depth);
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        break;
      case "boss":
        enemies = generateBossEncounter(rng, theme, playerLevel);
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        break;
      case "treasure":
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        // Possible trap on treasure
        if (rngChance(rng, 0.4)) {
          trap = generateTrap(rng, playerLevel, theme);
        }
        treasureRoomIds.push(i);
        break;
      case "puzzle":
        puzzle = generatePuzzle(rng, playerLevel);
        // Reward loot for solving
        loot = [generateItem(rng, rngChance(rng, 0.4) ? "rare" : "uncommon", theme, playerLevel)];
        puzzleRoomIds.push(i);
        break;
      case "trap":
        trap = generateTrap(rng, playerLevel, theme);
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        break;
      case "shop":
        // Shop items generated on demand, not pre-placed
        break;
      case "shrine":
        // Shrine effects are interactive, not pre-generated loot
        break;
      case "library":
        loot = [generateItem(rng, rngChance(rng, 0.3) ? "rare" : "uncommon", theme, playerLevel)];
        if (loot[0]) {
          loot[0].category = "scroll";
          loot[0].name = rngPick(rng, [
            "Ancient Tome", "Spell Scroll", "Research Notes",
            "Forgotten Grimoire", "Map Fragment", "Cipher Key",
          ]);
        }
        break;
      case "armory":
        loot = [];
        const armoryCount = rngInt(rng, 2, 4);
        for (let j = 0; j < armoryCount; j++) {
          const item = generateItem(rng, rngChance(rng, 0.2) ? "rare" : "uncommon", theme, playerLevel);
          item.category = rngChance(rng, 0.6) ? "weapon" : "armor";
          loot.push(item);
        }
        // Some armory items are cursed
        if (rngChance(rng, 0.25)) {
          loot[0].name = "Cursed " + loot[0].name;
          loot[0].effect = "Cursed: -1 to all saves until removed by a priest.";
        }
        break;
      case "prison":
        // Prison encounter: freed NPC or mimic
        if (rngChance(rng, 0.3)) {
          enemies = [generateEnemy(rng, theme, "standard", playerLevel)];
          enemies[0].name = "Mimic";
          enemies[0].special = "Surprise attack — appeared to be a prisoner.";
        }
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        break;
      case "flooded":
        enemies = rngChance(rng, 0.5)
          ? [generateEnemy(rng, theme, "standard", playerLevel)]
          : undefined;
        loot = generateRoomLoot(rng, depth, playerLevel, theme, type);
        break;
      case "collapsed":
        // STR check required, possible shortcut reward
        loot = rngChance(rng, 0.6)
          ? [generateItem(rng, "uncommon", theme, playerLevel)]
          : undefined;
        break;
      case "garden":
        loot = [];
        const reagentCount = rngInt(rng, 1, 3);
        for (let j = 0; j < reagentCount; j++) {
          const item = generateItem(rng, "uncommon", theme, playerLevel);
          item.category = "reagent";
          item.name = rngPick(rng, [
            "Glowing Mushroom Cap", "Cave Moss Bundle", "Crystal Pollen",
            "Bioluminescent Spores", "Deep Root Extract", "Mineral Bloom",
            "Shadow Lichen", "Frost Fern", "Ember Seed", "Mycelium Thread",
          ]);
          loot.push(item);
        }
        break;
      case "portal":
        // Portal room — no loot, teleportation effect
        break;
      case "empty":
      default:
        // Safe room, possible minor find
        if (rngChance(rng, 0.2)) {
          loot = [generateItem(rng, "common", theme, playerLevel)];
        }
        break;
    }

    rooms.push({
      id: i,
      type,
      connections: roomConnections.get(i)!,
      enemies,
      loot: loot?.length ? loot : undefined,
      trap,
      puzzle,
      description,
      isRevealed: i === 0, // Only entrance revealed at start
      isCleared: false,
      gridX: pos.x,
      gridY: pos.y,
      depth,
    });
  }

  // Generate dungeon name and intro
  const name = generateDungeonName(rng, theme);
  const flavorIntro = rngPick(rng, THEME_INTROS[theme]);

  return {
    seed,
    theme,
    size,
    playerLevel,
    rooms,
    entranceId: 0,
    bossRoomId,
    treasureRoomIds,
    puzzleRoomIds,
    criticalPath,
    name,
    flavorIntro,
  };
}

// ── API Functions ────────────────────────────────────────────────────────────

/** Get a specific room by ID */
export function getRoom(dungeon: Dungeon, roomId: number): DungeonRoom | null {
  return dungeon.rooms.find((r) => r.id === roomId) ?? null;
}

/** Move from one room to another in the given direction. Returns the new room or null if no exit. */
export function moveToRoom(dungeon: Dungeon, fromId: number, direction: Direction): DungeonRoom | null {
  const from = getRoom(dungeon, fromId);
  if (!from) return null;

  const targetId = from.connections[direction];
  if (targetId === undefined) return null;

  const target = getRoom(dungeon, targetId);
  if (target) {
    target.isRevealed = true;
  }
  return target;
}

/** Mark a room as cleared (enemies defeated, trap disarmed, puzzle solved) */
export function clearRoom(dungeon: Dungeon, roomId: number): void {
  const room = getRoom(dungeon, roomId);
  if (room) {
    room.isCleared = true;
  }
}

/** Get ASCII minimap of the dungeon. '#' = wall, '.' = room, '?' = unrevealed, 'E' = entrance, 'B' = boss */
export function getDungeonMap(dungeon: Dungeon): string[][] {
  // Find grid bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const room of dungeon.rooms) {
    minX = Math.min(minX, room.gridX);
    maxX = Math.max(maxX, room.gridX);
    minY = Math.min(minY, room.gridY);
    maxY = Math.max(maxY, room.gridY);
  }

  const width = (maxX - minX) * 2 + 3;
  const height = (maxY - minY) * 2 + 3;
  const map: string[][] = Array.from({ length: height }, () => Array(width).fill(" "));

  for (const room of dungeon.rooms) {
    const rx = (room.gridX - minX) * 2 + 1;
    const ry = (room.gridY - minY) * 2 + 1;

    if (!room.isRevealed) {
      map[ry][rx] = "?";
      continue;
    }

    // Room symbol
    if (room.id === dungeon.entranceId) map[ry][rx] = "E";
    else if (room.id === dungeon.bossRoomId) map[ry][rx] = "B";
    else if (room.type === "treasure") map[ry][rx] = "$";
    else if (room.type === "puzzle") map[ry][rx] = "P";
    else if (room.type === "shop") map[ry][rx] = "S";
    else if (room.type === "trap") map[ry][rx] = "!";
    else if (room.type === "shrine") map[ry][rx] = "*";
    else if (room.type === "portal") map[ry][rx] = "@";
    else if (room.isCleared) map[ry][rx] = ".";
    else map[ry][rx] = "#";

    // Draw connections
    if (room.connections.north !== undefined) {
      const target = getRoom(dungeon, room.connections.north);
      if (target?.isRevealed || room.isRevealed) map[ry - 1][rx] = "|";
    }
    if (room.connections.south !== undefined) {
      const target = getRoom(dungeon, room.connections.south);
      if (target?.isRevealed || room.isRevealed) map[ry + 1][rx] = "|";
    }
    if (room.connections.east !== undefined) {
      const target = getRoom(dungeon, room.connections.east);
      if (target?.isRevealed || room.isRevealed) map[ry][rx + 1] = "-";
    }
    if (room.connections.west !== undefined) {
      const target = getRoom(dungeon, room.connections.west);
      if (target?.isRevealed || room.isRevealed) map[ry][rx - 1] = "-";
    }
  }

  return map;
}

/** Get dungeon completion percentage (cleared rooms / total rooms) */
export function getCompletionPercent(dungeon: Dungeon): number {
  const cleared = dungeon.rooms.filter((r) => r.isCleared).length;
  return Math.round((cleared / dungeon.rooms.length) * 100);
}

/** Get all available exits from a room */
export function getAvailableExits(dungeon: Dungeon, roomId: number): { direction: Direction; targetId: number; revealed: boolean }[] {
  const room = getRoom(dungeon, roomId);
  if (!room) return [];

  const exits: { direction: Direction; targetId: number; revealed: boolean }[] = [];
  const dirs: Direction[] = ["north", "south", "east", "west"];

  for (const dir of dirs) {
    const targetId = room.connections[dir];
    if (targetId !== undefined) {
      const target = getRoom(dungeon, targetId);
      exits.push({ direction: dir, targetId, revealed: target?.isRevealed ?? false });
    }
  }

  return exits;
}

/** Reveal all rooms adjacent to the given room */
export function revealAdjacentRooms(dungeon: Dungeon, roomId: number): void {
  const exits = getAvailableExits(dungeon, roomId);
  for (const exit of exits) {
    const target = getRoom(dungeon, exit.targetId);
    if (target) target.isRevealed = true;
  }
}

/** Check if the dungeon boss has been defeated */
export function isBossDefeated(dungeon: Dungeon): boolean {
  const bossRoom = getRoom(dungeon, dungeon.bossRoomId);
  return bossRoom?.isCleared ?? false;
}

/** Get rooms on the critical path that haven't been cleared yet */
export function getRemainingCriticalPath(dungeon: Dungeon): number[] {
  return dungeon.criticalPath.filter((id) => {
    const room = getRoom(dungeon, id);
    return room && !room.isCleared;
  });
}

/** Handle portal room — picks a random other revealed room to teleport to */
export function resolvePortal(dungeon: Dungeon, portalRoomId: number, seed: number): number {
  const rng = mulberry32(seed + portalRoomId);
  const revealedRooms = dungeon.rooms.filter(
    (r) => r.isRevealed && r.id !== portalRoomId && r.type !== "portal"
  );
  if (revealedRooms.length === 0) return dungeon.entranceId;
  return rngPick(rng, revealedRooms).id;
}

/** Get shop inventory for a shop room (generated deterministically from seed + roomId) */
export function getShopInventory(dungeon: Dungeon, shopRoomId: number): Item[] {
  const rng = mulberry32(dungeon.seed + shopRoomId * 31);
  const items: Item[] = [];
  const count = rngInt(rng, 4, 8);

  for (let i = 0; i < count; i++) {
    const rarityRoll = rng();
    let rarity: LootRarity;
    if (rarityRoll < 0.4) rarity = "common";
    else if (rarityRoll < 0.7) rarity = "uncommon";
    else if (rarityRoll < 0.9) rarity = "rare";
    else rarity = "epic";

    const item = generateItem(rng, rarity, dungeon.theme, dungeon.playerLevel);
    // Mark up shop prices
    item.value = Math.floor(item.value * 1.5);
    items.push(item);
  }

  return items;
}

/** Get shrine effect for a shrine room (deterministic from seed + roomId) */
export function getShrineEffect(dungeon: Dungeon, shrineRoomId: number): {
  name: string;
  description: string;
  wisCheck: number;
  blessingEffect: string;
  curseEffect: string;
} {
  const rng = mulberry32(dungeon.seed + shrineRoomId * 17);
  const shrines = [
    {
      name: "Shrine of Fortitude",
      description: "A stone altar radiates warmth. Kneeling before it fills you with either strength or weakness.",
      blessingEffect: "+2 CON for the remainder of this dungeon.",
      curseEffect: "-1 CON for the remainder of this dungeon.",
    },
    {
      name: "Shrine of Wisdom",
      description: "Crystal formations hum with ancient knowledge. Touching them grants insight — or madness.",
      blessingEffect: "+2 WIS for the remainder of this dungeon.",
      curseEffect: "Confused for 3 rounds (random actions).",
    },
    {
      name: "Shrine of Valor",
      description: "A warrior's monument thrums with battle-spirit. The brave are rewarded. The unworthy are punished.",
      blessingEffect: "+2 STR for the remainder of this dungeon.",
      curseEffect: "Frightened of the next enemy encountered.",
    },
    {
      name: "Shrine of Fortune",
      description: "A grinning statue holds a coin in each hand. The right hand gives. The left hand takes.",
      blessingEffect: "Next loot drop is upgraded one rarity tier.",
      curseEffect: "Lose 50% of carried gold.",
    },
    {
      name: "Shrine of Restoration",
      description: "A basin of clear water that glows with inner light. Drinking may heal — or harm.",
      blessingEffect: "Restore full HP.",
      curseEffect: "Poisoned — lose 25% HP.",
    },
    {
      name: "Shrine of Shadows",
      description: "A dark altar that absorbs light. Something whispers from behind the veil.",
      blessingEffect: "+2 DEX and advantage on stealth for this dungeon.",
      curseEffect: "Cursed: disadvantage on perception checks in this dungeon.",
    },
  ];

  const shrine = rngPick(rng, shrines);
  const wisCheck = 10 + Math.floor(dungeon.playerLevel * 0.8) + rngInt(rng, -2, 2);

  return {
    ...shrine,
    wisCheck: Math.max(8, Math.min(20, wisCheck)),
  };
}
