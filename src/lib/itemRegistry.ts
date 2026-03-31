// ============================================================
// itemRegistry.ts — Unified item weight/info lookup by ID
// Combines loot, shop, and food items into one registry.
// ============================================================

import { JUNK_LOOT, COMMON_LOOT, UNCOMMON_LOOT, RARE_LOOT, type LootItem } from "./loot";
import { ALL_SHOPS, type ShopItem } from "./shops";
import { COMMON_FOOD, EXOTIC_FOOD, type FoodItem } from "./foodItems";

export type ItemInfo = {
  id: string;
  name: string;
  weight: number;      // lbs per unit
  valueCp: number;     // value in copper
  category: string;
  description: string;
};

// Build the lookup map once
const registry = new Map<string, ItemInfo>();

function addLoot(items: LootItem[]) {
  for (const it of items) {
    registry.set(it.id, {
      id: it.id,
      name: it.name,
      weight: it.weight,
      valueCp: Math.round(it.value * 100),
      category: it.category,
      description: it.description,
    });
  }
}

function addShop(items: ShopItem[]) {
  for (const it of items) {
    registry.set(it.id, {
      id: it.id,
      name: it.name,
      weight: it.weight,
      valueCp: it.buyPrice,
      category: it.category,
      description: it.description,
    });
  }
}

function addFood(items: FoodItem[]) {
  for (const it of items) {
    registry.set(it.id, {
      id: it.id,
      name: it.name,
      weight: it.weight,
      valueCp: it.priceCp,
      category: it.category,
      description: it.desc,
    });
  }
}

// Populate
addLoot(JUNK_LOOT);
addLoot(COMMON_LOOT);
addLoot(UNCOMMON_LOOT);
addLoot(RARE_LOOT);
for (const shop of ALL_SHOPS) addShop(shop.items);
addFood(COMMON_FOOD);
addFood(EXOTIC_FOOD);

/** Look up item info by ID. Returns undefined if unknown. */
export function getItemInfo(id: string): ItemInfo | undefined {
  return registry.get(id);
}

/** Get weight of an item by ID (0 if unknown) */
export function getItemWeight(id: string): number {
  return registry.get(id)?.weight ?? 0;
}
