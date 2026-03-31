// ============================================================
// shops.ts — D&D 3.5-based shop system for Kardov's Gate and towns
// PHB + Arms & Equipment Guide item listings
// ============================================================

import type { LootItem } from "./loot";

export type ShopCategory =
  | "weapons"
  | "armor"
  | "general"
  | "alchemist"
  | "magic"
  | "provisions"
  | "stables"
  | "pets"
  | "mercenary";

export type ShopItem = LootItem & {
  buyPrice: number; // in copper pieces — what shop charges
  sellPrice: number; // in copper pieces — what shop pays player (50% of value, standard D&D)
  minLevel?: number; // minimum game day/progress to appear (0 = always)
  kardovOnly?: boolean; // only available in Kardov's Gate
};

export type Shop = {
  id: string;
  name: string;
  category: ShopCategory;
  emoji: string;
  description: string;
  items: ShopItem[];
  kardovOnly?: boolean; // entire shop only in Kardov's Gate
};

// ============================================================
//  Helper: build a ShopItem from partial data
// ============================================================

function shopItem(
  id: string,
  name: string,
  category: LootItem["category"],
  valueGp: number,    // value in gold pieces (D&D book price)
  weight: number,
  description: string,
  opts?: {
    effect?: string;
    minLevel?: number;
    kardovOnly?: boolean;
  }
): ShopItem {
  const cp = Math.round(valueGp * 100); // store prices in copper
  return {
    id,
    name,
    category,
    value: valueGp,
    weight,
    description,
    effect: opts?.effect,
    buyPrice: cp,
    sellPrice: Math.floor(cp / 2),
    minLevel: opts?.minLevel ?? 0,
    kardovOnly: opts?.kardovOnly,
  };
}

// ============================================================
//  1. WEAPONS SMITH  ⚔️
// ============================================================

const WEAPONS_SMITH: Shop = {
  id: "shop_weapons",
  name: "Weapons Smith",
  category: "weapons",
  emoji: "⚔️",
  description:
    "The ring of hammers on steel echoes from dawn to dusk. Racks of blades, axes, and polearms line every wall.",
  items: [
    // ---- Simple Melee ----
    shopItem("shop_dagger", "Dagger", "weapon", 2, 1, "A simple double-edged blade, easily concealed.", {
      effect: "1d4 piercing, 19-20/x2 crit, 10ft range increment",
    }),
    shopItem("shop_club", "Club", "weapon", 1, 3, "A stout length of hardwood — crude but effective.", {
      effect: "1d6 bludgeoning, x2 crit",
    }),
    shopItem("shop_mace_heavy", "Heavy Mace", "weapon", 12, 8, "A flanged steel head on a sturdy haft.", {
      effect: "1d8 bludgeoning, x2 crit",
    }),
    shopItem("shop_morningstar", "Morningstar", "weapon", 8, 6, "A spiked metal ball on a wooden handle.", {
      effect: "1d8 bludgeoning and piercing, x2 crit",
    }),
    shopItem("shop_quarterstaff", "Quarterstaff", "weapon", 1, 4, "A smooth-worn six-foot staff of ash.", {
      effect: "1d6/1d6 bludgeoning (double weapon), x2 crit",
    }),
    shopItem("shop_spear", "Spear", "weapon", 2, 6, "A leaf-bladed spearhead on a long ash shaft.", {
      effect: "1d8 piercing, x3 crit, 20ft range increment",
    }),
    shopItem("shop_light_crossbow", "Light Crossbow", "weapon", 35, 4, "A compact crossbow with a simple stirrup for cocking.", {
      effect: "1d8 piercing, 19-20/x2 crit, 80ft range increment",
    }),
    shopItem("shop_heavy_crossbow", "Heavy Crossbow", "weapon", 50, 8, "A powerful arbalest that punches through armor.", {
      effect: "1d10 piercing, 19-20/x2 crit, 120ft range increment",
    }),
    shopItem("shop_javelin", "Javelin", "weapon", 1, 2, "A light throwing spear with a fire-hardened tip.", {
      effect: "1d6 piercing, x2 crit, 30ft range increment",
    }),
    shopItem("shop_sickle", "Sickle", "weapon", 6, 2, "A curved harvesting blade repurposed for combat.", {
      effect: "1d6 slashing, x2 crit",
    }),
    shopItem("shop_shortspear", "Shortspear", "weapon", 1, 3, "A short-hafted spear good for close quarters or throwing.", {
      effect: "1d6 piercing, x2 crit, 20ft range increment",
    }),
    shopItem("shop_sling", "Sling", "weapon", 1, 0, "A leather pouch and cord for hurling stones.", {
      effect: "1d4 bludgeoning, x2 crit, 50ft range increment",
    }),

    // ---- Martial Melee ----
    shopItem("shop_longsword", "Longsword", "weapon", 15, 4, "The quintessential knight's blade — balanced and versatile.", {
      effect: "1d8 slashing, 19-20/x2 crit",
    }),
    shopItem("shop_battleaxe", "Battleaxe", "weapon", 10, 6, "A single-bitted axe head on a stout haft.", {
      effect: "1d8 slashing, x3 crit",
    }),
    shopItem("shop_warhammer", "Warhammer", "weapon", 12, 5, "A blunt steel head designed to dent plate armor.", {
      effect: "1d8 bludgeoning, x3 crit",
    }),
    shopItem("shop_greatsword", "Greatsword", "weapon", 50, 8, "A massive two-handed blade nearly five feet long.", {
      effect: "2d6 slashing, 19-20/x2 crit",
    }),
    shopItem("shop_greataxe", "Greataxe", "weapon", 20, 12, "A broad-bladed axe meant to be swung with both hands.", {
      effect: "1d12 slashing, x3 crit",
    }),
    shopItem("shop_rapier", "Rapier", "weapon", 20, 2, "A slender thrusting blade favoured by duelists.", {
      effect: "1d6 piercing, 18-20/x2 crit",
    }),
    shopItem("shop_scimitar", "Scimitar", "weapon", 15, 4, "A curved slashing blade from the southern deserts.", {
      effect: "1d6 slashing, 18-20/x2 crit",
    }),
    shopItem("shop_flail", "Flail", "weapon", 8, 5, "A spiked ball on a chain — hard to parry.", {
      effect: "1d8 bludgeoning, x2 crit",
    }),
    shopItem("shop_handaxe", "Handaxe", "weapon", 6, 3, "A light hatchet balanced for throwing.", {
      effect: "1d6 slashing, x3 crit, 10ft range increment",
    }),
    shopItem("shop_short_sword", "Short Sword", "weapon", 10, 2, "A broad-bladed sidearm, good for tight spaces.", {
      effect: "1d6 piercing, 19-20/x2 crit",
    }),
    shopItem("shop_trident", "Trident", "weapon", 15, 4, "A three-pronged fishing spear adapted for war.", {
      effect: "1d8 piercing, x2 crit, 10ft range increment",
    }),
    shopItem("shop_lance", "Lance", "weapon", 10, 10, "A long cavalry weapon — devastating on a charge.", {
      effect: "1d8 piercing, x3 crit, double damage on mounted charge",
    }),
    shopItem("shop_longbow", "Longbow", "weapon", 75, 3, "A tall stave bow with impressive range.", {
      effect: "1d8 piercing, x3 crit, 100ft range increment",
    }),
    shopItem("shop_shortbow", "Shortbow", "weapon", 30, 2, "A compact bow favoured by scouts and skirmishers.", {
      effect: "1d6 piercing, x3 crit, 60ft range increment",
    }),
    shopItem("shop_composite_longbow", "Composite Longbow", "weapon", 100, 3, "A laminated bow that lets strong archers add power to every shot.", {
      effect: "1d8 piercing, x3 crit, 110ft range increment, add Str bonus to damage",
    }),

    // ---- Ammunition ----
    shopItem("shop_arrows_20", "Arrows (20)", "gear", 1, 3, "A sheaf of twenty broadhead arrows.", {
      effect: "Standard ammunition for longbows and shortbows",
    }),
    shopItem("shop_bolts_10", "Bolts (10)", "gear", 1, 1, "Ten crossbow bolts with iron tips.", {
      effect: "Standard ammunition for light and heavy crossbows",
    }),
    shopItem("shop_sling_bullets_10", "Sling Bullets (10)", "gear", 0.1, 5, "Ten smooth lead sling bullets.", {
      effect: "Standard ammunition for slings",
    }),

    // ---- Masterwork Weapons (Kardov's Gate, minLevel 10+) ----
    shopItem("shop_mw_longsword", "Masterwork Longsword", "weapon", 315, 4, "A flawlessly forged blade with perfect balance — the mark of a master smith.", {
      effect: "1d8 slashing, 19-20/x2 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_battleaxe", "Masterwork Battleaxe", "weapon", 310, 6, "Every edge honed to razor sharpness by a dwarven artisan.", {
      effect: "1d8 slashing, x3 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_greatsword", "Masterwork Greatsword", "weapon", 350, 8, "A towering blade etched with runes of the forge god.", {
      effect: "2d6 slashing, 19-20/x2 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_greataxe", "Masterwork Greataxe", "weapon", 320, 12, "A massive axe head of blue-grey steel, light for its size.", {
      effect: "1d12 slashing, x3 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_rapier", "Masterwork Rapier", "weapon", 320, 2, "A blade so slender it seems it should break — but never does.", {
      effect: "1d6 piercing, 18-20/x2 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_warhammer", "Masterwork Warhammer", "weapon", 312, 5, "Perfectly weighted — every swing lands true.", {
      effect: "1d8 bludgeoning, x3 crit, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_longbow", "Masterwork Longbow", "weapon", 375, 3, "Laminated yew with silver-chased tips, sings when drawn.", {
      effect: "1d8 piercing, x3 crit, 100ft range increment, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_mw_composite_longbow", "Masterwork Composite Longbow", "weapon", 400, 3, "A master bowyer's finest work — horn, sinew, and heartwood in perfect union.", {
      effect: "1d8 piercing, x3 crit, 110ft range increment, add Str bonus to damage, +1 enhancement bonus to attack rolls",
      minLevel: 10,
      kardovOnly: true,
    }),

    // ---- Exotic Weapons (Kardov's Gate, minLevel 10+) ----
    shopItem("shop_bastard_sword", "Bastard Sword", "weapon", 35, 6, "A hand-and-a-half blade from the northern kingdoms.", {
      effect: "1d10 slashing, 19-20/x2 crit, exotic weapon proficiency required",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_dwarven_waraxe", "Dwarven Waraxe", "weapon", 30, 8, "A heavy single-bitted axe sized for dwarven hands.", {
      effect: "1d10 slashing, x3 crit, exotic weapon proficiency required",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_spiked_chain", "Spiked Chain", "weapon", 25, 10, "A length of barbed chain that whirls in deadly arcs.", {
      effect: "2d4 piercing, x2 crit, reach, can trip, exotic weapon proficiency required",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_kukri", "Kukri", "weapon", 8, 2, "A forward-curved blade from distant lands.", {
      effect: "1d4 slashing, 18-20/x2 crit, exotic weapon proficiency required",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_whip", "Whip", "weapon", 1, 2, "A braided leather lash — 15 feet of reach.", {
      effect: "1d3 slashing, x2 crit, 15ft reach, provokes AoO, cannot harm armored foes, exotic weapon proficiency required",
      minLevel: 10,
      kardovOnly: true,
    }),
  ],
};

// ============================================================
//  2. ARMORER  🛡️
// ============================================================

const ARMORER: Shop = {
  id: "shop_armor",
  name: "Armorer",
  category: "armor",
  emoji: "🛡️",
  description:
    "Breastplates gleam on wooden stands while chain shirts hang like iron curtains. The smell of oil and leather fills the air.",
  items: [
    // ---- Light Armor ----
    shopItem("shop_padded", "Padded Armor", "armor", 5, 10, "Layers of quilted cloth — better than nothing.", {
      effect: "+1 AC, max Dex +8, armor check penalty 0, 5% arcane spell failure",
    }),
    shopItem("shop_leather", "Leather Armor", "armor", 10, 15, "Cured hide formed into a flexible vest and bracers.", {
      effect: "+2 AC, max Dex +6, armor check penalty 0, 10% arcane spell failure",
    }),
    shopItem("shop_studded_leather", "Studded Leather", "armor", 25, 20, "Leather reinforced with close-set metal rivets.", {
      effect: "+3 AC, max Dex +5, armor check penalty -1, 15% arcane spell failure",
    }),
    shopItem("shop_chain_shirt", "Chain Shirt", "armor", 100, 25, "A shirt of interlocking steel rings — light yet strong.", {
      effect: "+4 AC, max Dex +4, armor check penalty -2, 20% arcane spell failure",
    }),

    // ---- Medium Armor ----
    shopItem("shop_hide", "Hide Armor", "armor", 15, 25, "Thick animal hides layered and stitched together.", {
      effect: "+3 AC, max Dex +4, armor check penalty -3, 20% arcane spell failure",
    }),
    shopItem("shop_scale_mail", "Scale Mail", "armor", 50, 30, "Overlapping metal scales sewn to a leather backing.", {
      effect: "+4 AC, max Dex +3, armor check penalty -4, 25% arcane spell failure",
    }),
    shopItem("shop_chainmail", "Chainmail", "armor", 150, 40, "A full coat of interlocking steel rings covering torso and arms.", {
      effect: "+5 AC, max Dex +2, armor check penalty -5, 30% arcane spell failure",
    }),
    shopItem("shop_breastplate", "Breastplate", "armor", 200, 30, "A fitted metal torso piece — solid protection without full plate's weight.", {
      effect: "+5 AC, max Dex +3, armor check penalty -4, 25% arcane spell failure",
    }),

    // ---- Heavy Armor ----
    shopItem("shop_splint_mail", "Splint Mail", "armor", 200, 45, "Vertical strips of metal riveted to a leather backing.", {
      effect: "+6 AC, max Dex +0, armor check penalty -7, 40% arcane spell failure",
    }),
    shopItem("shop_banded_mail", "Banded Mail", "armor", 250, 35, "Overlapping horizontal bands of metal over chain.", {
      effect: "+6 AC, max Dex +1, armor check penalty -6, 35% arcane spell failure",
    }),
    shopItem("shop_half_plate", "Half-Plate", "armor", 600, 50, "Plate pieces protecting vital areas, joined by chain and leather.", {
      effect: "+7 AC, max Dex +0, armor check penalty -7, 40% arcane spell failure",
      minLevel: 15,
    }),
    shopItem("shop_full_plate", "Full Plate", "armor", 1500, 50, "A complete suit of articulated plate — the pinnacle of the armorer's craft.", {
      effect: "+8 AC, max Dex +1, armor check penalty -6, 35% arcane spell failure",
      minLevel: 25,
      kardovOnly: true,
    }),

    // ---- Shields ----
    shopItem("shop_buckler", "Buckler", "armor", 15, 5, "A small round shield strapped to the forearm.", {
      effect: "+1 AC, armor check penalty -1, 5% arcane spell failure",
    }),
    shopItem("shop_light_wooden_shield", "Light Wooden Shield", "armor", 3, 5, "A round wooden shield with an iron boss.", {
      effect: "+1 AC, armor check penalty -1, 5% arcane spell failure",
    }),
    shopItem("shop_light_steel_shield", "Light Steel Shield", "armor", 9, 6, "A light steel shield — durable and easy to handle.", {
      effect: "+1 AC, armor check penalty -1, 5% arcane spell failure",
    }),
    shopItem("shop_heavy_wooden_shield", "Heavy Wooden Shield", "armor", 7, 10, "A broad wooden shield reinforced with iron bands.", {
      effect: "+2 AC, armor check penalty -2, 15% arcane spell failure",
    }),
    shopItem("shop_heavy_steel_shield", "Heavy Steel Shield", "armor", 20, 15, "A large steel shield that can turn aside heavy blows.", {
      effect: "+2 AC, armor check penalty -2, 15% arcane spell failure",
    }),
    shopItem("shop_tower_shield", "Tower Shield", "armor", 30, 45, "A massive shield that provides nearly full cover.", {
      effect: "+4 AC (as total cover vs. one direction), armor check penalty -10, 50% arcane spell failure",
    }),
  ],
};

// ============================================================
//  3. GENERAL STORE  🎒
// ============================================================

const GENERAL_STORE: Shop = {
  id: "shop_general",
  name: "General Store",
  category: "general",
  emoji: "🎒",
  description:
    "Floor-to-ceiling shelves stuffed with rope, tools, lanterns, and everything an adventurer could need.",
  items: [
    shopItem("shop_backpack", "Backpack", "gear", 2, 2, "A sturdy canvas pack with leather straps.", {
      effect: "Carries up to 60 lbs of gear",
    }),
    shopItem("shop_bedroll", "Bedroll", "gear", 0.1, 5, "A rolled wool blanket and ground pad.", {
      effect: "Comfortable rest on hard ground",
    }),
    shopItem("shop_rope_silk", "Rope, Silk (50 ft.)", "gear", 10, 5, "Fifty feet of lightweight silken rope, incredibly strong.", {
      effect: "HP 4, Break DC 24, can be burst with DC 24 Strength check",
    }),
    shopItem("shop_rope_hemp", "Rope, Hemp (50 ft.)", "gear", 1, 10, "Fifty feet of sturdy hempen rope.", {
      effect: "HP 2, Break DC 23, can be burst with DC 23 Strength check",
    }),
    shopItem("shop_grappling_hook", "Grappling Hook", "gear", 1, 4, "A three-pronged iron hook for anchoring rope.", {
      effect: "Use with rope; DC 10 ranged touch to set on a surface",
    }),
    shopItem("shop_torch_5", "Torches (5)", "gear", 1, 5, "Five pitch-soaked wooden torches bundled together.", {
      effect: "Each burns 1 hour, 20ft normal light + 20ft shadowy",
    }),
    shopItem("shop_lantern_hooded", "Hooded Lantern", "gear", 7, 2, "A tin-and-glass lantern with a shutter to mask the light.", {
      effect: "Burns 6 hours/pint of oil, 30ft normal light + 30ft shadowy",
    }),
    shopItem("shop_oil_flask", "Oil (flask)", "gear", 0.1, 1, "A pint of lamp oil in a ceramic flask.", {
      effect: "Fuels a lantern for 6 hours, or use as improvised fire weapon (1d3 fire + 1d3 next round)",
    }),
    shopItem("shop_flint_steel", "Flint & Steel", "gear", 1, 0, "A sharp flint and steel striker in a leather pouch.", {
      effect: "Lights a fire as a full-round action",
    }),
    shopItem("shop_waterskin", "Waterskin", "gear", 1, 4, "A leather waterskin holding about half a gallon.", {
      effect: "Carries 1 day's water for a Medium creature",
    }),
    shopItem("shop_caltrops", "Caltrops", "gear", 1, 2, "A pouch of four-pronged iron spikes.", {
      effect: "Covers a 5ft square; creatures entering must save or take 1 damage and have speed halved",
    }),
    shopItem("shop_signal_whistle", "Signal Whistle", "gear", 0.8, 0, "A shrill tin whistle audible up to a quarter mile.", {
      effect: "Can be heard clearly at long range; useful for signaling allies",
    }),
    shopItem("shop_hammer", "Hammer", "gear", 0.5, 2, "A small iron hammer for driving pitons.", {
      effect: "Drives pitons into stone or wood",
    }),
    shopItem("shop_pitons_10", "Pitons (10)", "gear", 1, 5, "Ten iron pitons for climbing or anchoring.", {
      effect: "Driven into cracks to aid climbing; +2 circumstance bonus on Climb checks with rope",
    }),
    shopItem("shop_crowbar", "Crowbar", "gear", 2, 5, "A heavy iron pry bar.", {
      effect: "+2 circumstance bonus on Strength checks to force open doors or lids",
    }),
    shopItem("shop_pole_10ft", "Pole, 10 ft.", "gear", 0.2, 8, "A ten-foot wooden pole for prodding ahead.", {
      effect: "Useful for checking for traps, testing footing, and reaching high places",
    }),
    shopItem("shop_mirror_steel", "Mirror, Small Steel", "gear", 10, 0.5, "A polished steel hand mirror.", {
      effect: "Can peek around corners; useful against gaze attacks",
    }),
    shopItem("shop_ink_pen", "Ink & Pen", "gear", 8.1, 0, "A vial of black ink and a quill pen.", {
      effect: "Sufficient ink for approximately 50 pages of writing",
    }),
    shopItem("shop_parchment_10", "Parchment (10 sheets)", "gear", 2, 0, "Ten sheets of fine calf-skin parchment.", {
      effect: "Writing material for notes, maps, or scrolls",
    }),
    shopItem("shop_candles_10", "Candles (10)", "gear", 1, 0, "Ten tallow candles in a waxed paper bundle.", {
      effect: "Each burns 1 hour, 5ft dim light",
    }),
    shopItem("shop_chalk_10", "Chalk (10 pieces)", "gear", 0.1, 0, "Ten sticks of white chalk.", {
      effect: "Mark walls, draw diagrams, leave trail markers",
    }),
    shopItem("shop_soap", "Soap (1 lb.)", "gear", 0.5, 1, "A bar of lye soap.", {
      effect: "Cleaning — keeps wounds from festering and gear from rusting",
    }),
    shopItem("shop_tent_2", "Tent, 2-person", "gear", 10, 20, "A canvas tent with poles and stakes for two.", {
      effect: "Shelter from weather for two Medium creatures",
    }),
    shopItem("shop_fishing_tackle", "Fishing Tackle", "gear", 20, 5, "Rod, line, hooks, lures, and a small net.", {
      effect: "Allows Survival checks to catch fish; provides food in the wild",
    }),
    shopItem("shop_healers_kit", "Healer's Kit", "gear", 50, 1, "A leather case packed with bandages, salves, and splints.", {
      effect: "10 uses; +2 circumstance bonus on Heal checks",
    }),
    shopItem("shop_thieves_tools", "Thieves' Tools", "gear", 30, 1, "A set of lockpicks, files, and slim prybars in a leather roll.", {
      effect: "Required for Open Lock and Disable Device checks (no penalty)",
    }),
    shopItem("shop_climbers_kit", "Climber's Kit", "gear", 80, 5, "Pitons, boot tips, gloves, and a harness.", {
      effect: "+2 circumstance bonus on Climb checks",
    }),
    shopItem("shop_magnifying_glass", "Magnifying Glass", "gear", 100, 0, "A finely ground glass lens in a brass frame.", {
      effect: "+2 circumstance bonus on Appraise checks for small or detailed items; can start fires in sunlight",
      kardovOnly: true,
    }),
    shopItem("shop_spyglass", "Spyglass", "gear", 1000, 1, "A collapsible brass telescope of gnomish manufacture.", {
      effect: "Objects appear twice as close; +2 on Spot checks for distant objects",
      minLevel: 20,
      kardovOnly: true,
    }),
  ],
};

// ============================================================
//  4. PROVISIONS  🍖
// ============================================================

const PROVISIONS: Shop = {
  id: "shop_provisions",
  name: "Provisions",
  category: "provisions",
  emoji: "🍖",
  description:
    "Sacks of grain, strings of dried sausage, and barrels of ale crowd the shelves of this well-stocked larder.",
  items: [
    shopItem("shop_rations_1", "Trail Rations (1 day)", "consumable", 0.5, 1, "A day's worth of jerky, hard cheese, and dried fruit.", {
      effect: "Sustains one Medium creature for 1 day",
    }),
    shopItem("shop_rations_5", "Trail Rations (5 days)", "consumable", 2.5, 5, "Five days of preserved travel food packed tight.", {
      effect: "Sustains one Medium creature for 5 days",
    }),
    shopItem("shop_rations_10", "Trail Rations (10 days)", "consumable", 5, 10, "A full tenday's provisions — enough for a long journey.", {
      effect: "Sustains one Medium creature for 10 days",
    }),
    shopItem("shop_bread", "Bread Loaf", "consumable", 0.02, 0.5, "A round loaf of dense peasant bread.", {
      effect: "A simple meal for one person",
    }),
    shopItem("shop_cheese", "Cheese Hunk", "consumable", 0.1, 0.5, "A wedge of sharp yellow cheese wrapped in cloth.", {
      effect: "A filling snack; keeps for weeks",
    }),
    shopItem("shop_meat_chunk", "Meat Chunk", "consumable", 0.3, 0.5, "A salt-cured slab of mutton or beef.", {
      effect: "A hearty meal portion; keeps for several days",
    }),
    shopItem("shop_ale_mug", "Ale (mug)", "consumable", 0.04, 1, "A mug of common brown ale.", {
      effect: "Takes the edge off a long day on the road",
    }),
    shopItem("shop_ale_gallon", "Ale (gallon)", "consumable", 0.2, 8, "A full gallon jug of ale — enough to share around the campfire.", {
      effect: "Serves approximately 8 mugs worth",
    }),
    shopItem("shop_wine_common", "Wine, Common (pitcher)", "consumable", 0.2, 6, "A clay pitcher of rough red wine.", {
      effect: "Serviceable table wine from local vineyards",
    }),
    shopItem("shop_wine_fine", "Wine, Fine (bottle)", "consumable", 10, 1.5, "A sealed bottle of aged wine from a reputable vintage.", {
      effect: "Excellent quality; valued as a gift or luxury",
    }),
    shopItem("shop_feed_mount_1", "Feed for Mount (1 day)", "consumable", 0.05, 10, "A nosebag's worth of oats and hay.", {
      effect: "Feeds one horse, pony, or similar mount for 1 day",
    }),
    shopItem("shop_banquet", "Banquet (per person)", "consumable", 10, 0, "A lavish multi-course meal with fine wine and entertainment.", {
      effect: "A memorable feast; may improve NPC attitudes",
      kardovOnly: true,
    }),
  ],
};

// ============================================================
//  5. ALCHEMIST  🧪
// ============================================================

const ALCHEMIST: Shop = {
  id: "shop_alchemist",
  name: "Alchemist",
  category: "alchemist",
  emoji: "🧪",
  description:
    "Shelves of bubbling flasks, jars of coloured powder, and a sharp chemical tang in the air. Don't touch anything without asking.",
  items: [
    // ---- PHB Alchemical Items ----
    shopItem("shop_alchemists_fire", "Alchemist's Fire", "alchemical", 20, 1, "A flask of volatile liquid that ignites on contact with air.", {
      effect: "Ranged touch attack, 1d6 fire damage + 1d6 splash; target takes 1d6 fire next round unless extinguished",
    }),
    shopItem("shop_acid_flask", "Acid (flask)", "alchemical", 10, 1, "A ceramic flask of concentrated acid.", {
      effect: "Ranged touch attack, 1d6 acid damage + 1 splash damage",
    }),
    shopItem("shop_holy_water", "Holy Water", "alchemical", 25, 1, "Water blessed by a cleric, deadly to undead and evil outsiders.", {
      effect: "Ranged touch attack, 2d4 damage to undead/evil outsiders + 1 splash",
    }),
    shopItem("shop_tanglefoot_bag", "Tanglefoot Bag", "alchemical", 50, 4, "A leather bag of sticky alchemical goo.", {
      effect: "Ranged touch attack; target entangled, -2 attack, -4 Dex, must save or be glued to floor",
    }),
    shopItem("shop_thunderstone", "Thunderstone", "alchemical", 30, 1, "A dark stone that detonates with a deafening crack.", {
      effect: "Ranged attack (10ft radius); DC 15 Fort save or deafened for 1 hour; +2 DC to concentrate",
    }),
    shopItem("shop_smokestick", "Smokestick", "alchemical", 20, 0.5, "A thick stick that belches concealing smoke.", {
      effect: "Creates 10ft cube of smoke for 1 round (outdoors) or 1 minute (enclosed); provides concealment",
    }),
    shopItem("shop_sunrod", "Sunrod", "alchemical", 2, 1, "A gold-tipped iron rod that glows brightly when struck.", {
      effect: "Bright light 30ft + shadowy light 30ft for 6 hours; no flame",
    }),
    shopItem("shop_tindertwigs_5", "Tindertwigs (5)", "alchemical", 5, 0, "Five wax-tipped wooden splints that ignite with a scratch.", {
      effect: "Each lights a fire as a standard action (no Survival check); +1 to start campfires",
    }),
    shopItem("shop_antitoxin", "Antitoxin", "alchemical", 50, 0, "A vial of chalky liquid that fortifies the body against poison.", {
      effect: "+5 alchemical bonus on Fort saves vs. poison for 1 hour",
    }),

    // ---- Arms & Equipment Guide Items ----
    shopItem("shop_bladefire", "Bladefire", "alchemical", 20, 0.5, "An oily paste that coats a weapon in harmless green flames.", {
      effect: "Apply to weapon; +1 fire damage for 1 minute, weapon sheds light as torch",
    }),
    shopItem("shop_ghostoil", "Ghostoil", "alchemical", 50, 0, "A shimmering translucent oil distilled from ectoplasm.", {
      effect: "Apply to weapon; weapon can strike incorporeal creatures for 2 rounds (no miss chance)",
    }),
    shopItem("shop_verminbane", "Verminbane", "alchemical", 20, 0.5, "A pungent herbal paste that drives away vermin.", {
      effect: "Apply to skin; vermin must DC 15 Will save to approach within 5ft for 1 hour",
    }),
    shopItem("shop_clearbreath", "Clearbreath", "alchemical", 50, 0, "A minty tincture inhaled to ward off airborne toxins.", {
      effect: "+2 alchemical bonus on saves vs. inhaled poisons, stinking cloud, and similar effects for 1 hour",
    }),
    shopItem("shop_dwarfblind_stone", "Dwarfblind Stone", "alchemical", 50, 1, "A small stone that emits a burst of searing sparks.", {
      effect: "Thrown; creatures within 5ft must DC 13 Reflex or be blinded for 1 round; dazzled for 1 minute on save",
      minLevel: 5,
    }),
    shopItem("shop_fleetfoot", "Fleetfoot Vial", "alchemical", 50, 0, "A quicksilver draught that makes your legs tingle.", {
      effect: "+10 ft. alchemical bonus to base speed for 1 minute",
      minLevel: 5,
    }),
    shopItem("shop_vicious_bleeder", "Vicious Bleeder", "alchemical", 50, 0.5, "A cruel glass vial filled with anti-coagulant salve.", {
      effect: "Apply to slashing/piercing weapon; wounded target takes 1 bleed damage/round for 3 rounds (DC 15 Heal to stop)",
      minLevel: 5,
    }),
    shopItem("shop_restful_candle", "Restful Candle", "alchemical", 100, 0.5, "A pale blue candle that exudes calming vapors.", {
      effect: "Burns 8 hours; all creatures within 20ft heal 1 extra hp per HD during rest",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_focusing_candle", "Focusing Candle", "alchemical", 100, 0.5, "A deep amber candle that sharpens the mind.", {
      effect: "Burns 8 hours; +1 alchemical bonus on Int-based skill checks for all creatures within 20ft",
      minLevel: 10,
      kardovOnly: true,
    }),
  ],
};

// ============================================================
//  6. STABLES  🐴
// ============================================================

const STABLES: Shop = {
  id: "shop_stables",
  name: "Stables",
  category: "stables",
  emoji: "🐴",
  description:
    "The warm smell of hay and horse greets you. Sturdy mounts stamp in their stalls while tack hangs on every post.",
  items: [
    // ---- Mounts ----
    shopItem("shop_riding_horse", "Riding Horse", "gear", 75, 0, "A healthy, well-trained saddle horse.", {
      effect: "Speed 60ft, carries up to 200 lbs (light load); Handle Animal DC 10 to ride",
    }),
    shopItem("shop_light_warhorse", "Light Warhorse", "gear", 150, 0, "A trained combat mount — fast and fearless.", {
      effect: "Speed 60ft, carries up to 230 lbs (light load); combat trained, won't bolt from battle",
      minLevel: 5,
    }),
    shopItem("shop_heavy_warhorse", "Heavy Warhorse", "gear", 400, 0, "A massive destrier bred and trained for war.", {
      effect: "Speed 50ft, carries up to 300 lbs (light load); combat trained, can attack (hoof 1d6+4)",
      minLevel: 10,
      kardovOnly: true,
    }),
    shopItem("shop_pony", "Pony", "gear", 30, 0, "A sturdy little mount suitable for halflings or gnomes.", {
      effect: "Speed 40ft, carries up to 75 lbs (light load)",
    }),
    shopItem("shop_donkey_mule", "Donkey/Mule", "gear", 8, 0, "A stubborn but dependable pack animal.", {
      effect: "Speed 30ft, carries up to 100 lbs (light load); sure-footed on rough terrain",
    }),
    shopItem("shop_riding_dog", "Riding Dog", "gear", 150, 0, "A large, trained war dog used as a mount by small races.", {
      effect: "Speed 40ft, carries up to 100 lbs (light load); combat trained, bite attack 1d6+3",
    }),

    // ---- Tack and Related ----
    shopItem("shop_saddle_riding", "Saddle, Riding", "gear", 10, 25, "A standard leather saddle with stirrups.", {
      effect: "+2 circumstance bonus on Ride checks to stay in saddle",
    }),
    shopItem("shop_saddle_military", "Saddle, Military", "gear", 20, 30, "A high-cantled war saddle with leg braces.", {
      effect: "+2 circumstance bonus on Ride checks to stay in saddle; grants +2 on Ride checks in combat",
    }),
    shopItem("shop_saddle_pack", "Saddle, Pack", "gear", 5, 15, "A wooden frame for loading cargo on a mount.", {
      effect: "Allows mount to carry gear as a pack animal",
    }),
    shopItem("shop_saddlebags", "Saddlebags", "gear", 4, 8, "A pair of leather bags that drape over a saddle.", {
      effect: "Carries up to 40 lbs of gear on a mount",
    }),
    shopItem("shop_bit_bridle", "Bit and Bridle", "gear", 2, 1, "A metal bit and leather bridle for controlling a mount.", {
      effect: "Required for normal riding; without it, Ride checks are at -2",
    }),
    shopItem("shop_feed_7days", "Feed (7 days)", "gear", 4, 70, "A week's supply of oats and hay for one mount.", {
      effect: "Feeds one horse or similar mount for 7 days",
    }),
    shopItem("shop_stabling_7days", "Stabling (7 days)", "gear", 4, 0, "A week of shelter, water, and basic care at the stables.", {
      effect: "Mount is housed, watered, and groomed for 7 days",
    }),
  ],
};

// ============================================================
//  7. ARCANE EMPORIUM  🔮  (Kardov's Gate only)
// ============================================================

const ARCANE_EMPORIUM: Shop = {
  id: "shop_magic",
  name: "Arcane Emporium",
  category: "magic",
  emoji: "🔮",
  description:
    "Velvet curtains, floating candles, and the hum of latent magic. Every item here glows faintly under detect magic.",
  kardovOnly: true,
  items: [
    // ---- Potions ----
    shopItem("shop_potion_clw", "Potion of Cure Light Wounds", "consumable", 50, 0.1, "A small vial of warm, golden liquid that knits wounds closed.", {
      effect: "Heals 1d8+1 hit points when consumed",
    }),
    shopItem("shop_potion_bulls_str", "Potion of Bull's Strength", "consumable", 300, 0.1, "A dark red draught that makes your muscles swell with power.", {
      effect: "+4 enhancement bonus to Strength for 3 minutes",
      minLevel: 5,
    }),
    shopItem("shop_potion_cats_grace", "Potion of Cat's Grace", "consumable", 300, 0.1, "A pale yellow liquid that makes your movements fluid and sure.", {
      effect: "+4 enhancement bonus to Dexterity for 3 minutes",
      minLevel: 5,
    }),
    shopItem("shop_potion_bears_end", "Potion of Bear's Endurance", "consumable", 300, 0.1, "A thick brown tincture that hardens your body against punishment.", {
      effect: "+4 enhancement bonus to Constitution for 3 minutes",
      minLevel: 5,
    }),

    // ---- Scrolls ----
    shopItem("shop_scroll_magic_missile", "Scroll of Magic Missile", "consumable", 25, 0, "A parchment inscribed with arcane formulae that crackle faintly.", {
      effect: "Casts Magic Missile (CL 1): 1d4+1 force damage, auto-hit, single target",
    }),
    shopItem("shop_scroll_shield", "Scroll of Shield", "consumable", 25, 0, "A scroll bearing a protective ward written in silver ink.", {
      effect: "Casts Shield (CL 1): invisible disc grants +4 shield bonus to AC for 1 min, negates magic missile",
    }),
    shopItem("shop_scroll_clw", "Scroll of Cure Light Wounds", "consumable", 25, 0, "A scroll inscribed with divine healing prayers.", {
      effect: "Casts Cure Light Wounds (CL 1): heals 1d8+1 hit points",
    }),
    shopItem("shop_scroll_bless", "Scroll of Bless", "consumable", 25, 0, "A scroll bearing a divine invocation of courage.", {
      effect: "Casts Bless (CL 1): allies within 50ft gain +1 morale bonus to attack and saves vs. fear for 1 min",
      minLevel: 3,
    }),
    shopItem("shop_scroll_fireball", "Scroll of Fireball", "consumable", 375, 0, "A scroll sealed with red wax, warm to the touch.", {
      effect: "Casts Fireball (CL 5): 5d6 fire damage in 20ft radius, Reflex DC 14 half",
      minLevel: 10,
    }),

    // ---- Wondrous Items / Rings ----
    shopItem("shop_cloak_resistance_1", "Cloak of Resistance +1", "gear", 1000, 1, "A fine grey cloak that shimmers faintly — woven with protective enchantments.", {
      effect: "+1 resistance bonus to all saving throws",
      minLevel: 15,
    }),
    shopItem("shop_amulet_nat_armor_1", "Amulet of Natural Armor +1", "gear", 2000, 0, "A bone amulet carved with druidic sigils that toughen the wearer's skin.", {
      effect: "+1 enhancement bonus to natural armor",
      minLevel: 20,
    }),
    shopItem("shop_ring_protection_1", "Ring of Protection +1", "gear", 2000, 0, "A slim silver ring inscribed with a continuous ward of deflection.", {
      effect: "+1 deflection bonus to AC",
      minLevel: 20,
    }),
  ],
};

// ============================================================
//  8. PET STORE  🐾  (Kardov's Gate only)
// ============================================================

const PET_STORE: Shop = {
  id: "shop_pets",
  name: "Exotic Pets & Companions",
  category: "pets",
  emoji: "🐾",
  description:
    "Cages rattle, something hisses from behind a curtain, and a small drake chews on its handler's glove. Welcome to the menagerie.",
  kardovOnly: true,
  items: [
    // ---- Common Pets ----
    shopItem("pet_dog", "Dog, Guard", "gear", 25, 0, "A trained guard dog — loyal, alert, and territorial.", {
      effect: "Companion: +2 Spot/Listen in camp. Will fight (bite 1d4+1, HP 6)",
    }),
    shopItem("pet_cat", "Cat", "gear", 1, 0, "A sleek mouser that keeps vermin away from your camp.", {
      effect: "Companion: reduces vermin encounter chance by 10%",
    }),
    shopItem("pet_hawk", "Hawk", "gear", 18, 0, "A sharp-eyed raptor trained to return to its handler.", {
      effect: "Companion: +2 Spot checks outdoors, can scout 1 hex ahead",
    }),
    shopItem("pet_raven", "Raven", "gear", 2, 0, "A glossy black bird that can mimic a few words.", {
      effect: "Companion: can deliver simple messages, +1 Gather Information in town",
    }),
    shopItem("pet_owl", "Owl", "gear", 15, 0, "A silent hunter with uncanny night vision.", {
      effect: "Companion: +2 Spot/Listen at night, advantage on ambush detection during rest",
    }),

    // ---- Exotic Pets ----
    shopItem("pet_climbdog", "Climbdog", "gear", 155, 0, "A small, nimble beast that can scale walls and fight to the death for its owner.", {
      effect: "Companion: +2 Climb checks, fights loyally (bite 1d4+2, HP 8, can climb walls)",
      minLevel: 5,
    }),
    shopItem("pet_shocker_lizard", "Shocker Lizard", "gear", 1750, 0, "A fashionable small lizard that crackles with electricity. Often worn on the shoulder.", {
      effect: "Companion: electric jolt 1d8 damage (1/day), +1 Intimidate from the sparking display",
      minLevel: 10,
    }),
    shopItem("pet_krenshar", "Krenshar", "gear", 1000, 0, "A feline creature that can retract its facial skin to expose a terrifying skull-face.", {
      effect: "Companion: Scare ability — enemies must DC 13 Will or be shaken for 1d4 rounds. Needs companions or loses ability",
      minLevel: 10,
    }),
    shopItem("pet_pseudodragon", "Pseudodragon", "gear", 5000, 0, "A tiny dragon the size of a cat — vain, clever, and fiercely loyal if well-fed.", {
      effect: "Companion: telepathy 60ft, can detect magic at will, sting attack (1d3 + sleep poison DC 14)",
      minLevel: 20,
    }),

    // ---- Guard Creatures ----
    shopItem("pet_rust_monster", "Rust Monster", "gear", 2200, 0, "A strange insectoid creature that devours metal. Friendly when domesticated.", {
      effect: "Guard: destroys metal weapons/armor on touch. First line of defense for camps. Antennae rust metal within 5ft",
      minLevel: 15,
    }),
    shopItem("pet_otyugh", "Otyugh", "gear", 3500, 0, "A grotesque three-legged aberration that wallows in filth. Surprisingly obedient.", {
      effect: "Guard: follows complex guarding instructions, tentacle attack 1d6+2. Lives happily in garbage/sewers",
      minLevel: 15,
    }),
    shopItem("pet_owlbear", "Owlbear (Young)", "gear", 5000, 0, "A fearsome hybrid of bear and owl — surly to strangers, devoted to its trainer.", {
      effect: "Guard: claw/claw/bite 1d6+2/1d6+2/1d8+1, HP 32. Very aggressive toward anyone but owner",
      minLevel: 20,
    }),

    // ---- Exotic Mounts (high-level) ----
    shopItem("pet_axebeak", "Axebeak", "gear", 70, 0, "A large flightless bird with a vicious beak — surprisingly fast and easy to train.", {
      effect: "Mount: Speed 50ft, carries up to 200 lbs. Bite attack 1d6+2. Handle Animal DC 11",
      minLevel: 5,
    }),
    shopItem("pet_riding_lizard", "Riding Lizard", "gear", 1300, 0, "A large reptilian mount favoured by dwarves and those who travel underground.", {
      effect: "Mount: Speed 30ft (climb 15ft), carries up to 300 lbs. Can traverse walls and cavern ceilings",
      minLevel: 10,
    }),
    shopItem("pet_worg", "Worg", "gear", 2500, 0, "An evil-tempered giant wolf with a cruel intelligence — must be broken to serve.", {
      effect: "Mount: Speed 50ft, carries up to 258 lbs. Bite 1d6+3, trip attack. Handle Animal DC 22",
      minLevel: 15,
    }),
    shopItem("pet_hippogriff", "Hippogriff", "gear", 8000, 0, "A majestic flying mount — half eagle, half horse. Fiercely territorial but trainable.", {
      effect: "Flying mount: Speed 50ft/fly 100ft. Claw/claw/bite 1d4+2/1d4+2/1d8+1. Carries 300 lbs",
      minLevel: 25,
    }),
    shopItem("pet_wyvern", "Wyvern", "gear", 6000, 0, "A two-legged dragon cousin with a venomous tail stinger. Extremely dangerous to train.", {
      effect: "Flying mount: Speed 20ft/fly 60ft. Sting 1d6+4 + poison (DC 17, 2d6 Con), carries 696 lbs",
      minLevel: 30,
    }),
  ],
};

// ============================================================
//  9. MERCENARY GUILD  ⚔️🛡️  (Kardov's Gate + Fortresses)
// ============================================================

const MERCENARY_GUILD: Shop = {
  id: "shop_mercenary",
  name: "Mercenary Guild",
  category: "mercenary",
  emoji: "🏛️",
  description:
    "Swords-for-hire. Pay a hiring fee upfront, then a daily wage in gold + food. Unpaid mercenaries lose morale and desert.",
  kardovOnly: true, // also available at fortress hexes
  items: [
    // ---- Foot Skirmishers (cheap, hit-and-run) ----
    shopItem("merc_skirmisher", "Skirmisher, Foot", "gear", 2, 0, "A lightly armed harasser with sling and halfspear. Hit-and-run only.", {
      effect: "\u{1F4B0} UPKEEP: 2sp/day + 1 food/day | +1 ranged support. Flees if engaged in melee. Padded armor, sling, halfspear",
    }),
    shopItem("merc_skirmisher_archer", "Skirmisher, Archer", "gear", 4, 0, "A mobile bowman in leather armor. Good at softening targets.", {
      effect: "\u{1F4B0} UPKEEP: 4sp/day + 1 food/day | +2 ranged support. Light crossbow, handaxe, leather armor. Retreats when pressed",
    }),

    // ---- Light Foot (frontline infantry) ----
    shopItem("merc_light_foot", "Light Footman", "gear", 3, 0, "A basic soldier with shield and sword. Holds the line.", {
      effect: "\u{1F4B0} UPKEEP: 3sp/day + 1 food/day | +1 melee support, absorbs 1 hit/fight. Studded leather, short sword, shield",
    }),
    shopItem("merc_light_archer", "Light Archer", "gear", 4, 0, "An archer trained to march in formation and hold position.", {
      effect: "\u{1F4B0} UPKEEP: 4sp/day + 1 food/day | +2 ranged support. Leather, longbow, dagger. Covering fire",
    }),

    // ---- Medium Foot (professional soldiers) ----
    shopItem("merc_medium_foot", "Medium Footman", "gear", 8, 0, "A well-armed, well-armored professional soldier. City guard quality.", {
      effect: "\u{1F4B0} UPKEEP: 8sp/day + 1 food/day | +2 melee support, absorbs 2 hits/fight. Chain shirt, longsword, shield",
      minLevel: 5,
    }),
    shopItem("merc_pikeman", "Pikeman", "gear", 10, 0, "A spear-wielding soldier trained to counter cavalry charges.", {
      effect: "\u{1F4B0} UPKEEP: 1gp/day + 1 food/day | +3 melee support vs mounted, set against charge. Scale mail, longspear",
      minLevel: 5,
    }),

    // ---- Heavy Foot (shock troops) ----
    shopItem("merc_heavy_foot", "Heavy Footman", "gear", 20, 0, "A heavily armored shock trooper. First into the breach.", {
      effect: "\u{1F4B0} UPKEEP: 2gp/day + 1 food/day | +3 melee support, absorbs 3 hits/fight. Half-plate, greatsword, heavy shield",
      minLevel: 15,
    }),

    // ---- Mounted (require stabling) ----
    shopItem("merc_light_mounted", "Light Cavalry", "gear", 16, 0, "A fast rider in leather armor. Exploits flanks and weak spots.", {
      effect: "\u{1F4B0} UPKEEP: 1.6gp/day + 1 food/day | +2 melee support, mobile flanking. Leather, lance, short sword, light warhorse",
      minLevel: 10,
    }),
    shopItem("merc_medium_mounted", "Medium Cavalry", "gear", 36, 0, "An armored lancer on a barded warhorse. Serious combat power.", {
      effect: "\u{1F4B0} UPKEEP: 3.6gp/day + 1 food/day | +4 melee support, devastating charge. Chain, lance, longsword, heavy warhorse w/ barding",
      minLevel: 20,
    }),
    shopItem("merc_heavy_mounted", "Heavy Cavalry", "gear", 48, 0, "A knight-grade heavy lancer. Masters of the battlefield.", {
      effect: "\u{1F4B0} UPKEEP: 4.8gp/day + 1 food/day | +5 melee support, charge breaks lines. Half-plate, heavy lance, heavy warhorse w/ heavy barding",
      minLevel: 25,
    }),

    // ---- Exotic Troops ----
    shopItem("merc_goblin", "Goblin Scouts", "gear", 1, 0, "Cheap, expendable scouts. Useful for scouting ahead and setting ambushes.", {
      effect: "\u{1F4B0} UPKEEP: 1sp/day + 1 food/day | +1 scouting, reveals dangers 1 hex ahead. Leather, morningstar, javelins",
    }),
    shopItem("merc_hobgoblin", "Hobgoblin Soldiers", "gear", 4, 0, "Disciplined and well-organized. Better troops than their cost suggests.", {
      effect: "\u{1F4B0} UPKEEP: 2sp/day + 1 food/day | +2 melee support, fight in formation. Leather, longsword, shield, javelins",
      minLevel: 5,
    }),
    shopItem("merc_gnoll", "Gnoll Brutes", "gear", 4, 0, "Towering hyena-headed warriors. Brutal in close combat.", {
      effect: "\u{1F4B0} UPKEEP: 2sp/day + 1 food/day | +3 melee support but -1 discipline. Scale mail, battleaxe, shortbow",
      minLevel: 5,
    }),
    shopItem("merc_bugbear", "Bugbear Enforcers", "gear", 40, 0, "Large, stealthy, and savage. Excellent ambush troops.", {
      effect: "\u{1F4B0} UPKEEP: 4gp/day + 1 food/day | +3 melee, +2 ambush/stealth. Leather, morningstar, javelins. Move Silently +4",
      minLevel: 10,
    }),
    shopItem("merc_ogre", "Ogre Mercenary", "gear", 40, 0, "A dim-witted giant that hits like a battering ram. Requires extra feeding.", {
      effect: "\u{1F4B0} UPKEEP: 4gp/day + 3 food/day | +5 melee support, can break barriers. Huge greatclub, hide armor",
      minLevel: 15,
    }),
    shopItem("merc_centaur", "Centaur Lancer", "gear", 60, 0, "A noble half-horse warrior with lance and bow. Proud and self-sufficient.", {
      effect: "\u{1F4B0} UPKEEP: 6gp/day + 1 food/day | +4 melee/+3 ranged, mobile. Heavy lance, composite longbow (+4 Str), shield",
      minLevel: 20,
    }),
    shopItem("merc_minotaur", "Minotaur Champion", "gear", 80, 0, "A massive bull-headed warrior wielding an enormous axe. Terrifying on the battlefield.", {
      effect: "\u{1F4B0} UPKEEP: 8gp/day + 1 food/day | +6 melee support, charge attack, natural cunning (never gets lost). Huge greataxe",
      minLevel: 25,
    }),

    // ---- Specialist Hirelings ----
    shopItem("merc_guide", "Wilderness Guide", "gear", 3, 0, "A weathered local who knows the trails, water sources, and dangers of the region.", {
      effect: "\u{1F4B0} UPKEEP: 3sp/day + 1 food/day | +4 Survival/Knowledge(local). Reduces hazard chance. Reveals terrain 2 hexes out",
    }),
    shopItem("merc_healer", "Field Healer", "gear", 5, 0, "An adept with basic divine magic. Keeps the party patched up on the road.", {
      effect: "\u{1F4B0} UPKEEP: 5sp/day + 1 food/day | Cure Light Wounds 2x/day (1d8+1). +2 Heal checks in camp",
      minLevel: 3,
    }),
    shopItem("merc_cook", "Camp Cook", "gear", 1, 0, "A skilled cook who can stretch rations and forage for ingredients.", {
      effect: "\u{1F4B0} UPKEEP: 1sp/day + 1 food/day | Reduces party food consumption by 1/day. +1 morale on rest healing",
    }),
    shopItem("merc_animal_trainer", "Animal Trainer", "gear", 8, 0, "An expert handler who can train and care for exotic beasts.", {
      effect: "\u{1F4B0} UPKEEP: 8sp/day + 1 food/day | Required to train exotic pets/mounts. +8 Handle Animal. Calms hostile animals",
      minLevel: 5,
    }),
    shopItem("merc_sage", "Sage", "gear", 20, 0, "A learned scholar who can identify items, lore, and magical phenomena.", {
      effect: "\u{1F4B0} UPKEEP: 2gp/day + 1 food/day | +10 Knowledge (any). Identifies magic items and texts. Sedentary \u2014 won't travel",
      minLevel: 10,
    }),
    shopItem("merc_teamster", "Teamster", "gear", 3, 0, "A driver with a cart or wagon who handles pack animals and cargo.", {
      effect: "\u{1F4B0} UPKEEP: 3sp/day + 1 food/day | +50% carry capacity for party. Handles mounts and pack animals. Cart not included",
    }),
    shopItem("merc_interpreter", "Interpreter", "gear", 3, 0, "A polyglot who speaks several regional and exotic languages.", {
      effect: "\u{1F4B0} UPKEEP: 3sp/day + 1 food/day | Translates 3+ languages. +2 Diplomacy with foreign NPCs",
      minLevel: 5,
    }),
    shopItem("merc_siege_engineer", "Siege Engineer", "gear", 20, 0, "A specialist in fortification assault and construction. Invaluable for strongholds.", {
      effect: "\u{1F4B0} UPKEEP: 2gp/day + 1 food/day | Builds/operates siege equipment, assesses fortifications. Knowledge(tactics) +8",
      minLevel: 20,
    }),
  ],
};

// ============================================================
//  10. CLOTHIER  👘  (PHB + Arms & Equipment Guide clothing)
// ============================================================

const CLOTHIER: Shop = {
  id: "shop_clothier",
  name: "Clothier",
  category: "general",
  emoji: "👘",
  description:
    "Bolts of cloth, leather scraps, and finished garments crowd every surface. The tailor eyes your measurements before you even ask.",
  items: [
    // ---- Individual Clothing Items (A&E Guide) ----
    shopItem("shop_sandals", "Sandals", "gear", 0.05, 0.5, "Simple leather sandals. Better than bare feet.", {
      effect: "Basic footwear",
    }),
    shopItem("shop_boots_soft", "Boots, Soft", "gear", 1, 1, "Supple leather boots that muffle footsteps.", {
      effect: "Quiet footwear; no penalty to Move Silently",
    }),
    shopItem("shop_boots_riding", "Boots, Riding", "gear", 3, 3, "Tall leather boots with a hard heel for stirrups.", {
      effect: "+1 circumstance bonus on Ride checks",
    }),
    shopItem("shop_boots_winter", "Boots, Winter", "gear", 3, 3, "Fur-lined boots with thick soles for snow and ice.", {
      effect: "No penalty to movement on ice/snow",
    }),
    shopItem("shop_cap", "Cap/Hat", "gear", 0.1, 0, "A simple wool or felt cap.", {
      effect: "Keeps rain off your face",
    }),
    shopItem("shop_hat_wide", "Wide-Brimmed Hat", "gear", 0.5, 0.5, "A broad hat that shades the face and neck.", {
      effect: "+1 circumstance bonus on Fort saves vs. sun/heat",
    }),
    shopItem("shop_cloak_common", "Cloak, Common", "gear", 0.5, 1, "A plain wool cloak with a simple clasp.", {
      effect: "Basic protection from wind and rain",
    }),
    shopItem("shop_cloak_winter", "Cloak, Winter", "gear", 5, 3, "A heavy fur-lined cloak for bitter cold.", {
      effect: "+2 circumstance bonus on Fort saves vs. cold weather",
    }),
    shopItem("shop_gloves", "Gloves", "gear", 1, 0, "Fitted leather gloves.", {
      effect: "Protects hands; no penalty to fine manipulation",
    }),
    shopItem("shop_belt", "Belt", "gear", 0.5, 0, "A sturdy leather belt with a simple buckle.", {
      effect: "Holds pouches, scabbards, and tools",
    }),
    shopItem("shop_scarf", "Scarf", "gear", 0.2, 0, "A long woolen scarf.", {
      effect: "Warmth; can serve as an improvised bandage or gag",
    }),
    shopItem("shop_sash", "Sash", "gear", 0.1, 0.5, "A wide cloth sash worn at the waist.", {
      effect: "Can conceal a dagger or small pouch",
    }),
    shopItem("shop_linen_shirt", "Linen Shirt", "gear", 0.2, 0.5, "A simple undyed linen shirt.", {
      effect: "Basic garment",
    }),
    shopItem("shop_tunic", "Tunic", "gear", 0.8, 1, "A knee-length woolen tunic.", {
      effect: "Common daily wear",
    }),
    shopItem("shop_vest", "Vest", "gear", 0.3, 0.5, "A sleeveless leather vest.", {
      effect: "Casual wear; pockets for small items",
    }),
    shopItem("shop_doublet", "Doublet", "gear", 1, 1, "A fitted, padded jacket worn over a shirt.", {
      effect: "Respectable town wear",
    }),
    shopItem("shop_jerkin", "Leather Jerkin", "gear", 0.5, 1, "A tough leather jerkin worn over lighter clothes.", {
      effect: "No AC bonus but protects clothes from wear",
    }),
    shopItem("shop_hose", "Hose", "gear", 0.1, 0.5, "Wool or linen hose worn as leg coverings.", {
      effect: "Basic legwear",
    }),
    shopItem("shop_surcoat", "Surcoat", "gear", 3, 3, "A long sleeveless overgarment, often bearing a coat of arms.", {
      effect: "Can display heraldry or faction allegiance",
    }),
    shopItem("shop_tabard", "Tabard", "gear", 2, 2, "A short overgarment with open sides, often bearing insignia.", {
      effect: "Displays affiliation; quick to put on over armor",
    }),
    shopItem("shop_robe_common", "Robe, Common", "gear", 1, 2, "A plain full-length robe with a rope belt.", {
      effect: "Scholar or priest's daily wear; many pockets",
    }),

    // ---- Full Outfits (PHB + A&E Guide) ----
    shopItem("shop_outfit_peasant", "Peasant's Outfit", "gear", 0.1, 2, "A loose shirt, breeches, and cloth shoes. Rough but serviceable.", {
      effect: "Marks wearer as common folk",
    }),
    shopItem("shop_outfit_artisan", "Artisan's Outfit", "gear", 1, 4, "Sturdy work clothes with tool loops and stain-resistant apron.", {
      effect: "Appropriate for skilled laborers and craftsmen",
    }),
    shopItem("shop_outfit_traveler", "Traveler's Outfit", "gear", 1, 5, "Sturdy boots, wool trousers, a linen shirt, and a cloak — built for the road.", {
      effect: "Standard adventurer wear; no penalties in any terrain",
    }),
    shopItem("shop_outfit_entertainer", "Entertainer's Outfit", "gear", 3, 4, "Flashy garments in bright colors with ribbon trim.", {
      effect: "+1 circumstance bonus on Perform checks",
    }),
    shopItem("shop_outfit_explorer", "Explorer's Outfit", "gear", 10, 8, "Reinforced clothing with many pockets, a wide hat, and high boots.", {
      effect: "+1 circumstance bonus on Survival checks in the wild",
    }),
    shopItem("shop_outfit_scholar", "Scholar's Outfit", "gear", 5, 6, "A long robe over fine linen, with ink-stained cuffs.", {
      effect: "+1 circumstance bonus on Knowledge checks in libraries",
    }),
    shopItem("shop_outfit_monk", "Monk's Outfit", "gear", 5, 2, "A simple, functional garment that allows full freedom of movement.", {
      effect: "No armor check penalty; suitable for martial arts",
    }),
    shopItem("shop_outfit_cleric", "Cleric's Vestments", "gear", 5, 6, "Ceremonial robes appropriate to a specific deity.", {
      effect: "+1 circumstance bonus on Diplomacy with faithful",
    }),
    shopItem("shop_outfit_cold_weather", "Cold Weather Outfit", "gear", 8, 7, "A wool coat, linen shirt, heavy cloak, and fur-lined gloves and boots.", {
      effect: "+5 circumstance bonus on Fort saves vs. cold weather",
    }),
    shopItem("shop_outfit_courtier", "Courtier's Outfit", "gear", 30, 6, "Tailored clothing in fine fabric, suitable for audiences with nobility.", {
      effect: "+2 circumstance bonus on Diplomacy with nobility",
      minLevel: 5,
    }),
    shopItem("shop_outfit_noble", "Noble's Outfit", "gear", 75, 10, "Silk shirt, velvet doublet, fur-trimmed cloak, and jeweled accessories.", {
      effect: "+4 circumstance bonus on Diplomacy with nobility; marks wearer as aristocracy",
      minLevel: 10,
    }),
    shopItem("shop_outfit_royal", "Royal Outfit", "gear", 200, 15, "Ermine-trimmed robes, jeweled crown, and cloth-of-gold sash.", {
      effect: "+6 circumstance bonus on Diplomacy with all; Intimidate +2 vs. commoners",
      minLevel: 20,
      kardovOnly: true,
    }),
  ],
};

// ============================================================
//  ALL SHOPS
// ============================================================

export const ALL_SHOPS: Shop[] = [
  WEAPONS_SMITH,
  ARMORER,
  GENERAL_STORE,
  PROVISIONS,
  ALCHEMIST,
  STABLES,
  CLOTHIER,
  ARCANE_EMPORIUM,
  PET_STORE,
  MERCENARY_GUILD,
];

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Returns shops available at a given location.
 * Kardov's Gate gets all shops. Fortresses get the Mercenary Guild + non-kardovOnly shops.
 * Smaller towns get everything except shops flagged kardovOnly.
 */
export function getShopsForLocation(isKardov: boolean, isFortress: boolean = false): Shop[] {
  if (isKardov) return ALL_SHOPS;
  if (isFortress) return ALL_SHOPS.filter((shop) => !shop.kardovOnly || shop.id === "shop_mercenary");
  return ALL_SHOPS.filter((shop) => !shop.kardovOnly);
}

/**
 * Returns items currently available in a shop based on game-day progression.
 * Items with kardovOnly are excluded unless the caller pre-filtered for Kardov's Gate.
 * Pass `isKardov = true` to include kardovOnly items within otherwise-available shops.
 */
export function getAvailableItems(
  shop: Shop,
  gameDay: number,
  isKardov: boolean = false
): ShopItem[] {
  return shop.items.filter((item) => {
    // filter out items that require higher progression
    if ((item.minLevel ?? 0) > gameDay) return false;
    // filter out kardovOnly items when not in Kardov's Gate
    if (item.kardovOnly && !isKardov) return false;
    return true;
  });
}

/**
 * Standard D&D 50% sell price.
 * Returns what the shop will pay the player for an item.
 */
export function sellItem(item: ShopItem): number {
  return item.sellPrice;
}
