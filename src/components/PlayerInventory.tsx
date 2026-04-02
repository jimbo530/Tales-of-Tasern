"use client";

import { useState } from "react";
import type { CharacterSave, InventoryItem, Equipment, Coins } from "@/lib/saveSystem";
import { formatCoins, coinWeight, totalCp, cpToCoins } from "@/lib/saveSystem";
import { getCarryThresholds, getEncumbrance, type CarryThresholds } from "@/lib/battleStats";
import { getItemInfo, getItemWeight } from "@/lib/itemRegistry";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  save: CharacterSave;
  str: number;
  followerCarryBonus: number; // extra lbs from teamsters/porters
  onEquip: (slot: keyof Equipment, itemId: string | undefined) => void;
  onDrop: (itemId: string, qty: number) => void;
  onBack: () => void;
};

type SortMode = "name" | "weight" | "value" | "qty";

const SLOT_LABELS: Record<keyof Equipment, string> = {
  weapon: "Weapon",
  armor: "Armor",
  shield: "Shield",
  accessory: "Accessory",
};

const SLOT_ICONS: Record<keyof Equipment, string> = {
  weapon: "\u2694",    // ⚔
  armor: "\uD83D\uDEE1",   // 🛡
  shield: "\uD83D\uDEE1",
  accessory: "\uD83D\uDC8D", // 💍
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInventoryWeight(inventory: InventoryItem[]): number {
  let total = 0;
  for (const item of inventory) {
    total += (item.itemWeight ?? getItemWeight(item.id)) * item.qty;
  }
  return total;
}

function getEquipmentWeight(equipment: Equipment): number {
  let total = 0;
  for (const slot of Object.keys(equipment) as (keyof Equipment)[]) {
    const id = equipment[slot];
    if (id) total += getItemWeight(id);
  }
  return total;
}

function encumbranceColor(enc: "light" | "medium" | "heavy" | "over"): string {
  switch (enc) {
    case "light": return "rgba(74,222,128,0.9)";
    case "medium": return "rgba(251,191,36,0.9)";
    case "heavy": return "rgba(251,113,133,0.9)";
    case "over": return "rgba(239,68,68,1)";
  }
}

function encumbranceLabel(enc: "light" | "medium" | "heavy" | "over"): string {
  switch (enc) {
    case "light": return "Light Load";
    case "medium": return "Medium Load (-3 check, x3 run)";
    case "heavy": return "Heavy Load (-6 check, x3 run, +1 max DEX)";
    case "over": return "Overloaded! Cannot move.";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function PlayerInventory({ save, str, followerCarryBonus, onEquip, onDrop, onBack }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [dropConfirm, setDropConfirm] = useState<string | null>(null);

  const thresholds = getCarryThresholds(str);
  const totalCapacity = thresholds.heavy + followerCarryBonus;
  const lightMax = thresholds.light + followerCarryBonus;
  const medMax = thresholds.medium + followerCarryBonus;

  const itemWeight = getInventoryWeight(save.inventory);
  const equipWeight = getEquipmentWeight(save.equipment);
  const cWeight = coinWeight(save.coins);
  const foodWeight = save.food; // 1 food = ~1 lb
  const totalWeight = Math.round((itemWeight + equipWeight + cWeight + foodWeight) * 100) / 100;

  const enc = totalWeight <= lightMax ? "light"
    : totalWeight <= medMax ? "medium"
    : totalWeight <= totalCapacity ? "heavy"
    : "over";

  // Sort inventory
  const sorted = [...save.inventory].sort((a, b) => {
    switch (sortMode) {
      case "name": return a.name.localeCompare(b.name);
      case "weight": return ((b.itemWeight ?? getItemWeight(b.id)) * b.qty) - ((a.itemWeight ?? getItemWeight(a.id)) * a.qty);
      case "value": {
        const va = getItemInfo(a.id)?.valueCp ?? 0;
        const vb = getItemInfo(b.id)?.valueCp ?? 0;
        return (vb * b.qty) - (va * a.qty);
      }
      case "qty": return b.qty - a.qty;
    }
  });

  // Determine which equipment slot an item belongs in
  function getEquipSlot(itemId: string): keyof Equipment | null {
    const info = getItemInfo(itemId);
    if (!info) return null;
    if (info.category === "weapon") return "weapon";
    if (info.category === "armor") {
      // Shields vs body armor: check ID/name for "shield" or "buckler"
      const lower = (itemId + " " + info.name).toLowerCase();
      if (lower.includes("shield") || lower.includes("buckler")) return "shield";
      return "armor";
    }
    // Gear items: cloaks, rings, amulets, boots, gloves, belts → accessory
    if (info.category === "gear") {
      const lower = (itemId + " " + info.name).toLowerCase();
      if (lower.includes("cloak") || lower.includes("ring") || lower.includes("amulet") ||
          lower.includes("boots") || lower.includes("gloves") || lower.includes("belt") ||
          lower.includes("bracers") || lower.includes("helm") || lower.includes("circlet") ||
          lower.includes("necklace") || lower.includes("cape") || lower.includes("vestment") ||
          lower.includes("robe") || lower.includes("clothing")) {
        return "accessory";
      }
      return "accessory"; // default gear to accessory
    }
    return null;
  }

  function canEquipIn(slot: keyof Equipment, itemId: string): boolean {
    return getEquipSlot(itemId) === slot;
  }

  const panelBg = "rgba(15,10,5,0.85)";
  const borderGold = "rgba(201,168,76,0.3)";
  const textGold = "rgba(201,168,76,0.8)";
  const textDim = "rgba(201,168,76,0.4)";

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(201,168,76,0.1)", color: textGold, border: `1px solid ${borderGold}` }}>
          Back
        </button>
        <h2 className="text-lg font-black tracking-widest uppercase"
          style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Inventory
        </h2>
        <div style={{ width: 60 }} /> {/* spacer */}
      </div>

      {/* ── Carry Capacity Bar ──────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>
            Carry Capacity
          </span>
          <span className="text-xs font-bold" style={{ color: encumbranceColor(enc) }}>
            {encumbranceLabel(enc)}
          </span>
        </div>

        {/* Bar */}
        <div className="relative h-6 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${borderGold}` }}>
          {/* Light zone */}
          <div className="absolute inset-y-0 left-0" style={{
            width: `${(lightMax / totalCapacity) * 100}%`,
            background: "rgba(74,222,128,0.15)",
            borderRight: "1px dashed rgba(74,222,128,0.4)",
          }} />
          {/* Medium zone */}
          <div className="absolute inset-y-0" style={{
            left: `${(lightMax / totalCapacity) * 100}%`,
            width: `${((medMax - lightMax) / totalCapacity) * 100}%`,
            background: "rgba(251,191,36,0.1)",
            borderRight: "1px dashed rgba(251,191,36,0.4)",
          }} />
          {/* Heavy zone */}
          <div className="absolute inset-y-0" style={{
            left: `${(medMax / totalCapacity) * 100}%`,
            width: `${((totalCapacity - medMax) / totalCapacity) * 100}%`,
            background: "rgba(251,113,133,0.08)",
          }} />
          {/* Fill bar */}
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{
            width: `${Math.min(100, (totalWeight / totalCapacity) * 100)}%`,
            background: enc === "over" ? "rgba(239,68,68,0.6)"
              : enc === "heavy" ? "rgba(251,113,133,0.5)"
              : enc === "medium" ? "rgba(251,191,36,0.4)"
              : "rgba(74,222,128,0.4)",
          }} />
          {/* Weight text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {totalWeight.toFixed(1)} / {totalCapacity} lbs
            </span>
          </div>
        </div>

        {/* Threshold labels */}
        <div className="flex justify-between mt-1">
          <span style={{ fontSize: "0.55rem", color: "rgba(74,222,128,0.5)" }}>Light {lightMax}</span>
          <span style={{ fontSize: "0.55rem", color: "rgba(251,191,36,0.5)" }}>Med {medMax}</span>
          <span style={{ fontSize: "0.55rem", color: "rgba(251,113,133,0.5)" }}>Heavy {totalCapacity}</span>
        </div>

        {/* Weight breakdown */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <span style={{ fontSize: "0.6rem", color: textDim }}>Items: {itemWeight.toFixed(1)} lb</span>
          <span style={{ fontSize: "0.6rem", color: textDim }}>Equipped: {equipWeight.toFixed(1)} lb</span>
          <span style={{ fontSize: "0.6rem", color: textDim }}>Coins: {cWeight.toFixed(1)} lb ({(save.coins.gp + save.coins.sp + save.coins.cp)} coins)</span>
          <span style={{ fontSize: "0.6rem", color: textDim }}>Food: {foodWeight} lb</span>
          {followerCarryBonus > 0 && (
            <span style={{ fontSize: "0.6rem", color: "rgba(96,165,250,0.6)" }}>+{followerCarryBonus} lb (followers)</span>
          )}
        </div>
      </div>

      {/* ── Coin Purse ──────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>Coin Purse</span>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm font-bold" style={{ color: "#f0d070" }}>{formatCoins(save.coins)}</span>
          <span style={{ fontSize: "0.55rem", color: textDim }}>
            ({cWeight.toFixed(1)} lbs / ~{formatCoins(cpToCoins(totalCp(save.coins)))} consolidated)
          </span>
        </div>
        <div className="flex gap-6 mt-1">
          <span style={{ fontSize: "0.6rem", color: "rgba(251,191,36,0.6)" }}>{save.coins.gp} gold</span>
          <span style={{ fontSize: "0.6rem", color: "rgba(192,192,192,0.6)" }}>{save.coins.sp} silver</span>
          <span style={{ fontSize: "0.6rem", color: "rgba(180,120,60,0.6)" }}>{save.coins.cp} copper</span>
        </div>
      </div>

      {/* ── Equipment Slots ─────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>Equipment</span>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(Object.keys(SLOT_LABELS) as (keyof Equipment)[]).map(slot => {
            const equipped = save.equipment[slot];
            const info = equipped ? getItemInfo(equipped) : null;
            return (
              <div key={slot} className="flex items-center gap-2 rounded-lg p-2"
                style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${equipped ? "rgba(96,165,250,0.3)" : "rgba(201,168,76,0.1)"}` }}>
                <span className="text-lg">{SLOT_ICONS[slot]}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "0.55rem", color: textDim }}>{SLOT_LABELS[slot]}</div>
                  {info ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold truncate" style={{ color: "rgba(96,165,250,0.9)" }}>{info.name}</span>
                      <span style={{ fontSize: "0.5rem", color: textDim }}>{info.weight}lb</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.6rem", color: "rgba(201,168,76,0.2)" }}>— empty —</span>
                  )}
                </div>
                {equipped && (
                  <button onClick={() => onEquip(slot, undefined)}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ color: "rgba(251,113,133,0.7)", border: "1px solid rgba(251,113,133,0.2)", fontSize: "0.55rem" }}>
                    Unequip
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Item List ───────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>
            Items ({save.inventory.length})
          </span>
          <div className="flex gap-1">
            {(["name", "weight", "value", "qty"] as SortMode[]).map(mode => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className="px-2 py-0.5 rounded text-xs uppercase"
                style={{
                  color: sortMode === mode ? "#f0d070" : textDim,
                  background: sortMode === mode ? "rgba(201,168,76,0.15)" : "transparent",
                  border: `1px solid ${sortMode === mode ? borderGold : "transparent"}`,
                  fontSize: "0.55rem",
                }}>
                {mode}
              </button>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-6" style={{ color: textDim, fontSize: "0.7rem" }}>
            Your pack is empty.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map(item => {
              const info = getItemInfo(item.id);
              const w = (item.itemWeight ?? getItemWeight(item.id)) * item.qty;
              const vCp = (info?.valueCp ?? 0) * item.qty;
              const isEquipped = Object.values(save.equipment).includes(item.id);

              return (
                <div key={item.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "rgba(0,0,0,0.2)", border: `1px solid rgba(201,168,76,0.08)` }}>
                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate" style={{ color: isEquipped ? "rgba(96,165,250,0.9)" : "rgba(232,213,176,0.9)" }}>
                        {item.name}
                      </span>
                      {isEquipped && (
                        <span style={{ fontSize: "0.5rem", color: "rgba(96,165,250,0.5)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 3, padding: "0 3px" }}>
                          EQ
                        </span>
                      )}
                      {item.qty > 1 && (
                        <span className="font-bold" style={{ fontSize: "0.6rem", color: textGold }}>x{item.qty}</span>
                      )}
                    </div>
                    {info?.description && (
                      <div style={{ fontSize: "0.5rem", color: textDim, lineHeight: 1.3 }} className="truncate">
                        {info.description}
                      </div>
                    )}
                  </div>

                  {/* Weight & value */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span style={{ fontSize: "0.55rem", color: "rgba(201,168,76,0.5)" }}>{w.toFixed(1)} lb</span>
                    {vCp > 0 && (
                      <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.3)" }}>{formatCoins(cpToCoins(vCp))}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {/* Equip button — single button for the correct slot */}
                    {(() => {
                      const slot = getEquipSlot(item.id);
                      if (!slot) return null;
                      if (save.equipment[slot] === item.id) return null; // already equipped
                      const replacing = save.equipment[slot];
                      const replaceInfo = replacing ? getItemInfo(replacing) : null;
                      return (
                        <button onClick={() => onEquip(slot, item.id)}
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: "0.5rem", color: "rgba(96,165,250,0.8)", border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)" }}
                          title={replaceInfo ? `Replaces: ${replaceInfo.name}` : `Equip as ${SLOT_LABELS[slot]}`}>
                          Equip {SLOT_LABELS[slot]}
                        </button>
                      );
                    })()}

                    {/* Drop */}
                    {dropConfirm === item.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => { onDrop(item.id, 1); setDropConfirm(null); }}
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: "0.5rem", color: "rgba(239,68,68,0.9)", border: "1px solid rgba(239,68,68,0.3)" }}>
                          Drop 1
                        </button>
                        {item.qty > 1 && (
                          <button onClick={() => { onDrop(item.id, item.qty); setDropConfirm(null); }}
                            className="px-1.5 py-0.5 rounded"
                            style={{ fontSize: "0.5rem", color: "rgba(239,68,68,0.9)", border: "1px solid rgba(239,68,68,0.3)" }}>
                            All
                          </button>
                        )}
                        <button onClick={() => setDropConfirm(null)}
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: "0.5rem", color: textDim, border: `1px solid ${borderGold}` }}>
                          X
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDropConfirm(item.id)}
                        className="px-1.5 py-0.5 rounded"
                        style={{ fontSize: "0.5rem", color: "rgba(251,113,133,0.5)", border: "1px solid rgba(251,113,133,0.15)" }}>
                        Drop
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Food Supply ─────────────────────────────────────────────────── */}
      <div className="rounded-xl p-3" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>Food</span>
          <span className="text-xs font-bold" style={{ color: save.food > 3 ? "rgba(74,222,128,0.8)" : save.food > 0 ? "rgba(251,191,36,0.8)" : "rgba(239,68,68,0.8)" }}>
            {save.food} rations ({save.food} lb)
          </span>
        </div>
        <div style={{ fontSize: "0.55rem", color: textDim, marginTop: 2 }}>
          1 ration per 8-hour action. {save.food > 0 ? `~${save.food} actions remaining.` : "Starving! Rest will not heal."}
        </div>
      </div>

      {/* ── STR Info ────────────────────────────────────────────────────── */}
      <div className="text-center" style={{ fontSize: "0.55rem", color: textDim }}>
        STR {str} | Light {thresholds.light} lb | Medium {thresholds.medium} lb | Heavy {thresholds.heavy} lb
        {followerCarryBonus > 0 && ` | +${followerCarryBonus} lb followers`}
      </div>
    </div>
  );
}
