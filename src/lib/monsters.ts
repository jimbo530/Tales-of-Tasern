export type MonsterSize = "tiny" | "small" | "medium" | "large";
export type MonsterType =
  | "beast"
  | "humanoid"
  | "undead"
  | "vermin"
  | "magical_beast"
  | "aberration"
  | "fey"
  | "plant"
  | "dragon"
  | "swarm";

export type Monster = {
  id: string;
  name: string;
  cr: number;
  size: MonsterSize;
  type: MonsterType;
  hp: number;
  ac: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  attack: string;
  damage: string;
  speed: number;
  special?: string;
  terrain: string[];
  description: string;
};

// ---------------------------------------------------------------------------
// All ability scores are CONVERTED from D&D originals: score - 10, minimum 1.
// ---------------------------------------------------------------------------

export const MONSTERS: Monster[] = [
  // =======================================================================
  // CR 0.25 (1/4)
  // =======================================================================
  {
    id: "kobold",
    name: "Kobold",
    cr: 0.25,
    size: "small",
    type: "humanoid",
    hp: 4,
    ac: 15,
    str: 1,
    dex: 3,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Spear +1 (1d6-1)",
    damage: "1d6-1",
    speed: 30,
    terrain: ["forest", "underground"],
    description: "A scaly reptilian ambusher.",
  },
  {
    id: "tiny_monstrous_spider",
    name: "Tiny Monstrous Spider",
    cr: 0.25,
    size: "tiny",
    type: "vermin",
    hp: 2,
    ac: 15,
    str: 1,
    dex: 7,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Bite +5 (1d3-4 + poison)",
    damage: "1d3-4",
    speed: 20,
    special: "Poison",
    terrain: ["forest"],
    description: "A palm-sized spider with venomous fangs.",
  },

  // =======================================================================
  // CR 0.33 (1/3)
  // =======================================================================
  {
    id: "dire_rat",
    name: "Dire Rat",
    cr: 0.33,
    size: "small",
    type: "beast",
    hp: 5,
    ac: 15,
    str: 1,
    dex: 7,
    con: 2,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Bite +4 (1d4 + disease)",
    damage: "1d4",
    speed: 40,
    special: "Disease",
    terrain: ["farm", "road", "town", "underground"],
    description: "A dog-sized rat with filthy teeth.",
  },
  {
    id: "goblin",
    name: "Goblin",
    cr: 0.33,
    size: "small",
    type: "humanoid",
    hp: 5,
    ac: 15,
    str: 1,
    dex: 3,
    con: 2,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Morningstar +2 (1d6)",
    damage: "1d6",
    speed: 30,
    terrain: ["plains", "forest", "road"],
    description: "A sneering goblin warrior.",
  },
  {
    id: "giant_fire_beetle",
    name: "Giant Fire Beetle",
    cr: 0.33,
    size: "small",
    type: "vermin",
    hp: 4,
    ac: 16,
    str: 1,
    dex: 1,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Bite +1 (2d4)",
    damage: "2d4",
    speed: 30,
    terrain: ["plains", "farm"],
    description: "A beetle with glowing glands.",
  },

  // =======================================================================
  // CR 0.5 (1/2)
  // =======================================================================
  {
    id: "orc",
    name: "Orc",
    cr: 0.5,
    size: "medium",
    type: "humanoid",
    hp: 5,
    ac: 13,
    str: 7,
    dex: 1,
    con: 2,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Falchion +4 (2d4+4)",
    damage: "2d4+4",
    speed: 30,
    terrain: ["plains", "road", "forest"],
    description: "A tusked orc raider.",
  },
  {
    id: "hobgoblin",
    name: "Hobgoblin",
    cr: 0.5,
    size: "medium",
    type: "humanoid",
    hp: 6,
    ac: 15,
    str: 3,
    dex: 3,
    con: 4,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Longsword +2 (1d8+1)",
    damage: "1d8+1",
    speed: 30,
    terrain: ["plains", "road"],
    description: "A disciplined hobgoblin soldier.",
  },
  {
    id: "zombie",
    name: "Zombie",
    cr: 0.5,
    size: "medium",
    type: "undead",
    hp: 16,
    ac: 11,
    str: 2,
    dex: 1,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Slam +2 (1d6+1)",
    damage: "1d6+1",
    speed: 30,
    terrain: ["road", "farm", "forest", "plains"],
    description: "A shambling corpse.",
  },
  {
    id: "skeleton",
    name: "Skeleton",
    cr: 0.5,
    size: "medium",
    type: "undead",
    hp: 6,
    ac: 15,
    str: 3,
    dex: 3,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Scimitar +1 (1d6+1)",
    damage: "1d6+1",
    speed: 30,
    special: "DR 5/bludgeoning",
    terrain: ["road", "farm", "forest", "plains", "town", "swamp", "mountain", "desert", "underground"],
    description: "Bones held together by dark magic.",
  },
  {
    id: "stirge",
    name: "Stirge",
    cr: 0.5,
    size: "tiny",
    type: "magical_beast",
    hp: 5,
    ac: 16,
    str: 1,
    dex: 9,
    con: 1,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Touch +7 (attach, blood drain)",
    damage: "1d3",
    speed: 10,
    special: "Attach, blood drain",
    terrain: ["farm", "forest", "swamp"],
    description: "A bat-like bloodsucker.",
  },
  {
    id: "small_spider",
    name: "Small Spider",
    cr: 0.5,
    size: "small",
    type: "vermin",
    hp: 4,
    ac: 14,
    str: 1,
    dex: 7,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Bite +4 (1d4-2 + poison)",
    damage: "1d4-2",
    speed: 30,
    special: "Poison",
    terrain: ["forest"],
    description: "A cat-sized spider.",
  },
  {
    id: "badger",
    name: "Badger",
    cr: 0.5,
    size: "small",
    type: "beast",
    hp: 6,
    ac: 15,
    str: 1,
    dex: 7,
    con: 5,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Claw +4 (1d2-1)",
    damage: "1d2-1",
    speed: 30,
    special: "Rage",
    terrain: ["forest", "plains"],
    description: "A fierce burrowing mustelid.",
  },

  // =======================================================================
  // CR 1
  // =======================================================================
  {
    id: "wolf",
    name: "Wolf",
    cr: 1,
    size: "medium",
    type: "beast",
    hp: 13,
    ac: 14,
    str: 3,
    dex: 5,
    con: 5,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Bite +3 (1d6+1)",
    damage: "1d6+1",
    speed: 50,
    special: "Trip",
    terrain: ["forest", "plains", "farm"],
    description: "A snarling grey wolf.",
  },
  {
    id: "gnoll",
    name: "Gnoll",
    cr: 1,
    size: "large",
    type: "humanoid",
    hp: 11,
    ac: 15,
    str: 5,
    dex: 1,
    con: 3,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Battleaxe +3 (1d8+2)",
    damage: "1d8+2",
    speed: 30,
    terrain: ["plains", "road"],
    description: "A hyena-headed marauder.",
  },
  {
    id: "medium_spider",
    name: "Medium Spider",
    cr: 1,
    size: "medium",
    type: "vermin",
    hp: 11,
    ac: 14,
    str: 1,
    dex: 7,
    con: 2,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Bite +4 (1d6 + poison)",
    damage: "1d6",
    speed: 30,
    special: "Poison",
    terrain: ["forest"],
    description: "A spider the size of a dog.",
  },
  {
    id: "krenshar",
    name: "Krenshar",
    cr: 1,
    size: "medium",
    type: "magical_beast",
    hp: 11,
    ac: 15,
    str: 1,
    dex: 4,
    con: 1,
    int: 1,
    wis: 2,
    cha: 3,
    attack: "Bite +2 (1d6)",
    damage: "1d6",
    speed: 40,
    special: "Scare (Will DC 13)",
    terrain: ["forest"],
    description: "A cat-like beast that peels back its face to frighten prey.",
  },
  {
    id: "giant_ant_worker",
    name: "Giant Ant Worker",
    cr: 1,
    size: "medium",
    type: "vermin",
    hp: 9,
    ac: 17,
    str: 1,
    dex: 1,
    con: 1,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Bite +1 (1d6)",
    damage: "1d6",
    speed: 50,
    terrain: ["plains", "farm"],
    description: "A horse-sized ant.",
  },
  {
    id: "giant_bee",
    name: "Giant Bee",
    cr: 1,
    size: "medium",
    type: "vermin",
    hp: 13,
    ac: 14,
    str: 1,
    dex: 4,
    con: 1,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Sting +2 (1d4 + poison)",
    damage: "1d4",
    speed: 20,
    special: "Poison",
    terrain: ["plains", "farm", "forest"],
    description: "A massive bee with a lethal stinger.",
  },
  {
    id: "troglodyte",
    name: "Troglodyte",
    cr: 1,
    size: "medium",
    type: "humanoid",
    hp: 13,
    ac: 15,
    str: 1,
    dex: 1,
    con: 4,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Club +1 (1d6)",
    damage: "1d6",
    speed: 30,
    special: "Stench (Fort DC 13)",
    terrain: ["underground", "forest"],
    description: "A stinking reptilian cave dweller.",
  },

  // =======================================================================
  // CR 2
  // =======================================================================
  {
    id: "bugbear",
    name: "Bugbear",
    cr: 2,
    size: "medium",
    type: "humanoid",
    hp: 16,
    ac: 17,
    str: 5,
    dex: 2,
    con: 3,
    int: 1,
    wis: 1,
    cha: 1,
    attack: "Morningstar +5 (1d8+2)",
    damage: "1d8+2",
    speed: 30,
    terrain: ["forest", "road", "mountain"],
    description: "A hulking goblinoid brute.",
  },
  {
    id: "worg",
    name: "Worg",
    cr: 2,
    size: "large",
    type: "magical_beast",
    hp: 30,
    ac: 14,
    str: 7,
    dex: 5,
    con: 5,
    int: 1,
    wis: 4,
    cha: 1,
    attack: "Bite +7 (1d6+4)",
    damage: "1d6+4",
    speed: 50,
    special: "Trip",
    terrain: ["plains", "forest"],
    description: "An evil, intelligent wolf the size of a horse.",
  },
  {
    id: "boar",
    name: "Boar",
    cr: 2,
    size: "medium",
    type: "beast",
    hp: 25,
    ac: 16,
    str: 5,
    dex: 1,
    con: 7,
    int: 1,
    wis: 3,
    cha: 1,
    attack: "Gore +4 (1d8+3)",
    damage: "1d8+3",
    speed: 40,
    special: "Ferocity (fights while dying)",
    terrain: ["forest", "farm"],
    description: "A massive, ill-tempered wild pig.",
  },
  {
    id: "dire_weasel",
    name: "Dire Weasel",
    cr: 2,
    size: "medium",
    type: "beast",
    hp: 13,
    ac: 16,
    str: 4,
    dex: 9,
    con: 1,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Bite +6 (1d6+3)",
    damage: "1d6+3",
    speed: 40,
    special: "Blood drain",
    terrain: ["forest", "plains"],
    description: "A weasel the length of a man.",
  },
  {
    id: "giant_ant_soldier",
    name: "Giant Ant Soldier",
    cr: 2,
    size: "medium",
    type: "vermin",
    hp: 11,
    ac: 17,
    str: 4,
    dex: 1,
    con: 3,
    int: 1,
    wis: 3,
    cha: 1,
    attack: "Bite +3 (2d4+3)",
    damage: "2d4+3",
    speed: 50,
    special: "Acid sting",
    terrain: ["plains", "farm"],
    description: "An armored ant warrior as big as a pony.",
  },
  {
    id: "rat_swarm",
    name: "Rat Swarm",
    cr: 2,
    size: "tiny",
    type: "swarm",
    hp: 13,
    ac: 14,
    str: 1,
    dex: 5,
    con: 1,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Swarm (1d6 + disease)",
    damage: "1d6",
    speed: 15,
    special: "Disease, distraction",
    terrain: ["town", "farm", "road", "underground"],
    description: "A tide of squeaking, biting rats.",
  },

  // =======================================================================
  // CR 3
  // =======================================================================
  {
    id: "dire_wolf",
    name: "Dire Wolf",
    cr: 3,
    size: "large",
    type: "beast",
    hp: 45,
    ac: 14,
    str: 15,
    dex: 5,
    con: 7,
    int: 1,
    wis: 2,
    cha: 1,
    attack: "Bite +11 (1d8+10)",
    damage: "1d8+10",
    speed: 50,
    special: "Trip",
    terrain: ["forest", "plains"],
    description: "A wolf the size of a horse with jaws like a bear trap.",
  },
  {
    id: "wight",
    name: "Wight",
    cr: 3,
    size: "medium",
    type: "undead",
    hp: 26,
    ac: 15,
    str: 2,
    dex: 2,
    con: 1,
    int: 1,
    wis: 3,
    cha: 5,
    attack: "Slam +3 (1d4+1 + energy drain)",
    damage: "1d4+1",
    speed: 30,
    special: "Energy drain, create spawn",
    terrain: ["road", "farm", "forest", "plains", "town", "swamp", "mountain", "desert", "underground"],
    description: "A hateful undead that drains the life from the living.",
  },
  {
    id: "ankheg",
    name: "Ankheg",
    cr: 3,
    size: "large",
    type: "magical_beast",
    hp: 28,
    ac: 18,
    str: 11,
    dex: 1,
    con: 7,
    int: 1,
    wis: 3,
    cha: 1,
    attack: "Bite +7 (2d6+7 + 1d4 acid)",
    damage: "2d6+7",
    speed: 30,
    special: "Spit acid",
    terrain: ["farm", "plains"],
    description: "A burrowing insectoid that lurks beneath farmland.",
  },
  {
    id: "cockatrice",
    name: "Cockatrice",
    cr: 3,
    size: "small",
    type: "magical_beast",
    hp: 27,
    ac: 14,
    str: 1,
    dex: 7,
    con: 1,
    int: 1,
    wis: 3,
    cha: 1,
    attack: "Bite +9 (1d4-2 + petrification)",
    damage: "1d4-2",
    speed: 20,
    special: "Petrification (Fort DC 12)",
    terrain: ["plains", "farm"],
    description: "A rooster-serpent whose bite turns flesh to stone.",
  },
  {
    id: "ettercap",
    name: "Ettercap",
    cr: 3,
    size: "medium",
    type: "aberration",
    hp: 27,
    ac: 14,
    str: 4,
    dex: 7,
    con: 3,
    int: 1,
    wis: 5,
    cha: 1,
    attack: "Bite +5 (1d8+2 + poison)",
    damage: "1d8+2",
    speed: 30,
    special: "Web, poison",
    terrain: ["forest"],
    description: "A hideous spider-taming humanoid.",
  },
  {
    id: "doppelganger",
    name: "Doppelganger",
    cr: 3,
    size: "medium",
    type: "aberration",
    hp: 22,
    ac: 15,
    str: 2,
    dex: 3,
    con: 2,
    int: 3,
    wis: 4,
    cha: 3,
    attack: "Slam +5 (1d6+1)",
    damage: "1d6+1",
    speed: 30,
    special: "Change shape, detect thoughts",
    terrain: ["town", "road"],
    description: "It could be anyone. It could be you.",
  },
  {
    id: "assassin_vine",
    name: "Assassin Vine",
    cr: 3,
    size: "large",
    type: "plant",
    hp: 30,
    ac: 15,
    str: 10,
    dex: 1,
    con: 6,
    int: 1,
    wis: 3,
    cha: 1,
    attack: "Slam +7 (1d6+7)",
    damage: "1d6+7",
    speed: 5,
    special: "Constrict, entangle, camouflage",
    terrain: ["forest"],
    description: "A predatory plant that strangles the unwary.",
  },

  // =======================================================================
  // CR 1 — Additional terrain coverage
  // =======================================================================
  {
    id: "hyena", name: "Hyena", cr: 1, size: "medium", type: "beast",
    hp: 13, ac: 14, str: 4, dex: 5, con: 5, int: 1, wis: 3, cha: 1,
    attack: "Bite +3 (1d6+3)", damage: "1d6+3", speed: 50,
    special: "Trip",
    terrain: ["desert", "plains"],
    description: "A cackling scavenger that hunts in packs.",
  },
  {
    id: "monstrous_scorpion_med", name: "Giant Scorpion", cr: 1, size: "medium", type: "vermin",
    hp: 13, ac: 14, str: 3, dex: 1, con: 4, int: 1, wis: 1, cha: 1,
    attack: "Claws +2 (1d3+1), Sting +0 (1d3 + poison)", damage: "1d3+1", speed: 40,
    special: "Poison (Fort DC 12)",
    terrain: ["desert"],
    description: "A horse-sized scorpion with dripping stingers.",
  },
  {
    id: "lizardfolk", name: "Lizardfolk", cr: 1, size: "medium", type: "humanoid",
    hp: 11, ac: 15, str: 3, dex: 1, con: 3, int: 1, wis: 1, cha: 1,
    attack: "Club +2 (1d6+1), Bite +0 (1d4)", damage: "1d6+1", speed: 30,
    terrain: ["swamp"],
    description: "A scaled reptilian wielding a crude club.",
  },
  {
    id: "constrictor_snake", name: "Constrictor Snake", cr: 1, size: "medium", type: "beast",
    hp: 13, ac: 12, str: 5, dex: 7, con: 3, int: 1, wis: 2, cha: 1,
    attack: "Bite +3 (1d3+4), Constrict +7 (1d3+4)", damage: "1d3+4", speed: 20,
    special: "Constrict, improved grab",
    terrain: ["jungle", "swamp"],
    description: "A thick-bodied snake that crushes its prey.",
  },
  {
    id: "giant_centipede", name: "Giant Centipede", cr: 1, size: "medium", type: "vermin",
    hp: 5, ac: 14, str: 1, dex: 5, con: 1, int: 1, wis: 1, cha: 1,
    attack: "Bite +2 (1d6-1 + poison)", damage: "1d6-1", speed: 40,
    special: "Poison (Fort DC 13)",
    terrain: ["jungle", "underground", "swamp"],
    description: "A three-foot long centipede with venomous mandibles.",
  },
  {
    id: "crocodile", name: "Crocodile", cr: 1, size: "medium", type: "beast",
    hp: 22, ac: 15, str: 9, dex: 2, con: 7, int: 1, wis: 2, cha: 1,
    attack: "Bite +6 (1d8+6), Tail +1 (1d12+3)", damage: "1d8+6", speed: 20,
    special: "Improved grab",
    terrain: ["swamp", "coast"],
    description: "A patient predator that lurks just below the waterline.",
  },

  // =======================================================================
  // CR 2 — Additional terrain coverage
  // =======================================================================
  {
    id: "ghoul", name: "Ghoul", cr: 2, size: "medium", type: "undead",
    hp: 13, ac: 14, str: 3, dex: 5, con: 1, int: 3, wis: 4, cha: 1,
    attack: "Bite +3 (1d6+1 + paralysis), Claws +0 (1d3 + paralysis)", damage: "1d6+1", speed: 30,
    special: "Paralysis (Fort DC 12, 1d4+1 rounds)",
    terrain: ["underground", "swamp", "road", "forest"],
    description: "A hunched corpse-eater with paralyzing claws.",
  },
  {
    id: "hippogriff", name: "Hippogriff", cr: 2, size: "large", type: "magical_beast",
    hp: 25, ac: 15, str: 6, dex: 5, con: 4, int: 1, wis: 4, cha: 1,
    attack: "Claws +5 (1d4+4), Bite +0 (1d8+2)", damage: "1d4+4", speed: 50,
    terrain: ["mountain", "plains"],
    description: "A majestic eagle-horse that nests on high cliffs.",
  },
  {
    id: "sahuagin", name: "Sahuagin", cr: 2, size: "medium", type: "humanoid",
    hp: 11, ac: 16, str: 4, dex: 3, con: 2, int: 4, wis: 3, cha: 1,
    attack: "Trident +4 (1d8+3), Bite +1 (1d4+1)", damage: "1d8+3", speed: 30,
    special: "Blood frenzy, speak with sharks",
    terrain: ["coast"],
    description: "A shark-like sea devil that raids coastal villages.",
  },
  {
    id: "dire_ape", name: "Dire Ape", cr: 2, size: "large", type: "beast",
    hp: 35, ac: 15, str: 12, dex: 5, con: 4, int: 1, wis: 2, cha: 1,
    attack: "Claws +12 (1d6+7), Bite +7 (1d8+3)", damage: "1d6+7", speed: 30,
    special: "Rend 2d6+10",
    terrain: ["jungle", "forest"],
    description: "A massive silverback ape enraged by intruders.",
  },

  // =======================================================================
  // CR 3 — Additional terrain coverage
  // =======================================================================
  {
    id: "monstrous_scorpion_lg", name: "Huge Scorpion", cr: 3, size: "large", type: "vermin",
    hp: 45, ac: 16, str: 9, dex: 1, con: 4, int: 1, wis: 1, cha: 1,
    attack: "2 Claws +6 (1d6+4), Sting +1 (1d6+2 + poison)", damage: "1d6+4", speed: 50,
    special: "Poison (Fort DC 14), Improved grab",
    terrain: ["desert"],
    description: "A scorpion as large as a wagon, pincers wide as shields.",
  },
  {
    id: "ghast", name: "Ghast", cr: 3, size: "medium", type: "undead",
    hp: 29, ac: 17, str: 3, dex: 7, con: 1, int: 3, wis: 4, cha: 1,
    attack: "Bite +5 (1d8+1 + paralysis), Claws +3 (1d4 + paralysis)", damage: "1d8+1", speed: 30,
    special: "Paralysis (Fort DC 15), Stench",
    terrain: ["underground", "swamp", "forest"],
    description: "A more powerful ghoul surrounded by a sickening stench.",
  },
  {
    id: "manticore", name: "Manticore", cr: 3, size: "large", type: "magical_beast",
    hp: 57, ac: 17, str: 10, dex: 2, con: 9, int: 1, wis: 2, cha: 1,
    attack: "Claws +10 (2d4+5), Bite +8 (1d8+2)", damage: "2d4+5", speed: 30,
    special: "Tail spikes (6/day, 1d8+2, range 180ft)",
    terrain: ["mountain", "desert"],
    description: "A lion-bodied horror with a human face and spiked tail.",
  },
  {
    id: "green_hag", name: "Green Hag", cr: 5, size: "medium", type: "fey",
    hp: 49, ac: 22, str: 15, dex: 2, con: 2, int: 3, wis: 3, cha: 4,
    attack: "Claw +13 (1d4+7)", damage: "1d4+7", speed: 30,
    special: "Weakness aura, mimicry, invisibility",
    terrain: ["swamp"],
    description: "A haggard crone of terrible power lurking in the marshes.",
  },
  {
    id: "giant_constrictor", name: "Giant Constrictor", cr: 3, size: "large", type: "beast",
    hp: 45, ac: 12, str: 15, dex: 7, con: 3, int: 1, wis: 2, cha: 1,
    attack: "Bite +10 (1d8+10), Constrict +10 (1d8+10)", damage: "1d8+10", speed: 20,
    special: "Constrict, improved grab",
    terrain: ["jungle", "swamp"],
    description: "A massive snake that can crush a horse.",
  },

  // =======================================================================
  // CR 4
  // =======================================================================
  {
    id: "owlbear", name: "Owlbear", cr: 4, size: "large", type: "magical_beast",
    hp: 52, ac: 15, str: 11, dex: 2, con: 11, int: 1, wis: 2, cha: 1,
    attack: "Claws +9 (1d6+5), Bite +4 (1d8+2)", damage: "1d6+5", speed: 30,
    special: "Improved grab",
    terrain: ["forest"],
    description: "A bear with an owl's head, driven mad by hunger.",
  },
  {
    id: "displacer_beast", name: "Displacer Beast", cr: 4, size: "large", type: "magical_beast",
    hp: 51, ac: 16, str: 8, dex: 5, con: 6, int: 1, wis: 2, cha: 1,
    attack: "Tentacles +9 (1d6+4)", damage: "1d6+4", speed: 40,
    special: "Displacement (50% miss chance)",
    terrain: ["forest", "plains"],
    description: "A six-legged panther whose image shifts, making it nearly impossible to hit.",
  },
  {
    id: "griffon", name: "Griffon", cr: 4, size: "large", type: "magical_beast",
    hp: 59, ac: 17, str: 8, dex: 5, con: 6, int: 1, wis: 3, cha: 1,
    attack: "Bite +8 (2d6+4), Claws +3 (1d4+2)", damage: "2d6+4", speed: 30,
    special: "Pounce, rake 1d6+2",
    terrain: ["mountain"],
    description: "A lion-eagle that fiercely guards its mountain aerie.",
  },
  {
    id: "gargoyle", name: "Gargoyle", cr: 4, size: "medium", type: "magical_beast",
    hp: 37, ac: 16, str: 5, dex: 4, con: 8, int: 1, wis: 1, cha: 1,
    attack: "Claw +6 (1d4+2), Bite +4 (1d6+1)", damage: "1d4+2", speed: 40,
    special: "DR 10/magic, freeze (poses as statue)",
    terrain: ["mountain", "underground"],
    description: "A stony winged demon that hides among ancient ruins.",
  },
  {
    id: "otyugh", name: "Otyugh", cr: 4, size: "large", type: "aberration",
    hp: 36, ac: 17, str: 8, dex: 1, con: 8, int: 1, wis: 2, cha: 1,
    attack: "Tentacle +4 (1d6), Bite +2 (1d4)", damage: "1d6", speed: 20,
    special: "Constrict, disease (filth fever)",
    terrain: ["underground", "swamp"],
    description: "A foul tentacled thing that dwells in refuse and offal.",
  },
  {
    id: "ogre", name: "Ogre", cr: 4, size: "large", type: "humanoid",
    hp: 29, ac: 16, str: 11, dex: 1, con: 5, int: 1, wis: 1, cha: 1,
    attack: "Greatclub +8 (2d8+7)", damage: "2d8+7", speed: 30,
    terrain: ["mountain", "forest", "plains"],
    description: "A dim-witted brute towering nine feet tall.",
  },
  {
    id: "wraith", name: "Wraith", cr: 4, size: "medium", type: "undead",
    hp: 32, ac: 15, str: 1, dex: 6, con: 1, int: 4, wis: 4, cha: 5,
    attack: "Incorporeal touch +5 (1d4 + 1d6 CON drain)", damage: "1d4", speed: 30,
    special: "Incorporeal, CON drain, create spawn, daylight powerlessness",
    terrain: ["underground", "swamp", "mountain"],
    description: "A shadow of pure malice that drains the life from the living.",
  },
  {
    id: "gray_ooze", name: "Gray Ooze", cr: 4, size: "medium", type: "aberration",
    hp: 31, ac: 5, str: 2, dex: 1, con: 1, int: 1, wis: 1, cha: 1,
    attack: "Slam +3 (1d6+1 + 1d6 acid)", damage: "1d6+1", speed: 10,
    special: "Acid (dissolves metal and stone), improved grab",
    terrain: ["underground", "swamp"],
    description: "A puddle of living ooze that dissolves whatever it touches.",
  },

  // =======================================================================
  // CR 5
  // =======================================================================
  {
    id: "troll", name: "Troll", cr: 5, size: "large", type: "humanoid",
    hp: 63, ac: 16, str: 13, dex: 4, con: 13, int: 1, wis: 1, cha: 1,
    attack: "Claw +9 (1d6+6), Bite +4 (1d6+3)", damage: "1d6+6", speed: 30,
    special: "Regeneration 5 (fire/acid stops), Rend 2d6+9",
    terrain: ["swamp", "forest", "mountain"],
    description: "A gangly green giant that heals from any wound not burned or dissolved.",
  },
  {
    id: "shambling_mound", name: "Shambling Mound", cr: 5, size: "large", type: "plant",
    hp: 60, ac: 20, str: 11, dex: 1, con: 7, int: 1, wis: 1, cha: 1,
    attack: "Slam +11 (2d6+5)", damage: "2d6+5", speed: 20,
    special: "Constrict, immunity to electricity (heals it), improved grab",
    terrain: ["swamp", "jungle"],
    description: "A walking heap of rot and vegetation.",
  },
  {
    id: "mummy", name: "Mummy", cr: 5, size: "medium", type: "undead",
    hp: 55, ac: 20, str: 14, dex: 1, con: 1, int: 1, wis: 4, cha: 5,
    attack: "Slam +11 (1d6+10 + mummy rot)", damage: "1d6+10", speed: 20,
    special: "DR 5/-, fire vulnerable, mummy rot, despair (Will DC 16 or paralyzed with fear)",
    terrain: ["desert", "underground"],
    description: "A preserved corpse wrapped in ancient linen, animated by dark curses.",
  },
  {
    id: "chimera", name: "Chimera", cr: 5, size: "large", type: "magical_beast",
    hp: 76, ac: 19, str: 9, dex: 3, con: 7, int: 1, wis: 3, cha: 1,
    attack: "Bite +10 (2d6+4), Bite +10 (1d8+4), Gore +10 (1d8+4)", damage: "2d6+4", speed: 30,
    special: "Breath weapon (fire, 3d8, Ref DC 17)",
    terrain: ["mountain", "desert"],
    description: "A three-headed monster — lion, dragon, and goat — that breathes fire.",
  },
  {
    id: "wyvern", name: "Wyvern", cr: 5, size: "large", type: "dragon",
    hp: 59, ac: 18, str: 9, dex: 2, con: 5, int: 1, wis: 2, cha: 1,
    attack: "Sting +10 (1d6+4 + poison), Bite +8 (2d8+4), Wing +8 (1d8+2)", damage: "1d6+4", speed: 20,
    special: "Poison (Fort DC 17, 2d6 CON/2d6 CON)",
    terrain: ["mountain", "coast"],
    description: "A dragon-kin with a lethal poisoned tail stinger.",
  },
  {
    id: "girallon", name: "Girallon", cr: 5, size: "large", type: "magical_beast",
    hp: 58, ac: 16, str: 12, dex: 5, con: 4, int: 1, wis: 2, cha: 1,
    attack: "4 Claws +12 (1d4+7), Bite +7 (1d8+3)", damage: "1d4+7", speed: 40,
    special: "Rend 2d4+10",
    terrain: ["jungle"],
    description: "A four-armed great ape of terrifying strength.",
  },

  // =======================================================================
  // CR 6
  // =======================================================================
  {
    id: "dire_bear", name: "Dire Bear", cr: 6, size: "large", type: "beast",
    hp: 105, ac: 17, str: 17, dex: 3, con: 9, int: 1, wis: 2, cha: 1,
    attack: "Claw +19 (2d4+10), Bite +13 (2d8+5)", damage: "2d4+10", speed: 40,
    special: "Improved grab",
    terrain: ["forest", "mountain"],
    description: "A bear the size of an elephant, scarred and savage.",
  },
  {
    id: "lamia", name: "Lamia", cr: 6, size: "large", type: "magical_beast",
    hp: 58, ac: 18, str: 8, dex: 3, con: 2, int: 3, wis: 5, cha: 2,
    attack: "Touch +11 (1d4 WIS drain), Claws +6 (1d4+2)", damage: "1d4+2", speed: 60,
    special: "Wisdom drain, disguise self, charm monster",
    terrain: ["desert"],
    description: "A human-torso creature on a beast's body that drains minds.",
  },
  {
    id: "hydra_5head", name: "Five-Headed Hydra", cr: 6, size: "large", type: "magical_beast",
    hp: 52, ac: 15, str: 7, dex: 2, con: 10, int: 1, wis: 1, cha: 1,
    attack: "5 Bites +6 (1d10+3)", damage: "1d10+3", speed: 20,
    special: "Regenerate heads (fire/acid prevents)",
    terrain: ["swamp"],
    description: "A multi-headed serpent — cut one off and two grow back.",
  },
  {
    id: "ogre_mage", name: "Ogre Mage", cr: 6, size: "large", type: "humanoid",
    hp: 37, ac: 18, str: 11, dex: 1, con: 7, int: 4, wis: 4, cha: 7,
    attack: "Greatsword +10 (2d8+7)", damage: "2d8+7", speed: 30,
    special: "Cone of cold, fly, invisibility, charm person, gaseous form, regeneration 5",
    terrain: ["mountain"],
    description: "A towering blue-skinned giant mage with terrible cunning.",
  },

  // =======================================================================
  // CR 7
  // =======================================================================
  {
    id: "hill_giant", name: "Hill Giant", cr: 7, size: "large", type: "humanoid",
    hp: 102, ac: 20, str: 15, dex: 1, con: 9, int: 1, wis: 1, cha: 1,
    attack: "Greatclub +16 (2d8+10)", damage: "2d8+10", speed: 30,
    special: "Rock throwing (2d6+7, range 120ft)",
    terrain: ["mountain", "plains"],
    description: "A brutish giant that hurls boulders and devours livestock.",
  },
  {
    id: "dire_tiger", name: "Dire Tiger", cr: 7, size: "large", type: "beast",
    hp: 120, ac: 17, str: 17, dex: 5, con: 7, int: 1, wis: 2, cha: 1,
    attack: "Claw +18 (2d4+8), Bite +13 (2d6+4)", damage: "2d4+8", speed: 40,
    special: "Pounce, improved grab, rake 2d4+4",
    terrain: ["jungle", "forest"],
    description: "A tiger the size of a wagon, apex predator of the deep wilds.",
  },
  {
    id: "stone_giant", name: "Stone Giant", cr: 7, size: "large", type: "humanoid",
    hp: 119, ac: 25, str: 17, dex: 5, con: 9, int: 1, wis: 2, cha: 1,
    attack: "Greatclub +17 (2d8+12)", damage: "2d8+12", speed: 30,
    special: "Rock throwing (2d8+12, range 180ft), rock catching",
    terrain: ["mountain"],
    description: "A granite-skinned giant that blends with the cliffs it calls home.",
  },
  {
    id: "spectre", name: "Spectre", cr: 7, size: "medium", type: "undead",
    hp: 45, ac: 15, str: 1, dex: 6, con: 1, int: 4, wis: 4, cha: 5,
    attack: "Incorporeal touch +6 (1d8 + 2 negative levels)", damage: "1d8", speed: 40,
    special: "Energy drain, create spawn, incorporeal, sunlight powerlessness, unnatural aura",
    terrain: ["underground", "swamp"],
    description: "A fearsome shade that drains the very life essence of the living.",
  },

  // =======================================================================
  // CR 8
  // =======================================================================
  {
    id: "mind_flayer", name: "Mind Flayer", cr: 8, size: "medium", type: "aberration",
    hp: 44, ac: 15, str: 2, dex: 4, con: 2, int: 9, wis: 7, cha: 7,
    attack: "Tentacle +8 (1d4+1)", damage: "1d4+1", speed: 30,
    special: "Mind blast (60ft cone, Will DC 17 or stunned 3d4 rounds), extract brain, spell resistance 25",
    terrain: ["underground"],
    description: "An alien intellect with face-tentacles that feeds on brains.",
  },
  {
    id: "frost_giant", name: "Frost Giant", cr: 8, size: "large", type: "humanoid",
    hp: 133, ac: 21, str: 19, dex: 1, con: 11, int: 1, wis: 4, cha: 1,
    attack: "Greataxe +18 (3d6+13)", damage: "3d6+13", speed: 40,
    special: "Rock throwing (2d6+9, range 120ft), cold immunity, fire vulnerability",
    terrain: ["mountain"],
    description: "A blue-skinned titan draped in furs, wielding an axe of ice-rimed steel.",
  },
  {
    id: "young_black_dragon", name: "Young Black Dragon", cr: 8, size: "large", type: "dragon",
    hp: 105, ac: 21, str: 7, dex: 1, con: 5, int: 2, wis: 3, cha: 2,
    attack: "Bite +13 (2d6+4), Claws +8 (1d8+2)", damage: "2d6+4", speed: 40,
    special: "Acid breath (60ft line, 8d4, Ref DC 17), water breathing, darkness",
    terrain: ["swamp"],
    description: "A young dragon with acid-dripping jaws, lord of the black marshes.",
  },
  {
    id: "young_blue_dragon", name: "Young Blue Dragon", cr: 8, size: "large", type: "dragon",
    hp: 115, ac: 22, str: 7, dex: 1, con: 5, int: 4, wis: 5, cha: 4,
    attack: "Bite +14 (2d6+4), Claws +9 (1d8+2)", damage: "2d6+4", speed: 40,
    special: "Lightning breath (80ft line, 8d8, Ref DC 18), create/destroy water",
    terrain: ["desert"],
    description: "A young dragon crackling with lightning, ruler of the sand wastes.",
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Return all monsters with the given challenge rating. */
export function getMonstersByCR(cr: number): Monster[] {
  return MONSTERS.filter((m) => m.cr === cr);
}

/** Return all monsters that can appear in the given terrain. */
export function getMonstersByTerrain(terrain: string): Monster[] {
  return MONSTERS.filter((m) => m.terrain.includes(terrain));
}

/**
 * Pick a single random monster that matches the terrain and falls within
 * the CR range [minCR, maxCR] (inclusive).
 */
export function pickEncounterMonster(
  terrain: string,
  minCR: number,
  maxCR: number,
): Monster {
  const candidates = MONSTERS.filter(
    (m) => m.terrain.includes(terrain) && m.cr >= minCR && m.cr <= maxCR,
  );
  if (candidates.length === 0) {
    // Fallback: relax terrain constraint
    const anyInRange = MONSTERS.filter(
      (m) => m.cr >= minCR && m.cr <= maxCR,
    );
    if (anyInRange.length === 0) {
      // Absolute fallback: return the first monster in the list
      return MONSTERS[0];
    }
    return anyInRange[Math.floor(Math.random() * anyInRange.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Build an encounter group for the given terrain and CR range.
 *
 * Roughly 40% of the time a single strong monster is chosen (biased toward
 * the upper end of the CR range). The other 60% of the time a pack of 2-4
 * weaker monsters is returned (biased toward the lower end).
 */
export function pickEncounterGroup(
  terrain: string,
  minCR: number,
  maxCR: number,
): { monsters: Monster[]; count: number } {
  const roll = Math.random();

  if (roll < 0.4) {
    // --- Single strong monster ---
    // Bias toward the upper half of the CR range
    const midCR = (minCR + maxCR) / 2;
    const monster = pickEncounterMonster(terrain, midCR, maxCR);
    return { monsters: [monster], count: 1 };
  }

  // --- Pack of weaker monsters ---
  // Bias toward the lower half of the CR range
  const midCR = (minCR + maxCR) / 2;
  const monster = pickEncounterMonster(terrain, minCR, midCR);
  const count = 2 + Math.floor(Math.random() * 3); // 2-4
  return { monsters: [monster], count };
}
