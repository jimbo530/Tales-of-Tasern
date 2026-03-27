export type Encounter = {
  name: string;
  description: string;
  aiDeckBias: "balanced" | "aggressive" | "defensive" | "magic";
  aiStrength: number; // 0.5 = weak, 1 = normal, 1.5 = strong
  mftReward: number;
};

export type Chapter = {
  id: string;
  title: string;
  intro: string;
  encounters: Encounter[];
  completionBonus: number; // MfT bonus for finishing the chapter
};

export const ADVENTURE_CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    title: "The Road to Kardov's Gate",
    intro: "You set out from the village of Alderwell, following rumors of dark creatures gathering near the ancient walls of Kardov's Gate. The road is long and the woods grow thick with shadow. Your champions must be ready — danger lurks at every turn.",
    encounters: [
      {
        name: "Goblin Scouts",
        description: "A ragged band of goblin scouts blocks the forest path. They snarl and brandish crude weapons. An easy fight — but stay sharp.",
        aiDeckBias: "aggressive",
        aiStrength: 0.4,
        mftReward: 500,
      },
      {
        name: "The Troll Bridge",
        description: "A massive stone bridge spans a raging river. Beneath it, a troll demands payment — or blood. Your champions ready their weapons.",
        aiDeckBias: "defensive",
        aiStrength: 0.6,
        mftReward: 1000,
      },
      {
        name: "Wolves of the Darkwood",
        description: "As night falls, glowing eyes surround your camp. A pack of shadow wolves attacks from all sides. Defend your party!",
        aiDeckBias: "aggressive",
        aiStrength: 0.7,
        mftReward: 1500,
      },
    ],
    completionBonus: 2000,
  },
  {
    id: "ch2",
    title: "The Siege of Kardov",
    intro: "You arrive at Kardov's Gate to find it under siege. Dark forces have surrounded the city walls, and the guards are overwhelmed. The commander begs for your aid — breach the enemy lines and save the city.",
    encounters: [
      {
        name: "The Outer Ranks",
        description: "Rows of undead soldiers march in formation outside the gate. Their hollow eyes glow with malice. Cut through their ranks!",
        aiDeckBias: "balanced",
        aiStrength: 0.8,
        mftReward: 2000,
      },
      {
        name: "The War Mages",
        description: "Enemy mages channel dark energy from atop a hill, raining fire on the city walls. You must silence them before Kardov falls.",
        aiDeckBias: "magic",
        aiStrength: 0.9,
        mftReward: 3000,
      },
      {
        name: "The Siege Commander",
        description: "The enemy commander rides forth on a nightmare steed, flanked by elite guards. Defeat the commander and the siege breaks. This is the decisive battle.",
        aiDeckBias: "balanced",
        aiStrength: 1.1,
        mftReward: 5000,
      },
    ],
    completionBonus: 5000,
  },
  {
    id: "ch3",
    title: "The Crypts Below",
    intro: "With Kardov saved, the commander reveals a terrible secret — the dark forces emerged from ancient crypts beneath the city. Something ancient has awakened. You must descend into the depths and end the threat at its source.",
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
        description: "An underground library pulses with forbidden magic. Spectral scholars attack with ancient spells. Knowledge is their weapon.",
        aiDeckBias: "magic",
        aiStrength: 1.2,
        mftReward: 5000,
      },
      {
        name: "The Lich King",
        description: "At the heart of the crypts, an ancient lich sits upon a throne of dark crystal. His power is immense. Only the strongest champions can hope to prevail. This is your ultimate test.",
        aiDeckBias: "magic",
        aiStrength: 1.5,
        mftReward: 10000,
      },
    ],
    completionBonus: 10000,
  },
];
