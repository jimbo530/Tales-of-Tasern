// NFTs reserved as story characters — excluded from marketplace
export const STORY_NPCS: Set<string> = new Set(
  [
    "0xae195DF237739D6d43d4B796553f594C5ba516a7", // Pippin Thistledown
    "0x2685Bb66e8e45e386D3E816726De64d5001317fd", // Dag
    "0x6AD5621f5719A6b32d0Ea9dd4493ca6Ac0639D4B", // Rainbow Lily
    "0x212626D66E64C9C293A845687dB700c16466586e", // Glowing Geranium
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
        description: "Pippin leans against the well, arms crossed, watching you with a knowing grin. \"The world out there doesn't care if you're brave,\" he says. \"It cares if you can fight. Let me see what you've got — don't hold back, I can take it.\" He draws a wooden training sword and takes a stance. This is a sparring match — prove to Pippin you can handle yourself.",
        aiDeckBias: "balanced",
        aiStrength: 0.2,
        mftReward: 300,
        npcAddress: "0xae195DF237739D6d43d4B796553f594C5ba516a7",
      },
      {
        name: "The Lost Explorer",
        description: "A stocky figure stumbles out of the undergrowth near the village edge, wild-eyed and breathing hard. \"Don't — don't go that way,\" he gasps, gripping a battered axe. \"Name's Dag. Been lost in these woods for three days. Something's out there — something big.\" He squints at you suspiciously. \"How do I know you're not bandits? Prove you can handle yourselves and maybe we travel together. Strength in numbers, yeah?\"",
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
        name: "The Blacksmith's Guard",
        description: "Torven steps out from behind his forge, flanked by armored figures. \"You've handled two plants and a lost woodsman,\" he says flatly. \"Out there, you won't face two enemies — you'll face twelve. Maybe more.\" He crosses his arms as his guards fan out across the yard, filling every inch of ground. Nine take position on the field, three more wait in reserve behind them. \"When one falls, another steps forward. That's how a real army works. Show me you can handle being outnumbered — because you will be.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.3,
        mftReward: 600,
        npcAddresses: [
          "0x98ACF6F032E254BE6F9D46407077F9e7e896Db7b", // Thistlebeard
          "0x20876b539Df03415c9c11B8B35D371FbaC7e03dD", // Granite Thornefoot
          "0x6271989f518Ea0010dd478665ED9547E226DB7E8", // Eldric Greenleaf
          "0x749AB1afa0cAaCb6f8b8E75F87cB79a97E43315B", // Zogthar
          "0xE0D994881f5cf5Af0Dd855778AEF710fCF3348ae", // Amanthar
          "0x8003e3d06309c6D332A7eD2a62285cb06cb5f08d", // Farlok
          "0xB2C386Cc2cfe12e2733B4b8bb0cCCc60f49750A8", // Tharok
          "0x5fba5ADf77EE9eA40D43C97C12A72dEE3a0B0FBA", // Orcala
          "0x22ffB7ef5772B702071cF77238bfe2138BB4262E", // Korak
          "0x65bcb623C4d9EA9A5Bdea8984ce857d117BE1606", // Thalindor (reserve)
          "0xbF50dD7eEACB02838085085De26C17c598F14d03", // Wolverine Stormrunner (reserve)
          "0xad56aF3Fc6d06A6DC50BfF752c485c2481CDcb93", // Reginald Featherstone (reserve)
        ],
      },
      {
        name: "The Scout's Challenge",
        description: "Kael drops from a low branch, silent as a shadow. \"Speed kills,\" she says simply. \"Not yours — theirs. Everything out there is faster than it looks. If you can't match aggression with aggression, you'll be overwhelmed before you draw your blade.\" She pulls two short daggers and beckons. \"Come on. Fast as you can.\"",
        aiDeckBias: "aggressive",
        aiStrength: 0.4,
        mftReward: 600,
      },
      {
        name: "The Elder's Wisdom",
        description: "Elder Brynn sits by the fire, a heavy tome across her knees. \"The others teach you how to fight. I'll teach you why it matters.\" She closes the book and stands slowly. \"Every battle you win out there protects this village. Every stat you build, every LP you earn — it flows back into the world. Power up your champions and the realm grows stronger with you.\" She raises a gnarled staff. \"Now — one last test before I let you leave.\"",
        aiDeckBias: "balanced",
        aiStrength: 0.45,
        mftReward: 700,
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
