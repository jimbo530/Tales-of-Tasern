// NFTs reserved as story characters — excluded from marketplace
export const STORY_NPCS: Set<string> = new Set(
  [
    "0xae195DF237739D6d43d4B796553f594C5ba516a7", // Pippin Thistledown
    "0x2685Bb66e8e45e386D3E816726De64d5001317fd", // Dag
    "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", // Rainbow Lily
    "0x212626D66E64C9C293A845687dB700c16466586e", // Glowing Geranium
    "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", // Electric Bird
    "0x716AdcbEd9Ef58CCf11434Aa7962b0f200A030af", // Captain Blackfeather
  ].map(a => a.toLowerCase())
);

export type Encounter = {
  name: string;
  description: string;
  aiDeckBias: "balanced" | "aggressive" | "defensive" | "magic";
  aiStrength: number; // 0.5 = weak, 1 = normal, 1.5 = strong
  mftReward: number;
  npcAddress?: string; // NFT contract address for a single named NPC opponent
  npcAddresses?: string[]; // Multiple NPC opponents
  joinsParty?: string; // NPC address that joins your party on win (if party < 4)
};

export type Chapter = {
  id: string;
  title: string;
  intro: string;
  image?: string; // background image path
  encounters: Encounter[];
  completionBonus: number; // MfT bonus for finishing the chapter
};

export const ADVENTURE_CHAPTERS: Chapter[] = [
  {
    id: "lv1",
    title: "The Crossroads Village",
    intro: "The village well stands at the center of six humble homes, each lit from within by warm lanternlight. The people here have lived through enough to know what the world demands of those who wander into it. Before you set foot on any road, they want to make sure you're ready.",
    image: "/adventure-level1.webp",
    encounters: [
      {
        name: "A Friendly Face",
        description: "Pippin leans against the well, arms crossed, watching you with a knowing grin. \"The world out there doesn't care if you're brave,\" he says. \"It cares if you can fight.\"\n\nHe draws a wooden training sword and explains: \"Place your heroes on the 3×3 grid. Each round you can move one square, then everyone attacks forward. Every strike rolls a D20 — roll a 1 and you miss completely, roll a 20 and you hit for double damage. Simple as that.\"\n\nHe takes a stance. \"Now let me see what you've got — don't hold back, I can take it.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.2,
        mftReward: 300,
        npcAddress: "0xae195DF237739D6d43d4B796553f594C5ba516a7",
      },
      {
        name: "The Lost Explorer",
        description: "A stocky figure sits on a stump near the village edge, sharpening an axe with practiced hands. \"Name's Dag,\" he says without looking up. \"Been here a while. Helped Pippin fix the well, cleared some brush, ate too much of Maren's soup.\" He finally meets your eyes. \"But I'm itching to move on. Problem is, the road's no place for a solo traveler anymore.\" He stands, testing the weight of his axe. \"Tell you what — prove you're worth traveling with and I'll join up. I'd rather know you can fight before I trust you with my back.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.25,
        mftReward: 400,
        npcAddress: "0x2685Bb66e8e45e386D3E816726De64d5001317fd",
        joinsParty: "0x2685Bb66e8e45e386D3E816726De64d5001317fd",
      },
      {
        name: "Maren's Warning",
        description: "Old Maren steps out of her cottage, wiping soil from her hands, her expression grave. \"You've done well so far, but listen to me carefully. The wilds beyond this village are nothing like what you've faced here. The plants themselves have turned — twisted by something dark seeping up from the earth. Even the flowers bite back.\" She gestures toward the treeline where strange lights pulse between the branches. \"Two of them have crept close to the village edge. A Rainbow Lily and a Glowing Geranium — beautiful, deadly. Clear them out before they spread, and you'll understand what I mean about the wilds.\"",
        aiDeckBias: "defensive",
        aiStrength: 0.3,
        mftReward: 500,
        npcAddresses: ["0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", "0x212626D66E64C9C293A845687dB700c16466586e"],
      },
      {
        name: "Guards of Kardov's Gate",
        description: "Nine guards from the Kardov garrison are passing through the village on patrol. Their captain nods at Torven. \"Heard you've got fresh recruits. Mind if we help?\" Torven grins. \"Show them what flanking looks like.\"\n\nThe captain turns to you. \"Lesson time. When your column is open — no one standing between you and the enemy — they'll come at you from the side for extra damage. That's flanking. We're going to surround you, and when one of us drops, another steps in from reserve. Out on the real road, nobody fights fair. Better you learn that here.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.3,
        mftReward: 600,
        npcAddresses: [
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guards of Kardov's Gate
        ],
      },
      {
        name: "The Scout's Challenge",
        description: "Kael drops from a low branch, pointing toward two crackling shapes perched in the canopy. \"Electric Birds. They hit with lightning — and it doesn't just hurt the one it strikes. It splashes to anyone standing in the next column over.\" She crosses her arms. \"Spread your heroes out. Don't cluster them side by side or one bolt takes down two. That's your lesson — positioning matters.\"",
        aiDeckBias: "aggressive",
        aiStrength: 0.4,
        mftReward: 600,
        npcAddresses: ["0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165"],
      },
      {
        name: "The Elder's Wisdom",
        description: "Elder Brynn sits by the fire, a heavy tome across her knees. \"You've faced each challenge alone. Now face them all at once.\" She stands and gestures across the village clearing. Every opponent you've fought steps forward — Pippin, Dag, the twisted plants, the guards, the Electric Birds — all of them, together.\n\n\"This is what the road looks like,\" Brynn says. \"Enemies don't take turns. They pile on. Nine will fight you on the field, and when one falls, another steps up from reserve. Watch for it — the moment you think you've won, reinforcements arrive. That's the lesson.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.45,
        mftReward: 700,
        npcAddresses: [
          "0xae195DF237739D6d43d4B796553f594C5ba516a7", // Pippin
          "0x2685Bb66e8e45e386D3E816726De64d5001317fd", // Dag
          "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", // Rainbow Lily
          "0x212626D66E64C9C293A845687dB700c16466586e", // Glowing Geranium
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard
          "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", // Electric Bird (reserve)
          "0x7F55796f79352Ab707e7FC41dD0B317Be6CBd165", // Electric Bird (reserve)
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard (reserve)
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard (reserve)
          "0x234b58EcdB0026B2AAF829cc46e91895F609f6d1", // Guard (reserve)
        ],
      },
      {
        name: "The Village Farewell",
        description: "All six villagers gather at the crossroads. Pippin claps your shoulder. \"You're ready — or as ready as anyone can be.\" Maren hands you a pouch of herbs. Torven nods silently. Kael is already gone, vanished into the trees ahead. Elder Brynn raises her hand. \"The road to Kardov's Gate lies north. What you find there will make this village feel like a dream. Go well.\" One final test — face them all together to prove your worth.",
        aiDeckBias: "balanced",
        aiStrength: 0.55,
        mftReward: 1000,
      },
    ],
    completionBonus: 1500,
  },
  {
    id: "lv2",
    title: "The Road to Kardov's Gate",
    intro: "The grateful villagers point you toward Kardov's Gate, where dark forces gather. The forest road is treacherous and grows darker with every mile.",
    encounters: [
      {
        name: "Goblin Ambush",
        description: "A ragged band of goblin warriors leaps from the undergrowth. They've been emboldened by the growing darkness.",
        aiDeckBias: "aggressive",
        aiStrength: 0.6,
        mftReward: 1000,
      },
      {
        name: "The Troll Bridge",
        description: "A massive stone bridge spans a raging river. Beneath it, a troll demands payment — or blood.",
        aiDeckBias: "defensive",
        aiStrength: 0.7,
        mftReward: 1500,
      },
      {
        name: "Wolves of the Darkwood",
        description: "As night falls, glowing eyes surround your camp. A pack of shadow wolves attacks from all sides.",
        aiDeckBias: "aggressive",
        aiStrength: 0.8,
        mftReward: 2000,
      },
    ],
    completionBonus: 2500,
  },
  {
    id: "lv3",
    title: "The Siege of Kardov",
    intro: "You arrive at Kardov's Gate to find it under siege. Dark forces surround the city walls and the guards are overwhelmed. The commander begs for your aid.",
    encounters: [
      {
        name: "The Outer Ranks",
        description: "Rows of undead soldiers march in formation outside the gate. Their hollow eyes glow with malice. Cut through their ranks!",
        aiDeckBias: "balanced",
        aiStrength: 0.85,
        mftReward: 2000,
      },
      {
        name: "The War Mages",
        description: "Enemy mages channel dark energy from atop a hill, raining fire on the city walls. Silence them before Kardov falls.",
        aiDeckBias: "magic",
        aiStrength: 0.95,
        mftReward: 3000,
      },
      {
        name: "The Siege Commander",
        description: "The enemy commander rides forth on a nightmare steed, flanked by elite guards. Defeat the commander and the siege breaks.",
        aiDeckBias: "balanced",
        aiStrength: 1.1,
        mftReward: 5000,
      },
    ],
    completionBonus: 5000,
  },
  {
    id: "lv4",
    title: "The Crypts Below",
    intro: "With Kardov saved, the commander reveals a terrible secret — the dark forces emerged from ancient crypts beneath the city. Something ancient has awakened in the depths.",
    encounters: [
      {
        name: "The Bone Hall",
        description: "The crypt entrance is lined with the bones of a thousand warriors. Skeletal sentinels rise from the walls to bar your path.",
        aiDeckBias: "defensive",
        aiStrength: 1.0,
        mftReward: 4000,
      },
      {
        name: "The Cursed Library",
        description: "An underground library pulses with forbidden magic. Spectral scholars attack with ancient spells.",
        aiDeckBias: "magic",
        aiStrength: 1.15,
        mftReward: 5000,
      },
      {
        name: "The Crypt Guardian",
        description: "A towering undead knight guards the inner sanctum. His armor is forged from cursed iron and his blade drains life.",
        aiDeckBias: "balanced",
        aiStrength: 1.3,
        mftReward: 6000,
      },
    ],
    completionBonus: 6000,
  },
  {
    id: "lv5",
    title: "The Shadow Realm",
    intro: "Beyond the crypts, a rift tears open into a realm of pure shadow. The source of the darkness lies within — a domain where nightmares take physical form.",
    encounters: [
      {
        name: "The Nightmare Swarm",
        description: "Writhing shadow creatures pour from every crack, their forms shifting between beast and phantom.",
        aiDeckBias: "aggressive",
        aiStrength: 1.2,
        mftReward: 5000,
      },
      {
        name: "The Mirror Knights",
        description: "Phantom warriors that mimic your every move. They fight with your own strength turned against you.",
        aiDeckBias: "balanced",
        aiStrength: 1.35,
        mftReward: 6000,
      },
      {
        name: "The Void Weaver",
        description: "A sorcerer of immense power weaves reality itself into weapons. Magic and steel blur together in this fight.",
        aiDeckBias: "magic",
        aiStrength: 1.5,
        mftReward: 8000,
      },
    ],
    completionBonus: 8000,
  },
  {
    id: "lv6",
    title: "The Lich King's Throne",
    intro: "At the heart of the Shadow Realm, a throne of dark crystal pulses with ancient power. The Lich King awaits — the architect of all the suffering. This is the final battle. Only the strongest champions will survive.",
    encounters: [
      {
        name: "The Royal Guard",
        description: "The Lich King's personal guard — death knights wreathed in dark flame. Each one was once a legendary warrior.",
        aiDeckBias: "balanced",
        aiStrength: 1.4,
        mftReward: 7000,
      },
      {
        name: "The Phylactery Chamber",
        description: "The Lich King's soul is bound to a phylactery guarded by arcane constructs. Destroy it to weaken him.",
        aiDeckBias: "magic",
        aiStrength: 1.6,
        mftReward: 8000,
      },
      {
        name: "The Lich King",
        description: "The ancient lich rises from his throne, darkness incarnate. His power is beyond mortal comprehension. This is your ultimate test — the fate of Tasern hangs in the balance.",
        aiDeckBias: "magic",
        aiStrength: 1.8,
        mftReward: 15000,
      },
    ],
    completionBonus: 15000,
  },
];
