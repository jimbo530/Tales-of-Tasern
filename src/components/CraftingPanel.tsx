"use client";

import { useState, useMemo } from "react";
import type { CharacterSave } from "@/lib/saveSystem";
import {
  CRAFTING_SKILLS,
  CRAFTING_STATIONS,
  ALL_RECIPES,
  QUALITY_LABELS,
  QUALITY_MULTIPLIERS,
  getMaterial,
  canCraft,
  rollQuality,
  xpForLevel,
  xpToNextLevel,
  initSkillProgress,
  type CraftingSkill,
  type CraftQuality,
  type PlayerCraftingState,
  type Recipe,
  type CraftAttemptResult,
} from "@/lib/craftingSystem";

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  save: CharacterSave;
  onCraftItem: (result: {
    removeMaterials: { materialId: string; quantity: number }[];
    addItem: { id: string; name: string; qty: number };
    skillXp: { skill: CraftingSkill; xp: number };
    quality: CraftQuality;
  }) => void;
  onBack: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  common: "rgba(200,200,200,0.8)",
  uncommon: "rgba(74,222,128,0.9)",
  rare: "rgba(96,165,250,0.9)",
  epic: "rgba(167,139,250,0.9)",
  legendary: "rgba(251,191,36,0.9)",
};

const QUALITY_COLORS: Record<CraftQuality, string> = {
  poor: "rgba(200,200,200,0.5)",
  normal: "rgba(200,200,200,0.8)",
  fine: "rgba(74,222,128,0.9)",
  superior: "rgba(96,165,250,0.9)",
  masterwork: "rgba(251,191,36,0.9)",
};

const SKILL_ICONS: Record<CraftingSkill, string> = {
  blacksmithing: "\u{1F528}",   // hammer
  leatherworking: "\u{1FA76}",  // leather (using generic)
  alchemy: "\u{1F9EA}",         // test tube
  enchanting: "\u{2728}",       // sparkles
  jewelcrafting: "\u{1F48E}",   // gem
  inscription: "\u{1F4DC}",     // scroll
};

/** Get player's crafting state from save (or build defaults) */
function getCraftingState(save: CharacterSave): PlayerCraftingState {
  if (save.crafting) {
    return {
      playerId: save.crafting.playerId,
      materials: save.crafting.materials,
      skills: save.crafting.skills.map(s => ({
        skill: s.skill as CraftingSkill,
        level: s.level,
        xp: s.xp,
        xpToNext: s.xpToNext,
      })),
      knownRecipes: save.crafting.knownRecipes,
      discoveredByExperiment: save.crafting.discoveredByExperiment,
    };
  }
  // Default fresh state
  return {
    playerId: save.wallet,
    materials: [],
    skills: CRAFTING_SKILLS.map(s => initSkillProgress(s.id)),
    knownRecipes: ALL_RECIPES.filter(r => !r.discoverable).map(r => r.id),
    discoveredByExperiment: [],
  };
}

/** Count how many of a material the player has in their crafting materials */
function getMaterialQty(state: PlayerCraftingState, materialId: string): number {
  const stack = state.materials.find(m => m.materialId === materialId);
  return stack?.quantity ?? 0;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CraftingPanel({ save, onCraftItem, onBack }: Props) {
  const [selectedSkill, setSelectedSkill] = useState<CraftingSkill>("blacksmithing");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [craftResult, setCraftResult] = useState<CraftAttemptResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);

  const craftingState = useMemo(() => getCraftingState(save), [save]);

  // Get skill info and progress
  const skillInfo = CRAFTING_SKILLS.find(s => s.id === selectedSkill)!;
  const skillProgress = craftingState.skills.find(s => s.skill === selectedSkill) ?? initSkillProgress(selectedSkill);

  // Get recipes for selected skill, filtered by level
  const recipes = useMemo(() => {
    const allForSkill = ALL_RECIPES.filter(r => r.skill === selectedSkill);
    return allForSkill
      .filter(r => {
        // Show all recipes player knows (non-discoverable are auto-known)
        if (r.discoverable && !craftingState.knownRecipes.includes(r.id)) return false;
        if (filterAvailableOnly) {
          if (r.skillRequired > skillProgress.level) return false;
          if (!canCraft(r, craftingState.materials)) return false;
        }
        return true;
      })
      .sort((a, b) => a.skillRequired - b.skillRequired);
  }, [selectedSkill, craftingState, skillProgress, filterAvailableOnly]);

  // Check if player can craft the selected recipe
  const canCraftSelected = useMemo(() => {
    if (!selectedRecipe) return { craftable: false, reason: "No recipe selected" };
    if (skillProgress.level < selectedRecipe.skillRequired) {
      return { craftable: false, reason: `Need ${selectedRecipe.skill} level ${selectedRecipe.skillRequired} (you have ${skillProgress.level})` };
    }
    if (!canCraft(selectedRecipe, craftingState.materials)) {
      return { craftable: false, reason: "Missing materials" };
    }
    return { craftable: true, reason: "" };
  }, [selectedRecipe, skillProgress, craftingState]);

  function handleCraft() {
    if (!selectedRecipe || !canCraftSelected.craftable) return;

    // Roll quality based on skill vs recipe difficulty (no state mutation)
    const quality = rollQuality(skillProgress.level, selectedRecipe.skillRequired);
    const qualityXpBonus = quality === "masterwork" ? 2.0 : quality === "superior" ? 1.5 : quality === "fine" ? 1.2 : 1.0;
    const xpGained = Math.floor(selectedRecipe.xpGain * qualityXpBonus);
    const qualityLabel = quality === "normal" ? "" : ` (${QUALITY_LABELS[quality]})`;

    const result: CraftAttemptResult = {
      success: true,
      quality,
      resultItemId: selectedRecipe.resultItemId,
      resultQuantity: selectedRecipe.resultQuantity,
      qualityMultiplier: QUALITY_MULTIPLIERS[quality],
      xpGained,
      materialsConsumed: selectedRecipe.materials,
      description: `You craft a${qualityLabel} ${selectedRecipe.name}! [+${xpGained} XP]`,
    };

    setCraftResult(result);
    setShowResult(true);

    // Signal to parent to update save (parent handles actual state mutation)
    onCraftItem({
      removeMaterials: selectedRecipe.materials,
      addItem: {
        id: result.resultItemId,
        name: `${quality !== "normal" ? QUALITY_LABELS[quality] + " " : ""}${selectedRecipe.name}`,
        qty: result.resultQuantity,
      },
      skillXp: { skill: selectedRecipe.skill, xp: xpGained },
      quality: result.quality,
    });
  }

  function dismissResult() {
    setShowResult(false);
    setCraftResult(null);
  }

  // Style constants matching existing dark fantasy theme
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
          Crafting
        </h2>
        <div style={{ width: 60 }} />
      </div>

      {/* ── Skill Selector ──────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>
          Crafting Skills
        </span>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {CRAFTING_SKILLS.map(skill => {
            const progress = craftingState.skills.find(s => s.skill === skill.id) ?? initSkillProgress(skill.id);
            const isActive = selectedSkill === skill.id;
            const xpProgress = progress.level >= 100 ? 100 :
              ((progress.xp - xpForLevel(progress.level)) / (xpForLevel(progress.level + 1) - xpForLevel(progress.level))) * 100;

            return (
              <button key={skill.id} onClick={() => { setSelectedSkill(skill.id); setSelectedRecipe(null); }}
                className="flex flex-col items-center gap-1 rounded-lg p-2 transition-all"
                style={{
                  background: isActive ? "rgba(201,168,76,0.15)" : "rgba(0,0,0,0.3)",
                  border: `1px solid ${isActive ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.1)"}`,
                }}>
                <span className="text-lg">{SKILL_ICONS[skill.id]}</span>
                <span className="text-xs font-bold" style={{ color: isActive ? "#f0d070" : textDim, fontSize: "0.6rem" }}>
                  {skill.name}
                </span>
                <span className="font-black" style={{ color: isActive ? "#f0d070" : "rgba(232,213,176,0.7)", fontSize: "0.7rem" }}>
                  Lv {progress.level}
                </span>
                {/* XP bar */}
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, xpProgress)}%`,
                    background: isActive ? "rgba(201,168,76,0.7)" : "rgba(201,168,76,0.3)",
                  }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected Skill Details ──────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{SKILL_ICONS[selectedSkill]}</span>
            <div>
              <span className="text-sm font-black" style={{ color: "#f0d070" }}>{skillInfo.name}</span>
              <span className="text-xs ml-2" style={{ color: textDim }}>Level {skillProgress.level}/100</span>
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: "0.55rem", color: textDim }}>
              Primary: {skillInfo.primaryStat}
            </div>
            <div style={{ fontSize: "0.55rem", color: textDim }}>
              Station: {CRAFTING_STATIONS.find(s => s.id === skillInfo.station)?.name}
            </div>
          </div>
        </div>
        <div style={{ fontSize: "0.6rem", color: "rgba(232,213,176,0.6)", lineHeight: 1.4 }}>
          {skillInfo.description}
        </div>

        {/* XP Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between mb-1">
            <span style={{ fontSize: "0.5rem", color: textDim }}>
              XP: {skillProgress.xp} / {skillProgress.level >= 100 ? "MAX" : xpForLevel(skillProgress.level + 1)}
            </span>
            <span style={{ fontSize: "0.5rem", color: textDim }}>
              {skillProgress.level >= 100 ? "Mastered" : `${xpToNextLevel(skillProgress.level, skillProgress.xp)} to next level`}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(201,168,76,0.15)" }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${skillProgress.level >= 100 ? 100 : ((skillProgress.xp - xpForLevel(skillProgress.level)) / (xpForLevel(skillProgress.level + 1) - xpForLevel(skillProgress.level))) * 100}%`,
              background: "linear-gradient(90deg, rgba(201,168,76,0.5), rgba(201,168,76,0.8))",
            }} />
          </div>
        </div>

        {/* Produces label */}
        <div className="mt-2" style={{ fontSize: "0.55rem", color: "rgba(96,165,250,0.6)" }}>
          Produces: {skillInfo.produces}
        </div>
      </div>

      {/* ── Recipe List ──────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>
            Recipes ({recipes.length})
          </span>
          <button onClick={() => setFilterAvailableOnly(v => !v)}
            className="px-2 py-0.5 rounded text-xs uppercase"
            style={{
              color: filterAvailableOnly ? "#f0d070" : textDim,
              background: filterAvailableOnly ? "rgba(201,168,76,0.15)" : "transparent",
              border: `1px solid ${filterAvailableOnly ? borderGold : "transparent"}`,
              fontSize: "0.55rem",
            }}>
            {filterAvailableOnly ? "Craftable" : "All"}
          </button>
        </div>

        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
          {recipes.length === 0 ? (
            <div className="text-center py-4" style={{ color: textDim, fontSize: "0.65rem" }}>
              {filterAvailableOnly ? "No craftable recipes. Gather more materials or level up." : "No recipes known for this skill yet."}
            </div>
          ) : recipes.map(recipe => {
            const meetsLevel = skillProgress.level >= recipe.skillRequired;
            const hasMats = canCraft(recipe, craftingState.materials);
            const isSelected = selectedRecipe?.id === recipe.id;

            return (
              <button key={recipe.id} onClick={() => setSelectedRecipe(recipe)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all"
                style={{
                  background: isSelected ? "rgba(201,168,76,0.1)" : "rgba(0,0,0,0.2)",
                  border: `1px solid ${isSelected ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.06)"}`,
                  opacity: meetsLevel ? 1 : 0.5,
                }}>
                {/* Level indicator */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    color: meetsLevel ? "rgba(74,222,128,0.8)" : "rgba(251,113,133,0.7)",
                  }}>
                    {recipe.skillRequired}
                  </span>
                  <span style={{ fontSize: "0.45rem", color: textDim }}>req</span>
                </div>

                {/* Recipe info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate" style={{ color: meetsLevel && hasMats ? "rgba(232,213,176,0.9)" : "rgba(232,213,176,0.5)" }}>
                      {recipe.name}
                    </span>
                    {hasMats && meetsLevel && (
                      <span style={{ fontSize: "0.45rem", color: "rgba(74,222,128,0.7)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 3, padding: "0 3px" }}>
                        READY
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.5rem", color: textDim }} className="truncate">
                    {recipe.description}
                  </div>
                </div>

                {/* XP gain */}
                <span className="shrink-0" style={{ fontSize: "0.5rem", color: "rgba(201,168,76,0.4)" }}>
                  +{recipe.xpGain}xp
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected Recipe Details ──────────────────────────────────── */}
      {selectedRecipe && (
        <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid rgba(201,168,76,0.5)` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black" style={{ color: "#f0d070" }}>
              {selectedRecipe.name}
            </h3>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "0.55rem", color: textDim }}>
                Skill {selectedRecipe.skillRequired}
              </span>
              <span style={{ fontSize: "0.55rem", color: textDim }}>
                {selectedRecipe.craftTime} turns
              </span>
            </div>
          </div>

          <div style={{ fontSize: "0.6rem", color: "rgba(232,213,176,0.6)", marginBottom: 12, lineHeight: 1.4 }}>
            {selectedRecipe.description}
          </div>

          {/* Materials Required */}
          <div className="mb-3">
            <span style={{ fontSize: "0.55rem", color: textGold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Materials Required
            </span>
            <div className="flex flex-col gap-1 mt-2">
              {selectedRecipe.materials.map(mat => {
                const material = getMaterial(mat.materialId);
                const have = getMaterialQty(craftingState, mat.materialId);
                const enough = have >= mat.quantity;
                return (
                  <div key={mat.materialId} className="flex items-center justify-between rounded px-2 py-1"
                    style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "0.6rem", color: enough ? "rgba(232,213,176,0.8)" : "rgba(251,113,133,0.8)" }}>
                        {material?.name ?? mat.materialId}
                      </span>
                      {material && (
                        <span style={{ fontSize: "0.45rem", color: TIER_COLORS[material.tier] ?? textDim }}>
                          [{material.tier}]
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: enough ? "rgba(74,222,128,0.8)" : "rgba(251,113,133,0.8)",
                    }}>
                      {have}/{mat.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quality Preview */}
          <div className="mb-3">
            <span style={{ fontSize: "0.55rem", color: textGold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Quality Chance
            </span>
            <div className="flex gap-2 mt-1">
              {(["poor", "normal", "fine", "superior", "masterwork"] as CraftQuality[]).map(q => {
                const bonus = Math.max(0, skillProgress.level - selectedRecipe.skillRequired);
                let chance: string;
                if (q === "poor") chance = `${Math.max(0, 20 - bonus * 2)}%`;
                else if (q === "normal") chance = "~50%";
                else if (q === "fine") chance = bonus >= 1 ? `${Math.min(30, bonus * 3)}%` : "0%";
                else if (q === "superior") chance = bonus >= 5 ? `${Math.min(20, (bonus - 3) * 2)}%` : "0%";
                else chance = bonus >= 10 ? "5%" : "0%";

                return (
                  <div key={q} className="flex flex-col items-center" style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.5rem", fontWeight: 700, color: QUALITY_COLORS[q] }}>
                      {QUALITY_LABELS[q]}
                    </span>
                    <span style={{ fontSize: "0.45rem", color: textDim }}>{chance}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Craft Button */}
          <div className="flex items-center gap-3">
            <button onClick={handleCraft}
              disabled={!canCraftSelected.craftable}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all"
              style={{
                background: canCraftSelected.craftable ? "rgba(201,168,76,0.2)" : "rgba(0,0,0,0.3)",
                color: canCraftSelected.craftable ? "#f0d070" : "rgba(201,168,76,0.3)",
                border: `2px solid ${canCraftSelected.craftable ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.1)"}`,
                cursor: canCraftSelected.craftable ? "pointer" : "not-allowed",
                boxShadow: canCraftSelected.craftable ? "0 0 15px rgba(201,168,76,0.1)" : "none",
              }}>
              {canCraftSelected.craftable ? "Craft" : "Cannot Craft"}
            </button>
            {!canCraftSelected.craftable && (
              <span style={{ fontSize: "0.55rem", color: "rgba(251,113,133,0.7)", maxWidth: 150 }}>
                {canCraftSelected.reason}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Materials Inventory ──────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: panelBg, border: `1px solid ${borderGold}` }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: textGold }}>
          Materials ({craftingState.materials.filter(m => m.quantity > 0).length})
        </span>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {craftingState.materials.filter(m => m.quantity > 0).length === 0 ? (
            <div className="col-span-2 text-center py-4" style={{ color: textDim, fontSize: "0.6rem" }}>
              No crafting materials. Gather them from the world or buy from merchants.
            </div>
          ) : craftingState.materials.filter(m => m.quantity > 0).map(stack => {
            const material = getMaterial(stack.materialId);
            if (!material) return null;
            return (
              <div key={stack.materialId} className="flex items-center gap-2 rounded px-2 py-1.5"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.06)" }}>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold truncate block" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.6rem" }}>
                    {material.name}
                  </span>
                  <span style={{ fontSize: "0.45rem", color: TIER_COLORS[material.tier] ?? textDim }}>
                    {material.tier}
                  </span>
                </div>
                <span className="text-xs font-black" style={{ color: "rgba(201,168,76,0.7)" }}>
                  x{stack.quantity}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Craft Result Modal ──────────────────────────────────────── */}
      {showResult && craftResult && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{
            background: "rgba(15,10,5,0.95)",
            border: `2px solid ${craftResult.success ? "rgba(201,168,76,0.6)" : "rgba(251,113,133,0.4)"}`,
            boxShadow: craftResult.success ? "0 0 40px rgba(201,168,76,0.15)" : "0 0 40px rgba(251,113,133,0.1)",
          }}>
            {/* Quality badge */}
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">
                {craftResult.success ? (
                  craftResult.quality === "masterwork" ? "\u{2B50}" :
                  craftResult.quality === "superior" ? "\u{1F4A0}" :
                  craftResult.quality === "fine" ? "\u{2728}" :
                  "\u{2705}"
                ) : "\u{274C}"}
              </div>
              <div className="text-sm font-black uppercase tracking-widest" style={{
                color: craftResult.success ? QUALITY_COLORS[craftResult.quality] : "rgba(251,113,133,0.8)",
              }}>
                {craftResult.success ? `${QUALITY_LABELS[craftResult.quality]} Quality` : "Craft Failed"}
              </div>
            </div>

            {/* Description */}
            <div className="text-center mb-4" style={{ fontSize: "0.7rem", color: "rgba(232,213,176,0.8)", lineHeight: 1.5 }}>
              {craftResult.description}
            </div>

            {/* Stats */}
            {craftResult.success && (
              <div className="flex justify-center gap-4 mb-4">
                <div className="text-center">
                  <div style={{ fontSize: "0.5rem", color: textDim }}>Quality</div>
                  <div className="font-bold" style={{ fontSize: "0.7rem", color: QUALITY_COLORS[craftResult.quality] }}>
                    {QUALITY_LABELS[craftResult.quality]} ({craftResult.qualityMultiplier}x)
                  </div>
                </div>
                <div className="text-center">
                  <div style={{ fontSize: "0.5rem", color: textDim }}>XP Gained</div>
                  <div className="font-bold" style={{ fontSize: "0.7rem", color: "rgba(74,222,128,0.8)" }}>
                    +{craftResult.xpGained}
                  </div>
                </div>
              </div>
            )}

            {/* Dismiss */}
            <button onClick={dismissResult}
              className="w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest"
              style={{ background: "rgba(201,168,76,0.15)", color: "#f0d070", border: `1px solid ${borderGold}` }}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
