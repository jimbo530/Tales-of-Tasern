// ── D&D 3.5 PHB Cleric Domains ──────────────────────────────────────────────
// All 22 domains from the Player's Handbook 3.5e.
// Each domain grants one power and one bonus domain spell per spell level (1-9).

export type Domain = {
  id: string;
  name: string;
  description: string;
  grantedPower: string;
  /** Battle-relevant passive from the granted power */
  passive?: {
    bonusFeat?: string;       // e.g., "improved_turning"
    bonusAtk?: number;
    bonusDmg?: number;
    bonusAC?: number;
    bonusSave?: number;
    bonusSpeed?: number;
    bonusHP?: number;
    specialAbility?: string;  // freeform for unique abilities
  };
  /** Domain spell IDs per spell level (1-9) */
  spells: [string, string, string, string, string, string, string, string, string];
};

export const DOMAINS: Domain[] = [
  {
    id: "air",
    name: "Air",
    description: "Deity of sky, wind, clouds, and storms.",
    grantedPower: "Turn or destroy earth creatures as a good cleric turns undead. Rebuke, command, or bolster air creatures as an evil cleric rebukes undead.",
    spells: [
      "obscuring_mist",              // 1
      "wind_wall_domain",            // 2 — Wind Wall
      "gaseous_form_domain",         // 3 — Gaseous Form
      "air_walk",                    // 4
      "control_winds",               // 5
      "chain_lightning",             // 6
      "control_weather",             // 7
      "whirlwind",                   // 8
      "elemental_swarm_air",         // 9
    ],
  },
  {
    id: "animal",
    name: "Animal",
    description: "Deity of nature, beasts, and the wild.",
    grantedPower: "You can use speak with animals once per day as a spell-like ability. Knowledge (nature) is a class skill.",
    spells: [
      "calm_animals",                // 1
      "hold_animal",                 // 2
      "dominate_animal",             // 3
      "summon_natures_ally_iv",      // 4
      "commune_with_nature",         // 5
      "antilife_shell",              // 6
      "animal_shapes",               // 7
      "summon_natures_ally_viii",     // 8
      "shapechange",                 // 9
    ],
  },
  {
    id: "chaos",
    name: "Chaos",
    description: "Deity of freedom, randomness, and rebellion.",
    grantedPower: "You cast chaos spells at +1 caster level.",
    spells: [
      "protection_from_law",         // 1
      "shatter",                     // 2
      "magic_circle_against_law",    // 3
      "chaos_hammer",                // 4
      "dispel_law",                  // 5
      "animate_objects",             // 6
      "word_of_chaos",               // 7
      "cloak_of_chaos",              // 8
      "summon_monster_ix_chaos",     // 9
    ],
  },
  {
    id: "death",
    name: "Death",
    description: "Deity of the dead, undead, and the afterlife.",
    grantedPower: "You may use a death touch once per day. Your death touch is a supernatural ability that produces a death effect. You must succeed on a melee touch attack. When you touch, roll 1d6 per cleric level. If the total at least equals the creature's current hit points, it dies (no save).",
    passive: { specialAbility: "death_touch" },
    spells: [
      "cause_fear",                  // 1
      "death_knell",                 // 2
      "animate_dead",                // 3
      "death_ward",                  // 4
      "slay_living",                 // 5
      "create_undead",               // 6
      "destruction",                 // 7
      "create_greater_undead",       // 8
      "wail_of_the_banshee",         // 9
    ],
  },
  {
    id: "destruction",
    name: "Destruction",
    description: "Deity of ruin, devastation, and wrath.",
    grantedPower: "You gain the smite power, the supernatural ability to make a single melee attack with a +4 bonus on attack rolls and a bonus on damage rolls equal to your cleric level (if you hit). You must declare the smite before making the attack. This ability is usable once per day.",
    passive: { specialAbility: "smite_1/day" },
    spells: [
      "inflict_light_wounds",        // 1
      "shatter",                     // 2
      "contagion",                   // 3
      "inflict_critical_wounds",     // 4
      "inflict_light_wounds_mass",   // 5
      "harm",                        // 6
      "disintegrate",                // 7 (actually disintegrate)
      "earthquake",                  // 8
      "implosion",                   // 9
    ],
  },
  {
    id: "earth",
    name: "Earth",
    description: "Deity of mountains, stone, and the underground.",
    grantedPower: "Turn or destroy air creatures as a good cleric turns undead. Rebuke, command, or bolster earth creatures as an evil cleric rebukes undead.",
    spells: [
      "magic_stone",                 // 1
      "soften_earth_stone",          // 2
      "stone_shape",                 // 3
      "spike_stones",                // 4
      "wall_of_stone",               // 5
      "stoneskin",                    // 6
      "earthquake_domain",           // 7
      "iron_body",                   // 8
      "elemental_swarm_earth",       // 9
    ],
  },
  {
    id: "evil",
    name: "Evil",
    description: "Deity of darkness, corruption, and malice.",
    grantedPower: "You cast evil spells at +1 caster level.",
    spells: [
      "protection_from_good",        // 1
      "desecrate",                   // 2
      "magic_circle_against_good",   // 3
      "unholy_blight",               // 4
      "dispel_good",                 // 5
      "create_undead",               // 6
      "blasphemy",                   // 7
      "unholy_aura",                 // 8
      "summon_monster_ix_evil",      // 9
    ],
  },
  {
    id: "fire",
    name: "Fire",
    description: "Deity of flame, heat, and the forge.",
    grantedPower: "Turn or destroy water creatures as a good cleric turns undead. Rebuke, command, or bolster fire creatures as an evil cleric rebukes undead.",
    spells: [
      "burning_hands",               // 1
      "produce_flame_domain",        // 2 (as Produce Flame)
      "resist_energy_fire",          // 3 (Resist Energy but fire only)
      "wall_of_fire",                // 4
      "fire_shield_domain",          // 5
      "fire_seeds",                  // 6
      "fire_storm",                  // 7
      "incendiary_cloud",            // 8
      "elemental_swarm_fire",        // 9
    ],
  },
  {
    id: "good",
    name: "Good",
    description: "Deity of virtue, mercy, and protection.",
    grantedPower: "You cast good spells at +1 caster level.",
    spells: [
      "protection_from_evil",        // 1
      "aid",                         // 2
      "magic_circle_against_evil",   // 3
      "holy_smite",                  // 4
      "dispel_evil",                 // 5
      "blade_barrier",               // 6
      "holy_word",                   // 7
      "holy_aura",                   // 8
      "summon_monster_ix_good",      // 9
    ],
  },
  {
    id: "healing",
    name: "Healing",
    description: "Deity of health, vitality, and restoration.",
    grantedPower: "You cast healing spells at +1 caster level.",
    spells: [
      "cure_light_wounds",           // 1
      "cure_moderate_wounds",        // 2
      "cure_serious_wounds",         // 3
      "cure_critical_wounds",        // 4
      "cure_light_wounds_mass",      // 5
      "heal",                        // 6
      "regenerate",                  // 7
      "cure_critical_wounds_mass",   // 8
      "mass_heal",                   // 9
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Deity of learning, secrets, and lore.",
    grantedPower: "Add all Knowledge skills to your list of cleric class skills. You cast divination spells at +1 caster level.",
    spells: [
      "detect_secret_doors",         // 1
      "detect_thoughts",             // 2
      "clairaudience_clairvoyance",  // 3
      "divination",                  // 4
      "true_seeing",                 // 5
      "find_the_path",               // 6
      "legend_lore",                 // 7
      "discern_location",            // 8
      "foresight",                   // 9
    ],
  },
  {
    id: "law",
    name: "Law",
    description: "Deity of order, discipline, and civilization.",
    grantedPower: "You cast law spells at +1 caster level.",
    spells: [
      "protection_from_chaos",       // 1
      "calm_emotions",               // 2
      "magic_circle_against_chaos",  // 3
      "orders_wrath",                // 4
      "dispel_chaos",                // 5
      "hold_monster",                // 6
      "dictum",                      // 7
      "shield_of_law",               // 8
      "summon_monster_ix_law",       // 9
    ],
  },
  {
    id: "luck",
    name: "Luck",
    description: "Deity of fortune, fate, and chance.",
    grantedPower: "You gain the power of good fortune, which is usable once per day. This extraordinary ability allows you to reroll one roll that you have just made before the DM declares whether the roll results in success or failure. You must take the result of the reroll, even if it's worse.",
    passive: { specialAbility: "reroll_1/day" },
    spells: [
      "entropic_shield",             // 1
      "aid",                         // 2
      "protection_from_energy",      // 3
      "freedom_of_movement",         // 4
      "break_enchantment",           // 5
      "mislead",                     // 6
      "spell_turning",               // 7
      "moment_of_prescience",        // 8
      "miracle",                     // 9
    ],
  },
  {
    id: "magic",
    name: "Magic",
    description: "Deity of spellcasting, arcana, and enchantment.",
    grantedPower: "Use scrolls, wands, and other devices with spell completion or spell trigger activation as a wizard of one-half your cleric level (at least 1st level). For the purpose of using a scroll or other magic device, if you are also a wizard, actual wizard levels and these effective wizard levels stack.",
    spells: [
      "nystuls_magic_aura",          // 1
      "identify",                    // 2
      "dispel_magic",                // 3
      "imbue_with_spell_ability",    // 4
      "spell_resistance",            // 5
      "antimagic_field",             // 6
      "spell_turning",               // 7
      "protection_from_spells",      // 8
      "mages_disjunction",           // 9
    ],
  },
  {
    id: "plant",
    name: "Plant",
    description: "Deity of growth, agriculture, and forests.",
    grantedPower: "Rebuke or command plant creatures as an evil cleric rebukes or commands undead. Knowledge (nature) is a class skill.",
    spells: [
      "entangle",                    // 1
      "barkskin",                    // 2
      "plant_growth",                // 3
      "command_plants",              // 4
      "wall_of_thorns",             // 5
      "repel_wood",                  // 6
      "animate_plants",              // 7
      "control_plants",              // 8
      "shambler",                    // 9
    ],
  },
  {
    id: "protection",
    name: "Protection",
    description: "Deity of defense, guardians, and wards.",
    grantedPower: "You can generate a protective ward as a supernatural ability. Grant someone you touch a resistance bonus equal to your cleric level on his or her next saving throw. The ward is an abjuration effect with a duration of 1 hour and is usable once per day.",
    passive: { specialAbility: "protective_ward" },
    spells: [
      "sanctuary",                   // 1
      "shield_other",                // 2
      "protection_from_energy",      // 3
      "spell_immunity",              // 4
      "spell_resistance",            // 5
      "antimagic_field",             // 6
      "repulsion",                   // 7
      "mind_blank",                  // 8
      "prismatic_sphere",            // 9
    ],
  },
  {
    id: "strength",
    name: "Strength",
    description: "Deity of physical power, athletics, and might.",
    grantedPower: "You can perform a feat of strength as a supernatural ability. You gain an enhancement bonus to Strength equal to your cleric level. Activating the power is a free action, the power lasts 1 round, and it is usable once per day.",
    passive: { specialAbility: "feat_of_strength" },
    spells: [
      "enlarge_person",              // 1
      "bulls_strength",              // 2
      "magic_vestment",              // 3
      "spell_immunity",              // 4
      "righteous_might",             // 5
      "stoneskin",                   // 6
      "bigbys_grasping_hand",        // 7
      "bigbys_clenched_fist",        // 8
      "bigbys_crushing_hand",        // 9
    ],
  },
  {
    id: "sun",
    name: "Sun",
    description: "Deity of light, the sun, and purity.",
    grantedPower: "Once per day, you can perform a greater turning against undead in place of a regular turning. The greater turning is like a normal turning except that the undead creatures that would be turned are destroyed instead.",
    passive: { specialAbility: "greater_turning" },
    spells: [
      "endure_elements",             // 1
      "heat_metal",                  // 2
      "searing_light",               // 3
      "fire_shield_domain",          // 4
      "flame_strike",                // 5
      "fire_seeds_domain",           // 6
      "sunbeam",                     // 7
      "sunburst",                    // 8
      "prismatic_sphere",            // 9
    ],
  },
  {
    id: "travel",
    name: "Travel",
    description: "Deity of journeys, roads, and exploration.",
    grantedPower: "For a total time per day of 1 round per cleric level, you can act normally regardless of magical effects that impede movement as if you were affected by the spell freedom of movement. Survival is a class skill.",
    passive: { specialAbility: "freedom_of_movement_rounds", bonusSpeed: 10 },
    spells: [
      "longstrider",                 // 1
      "locate_object",               // 2
      "fly",                         // 3
      "dimension_door",              // 4
      "teleport",                    // 5
      "find_the_path",               // 6
      "greater_teleport",            // 7
      "phase_door",                  // 8
      "astral_projection",           // 9
    ],
  },
  {
    id: "trickery",
    name: "Trickery",
    description: "Deity of deception, stealth, and cunning.",
    grantedPower: "Add Bluff, Disguise, and Hide to your list of cleric class skills.",
    spells: [
      "disguise_self",               // 1
      "invisibility",                // 2
      "nondetection",                // 3
      "confusion",                   // 4
      "false_vision",                // 5
      "mislead",                     // 6
      "screen",                      // 7
      "polymorph_any_object",        // 8
      "time_stop",                   // 9
    ],
  },
  {
    id: "war",
    name: "War",
    description: "Deity of battle, combat, and conquest.",
    grantedPower: "Free Martial Weapon Proficiency with deity's favored weapon (if necessary) and Weapon Focus with that weapon.",
    passive: { bonusFeat: "weapon_focus", bonusAtk: 1 },
    spells: [
      "magic_weapon",                // 1
      "spiritual_weapon",            // 2
      "magic_vestment",              // 3
      "divine_power",                // 4
      "flame_strike",                // 5
      "blade_barrier",               // 6
      "power_word_blind",            // 7
      "power_word_stun",             // 8
      "power_word_kill",             // 9
    ],
  },
  {
    id: "water",
    name: "Water",
    description: "Deity of oceans, rivers, and rain.",
    grantedPower: "Turn or destroy fire creatures as a good cleric turns undead. Rebuke, command, or bolster water creatures as an evil cleric rebukes undead.",
    spells: [
      "obscuring_mist",              // 1
      "fog_cloud",                   // 2
      "water_breathing",             // 3
      "control_water",               // 4
      "ice_storm",                   // 5
      "cone_of_cold",                // 6
      "acid_fog",                    // 7
      "horrid_wilting",              // 8
      "elemental_swarm_water",       // 9
    ],
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────────────

export const DOMAIN_MAP = new Map<string, Domain>(DOMAINS.map(d => [d.id, d]));

export function getDomain(id: string): Domain | undefined {
  return DOMAIN_MAP.get(id);
}

/** Get all domain IDs as a sorted list for UI display */
export function getDomainIds(): string[] {
  return DOMAINS.map(d => d.id).sort();
}
