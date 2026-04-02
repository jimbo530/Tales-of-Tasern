// ============================================================
// foodItems.ts — D&D 3.5 Arms & Equipment Guide food & drink
// Dropped in farm, city, and bandit encounters.
// Prices in copper pieces. Weight in lbs.
// ============================================================

export type FoodItem = {
  id: string;
  name: string;
  priceCp: number;       // cost in copper
  weight: number;        // lbs per unit
  foodValue: number;     // how many "food units" this provides (1 = 1 meal/action)
  category: "meat" | "grain" | "produce" | "dairy" | "drink" | "spice" | "prepared" | "exotic";
  desc: string;
};

// ── Common Food (farms, cities, bandits carry these) ────────────────────────

export const COMMON_FOOD: FoodItem[] = [
  // Meat & Fish — preserved, travel-ready
  { id: "food_beef_jerked",     name: "Beef Jerky",          priceCp: 700,  weight: 1, foodValue: 3, category: "meat",     desc: "Tough dried strips of beef. Keeps for weeks." },
  { id: "food_beef_dried",      name: "Dried Beef",          priceCp: 500,  weight: 1, foodValue: 3, category: "meat",     desc: "Salt-cured and air-dried beef." },
  { id: "food_pork_sausage",    name: "Pork Sausage",        priceCp: 100,  weight: 1, foodValue: 2, category: "meat",     desc: "Spiced ground pork in casing." },
  { id: "food_pork_bacon",      name: "Bacon",               priceCp: 400,  weight: 1, foodValue: 2, category: "meat",     desc: "Salt-cured pork belly. A traveler's luxury." },
  { id: "food_pork_salted",     name: "Salted Pork",         priceCp: 300,  weight: 1, foodValue: 2, category: "meat",     desc: "Heavily salted pork. Keeps well on the road." },
  { id: "food_cod_salted",      name: "Salted Cod",          priceCp: 500,  weight: 1, foodValue: 2, category: "meat",     desc: "Dried and salted cod fillet." },
  { id: "food_herring_pickled", name: "Pickled Herring",     priceCp: 300,  weight: 1, foodValue: 1, category: "meat",     desc: "Small fish preserved in brine and vinegar." },
  { id: "food_sardines",        name: "Sardines",            priceCp: 400,  weight: 1, foodValue: 1, category: "meat",     desc: "Tiny oily fish, packed in salt." },

  // Grain & Flour
  { id: "food_wheat_flour",     name: "Wheat Flour",         priceCp: 300,  weight: 1, foodValue: 2, category: "grain",    desc: "Ground wheat. Needs cooking." },
  { id: "food_oats",            name: "Oats",                priceCp: 70,   weight: 1, foodValue: 2, category: "grain",    desc: "Rolled oats. Makes porridge." },
  { id: "food_rice",            name: "Rice",                priceCp: 500,  weight: 1, foodValue: 3, category: "grain",    desc: "White rice. Light and filling." },
  { id: "food_barley",          name: "Barley",              priceCp: 100,  weight: 1, foodValue: 2, category: "grain",    desc: "Hearty grain for stew or porridge." },
  { id: "food_bread_loaf",      name: "Bread Loaf",          priceCp: 2,    weight: 1, foodValue: 2, category: "grain",    desc: "A round loaf of coarse wheat bread." },

  // Produce & Dried Fruit
  { id: "food_apples_dried",    name: "Dried Apples",        priceCp: 100,  weight: 1, foodValue: 1, category: "produce",  desc: "Sweet chewy apple slices." },
  { id: "food_raisins",         name: "Raisins",             priceCp: 100,  weight: 1, foodValue: 1, category: "produce",  desc: "Dried grapes. Energy on the trail." },
  { id: "food_chestnuts",       name: "Chestnuts",           priceCp: 100,  weight: 1, foodValue: 1, category: "produce",  desc: "Can be roasted or ground into flour." },
  { id: "food_walnuts",         name: "Walnuts",             priceCp: 30,   weight: 1, foodValue: 1, category: "produce",  desc: "Hard-shelled nuts. Good trail food." },
  { id: "food_onion",           name: "Onions",              priceCp: 50,   weight: 1, foodValue: 1, category: "produce",  desc: "Pungent and filling. Improves any stew." },
  { id: "food_mushrooms_dried", name: "Dried Mushrooms",     priceCp: 100,  weight: 0, foodValue: 1, category: "produce",  desc: "Light and reconstitute in water." },

  // Dairy
  { id: "food_cheese_wheel",    name: "Cheese Wheel",        priceCp: 40,   weight: 2, foodValue: 4, category: "dairy",    desc: "A round of hard cheese. Keeps for months." },
  { id: "food_butter",          name: "Butter Crock",        priceCp: 20,   weight: 1, foodValue: 1, category: "dairy",    desc: "Salted butter in a clay pot." },

  // Prepared
  { id: "food_trail_rations",   name: "Trail Rations (1 day)", priceCp: 50, weight: 1, foodValue: 3, category: "prepared", desc: "Mix of dried meat, hard cheese, and hardtack." },
  { id: "food_meat_pie",        name: "Meat Pie",            priceCp: 10,   weight: 1, foodValue: 2, category: "prepared", desc: "Hot pastry filled with minced meat and gravy." },
  { id: "food_stew_bowl",       name: "Bowl of Stew",        priceCp: 3,    weight: 1, foodValue: 1, category: "prepared", desc: "Thick pottage of root vegetables and barley." },
  { id: "food_honey",           name: "Honey (pint)",        priceCp: 10,   weight: 1, foodValue: 1, category: "prepared", desc: "Wild honey. Sweetener, preservative, and medicine." },

  // Drink
  { id: "food_ale_gallon",      name: "Ale (gallon)",        priceCp: 20,   weight: 8, foodValue: 0, category: "drink",    desc: "Common brown ale. Safer than water." },
  { id: "food_ale_mug",         name: "Ale (mug)",           priceCp: 4,    weight: 1, foodValue: 0, category: "drink",    desc: "A mug of common brown ale." },
  { id: "food_wine_common",     name: "Common Wine (bottle)", priceCp: 20,  weight: 2, foodValue: 0, category: "drink",    desc: "Cheap table wine. Slightly vinegary." },
  { id: "food_mead",            name: "Mead (pint)",         priceCp: 50,   weight: 1, foodValue: 0, category: "drink",    desc: "Honey wine. Sweet and strong." },
  { id: "food_grog",            name: "Grog",                priceCp: 3,    weight: 1, foodValue: 0, category: "drink",    desc: "Watered-down rum. A sailor's staple." },
  { id: "food_tea",             name: "Tea (pot)",           priceCp: 2,    weight: 0, foodValue: 0, category: "drink",    desc: "Dried herb tea. Calming and warm." },

  // Fresh produce & meals (Arms & Equipment Guide)
  { id: "food_fruit",           name: "Fresh Fruit",         priceCp: 1,    weight: 0, foodValue: 1, category: "produce",  desc: "An apple, pear, or plum. Simple and refreshing." },
  { id: "food_vegetables",      name: "Vegetables (bag)",    priceCp: 1,    weight: 1, foodValue: 1, category: "produce",  desc: "Root vegetables — turnips, carrots, parsnips." },
  { id: "food_eggs",            name: "Eggs (dozen)",        priceCp: 2,    weight: 1, foodValue: 2, category: "dairy",    desc: "Fresh hen's eggs. Versatile and nutritious." },
  { id: "food_porridge",        name: "Porridge (bowl)",     priceCp: 3,    weight: 1, foodValue: 1, category: "prepared", desc: "Hot oat porridge. Filling and cheap." },
  { id: "food_soup",            name: "Soup (bowl)",         priceCp: 3,    weight: 1, foodValue: 1, category: "prepared", desc: "Thin broth with whatever was handy." },
  { id: "food_meat_mutton",     name: "Mutton Leg",          priceCp: 20,   weight: 2, foodValue: 2, category: "meat",     desc: "A leg of roasted mutton. Common fare." },
  { id: "food_meat_venison",    name: "Venison Steak",       priceCp: 50,   weight: 1, foodValue: 2, category: "meat",     desc: "Wild deer meat. Rich and gamey." },
  { id: "food_meat_poultry",    name: "Roast Chicken",       priceCp: 15,   weight: 2, foodValue: 2, category: "meat",     desc: "A whole roasted chicken, seasoned with herbs." },
  { id: "food_pickled_cabbage", name: "Pickled Cabbage",     priceCp: 5,    weight: 1, foodValue: 1, category: "produce",  desc: "Fermented cabbage in brine. Keeps forever." },
  { id: "food_dried_beans",     name: "Dried Beans",         priceCp: 5,    weight: 1, foodValue: 2, category: "grain",    desc: "Dried lentils and beans. Need soaking but very filling." },
  { id: "food_salt_pork",       name: "Salt Pork (slab)",    priceCp: 50,   weight: 2, foodValue: 3, category: "meat",     desc: "A thick slab of salt-cured pork. Trail essential." },
  { id: "food_hardtack",        name: "Hardtack (10 pieces)", priceCp: 5,   weight: 1, foodValue: 2, category: "grain",    desc: "Rock-hard biscuits. Nearly indestructible." },
  { id: "food_inn_poor",        name: "Inn Meal (poor)",     priceCp: 10,   weight: 0, foodValue: 1, category: "prepared", desc: "Stale bread, thin soup, and water." },
  { id: "food_inn_common",      name: "Inn Meal (common)",   priceCp: 30,   weight: 0, foodValue: 2, category: "prepared", desc: "Bread, stew, and ale. Decent fare." },
  { id: "food_inn_good",        name: "Inn Meal (good)",     priceCp: 50,   weight: 0, foodValue: 3, category: "prepared", desc: "Roast meat, fresh bread, wine. A proper meal." },
  { id: "food_milk",            name: "Milk (pint)",         priceCp: 1,    weight: 1, foodValue: 1, category: "dairy",    desc: "Fresh cow's milk. Best drunk quickly." },
  { id: "food_goat_cheese",     name: "Goat Cheese",         priceCp: 10,   weight: 1, foodValue: 1, category: "dairy",    desc: "Tangy soft cheese from goat's milk." },
];

// ── Valuable / Exotic Food (city markets, wealthy bandits) ──────────────────

export const EXOTIC_FOOD: FoodItem[] = [
  { id: "food_saffron",         name: "Saffron (1 oz)",      priceCp: 6500, weight: 0, foodValue: 0, category: "spice",   desc: "Worth its weight in gold. Prized by alchemists and cooks alike." },
  { id: "food_pepper",          name: "Pepper (1 oz)",       priceCp: 3000, weight: 0, foodValue: 0, category: "spice",   desc: "Black peppercorns from distant lands." },
  { id: "food_nutmeg",          name: "Nutmeg (1 oz)",       priceCp: 3000, weight: 0, foodValue: 0, category: "spice",   desc: "Exotic spice. Extremely valuable as trade goods." },
  { id: "food_cinnamon",        name: "Cinnamon (1 oz)",     priceCp: 100,  weight: 0, foodValue: 0, category: "spice",   desc: "Rolled bark from tropical trees." },
  { id: "food_cloves",          name: "Cloves (1 oz)",       priceCp: 2000, weight: 0, foodValue: 0, category: "spice",   desc: "Aromatic spice. Used in cooking and medicine." },
  { id: "food_coffee",          name: "Coffee (1 lb)",       priceCp: 5000, weight: 1, foodValue: 0, category: "exotic",  desc: "Rare roasted beans from far southern lands." },
  { id: "food_elven_wine",      name: "Aleeian Wine, Elven", priceCp: 10000, weight: 2, foodValue: 0, category: "drink",  desc: "Forest grapes picked over months. Astounding flavor." },
  { id: "food_dwarven_garnet",  name: "Garnet Wine, Dwarven", priceCp: 9000, weight: 2, foodValue: 0, category: "drink",  desc: "Mountain grapes with ground garnet 'for flavor.'" },
  { id: "food_frenzywater",     name: "Frenzywater",         priceCp: 1500, weight: 2, foodValue: 0, category: "drink",   desc: "Potent clear spirit. Those with rage must save or fly into a frenzy." },
  { id: "food_frostwine",       name: "Frostwine",           priceCp: 4000, weight: 2, foodValue: 0, category: "drink",   desc: "Delicate white wine from extreme northern grapes. Frost worms guard the vines." },
  { id: "food_drow_spiderblood",name: "Spiderblood, Drow",   priceCp: 15000, weight: 2, foodValue: 0, category: "drink",  desc: "Drow mushroom wine laced with spider venom. Poisonous to surface dwellers." },
  { id: "food_buffalo_jerked",  name: "Buffalo Jerky",       priceCp: 4500, weight: 1, foodValue: 3, category: "meat",    desc: "Rare and expensive. From the great plains." },
  { id: "food_smoked_salmon",   name: "Smoked Salmon",       priceCp: 1500, weight: 1, foodValue: 2, category: "meat",    desc: "Delicate pink fish, slowly smoked over alder." },
];

// ── Drop Tables ─────────────────────────────────────────────────────────────

/** Roll a random common food item (farms, markets, bandits) */
export function rollCommonFood(): FoodItem {
  return COMMON_FOOD[Math.floor(Math.random() * COMMON_FOOD.length)];
}

/** Farm-appropriate food categories for random selection */
const FARM_FOODS = () => COMMON_FOOD.filter(f =>
  f.category === "grain" || f.category === "produce" || f.category === "dairy" || f.category === "meat" || f.category === "prepared");

/** Roll 1-3 food items for a farm encounter */
export function rollFarmDrop(): FoodItem[] {
  const count = Math.floor(Math.random() * 3) + 1;
  const items: FoodItem[] = [];
  const pool = FARM_FOODS();
  for (let i = 0; i < count; i++) {
    items.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return items;
}

/** Roll 1-2 food items for low-level wilderness finds (foraging, hunting) */
export function rollWildernessFoodDrop(): FoodItem[] {
  const count = Math.floor(Math.random() * 2) + 1;
  const items: FoodItem[] = [];
  // Wilderness finds: wild produce, hunted meat, foraged nuts/mushrooms — no prepared or dairy
  const wildFoods = COMMON_FOOD.filter(f =>
    f.category === "meat" || f.category === "produce" || f.category === "grain");
  for (let i = 0; i < count; i++) {
    items.push(wildFoods[Math.floor(Math.random() * wildFoods.length)]);
  }
  return items;
}

/** Roll food for a city encounter (includes chance of exotic) */
export function rollCityDrop(): FoodItem[] {
  const count = Math.floor(Math.random() * 2) + 1;
  const items: FoodItem[] = [];
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.1) {
      items.push(EXOTIC_FOOD[Math.floor(Math.random() * EXOTIC_FOOD.length)]);
    } else {
      items.push(COMMON_FOOD[Math.floor(Math.random() * COMMON_FOOD.length)]);
    }
  }
  return items;
}

/** Roll food a bandit might carry */
export function rollBanditDrop(): FoodItem[] {
  const count = Math.floor(Math.random() * 2) + 1;
  const items: FoodItem[] = [];
  // Bandits carry preserved travel food + sometimes stolen luxury items
  const banditFoods = COMMON_FOOD.filter(f =>
    f.category === "meat" || f.category === "prepared" || f.category === "drink");
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.15) {
      // Stolen luxury
      items.push(EXOTIC_FOOD[Math.floor(Math.random() * EXOTIC_FOOD.length)]);
    } else {
      items.push(banditFoods[Math.floor(Math.random() * banditFoods.length)]);
    }
  }
  return items;
}

// ── Fresh / Hunted Food (spoils, better than rations for morale) ────────────

export type FreshFoodItem = FoodItem & {
  spoilDays: number;  // days until spoiled (1 = berries, 2 = meat/fish)
  tier: "forage" | "small_game" | "large_game";
  terrain: string[];  // which hex types this can be found in
  preservedId?: string; // id of the salted/preserved version
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const FRESH_FOOD: FreshFoodItem[] = [
  // ── Forage (low skill) — spoils in 1 day ──
  { id: "fresh_berries",     name: "Fresh Berries",       priceCp: 5,   weight: 0.5, foodValue: 1, category: "produce", desc: "Wild berries. Eat today or they'll rot.",         spoilDays: 1, tier: "forage", terrain: ["forest", "plains", "jungle", "swamp"] },
  { id: "fresh_tubers",      name: "Wild Tubers",         priceCp: 5,   weight: 1,   foodValue: 1, category: "produce", desc: "Starchy roots dug from the earth. Edible raw.",   spoilDays: 1, tier: "forage", terrain: ["forest", "plains", "mountain", "swamp"] },
  { id: "fresh_mushrooms",   name: "Wild Mushrooms",      priceCp: 10,  weight: 0.5, foodValue: 1, category: "produce", desc: "Carefully identified edible fungi.",               spoilDays: 1, tier: "forage", terrain: ["forest", "swamp", "jungle"] },
  { id: "fresh_seaweed",     name: "Edible Seaweed",      priceCp: 5,   weight: 0.5, foodValue: 1, category: "produce", desc: "Salty and nutritious. Best eaten fresh.",          spoilDays: 1, tier: "forage", terrain: ["coast"] },
  { id: "fresh_herbs",       name: "Fresh Wild Herbs",    priceCp: 15,  weight: 0,   foodValue: 0, category: "produce", desc: "Fragrant herbs. Season a meal or sell to a cook.", spoilDays: 1, tier: "forage", terrain: ["forest", "plains", "mountain", "jungle"] },

  // ── Small game (mid skill) — spoils in 2 days ──
  { id: "fresh_rabbit",      name: "Fresh Rabbit",        priceCp: 60,  weight: 2,   foodValue: 2, category: "meat", desc: "A fat rabbit, freshly dressed.",                     spoilDays: 2, tier: "small_game", terrain: ["forest", "plains", "mountain"],        preservedId: "food_beef_jerked" },
  { id: "fresh_squirrel",    name: "Fresh Squirrel",      priceCp: 30,  weight: 1,   foodValue: 1, category: "meat", desc: "Small but edible. Roast over a fire.",               spoilDays: 2, tier: "small_game", terrain: ["forest"],                              preservedId: "food_beef_jerked" },
  { id: "fresh_pheasant",    name: "Fresh Pheasant",      priceCp: 80,  weight: 2,   foodValue: 2, category: "meat", desc: "A plump game bird with colorful plumage.",           spoilDays: 2, tier: "small_game", terrain: ["forest", "plains"],                    preservedId: "food_beef_jerked" },
  { id: "fresh_duck",        name: "Fresh Duck",          priceCp: 70,  weight: 2,   foodValue: 2, category: "meat", desc: "A wild duck, brought down cleanly.",                 spoilDays: 2, tier: "small_game", terrain: ["swamp", "coast", "plains"],            preservedId: "food_beef_jerked" },
  { id: "fresh_fish_small",  name: "Fresh Fish",          priceCp: 40,  weight: 1,   foodValue: 1, category: "meat", desc: "A mess of small fish from a stream.",                spoilDays: 2, tier: "small_game", terrain: ["coast", "swamp", "forest"],            preservedId: "food_herring_pickled" },
  { id: "fresh_crab",        name: "Fresh Crab",          priceCp: 60,  weight: 1,   foodValue: 1, category: "meat", desc: "A large crab, still snapping.",                      spoilDays: 1, tier: "small_game", terrain: ["coast"] },
  { id: "fresh_snake",       name: "Fresh Snake",         priceCp: 20,  weight: 1,   foodValue: 1, category: "meat", desc: "Skinned and gutted. Tastes like chicken.",            spoilDays: 2, tier: "small_game", terrain: ["desert", "jungle", "swamp"],           preservedId: "food_beef_jerked" },
  { id: "fresh_lizard",      name: "Desert Lizard",       priceCp: 30,  weight: 1,   foodValue: 1, category: "meat", desc: "A fat desert lizard. Roast it whole.",               spoilDays: 2, tier: "small_game", terrain: ["desert"],                              preservedId: "food_beef_jerked" },

  // ── Large game (high skill) — spoils in 2 days ──
  { id: "fresh_venison",     name: "Fresh Venison",       priceCp: 200, weight: 8,  foodValue: 5, category: "meat", desc: "A dressed deer haunch. Feeds the whole party.",        spoilDays: 2, tier: "large_game", terrain: ["forest", "plains", "mountain"],        preservedId: "food_beef_dried" },
  { id: "fresh_boar",        name: "Fresh Boar",          priceCp: 180, weight: 10, foodValue: 5, category: "meat", desc: "A wild boar, tusks and all. Tough but plentiful.",     spoilDays: 2, tier: "large_game", terrain: ["forest", "jungle"],                    preservedId: "food_pork_salted" },
  { id: "fresh_goat",        name: "Fresh Mountain Goat", priceCp: 150, weight: 6,  foodValue: 4, category: "meat", desc: "A lean mountain goat. Gamey but filling.",             spoilDays: 2, tier: "large_game", terrain: ["mountain"],                            preservedId: "food_beef_dried" },
  { id: "fresh_fish_large",  name: "Fresh Large Fish",    priceCp: 150, weight: 5,  foodValue: 4, category: "meat", desc: "A massive catch — salmon, pike, or sturgeon.",         spoilDays: 2, tier: "large_game", terrain: ["coast", "swamp"],                      preservedId: "food_cod_salted" },
  { id: "fresh_gator",       name: "Fresh Gator Tail",    priceCp: 120, weight: 6,  foodValue: 4, category: "meat", desc: "Thick reptile tail meat. Rich and oily.",              spoilDays: 2, tier: "large_game", terrain: ["swamp", "jungle"],                     preservedId: "food_beef_dried" },
  { id: "fresh_antelope",    name: "Fresh Antelope",      priceCp: 180, weight: 7,  foodValue: 5, category: "meat", desc: "A fleet plains antelope, skillfully taken.",            spoilDays: 2, tier: "large_game", terrain: ["plains", "desert"],                    preservedId: "food_beef_dried" },
];

/** Roll terrain-appropriate fresh food based on survival skill tier */
export function rollHuntedFood(
  hexType: string,
  tier: "forage" | "small_game" | "large_game",
): FreshFoodItem {
  const candidates = FRESH_FOOD.filter(f => f.tier === tier && f.terrain.includes(hexType));
  if (candidates.length === 0) {
    // Fallback: pick any item of this tier
    const fallback = FRESH_FOOD.filter(f => f.tier === tier);
    return pick(fallback);
  }
  return pick(candidates);
}
