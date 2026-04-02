// D&D 3.5 SRD Skills — adapted for Tales of Tasern
// Source: https://www.d20srd.org/indexes/skills.htm

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type Skill = {
  id: string;
  name: string;
  ability: Ability;
  untrained: boolean;
  armorPenalty: boolean;
  description: string;
};

export const SKILLS: Skill[] = [
  { id: "appraise",          name: "Appraise",          ability: "int", untrained: true,  armorPenalty: false, description: "Estimate the value of objects and treasures." },
  { id: "balance",           name: "Balance",           ability: "dex", untrained: true,  armorPenalty: true,  description: "Walk on precarious surfaces like ledges and ice." },
  { id: "bluff",             name: "Bluff",             ability: "cha", untrained: true,  armorPenalty: false, description: "Deceive others with misleading words or feints." },
  { id: "climb",             name: "Climb",             ability: "str", untrained: true,  armorPenalty: true,  description: "Scale walls, cliffs, and other steep surfaces." },
  { id: "concentration",     name: "Concentration",     ability: "con", untrained: true,  armorPenalty: false, description: "Maintain focus through distractions and damage." },
  { id: "craft",             name: "Craft",             ability: "int", untrained: true,  armorPenalty: false, description: "Create items using tools and raw materials." },
  { id: "decipherScript",    name: "Decipher Script",   ability: "int", untrained: false, armorPenalty: false, description: "Read unfamiliar languages and archaic writings." },
  { id: "diplomacy",         name: "Diplomacy",         ability: "cha", untrained: true,  armorPenalty: false, description: "Persuade and negotiate with NPCs." },
  { id: "disableDevice",     name: "Disable Device",    ability: "int", untrained: false, armorPenalty: false, description: "Disarm traps and sabotage mechanisms." },
  { id: "disguise",          name: "Disguise",          ability: "cha", untrained: true,  armorPenalty: false, description: "Change your appearance to avoid detection." },
  { id: "escapeArtist",      name: "Escape Artist",     ability: "dex", untrained: true,  armorPenalty: true,  description: "Slip free of ropes, grapples, and restraints." },
  { id: "forgery",           name: "Forgery",           ability: "int", untrained: true,  armorPenalty: false, description: "Create or detect false documents." },
  { id: "gatherInformation", name: "Gather Information", ability: "cha", untrained: true,  armorPenalty: false, description: "Pick up rumors and learn about a community." },
  { id: "handleAnimal",      name: "Handle Animal",     ability: "cha", untrained: false, armorPenalty: false, description: "Command, train, and care for animals." },
  { id: "heal",              name: "Heal",              ability: "wis", untrained: true,  armorPenalty: false, description: "Tend wounds, treat diseases, and provide care." },
  { id: "hide",              name: "Hide",              ability: "dex", untrained: true,  armorPenalty: true,  description: "Conceal yourself from observation." },
  { id: "intimidate",        name: "Intimidate",        ability: "cha", untrained: true,  armorPenalty: false, description: "Use threats to change a creature's behavior." },
  { id: "jump",              name: "Jump",              ability: "str", untrained: true,  armorPenalty: true,  description: "Leap over obstacles and gaps." },
  { id: "knowledge",         name: "Knowledge",         ability: "int", untrained: false, armorPenalty: false, description: "Answer questions within a field of study." },
  { id: "listen",            name: "Listen",            ability: "wis", untrained: true,  armorPenalty: false, description: "Detect sounds and notice approaching creatures." },
  { id: "moveSilently",      name: "Move Silently",     ability: "dex", untrained: true,  armorPenalty: true,  description: "Move without being heard." },
  { id: "openLock",          name: "Open Lock",         ability: "dex", untrained: false, armorPenalty: false, description: "Pick locks with thieves' tools." },
  { id: "perform",           name: "Perform",           ability: "cha", untrained: true,  armorPenalty: false, description: "Impress audiences with art or music." },
  { id: "profession",        name: "Profession",        ability: "wis", untrained: false, armorPenalty: false, description: "Practice a trade and earn a living." },
  { id: "ride",              name: "Ride",              ability: "dex", untrained: true,  armorPenalty: false, description: "Ride a mount in and out of combat." },
  { id: "search",            name: "Search",            ability: "int", untrained: true,  armorPenalty: false, description: "Find hidden doors, traps, and clues." },
  { id: "senseMotive",       name: "Sense Motive",      ability: "wis", untrained: true,  armorPenalty: false, description: "Detect bluffs and assess trustworthiness." },
  { id: "sleightOfHand",     name: "Sleight of Hand",   ability: "dex", untrained: false, armorPenalty: true,  description: "Palm objects and perform legerdemain." },
  { id: "speakLanguage",     name: "Speak Language",     ability: "int", untrained: false, armorPenalty: false, description: "Learn additional languages." },
  { id: "spellcraft",        name: "Spellcraft",        ability: "int", untrained: false, armorPenalty: false, description: "Identify spells and magical effects." },
  { id: "spot",              name: "Spot",              ability: "wis", untrained: true,  armorPenalty: false, description: "Notice creatures or objects that are hard to see." },
  { id: "survival",          name: "Survival",          ability: "wis", untrained: true,  armorPenalty: false, description: "Navigate the wild, track creatures, and find food." },
  { id: "swim",              name: "Swim",              ability: "str", untrained: true,  armorPenalty: true,  description: "Move through water and stay afloat." },
  { id: "tumble",            name: "Tumble",            ability: "dex", untrained: false, armorPenalty: true,  description: "Roll past enemies to avoid attacks of opportunity." },
  { id: "useMagicDevice",    name: "Use Magic Device",  ability: "cha", untrained: false, armorPenalty: false, description: "Activate magic items you normally couldn't use." },
  { id: "useRope",           name: "Use Rope",          ability: "dex", untrained: true,  armorPenalty: false, description: "Tie knots, secure bindings, and splice ropes." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id);
}

/** Ability modifier: half the game stat (game stats = D&D - 10, so this equals D&D mod) */
export function abilityMod(score: number): number {
  return Math.floor(score / 2);
}

/** Skill check: d20 + ability mod + ranks */
export function skillCheck(abilityScore: number, ranks: number): number {
  const roll = Math.floor(Math.random() * 20) + 1;
  return roll + abilityMod(abilityScore) + ranks;
}
