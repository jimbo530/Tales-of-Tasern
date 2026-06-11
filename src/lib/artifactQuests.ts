// artifactQuests.ts — Multi-leg artifact quest chains (DMG 3.5 artifacts)
//
// Each quest is a chain of 3-4 legs that must be completed in order.
// Legs unlock via quest_flags stored on the save. WorldMap checks prereqFlags
// against save.quest_flags to decide which legs to offer.
//
// For enemies with count: "scale", WorldMap calculates:
//   Math.floor(Math.random() * 3) + 2 + Math.floor(save.level / 2)

import { DEFAULT_BOON_FIELDS } from "./computeD20Stats";

// Re-export for convenience — WorldMap will spread this into custom stat blocks
export { DEFAULT_BOON_FIELDS };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactQuestLeg = {
  legId: string;              // e.g. "sword_of_kas_leg1"
  legName: string;            // Display name for this leg
  prereqFlags: string[];      // quest_flags that must be true to unlock this leg
  minLevel: number;           // minimum player level
  difficulty: "medium" | "hard" | "deadly";
  description: string;        // NPC dialogue/discovery text (2-4 sentences, gritty tone)
  enemies: ArtifactEnemyDef[];
  completionFlag: string;     // flag set on victory
  rewardText: string;         // shown after victory (what you found / learned)
  rewardItems?: string[];     // item IDs to add to inventory
  rewardGoldCp?: number;      // bonus gold in copper pieces
  questKeyword: string;       // unique keyword for matching in WorldMap (lowercase, used in .includes())
  goneChance?: number;        // 0-1, chance the artifact is already gone (final legs only)
  goneText?: string;          // text shown when artifact was already taken
  goneFollowupFlag?: string;  // flag set when "gone" outcome triggers (for future follow-up quests)
};

export type ArtifactEnemyDef =
  | { type: "monster"; monsterId: string; emoji: string; count: number | "scale"; nameOverride?: string; hpBoost?: number }
  | { type: "custom"; name: string; emoji: string; stats: Record<string, unknown>; subtypes: string[]; hpOverride: number };

export type ArtifactQuest = {
  id: string;
  name: string;               // "The Sword of Kas"
  artifact: string;           // item name of final reward
  artifactDescription: string; // 1-2 sentence flavor
  legs: ArtifactQuestLeg[];
  rumorFlag: string;          // flag for initial discovery (prevents re-offering)
  minCombined: number;        // skill check to discover first leg
};

// ---------------------------------------------------------------------------
// Quest Data
// ---------------------------------------------------------------------------

export const ARTIFACT_QUESTS: ArtifactQuest[] = [

  // =======================================================================
  // 1. THE SWORD OF KAS (4 legs — shadow / undead theme)
  // =======================================================================
  {
    id: "sword_of_kas",
    name: "The Sword of Kas",
    artifact: "sword_of_kas",
    artifactDescription: "A black-bladed longsword that hums with necrotic hunger. It severed the Hand of Vecna in a forgotten age, and it remembers.",
    rumorFlag: "rumor_sword_of_kas",
    minCombined: 30,
    legs: [
      // --- Leg 1: The Soldier's Map ---
      {
        legId: "sword_of_kas_leg1",
        legName: "The Soldier's Map",
        prereqFlags: ["rumor_sword_of_kas"],
        minLevel: 3,
        difficulty: "medium",
        description:
          "A scarred old soldier hunches over his ale in the corner of the Salted Eel, one milky eye staring at nothing. \"I've seen the markings,\" he rasps, pulling his collar aside to show a brand on his neck — the same sigil carved into the walls beneath the Iron Maw. \"Grave robbers got there first. They're stripping the catacombs clean, but they don't know what they have. A map, scratched into a slab. It points to something that scared even the dead.\"",
        enemies: [
          {
            type: "custom",
            name: "Catacomb Thug",
            emoji: "\uD83D\uDDE1\uFE0F",
            stats: {
              str: 6, dex: 4, con: 5, int: 1, wis: 1, cha: 1,
              ac: 15, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid"],
            hpOverride: 28,
          },
          {
            type: "custom",
            name: "Catacomb Thug",
            emoji: "\uD83D\uDDE1\uFE0F",
            stats: {
              str: 6, dex: 4, con: 5, int: 1, wis: 1, cha: 1,
              ac: 15, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid"],
            hpOverride: 28,
          },
          {
            type: "custom",
            name: "Grave Robber Captain",
            emoji: "\u2694\uFE0F",
            stats: {
              str: 7, dex: 5, con: 6, int: 2, wis: 2, cha: 3,
              ac: 16, naturalArmor: 1, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid"],
            hpOverride: 35,
          },
          { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: "scale" },
        ],
        completionFlag: "sword_of_kas_leg1_done",
        rewardText: "Among the scattered bones and broken coffin lids, you find it — a stone slab with a map fragment scratched into its surface. The lines trace a path deeper beneath the city, to a sealed tomb the grave robbers never found.",
        rewardItems: ["kas_map_fragment"],
        rewardGoldCp: 1500,
        questKeyword: "soldiers_map",
      },

      // --- Leg 2: Whispers in the Dark ---
      {
        legId: "sword_of_kas_leg2",
        legName: "Whispers in the Dark",
        prereqFlags: ["sword_of_kas_leg1_done"],
        minLevel: 5,
        difficulty: "hard",
        description:
          "The map fragment leads through flooded tunnels beneath the Harbor District to a sealed tomb door carved with warnings in a dead language. Something scrapes behind the stone. The air smells of dust and old blood, and a cold draft breathes from cracks in the seal — a draft that carries whispers just below the threshold of hearing.",
        enemies: [
          {
            type: "custom",
            name: "Wight Sentinel",
            emoji: "\uD83E\uDDDF",
            stats: {
              str: 8, dex: 5, con: 7, int: 3, wis: 3, cha: 5,
              ac: 17, naturalArmor: 2, atk: 5, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead"],
            hpOverride: 45,
          },
          {
            type: "custom",
            name: "Wight Sentinel",
            emoji: "\uD83E\uDDDF",
            stats: {
              str: 8, dex: 5, con: 7, int: 3, wis: 3, cha: 5,
              ac: 17, naturalArmor: 2, atk: 5, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead"],
            hpOverride: 45,
          },
          { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 4 },
          { type: "monster", monsterId: "ghoul", emoji: "\uD83E\uDDDF\u200D\u2642\uFE0F", count: 2 },
        ],
        completionFlag: "sword_of_kas_leg2_done",
        rewardText: "The sealed tomb opens into a chamber lined with iron chains. Pinned to the wall by a rusted blade is a desiccated corpse clutching a leather journal. The entries describe a vault \"where shadow bleeds into stone\" — and give directions to its entrance beneath the old Executioner's Quarter.",
        rewardItems: ["kas_journal"],
        rewardGoldCp: 3000,
        questKeyword: "whispers_dark",
      },

      // --- Leg 3: The Shadow Gauntlet ---
      {
        legId: "sword_of_kas_leg3",
        legName: "The Shadow Gauntlet",
        prereqFlags: ["sword_of_kas_leg2_done"],
        minLevel: 7,
        difficulty: "hard",
        description:
          "The journal's directions lead to a collapsed section of the Executioner's Quarter cellars. Past the rubble, the walls are slick with a substance that isn't water — it's cold, dark, and it moves. The torchlight dims here, not from wind but as if the darkness itself is feeding. Somewhere ahead, something patient and very old knows you are coming.",
        enemies: [
          { type: "monster", monsterId: "wraith", emoji: "\uD83D\uDC7B", count: 3 },
          {
            type: "custom",
            name: "Spectre Guardian",
            emoji: "\u2620\uFE0F",
            stats: {
              str: 1, dex: 10, con: 1, int: 8, wis: 8, cha: 10,
              ac: 18, naturalArmor: 3, atk: 6, speed: 40,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead", "incorporeal"],
            hpOverride: 55,
          },
        ],
        completionFlag: "sword_of_kas_leg3_done",
        rewardText: "The spectre dissolves into shrieking motes of shadow. Behind where it stood, set into an alcove of black stone, lies an ornate scabbard — jet black, inscribed with runes that seem to shift when you're not looking directly at them. The scabbard pulses once in your hand, and for an instant you hear a voice: \"Closer.\" It wants to be reunited with its blade.",
        rewardItems: ["kas_scabbard"],
        rewardGoldCp: 4500,
        questKeyword: "shadow_gauntlet",
      },

      // --- Leg 4: Kas's Final Guardian ---
      {
        legId: "sword_of_kas_leg4",
        legName: "Kas's Final Guardian",
        prereqFlags: ["sword_of_kas_leg3_done"],
        minLevel: 9,
        difficulty: "deadly",
        description:
          "The scabbard grows warm as you descend. Past a door sealed with chains of black iron, the final vault opens — a circular chamber with the sword driven point-first into a cracked altar. Standing between you and it is a figure in corroded plate armor, its eye sockets burning with violet fire. Kas's last servant. It has waited centuries for someone worthy — or foolish enough — to claim the blade.",
        enemies: [
          {
            type: "custom",
            name: "Kas's Revenant",
            emoji: "\uD83D\uDC51",
            stats: {
              str: 12, dex: 8, con: 11, int: 6, wis: 7, cha: 10,
              ac: 21, naturalArmor: 5, atk: 9, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead", "boss"],
            hpOverride: 95,
          },
          { type: "monster", monsterId: "wraith", emoji: "\uD83D\uDC7B", count: 2 },
          { type: "monster", monsterId: "ghast", emoji: "\uD83E\uDDDF", count: 2 },
        ],
        completionFlag: "sword_of_kas_leg4_done",
        rewardText: "The revenant crumbles to dust with a sound like breaking glass. The violet light fades from its eye sockets and for a moment you see — or imagine — a look of relief on the ruined face. The Sword of Kas slides free from the altar without resistance, its black blade drinking the torchlight. It hums against your palm, hungry and finally awake.",
        rewardItems: ["sword_of_kas"],
        rewardGoldCp: 10000,
        questKeyword: "kas_final_guardian",
        goneChance: 0.15,
        goneText: "The altar is cracked open, the chains broken. Fresh bootprints in the dust lead to a side passage that has collapsed behind whoever came through. A single black scale lies on the altar — not from a snake, but from armor. Someone in dark plate took the blade, and recently. The scabbard in your pack shudders once, then goes cold.",
        goneFollowupFlag: "kas_taken_by_unknown",
      },
    ],
  },

  // =======================================================================
  // 2. THE ORB OF DRAGONKIND (4 legs — dragon / kobold theme)
  // =======================================================================
  {
    id: "orb_of_dragonkind",
    name: "The Orb of Dragonkind",
    artifact: "orb_of_dragonkind",
    artifactDescription: "A sphere of smoky crystal that pulses with inner fire. Those who gaze into it see the shadow of wings, and dragons for miles around feel its pull like a hook in the jaw.",
    rumorFlag: "rumor_orb_of_dragonkind",
    minCombined: 28,
    legs: [
      // --- Leg 1: Kobold Wardens ---
      {
        legId: "orb_of_dragonkind_leg1",
        legName: "Kobold Wardens",
        prereqFlags: ["rumor_orb_of_dragonkind"],
        minLevel: 4,
        difficulty: "medium",
        description:
          "A merchant with cracked lips and sun-blistered skin slumps at the tavern bar, three days off the eastern caravan road. \"Kobolds,\" he mutters, \"but not the usual vermin. Organized. Armored. They had a checkpoint on the mountain pass — a checkpoint, like soldiers.\" He leans closer, breath sour with cheap wine. \"And at night I saw it, a glow from the caves above. Blue-white, pulsing. They were chanting to it like it was their god.\"",
        enemies: [
          { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: "scale" },
          {
            type: "custom",
            name: "Kobold Warchief",
            emoji: "\uD83D\uDC09",
            stats: {
              str: 4, dex: 7, con: 4, int: 3, wis: 3, cha: 5,
              ac: 16, naturalArmor: 2, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "reptilian"],
            hpOverride: 30,
          },
          {
            type: "custom",
            name: "Kobold Trapsmith",
            emoji: "\uD83D\uDCA3",
            stats: {
              str: 2, dex: 8, con: 3, int: 5, wis: 4, cha: 1,
              ac: 16, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "reptilian"],
            hpOverride: 22,
          },
        ],
        completionFlag: "orb_of_dragonkind_leg1_done",
        rewardText: "The kobold warchief's body yields a crude map scratched onto dragon hide. It shows the mountain pass leading to a place marked with a dragon skull icon and the kobold word for \"holy\" — a dragon graveyard, hidden in the peaks above the eastern wastes.",
        rewardItems: ["kobold_hide_map"],
        rewardGoldCp: 1200,
        questKeyword: "kobold_wardens",
      },

      // --- Leg 2: The Dragon's Graveyard ---
      {
        legId: "orb_of_dragonkind_leg2",
        legName: "The Dragon's Graveyard",
        prereqFlags: ["orb_of_dragonkind_leg1_done"],
        minLevel: 6,
        difficulty: "hard",
        description:
          "The path climbs through ice and loose shale to a plateau littered with bones the size of longboats. Dragon ribs arc overhead like the vaulting of a cathedral built by something far older than men. Between the colossal skeletons, smaller creatures move — the descendants of those who once served the great wyrms, still guarding their masters' rest with a fervor that hasn't dimmed in a thousand years.",
        enemies: [
          { type: "monster", monsterId: "lizardfolk", emoji: "\uD83E\uDD8E", count: 4 },
          {
            type: "custom",
            name: "Dragonkin Berserker",
            emoji: "\uD83D\uDC32",
            stats: {
              str: 9, dex: 5, con: 8, int: 2, wis: 3, cha: 4,
              ac: 17, naturalArmor: 3, atk: 5, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "dragonblood"],
            hpOverride: 50,
          },
          {
            type: "custom",
            name: "Dragonkin Berserker",
            emoji: "\uD83D\uDC32",
            stats: {
              str: 9, dex: 5, con: 8, int: 2, wis: 3, cha: 4,
              ac: 17, naturalArmor: 3, atk: 5, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "dragonblood"],
            hpOverride: 50,
          },
        ],
        completionFlag: "orb_of_dragonkind_leg2_done",
        rewardText: "Carved into the base of the largest dragon skull — a beast that must have been ancient even among its kind — you find an inscription in Draconic. It describes the Orb's resting place: a sanctum built into the mountain's heart, accessible only through the \"Wyrm's Throat,\" a passage behind the graveyard's deepest cairn.",
        rewardItems: ["draconic_inscription_rubbing"],
        rewardGoldCp: 4000,
        questKeyword: "dragons_graveyard",
      },

      // --- Leg 3: The Wyrm Priest ---
      {
        legId: "orb_of_dragonkind_leg3",
        legName: "The Wyrm Priest",
        prereqFlags: ["orb_of_dragonkind_leg2_done"],
        minLevel: 8,
        difficulty: "hard",
        description:
          "The Wyrm's Throat is a tunnel of fused obsidian, scorched smooth by dragon breath centuries ago. It opens into a vaulted sanctum lit by braziers of blue-white flame that burn without fuel. At the far end, a figure kneels before a stone pedestal — tall, scaled, with horns curving back from a skull that is not quite human. He rises when he hears you, and his voice echoes with harmonics that vibrate in your teeth. \"You are not of the blood. You will not leave.\"",
        enemies: [
          {
            type: "custom",
            name: "Wyrm Priest Xathorek",
            emoji: "\uD83D\uDD25",
            stats: {
              str: 9, dex: 6, con: 8, int: 10, wis: 9, cha: 10,
              ac: 18, naturalArmor: 4, atk: 6, speed: 30,
              lightningDmg: 0, fireDmg: 3,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "dragonblood", "boss"],
            hpOverride: 60,
          },
          { type: "monster", monsterId: "lizardfolk", emoji: "\uD83E\uDD8E", count: 3, nameOverride: "Lizardfolk Acolyte" },
          {
            type: "custom",
            name: "Flame Serpent",
            emoji: "\uD83D\uDD25",
            stats: {
              str: 5, dex: 8, con: 6, int: 1, wis: 3, cha: 1,
              ac: 16, naturalArmor: 2, atk: 5, speed: 40,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["magical_beast", "fire"],
            hpOverride: 35,
          },
        ],
        completionFlag: "orb_of_dragonkind_leg3_done",
        rewardText: "Xathorek falls, dragon blood pooling black on the obsidian floor. Behind the pedestal, a passage descends into heat and the faint smell of sulfur. The Wyrm Priest's dying words: \"She waits below. She has always waited. The Orb chose her, not you.\" The braziers flicker and dim as if mourning their keeper.",
        rewardItems: ["wyrm_priest_key"],
        rewardGoldCp: 6000,
        questKeyword: "wyrm_priest",
      },

      // --- Leg 4: Dragonfire ---
      {
        legId: "orb_of_dragonkind_leg4",
        legName: "Dragonfire",
        prereqFlags: ["orb_of_dragonkind_leg3_done"],
        minLevel: 10,
        difficulty: "deadly",
        description:
          "The passage opens into a cavern of raw heat. Stalactites drip molten stone. And there, coiled around a pillar of volcanic glass with the Orb cradled in one clawed hand, is a young black dragon — scarred, missing scales along one flank, and very much awake. Her yellow eyes fix on you with cold intelligence. \"The priest is dead. I smelled it. You may have the Orb if you can take it from my cooling corpse. Otherwise, you will be ash and I will find a new priest.\"",
        enemies: [
          { type: "monster", monsterId: "young_black_dragon", emoji: "\uD83D\uDC09", count: 1, nameOverride: "Vyrathrax the Scarred", hpBoost: 20 },
          { type: "monster", monsterId: "kobold", emoji: "\uD83D\uDC32", count: 4, nameOverride: "Dragonsworn Kobold" },
        ],
        completionFlag: "orb_of_dragonkind_leg4_done",
        rewardText: "Vyrathrax crashes to the cavern floor, her last breath a gout of acid that dissolves a swathe of stone. The Orb of Dragonkind rolls free from her slackening claws, pulsing with inner light. When you pick it up, the warmth surprises you — not unpleasant, almost alive. Somewhere far away, you sense something vast and ancient turning its attention toward you. The Orb has a new keeper.",
        rewardItems: ["orb_of_dragonkind"],
        rewardGoldCp: 15000,
        questKeyword: "dragonfire",
        goneChance: 0.20,
        goneText: "The pedestal is empty. Claw marks — enormous ones — score the stone where the Orb once sat. A dragon got here first, and it didn't use the door. Half the ceiling is torn away, open to sky. In the rubble you find a single cracked lens of the Orb, its power spent. The dragon's trail leads east, toward the Ashlands.",
        goneFollowupFlag: "orb_taken_by_dragon",
      },
    ],
  },

  // =======================================================================
  // 3. THE BOOK OF INFINITE SPELLS (3 legs — arcane / wizard theme)
  // =======================================================================
  {
    id: "book_of_infinite_spells",
    name: "The Book of Infinite Spells",
    artifact: "book_of_infinite_spells",
    artifactDescription: "A tome bound in pale leather that writes itself endlessly. Its pages contain every spell ever cast and many that never were — reading it is ecstasy and madness in equal measure.",
    rumorFlag: "rumor_book_of_infinite_spells",
    minCombined: 32,
    legs: [
      // --- Leg 1: The Apprentice's Key ---
      {
        legId: "book_of_infinite_spells_leg1",
        legName: "The Apprentice's Key",
        prereqFlags: ["rumor_book_of_infinite_spells"],
        minLevel: 5,
        difficulty: "medium",
        description:
          "A young man with ink-stained fingers and bloodshot eyes grabs your arm outside the Salted Eel. \"My master,\" he stammers, \"Aldermach — you know the tower in the Arcane Quarter? The condemned one? He found a book. It writes itself. He couldn't stop reading it and then he — he changed. The Magisters boarded up the tower but I can hear things moving in there at night.\" He presses a brass key into your hand with shaking fingers. \"The lower floors. Whatever he built down there, it's still running.\"",
        enemies: [
          {
            type: "custom",
            name: "Animated Armor",
            emoji: "\uD83E\uDEE8",
            stats: {
              str: 8, dex: 1, con: 7, int: 1, wis: 1, cha: 1,
              ac: 16, naturalArmor: 4, atk: 4, speed: 25,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct"],
            hpOverride: 30,
          },
          {
            type: "custom",
            name: "Animated Armor",
            emoji: "\uD83E\uDEE8",
            stats: {
              str: 8, dex: 1, con: 7, int: 1, wis: 1, cha: 1,
              ac: 16, naturalArmor: 4, atk: 4, speed: 25,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct"],
            hpOverride: 30,
          },
          {
            type: "custom",
            name: "Rogue Iron Golem",
            emoji: "\uD83E\uDD16",
            stats: {
              str: 8, dex: 2, con: 8, int: 1, wis: 1, cha: 1,
              ac: 16, naturalArmor: 5, atk: 4, speed: 20,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct"],
            hpOverride: 35,
          },
        ],
        completionFlag: "book_of_infinite_spells_leg1_done",
        rewardText: "The constructs fall silent, their animating force spent. In the wreckage you find Aldermach's workshop journal — the early entries are meticulous, scholarly. The later ones are written in three different hands, none of them his. The last readable entry says: \"The Library above is where I keep it. The book doesn't like being alone. It called something to watch over it.\"",
        rewardItems: ["aldermach_workshop_journal"],
        rewardGoldCp: 3500,
        questKeyword: "apprentices_key",
      },

      // --- Leg 2: The Mad Wizard's Library ---
      {
        legId: "book_of_infinite_spells_leg2",
        legName: "The Mad Wizard's Library",
        prereqFlags: ["book_of_infinite_spells_leg1_done"],
        minLevel: 7,
        difficulty: "hard",
        description:
          "The stairs creak under your weight. The upper floors of Aldermach's tower are worse than the workshop — shelves of books that have been rearranged by something with too many fingers, alchemical apparatus bubbling with no one tending it, and a smell like ozone and rotting flowers. In the library at the top, a figure stands with its back to you, muttering in a language that makes your eyes water. When it turns, you recognize the robes of a Magister, but the face is wrong — too many features crowded onto one skull, constantly shifting.",
        enemies: [
          {
            type: "custom",
            name: "Aldermach the Unraveled",
            emoji: "\uD83E\uDDD9",
            stats: {
              str: 3, dex: 6, con: 5, int: 12, wis: 4, cha: 8,
              ac: 17, naturalArmor: 2, atk: 5, speed: 30,
              lightningDmg: 3, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "aberrant", "boss"],
            hpOverride: 55,
          },
          {
            type: "custom",
            name: "Summoned Mephit",
            emoji: "\uD83D\uDD25",
            stats: {
              str: 3, dex: 7, con: 3, int: 2, wis: 2, cha: 3,
              ac: 15, naturalArmor: 1, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "fire"],
            hpOverride: 20,
          },
          {
            type: "custom",
            name: "Summoned Mephit",
            emoji: "\u2744\uFE0F",
            stats: {
              str: 3, dex: 7, con: 3, int: 2, wis: 2, cha: 3,
              ac: 15, naturalArmor: 1, atk: 4, speed: 30,
              lightningDmg: 2, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "cold"],
            hpOverride: 20,
          },
          { type: "monster", monsterId: "gray_ooze", emoji: "\uD83E\uDEE0", count: 1, nameOverride: "Arcane Residue" },
        ],
        completionFlag: "book_of_infinite_spells_leg2_done",
        rewardText: "Aldermach collapses mid-sentence, his features settling at last into one face — old, tired, and briefly sane. \"Don't read it,\" he whispers. \"It reads you back.\" He dies with his eyes open. The Book isn't here. Where the pedestal once stood, a trapdoor leads further up — to a room that shouldn't exist, given the tower's height. The book has built itself a sanctum.",
        rewardItems: ["aldermach_sanctum_key"],
        rewardGoldCp: 6000,
        questKeyword: "mad_wizards_library",
      },

      // --- Leg 3: The Book Unbound ---
      {
        legId: "book_of_infinite_spells_leg3",
        legName: "The Book Unbound",
        prereqFlags: ["book_of_infinite_spells_leg2_done"],
        minLevel: 9,
        difficulty: "deadly",
        description:
          "The trapdoor opens into a room that defies the tower's architecture — vaulted ceilings, impossible angles, shelves that extend into darkness. At the center, on a lectern of crystal, the Book of Infinite Spells lies open. Its pages turn by themselves, each one inscribing new text in golden fire. The air around it shimmers with half-formed shapes — fragments of spells given form, guardians born from pure arcane energy. They turn toward you with what might be curiosity or hunger. The Book itself seems to watch through a thousand invisible eyes.",
        enemies: [
          {
            type: "custom",
            name: "Living Spell — Fireball",
            emoji: "\uD83D\uDD25",
            stats: {
              str: 1, dex: 10, con: 6, int: 1, wis: 5, cha: 1,
              ac: 17, naturalArmor: 2, atk: 7, speed: 40,
              lightningDmg: 0, fireDmg: 5,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "arcane", "fire"],
            hpOverride: 45,
          },
          {
            type: "custom",
            name: "Living Spell — Lightning",
            emoji: "\u26A1",
            stats: {
              str: 1, dex: 10, con: 6, int: 1, wis: 5, cha: 1,
              ac: 17, naturalArmor: 2, atk: 7, speed: 40,
              lightningDmg: 5, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "arcane", "lightning"],
            hpOverride: 45,
          },
          {
            type: "custom",
            name: "Arcane Horror",
            emoji: "\uD83D\uDC7E",
            stats: {
              str: 6, dex: 8, con: 7, int: 10, wis: 6, cha: 8,
              ac: 18, naturalArmor: 3, atk: 7, speed: 30,
              lightningDmg: 2, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["aberration", "arcane"],
            hpOverride: 55,
          },
          {
            type: "custom",
            name: "The Lexicon — Living Tome",
            emoji: "\uD83D\uDCD6",
            stats: {
              str: 4, dex: 6, con: 10, int: 12, wis: 10, cha: 12,
              ac: 20, naturalArmor: 5, atk: 8, speed: 20,
              lightningDmg: 3, fireDmg: 3,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "arcane", "boss"],
            hpOverride: 85,
          },
        ],
        completionFlag: "book_of_infinite_spells_leg3_done",
        rewardText: "The Living Tome bursts apart in a cascade of golden pages that dissolve into light. The impossible room shudders, walls contracting, shelves folding in on themselves. When the light fades, you stand in a bare tower room with the Book of Infinite Spells lying closed on the floor. It feels lighter than it should. When you open it, the first page reads: \"Hello, new reader. Shall we begin?\"",
        rewardItems: ["book_of_infinite_spells"],
        rewardGoldCp: 12000,
        questKeyword: "book_unbound",
        goneChance: 0.10,
        goneText: "The reading lectern stands empty, its chains dangling. The Book is gone, but it left something behind — every wall, floor, and ceiling is covered in cramped handwriting, thousands of spells scrawled in still-wet ink as if the Book vomited its contents before being taken. A note pinned to the lectern reads: 'Claimed for the Archive of Altuum. Do not follow.' The ink is still warm.",
        goneFollowupFlag: "book_taken_by_altuum",
      },
    ],
  },

  // =======================================================================
  // 4. THE IRON FLASK (3 legs — demon / planar theme)
  // =======================================================================
  {
    id: "iron_flask",
    name: "The Iron Flask",
    artifact: "iron_flask",
    artifactDescription: "A heavy iron bottle sealed with sigils of binding. It once held a fiend of terrible power. Now empty, it hungers to imprison again.",
    rumorFlag: "rumor_iron_flask",
    minCombined: 26,
    legs: [
      // --- Leg 1: The Warehouse ---
      {
        legId: "iron_flask_leg1",
        legName: "The Warehouse",
        prereqFlags: ["rumor_iron_flask"],
        minLevel: 4,
        difficulty: "medium",
        description:
          "The harbor master's aide pulls you aside near the fish market, his face pale beneath the grime. \"Warehouse Nine,\" he says. \"The one by the old dry dock. Crew from the Maiden's Grief pulled something from a wreck last week — sealed iron, covered in writing nobody can read. Since then, the night watch won't go near the place. Rikkard went in two nights ago to check on it. Came out with black eyes and speaking a language that made the dogs howl. Three more dockers have gone in since. None came out right.\"",
        enemies: [
          {
            type: "custom",
            name: "Possessed Docker",
            emoji: "\uD83D\uDC77",
            stats: {
              str: 7, dex: 3, con: 6, int: 1, wis: 1, cha: 1,
              ac: 14, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "possessed"],
            hpOverride: 25,
          },
          {
            type: "custom",
            name: "Possessed Docker",
            emoji: "\uD83D\uDC77",
            stats: {
              str: 7, dex: 3, con: 6, int: 1, wis: 1, cha: 1,
              ac: 14, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "possessed"],
            hpOverride: 25,
          },
          {
            type: "custom",
            name: "Possessed Docker",
            emoji: "\uD83D\uDC77",
            stats: {
              str: 7, dex: 3, con: 6, int: 1, wis: 1, cha: 1,
              ac: 14, naturalArmor: 1, atk: 3, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "possessed"],
            hpOverride: 25,
          },
          {
            type: "custom",
            name: "Minor Fiend",
            emoji: "\uD83D\uDE08",
            stats: {
              str: 6, dex: 6, con: 5, int: 4, wis: 4, cha: 6,
              ac: 16, naturalArmor: 2, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil"],
            hpOverride: 32,
          },
          {
            type: "custom",
            name: "Minor Fiend",
            emoji: "\uD83D\uDE08",
            stats: {
              str: 6, dex: 6, con: 5, int: 4, wis: 4, cha: 6,
              ac: 16, naturalArmor: 2, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil"],
            hpOverride: 32,
          },
        ],
        completionFlag: "iron_flask_leg1_done",
        rewardText: "The possessed dockers collapse unconscious as the minor fiends dissolve into oily smoke. In the center of the warehouse, sitting on a crate of rotting fish, is the Iron Flask — heavy, cold, and covered in sigils that glow faintly red. Cracks web the seal. Whatever is inside is pushing outward. You'll need to find someone who knows binding magic before the seal fails entirely.",
        rewardItems: ["cracked_iron_flask"],
        rewardGoldCp: 2000,
        questKeyword: "the_warehouse",
      },

      // --- Leg 2: The Seal Weakens ---
      {
        legId: "iron_flask_leg2",
        legName: "The Seal Weakens",
        prereqFlags: ["iron_flask_leg1_done"],
        minLevel: 6,
        difficulty: "hard",
        description:
          "You sought out the old exorcist in the Temple District — a gaunt woman named Sister Kael who stank of incense and regret. She took one look at the Flask and went white. \"This was sealed by the Pactbinders, centuries ago. The binding is failing. I can reinforce it, but I need time and quiet.\" She didn't get either. That night, the warehouse wall exploded outward. Something got free — not the prisoner itself, but its servants, called through the weakening seal like rats through a crack in a hull.",
        enemies: [
          {
            type: "custom",
            name: "Fiendish Lieutenant",
            emoji: "\uD83D\uDC79",
            stats: {
              str: 9, dex: 7, con: 8, int: 6, wis: 5, cha: 8,
              ac: 18, naturalArmor: 3, atk: 6, speed: 30,
              lightningDmg: 0, fireDmg: 3,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "boss"],
            hpOverride: 55,
          },
          {
            type: "custom",
            name: "Shadow Fiend",
            emoji: "\uD83D\uDC7F",
            stats: {
              str: 5, dex: 8, con: 5, int: 5, wis: 4, cha: 6,
              ac: 17, naturalArmor: 2, atk: 5, speed: 35,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "shadow"],
            hpOverride: 38,
          },
          {
            type: "custom",
            name: "Shadow Fiend",
            emoji: "\uD83D\uDC7F",
            stats: {
              str: 5, dex: 8, con: 5, int: 5, wis: 4, cha: 6,
              ac: 17, naturalArmor: 2, atk: 5, speed: 35,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "shadow"],
            hpOverride: 38,
          },
          { type: "monster", monsterId: "ghoul", emoji: "\uD83E\uDDDF", count: "scale", nameOverride: "Fiend-Touched Ghoul" },
        ],
        completionFlag: "iron_flask_leg2_done",
        rewardText: "The fiendish lieutenant's corporeal form shreds apart, but its dying laughter echoes through the rubble. Sister Kael emerges from behind an overturned cart, bleeding from a gash on her forehead. \"The seal won't hold another day,\" she says. \"We don't reinforce it — we let the prisoner out and we kill it. I know the unbinding rite. But whatever comes out of that Flask has been imprisoned for centuries, and it will be furious.\"",
        rewardItems: ["kael_unbinding_scroll"],
        rewardGoldCp: 5000,
        questKeyword: "seal_weakens",
      },

      // --- Leg 3: Binding the Unbound ---
      {
        legId: "iron_flask_leg3",
        legName: "Binding the Unbound",
        prereqFlags: ["iron_flask_leg2_done"],
        minLevel: 8,
        difficulty: "deadly",
        description:
          "Sister Kael performs the unbinding rite at midnight in the ruins of Warehouse Nine. The Flask screams as the seal shatters. Smoke pours upward — thick, red-black, reeking of sulfur and burning hair — and coalesces into a shape that fills the warehouse. A fiend of the lower planes, imprisoned before Kardov's Gate had a name. It stretches limbs that haven't moved in centuries, and when it speaks, the words leave welts on your skin. \"Free. At last, wonderfully free. And so very, very hungry.\"",
        enemies: [
          {
            type: "custom",
            name: "Bal'Therak, the Flask Prisoner",
            emoji: "\uD83D\uDC7A",
            stats: {
              str: 12, dex: 7, con: 11, int: 10, wis: 8, cha: 12,
              ac: 20, naturalArmor: 5, atk: 8, speed: 35,
              lightningDmg: 0, fireDmg: 4,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "demon", "boss"],
            hpOverride: 90,
          },
          {
            type: "custom",
            name: "Spawned Hellhound",
            emoji: "\uD83D\uDC3A",
            stats: {
              str: 7, dex: 5, con: 6, int: 2, wis: 3, cha: 2,
              ac: 16, naturalArmor: 2, atk: 5, speed: 40,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "fire"],
            hpOverride: 30,
          },
          {
            type: "custom",
            name: "Spawned Hellhound",
            emoji: "\uD83D\uDC3A",
            stats: {
              str: 7, dex: 5, con: 6, int: 2, wis: 3, cha: 2,
              ac: 16, naturalArmor: 2, atk: 5, speed: 40,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["outsider", "evil", "fire"],
            hpOverride: 30,
          },
        ],
        completionFlag: "iron_flask_leg3_done",
        rewardText: "Bal'Therak screams as Sister Kael's binding circle flares to life — you held it long enough. The fiend's form compresses, distorts, and is sucked back into the Iron Flask with a sound like a thunderclap in reverse. The seal reforms, stronger than before, etched with new sigils in Kael's handwriting. She hands you the Flask with shaking hands. \"It's empty now. The binding consumed the prisoner entirely. But the Flask remembers how to hold things. Use it wisely — or don't use it at all.\"",
        rewardItems: ["iron_flask"],
        rewardGoldCp: 12000,
        questKeyword: "binding_unbound",
      },
    ],
  },

  // =======================================================================
  // 5. THE AXE OF THE DWARVISH LORDS (4 legs — dwarven / underground theme)
  // =======================================================================
  {
    id: "axe_of_dwarvish_lords",
    name: "The Axe of the Dwarvish Lords",
    artifact: "axe_of_dwarvish_lords",
    artifactDescription: "A double-headed battleaxe of adamantine and mithral, inscribed with the founding runes of the dwarven kingdoms. It hums with the memory of stone and the fury of a people who will not be broken.",
    rumorFlag: "rumor_axe_of_dwarvish_lords",
    minCombined: 24,
    legs: [
      // --- Leg 1: The Stone Tablet ---
      {
        legId: "axe_of_dwarvish_lords_leg1",
        legName: "The Stone Tablet",
        prereqFlags: ["rumor_axe_of_dwarvish_lords"],
        minLevel: 3,
        difficulty: "medium",
        description:
          "A dwarf stumbles through the tavern door and collapses against the bar, one hand clutching a stone tablet to his chest. His armor is slashed, his beard matted with blood that isn't all his own. \"Bhalanur,\" he gasps. \"The forge — it's real. I found it. The goblins found me.\" He presses the tablet into your hands. \"They're coming. They want this. Don't let the little bastards have it.\" He slumps, breathing shallow. Through the tavern windows, you see torchlight in the alley. They followed him here.",
        enemies: [
          { type: "monster", monsterId: "goblin", emoji: "\uD83D\uDC7A", count: "scale" },
          { type: "monster", monsterId: "hobgoblin", emoji: "\uD83D\uDDE1\uFE0F", count: 3 },
          {
            type: "custom",
            name: "Hobgoblin Warlord",
            emoji: "\u2694\uFE0F",
            stats: {
              str: 7, dex: 5, con: 6, int: 3, wis: 2, cha: 4,
              ac: 16, naturalArmor: 2, atk: 4, speed: 30,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["humanoid", "goblinoid"],
            hpOverride: 32,
          },
        ],
        completionFlag: "axe_of_dwarvish_lords_leg1_done",
        rewardText: "The hobgoblin warlord goes down swinging, and the rest break and scatter into the night. The tavern keeper is going to want you to pay for the furniture. The stone tablet is carved with dwarven runes and a map showing the location of Bhalanur — a forge-city thought to be myth, somewhere in the mountains north of the eastern trade road. The dying dwarf's name was Gorek, and he deserved better than an alley full of goblins.",
        rewardItems: ["bhalanur_stone_tablet"],
        rewardGoldCp: 1000,
        questKeyword: "stone_tablet",
      },

      // --- Leg 2: Halls of Bhalanur ---
      {
        legId: "axe_of_dwarvish_lords_leg2",
        legName: "Halls of Bhalanur",
        prereqFlags: ["axe_of_dwarvish_lords_leg1_done"],
        minLevel: 5,
        difficulty: "hard",
        description:
          "The entrance to Bhalanur is a crack in a cliff face, half-hidden by rockslide rubble. Beyond it, the halls open up — massive columns carved with scenes of dwarven industry, now crumbling and stained with centuries of water damage. The air is thick with the stench of rot. Something has been living here for a long time, nesting in the ruins of a civilization that could have built wonders. Claw marks score the stone floor, and piles of refuse choke the corridors.",
        enemies: [
          { type: "monster", monsterId: "troglodyte", emoji: "\uD83E\uDD8E", count: "scale" },
          { type: "monster", monsterId: "troglodyte", emoji: "\uD83E\uDD8E", count: 2, nameOverride: "Troglodyte Brute", hpBoost: 8 },
          { type: "monster", monsterId: "filth_maw", emoji: "\uD83D\uDC19", count: 1 },
        ],
        completionFlag: "axe_of_dwarvish_lords_leg2_done",
        rewardText: "The filth-maw's tentacles go slack and it slides back into the refuse pit it called home. Beyond its lair, the halls improve — these deeper sections are less damaged, sealed behind doors the creatures couldn't breach. Dwarven script on the walls points deeper: \"The Forge of First Fire — where the Lords' weapon was shaped.\" The passage descends, and the air grows warmer. Bhalanur's heart still burns.",
        rewardItems: ["bhalanur_forge_directions"],
        rewardGoldCp: 3500,
        questKeyword: "halls_bhalanur",
      },

      // --- Leg 3: The Forge Guardian ---
      {
        legId: "axe_of_dwarvish_lords_leg3",
        legName: "The Forge Guardian",
        prereqFlags: ["axe_of_dwarvish_lords_leg2_done"],
        minLevel: 7,
        difficulty: "hard",
        description:
          "The Forge of First Fire lives up to its name — a vast circular chamber with a pit of molten stone at its center, still glowing after untold centuries. Anvils ring the pit like monoliths at a shrine. Standing motionless before the largest anvil are three shapes carved from granite, their proportions squat and broad — dwarven in form but twice the size, with rune-etched fists and eye sockets that flicker with inner light. Forge guardians. The last line of defense, built to ensure only the worthy reach what lies beyond.",
        enemies: [
          {
            type: "custom",
            name: "Forge Guardian",
            emoji: "\uD83E\uDEA8",
            stats: {
              str: 10, dex: 2, con: 10, int: 1, wis: 4, cha: 1,
              ac: 19, naturalArmor: 6, atk: 6, speed: 20,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "earth"],
            hpOverride: 55,
          },
          {
            type: "custom",
            name: "Forge Guardian",
            emoji: "\uD83E\uDEA8",
            stats: {
              str: 10, dex: 2, con: 10, int: 1, wis: 4, cha: 1,
              ac: 19, naturalArmor: 6, atk: 6, speed: 20,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "earth"],
            hpOverride: 55,
          },
          {
            type: "custom",
            name: "Forge Warden Prime",
            emoji: "\uD83D\uDD28",
            stats: {
              str: 11, dex: 3, con: 10, int: 2, wis: 5, cha: 1,
              ac: 19, naturalArmor: 6, atk: 6, speed: 20,
              lightningDmg: 0, fireDmg: 2,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["construct", "earth", "fire"],
            hpOverride: 60,
          },
        ],
        completionFlag: "axe_of_dwarvish_lords_leg3_done",
        rewardText: "The Forge Warden Prime topples with a sound like a quarry collapse, its rune-light fading. Behind the great anvil, a door of solid mithral stands ajar — the guardians' destruction triggered it to open. Beyond, stairs descend into a heat that makes the forge chamber feel cool by comparison. The Axe is close. You can almost hear it — a low, steady ring, like a hammer striking an anvil in the deep.",
        rewardItems: ["bhalanur_inner_key"],
        rewardGoldCp: 5000,
        questKeyword: "forge_guardian",
      },

      // --- Leg 4: The Axe Awaits ---
      {
        legId: "axe_of_dwarvish_lords_leg4",
        legName: "The Axe Awaits",
        prereqFlags: ["axe_of_dwarvish_lords_leg3_done"],
        minLevel: 9,
        difficulty: "deadly",
        description:
          "The inner sanctum is a throne room carved from a single vein of mithral-veined granite. The Axe of the Dwarvish Lords rests across the lap of a figure on the throne — a dwarven king in full regalia, his crown tarnished, his armor corroded by centuries of slow decay. He is dead, of course. He has been dead since before Kardov's Gate was founded. But he stands when you enter, bones grinding in rusted plate, the Axe blazing with blue-white light in his skeletal grip. His voice is the sound of stone grinding on stone: \"None but a Lord of the Deep may claim this weapon. Prove your worth or join the bones of the unworthy.\"",
        enemies: [
          {
            type: "custom",
            name: "King Bharek the Undying",
            emoji: "\uD83D\uDC51",
            stats: {
              str: 12, dex: 4, con: 12, int: 6, wis: 8, cha: 10,
              ac: 21, naturalArmor: 6, atk: 9, speed: 25,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead", "dwarf", "boss"],
            hpOverride: 100,
          },
          {
            type: "custom",
            name: "Cursed Dwarven Honor Guard",
            emoji: "\uD83D\uDEE1\uFE0F",
            stats: {
              str: 8, dex: 3, con: 8, int: 2, wis: 3, cha: 2,
              ac: 18, naturalArmor: 4, atk: 5, speed: 20,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead", "dwarf"],
            hpOverride: 40,
          },
          {
            type: "custom",
            name: "Cursed Dwarven Honor Guard",
            emoji: "\uD83D\uDEE1\uFE0F",
            stats: {
              str: 8, dex: 3, con: 8, int: 2, wis: 3, cha: 2,
              ac: 18, naturalArmor: 4, atk: 5, speed: 20,
              lightningDmg: 0, fireDmg: 0,
              ...DEFAULT_BOON_FIELDS,
            },
            subtypes: ["undead", "dwarf"],
            hpOverride: 40,
          },
          { type: "monster", monsterId: "skeleton", emoji: "\uD83D\uDC80", count: 3, nameOverride: "Dwarven Skeleton", hpBoost: 5 },
        ],
        completionFlag: "axe_of_dwarvish_lords_leg4_done",
        rewardText: "King Bharek falls to one knee, the blue-white fire fading from the Axe as it clatters from his skeletal fingers. For a moment, his empty eye sockets regard you with something that might be respect. \"Worthy,\" he rasps, and then he is dust, and the crown rings against the stone floor. The Axe of the Dwarvish Lords lies before you — warm to the touch, perfectly balanced, thrumming with the memory of every king who held it. Somewhere in the mountain, the forge roars brighter, as if in approval.",
        rewardItems: ["axe_of_dwarvish_lords"],
        rewardGoldCp: 10000,
        questKeyword: "axe_awaits",
        goneChance: 0.25,
        goneText: "The throne is empty. The Axe's mounting brackets on the wall behind it are shattered outward — pulled free with tremendous force. Dwarvish runes on the floor glow faintly, recently activated. Someone who knew the old words came here before you. A single mithral rivet from the Axe's haft lies on the floor, still warm. The dwarves remember their own.",
        goneFollowupFlag: "axe_taken_by_dwarves",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Standalone "Already Gone" Artifact Rumors
// ---------------------------------------------------------------------------
// Self-contained single-encounter quests where the artifact was ALWAYS already
// taken. These exist to make the world feel lived-in — other adventurers,
// mercenaries, and monsters are also hunting for legendary gear. Players still
// get XP/loot from the fight, but no artifact at the end.
// ---------------------------------------------------------------------------

export const GONE_ARTIFACT_RUMORS: {
  id: string;
  flag: string;
  minCombined: number;
  desc: string;
  goneText: string;
  enemies: ArtifactEnemyDef[];
  difficulty: "medium" | "hard";
  minLevel: number;
}[] = [
  // --- The Circlet of Mezora ---
  {
    id: "circlet_of_mezora",
    flag: "gone_circlet_of_mezora",
    minCombined: 20,
    desc: "A trapper selling swamp pelts at the market swears he saw an elven ruin rising from the mire two days east — pillars of white stone wrapped in vines, half-sunk in black water. \"Something glinted in the statue's crown,\" he says, \"gold or crystal, bright enough to see through the fog.\" He marks the location on your map in charcoal, hand shaking. \"Don't go at night. The lizards own it after dark.\"",
    goneText: "Empty eye sockets in the statue where the gems once sat. Someone chiseled them out within the last tenday — the marks are fresh. A broken adventurer's pack lies nearby, its owner dragged into the swamp. The circlet is gone. The swamp took the thief too.",
    enemies: [
      { type: "monster", monsterId: "lizardfolk", emoji: "\uD83E\uDD8E", count: "scale" },
      {
        type: "custom",
        name: "Shambling Mound",
        emoji: "\uD83C\uDF3F",
        stats: {
          str: 10, dex: 2, con: 8, int: 1, wis: 3, cha: 1,
          ac: 17, naturalArmor: 5, atk: 5, speed: 20,
          lightningDmg: 0, fireDmg: 0,
          ...DEFAULT_BOON_FIELDS,
        },
        subtypes: ["plant"],
        hpOverride: 50,
      },
    ],
    difficulty: "medium",
    minLevel: 4,
  },

  // --- The Shield of Prator ---
  {
    id: "shield_of_prator",
    flag: "gone_shield_of_prator",
    minCombined: 24,
    desc: "A dwarf prospector, three fingers short of a full set, corners you near the bounty board. \"Hill giant in the Greytooth Caves,\" he says. \"Big bastard. Collects trophies — armor, weapons, skulls. Word is he's got a shield on his wall that turns blades like water. Prator's mark, if the old songs are true.\" He spits. \"I'd go myself, but—\" He waggles his maimed hand. \"You look stupid enough.\"",
    goneText: "The giant's cave reeks of blood — not all of it the giant's. Armored bootprints by the dozen, the marks of a professional outfit. A banner left behind reads 'Ironvow Company.' They took the shield and anything else worth carrying. You're weeks too late.",
    enemies: [
      { type: "monster", monsterId: "hill_giant", emoji: "\uD83E\uDDCC", count: 1 },
      { type: "monster", monsterId: "ogre", emoji: "\uD83D\uDC79", count: 1 },
    ],
    difficulty: "hard",
    minLevel: 6,
  },

  // --- The Lens of True Seeing ---
  {
    id: "lens_of_true_seeing",
    flag: "gone_lens_of_true_seeing",
    minCombined: 22,
    desc: "A scholar from the Arcane Quarter, nose buried in a crumbling star chart, nearly walks into you on the street. She adjusts her spectacles and blinks. \"You look capable. There's an observatory in the hills west of the trade road — pre-Imperial, utterly abandoned. My research suggests it housed a Lens of True Seeing, a divination focus of extraordinary power.\" She folds the chart carefully. \"The problem is the gargoyles. The original builders left guardians. Stone ones. Very territorial.\"",
    goneText: "The mounting is intact, but the lens itself lies in pieces on the floor — not broken by violence but by age. A thousand years of magical stress finally cracked it. The pieces still glow faintly. Maybe an artificer could do something with the shards, but the Lens of True Seeing is gone, consumed by its own power.",
    enemies: [
      { type: "monster", monsterId: "gargoyle", emoji: "\uD83E\uDEA8", count: 1 },
      {
        type: "custom",
        name: "Arcane Sentry",
        emoji: "\uD83D\uDD35",
        stats: {
          str: 6, dex: 5, con: 6, int: 3, wis: 5, cha: 1,
          ac: 17, naturalArmor: 4, atk: 5, speed: 25,
          lightningDmg: 2, fireDmg: 0,
          ...DEFAULT_BOON_FIELDS,
        },
        subtypes: ["construct", "arcane"],
        hpOverride: 35,
      },
      {
        type: "custom",
        name: "Arcane Sentry",
        emoji: "\uD83D\uDD35",
        stats: {
          str: 6, dex: 5, con: 6, int: 3, wis: 5, cha: 1,
          ac: 17, naturalArmor: 4, atk: 5, speed: 25,
          lightningDmg: 2, fireDmg: 0,
          ...DEFAULT_BOON_FIELDS,
        },
        subtypes: ["construct", "arcane"],
        hpOverride: 35,
      },
    ],
    difficulty: "medium",
    minLevel: 5,
  },
];
