// D&D 3.5 SRD Feats — adapted for Tales of Tasern
// In-game these are called "abilities" but code uses "Feat" for D&D familiarity.
// Source: https://www.d20srd.org/indexes/feats.htm

import type { Ability } from "./skills";

// ── Types ────────────────────────────────────────────────────────────────────

export type FeatCategory = "general" | "combat" | "magic" | "skill";

export type FeatPrereq = {
  minAbility?: { ability: Ability; score: number };
  minBAB?: number;
  minLevel?: number;
  feat?: string;        // requires another feat first
  classOnly?: string[]; // only available to these classes
};

export type Feat = {
  id: string;
  name: string;
  category: FeatCategory;
  description: string;
  prereqs: FeatPrereq;
  benefit: string;      // mechanical effect
  canTakeMultiple?: boolean;
};

// ── Combat Feats ─────────────────────────────────────────────────────────────

const COMBAT_FEATS: Feat[] = [
  // ─── Power Attack tree ───
  {
    id: "power-attack",
    name: "Power Attack",
    category: "combat",
    description: "Trade accuracy for raw damage on melee attacks.",
    prereqs: { minAbility: { ability: "str", score: 13 } },
    benefit: "On your turn, before attacking, you may subtract up to your BAB from your melee attack roll and add that amount to your melee damage roll.",
  },
  {
    id: "cleave",
    name: "Cleave",
    category: "combat",
    description: "Follow through with a mighty swing when you drop a foe.",
    prereqs: { minAbility: { ability: "str", score: 13 }, feat: "power-attack" },
    benefit: "If you deal enough damage to drop an enemy, you immediately get an extra melee attack against another adjacent foe at the same bonus.",
  },
  {
    id: "great-cleave",
    name: "Great Cleave",
    category: "combat",
    description: "Your cleaving strikes know no limit.",
    prereqs: { minAbility: { ability: "str", score: 13 }, feat: "cleave", minBAB: 4 },
    benefit: "As Cleave, but you may make unlimited additional attacks each round as long as each one drops a foe.",
  },
  {
    id: "improved-bull-rush",
    name: "Improved Bull Rush",
    category: "combat",
    description: "You are skilled at driving foes backward.",
    prereqs: { minAbility: { ability: "str", score: 13 }, feat: "power-attack" },
    benefit: "+4 bonus on bull rush attempts. Does not provoke an attack of opportunity.",
  },
  {
    id: "improved-sunder",
    name: "Improved Sunder",
    category: "combat",
    description: "You are skilled at destroying enemy equipment.",
    prereqs: { minAbility: { ability: "str", score: 13 }, feat: "power-attack" },
    benefit: "+4 bonus on sunder attempts. Does not provoke an attack of opportunity.",
  },
  {
    id: "improved-overrun",
    name: "Improved Overrun",
    category: "combat",
    description: "You are skilled at knocking down foes as you run past.",
    prereqs: { minAbility: { ability: "str", score: 13 }, feat: "power-attack" },
    benefit: "+4 bonus on overrun attempts. Target may not choose to avoid you.",
  },

  // ─── Initiative & general combat ───
  {
    id: "improved-initiative",
    name: "Improved Initiative",
    category: "combat",
    description: "You react faster than most in the chaos of battle.",
    prereqs: {},
    benefit: "+4 bonus on initiative checks.",
  },
  {
    id: "weapon-focus",
    name: "Weapon Focus",
    category: "combat",
    description: "You are especially accurate with your weapon of choice.",
    prereqs: { minBAB: 1 },
    benefit: "+1 attack bonus with the selected weapon type.",
    canTakeMultiple: true,
  },
  {
    id: "weapon-specialization",
    name: "Weapon Specialization",
    category: "combat",
    description: "You deal extra damage with your chosen weapon.",
    prereqs: { minBAB: 4, feat: "weapon-focus", classOnly: ["fighter"] },
    benefit: "+2 damage with the selected weapon type.",
    canTakeMultiple: true,
  },
  {
    id: "greater-weapon-focus",
    name: "Greater Weapon Focus",
    category: "combat",
    description: "Your precision with your weapon of choice is legendary.",
    prereqs: { minBAB: 8, feat: "weapon-focus", classOnly: ["fighter"] },
    benefit: "+1 attack bonus (stacks with Weapon Focus for +2 total) with the selected weapon type.",
    canTakeMultiple: true,
  },
  {
    id: "greater-weapon-specialization",
    name: "Greater Weapon Specialization",
    category: "combat",
    description: "Your strikes with your chosen weapon are devastating.",
    prereqs: { minBAB: 12, feat: "weapon-specialization", classOnly: ["fighter"] },
    benefit: "+2 damage (stacks with Weapon Specialization for +4 total) with the selected weapon type.",
    canTakeMultiple: true,
  },
  {
    id: "weapon-finesse",
    name: "Weapon Finesse",
    category: "combat",
    description: "You use agility instead of brute force for melee strikes with light weapons.",
    prereqs: { minBAB: 1 },
    benefit: "Use DEX modifier instead of STR modifier on attack rolls with light melee weapons.",
  },
  {
    id: "improved-critical",
    name: "Improved Critical",
    category: "combat",
    description: "Your attacks find weak points more often.",
    prereqs: { minBAB: 8 },
    benefit: "Double the critical threat range of the selected weapon.",
    canTakeMultiple: true,
  },
  {
    id: "blind-fight",
    name: "Blind-Fight",
    category: "combat",
    description: "You fight by instinct, even when you cannot see.",
    prereqs: {},
    benefit: "In melee, if you miss due to concealment you may re-roll the miss chance once. You do not lose DEX bonus to AC against invisible attackers.",
  },

  // ─── Two-Weapon Fighting tree ───
  {
    id: "two-weapon-fighting",
    name: "Two-Weapon Fighting",
    category: "combat",
    description: "You can fight effectively with a weapon in each hand.",
    prereqs: { minAbility: { ability: "dex", score: 15 } },
    benefit: "Reduce the penalty for fighting with two weapons. Primary hand: -2, off-hand: -2 (instead of -6/-10).",
  },
  {
    id: "improved-two-weapon-fighting",
    name: "Improved Two-Weapon Fighting",
    category: "combat",
    description: "You gain a second off-hand attack.",
    prereqs: { minAbility: { ability: "dex", score: 17 }, feat: "two-weapon-fighting", minBAB: 6 },
    benefit: "Get a second off-hand attack at -5 penalty.",
  },
  {
    id: "greater-two-weapon-fighting",
    name: "Greater Two-Weapon Fighting",
    category: "combat",
    description: "You gain a third off-hand attack.",
    prereqs: { minAbility: { ability: "dex", score: 19 }, feat: "improved-two-weapon-fighting", minBAB: 11 },
    benefit: "Get a third off-hand attack at -10 penalty.",
  },
  {
    id: "two-weapon-defense",
    name: "Two-Weapon Defense",
    category: "combat",
    description: "Wielding two weapons lets you parry incoming blows.",
    prereqs: { minAbility: { ability: "dex", score: 15 }, feat: "two-weapon-fighting" },
    benefit: "+1 shield bonus to AC when wielding two weapons.",
  },

  // ─── Ranged combat tree ───
  {
    id: "point-blank-shot",
    name: "Point Blank Shot",
    category: "combat",
    description: "You are deadly at close range with ranged weapons.",
    prereqs: {},
    benefit: "+1 attack and +1 damage with ranged weapons against targets within 30 ft.",
  },
  {
    id: "precise-shot",
    name: "Precise Shot",
    category: "combat",
    description: "You can fire into melee without hitting your allies.",
    prereqs: { feat: "point-blank-shot" },
    benefit: "No -4 penalty for shooting into melee combat.",
  },
  {
    id: "improved-precise-shot",
    name: "Improved Precise Shot",
    category: "combat",
    description: "Your arrows find their mark despite cover and concealment.",
    prereqs: { minAbility: { ability: "dex", score: 19 }, feat: "precise-shot", minBAB: 11 },
    benefit: "Ignore anything less than total cover and total concealment on ranged attacks.",
  },
  {
    id: "rapid-shot",
    name: "Rapid Shot",
    category: "combat",
    description: "You can fire an extra projectile each round.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, feat: "point-blank-shot" },
    benefit: "As a full-round action, get one extra ranged attack at your highest BAB, but all attacks that round take a -2 penalty.",
  },
  {
    id: "manyshot",
    name: "Manyshot",
    category: "combat",
    description: "You can fire multiple arrows simultaneously.",
    prereqs: { minAbility: { ability: "dex", score: 17 }, feat: "rapid-shot", minBAB: 6 },
    benefit: "As a standard action, fire two arrows at a single target. For every +5 BAB beyond +6, add one more arrow (max 4).",
  },
  {
    id: "far-shot",
    name: "Far Shot",
    category: "combat",
    description: "Your ranged attacks reach further than normal.",
    prereqs: { feat: "point-blank-shot" },
    benefit: "Range increment penalty is -1 per increment instead of -2. Thrown weapons range increments increase by 50%.",
  },
  {
    id: "shot-on-the-run",
    name: "Shot on the Run",
    category: "combat",
    description: "You can move, fire, and keep moving.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, feat: "point-blank-shot", minBAB: 4 },
    benefit: "When using the attack action with a ranged weapon, you may move before and after the attack as long as total movement does not exceed your speed.",
  },

  // ─── Dodge tree ───
  {
    id: "dodge",
    name: "Dodge",
    category: "combat",
    description: "You are adept at evading incoming blows.",
    prereqs: { minAbility: { ability: "dex", score: 13 } },
    benefit: "+1 dodge bonus to AC against one designated opponent per round.",
  },
  {
    id: "mobility",
    name: "Mobility",
    category: "combat",
    description: "You can slip past foes without exposing yourself.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, feat: "dodge" },
    benefit: "+4 dodge bonus to AC against attacks of opportunity caused by movement.",
  },
  {
    id: "spring-attack",
    name: "Spring Attack",
    category: "combat",
    description: "You can dart in, strike, and dart back out.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, feat: "mobility", minBAB: 4 },
    benefit: "When using the attack action, you may move both before and after the attack as long as total movement does not exceed your speed. Does not provoke AoO from the target.",
  },
  {
    id: "whirlwind-attack",
    name: "Whirlwind Attack",
    category: "combat",
    description: "You spin through combat, striking all adjacent foes at once.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, feat: "spring-attack", minBAB: 4 },
    benefit: "As a full-round action, make one melee attack at full BAB against each opponent you threaten.",
  },

  // ─── Combat maneuver feats ───
  {
    id: "combat-reflexes",
    name: "Combat Reflexes",
    category: "combat",
    description: "You can react to many threats simultaneously.",
    prereqs: { minAbility: { ability: "dex", score: 13 } },
    benefit: "You may make a number of extra attacks of opportunity per round equal to your DEX modifier. You may also make AoOs while flat-footed.",
  },
  {
    id: "improved-disarm",
    name: "Improved Disarm",
    category: "combat",
    description: "You are skilled at knocking weapons from enemy hands.",
    prereqs: { minAbility: { ability: "int", score: 13 } },
    benefit: "+4 bonus on disarm attempts. Does not provoke an attack of opportunity.",
  },
  {
    id: "improved-trip",
    name: "Improved Trip",
    category: "combat",
    description: "You are skilled at tripping opponents in combat.",
    prereqs: { minAbility: { ability: "int", score: 13 } },
    benefit: "+4 bonus on trip attempts. Does not provoke AoO. If you trip a foe, you get a free melee attack against them.",
  },
  {
    id: "improved-feint",
    name: "Improved Feint",
    category: "combat",
    description: "You are skilled at misleading foes in combat.",
    prereqs: { minAbility: { ability: "int", score: 13 } },
    benefit: "You can feint in combat as a move action instead of a standard action.",
  },
  {
    id: "combat-expertise",
    name: "Combat Expertise",
    category: "combat",
    description: "You trade offensive power for defensive awareness.",
    prereqs: { minAbility: { ability: "int", score: 13 } },
    benefit: "On your turn, subtract up to 5 from your attack roll and add that number to your AC until your next turn.",
  },
  {
    id: "improved-grapple",
    name: "Improved Grapple",
    category: "combat",
    description: "You are skilled at seizing and restraining foes.",
    prereqs: { minAbility: { ability: "dex", score: 13 } },
    benefit: "+4 bonus on grapple checks. Does not provoke an attack of opportunity to start a grapple.",
  },
  {
    id: "stunning-fist",
    name: "Stunning Fist",
    category: "combat",
    description: "You can stun an opponent with an unarmed strike.",
    prereqs: { minAbility: { ability: "dex", score: 13 }, minBAB: 8 },
    benefit: "Declare before attacking. Target must make a Fortitude save (DC 10 + half your level + WIS mod) or be stunned for 1 round. Usable once per round.",
  },
  {
    id: "deflect-arrows",
    name: "Deflect Arrows",
    category: "combat",
    description: "You can knock aside one incoming ranged attack per round.",
    prereqs: { minAbility: { ability: "dex", score: 13 } },
    benefit: "Once per round, when you would be hit by a ranged weapon, you may deflect it so it deals no damage. You must have a hand free.",
  },
  {
    id: "snatch-arrows",
    name: "Snatch Arrows",
    category: "combat",
    description: "You pluck arrows from the air and hurl them back.",
    prereqs: { minAbility: { ability: "dex", score: 15 }, feat: "deflect-arrows" },
    benefit: "When you deflect an arrow, you may catch it and immediately throw it back as a free action.",
  },

  // ─── Mounted combat ───
  {
    id: "mounted-combat",
    name: "Mounted Combat",
    category: "combat",
    description: "You are skilled at protecting your mount in battle.",
    prereqs: {},
    benefit: "Once per round, make a Ride check to negate a hit against your mount. The Ride check result replaces the mount's AC if it is higher.",
  },
  {
    id: "mounted-archery",
    name: "Mounted Archery",
    category: "combat",
    description: "You are an expert at using ranged weapons from the saddle.",
    prereqs: { feat: "mounted-combat" },
    benefit: "Halve the penalty for ranged attacks while mounted (-2 instead of -4 at half speed, -4 instead of -8 at full gallop).",
  },
  {
    id: "ride-by-attack",
    name: "Ride-By Attack",
    category: "combat",
    description: "You can strike in passing while riding.",
    prereqs: { feat: "mounted-combat" },
    benefit: "When mounted and using the charge action, you may move, attack, and continue moving. Your total distance cannot exceed double your mount's speed.",
  },
  {
    id: "spirited-charge",
    name: "Spirited Charge",
    category: "combat",
    description: "Your mounted charges are devastating.",
    prereqs: { feat: "ride-by-attack" },
    benefit: "Deal double damage on a mounted charge (triple with a lance).",
  },
  {
    id: "trample",
    name: "Trample",
    category: "combat",
    description: "You can ride down smaller foes.",
    prereqs: { feat: "mounted-combat" },
    benefit: "When you overrun while mounted, your mount may make one hoof attack against the trampled foe.",
  },

  // ─── Shield feats ───
  {
    id: "improved-shield-bash",
    name: "Improved Shield Bash",
    category: "combat",
    description: "You can bash with a shield and keep defending.",
    prereqs: {},
    benefit: "When you perform a shield bash, you retain your shield's AC bonus for the rest of the round.",
  },
  {
    id: "shield-proficiency",
    name: "Shield Proficiency",
    category: "combat",
    description: "You know how to use shields effectively.",
    prereqs: {},
    benefit: "You can use a shield without penalty. Armor check penalty applies only to non-proficient users.",
  },
  {
    id: "tower-shield-proficiency",
    name: "Tower Shield Proficiency",
    category: "combat",
    description: "You can use a tower shield without penalty.",
    prereqs: { feat: "shield-proficiency" },
    benefit: "You can use a tower shield and gain its full +4 shield bonus to AC.",
  },

  // ─── Extra combat feats ───
  {
    id: "quick-draw",
    name: "Quick Draw",
    category: "combat",
    description: "You can draw weapons with blinding speed.",
    prereqs: { minBAB: 1 },
    benefit: "You can draw a weapon as a free action instead of a move action.",
  },
  {
    id: "rapid-reload",
    name: "Rapid Reload",
    category: "combat",
    description: "You can reload crossbows faster than normal.",
    prereqs: {},
    benefit: "Reduce the reload time of the selected crossbow type by one step (full-round to standard, standard to move, move to free).",
    canTakeMultiple: true,
  },
  {
    id: "exotic-weapon-proficiency",
    name: "Exotic Weapon Proficiency",
    category: "combat",
    description: "You know how to use an unusual or foreign weapon.",
    prereqs: { minBAB: 1 },
    benefit: "You make attack rolls with the selected exotic weapon without the -4 nonproficiency penalty.",
    canTakeMultiple: true,
  },
  {
    id: "improved-unarmed-strike",
    name: "Improved Unarmed Strike",
    category: "combat",
    description: "You are skilled at fighting with bare hands.",
    prereqs: {},
    benefit: "Your unarmed strikes deal lethal damage. You do not provoke AoO when attacking unarmed.",
  },
  {
    id: "power-critical",
    name: "Power Critical",
    category: "combat",
    description: "Your critical hits land more reliably.",
    prereqs: { feat: "weapon-focus", minBAB: 4 },
    benefit: "+4 bonus on the roll to confirm a critical hit with the selected weapon.",
    canTakeMultiple: true,
  },
];

// ── General Feats ────────────────────────────────────────────────────────────

const GENERAL_FEATS: Feat[] = [
  {
    id: "toughness",
    name: "Toughness",
    category: "general",
    description: "You are physically tougher than most.",
    prereqs: {},
    benefit: "+3 hit points.",
    canTakeMultiple: true,
  },
  {
    id: "great-fortitude",
    name: "Great Fortitude",
    category: "general",
    description: "You have an iron stomach and powerful resilience.",
    prereqs: {},
    benefit: "+2 bonus on all Fortitude saving throws.",
  },
  {
    id: "iron-will",
    name: "Iron Will",
    category: "general",
    description: "You have trained your mind to resist mental attacks.",
    prereqs: {},
    benefit: "+2 bonus on all Will saving throws.",
  },
  {
    id: "lightning-reflexes",
    name: "Lightning Reflexes",
    category: "general",
    description: "Your reflexes are sharper than most.",
    prereqs: {},
    benefit: "+2 bonus on all Reflex saving throws.",
  },
  {
    id: "endurance",
    name: "Endurance",
    category: "general",
    description: "You can push through exhaustion far beyond normal limits.",
    prereqs: {},
    benefit: "+4 bonus on checks and saves against fatigue, suffocation, forced marches, starvation, thirst, and extreme environments.",
  },
  {
    id: "diehard",
    name: "Diehard",
    category: "general",
    description: "You refuse to die easily.",
    prereqs: { feat: "endurance" },
    benefit: "When reduced to negative HP, you automatically stabilize. You may act while at negative HP (taking 1 damage per round).",
  },
  {
    id: "run",
    name: "Run",
    category: "general",
    description: "You are a swift runner.",
    prereqs: {},
    benefit: "When running, move 5x your speed instead of 4x. You retain your DEX bonus to AC while running.",
  },
  {
    id: "track",
    name: "Track",
    category: "general",
    description: "You can follow the trails of creatures and people.",
    prereqs: {},
    benefit: "Use the Survival skill to follow tracks. The DC depends on the surface and conditions.",
  },
  {
    id: "armor-proficiency-light",
    name: "Armor Proficiency (Light)",
    category: "general",
    description: "You know how to wear light armor effectively.",
    prereqs: {},
    benefit: "You can wear light armor without the nonproficiency penalty on attack rolls.",
  },
  {
    id: "armor-proficiency-medium",
    name: "Armor Proficiency (Medium)",
    category: "general",
    description: "You know how to wear medium armor effectively.",
    prereqs: { feat: "armor-proficiency-light" },
    benefit: "You can wear medium armor without the nonproficiency penalty on attack rolls.",
  },
  {
    id: "armor-proficiency-heavy",
    name: "Armor Proficiency (Heavy)",
    category: "general",
    description: "You know how to wear heavy armor effectively.",
    prereqs: { feat: "armor-proficiency-medium" },
    benefit: "You can wear heavy armor without the nonproficiency penalty on attack rolls.",
  },
  {
    id: "simple-weapon-proficiency",
    name: "Simple Weapon Proficiency",
    category: "general",
    description: "You know how to use all simple weapons.",
    prereqs: {},
    benefit: "Make attack rolls with simple weapons normally (no -4 nonproficiency penalty).",
  },
  {
    id: "martial-weapon-proficiency",
    name: "Martial Weapon Proficiency",
    category: "general",
    description: "You know how to use a category of martial weapons.",
    prereqs: {},
    benefit: "Make attack rolls with the selected martial weapon normally.",
    canTakeMultiple: true,
  },
  {
    id: "improved-natural-armor",
    name: "Improved Natural Armor",
    category: "general",
    description: "Your hide is unnaturally thick.",
    prereqs: { minAbility: { ability: "con", score: 13 } },
    benefit: "+1 natural armor bonus to AC.",
    canTakeMultiple: true,
  },
];

// ── Skill Feats ──────────────────────────────────────────────────────────────

const SKILL_FEATS: Feat[] = [
  {
    id: "skill-focus",
    name: "Skill Focus",
    category: "skill",
    description: "You have a special knack for a particular skill.",
    prereqs: {},
    benefit: "+3 bonus on all checks with the selected skill.",
    canTakeMultiple: true,
  },
  {
    id: "alertness",
    name: "Alertness",
    category: "skill",
    description: "You have finely tuned senses.",
    prereqs: {},
    benefit: "+2 bonus on Listen and Spot checks.",
  },
  {
    id: "stealthy",
    name: "Stealthy",
    category: "skill",
    description: "You move with practiced silence and concealment.",
    prereqs: {},
    benefit: "+2 bonus on Hide and Move Silently checks.",
  },
  {
    id: "persuasive",
    name: "Persuasive",
    category: "skill",
    description: "You have a commanding presence.",
    prereqs: {},
    benefit: "+2 bonus on Bluff and Intimidate checks.",
  },
  {
    id: "negotiator",
    name: "Negotiator",
    category: "skill",
    description: "You are skilled at getting others to agree with you.",
    prereqs: {},
    benefit: "+2 bonus on Diplomacy and Sense Motive checks.",
  },
  {
    id: "investigator",
    name: "Investigator",
    category: "skill",
    description: "You have a nose for finding clues and information.",
    prereqs: {},
    benefit: "+2 bonus on Gather Information and Search checks.",
  },
  {
    id: "nimble-fingers",
    name: "Nimble Fingers",
    category: "skill",
    description: "You have exceptional manual dexterity.",
    prereqs: {},
    benefit: "+2 bonus on Disable Device and Open Lock checks.",
  },
  {
    id: "athletic",
    name: "Athletic",
    category: "skill",
    description: "You possess natural physical prowess.",
    prereqs: {},
    benefit: "+2 bonus on Climb and Swim checks.",
  },
  {
    id: "acrobatic",
    name: "Acrobatic",
    category: "skill",
    description: "You have excellent balance and agility.",
    prereqs: {},
    benefit: "+2 bonus on Jump and Tumble checks.",
  },
  {
    id: "deceitful",
    name: "Deceitful",
    category: "skill",
    description: "You have a talent for deception.",
    prereqs: {},
    benefit: "+2 bonus on Disguise and Forgery checks.",
  },
  {
    id: "diligent",
    name: "Diligent",
    category: "skill",
    description: "You are meticulous and hardworking.",
    prereqs: {},
    benefit: "+2 bonus on Appraise and Decipher Script checks.",
  },
  {
    id: "self-sufficient",
    name: "Self-Sufficient",
    category: "skill",
    description: "You can take care of yourself in the wild.",
    prereqs: {},
    benefit: "+2 bonus on Heal and Survival checks.",
  },
  {
    id: "magical-aptitude",
    name: "Magical Aptitude",
    category: "skill",
    description: "You have a knack for magical endeavors.",
    prereqs: {},
    benefit: "+2 bonus on Spellcraft and Use Magic Device checks.",
  },
  {
    id: "animal-affinity",
    name: "Animal Affinity",
    category: "skill",
    description: "You are good with animals.",
    prereqs: {},
    benefit: "+2 bonus on Handle Animal and Ride checks.",
  },
  {
    id: "agile",
    name: "Agile",
    category: "skill",
    description: "You are unusually limber.",
    prereqs: {},
    benefit: "+2 bonus on Balance and Escape Artist checks.",
  },
  {
    id: "open-minded",
    name: "Open Minded",
    category: "skill",
    description: "You pick up new skills quickly.",
    prereqs: {},
    benefit: "Immediately gain 5 extra skill points to spend as you choose.",
  },
];

// ── Magic Feats ──────────────────────────────────────────────────────────────

const MAGIC_FEATS: Feat[] = [
  {
    id: "combat-casting",
    name: "Combat Casting",
    category: "magic",
    description: "You are adept at casting spells while under threat.",
    prereqs: {},
    benefit: "+4 bonus on Concentration checks made to cast a spell or use spell-like ability while on the defensive or while grappling.",
  },
  {
    id: "spell-focus",
    name: "Spell Focus",
    category: "magic",
    description: "Your spells from one school are harder to resist.",
    prereqs: {},
    benefit: "+1 to the save DC for all spells of the selected school of magic.",
    canTakeMultiple: true,
  },
  {
    id: "greater-spell-focus",
    name: "Greater Spell Focus",
    category: "magic",
    description: "Your mastery of a spell school makes your magic nearly irresistible.",
    prereqs: { feat: "spell-focus" },
    benefit: "+1 to save DC for the selected school (stacks with Spell Focus for +2 total).",
    canTakeMultiple: true,
  },
  {
    id: "spell-penetration",
    name: "Spell Penetration",
    category: "magic",
    description: "Your spells break through magical defenses more easily.",
    prereqs: {},
    benefit: "+2 bonus on caster level checks to overcome a creature's spell resistance.",
  },
  {
    id: "greater-spell-penetration",
    name: "Greater Spell Penetration",
    category: "magic",
    description: "Your spells are almost impossible to resist.",
    prereqs: { feat: "spell-penetration" },
    benefit: "+2 bonus on caster level checks to overcome spell resistance (stacks with Spell Penetration for +4 total).",
  },
  {
    id: "improved-counterspell",
    name: "Improved Counterspell",
    category: "magic",
    description: "You can use any spell of the same school to counter an enemy spell.",
    prereqs: {},
    benefit: "When counterspelling, you may use a spell of the same school that is one or more spell levels higher than the target spell.",
  },
  {
    id: "augment-summoning",
    name: "Augment Summoning",
    category: "magic",
    description: "Your summoned creatures are stronger than normal.",
    prereqs: { feat: "spell-focus" },
    benefit: "All creatures you summon gain +4 STR and +4 CON.",
  },

  // ─── Metamagic feats ───
  {
    id: "empower-spell",
    name: "Empower Spell",
    category: "magic",
    description: "You can increase the power of your spells.",
    prereqs: {},
    benefit: "All variable, numeric effects of an empowered spell are increased by 50%. An empowered spell uses a slot two levels higher.",
  },
  {
    id: "maximize-spell",
    name: "Maximize Spell",
    category: "magic",
    description: "You can maximize the numeric effects of your spells.",
    prereqs: {},
    benefit: "All variable, numeric effects of a maximized spell are maximized. A maximized spell uses a slot three levels higher.",
  },
  {
    id: "quicken-spell",
    name: "Quicken Spell",
    category: "magic",
    description: "You can cast spells with blinding speed.",
    prereqs: {},
    benefit: "Cast a quickened spell as a free action. A quickened spell uses a slot four levels higher.",
  },
  {
    id: "silent-spell",
    name: "Silent Spell",
    category: "magic",
    description: "You can cast spells without verbal components.",
    prereqs: {},
    benefit: "A silenced spell can be cast with no verbal component. Uses a slot one level higher.",
  },
  {
    id: "still-spell",
    name: "Still Spell",
    category: "magic",
    description: "You can cast spells without somatic components.",
    prereqs: {},
    benefit: "A stilled spell can be cast with no somatic component. Uses a slot one level higher.",
  },
  {
    id: "extend-spell",
    name: "Extend Spell",
    category: "magic",
    description: "You can make your spells last longer.",
    prereqs: {},
    benefit: "An extended spell lasts twice as long. Uses a slot one level higher.",
  },
  {
    id: "widen-spell",
    name: "Widen Spell",
    category: "magic",
    description: "You can increase the area of your spells.",
    prereqs: {},
    benefit: "A widened spell has its area doubled. Uses a slot three levels higher.",
  },
  {
    id: "heighten-spell",
    name: "Heighten Spell",
    category: "magic",
    description: "You can cast a spell as if it were a higher level.",
    prereqs: {},
    benefit: "A heightened spell has a higher spell level than normal (up to 9th). All level-dependent effects use the heightened level.",
  },
  {
    id: "enlarge-spell",
    name: "Enlarge Spell",
    category: "magic",
    description: "You can increase the range of your spells.",
    prereqs: {},
    benefit: "An enlarged spell has its range doubled. Uses a slot one level higher.",
  },

  // ─── Item creation feats ───
  {
    id: "scribe-scroll",
    name: "Scribe Scroll",
    category: "magic",
    description: "You can create magical scrolls.",
    prereqs: { minLevel: 1, classOnly: ["wizard"] },
    benefit: "You can create a scroll of any spell you know. Creating a scroll takes one day per 1,000 gp of its base price.",
  },
  {
    id: "brew-potion",
    name: "Brew Potion",
    category: "magic",
    description: "You can create magical potions.",
    prereqs: { minLevel: 3 },
    benefit: "You can create a potion of any 3rd-level or lower spell you know. Brewing takes one day per 1,000 gp of base price.",
  },
  {
    id: "craft-wand",
    name: "Craft Wand",
    category: "magic",
    description: "You can create magical wands.",
    prereqs: { minLevel: 5 },
    benefit: "You can create a wand of any 4th-level or lower spell you know. Crafting takes one day per 1,000 gp of base price.",
  },
  {
    id: "craft-wondrous-item",
    name: "Craft Wondrous Item",
    category: "magic",
    description: "You can create miscellaneous magical items.",
    prereqs: { minLevel: 3 },
    benefit: "You can create a wide variety of magic items such as cloaks, boots, rings, and amulets.",
  },
  {
    id: "craft-magic-arms-and-armor",
    name: "Craft Magic Arms and Armor",
    category: "magic",
    description: "You can create magical weapons and armor.",
    prereqs: { minLevel: 5 },
    benefit: "You can create magic weapons, armor, and shields by enchanting masterwork items.",
  },
  {
    id: "craft-rod",
    name: "Craft Rod",
    category: "magic",
    description: "You can create magical rods.",
    prereqs: { minLevel: 9 },
    benefit: "You can create rods with various magical properties.",
  },
  {
    id: "craft-staff",
    name: "Craft Staff",
    category: "magic",
    description: "You can create magical staves.",
    prereqs: { minLevel: 12 },
    benefit: "You can create staves that store multiple spells.",
  },
  {
    id: "forge-ring",
    name: "Forge Ring",
    category: "magic",
    description: "You can create magical rings.",
    prereqs: { minLevel: 12 },
    benefit: "You can create magic rings with permanent enchantments.",
  },

  // ─── Class-specific magic feats ───
  {
    id: "natural-spell",
    name: "Natural Spell",
    category: "magic",
    description: "You can cast spells even while in wild shape.",
    prereqs: { minAbility: { ability: "wis", score: 13 }, classOnly: ["druid"] },
    benefit: "You may complete the verbal and somatic components of spells while in wild shape.",
  },
  {
    id: "extra-turning",
    name: "Extra Turning",
    category: "magic",
    description: "You can channel divine energy more often.",
    prereqs: { classOnly: ["cleric", "paladin"] },
    benefit: "You gain four additional turn/rebuke undead attempts per day.",
    canTakeMultiple: true,
  },
  {
    id: "improved-turning",
    name: "Improved Turning",
    category: "magic",
    description: "Your ability to turn undead is more powerful.",
    prereqs: { classOnly: ["cleric", "paladin"] },
    benefit: "+1 effective level for purposes of turning undead.",
  },
  {
    id: "extra-wild-shape",
    name: "Extra Wild Shape",
    category: "magic",
    description: "You can wild shape more often.",
    prereqs: { classOnly: ["druid"], minLevel: 5 },
    benefit: "You can use wild shape two additional times per day.",
    canTakeMultiple: true,
  },
];

// ── Combined Array ───────────────────────────────────────────────────────────

export const FEATS: Feat[] = [
  ...COMBAT_FEATS,
  ...GENERAL_FEATS,
  ...SKILL_FEATS,
  ...MAGIC_FEATS,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a feat by its id. */
export function getFeatById(id: string): Feat | undefined {
  return FEATS.find(f => f.id === id);
}

/**
 * Recursively check whether a character meets the prerequisite chain for a
 * given feat.  `currentFeatIds` is the set of feat ids the character has.
 */
function meetsPrereqs(
  feat: Feat,
  level: number,
  classId: string,
  stats: Record<Ability, number>,
  bab: number,
  currentFeatIds: Set<string>,
): boolean {
  const p = feat.prereqs;

  if (p.minAbility) {
    const score = stats[p.minAbility.ability] ?? 0;
    if (score < p.minAbility.score) return false;
  }

  if (p.minBAB !== undefined && bab < p.minBAB) return false;

  if (p.minLevel !== undefined && level < p.minLevel) return false;

  if (p.classOnly && !p.classOnly.includes(classId)) return false;

  if (p.feat && !currentFeatIds.has(p.feat)) return false;

  return true;
}

/**
 * Return every feat the character currently qualifies for that they do not
 * already possess (except feats with `canTakeMultiple`).
 *
 * @param level      - character level
 * @param classId    - class id from classes.ts (e.g. "fighter")
 * @param stats      - the six ability scores
 * @param currentFeats - array of feat ids the character already has
 * @param bab        - base attack bonus (if omitted, derived from class)
 */
export function getAvailableFeats(
  level: number,
  classId: string,
  stats: Record<Ability, number>,
  currentFeats: string[],
  bab?: number,
): Feat[] {
  // If BAB not supplied, derive it from class progression.
  // Inline a small lookup so we don't force a circular import from classes.ts.
  const resolvedBAB = bab ?? (() => {
    const goodBAB = ["fighter", "barbarian", "paladin", "ranger"];
    const avgBAB = ["cleric", "druid", "monk", "bard", "rogue"];
    // poor: sorcerer, wizard
    if (goodBAB.includes(classId)) return level;
    if (avgBAB.includes(classId)) return Math.floor(level * 0.75);
    return Math.floor(level * 0.5);
  })();

  const currentFeatIds = new Set(currentFeats);

  return FEATS.filter(feat => {
    // Already have it and can't take it again
    if (currentFeatIds.has(feat.id) && !feat.canTakeMultiple) return false;

    return meetsPrereqs(feat, level, classId, stats, resolvedBAB, currentFeatIds);
  });
}

/**
 * Number of feats a character selects at level 1.
 * Fighters get a bonus combat feat on top of the standard 1.
 */
export function getStartingFeatCount(classId: string): number {
  return classId === "fighter" ? 2 : 1;
}

/**
 * Number of bonus combat feats a fighter gains at a given level.
 * Fighters get a bonus feat at 1st and every even level (2, 4, 6, ...).
 * Returns 0 for non-fighters.
 */
export function getFighterBonusFeatCount(classId: string, level: number): number {
  if (classId !== "fighter") return 0;
  // Level 1 = 1 bonus, then one at each even level
  return 1 + Math.floor(level / 2);
}

/**
 * Count feat slots gained from leveling up (fromLevel → toLevel).
 * Standard feats: every 3rd level (3, 6, 9, 12, 15, 18).
 * Fighter bonus: every even level (2, 4, 6, 8, ...).
 */
export function featsForLevelUp(fromLevel: number, toLevel: number, classId: string): { standard: number; fighterBonus: number } {
  let standard = 0, fighterBonus = 0;
  for (let l = fromLevel + 1; l <= toLevel; l++) {
    if (l % 3 === 0) standard++;
    if (classId === "fighter" && l % 2 === 0) fighterBonus++;
  }
  return { standard, fighterBonus };
}

/**
 * Filter feats by category — useful for the fighter's bonus feat selection
 * which must be combat feats.
 */
export function getFeatsByCategory(category: FeatCategory): Feat[] {
  return FEATS.filter(f => f.category === category);
}

// ── Feat Mechanical Bonuses ─────────────────────────────────────────────────
// Maps feat IDs to actual stat modifiers applied during combat.

export type FeatBonuses = {
  hp: number;
  ac: number;
  atkBonus: number;
  damage: number;
  initiative: number;
  speed: number;
};

/** Passive bonuses from feat ID → stat modifier */
const PASSIVE_BONUS_MAP: Record<string, Partial<FeatBonuses>> = {
  // ── Combat feats ──
  "power-attack":                 { damage: 2 },      // simplified: auto +2 dmg (PHB: trade atk for dmg)
  "weapon-focus":                 { atkBonus: 1 },     // +1 attack
  "greater-weapon-focus":         { atkBonus: 1 },     // +1 attack (stacks)
  "weapon-specialization":        { damage: 2 },       // +2 damage
  "greater-weapon-specialization": { damage: 2 },      // +2 damage (stacks)
  "weapon-finesse":               { atkBonus: 1 },     // DEX to attack → simplified +1
  "improved-initiative":          { initiative: 4 },   // +4 initiative
  "dodge":                        { ac: 1 },           // +1 dodge AC
  "mobility":                     { ac: 1 },           // +4 vs AoO → simplified +1 AC
  "combat-expertise":             { ac: 1 },           // trade atk for AC → simplified +1 AC
  "two-weapon-defense":           { ac: 1 },           // +1 shield AC while TWF
  "improved-shield-bash":         { ac: 1 },           // keep shield AC when bashing
  "improved-natural-armor":       { ac: 1 },           // +1 natural armor
  "blind-fight":                  { atkBonus: 1 },     // re-roll concealment miss → +1 atk
  // point-blank-shot: REMOVED from passive — applied conditionally in resolveAttack (within 6 hexes / 30ft)
  "rapid-shot":                   { atkBonus: -2, damage: 3 },   // extra arrow at -2 all attacks → simplified
  "manyshot":                     { damage: 2 },                  // fire multiple arrows → simplified +2 dmg
  "shot-on-the-run":              { ac: 1 },                      // move + shoot + move → simplified +1 AC
  // ── General feats ──
  "toughness":                    { hp: 3 },           // +3 HP
  "endurance":                    { hp: 2 },           // +4 CON checks → simplified +2 HP
  "run":                          { speed: 5 },        // ×5 run speed → +5 ft base
};

/**
 * Aggregate passive stat bonuses from a list of feat IDs.
 * Used by computeStats to modify battle stats.
 */
export function getFeatBonuses(featIds: string[]): FeatBonuses {
  const result: FeatBonuses = { hp: 0, ac: 0, atkBonus: 0, damage: 0, initiative: 0, speed: 0 };
  for (const id of featIds) {
    const b = PASSIVE_BONUS_MAP[id];
    if (b) {
      result.hp += b.hp ?? 0;
      result.ac += b.ac ?? 0;
      result.atkBonus += b.atkBonus ?? 0;
      result.damage += b.damage ?? 0;
      result.initiative += b.initiative ?? 0;
      result.speed += b.speed ?? 0;
    }
  }
  return result;
}

/**
 * Get Skill Focus bonus for a specific skill from feat IDs.
 * Skill Focus feats are stored as "skill-focus:skillId" (e.g. "skill-focus:diplomacy").
 * Returns +3 if the character has Skill Focus for that skill, 0 otherwise.
 */
export function getSkillFocusBonus(featIds: string[], skillId: string): number {
  return featIds.some(f => f === `skill-focus:${skillId}`) ? 3 : 0;
}

/**
 * Check if a feat ID requires a sub-selection (e.g., which skill for Skill Focus).
 */
export function featNeedsChoice(featId: string): "skill" | null {
  if (featId === "skill-focus") return "skill";
  return null;
}

/**
 * Extract display info from a compound feat ID like "skill-focus:diplomacy".
 * Returns { baseFeatId, choiceLabel } or null if not compound.
 */
export function parseFeatChoice(featId: string): { baseFeatId: string; choiceId: string } | null {
  const m = featId.match(/^(skill-focus):(.+)$/);
  if (m) return { baseFeatId: m[1], choiceId: m[2] };
  return null;
}

/** Combat flags — checked during attack resolution and battle flow */
export type FeatCombatFlags = {
  improvedCritical: boolean;   // crit on 19-20 instead of only 20
  cleave: boolean;             // free attack on adjacent enemy after kill
  greatCleave: boolean;        // unlimited cleave chain
  // ── Ranged ──
  pointBlankShot: boolean;     // +1 atk, +1 dmg within 6 hexes (30ft)
  preciseShot: boolean;        // no -4 for shooting into melee
  rapidShot: boolean;          // one extra ranged attack at -2 to all
  farShot: boolean;            // range increment penalty halved (-1 instead of -2)
};

/** Extract active combat flags from feat ID list */
export function getFeatCombatFlags(featIds: string[]): FeatCombatFlags {
  const s = new Set(featIds);
  return {
    improvedCritical: s.has("improved-critical"),
    cleave: s.has("cleave"),
    greatCleave: s.has("great-cleave"),
    pointBlankShot: s.has("point-blank-shot"),
    preciseShot: s.has("precise-shot"),
    rapidShot: s.has("rapid-shot"),
    farShot: s.has("far-shot"),
  };
}
