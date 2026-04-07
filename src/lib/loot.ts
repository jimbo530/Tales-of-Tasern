// ============================================================
// loot.ts — D&D 3.5-based loot tables for random item generation
// ============================================================

export type ItemCategory =
  | "weapon"
  | "armor"
  | "gear"
  | "trade_good"
  | "alchemical"
  | "consumable";

export type LootItem = {
  id: string;
  name: string;
  category: ItemCategory;
  value: number; // gold pieces
  weight: number; // pounds
  description: string; // brief flavor text
  effect?: string; // mechanical effect if any
};

export type LootTier = "junk" | "common" | "uncommon" | "rare";

export type TerrainLoot = {
  terrain: string;
  junk: string[]; // flavor descriptions for junk finds
  minor: string[]; // flavor for minor finds
  major: string[]; // flavor for major finds
};

// ============================================================
//  JUNK LOOT  (0 – 2 gp)
// ============================================================

export const JUNK_LOOT: LootItem[] = [
  {
    id: "junk_broken_dagger",
    name: "Broken Dagger",
    category: "weapon",
    value: 0.5,
    weight: 0.5,
    description: "A snapped blade with a chipped handle. Barely useful as a letter opener.",
  },
  {
    id: "junk_rusty_nails",
    name: "Rusty Nails",
    category: "gear",
    value: 0.1,
    weight: 0.25,
    description: "A handful of bent, corroded nails. Maybe a blacksmith could melt them down.",
  },
  {
    id: "junk_tattered_cloth",
    name: "Tattered Cloth",
    category: "trade_good",
    value: 0.2,
    weight: 0.5,
    description: "A scrap of sun-bleached fabric, frayed at every edge.",
  },
  {
    id: "junk_cracked_pot",
    name: "Cracked Pot",
    category: "gear",
    value: 0.3,
    weight: 2,
    description: "A clay cooking pot with a jagged crack running down the side.",
  },
  {
    id: "junk_bird_feathers",
    name: "Bird Feathers",
    category: "trade_good",
    value: 0.1,
    weight: 0.1,
    description: "A small bundle of dull plumage. Could serve as quill stock in a pinch.",
  },
  {
    id: "junk_old_boot",
    name: "Old Boot",
    category: "gear",
    value: 0.1,
    weight: 1,
    description: "A single worn-out boot. Its partner is long gone.",
  },
  {
    id: "junk_rat_bones",
    name: "Rat Bones",
    category: "trade_good",
    value: 0.1,
    weight: 0.1,
    description: "Tiny bleached bones. Some hedge witches pay copper for these.",
  },
  {
    id: "junk_dull_gemstone",
    name: "Dull Gemstone",
    category: "trade_good",
    value: 1,
    weight: 0.1,
    description: "A cloudy, poorly cut stone. It catches light but not admiration.",
  },
  {
    id: "junk_wooden_button",
    name: "Wooden Button",
    category: "trade_good",
    value: 0.05,
    weight: 0.05,
    description: "A carved wooden button with a faded crest. Off someone's coat, once.",
  },
  {
    id: "junk_stale_bread",
    name: "Stale Bread",
    category: "consumable",
    value: 0.05,
    weight: 0.5,
    description: "Rock-hard bread. Edible if soaked in water for an hour. Maybe.",
  },
  {
    id: "junk_torn_map_fragment",
    name: "Torn Map Fragment",
    category: "gear",
    value: 0.5,
    weight: 0.1,
    description: "A corner of a larger map showing unmarked hills and a partial river.",
  },
  {
    id: "junk_faded_playing_cards",
    name: "Faded Playing Cards",
    category: "gear",
    value: 0.2,
    weight: 0.1,
    description: "A partial deck of cards with water-stained illustrations.",
  },
  {
    id: "junk_copper_ring",
    name: "Copper Ring",
    category: "trade_good",
    value: 0.5,
    weight: 0.05,
    description: "A simple band of tarnished copper. No enchantment, just sentiment.",
  },
  {
    id: "junk_chipped_arrowhead",
    name: "Chipped Arrowhead",
    category: "weapon",
    value: 0.1,
    weight: 0.1,
    description: "A flint arrowhead with a large chip. Useless for hunting.",
  },
  {
    id: "junk_dried_herbs",
    name: "Dried Herbs",
    category: "consumable",
    value: 0.3,
    weight: 0.1,
    description: "A crumbling bundle of unidentifiable dried leaves. Smells vaguely medicinal.",
  },
  {
    id: "junk_bent_spoon",
    name: "Bent Spoon",
    category: "gear",
    value: 0.1,
    weight: 0.25,
    description: "A tin spoon bent almost double. Someone was very angry at their porridge.",
  },
  {
    id: "junk_empty_vial",
    name: "Empty Vial",
    category: "gear",
    value: 0.5,
    weight: 0.1,
    description: "A small glass vial with a cork stopper. Residue inside hints at past contents.",
  },
  {
    id: "junk_charcoal_stick",
    name: "Charcoal Stick",
    category: "gear",
    value: 0.1,
    weight: 0.1,
    description: "A stick of drawing charcoal. Good for marking walls or ruining sleeves.",
  },
  {
    id: "junk_tarnished_buckle",
    name: "Tarnished Buckle",
    category: "trade_good",
    value: 0.3,
    weight: 0.25,
    description: "A belt buckle gone green with age. The design is nearly worn smooth.",
  },
  {
    id: "junk_bone_dice",
    name: "Bone Dice",
    category: "gear",
    value: 0.2,
    weight: 0.1,
    description: "A pair of yellowed bone dice. One is slightly heavier on the six side.",
  },
  // Clothing junk
  {
    id: "junk_worn_sandals",
    name: "Worn Sandals",
    category: "gear",
    value: 0.03,
    weight: 0.5,
    description: "Leather sandals with a snapped strap. One sole is worn through.",
  },
  {
    id: "junk_moth_eaten_scarf",
    name: "Moth-Eaten Scarf",
    category: "gear",
    value: 0.1,
    weight: 0,
    description: "A woolen scarf riddled with holes. Still vaguely warm.",
  },
  {
    id: "junk_stained_tunic",
    name: "Stained Tunic",
    category: "gear",
    value: 0.2,
    weight: 1,
    description: "A rough tunic with unidentifiable stains. Wearable, barely.",
  },
  {
    id: "junk_ragged_cloak",
    name: "Ragged Cloak",
    category: "gear",
    value: 0.3,
    weight: 1,
    description: "A patched wool cloak with a frayed hem. Better than nothing in the rain.",
  },
  {
    id: "junk_cracked_belt",
    name: "Cracked Belt",
    category: "gear",
    value: 0.1,
    weight: 0,
    description: "A dried-out leather belt with a bent buckle.",
  },
];

// ============================================================
//  COMMON LOOT  (2 – 15 gp)
// ============================================================

export const COMMON_LOOT: LootItem[] = [
  {
    id: "common_dagger",
    name: "Dagger",
    category: "weapon",
    value: 2,
    weight: 1,
    description: "A simple but functional steel dagger.",
    effect: "1d4 piercing, 19-20/x2 crit, 10 ft range increment",
  },
  {
    id: "common_short_sword",
    name: "Short Sword",
    category: "weapon",
    value: 10,
    weight: 2,
    description: "A well-balanced blade favored by scouts and rogues.",
    effect: "1d6 piercing, 19-20/x2 crit",
  },
  {
    id: "common_sturdy_club",
    name: "Sturdy Club",
    category: "weapon",
    value: 3,
    weight: 3,
    description: "A heavy oaken club reinforced with iron bands.",
    effect: "1d6 bludgeoning, x2 crit",
  },
  {
    id: "common_leather_sling",
    name: "Leather Sling",
    category: "weapon",
    value: 2,
    weight: 0.5,
    description: "A sling of supple leather with a braided cord.",
    effect: "1d4 bludgeoning, x2 crit, 50 ft range increment",
  },
  {
    id: "common_quality_torches",
    name: "Quality Torches (3)",
    category: "gear",
    value: 2,
    weight: 3,
    description: "Three pitch-soaked torches that burn bright and long.",
    effect: "20 ft bright light, 40 ft shadowy; burns 1 hour each",
  },
  {
    id: "common_silk_rope",
    name: "Silk Rope (50 ft)",
    category: "gear",
    value: 10,
    weight: 5,
    description: "Smooth yet strong rope woven from spider silk and flax.",
    effect: "HP 4, Break DC 24, +2 to Use Rope checks",
  },
  {
    id: "common_rations_5day",
    name: "Rations (5 days)",
    category: "consumable",
    value: 2.5,
    weight: 5,
    description: "Jerky, hardtack, and dried fruit wrapped in oilcloth.",
  },
  {
    id: "common_waterskin",
    name: "Waterskin",
    category: "gear",
    value: 1,
    weight: 4,
    description: "A leather waterskin filled with clean water. Holds a day's worth.",
  },
  {
    id: "common_healers_kit",
    name: "Healer's Kit",
    category: "gear",
    value: 5,
    weight: 1,
    description: "A leather pouch of bandages, salves, and splinting rods.",
    effect: "+2 to Heal checks, 5 uses remaining",
  },
  {
    id: "common_trail_rations_pack",
    name: "Trail Rations Pack",
    category: "consumable",
    value: 3,
    weight: 8,
    description: "A traveler's pack of smoked meats, nuts, and honeycomb.",
  },
  {
    id: "common_silver_ring",
    name: "Silver Ring",
    category: "trade_good",
    value: 3,
    weight: 0.05,
    description: "A thin band of polished silver. Simple but genuine.",
  },
  {
    id: "common_padded_armor",
    name: "Padded Armor",
    category: "armor",
    value: 5,
    weight: 10,
    description: "Layers of quilted cloth and cotton batting.",
    effect: "+1 AC, max Dex +8, armor check penalty 0",
  },
  {
    id: "common_leather_armor",
    name: "Leather Armor",
    category: "armor",
    value: 10,
    weight: 15,
    description: "Boiled and hardened leather shaped into a vest and bracers.",
    effect: "+2 AC, max Dex +6, armor check penalty 0",
  },
  {
    id: "common_light_wooden_shield",
    name: "Light Wooden Shield",
    category: "armor",
    value: 3,
    weight: 5,
    description: "A round shield of layered wood banded with iron.",
    effect: "+1 AC, armor check penalty -1",
  },
  {
    id: "common_backpack",
    name: "Backpack",
    category: "gear",
    value: 2,
    weight: 2,
    description: "A sturdy canvas pack with leather straps and brass fittings.",
  },
  {
    id: "common_bedroll",
    name: "Bedroll",
    category: "gear",
    value: 1,
    weight: 5,
    description: "A wool-stuffed bedroll that keeps the cold ground at bay.",
  },
  {
    id: "common_flint_and_steel",
    name: "Flint and Steel",
    category: "gear",
    value: 1,
    weight: 0.5,
    description: "A fire-starting kit in a small tin case.",
    effect: "Start a fire as a full-round action",
  },
  {
    id: "common_mess_kit",
    name: "Mess Kit",
    category: "gear",
    value: 1,
    weight: 1,
    description: "A compact set of tin plate, cup, fork, and folding knife.",
  },
  {
    id: "common_travelers_outfit",
    name: "Traveler's Outfit",
    category: "gear",
    value: 1,
    weight: 5,
    description: "Sturdy boots, wool trousers, a linen shirt, and a cloak.",
  },
  {
    id: "common_peasant_outfit",
    name: "Peasant's Outfit",
    category: "gear",
    value: 0.1,
    weight: 2,
    description: "A loose shirt, breeches, and cloth shoes. Rough but serviceable.",
  },
  {
    id: "common_artisan_outfit",
    name: "Artisan's Outfit",
    category: "gear",
    value: 1,
    weight: 4,
    description: "Sturdy work clothes with tool loops and a leather apron.",
  },
  {
    id: "common_wool_cloak",
    name: "Wool Cloak",
    category: "gear",
    value: 0.5,
    weight: 1,
    description: "A plain brown cloak with a bone clasp. Keeps the rain off.",
  },
  {
    id: "common_leather_boots",
    name: "Leather Boots",
    category: "gear",
    value: 1,
    weight: 1,
    description: "Sturdy calf-high leather boots. Well-worn but sound.",
  },
  {
    id: "common_leather_gloves",
    name: "Leather Gloves",
    category: "gear",
    value: 1,
    weight: 0,
    description: "Fitted work gloves. Protects hands from rope burn and brambles.",
  },
  {
    id: "common_wide_hat",
    name: "Wide-Brimmed Hat",
    category: "gear",
    value: 0.5,
    weight: 0.5,
    description: "A broad felt hat that shades the face from sun and rain.",
  },
  {
    id: "common_leather_belt",
    name: "Leather Belt",
    category: "gear",
    value: 0.5,
    weight: 0,
    description: "A sturdy belt with iron buckle. Room for a scabbard and pouches.",
  },
  {
    id: "common_woolen_tunic",
    name: "Woolen Tunic",
    category: "gear",
    value: 0.8,
    weight: 1,
    description: "A knee-length tunic of undyed wool. Common daily wear.",
  },
  {
    id: "common_leather_jerkin",
    name: "Leather Jerkin",
    category: "gear",
    value: 0.5,
    weight: 1,
    description: "A tough sleeveless jerkin worn over lighter clothes.",
  },
  {
    id: "common_handaxe",
    name: "Handaxe",
    category: "weapon",
    value: 6,
    weight: 3,
    description: "A short-hafted axe useful for chopping wood or foes.",
    effect: "1d6 slashing, x3 crit, 10 ft range increment",
  },
  {
    id: "common_javelin",
    name: "Javelin",
    category: "weapon",
    value: 1,
    weight: 2,
    description: "A balanced throwing spear with a fire-hardened tip.",
    effect: "1d6 piercing, x2 crit, 30 ft range increment",
  },
  {
    id: "common_ironwood_staff",
    name: "Ironwood Staff",
    category: "weapon",
    value: 5,
    weight: 4,
    description: "A dark-grained staff, hard as iron but light as ash.",
    effect: "1d6/1d6 bludgeoning (double weapon), x2 crit",
  },
  {
    id: "common_mace",
    name: "Mace",
    category: "weapon",
    value: 12,
    weight: 8,
    description: "A flanged steel mace that delivers crushing blows.",
    effect: "1d8 bludgeoning, x2 crit",
  },
  {
    id: "common_spear",
    name: "Spear",
    category: "weapon",
    value: 2,
    weight: 6,
    description: "A simple spear with an iron point. Versatile and cheap.",
    effect: "1d8 piercing (two-handed), x3 crit, 20 ft range increment",
  },
  {
    id: "common_light_crossbow",
    name: "Light Crossbow",
    category: "weapon",
    value: 12,
    weight: 4,
    description: "A compact crossbow with a quiver of 20 bolts.",
    effect: "1d8 piercing, 19-20/x2 crit, 80 ft range increment",
  },
  {
    id: "common_caltrops",
    name: "Caltrops",
    category: "gear",
    value: 1,
    weight: 2,
    description: "A bag of four-pronged iron spikes to scatter on the ground.",
    effect: "Covers 5 ft square; DC 15 Reflex or 1 damage and half speed",
  },
  {
    id: "common_grappling_hook",
    name: "Grappling Hook",
    category: "gear",
    value: 1,
    weight: 4,
    description: "A three-pronged iron hook for scaling walls.",
    effect: "DC 10 Use Rope to secure; +2 to Climb with rope",
  },
  {
    id: "common_signal_whistle",
    name: "Signal Whistle",
    category: "gear",
    value: 1,
    weight: 0.1,
    description: "A shrill tin whistle audible up to a quarter mile.",
  },
  {
    id: "common_candles_10",
    name: "Candles (10)",
    category: "gear",
    value: 1,
    weight: 1,
    description: "Ten tallow candles wrapped in waxed paper.",
    effect: "5 ft dim light each, burns 1 hour",
  },
  {
    id: "common_flask_of_oil_5",
    name: "Flasks of Oil (5)",
    category: "gear",
    value: 2,
    weight: 5,
    description: "Five clay flasks of lamp oil. Also useful as improvised fire weapons.",
    effect: "Fuel for lantern (6 hrs each) or splash weapon (1d3 fire)",
  },
];

// ============================================================
//  UNCOMMON LOOT  (15 – 50 gp)
// ============================================================

export const UNCOMMON_LOOT: LootItem[] = [
  // Clothing (uncommon tier — nicer garments)
  {
    id: "uncommon_entertainer_outfit",
    name: "Entertainer's Outfit",
    category: "gear",
    value: 3,
    weight: 4,
    description: "Flashy garments in bright colors with ribbon trim and brass buttons.",
  },
  {
    id: "uncommon_explorer_outfit",
    name: "Explorer's Outfit",
    category: "gear",
    value: 10,
    weight: 8,
    description: "Reinforced clothing with many pockets, a wide hat, and high boots.",
  },
  {
    id: "uncommon_winter_cloak",
    name: "Winter Cloak",
    category: "gear",
    value: 5,
    weight: 3,
    description: "A heavy cloak lined with wolf fur. Warm as a hearth.",
  },
  {
    id: "uncommon_cold_weather_outfit",
    name: "Cold Weather Outfit",
    category: "gear",
    value: 8,
    weight: 7,
    description: "Wool coat, heavy cloak, fur-lined gloves and boots. Built for bitter cold.",
  },
  {
    id: "uncommon_scholar_outfit",
    name: "Scholar's Outfit",
    category: "gear",
    value: 5,
    weight: 6,
    description: "A long robe over fine linen, with ink-stained cuffs and deep pockets.",
  },
  {
    id: "uncommon_riding_boots",
    name: "Riding Boots",
    category: "gear",
    value: 3,
    weight: 3,
    description: "Tall leather boots with a hard heel for stirrups and a polished finish.",
  },
  {
    id: "uncommon_surcoat",
    name: "Surcoat",
    category: "gear",
    value: 3,
    weight: 3,
    description: "A sleeveless overgarment in dyed linen, suitable for wearing a coat of arms.",
  },
  {
    id: "uncommon_courtier_outfit",
    name: "Courtier's Outfit",
    category: "gear",
    value: 30,
    weight: 6,
    description: "Tailored clothing in fine fabric, suitable for audiences with nobility.",
  },
  {
    id: "uncommon_monks_outfit",
    name: "Monk's Outfit",
    category: "gear",
    value: 5,
    weight: 2,
    description: "A simple, functional garment that allows full freedom of movement.",
  },
  {
    id: "uncommon_cleric_vestments",
    name: "Cleric's Vestments",
    category: "gear",
    value: 5,
    weight: 6,
    description: "Ceremonial robes embroidered with holy symbols.",
  },
  {
    id: "uncommon_longsword",
    name: "Longsword",
    category: "weapon",
    value: 15,
    weight: 4,
    description: "A straight-bladed sword of good steel with a leather-wrapped grip.",
    effect: "1d8 slashing, 19-20/x2 crit",
  },
  {
    id: "uncommon_fine_battleaxe",
    name: "Fine Battleaxe",
    category: "weapon",
    value: 20,
    weight: 6,
    description: "A broad-bladed axe with rune-etched cheeks and a hickory haft.",
    effect: "1d8 slashing, x3 crit",
  },
  {
    id: "uncommon_dwarven_warhammer",
    name: "Dwarven Warhammer",
    category: "weapon",
    value: 25,
    weight: 5,
    description: "A compact warhammer stamped with a dwarven forge-mark.",
    effect: "1d8 bludgeoning, x3 crit",
  },
  {
    id: "uncommon_shortbow",
    name: "Shortbow",
    category: "weapon",
    value: 30,
    weight: 2,
    description: "A recurve bow of yew and sinew, compact enough for mounted use.",
    effect: "1d6 piercing, x3 crit, 60 ft range increment",
  },
  {
    id: "uncommon_battered_chain_shirt",
    name: "Battered Chain Shirt",
    category: "armor",
    value: 30,
    weight: 25,
    description: "A chain shirt missing a few links but still serviceable.",
    effect: "+4 AC, max Dex +4, armor check penalty -2",
  },
  {
    id: "uncommon_scale_mail",
    name: "Scale Mail",
    category: "armor",
    value: 50,
    weight: 30,
    description: "Overlapping steel scales riveted to a leather backing.",
    effect: "+4 AC, max Dex +3, armor check penalty -4",
  },
  {
    id: "uncommon_studded_leather",
    name: "Studded Leather",
    category: "armor",
    value: 25,
    weight: 20,
    description: "Leather armor reinforced with rows of metal studs.",
    effect: "+3 AC, max Dex +5, armor check penalty -1",
  },
  {
    id: "uncommon_heavy_steel_shield",
    name: "Heavy Steel Shield",
    category: "armor",
    value: 20,
    weight: 15,
    description: "A broad steel shield emblazoned with a faded heraldic device.",
    effect: "+2 AC, armor check penalty -2",
  },
  {
    id: "uncommon_silver_dagger",
    name: "Silver Dagger",
    category: "weapon",
    value: 22,
    weight: 1,
    description: "An alchemical silver dagger that gleams with a pale sheen.",
    effect: "1d4 piercing, 19-20/x2 crit; bypasses lycanthrope DR",
  },
  {
    id: "uncommon_masterwork_arrows",
    name: "Masterwork Arrows (20)",
    category: "weapon",
    value: 26,
    weight: 3,
    description: "Twenty precisely fletched arrows in a waxed quiver.",
    effect: "+1 to attack rolls (masterwork)",
  },
  {
    id: "uncommon_copper_bracelet",
    name: "Copper Bracelet",
    category: "trade_good",
    value: 15,
    weight: 0.25,
    description: "A hammered copper bracelet set with tiny turquoise beads.",
  },
  {
    id: "uncommon_silver_pendant",
    name: "Silver Pendant",
    category: "trade_good",
    value: 25,
    weight: 0.1,
    description: "A silver pendant on a fine chain, shaped like a crescent moon.",
  },
  {
    id: "uncommon_small_ruby",
    name: "Small Ruby",
    category: "trade_good",
    value: 50,
    weight: 0.05,
    description: "A deep crimson gemstone, roughly cut but vivid in color.",
  },
  {
    id: "uncommon_jade_figurine",
    name: "Jade Figurine",
    category: "trade_good",
    value: 25,
    weight: 0.5,
    description: "A tiny jade carving of a coiled serpent, smooth with age.",
  },
  {
    id: "uncommon_bolt_of_fine_cloth",
    name: "Bolt of Fine Cloth",
    category: "trade_good",
    value: 20,
    weight: 5,
    description: "A roll of richly dyed linen, worth good coin to a tailor.",
  },
  {
    id: "uncommon_elven_mead",
    name: "Bottle of Elven Mead",
    category: "consumable",
    value: 15,
    weight: 1.5,
    description: "A pale golden mead that smells of wildflowers and honey.",
  },
  {
    id: "uncommon_exotic_spice",
    name: "Jar of Exotic Spice",
    category: "trade_good",
    value: 20,
    weight: 0.5,
    description: "A sealed clay jar of saffron and cardamom from distant lands.",
  },
  {
    id: "uncommon_bladefire_flask",
    name: "Bladefire Flask",
    category: "alchemical",
    value: 20,
    weight: 0.5,
    description: "An orange paste that ignites when spread on a weapon's edge.",
    effect: "Apply to weapon as a standard action; +1 fire damage for 1d6 rounds",
  },
  {
    id: "uncommon_ghostoil_flask",
    name: "Ghostoil Flask",
    category: "alchemical",
    value: 50,
    weight: 0.5,
    description: "A translucent oil that shimmers with faint spectral light.",
    effect: "Apply to weapon; can strike incorporeal creatures for 2 rounds",
  },
  {
    id: "uncommon_verminbane_flask",
    name: "Verminbane Flask",
    category: "alchemical",
    value: 20,
    weight: 0.5,
    description: "A pungent alchemical mixture that repels insects and vermin.",
    effect: "Vermin must succeed DC 15 Will save to approach within 5 ft for 1 hour",
  },
  {
    id: "uncommon_alchemists_fire",
    name: "Alchemist's Fire",
    category: "alchemical",
    value: 20,
    weight: 1,
    description: "A flask of sticky, volatile liquid that ignites on contact with air.",
    effect: "Ranged touch attack; 1d6 fire damage, then 1d6 fire next round",
  },
  {
    id: "uncommon_silk_hammock",
    name: "Silk Hammock",
    category: "gear",
    value: 15,
    weight: 2,
    description: "A lightweight hammock of woven silk. Packs down to fist-size.",
  },
  {
    id: "uncommon_silent_shoes",
    name: "Silent Shoes",
    category: "gear",
    value: 20,
    weight: 1,
    description: "Soft-soled shoes crafted for stealth, with padded heels.",
    effect: "+2 circumstance bonus to Move Silently checks",
  },
  {
    id: "uncommon_thieves_tools",
    name: "Thieves' Tools",
    category: "gear",
    value: 30,
    weight: 1,
    description: "A leather roll of lockpicks, tension wrenches, and slim probes.",
    effect: "Required for Open Lock checks; no penalty",
  },
  {
    id: "uncommon_climbers_kit",
    name: "Climber's Kit",
    category: "gear",
    value: 50,
    weight: 5,
    description: "Pitons, crampons, carabiners, and 50 ft of knotted rope.",
    effect: "+2 circumstance bonus to Climb checks",
  },
  {
    id: "uncommon_healers_kit_full",
    name: "Healer's Kit (full)",
    category: "gear",
    value: 50,
    weight: 1,
    description: "A complete healer's kit with fresh bandages and potent salves.",
    effect: "+2 to Heal checks, 10 uses",
  },
  {
    id: "uncommon_magnifying_glass",
    name: "Magnifying Glass",
    category: "gear",
    value: 50,
    weight: 0.5,
    description: "A polished crystal lens in a brass frame. Useful for studying fine detail.",
    effect: "+2 to Appraise checks for detailed items; can start fire in bright sun",
  },
  {
    id: "uncommon_holy_water_2",
    name: "Holy Water (2 flasks)",
    category: "alchemical",
    value: 50,
    weight: 2,
    description: "Two crystal flasks of water blessed by a temple cleric.",
    effect: "2d4 damage to undead/evil outsiders on direct hit; 1 splash",
  },
];

// ============================================================
//  RARE LOOT  (50 – 150 gp)
// ============================================================

export const RARE_LOOT: LootItem[] = [
  // High-value clothing
  {
    id: "rare_noble_outfit",
    name: "Noble's Outfit",
    category: "gear",
    value: 75,
    weight: 10,
    description: "Silk shirt, velvet doublet, fur-trimmed cloak, and jeweled accessories.",
  },
  {
    id: "rare_royal_outfit",
    name: "Royal Outfit",
    category: "gear",
    value: 200,
    weight: 15,
    description: "Ermine-trimmed robes and cloth-of-gold. Fit for a king.",
  },
  {
    id: "rare_fine_steel_longsword",
    name: "Fine Steel Longsword",
    category: "weapon",
    value: 65,
    weight: 4,
    description: "An expertly forged longsword with a mirror-bright blade and wire-wrapped hilt.",
    effect: "1d8 slashing, 19-20/x2 crit; -1 armor check penalty (quality)",
  },
  {
    id: "rare_exceptional_dagger",
    name: "Exceptional Dagger",
    category: "weapon",
    value: 55,
    weight: 1,
    description: "A leaf-shaped dagger of layered steel, balanced perfectly for throwing.",
    effect: "1d4 piercing, 19-20/x2 crit, 10 ft range; +1 attack (masterwork quality)",
  },
  {
    id: "rare_dented_breastplate",
    name: "Dented Breastplate",
    category: "armor",
    value: 75,
    weight: 30,
    description: "A steel breastplate bearing the dents of past battles. Still protects well.",
    effect: "+5 AC, max Dex +3, armor check penalty -4",
  },
  {
    id: "rare_silvered_chain_links",
    name: "Silvered Chain Links",
    category: "armor",
    value: 80,
    weight: 12,
    description: "A vest of interlocking silver-washed rings, light and faintly luminous.",
    effect: "+4 AC, max Dex +5, armor check penalty -1; silver sheen",
  },
  {
    id: "rare_gold_ring",
    name: "Gold Ring",
    category: "trade_good",
    value: 50,
    weight: 0.05,
    description: "A plain gold band, heavy for its size. Worth its weight at any jeweler.",
  },
  {
    id: "rare_gold_necklace",
    name: "Gold Necklace",
    category: "trade_good",
    value: 100,
    weight: 0.25,
    description: "A rope-chain necklace of bright gold with an intricate clasp.",
  },
  {
    id: "rare_polished_gemstone",
    name: "Polished Gemstone",
    category: "trade_good",
    value: 75,
    weight: 0.05,
    description: "A faceted green peridot that catches the light beautifully.",
  },
  {
    id: "rare_topaz",
    name: "Topaz",
    category: "trade_good",
    value: 100,
    weight: 0.05,
    description: "A brilliant amber-gold topaz, properly cut and ready for setting.",
  },
  {
    id: "rare_pearl",
    name: "Pearl",
    category: "trade_good",
    value: 100,
    weight: 0.05,
    description: "A lustrous white pearl with a subtle pink iridescence.",
  },
  {
    id: "rare_silver_goblet",
    name: "Silver Goblet",
    category: "trade_good",
    value: 60,
    weight: 1,
    description: "A finely wrought silver goblet with grape-leaf engravings.",
  },
  {
    id: "rare_ornate_dagger",
    name: "Ornate Dagger",
    category: "weapon",
    value: 80,
    weight: 1,
    description: "A ceremonial dagger with a jeweled pommel and etched blade.",
    effect: "1d4 piercing, 19-20/x2 crit; double value as art object",
  },
  {
    id: "rare_bolt_of_silk",
    name: "Bolt of Silk",
    category: "trade_good",
    value: 100,
    weight: 5,
    description: "A bolt of shimmering silk in deep violet. A noble's fabric.",
  },
  {
    id: "rare_rare_perfume",
    name: "Rare Perfume",
    category: "trade_good",
    value: 75,
    weight: 0.5,
    description: "A crystal vial of perfume distilled from night-blooming jasmine.",
  },
  {
    id: "rare_antique_brooch",
    name: "Antique Brooch",
    category: "trade_good",
    value: 80,
    weight: 0.1,
    description: "A filigree brooch of old elven make, set with a tiny opal.",
  },
  {
    id: "rare_restful_candle",
    name: "Restful Candle",
    category: "alchemical",
    value: 100,
    weight: 0.5,
    description: "A beeswax candle infused with lavender and dreamleaf extract.",
    effect: "Burn during rest; double natural healing for the night",
  },
  {
    id: "rare_focusing_candle",
    name: "Focusing Candle",
    category: "alchemical",
    value: 100,
    weight: 0.5,
    description: "A pale candle that burns with a steady, trance-inducing flame.",
    effect: "Burn during study; +1 alchemical bonus to Knowledge checks for 4 hours",
  },
  {
    id: "rare_clearbreath_vial",
    name: "Clearbreath Vial",
    category: "alchemical",
    value: 50,
    weight: 0.25,
    description: "A sharp-smelling tincture that clears the sinuses instantly.",
    effect: "+4 alchemical bonus to Fortitude saves vs stench and inhaled effects for 1 hour",
  },
  {
    id: "rare_dwarfblind_stone",
    name: "Dwarfblind Stone",
    category: "alchemical",
    value: 50,
    weight: 0.5,
    description: "A fist-sized chalite stone that emits a soft white glow when crushed.",
    effect: "Negates darkvision in 20 ft radius for 10 minutes",
  },
  {
    id: "rare_fleetfoot_vial",
    name: "Fleetfoot Vial",
    category: "alchemical",
    value: 50,
    weight: 0.25,
    description: "A fizzy amber liquid that makes the legs tingle with energy.",
    effect: "Run at x5 speed (instead of x4) for 1 minute",
  },
  {
    id: "rare_vicious_bleeder",
    name: "Vicious Bleeder",
    category: "alchemical",
    value: 50,
    weight: 0.5,
    description: "A dark red paste applied to a blade's edge that prevents clotting.",
    effect: "Apply to weapon; wounded target bleeds 1 hp/round for 2 extra rounds",
  },
  {
    id: "rare_potion_of_healing",
    name: "Small Potion of Healing",
    category: "consumable",
    value: 50,
    weight: 0.5,
    description: "A red potion in a glass vial sealed with wax. Warm to the touch.",
    effect: "Heals 1d8+1 hit points when consumed",
  },
  {
    id: "rare_elven_rope",
    name: "Elven Rope (20 ft)",
    category: "gear",
    value: 50,
    weight: 1,
    description: "Thin silvery rope of elven make, incredibly strong for its weight.",
    effect: "HP 6, Break DC 28, +4 to Use Rope checks, weighs 1/5 normal",
  },
  {
    id: "rare_scroll_protection_evil",
    name: "Scroll of Protection from Evil",
    category: "consumable",
    value: 50,
    weight: 0.1,
    description: "A divine scroll penned on vellum with silver ink.",
    effect: "Casts Protection from Evil (CL 1); +2 deflection AC and +2 resistance saves vs evil creatures for 1 min",
  },
];

// ============================================================
//  TERRAIN LOOT FLAVOR
// ============================================================

export const TERRAIN_LOOT: TerrainLoot[] = [
  {
    terrain: "farm",
    junk: [
      "You find a rusted horseshoe half-buried in the mud.",
      "An old scarecrow's hat lies trampled at the edge of the field.",
      "A broken fence post yields a handful of bent nails.",
      "You discover a cracked clay jug tucked behind a hay bale.",
      "A moth-eaten grain sack holds nothing but weevils and dust.",
    ],
    minor: [
      "Tucked in a barn wall niche, you find something wrapped in oilcloth.",
      "A farmhand's stash beneath a floorboard holds a few useful items.",
      "Behind the water trough, someone left a leather pouch.",
      "The root cellar holds more than turnips — there's gear hidden here.",
      "Hanging from a rafter, a forgotten satchel contains supplies.",
    ],
    major: [
      "Beneath the old oak tree, a buried strongbox holds the farmer's savings.",
      "In the hayloft, hidden under straw, you find a soldier's hidden cache.",
      "The stone well has a false bottom concealing a waterproof bundle.",
      "A hollow fence post contains something wrapped in fine leather.",
      "Behind a loose stone in the fireplace, a small fortune glints.",
    ],
  },
  {
    terrain: "forest",
    junk: [
      "A rotting log splits open to reveal some worthless curiosities.",
      "You spot something glinting in the leaf litter — just trash.",
      "A bird's nest holds shiny bits of scavenged debris.",
      "Tangled in old spider webs, you find some forgotten scraps.",
      "A hollow stump holds the moldering remains of someone's pack.",
    ],
    minor: [
      "A traveler's camp, long abandoned, still has a few useful items.",
      "Carved into a tree trunk is a small cache hidden by a ranger.",
      "A fox den entrance is littered with scavenged items, some still good.",
      "You find a leather satchel hanging from a high branch.",
      "Beneath a mossy rock, someone stashed supplies in a waxed bag.",
    ],
    major: [
      "An old hunter's blind conceals a well-preserved chest of valuables.",
      "The hollow of an ancient oak holds a poacher's secret stash.",
      "You discover a bandit's buried loot at the base of a lightning-split tree.",
      "A druid's offering stone holds gifts left by grateful villagers.",
      "Beneath a waterfall pool, something glitters among the smooth stones.",
    ],
  },
  {
    terrain: "plains",
    junk: [
      "Wind-scoured bones of some animal hold a few scraps caught in the ribs.",
      "A collapsed cairn yields nothing but rubble and a few trinkets.",
      "You find the wreckage of a wagon wheel with some bits still attached.",
      "A prairie dog mound has pushed up some buried refuse.",
      "Tall grass conceals a long-dead traveler's meager possessions.",
    ],
    minor: [
      "A half-buried saddlebag pokes up from the dirt after recent rains.",
      "A merchant's milestone has a hollow compartment in its base.",
      "You find an overturned cart with a few salvageable goods.",
      "A shepherd's abandoned lean-to still holds some useful supplies.",
      "The remains of a campfire ring hide a buried cache beneath the ashes.",
    ],
    major: [
      "A collapsed barrow mound reveals grave goods spilling from the earth.",
      "An old battlefield yields a fallen knight's possessions.",
      "A lightning strike has unearthed a buried chest from some past age.",
      "You discover a smuggler's drop point marked by three stacked stones.",
      "Beneath a lone standing stone, a ritual offering cache lies undisturbed.",
    ],
  },
  {
    terrain: "road",
    junk: [
      "The roadside ditch holds the usual debris of passing caravans.",
      "A milestone's base is cluttered with discarded odds and ends.",
      "You kick something in the dust — just road-worn junk.",
      "A collapsed signpost has some worthless bits tangled at its base.",
      "The ruts in the road have trapped a few small objects in dried mud.",
    ],
    minor: [
      "A traveler's dropped pack lies just off the road, still partly stocked.",
      "Behind a roadside shrine, someone left a thank-offering.",
      "A peddler's broken cart still has a few intact goods in the wreckage.",
      "You find a courier's lost satchel wedged between roadside boulders.",
      "An overturned wagon reveals goods that rolled beneath the chassis.",
    ],
    major: [
      "A bandit ambush site holds the robbers' own stashed loot nearby.",
      "Beneath a bridge, a smuggler's cache is wedged between the stones.",
      "An abandoned toll booth has a locked strongbox still bolted down.",
      "The ruins of a roadside inn conceal a hidden compartment in the floor.",
      "A merchant's buried emergency fund, marked by a carved stone, awaits.",
    ],
  },
  {
    terrain: "town",
    junk: [
      "The alley behind the tavern is littered with the usual refuse.",
      "A gutter drain has accumulated some small worthless objects.",
      "You spot something in a refuse pile — barely worth picking up.",
      "An abandoned market stall still has a few forgotten scraps.",
      "The town well's edge is crusted with lost coins too corroded to spend.",
    ],
    minor: [
      "A loose cobblestone hides a thief's small cache.",
      "Behind a tavern barrel, you find a pouch someone hid and forgot.",
      "An abandoned basement holds a few items left by former tenants.",
      "A hollowed-out book on a junk seller's shelf holds more than pages.",
      "The rafters of an old stable conceal a wrapped bundle.",
    ],
    major: [
      "A secret compartment in a condemned building yields hidden wealth.",
      "Beneath a statue in the town square, a time-worn vault lies unsealed.",
      "An old merchant's wall safe, forgotten during renovations, still holds treasure.",
      "The temple donation box has an overlooked false bottom.",
      "A noble's abandoned townhouse has a hidden panel behind the hearth.",
    ],
  },
  {
    terrain: "swamp",
    junk: [
      "The muck yields something when you step on it — just soggy trash.",
      "A half-sunken log is wrapped in rotting fabric holding a few scraps.",
      "Bubbles rising from the mud reveal a pocket of buried refuse.",
      "A dead tree's roots grip some waterlogged junk.",
      "You pull something from the peat — worthless but interesting.",
    ],
    minor: [
      "A will-o'-wisp led some poor soul here; their pack is still intact.",
      "A poacher's elevated cache box is nailed to a cypress trunk.",
      "The remains of a flat-bottomed boat hold a few salvageable items.",
      "A lizardfolk offering mound contains items of human make.",
      "Wrapped in oiled leather atop a hummock, a small stash survives the damp.",
    ],
    major: [
      "A sunken shrine rises from the water at low tide, its offerings gleaming.",
      "The bog preserves everything — including a merchant's locked coffer.",
      "A witch's abandoned hut holds alchemical supplies and hidden valuables.",
      "Deep in the swamp, a bandit hideout still contains their accumulated loot.",
      "You discover a petrified tree with a cavity stuffed full of treasure.",
    ],
  },
  {
    terrain: "mountain",
    junk: [
      "A rockslide has exposed some buried refuse from a collapsed camp.",
      "A mountain goat trail passes by a cairn holding a few worthless bits.",
      "Wind has swept some debris into a rocky crevice.",
      "You find the frozen remains of a shattered pack, contents mostly ruined.",
      "A shallow cave mouth is littered with bone scraps and cast-off junk.",
    ],
    minor: [
      "A climber's piton trail leads to an abandoned cache on a ledge.",
      "A mountain hermit's shelter holds some useful supplies and gear.",
      "An eagle's nest on a reachable outcrop contains scavenged items.",
      "A mine entrance has a few discarded tools and supplies still usable.",
      "A crevice in the rock face conceals a traveler's emergency stash.",
    ],
    major: [
      "A dwarven waystone has a concealed compartment holding clan treasures.",
      "An avalanche reveals a long-buried prospector's camp with his finds.",
      "A dragon's old minor lair holds a scattering of coins and a few prizes.",
      "High on a peak, a shrine to a mountain god holds precious offerings.",
      "A collapsed mine tunnel opens to reveal a vein of ore and cached valuables.",
    ],
  },
  {
    terrain: "desert",
    junk: [
      "The wind has scoured the sand away from some bleached and worthless debris.",
      "A dried-out waterskin and some sun-cracked belongings litter the dunes.",
      "Sand partially buries the remnants of a long-dead traveler's meager goods.",
      "You find a scorpion nest built around some discarded trinkets.",
      "A sand drift has swallowed most of a camp, leaving only scraps.",
    ],
    minor: [
      "An oasis cache, marked by stacked stones, holds supplies for travelers.",
      "A sand storm has uncovered a buried saddlebag still partly intact.",
      "A nomad's abandoned tent holds a few trade goods and tools.",
      "The base of a desert pillar has a hollow compartment with supplies.",
      "A vulture circles over a lost caravan — some cargo is still salvageable.",
    ],
    major: [
      "Shifting sands reveal the top of a buried tomb, its seals partially broken.",
      "A sandstorm exposes an ancient trader's cache, sealed in clay jars.",
      "An abandoned desert fortress has a treasury room, mostly looted but not empty.",
      "A rare flash flood washes treasure down from the hidden highlands.",
      "Beneath a fallen obelisk, a pharaoh's offering cache lies undisturbed.",
    ],
  },
  {
    terrain: "water",
    junk: [
      "The riverbed holds some waterlogged junk caught between stones.",
      "A tangle of flotsam has accumulated against the bank.",
      "You spot something on the bottom — just rusted and worthless debris.",
      "A fish trap, long abandoned, holds some soggy refuse.",
      "The tide has deposited a line of wrack with a few sad objects.",
    ],
    minor: [
      "A shipwreck's debris field has washed ashore with some intact cargo.",
      "A fisherman's sunken boat is shallow enough to reach, cargo partly dry.",
      "Behind a waterfall, a shallow cave holds a traveler's dry-stored goods.",
      "A river trader's lost crate bobs in an eddy, still sealed.",
      "Oyster beds near the shore yield a few shells worth checking.",
    ],
    major: [
      "A sunken chest, visible through clear water, can be reached with effort.",
      "A sea cave at low tide reveals a smuggler's hidden stores.",
      "The wreck of a merchant vessel has spilled its cargo across the shallows.",
      "A lake shrine, half-submerged, holds offerings from generations of pilgrims.",
      "A river spirit's grotto glitters with gifts left by superstitious travelers.",
    ],
  },
  {
    terrain: "underground",
    junk: [
      "A collapsed section of tunnel reveals some ancient, worthless debris.",
      "Fungus-covered bones hold a few corroded personal effects.",
      "A stagnant pool has accumulated some mineral-crusted junk.",
      "A rat warren is built from scavenged trash and small shiny objects.",
      "Old mine timbers have pinned some useless scraps against the wall.",
    ],
    minor: [
      "A dead adventurer's pack, partly eaten by ooze, still holds some gear.",
      "A kobold's stash behind loose stones contains pilfered supplies.",
      "An underground stream has deposited items in a natural catch basin.",
      "A worked-stone niche in the tunnel wall holds a deliberate cache.",
      "A spider's web-wrapped bundle turns out to be a lost traveler's satchel.",
    ],
    major: [
      "A sealed stone coffer behind a false wall holds dungeon builders' pay.",
      "An underground temple's offering bowl still holds precious gifts.",
      "A dragon's secondary hoard room — just scraps by dragon standards — is a fortune to you.",
      "A drow trader's hidden vault is concealed behind an illusion that has faded.",
      "A geode cavern glitters with crystals, some of which are genuine gemstones.",
    ],
  },
];

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Pick a random item from the given loot tier.
 */
export function pickLoot(tier: LootTier): LootItem {
  const table = getLootTable(tier);
  return table[Math.floor(Math.random() * table.length)];
}

/**
 * Roll a loot drop based on character level range and find outcome.
 *
 * Level 1-3:
 *   minor_find → 1 common  OR  2 junk
 *   major_find → 1 uncommon  OR  2 common
 *
 * Level 3-5:
 *   minor_find → 1 uncommon  OR  2 common
 *   major_find → 1 rare  OR  2 uncommon
 */
export function rollLootDrop(
  levelRange: [number, number],
  outcome: "minor_find" | "major_find"
): LootItem[] {
  const avgLevel = (levelRange[0] + levelRange[1]) / 2;
  const isHighTier = avgLevel >= 3;

  if (outcome === "minor_find") {
    if (isHighTier) {
      // Level 3-5: 1 uncommon or 2 common
      return coinFlip()
        ? [pickLoot("uncommon")]
        : [pickLoot("common"), pickLoot("common")];
    } else {
      // Level 1-3: 1 common or 2 junk
      return coinFlip()
        ? [pickLoot("common")]
        : [pickLoot("junk"), pickLoot("junk")];
    }
  } else {
    // major_find
    if (isHighTier) {
      // Level 3-5: 1 rare or 2 uncommon
      return coinFlip()
        ? [pickLoot("rare")]
        : [pickLoot("uncommon"), pickLoot("uncommon")];
    } else {
      // Level 1-3: 1 uncommon or 2 common
      return coinFlip()
        ? [pickLoot("uncommon")]
        : [pickLoot("common"), pickLoot("common")];
    }
  }
}

/**
 * Get a random terrain-specific flavor text for a loot discovery.
 */
export function getTerrainLootFlavor(
  terrain: string,
  tier: "junk" | "minor" | "major"
): string {
  const entry = TERRAIN_LOOT.find(
    (t) => t.terrain.toLowerCase() === terrain.toLowerCase()
  );
  if (!entry) {
    // Fallback for unknown terrain
    const fallbacks = {
      junk: "You find some scattered debris.",
      minor: "You discover a small cache of useful items.",
      major: "You uncover a well-hidden stash of valuables.",
    };
    return fallbacks[tier];
  }

  const pool = entry[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
//  INTERNAL UTILITIES
// ============================================================

function getLootTable(tier: LootTier): LootItem[] {
  switch (tier) {
    case "junk":
      return JUNK_LOOT;
    case "common":
      return COMMON_LOOT;
    case "uncommon":
      return UNCOMMON_LOOT;
    case "rare":
      return RARE_LOOT;
  }
}

/** Look up a loot item by ID across all tiers */
const ALL_LOOT = [...JUNK_LOOT, ...COMMON_LOOT, ...UNCOMMON_LOOT, ...RARE_LOOT];
const LOOT_MAP = new Map(ALL_LOOT.map(i => [i.id, i]));
export function getItemById(id: string): LootItem | undefined {
  return LOOT_MAP.get(id);
}

function coinFlip(): boolean {
  return Math.random() < 0.5;
}
