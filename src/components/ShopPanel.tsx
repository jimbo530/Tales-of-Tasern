"use client";

import { type Coins, formatCoins, totalCp, cpToCoins, exchangeUp } from "@/lib/saveSystem";
import { getAvailableItems, type Shop, type ShopItem } from "@/lib/shops";
import type { WorldLuckResult } from "@/components/WorldMap";

// ── Props ──────────────────────────────────────────────────────────────────

export type ShopPanelProps = {
  shops: Shop[];
  /** Currently selected shop id, or null when browsing the shop list */
  activeShopId: string | null;
  onSelectShop: (shopId: string | null) => void;
  /** Player's current coins */
  coins: Coins;
  /** Current game day (for minLevel filtering) */
  gameDay: number;
  /** Whether the player is in Kardov's Gate (unlocks kardovOnly items) */
  isKardov: boolean;
  /** Called when the player buys an item */
  onBuyItem: (item: ShopItem) => void;
  /** Called when the player uses the money changer */
  onMoneyChange: (result: WorldLuckResult) => void;
  /** Navigate back to the shop list */
  onBackToShops: () => void;
  /** Navigate back to district selection */
  onBackToDistricts: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────

export function ShopPanel({
  shops,
  activeShopId,
  onSelectShop,
  coins,
  gameDay,
  isKardov,
  onBuyItem,
  onMoneyChange,
  onBackToShops,
  onBackToDistricts,
}: ShopPanelProps) {
  // ── Shop list view ──
  if (!activeShopId) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        <button onClick={onBackToDistricts} className="self-start px-2 py-0.5 rounded text-xs"
          style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
          ← Back to Districts
        </button>
        <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase">
          {"\u{1F6D2}"} Market District
        </div>
        <div className="flex flex-col gap-0.5">
          {shops.map(shop => (
            <button key={shop.id} onClick={() => onSelectShop(shop.id)}
              className="w-full text-left px-2 py-1.5 rounded transition-all hover:bg-white/5"
              style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.08)" }}>
              <span style={{ fontSize: "0.55rem" }}>{shop.emoji}</span>
              <span className="ml-1 text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.5rem" }}>{shop.name}</span>
              <span className="ml-1" style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.35)" }}>— {shop.description}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Inside a shop ──
  const shop = shops.find(s => s.id === activeShopId);
  if (!shop) { onSelectShop(null); return null; }
  const items = getAvailableItems(shop, gameDay, isKardov);
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-1">
        <button onClick={onBackToShops} className="px-2 py-0.5 rounded text-xs"
          style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.1)", fontSize: "0.4rem" }}>
          ← Shops
        </button>
        <button onClick={onBackToDistricts} className="px-2 py-0.5 rounded text-xs"
          style={{ color: "rgba(201,168,76,0.3)", border: "1px solid rgba(201,168,76,0.06)", fontSize: "0.4rem" }}>
          ← Districts
        </button>
      </div>
      <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.8)" }} className="font-bold">
        {shop.emoji} {shop.name}
      </div>
      <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
        {items.map(item => {
          const canBuy = totalCp(coins) >= item.buyPrice;
          return (
            <div key={item.id} className="flex items-center gap-1 px-2 py-1 rounded"
              style={{ background: "rgba(0,0,0,0.15)", border: "1px solid rgba(201,168,76,0.06)" }}>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.5rem" }}>{item.name}</div>
                <div style={{ fontSize: "0.35rem", color: "rgba(232,213,176,0.35)" }}>{item.description}</div>
                {item.effect && <div style={{ fontSize: "0.35rem", color: "rgba(96,165,250,0.5)" }}>{item.effect}</div>}
              </div>
              <button onClick={() => { if (canBuy) onBuyItem(item); }}
                disabled={!canBuy}
                className="px-2 py-0.5 rounded whitespace-nowrap"
                style={{
                  background: canBuy ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.02)",
                  color: canBuy ? "rgba(74,222,128,0.8)" : "rgba(232,213,176,0.2)",
                  border: `1px solid ${canBuy ? "rgba(74,222,128,0.2)" : "rgba(201,168,76,0.05)"}`,
                  fontSize: "0.45rem",
                }}>
                {formatCoins(cpToCoins(item.buyPrice))}
              </button>
            </div>
          );
        })}
      </div>
      {/* Money Changer — merchants take 5% */}
      <button onClick={() => {
          const total = totalCp(coins);
          if (total <= 0) return;
          const newCoins = exchangeUp(coins, 0.05);
          const fee = total - totalCp(newCoins);
          const result: WorldLuckResult = {
            worldRoll: 0, skillRoll: 0, skillDC: 0,
            interaction: "rest", outcome: "nothing",
            description: `The jeweler exchanges your coin. ${formatCoins(coins)} → ${formatCoins(newCoins)} (5% fee).`,
            hpChange: 0, goldChange: -fee, foodChange: 0, xpChange: 0,
          };
          onMoneyChange(result);
        }}
        disabled={coins.sp + coins.cp <= 0}
        className="px-2 py-1.5 rounded text-xs font-bold mt-1"
        style={{
          background: "rgba(251,191,36,0.08)", color: "rgba(251,191,36,0.7)",
          border: "1px solid rgba(251,191,36,0.2)", fontSize: "0.5rem",
          opacity: coins.sp + coins.cp <= 0 ? 0.4 : 1,
        }}>
        {"\u{1F48E}"} Jeweler&apos;s Exchange (5% fee — consolidate coin)
      </button>
    </div>
  );
}
