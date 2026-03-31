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
  { id: "food_wine_common",     name: "Common Wine (bottle)", priceCp: 20,  weight: 2, foodValue: 0, category: "drink",    desc: "Cheap table wine. Slightly vinegary." },
  { id: "food_mead",            name: "Mead (pint)",         priceCp: 50,   weight: 1, foodValue: 0, category: "drink",    desc: "Honey wine. Sweet and strong." },
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

/** Roll 1-3 food items for a farm encounter */
export function rollFarmDrop(): FoodItem[] {
  const count = Math.floor(Math.random() * 3) + 1;
  const items: FoodItem[] = [];
  const farmFoods = COMMON_FOOD.filter(f =>
    f.category === "grain" || f.category === "produce" || f.category === "dairy" || f.category === "meat");
  for (let i = 0; i < count; i++) {
    items.push(farmFoods[Math.floor(Math.random() * farmFoods.length)]);
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
