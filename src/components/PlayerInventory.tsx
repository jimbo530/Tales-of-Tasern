"use client";

import { useState, useRef } from "react";
import type { CharacterSave, InventoryItem, Equipment, Coins } from "@/lib/saveSystem";
import { formatCoins, coinWeight, totalCp, cpToCoins } from "@/lib/saveSystem";
import { getCarryThresholds, getEncumbrance, type CarryThresholds } from "@/lib/battleStats";
import { getItemInfo, getItemWeight, type ItemInfo } from "@/lib/itemRegistry";

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

// ── Comparison helpers ───────────────────────────────────────────────────────

/** Parse "+N AC" from effect string */
function parseAC(effect?: string): number | null {
  if (!effect) return null;
  const m = effect.match(/\+(\d+)\s*AC/);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse armor check penalty from effect string */
function parseArmorCheckPenalty(effect?: string): number | null {
  if (!effect) return null;
  const m = effect.match(/armor check penalty\s*(-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse max Dex bonus from effect string */
function parseMaxDex(effect?: string): number | null {
  if (!effect) return null;
  const m = effect.match(/max Dex\s*\+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse damage dice like "1d8" or "2d6" and return average damage */
function parseDamageAvg(effect?: string): number | null {
  if (!effect) return null;
  const m = effect.match(/(\d+)d(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  return n * ((sides + 1) / 2);
}

/** Parse full damage dice string like "1d8" */
function parseDamageDice(effect?: string): string | null {
  if (!effect) return null;
  const m = effect.match(/(\d+d\d+)/);
  return m ? m[1] : null;
}

/** Parse crit range like "19-20/x2" or "x3" */
function parseCrit(effect?: string): string | null {
  if (!effect) return null;
  const m = effect.match(/((?:\d+-\d+\/)?x\d+)\s*crit/);
  return m ? m[1] : null;
}

/** Parse damage type like "slashing", "piercing", "bludgeoning" */
function parseDamageType(effect?: string): string | null {
  if (!effect) return null;
  const m = effect.match(/(slashing|piercing|bludgeoning)/i);
  return m ? m[1] : null;
}

type StatDelta = {
  label: string;
  oldVal: string;
  newVal: string;
  delta: number | null;     // numeric delta for coloring, null = info-only
  isBetter: boolean | null; // true = green, false = red, null = neutral
};

function buildComparison(hoveredInfo: ItemInfo, equippedInfo: ItemInfo | null, slot: keyof Equipment): StatDelta[] {
  const deltas: StatDelta[] = [];

  if (slot === "weapon") {
    // Damage dice
    const hDice = parseDamageDice(hoveredInfo.effect);
    const eDice = equippedInfo ? parseDamageDice(equippedInfo.effect) : null;
    const hAvg = parseDamageAvg(hoveredInfo.effect);
    const eAvg = equippedInfo ? parseDamageAvg(equippedInfo.effect) : null;
    if (hDice || eDice) {
      const avgDelta = (hAvg ?? 0) - (eAvg ?? 0);
      deltas.push({
        label: "Damage",
        oldVal: eDice ? `${eDice}` : "none",
        newVal: hDice ? `${hDice}` : "none",
        delta: avgDelta,
        isBetter: avgDelta !== 0 ? avgDelta > 0 : null,
      });
    }

    // Damage type
    const hType = parseDamageType(hoveredInfo.effect);
    const eType = equippedInfo ? parseDamageType(equippedInfo.effect) : null;
    if (hType || eType) {
      deltas.push({
        label: "Type",
        oldVal: eType ?? "none",
        newVal: hType ?? "none",
        delta: null,
        isBetter: null,
      });
    }

    // Crit
    const hCrit = parseCrit(hoveredInfo.effect);
    const eCrit = equippedInfo ? parseCrit(equippedInfo.effect) : null;
    if (hCrit || eCrit) {
      deltas.push({
        label: "Crit",
        oldVal: eCrit ?? "none",
        newVal: hCrit ?? "none",
        delta: null,
        isBetter: null,
      });
    }
  }

  if (slot === "armor" || slot === "shield") {
    // AC
    const hAC = parseAC(hoveredInfo.effect);
    const eAC = equippedInfo ? parseAC(equippedInfo.effect) : null;
    if (hAC !== null || eAC !== null) {
      const d = (hAC ?? 0) - (eAC ?? 0);
      deltas.push({
        label: "AC",
        oldVal: eAC !== null ? `+${eAC}` : "none",
        newVal: hAC !== null ? `+${hAC}` : "none",
        delta: d,
        isBetter: d !== 0 ? d > 0 : null,
      });
    }

    // Max Dex
    const hDex = parseMaxDex(hoveredInfo.effect);
    const eDex = equippedInfo ? parseMaxDex(equippedInfo.effect) : null;
    if (hDex !== null || eDex !== null) {
      const d = (hDex ?? 99) - (eDex ?? 99);
      deltas.push({
        label: "Max Dex",
        oldVal: eDex !== null ? `+${eDex}` : "none",
        newVal: hDex !== null ? `+${hDex}` : "none",
        delta: d,
        isBetter: d !== 0 ? d > 0 : null,
      });
    }

    // Armor check penalty (less negative = better)
    const hPen = parseArmorCheckPenalty(hoveredInfo.effect);
    const ePen = equippedInfo ? parseArmorCheckPenalty(equippedInfo.effect) : null;
    if (hPen !== null || ePen !== null) {
      const d = (hPen ?? 0) - (ePen ?? 0);
      deltas.push({
        label: "Check Penalty",
        oldVal: ePen !== null ? `${ePen}` : "0",
        newVal: hPen !== null ? `${hPen}` : "0",
        delta: d,
        isBetter: d !== 0 ? d > 0 : null, // less negative (higher) is better
      });
    }
  }

  // Weight (always show, lower is better)
  const wDelta = hoveredInfo.weight - (equippedInfo?.weight ?? 0);
  deltas.push({
    label: "Weight",
    oldVal: equippedInfo ? `${equippedInfo.weight} lb` : "0 lb",
    newVal: `${hoveredInfo.weight} lb`,
    delta: wDelta,
    isBetter: wDelta !== 0 ? wDelta < 0 : null, // lighter is better
  });

  // Value (always show, higher is better)
  const vDelta = hoveredInfo.valueCp - (equippedInfo?.valueCp ?? 0);
  deltas.push({
    label: "Value",
    oldVal: equippedInfo ? formatCoins(cpToCoins(equippedInfo.valueCp)) : "0 cp",
    newVal: formatCoins(cpToCoins(hoveredInfo.valueCp)),
    delta: vDelta,
    isBetter: vDelta !== 0 ? vDelta > 0 : null,
  });

  return deltas;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PlayerInventory({ save, str, followerCarryBonus, onEquip, onDrop, onBack }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [dropConfirm, setDropConfirm] = useState<string | null>(null);
  const [compareItem, setCompareItem] = useState<string | null>(null);
  const itemListRef = useRef<HTMLDivElement>(null);

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
          <div ref={itemListRef} className="flex flex-col gap-1" style={{ position: "relative" }}>
            {sorted.map(item => {
              const info = getItemInfo(item.id);
              const w = (item.itemWeight ?? getItemWeight(item.id)) * item.qty;
              const vCp = (info?.valueCp ?? 0) * item.qty;
              const isEquipped = Object.values(save.equipment).includes(item.id);
              const slot = getEquipSlot(item.id);
              const showCompare = compareItem === item.id && slot && !isEquipped;

              // Build comparison data when hovered
              let comparisonDeltas: StatDelta[] | null = null;
              let equippedName: string | null = null;
              if (showCompare && info && slot) {
                const equippedId = save.equipment[slot];
                const equippedInfo = equippedId ? getItemInfo(equippedId) : null;
                equippedName = equippedInfo?.name ?? null;
                comparisonDeltas = buildComparison(info, equippedInfo ?? null, slot);
              }

              return (
                <div key={item.id} style={{ position: "relative" }}
                  onMouseEnter={() => { if (slot && !isEquipped) setCompareItem(item.id); }}
                  onMouseLeave={() => setCompareItem(null)}
                  onTouchStart={() => { if (slot && !isEquipped) setCompareItem(prev => prev === item.id ? null : item.id); }}
                >
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{
                      background: showCompare ? "rgba(201,168,76,0.06)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${showCompare ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.08)"}`,
                      transition: "background 0.15s, border-color 0.15s",
                    }}>
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

                  {/* ── Comparison Tooltip ──────────────────────────────── */}
                  {showCompare && comparisonDeltas && slot && (
                    <div style={{
                      position: "absolute",
                      top: 0,
                      right: "calc(100% + 8px)",
                      zIndex: 50,
                      minWidth: 200,
                      maxWidth: 260,
                      background: "rgba(10,6,8,0.95)",
                      border: "1px solid rgba(201,168,76,0.6)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,168,76,0.1)",
                      pointerEvents: "none",
                    }}>
                      {/* Header */}
                      <div style={{ marginBottom: 8, borderBottom: "1px solid rgba(201,168,76,0.2)", paddingBottom: 6 }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#f0d070", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>
                          {info?.name}
                        </div>
                        <div style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)" }}>
                          vs {equippedName ? (
                            <span style={{ color: "rgba(96,165,250,0.7)" }}>{equippedName}</span>
                          ) : (
                            <span style={{ color: "rgba(201,168,76,0.3)", fontStyle: "italic" }}>Empty {SLOT_LABELS[slot]} slot</span>
                          )}
                        </div>
                      </div>

                      {/* Stat rows */}
                      {comparisonDeltas.map((stat, i) => (
                        <div key={i} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "2px 0",
                          borderBottom: i < comparisonDeltas!.length - 1 ? "1px solid rgba(201,168,76,0.06)" : "none",
                        }}>
                          <span style={{ fontSize: "0.55rem", color: "rgba(201,168,76,0.5)", fontWeight: 600, minWidth: 70 }}>
                            {stat.label}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.3)" }}>
                              {stat.oldVal}
                            </span>
                            <span style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.3)" }}>
                              {"\u2192"}
                            </span>
                            <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "rgba(232,213,176,0.9)" }}>
                              {stat.newVal}
                            </span>
                            {stat.delta !== null && stat.delta !== 0 && (
                              <span style={{
                                fontSize: "0.55rem",
                                fontWeight: 800,
                                color: stat.isBetter ? "rgba(74,222,128,0.9)" : "rgba(239,68,68,0.9)",
                                marginLeft: 2,
                              }}>
                                ({stat.delta > 0 ? "+" : ""}{stat.delta % 1 === 0 ? stat.delta : stat.delta.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Effect text if present */}
                      {info?.effect && (
                        <div style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: "1px solid rgba(201,168,76,0.15)",
                          fontSize: "0.48rem",
                          color: "rgba(201,168,76,0.35)",
                          lineHeight: 1.4,
                          fontStyle: "italic",
                        }}>
                          {info.effect}
                        </div>
                      )}
                    </div>
                  )}
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
