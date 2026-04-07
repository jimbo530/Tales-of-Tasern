"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Avatar, Name, Address } from "@coinbase/onchainkit/identity";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { base } from "wagmi/chains";
import { useNftStats, type NftCharacter } from "@/hooks/useNftStats";
import { useCharacterSave } from "@/hooks/useCharacterSave";
import { CharacterCard } from "@/components/CharacterCard";
import { HexBattle, type QuestEncounter } from "@/components/HexBattle";
import { WorldMap, type WorldLuckResult } from "@/components/WorldMap";
import { PlayerInventory } from "@/components/PlayerInventory";
import { PowerUp } from "@/components/PowerUp";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { CLASSES, getClassById, HIT_DIE_VALUES, type CharacterClass, type SpellcastingInfo } from "@/lib/classes";
import { SKILLS, abilityMod, type Skill } from "@/lib/skills";
import { FEATS, getAvailableFeats, getStartingFeatCount, featsForLevelUp, featNeedsChoice, parseFeatChoice, type Feat } from "@/lib/feats";
import { SPELLS, SPELL_SCHOOLS, SPECIALIZABLE_SCHOOLS, getClassSpells, getSpellsKnown, getSpellSlots, type Spell, type SpellSchool } from "@/lib/spells";
import { DOMAINS, type Domain } from "@/lib/domains";
import { formatCoins, addCp, subtractCp, totalCp, cpToCoins, addCoinsRaw, setQuestCooldown, setQuestCooldownDays, getExhaustionPoints, lowestExhaustedStat, addXp } from "@/lib/saveSystem";
import { changeRep } from "@/lib/factions";
import { getItemInfo, getItemWeight } from "@/lib/itemRegistry";
import { purchaseShip, getShip } from "@/lib/ships";
import { getItemById } from "@/lib/loot";
import { allPartiesActed, resetPartyRound, nextUnactedParty, hireFollower, GENERAL_TEMPLATES, maxFollowers, createAdventureParty, swapActiveParty, migratePartySupplies, migrateEntityProgression, processDailyUpkeep, getLeaderProgression, defaultProgression, autoEquipFollower, type EntityProgression } from "@/lib/party";
import { downloadAndCache, getCacheCount, clearImageCache } from "@/lib/imageCache";
import { resolveImage, toHttp } from "@/lib/resolveImage";

const PAGE_SIZE = 10;

function DownloadImages({ characters }: { characters: NftCharacter[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getCacheCount().then(setCachedCount);
  }, []);

  async function downloadAll() {
    setDownloading(true);
    setStatus("Resolving images...");
    let done = 0;
    let failed = 0;
    for (const c of characters) {
      if (!c.metadataUri) { failed++; continue; }
      try {
        const url = await resolveImage(toHttp(c.metadataUri));
        if (url) {
          const ok = await downloadAndCache(c.contractAddress, url);
          if (ok) done++;
          else failed++;
        } else { failed++; }
      } catch { failed++; }
      setStatus(`Downloaded ${done}/${characters.length}${failed > 0 ? ` (${failed} failed)` : ""}`);
    }
    setStatus(`Done! ${done} images cached locally.`);
    setCachedCount(await getCacheCount());
    setDownloading(false);
  }

  async function clearAll() {
    await clearImageCache();
    setCachedCount(0);
    setStatus("Cache cleared.");
  }

  return (
    <div className="w-full max-w-lg flex items-center justify-center gap-3 flex-wrap px-4 py-2 rounded-lg"
      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
      <span className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
        {cachedCount}/{characters.length} images cached
      </span>
      <button onClick={downloadAll} disabled={downloading}
        className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(96,165,250,0.2)', color: 'rgba(96,165,250,0.9)', border: '1px solid rgba(96,165,250,0.4)', opacity: downloading ? 0.5 : 1 }}>
        {downloading ? "Downloading..." : "Download All Images"}
      </button>
      {cachedCount > 0 && (
        <button onClick={clearAll}
          className="px-2 py-1 rounded text-xs"
          style={{ color: 'rgba(220,38,38,0.5)', border: '1px solid rgba(220,38,38,0.2)' }}>
          Clear
        </button>
      )}
      {status && <span className="text-xs w-full text-center" style={{ color: 'rgba(74,222,128,0.7)' }}>{status}</span>}
    </div>
  );
}

type SpellConfig = {
  known_spells?: string[];
  prepared_spells?: string[];
  spellbook?: string[];
  domains?: [string, string] | null;
  school_specialization?: string | null;
  prohibited_schools?: string[];
};

// ── Level-Up Flow ──────────────────────────────────────────────────────────
// Shown after battle when levelsGained > 0. Skills, feats, spells selection.

function LevelUpFlow({ save, character, fromLevel, toLevel, entry, onComplete }: {
  save: import("@/lib/saveSystem").CharacterSave;
  character: NftCharacter | null;
  fromLevel: number;
  toLevel: number;
  entry?: import("@/hooks/useCharacterSave").LevelUpEntry;
  onComplete: (patch: Partial<import("@/lib/saveSystem").CharacterSave>) => void;
}) {
  // Resolve which entity's progression to use
  const isFollower = entry?.entityType === "follower";
  const follower = isFollower && entry?.heroIndex !== undefined && entry?.followerIndex !== undefined
    ? save.party.heroes[entry.heroIndex]?.followers[entry.followerIndex] : null;
  const prog = isFollower && follower?.progression
    ? follower.progression
    : isFollower && follower
      ? { ...defaultProgression(follower.class_id), total_level: follower.level, xp: follower.xp ?? 0 }
      : getLeaderProgression(save);
  const stats = character?.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const intMod = abilityMod(stats.int);
  const conMod = abilityMod(stats.con);
  const levelsGained = toLevel - fromLevel;

  // ── Class selection for each level gained (multiclass support) ──
  const [classChoices, setClassChoices] = useState<string[]>([]); // class_id picked for each level
  const currentClassId = classChoices.length > 0 ? classChoices[classChoices.length - 1] : (prog.class_levels[0]?.class_id ?? save.class_id);
  const cls = getClassById(currentClassId);

  // ── HP gain (rolled by player) — uses the class chosen for each level ──
  const getHitDieForChoice = (idx: number) => {
    const cid = classChoices[idx] ?? currentClassId;
    const c = getClassById(cid);
    return c ? HIT_DIE_VALUES[c.hitDie] : 8;
  };
  const hitDieValue = cls ? HIT_DIE_VALUES[cls.hitDie] : 8;
  const hitDieLabel = `d${hitDieValue}`;

  // ── Skill points (based on chosen class per level) ──
  const skillPointsPerLevel = Math.max(1, (cls?.skillPoints ?? 2) + intMod);
  const totalSkillPoints = classChoices.reduce((sum, cid) => {
    const c = getClassById(cid);
    return sum + Math.max(1, (c?.skillPoints ?? 2) + intMod);
  }, 0) || skillPointsPerLevel * levelsGained;
  // Class skills = union of all classes (existing + newly chosen)
  const allClassIds = new Set([...prog.class_levels.map(cl => cl.class_id), ...classChoices]);
  const classSkillIds = new Set<string>();
  for (const cid of allClassIds) {
    const c = getClassById(cid);
    if (c) for (const s of c.classSkills) classSkillIds.add(s);
  }
  const maxClassRank = toLevel + 3;
  const maxCrossRank = Math.floor((toLevel + 3) / 2);

  // ── Feats ──
  const { standard: featSlots, fighterBonus } = featsForLevelUp(fromLevel, toLevel, currentClassId);
  const totalFeatSlots = featSlots + fighterBonus;

  // ── Spells (spontaneous casters) ──
  const casterType = cls?.spellcasting?.type;
  const casterClass = cls?.spellcasting ? currentClassId as "sorcerer" | "bard" : null;
  const isSpontaneous = casterType === "spontaneous" && (casterClass === "sorcerer" || casterClass === "bard");
  const isWizard = currentClassId === "wizard";

  // Calculate new spells to pick for spontaneous casters
  const newSpellSlots: { level: number; count: number }[] = [];
  if (isSpontaneous && casterClass) {
    const oldCasterLvl = prog.class_levels.find(cl => cl.class_id === casterClass)?.levels ?? 0;
    const newCasterLvl = oldCasterLvl + classChoices.filter(c => c === casterClass).length;
    if (newCasterLvl > oldCasterLvl) {
      const oldKnown = getSpellsKnown(casterClass, oldCasterLvl);
      const newKnown = getSpellsKnown(casterClass, newCasterLvl);
      for (let sl = 0; sl < newKnown.length; sl++) {
        const diff = (newKnown[sl] ?? 0) - (oldKnown[sl] ?? 0);
        if (diff > 0) newSpellSlots.push({ level: sl, count: diff });
      }
    }
  }
  // Wizard: 2 free spells per level in wizard class
  const wizardLevelsGained = classChoices.filter(c => c === "wizard").length;
  const wizardNewSpells = isWizard ? 2 * (wizardLevelsGained || levelsGained) : 0;
  const needsSpells = newSpellSlots.length > 0 || wizardNewSpells > 0;

  // ── Steps ──
  type LuStep = "class" | "summary" | "hp" | "skills" | "feats" | "spells" | "done";
  const steps: LuStep[] = ["class", "summary", "hp", "skills"];
  if (totalFeatSlots > 0) steps.push("feats");
  if (needsSpells) steps.push("spells");
  steps.push("done");

  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];

  // Skill allocation state
  const [luSkillRanks, setLuSkillRanks] = useState<Record<string, number>>({});
  const usedSkillPoints = Object.entries(luSkillRanks).reduce((s, [id, v]) => s + v * (classSkillIds.has(id) ? 1 : 2), 0);
  const remainingSkillPoints = totalSkillPoints - usedSkillPoints;

  // Feat selection state
  const [luFeats, setLuFeats] = useState<string[]>([]);
  const [luPendingFeat, setLuPendingFeat] = useState<string | null>(null);
  const [luFeatFilter, setLuFeatFilter] = useState<"all" | "combat" | "general" | "magic" | "skill">("all");
  const allFeats = [...prog.feats, ...luFeats];
  const availableFeats = cls ? getAvailableFeats(toLevel, cls.id, stats as Record<string, number>, allFeats) : [];
  const filteredFeats = luFeatFilter === "all" ? availableFeats : availableFeats.filter(f => f.category === luFeatFilter);

  // HP roll state — one roll per level gained, reroll 1s allowed
  const [hpRolls, setHpRolls] = useState<number[]>([]);  // one entry per level gained
  const totalHpGain = hpRolls.length === levelsGained
    ? hpRolls.reduce((s, r, i) => s + Math.max(1, r + conMod), 0)
    : 0;

  // Spell selection state
  const [luSpells, setLuSpells] = useState<string[]>([]);
  const totalSpellsNeeded = newSpellSlots.reduce((s, sl) => s + sl.count, 0) + wizardNewSpells;

  // ── Styling helpers ──
  const gold = "rgba(201,168,76,0.5)";
  const parchment = "rgba(232,213,176,0.7)";
  const greenGlow = "rgba(74,222,128,0.9)";
  const btn = "px-4 py-2 rounded text-sm font-bold uppercase tracking-widest";
  const btnStyle = { background: "rgba(74,222,128,0.15)", color: greenGlow, border: "1px solid rgba(74,222,128,0.4)" };

  // ── Class Selection Step (multiclass) ──
  if (step === "class") {
    const levelsChosen = classChoices.length;
    const allChosen = levelsChosen >= levelsGained;
    return (
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            Level Up!
          </span>
          <span className="text-lg font-bold" style={{ color: "rgba(251,191,36,0.8)" }}>Level {fromLevel} → {toLevel}</span>
        </div>
        <div className="text-center">
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(168,85,247,0.9)" }}>Choose Class for Level {fromLevel + levelsChosen + 1}</span>
          <div className="text-xs mt-1" style={{ color: parchment }}>{levelsChosen} / {levelsGained} levels assigned</div>
        </div>
        {/* Current class breakdown */}
        {prog.class_levels.length > 0 && (
          <div className="w-full px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.15)", fontSize: "0.7rem", color: parchment }}>
            <div className="text-xs font-bold mb-1" style={{ color: gold }}>Current Classes:</div>
            {prog.class_levels.map(cl => {
              const c = getClassById(cl.class_id);
              return <div key={cl.class_id}>{c?.emoji ?? ""} {c?.name ?? cl.class_id} Lv{cl.levels}</div>;
            })}
            {classChoices.length > 0 && (
              <>
                <div className="text-xs font-bold mt-1 mb-1" style={{ color: "rgba(74,222,128,0.8)" }}>New Levels:</div>
                {classChoices.map((cid, i) => {
                  const c = getClassById(cid);
                  return <div key={i}>{c?.emoji ?? ""} {c?.name ?? cid} (Level {fromLevel + i + 1})</div>;
                })}
              </>
            )}
          </div>
        )}
        {/* Class picker */}
        {!allChosen && (
          <div className="w-full flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "45vh" }}>
            {CLASSES.map(c => (
              <button key={c.id} onClick={() => setClassChoices(prev => [...prev, c.id])}
                className="flex items-center gap-2 px-3 py-2 rounded text-left"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)" }}>
                <span className="text-lg">{c.emoji}</span>
                <div className="flex-1">
                  <span className="text-xs font-bold" style={{ color: parchment }}>{c.name}</span>
                  <span className="ml-2 text-xs" style={{ color: gold }}>{c.hitDie} | {c.bab} BAB</span>
                  <div style={{ fontSize: "0.55rem", color: "rgba(201,168,76,0.4)" }}>{c.description.slice(0, 60)}...</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* Undo last pick */}
        {classChoices.length > 0 && !allChosen && (
          <button onClick={() => setClassChoices(prev => prev.slice(0, -1))}
            className="px-3 py-1 rounded text-xs" style={{ color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.3)" }}>
            Undo Last Pick
          </button>
        )}
        {allChosen && (
          <div className="flex gap-2">
            <button onClick={() => setClassChoices(prev => prev.slice(0, -1))}
              className="px-3 py-1 rounded text-xs" style={{ color: "rgba(220,38,38,0.8)", border: "1px solid rgba(220,38,38,0.3)" }}>
              Undo
            </button>
            <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>Next</button>
          </div>
        )}
      </div>
    );
  }

  // ── Summary Step ──
  if (step === "summary") {
    return (
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-lg" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.4)" }}>
          <span className="text-2xl font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            Level Up!
          </span>
          <span className="text-lg font-bold" style={{ color: "rgba(251,191,36,0.8)" }}>Level {fromLevel} → {toLevel}</span>
        </div>
        <div className="w-full flex flex-col gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.15)", fontSize: "0.8rem", color: parchment }}>
          <div className="flex justify-between"><span>Hit Die</span><span className="font-bold" style={{ color: "rgba(74,222,128,0.9)" }}>{levelsGained}x {hitDieLabel} + {conMod} CON</span></div>
          <div className="flex justify-between"><span>Skill Points</span><span className="font-bold" style={{ color: "rgba(96,165,250,0.9)" }}>{totalSkillPoints}</span></div>
          {totalFeatSlots > 0 && <div className="flex justify-between"><span>Feats</span><span className="font-bold" style={{ color: "rgba(168,85,247,0.9)" }}>{totalFeatSlots}{fighterBonus > 0 ? ` (${featSlots} std + ${fighterBonus} fighter)` : ""}</span></div>}
          {needsSpells && <div className="flex justify-between"><span>New Spells</span><span className="font-bold" style={{ color: "rgba(251,191,36,0.9)" }}>{totalSpellsNeeded}</span></div>}
        </div>
        <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>Allocate Points</button>
      </div>
    );
  }

  // ── HP Rolling Step ──
  if (step === "hp") {
    const currentLevelIdx = hpRolls.length; // which level we're rolling for (0-based)
    const allRolled = hpRolls.length >= levelsGained;
    const lastRoll = hpRolls.length > 0 ? hpRolls[hpRolls.length - 1] : null;
    const canReroll = lastRoll === 1; // reroll 1s
    const currentDie = getHitDieForChoice(currentLevelIdx);
    const lastDie = hpRolls.length > 0 ? getHitDieForChoice(hpRolls.length - 1) : currentDie;

    function rollHitDie() {
      const die = getHitDieForChoice(currentLevelIdx);
      const roll = Math.floor(Math.random() * die) + 1;
      setHpRolls(prev => [...prev, roll]);
    }

    function rerollLast() {
      const die = getHitDieForChoice(hpRolls.length - 1);
      const roll = Math.floor(Math.random() * die) + 1;
      setHpRolls(prev => [...prev.slice(0, -1), roll]);
    }

    return (
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="text-center">
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(74,222,128,0.9)" }}>Roll for Hit Points</span>
          <div className="text-xs mt-1" style={{ color: parchment }}>Hit die + {conMod} CON per level ({levelsGained} {levelsGained === 1 ? "level" : "levels"})</div>
        </div>

        {/* Previous rolls */}
        {hpRolls.length > 0 && (
          <div className="w-full flex flex-col gap-1 px-4 py-3 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.15)" }}>
            {hpRolls.map((roll, i) => {
              const die = getHitDieForChoice(i);
              const hpForLevel = Math.max(1, roll + conMod);
              const clsName = getClassById(classChoices[i] ?? currentClassId)?.name ?? "?";
              return (
                <div key={i} className="flex justify-between text-sm" style={{ color: parchment }}>
                  <span>Lv{fromLevel + i + 1} <span style={{ fontSize: "0.6rem", color: gold }}>({clsName})</span></span>
                  <span>
                    <span className="font-bold" style={{ color: roll === 1 ? "rgba(239,68,68,0.9)" : roll === die ? "rgba(251,191,36,0.9)" : "rgba(74,222,128,0.9)" }}>
                      {roll}
                    </span>
                    <span style={{ color: gold }}> (d{die})</span>
                    <span> + {conMod}</span>
                    <span> = </span>
                    <span className="font-bold" style={{ color: "rgba(74,222,128,0.9)" }}>+{hpForLevel} HP</span>
                  </span>
                </div>
              );
            })}
            {allRolled && (
              <div className="flex justify-between text-sm font-bold mt-1 pt-1" style={{ borderTop: "1px solid rgba(201,168,76,0.15)", color: "rgba(74,222,128,0.9)" }}>
                <span>Total HP Gained</span>
                <span>+{totalHpGain}</span>
              </div>
            )}
          </div>
        )}

        {/* Roll / Reroll buttons */}
        <div className="flex flex-col items-center gap-2">
          {canReroll && (
            <button onClick={rerollLast} className={btn}
              style={{ background: "rgba(251,191,36,0.15)", color: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.4)" }}>
              Reroll the 1
            </button>
          )}
          {!allRolled && !canReroll && (
            <button onClick={rollHitDie} className={btn} style={btnStyle}>
              Roll d{currentDie} for Level {fromLevel + currentLevelIdx + 1}
            </button>
          )}
          {allRolled && !canReroll && (
            <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>Next</button>
          )}
        </div>
      </div>
    );
  }

  // ── Skills Step ──
  if (step === "skills") {
    const allSkills = SKILLS;
    return (
      <div className="flex flex-col gap-3 max-w-md mx-auto">
        <div className="text-center">
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(96,165,250,0.9)" }}>Allocate Skill Points</span>
          <div className="text-xs mt-1" style={{ color: parchment }}>{remainingSkillPoints} / {totalSkillPoints} remaining</div>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "50vh" }}>
          {allSkills.map(sk => {
            const isClass = classSkillIds.has(sk.id);
            const currentRank = prog.skill_ranks[sk.id] ?? 0;
            const addedRank = luSkillRanks[sk.id] ?? 0;
            const totalRank = currentRank + addedRank;
            const maxRank = isClass ? maxClassRank : maxCrossRank;
            const cost = isClass ? 1 : 2;
            const canAdd = totalRank < maxRank && remainingSkillPoints >= cost;
            const canRemove = addedRank > 0;
            return (
              <div key={sk.id} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: addedRank > 0 ? "rgba(96,165,250,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${addedRank > 0 ? "rgba(96,165,250,0.2)" : "rgba(201,168,76,0.08)"}`, fontSize: "0.7rem" }}>
                <div className="flex-1">
                  <span style={{ color: isClass ? "rgba(96,165,250,0.9)" : parchment }}>{sk.name}</span>
                  <span className="ml-1" style={{ fontSize: "0.55rem", color: gold }}>{isClass ? "class" : `cross (${cost}pt)`}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold w-8 text-center" style={{ color: parchment }}>{totalRank}/{maxRank}</span>
                  <button disabled={!canRemove} onClick={() => setLuSkillRanks(prev => ({ ...prev, [sk.id]: (prev[sk.id] ?? 0) - 1 }))}
                    className="w-6 h-6 rounded text-xs font-bold" style={{ background: canRemove ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.03)", color: canRemove ? "rgba(220,38,38,0.9)" : "rgba(255,255,255,0.15)", border: `1px solid ${canRemove ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.05)"}` }}>-</button>
                  <button disabled={!canAdd} onClick={() => setLuSkillRanks(prev => ({ ...prev, [sk.id]: (prev[sk.id] ?? 0) + 1 }))}
                    className="w-6 h-6 rounded text-xs font-bold" style={{ background: canAdd ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)", color: canAdd ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.15)", border: `1px solid ${canAdd ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.05)"}` }}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>
          {remainingSkillPoints > 0 ? `Skip (${remainingSkillPoints} unspent)` : "Next"}
        </button>
      </div>
    );
  }

  // ── Feats Step ──
  if (step === "feats") {
    return (
      <div className="flex flex-col gap-3 max-w-md mx-auto">
        <div className="text-center">
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(168,85,247,0.9)" }}>Choose Feats</span>
          <div className="text-xs mt-1" style={{ color: parchment }}>{luFeats.length} / {totalFeatSlots} selected</div>
        </div>
        {/* Skill Focus sub-picker */}
        {luPendingFeat === "skill-focus" && (
          <div className="p-3 rounded-lg" style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "rgba(96,165,250,0.9)" }}>Pick a skill for Skill Focus (+3):</div>
            <div className="flex flex-wrap gap-1">
              {SKILLS.filter(sk => !allFeats.includes(`skill-focus:${sk.id}`)).map(sk => (
                <button key={sk.id} onClick={() => { setLuFeats(prev => [...prev, `skill-focus:${sk.id}`]); setLuPendingFeat(null); }}
                  className="px-2 py-1 rounded text-xs" style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.9)", border: "1px solid rgba(96,165,250,0.3)" }}>
                  {sk.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Filter */}
        <div className="flex gap-1 justify-center flex-wrap">
          {(["all", "combat", "general", "magic", "skill"] as const).map(cat => (
            <button key={cat} onClick={() => setLuFeatFilter(cat)}
              className="px-2 py-0.5 rounded text-xs uppercase" style={{ background: luFeatFilter === cat ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)", color: luFeatFilter === cat ? "rgba(168,85,247,0.9)" : gold, border: `1px solid ${luFeatFilter === cat ? "rgba(168,85,247,0.4)" : "rgba(201,168,76,0.1)"}` }}>
              {cat}
            </button>
          ))}
        </div>
        {/* Feat list */}
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "45vh" }}>
          {filteredFeats.map(feat => {
            const picked = luFeats.includes(feat.id) || luFeats.some(f => f.startsWith(feat.id + ":"));
            const disabled = luFeats.length >= totalFeatSlots && !picked;
            // Fighter bonus feats must be combat (if all standard slots filled, remaining must be combat)
            const stdFilled = luFeats.filter(f => { const base = FEATS.find(ff => ff.id === f || f.startsWith(ff.id + ":")); return base ? base.category !== "combat" || luFeats.indexOf(f) < featSlots : true; }).length;
            return (
              <button key={feat.id} disabled={disabled && !picked}
                onClick={() => {
                  if (picked) {
                    setLuFeats(prev => prev.filter(f => f !== feat.id && !f.startsWith(feat.id + ":")));
                  } else if (luFeats.length < totalFeatSlots) {
                    const choice = featNeedsChoice(feat.id);
                    if (choice === "skill") { setLuPendingFeat(feat.id); }
                    else { setLuFeats(prev => [...prev, feat.id]); }
                  }
                }}
                className="flex flex-col px-2 py-1.5 rounded text-left" style={{
                  background: picked ? "rgba(168,85,247,0.12)" : disabled ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${picked ? "rgba(168,85,247,0.4)" : "rgba(201,168,76,0.08)"}`,
                  opacity: disabled && !picked ? 0.4 : 1,
                }}>
                <span className="text-xs font-bold" style={{ color: picked ? "rgba(168,85,247,0.9)" : parchment }}>{feat.name}</span>
                <span style={{ fontSize: "0.55rem", color: gold }}>{feat.description.slice(0, 80)}{feat.description.length > 80 ? "..." : ""}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>
          {luFeats.length < totalFeatSlots ? `Skip (${totalFeatSlots - luFeats.length} unselected)` : "Next"}
        </button>
      </div>
    );
  }

  // ── Spells Step ──
  if (step === "spells") {
    const casterKey = currentClassId as "sorcerer" | "bard" | "wizard";
    const alreadyKnown = new Set([...prog.known_spells, ...prog.spellbook, ...luSpells]);
    return (
      <div className="flex flex-col gap-3 max-w-md mx-auto">
        <div className="text-center">
          <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(251,191,36,0.9)" }}>Learn New Spells</span>
          <div className="text-xs mt-1" style={{ color: parchment }}>{luSpells.length} / {totalSpellsNeeded} selected</div>
        </div>
        {/* Show needed spells by level */}
        {isSpontaneous && casterClass && newSpellSlots.map(({ level: sl, count }) => {
          const picked = luSpells.filter(sid => { const sp = SPELLS.find(s => s.id === sid); return sp && sp.levels[casterClass] === sl; }).length;
          const spellsAtLevel = getClassSpells(casterClass, sl).filter(s => !alreadyKnown.has(s.id));
          return (
            <div key={sl}>
              <div className="text-xs font-bold mb-1" style={{ color: "rgba(251,191,36,0.8)" }}>
                {sl === 0 ? "Cantrips" : `Level ${sl} Spells`} — pick {count - picked} more
              </div>
              <div className="flex flex-wrap gap-1">
                {spellsAtLevel.map(sp => {
                  const sel = luSpells.includes(sp.id);
                  const full = picked >= count && !sel;
                  return (
                    <button key={sp.id} disabled={full && !sel}
                      onClick={() => sel ? setLuSpells(prev => prev.filter(s => s !== sp.id)) : !full ? setLuSpells(prev => [...prev, sp.id]) : undefined}
                      className="px-2 py-1 rounded text-xs" style={{
                        background: sel ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.03)",
                        color: sel ? "rgba(251,191,36,0.9)" : full ? "rgba(255,255,255,0.2)" : parchment,
                        border: `1px solid ${sel ? "rgba(251,191,36,0.4)" : "rgba(201,168,76,0.1)"}`,
                      }}>
                      {sp.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {isWizard && (() => {
          const picked = luSpells.length;
          // Wizard picks from any spell level they can cast
          const slots = getSpellSlots("wizard", toLevel);
          const maxSpellLevel = slots.length - 1;
          const available = SPELLS.filter(s => s.levels.wizard !== undefined && s.levels.wizard <= maxSpellLevel && s.levels.wizard > 0 && !alreadyKnown.has(s.id));
          return (
            <div>
              <div className="text-xs font-bold mb-1" style={{ color: "rgba(251,191,36,0.8)" }}>
                Add to Spellbook — pick {wizardNewSpells - picked} more
              </div>
              <div className="flex flex-wrap gap-1">
                {available.map(sp => {
                  const sel = luSpells.includes(sp.id);
                  const full = picked >= wizardNewSpells && !sel;
                  return (
                    <button key={sp.id} disabled={full && !sel}
                      onClick={() => sel ? setLuSpells(prev => prev.filter(s => s !== sp.id)) : !full ? setLuSpells(prev => [...prev, sp.id]) : undefined}
                      className="px-2 py-1 rounded text-xs" style={{
                        background: sel ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.03)",
                        color: sel ? "rgba(251,191,36,0.9)" : full ? "rgba(255,255,255,0.2)" : parchment,
                        border: `1px solid ${sel ? "rgba(251,191,36,0.4)" : "rgba(201,168,76,0.1)"}`,
                      }}>
                      {sp.name} <span style={{ fontSize: "0.5rem", color: gold }}>Lv{sp.levels.wizard ?? "?"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <button onClick={() => setStepIdx(stepIdx + 1)} className={btn} style={btnStyle}>
          {luSpells.length < totalSpellsNeeded ? `Skip (${totalSpellsNeeded - luSpells.length} unselected)` : "Confirm"}
        </button>
      </div>
    );
  }

  // ── Done Step ──
  if (step === "done") {
    // Merge skill ranks into progression
    const mergedRanks = { ...prog.skill_ranks };
    for (const [id, v] of Object.entries(luSkillRanks)) {
      mergedRanks[id] = (mergedRanks[id] ?? 0) + v;
    }
    const mergedFeats = [...prog.feats, ...luFeats];
    const mergedKnown = isSpontaneous ? [...prog.known_spells, ...luSpells] : prog.known_spells;
    const mergedSpellbook = isWizard ? [...prog.spellbook, ...luSpells] : prog.spellbook;
    const newMaxHp = prog.max_hp + totalHpGain;

    // Build updated class_levels and level_history from classChoices
    const updatedHistory = [...prog.level_history, ...classChoices];
    const updatedClassLevels = [...prog.class_levels];
    for (const cid of classChoices) {
      const existing = updatedClassLevels.find(cl => cl.class_id === cid);
      if (existing) {
        existing.levels += 1;
      } else {
        updatedClassLevels.push({ class_id: cid, levels: 1 });
      }
    }

    // Build updated EntityProgression
    const updatedProg: EntityProgression = {
      ...prog,
      class_levels: updatedClassLevels,
      level_history: updatedHistory,
      total_level: toLevel,
      skill_ranks: mergedRanks,
      feats: mergedFeats,
      known_spells: mergedKnown,
      spellbook: mergedSpellbook,
      max_hp: newMaxHp,
      current_hp: Math.min(newMaxHp, prog.current_hp + totalHpGain),
    };

    // Patch the entity's progression into the party
    const hIdx = isFollower ? (entry?.heroIndex ?? 0) : (save.party.heroes.findIndex(h => h.isLeader) >= 0 ? save.party.heroes.findIndex(h => h.isLeader) : 0);
    const updatedHeroes = save.party.heroes.map((h, i) => {
      if (i !== hIdx) return h;
      if (isFollower && entry?.followerIndex !== undefined) {
        // Patch follower's progression
        const updatedFollowers = h.followers.map((f, fi) =>
          fi === entry.followerIndex ? { ...f, level: toLevel, progression: updatedProg } : f
        );
        return { ...h, followers: updatedFollowers };
      }
      // Patch hero's progression
      return { ...h, progression: updatedProg };
    });

    return (
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: greenGlow }}>
          {isFollower ? `${entry?.entityName ?? "Follower"} ` : ""}Level Up Complete!
        </span>
        <div className="w-full flex flex-col gap-1 px-4 py-3 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.15)", fontSize: "0.75rem", color: parchment }}>
          <div>HP: {prog.max_hp} → {newMaxHp}</div>
          {classChoices.length > 0 && (
            <div>Classes: {updatedClassLevels.map(cl => {
              const c = getClassById(cl.class_id);
              return `${c?.name ?? cl.class_id} ${cl.levels}`;
            }).join(" / ")}</div>
          )}
          {Object.entries(luSkillRanks).filter(([, v]) => v > 0).map(([id, v]) => (
            <div key={id}>{SKILLS.find(s => s.id === id)?.name ?? id}: +{v}</div>
          ))}
          {luFeats.map(fid => {
            const parsed = parseFeatChoice(fid);
            const feat = FEATS.find(f => f.id === (parsed?.baseFeatId ?? fid));
            return <div key={fid}>Feat: {feat?.name ?? fid}{parsed ? ` (${SKILLS.find(s => s.id === parsed.choiceId)?.name ?? parsed.choiceId})` : ""}</div>;
          })}
          {luSpells.map(sid => {
            const sp = SPELLS.find(s => s.id === sid);
            return <div key={sid}>Spell: {sp?.name ?? sid}</div>;
          })}
        </div>
        <button onClick={() => onComplete({
          // Top-level fields for backward compat (hero only)
          ...(isFollower ? {} : {
            level: toLevel,
            skill_ranks: mergedRanks,
            feats: mergedFeats,
            known_spells: mergedKnown,
            spellbook: mergedSpellbook,
            max_hp: newMaxHp,
            current_hp: Math.min(newMaxHp, prog.current_hp + totalHpGain),
          }),
          // Updated party with entity's new progression
          party: { heroes: updatedHeroes },
        })} className={btn} style={btnStyle}>
          Continue Adventure
        </button>
      </div>
    );
  }

  return null;
}

function NewGameFlow({ ownedChars, onStart }: {
  ownedChars: NftCharacter[];
  onStart: (nft: NftCharacter, classId: string, skillRanks: Record<string, number>, feats: string[], spellConfig?: SpellConfig, factionName?: string) => void;
}) {
  const [step, setStep] = useState<"nft" | "class" | "spells" | "abilities" | "skills" | "confirm" | "faction">("nft");
  const [pickedNft, setPickedNft] = useState<NftCharacter | null>(null);
  const [pickedClass, setPickedClass] = useState<CharacterClass | null>(null);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [pickedFeats, setPickedFeats] = useState<string[]>([]);
  const [skillRanks, setSkillRanks] = useState<Record<string, number>>({});
  const [featFilter, setFeatFilter] = useState<"all" | "combat" | "general" | "magic" | "skill">("all");
  const [factionName, setFactionName] = useState("");
  // ── Spell creation state ──
  const [pickedDomains, setPickedDomains] = useState<string[]>([]);
  const [pickedSpecialization, setPickedSpecialization] = useState<SpellSchool | null>(null);
  const [pickedProhibited, setPickedProhibited] = useState<SpellSchool[]>([]);
  const [pickedKnownSpells, setPickedKnownSpells] = useState<string[]>([]);
  // ── Feat sub-selection state (e.g., which skill for Skill Focus) ──
  const [pendingFeat, setPendingFeat] = useState<string | null>(null);

  const stats = pickedNft ? pickedNft.stats : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const intMod = abilityMod(stats.int);
  const totalSkillPoints = pickedClass ? Math.max(1, pickedClass.skillPoints + intMod) * 4 : 0; // ×4 at level 1
  const classSkillIds = new Set(pickedClass?.classSkills ?? []);
  const usedSkillPoints = Object.entries(skillRanks).reduce((s, [id, v]) => s + v * (classSkillIds.has(id) ? 1 : 2), 0);
  const remainingSkillPoints = totalSkillPoints - usedSkillPoints;
  const maxFeatSlots = pickedClass ? getStartingFeatCount(pickedClass.id) : 1;
  const availableFeats = pickedClass
    ? getAvailableFeats(1, pickedClass.id, stats as Record<string, number>, pickedFeats)
    : [];
  const filteredFeats = featFilter === "all" ? availableFeats : availableFeats.filter(f => f.category === featFilter);

  // ── Step 1: Pick NFT ──
  if (step === "nft") {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
          New Game — Pick Your Hero
        </span>
        <div className="flex flex-wrap gap-3 justify-center">
          {ownedChars.map(c => (
            <button key={c.contractAddress} onClick={() => { setPickedNft(c); setStep("class"); }}
              className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg transition-all hover:scale-105"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", minWidth: 110 }}>
              {c.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/images?url=${encodeURIComponent(c.imageUrl)}`} alt={c.name}
                  className="w-12 h-12 rounded-full object-cover" style={{ border: "2px solid rgba(34,197,94,0.4)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="text-2xl">🛡️</span>
              )}
              <span className="text-xs font-black tracking-widest" style={{ color: "rgba(232,213,176,0.8)", fontSize: "0.55rem" }}>{c.name}</span>
              <div className="flex gap-1 flex-wrap justify-center" style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.4)" }}>
                <span>STR {c.stats.str.toFixed(0)}</span>
                <span>DEX {c.stats.dex.toFixed(0)}</span>
                <span>CON {c.stats.con.toFixed(0)}</span>
                <span>INT {c.stats.int.toFixed(0)}</span>
                <span>WIS {c.stats.wis.toFixed(0)}</span>
                <span>CHA {c.stats.cha.toFixed(0)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: Pick Class ──
  if (step === "class") {
    return (
      <div className="w-full flex flex-col items-center gap-4 max-w-2xl mx-auto">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
          Choose Class for {pickedNft?.name}
        </span>

        {/* Stat bar */}
        <div className="flex gap-2 flex-wrap justify-center px-3 py-2 rounded-lg w-full"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
          {(["str","dex","con","int","wis","cha"] as const).map(a => (
            <div key={a} className="text-center" style={{ minWidth: 40 }}>
              <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }}>{a.toUpperCase()}</div>
              <div className="font-bold" style={{ fontSize: "0.65rem", color: "rgba(232,213,176,0.8)" }}>
                {stats[a].toFixed(0)}
              </div>
              <div style={{ fontSize: "0.4rem", color: abilityMod(stats[a]) >= 0 ? "rgba(74,222,128,0.6)" : "rgba(220,38,38,0.6)" }}>
                {abilityMod(stats[a]) >= 0 ? "+" : ""}{abilityMod(stats[a])}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 w-full">
          {CLASSES.map(cls => {
            const isExpanded = expandedClass === cls.id;
            const classSkillNames = cls.classSkills.map(sid => SKILLS.find(s => s.id === sid)?.name ?? sid);
            return (
              <div key={cls.id} className="rounded-lg overflow-hidden"
                style={{ background: "rgba(34,197,94,0.04)", border: `1px solid ${isExpanded ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.15)"}` }}>
                <button onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5">
                  <span className="text-xl">{cls.emoji}</span>
                  <div className="flex-1">
                    <div className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(232,213,176,0.8)" }}>
                      {cls.name}
                    </div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.45)" }}>
                      {cls.hitDie} · Key: {cls.keyAbilities.map(a => a.toUpperCase()).join(", ")} · {cls.skillPoints}+INT skill pts/lv
                    </div>
                  </div>
                  <span style={{ fontSize: "0.6rem", color: "rgba(201,168,76,0.4)" }}>{isExpanded ? "▲" : "▼"}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 flex flex-col gap-2">
                    <div style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)", lineHeight: 1.5 }}>
                      {cls.description}
                    </div>

                    {/* Saves */}
                    <div className="flex gap-3" style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.4)" }}>
                      <span>Good saves: {cls.goodSaves.map(s => s.toUpperCase()).join(", ")}</span>
                      <span>BAB: {cls.bab}</span>
                    </div>

                    {/* Class features */}
                    <div>
                      <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                        Class Features
                      </div>
                      <div className="flex flex-col gap-1">
                        {cls.features.map(f => (
                          <div key={f.name} className="px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.2)", fontSize: "0.5rem" }}>
                            <span className="font-bold" style={{ color: "rgba(251,191,36,0.8)" }}>
                              {f.name} (Lv{f.level})
                            </span>
                            <span style={{ color: "rgba(232,213,176,0.5)" }}> — {f.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Class skills */}
                    <div>
                      <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                        Class Skills ({classSkillNames.length})
                      </div>
                      <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.4)", lineHeight: 1.6 }}>
                        {classSkillNames.join(", ")}
                      </div>
                    </div>

                    <button onClick={() => {
                        setPickedClass(cls);
                        setPickedFeats([]);
                        setSkillRanks({});
                        setPickedDomains([]);
                        setPickedSpecialization(null);
                        setPickedProhibited([]);
                        setPickedKnownSpells([]);
                        // Go to spells step if caster, otherwise skip to abilities
                        setStep(cls.spellcasting && cls.spellcasting.startsAt <= 1 ? "spells" : "abilities");
                      }}
                      className="mt-1 w-full px-3 py-2 rounded text-xs font-bold uppercase tracking-widest"
                      style={{ background: "rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.9)", border: "1px solid rgba(34,197,94,0.4)" }}>
                      Choose {cls.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => setStep("nft")} className="px-3 py-1 rounded text-xs"
          style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Back to hero pick
        </button>
      </div>
    );
  }

  // ── Step 2b: Spell Selection (casters only) ──
  if (step === "spells" && pickedClass?.spellcasting) {
    const sc = pickedClass.spellcasting;
    const isSpontaneous = sc.type === "spontaneous";
    const isBard = sc.casterClass === "bard";
    const isSorcerer = sc.casterClass === "sorcerer";
    const isWizard = sc.casterClass === "wizard";
    const isCleric = sc.casterClass === "cleric";

    // Spells known limits at level 1
    const knownTable = isSorcerer ? getSpellsKnown("sorcerer", 1) : isBard ? getSpellsKnown("bard", 1) : [];
    const cantripsNeeded = isSpontaneous ? (knownTable[0] ?? 0) : 0;
    const level1Needed = isSpontaneous ? (knownTable[1] ?? 0) : 0;

    // Available spells for this class
    const cantrips = getClassSpells(sc.casterClass, 0);
    const level1Spells = getClassSpells(sc.casterClass, 1);

    // Partition picked spells by level
    const pickedCantrips = pickedKnownSpells.filter(id => cantrips.some(s => s.id === id));
    const pickedLvl1 = pickedKnownSpells.filter(id => level1Spells.some(s => s.id === id));

    // Wizard prohibited schools filter
    const prohibitedSet = new Set(pickedProhibited);
    const wizCantrips = isWizard ? cantrips.filter(s => !prohibitedSet.has(s.school)) : cantrips;
    const wizLvl1 = isWizard ? level1Spells.filter(s => !prohibitedSet.has(s.school)) : level1Spells;

    // Wizard: starting spellbook = all cantrips + 3 + INT mod first-level spells
    const intMod2 = abilityMod(stats.int);
    const wizBookSlots = isWizard ? Math.max(1, 3 + intMod2) : 0;

    const canProceed = isCleric
      ? pickedDomains.length === 2
      : isWizard
        ? (pickedSpecialization === null || pickedProhibited.length === 2) && pickedKnownSpells.filter(id => wizLvl1.some(s => s.id === id)).length >= Math.min(wizBookSlots, wizLvl1.length)
        : isSpontaneous
          ? pickedCantrips.length >= cantripsNeeded && pickedLvl1.length >= level1Needed
          : true; // druid just prepares from full list

    return (
      <div className="w-full flex flex-col items-center gap-3">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(147,51,234,0.8)" }}>
          {pickedClass.emoji} {pickedClass.name} — Spellcasting
        </span>

        <div className="w-full max-w-lg flex flex-col gap-3 px-2" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {/* ── Cleric: Pick 2 Domains ── */}
          {isCleric && (
            <div>
              <div style={{ fontSize: "0.5rem", color: "rgba(147,51,234,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                Choose 2 Domains ({pickedDomains.length}/2)
              </div>
              <div className="grid grid-cols-2 gap-1">
                {DOMAINS.map(d => {
                  const picked = pickedDomains.includes(d.id);
                  return (
                    <button key={d.id} onClick={() => {
                      if (picked) setPickedDomains(prev => prev.filter(x => x !== d.id));
                      else if (pickedDomains.length < 2) setPickedDomains(prev => [...prev, d.id]);
                    }}
                      className="px-2 py-1 rounded text-left"
                      style={{
                        background: picked ? "rgba(147,51,234,0.2)" : "rgba(0,0,0,0.2)",
                        border: picked ? "1px solid rgba(147,51,234,0.5)" : "1px solid rgba(255,255,255,0.05)",
                        fontSize: "0.45rem",
                      }}>
                      <div className="font-bold" style={{ color: picked ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.7)" }}>
                        {d.name}
                      </div>
                      <div style={{ color: "rgba(232,213,176,0.4)", fontSize: "0.4rem" }}>{d.description}</div>
                      {picked && (
                        <div style={{ color: "rgba(147,51,234,0.6)", fontSize: "0.38rem", marginTop: 2 }}>
                          Power: {d.grantedPower.slice(0, 80)}...
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Wizard: Pick Specialization School ── */}
          {isWizard && (
            <div>
              <div style={{ fontSize: "0.5rem", color: "rgba(147,51,234,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                Specialization School (optional)
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <button onClick={() => { setPickedSpecialization(null); setPickedProhibited([]); }}
                  className="px-2 py-1 rounded"
                  style={{
                    background: !pickedSpecialization ? "rgba(147,51,234,0.2)" : "rgba(0,0,0,0.2)",
                    border: !pickedSpecialization ? "1px solid rgba(147,51,234,0.5)" : "1px solid rgba(255,255,255,0.05)",
                    fontSize: "0.45rem", color: !pickedSpecialization ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.5)",
                  }}>
                  Generalist
                </button>
                {SPECIALIZABLE_SCHOOLS.map(sch => (
                  <button key={sch} onClick={() => {
                    setPickedSpecialization(sch);
                    setPickedProhibited([]);
                    setPickedKnownSpells(prev => prev.filter(id => {
                      const sp = SPELLS.find(s => s.id === id);
                      return !sp || sp.school !== sch; // keep non-prohibited (we clear prohibited on school change)
                    }));
                  }}
                    className="px-2 py-1 rounded capitalize"
                    style={{
                      background: pickedSpecialization === sch ? "rgba(147,51,234,0.2)" : "rgba(0,0,0,0.2)",
                      border: pickedSpecialization === sch ? "1px solid rgba(147,51,234,0.5)" : "1px solid rgba(255,255,255,0.05)",
                      fontSize: "0.45rem", color: pickedSpecialization === sch ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.5)",
                    }}>
                    {sch}
                  </button>
                ))}
              </div>
              {pickedSpecialization && (
                <div>
                  <div style={{ fontSize: "0.45rem", color: "rgba(220,38,38,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                    Pick 2 Prohibited Schools ({pickedProhibited.length}/2)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SPECIALIZABLE_SCHOOLS.filter(s => s !== pickedSpecialization && s !== "divination").map(sch => (
                      <button key={sch} onClick={() => {
                        if (pickedProhibited.includes(sch)) setPickedProhibited(prev => prev.filter(x => x !== sch));
                        else if (pickedProhibited.length < 2) setPickedProhibited(prev => [...prev, sch]);
                      }}
                        className="px-2 py-1 rounded capitalize"
                        style={{
                          background: pickedProhibited.includes(sch) ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.2)",
                          border: pickedProhibited.includes(sch) ? "1px solid rgba(220,38,38,0.5)" : "1px solid rgba(255,255,255,0.05)",
                          fontSize: "0.45rem", color: pickedProhibited.includes(sch) ? "rgba(220,38,38,0.9)" : "rgba(232,213,176,0.5)",
                        }}>
                        {sch}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Wizard: pick starting spellbook 1st-level spells */}
              <div className="mt-2">
                <div style={{ fontSize: "0.5rem", color: "rgba(147,51,234,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                  Starting Spellbook — 1st Level ({pickedKnownSpells.filter(id => wizLvl1.some(s => s.id === id)).length}/{wizBookSlots})
                </div>
                <div style={{ fontSize: "0.38rem", color: "rgba(232,213,176,0.4)", marginBottom: 4 }}>
                  All cantrips are in your spellbook. Pick {wizBookSlots} first-level spells.
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {wizLvl1.map(sp => {
                    const picked = pickedKnownSpells.includes(sp.id);
                    const atLimit = pickedKnownSpells.filter(id => wizLvl1.some(s => s.id === id)).length >= wizBookSlots;
                    return (
                      <button key={sp.id} onClick={() => {
                        if (picked) setPickedKnownSpells(prev => prev.filter(x => x !== sp.id));
                        else if (!atLimit) setPickedKnownSpells(prev => [...prev, sp.id]);
                      }}
                        className="px-2 py-1 rounded text-left"
                        style={{
                          background: picked ? "rgba(147,51,234,0.15)" : "rgba(0,0,0,0.2)",
                          border: picked ? "1px solid rgba(147,51,234,0.4)" : "1px solid rgba(255,255,255,0.05)",
                          fontSize: "0.4rem", opacity: !picked && atLimit ? 0.4 : 1,
                        }}>
                        <span className="font-bold capitalize" style={{ color: picked ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.7)" }}>
                          {sp.name}
                        </span>
                        <span style={{ color: "rgba(232,213,176,0.3)", marginLeft: 4 }}>{sp.school}</span>
                        <div style={{ color: "rgba(232,213,176,0.3)", fontSize: "0.35rem" }}>{sp.description.slice(0, 60)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Sorcerer / Bard: Pick Known Spells ── */}
          {isSpontaneous && (
            <div>
              {/* Cantrips */}
              <div style={{ fontSize: "0.5rem", color: "rgba(147,51,234,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                Known Cantrips ({pickedCantrips.length}/{cantripsNeeded})
              </div>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {cantrips.map(sp => {
                  const picked = pickedKnownSpells.includes(sp.id);
                  const atLimit = pickedCantrips.length >= cantripsNeeded;
                  return (
                    <button key={sp.id} onClick={() => {
                      if (picked) setPickedKnownSpells(prev => prev.filter(x => x !== sp.id));
                      else if (!atLimit) setPickedKnownSpells(prev => [...prev, sp.id]);
                    }}
                      className="px-2 py-1 rounded text-left"
                      style={{
                        background: picked ? "rgba(147,51,234,0.15)" : "rgba(0,0,0,0.2)",
                        border: picked ? "1px solid rgba(147,51,234,0.4)" : "1px solid rgba(255,255,255,0.05)",
                        fontSize: "0.4rem", opacity: !picked && atLimit ? 0.4 : 1,
                      }}>
                      <span className="font-bold" style={{ color: picked ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.7)" }}>
                        {sp.name}
                      </span>
                      <span style={{ color: "rgba(232,213,176,0.3)", marginLeft: 4 }}>{sp.school}</span>
                    </button>
                  );
                })}
              </div>
              {/* 1st-level spells (sorcerer gets 2 at level 1, bard gets 0) */}
              {level1Needed > 0 && (
                <>
                  <div style={{ fontSize: "0.5rem", color: "rgba(147,51,234,0.7)", letterSpacing: "0.1em" }} className="font-bold uppercase mb-1">
                    Known 1st-Level Spells ({pickedLvl1.length}/{level1Needed})
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {level1Spells.map(sp => {
                      const picked = pickedKnownSpells.includes(sp.id);
                      const atLimit = pickedLvl1.length >= level1Needed;
                      return (
                        <button key={sp.id} onClick={() => {
                          if (picked) setPickedKnownSpells(prev => prev.filter(x => x !== sp.id));
                          else if (!atLimit) setPickedKnownSpells(prev => [...prev, sp.id]);
                        }}
                          className="px-2 py-1 rounded text-left"
                          style={{
                            background: picked ? "rgba(147,51,234,0.15)" : "rgba(0,0,0,0.2)",
                            border: picked ? "1px solid rgba(147,51,234,0.4)" : "1px solid rgba(255,255,255,0.05)",
                            fontSize: "0.4rem", opacity: !picked && atLimit ? 0.4 : 1,
                          }}>
                          <span className="font-bold" style={{ color: picked ? "rgba(147,51,234,0.9)" : "rgba(232,213,176,0.7)" }}>
                            {sp.name}
                          </span>
                          <span style={{ color: "rgba(232,213,176,0.3)", marginLeft: 4 }}>{sp.school}</span>
                          <div style={{ color: "rgba(232,213,176,0.3)", fontSize: "0.35rem" }}>{sp.description.slice(0, 60)}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Druid: Prepared caster, no creation choices needed ── */}
          {sc.casterClass === "druid" && (
            <div className="text-center" style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.5)" }}>
              As a druid, you prepare spells from the full druid list each day. No spell choices needed at creation.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep("class")} className="px-3 py-1.5 rounded text-xs"
            style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
            Back
          </button>
          <button onClick={() => setStep("abilities")}
            disabled={!canProceed}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
            style={{
              background: canProceed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
              color: canProceed ? "rgba(34,197,94,0.9)" : "rgba(255,255,255,0.2)",
              border: canProceed ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.05)",
            }}>
            Next: Abilities
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Pick Abilities (Feats) ──
  if (step === "abilities") {
    return (
      <div className="w-full flex flex-col items-center gap-4 max-w-2xl mx-auto">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
          Choose Abilities — {pickedClass?.emoji} {pickedClass?.name}
        </span>
        <div className="flex items-center gap-2" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
          <span>Slots: {pickedFeats.length}/{maxFeatSlots}</span>
          {pickedClass?.id === "fighter" && <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "rgba(251,191,36,0.7)", fontSize: "0.45rem" }}>
            +1 bonus combat ability
          </span>}
        </div>

        {/* Selected abilities */}
        {pickedFeats.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            {pickedFeats.map(fid => {
              const choice = parseFeatChoice(fid);
              const feat = FEATS.find(f => f.id === (choice?.baseFeatId ?? fid));
              if (!feat) return null;
              const choiceSkill = choice ? SKILLS.find(s => s.id === choice.choiceId) : null;
              return (
                <div key={fid} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}>
                  <div className="flex-1">
                    <div className="text-xs font-bold" style={{ color: "rgba(74,222,128,0.9)" }}>
                      {feat.name}{choiceSkill ? ` (${choiceSkill.name})` : ""}
                    </div>
                    <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.5)" }}>{feat.benefit}</div>
                  </div>
                  <button onClick={() => setPickedFeats(prev => prev.filter(id => id !== fid))}
                    className="px-2 py-1 rounded text-xs"
                    style={{ color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.2)" }}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "combat", "general", "magic", "skill"] as const).map(cat => (
            <button key={cat} onClick={() => setFeatFilter(cat)}
              className="px-2 py-1 rounded text-xs uppercase tracking-wider"
              style={{
                background: featFilter === cat ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.03)",
                color: featFilter === cat ? "rgba(201,168,76,0.9)" : "rgba(232,213,176,0.4)",
                border: `1px solid ${featFilter === cat ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.1)"}`,
                fontSize: "0.5rem",
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Available abilities list */}
        <div className="w-full flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
          {filteredFeats.length === 0 && (
            <div className="text-center py-4" style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.3)" }}>
              {pickedFeats.length >= maxFeatSlots ? "All ability slots filled" : "No abilities available with current filter"}
            </div>
          )}
          {filteredFeats.map(feat => {
            // canTakeMultiple feats (Skill Focus) are "picked" only by exact compound ID
            const alreadyPicked = feat.canTakeMultiple
              ? false // always available (different skill choices)
              : pickedFeats.includes(feat.id);
            const slotsLeft = maxFeatSlots - pickedFeats.length;
            // Fighter bonus slot must be combat
            const needsCombatForBonus = pickedClass?.id === "fighter" && pickedFeats.length === 1 && feat.category !== "combat";
            const disabled = alreadyPicked || slotsLeft <= 0 || needsCombatForBonus;
            return (
              <button key={feat.id} onClick={() => {
                if (disabled) return;
                const choice = featNeedsChoice(feat.id);
                if (choice === "skill") {
                  setPendingFeat(feat.id);
                } else {
                  setPickedFeats(prev => [...prev, feat.id]);
                }
              }}
                disabled={disabled}
                className="w-full text-left px-3 py-2 rounded-lg transition-all"
                style={{
                  background: alreadyPicked ? "rgba(74,222,128,0.06)" : "rgba(0,0,0,0.15)",
                  border: `1px solid ${alreadyPicked ? "rgba(74,222,128,0.2)" : "rgba(201,168,76,0.08)"}`,
                  opacity: disabled && !alreadyPicked ? 0.4 : 1,
                }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)" }}>{feat.name}</span>
                  <span className="px-1 rounded" style={{ fontSize: "0.4rem", background: "rgba(201,168,76,0.1)", color: "rgba(201,168,76,0.5)" }}>
                    {feat.category}
                  </span>
                </div>
                <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.5)", lineHeight: 1.4 }}>
                  {feat.benefit}
                </div>
                {feat.prereqs.feat && (
                  <div style={{ fontSize: "0.4rem", color: "rgba(251,191,36,0.5)" }}>
                    Requires: {FEATS.find(f => f.id === feat.prereqs.feat)?.name ?? feat.prereqs.feat}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep("class")} className="px-3 py-1.5 rounded text-xs"
            style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
            Back
          </button>
          <button onClick={() => setStep("skills")}
            disabled={pickedFeats.length < maxFeatSlots}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
            style={{
              background: pickedFeats.length >= maxFeatSlots ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
              color: pickedFeats.length >= maxFeatSlots ? "rgba(34,197,94,0.9)" : "rgba(232,213,176,0.3)",
              border: `1px solid ${pickedFeats.length >= maxFeatSlots ? "rgba(34,197,94,0.4)" : "rgba(201,168,76,0.1)"}`,
            }}>
            Next: Skills ({pickedFeats.length}/{maxFeatSlots})
          </button>
        </div>

        {/* ── Skill Focus: pick which skill ── */}
        {pendingFeat === "skill-focus" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full max-w-sm mx-4 rounded-xl p-4 flex flex-col gap-2"
              style={{ background: "rgba(20,20,30,0.98)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <div className="text-xs font-bold uppercase tracking-widest text-center"
                style={{ color: "rgba(201,168,76,0.9)" }}>
                Skill Focus — Choose a Skill
              </div>
              <div className="text-center" style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.5)" }}>
                +3 bonus on all checks with the selected skill
              </div>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                {SKILLS.filter(sk => {
                  // Don't allow picking the same skill twice
                  return !pickedFeats.some(f => f === `skill-focus:${sk.id}`);
                }).map(sk => (
                  <button key={sk.id} onClick={() => {
                    setPickedFeats(prev => [...prev, `skill-focus:${sk.id}`]);
                    setPendingFeat(null);
                  }}
                    className="w-full text-left px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(201,168,76,0.1)" }}>
                    <span className="text-xs font-bold" style={{ color: "rgba(232,213,176,0.8)" }}>{sk.name}</span>
                    <span className="ml-2" style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.5)" }}>
                      ({sk.ability.toUpperCase()})
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setPendingFeat(null)}
                className="px-3 py-1.5 rounded text-xs mt-1"
                style={{ color: "rgba(220,38,38,0.7)", border: "1px solid rgba(220,38,38,0.2)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step 4: Allocate Skills ──
  if (step === "skills") {
    const classSkillSet = new Set(pickedClass?.classSkills ?? []);
    // Sort: class skills first, then alphabetical
    const sortedSkills = [...SKILLS].sort((a, b) => {
      const aClass = classSkillSet.has(a.id) ? 0 : 1;
      const bClass = classSkillSet.has(b.id) ? 0 : 1;
      if (aClass !== bClass) return aClass - bClass;
      return a.name.localeCompare(b.name);
    });

    function adjustRank(skillId: string, delta: number) {
      setSkillRanks(prev => {
        const cur = prev[skillId] ?? 0;
        const isClassSkill = classSkillSet.has(skillId);
        const maxRank = isClassSkill ? 4 : 2; // level 1: class skills max 4 (level+3), cross-class max 2 ((level+3)/2)
        const next = Math.max(0, Math.min(maxRank, cur + delta));
        const cost = isClassSkill ? delta : delta * 2; // cross-class costs 2 points per rank
        if (delta > 0 && cost > remainingSkillPoints) return prev;
        const copy = { ...prev };
        if (next === 0) delete copy[skillId];
        else copy[skillId] = next;
        return copy;
      });
    }

    return (
      <div className="w-full flex flex-col items-center gap-4 max-w-2xl mx-auto">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
          Allocate Skills — {pickedClass?.emoji} {pickedClass?.name}
        </span>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg w-full"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.15)" }}>
          <span style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.6)" }}>
            Skill Points: <span className="font-bold" style={{ color: remainingSkillPoints > 0 ? "rgba(74,222,128,0.9)" : "rgba(232,213,176,0.8)" }}>
              {remainingSkillPoints}
            </span> / {totalSkillPoints}
          </span>
          <span style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.4)" }}>
            ({pickedClass?.skillPoints}+{intMod >= 0 ? "+" : ""}{intMod} INT) x4 at Lv1
          </span>
        </div>

        <div className="w-full flex flex-col gap-0.5 max-h-80 overflow-y-auto pr-1">
          {sortedSkills.map(skill => {
            const isClass = classSkillSet.has(skill.id);
            const ranks = skillRanks[skill.id] ?? 0;
            const maxRank = isClass ? 4 : 2;
            const mod = abilityMod(stats[skill.ability as keyof typeof stats] ?? 10);
            const total = ranks + mod;
            const canIncrease = ranks < maxRank && (isClass ? remainingSkillPoints >= 1 : remainingSkillPoints >= 2);

            return (
              <div key={skill.id} className="flex items-center gap-2 px-2 py-1 rounded"
                style={{
                  background: ranks > 0 ? "rgba(74,222,128,0.04)" : "rgba(0,0,0,0.1)",
                  border: `1px solid ${isClass ? "rgba(34,197,94,0.12)" : "rgba(201,168,76,0.05)"}`,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate" style={{ color: isClass ? "rgba(74,222,128,0.8)" : "rgba(232,213,176,0.6)" }}>
                      {skill.name}
                    </span>
                    {isClass && <span style={{ fontSize: "0.35rem", color: "rgba(74,222,128,0.5)" }}>CLASS</span>}
                    {!isClass && <span style={{ fontSize: "0.35rem", color: "rgba(201,168,76,0.3)" }}>x2 cost</span>}
                  </div>
                  <div style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.35)" }}>
                    {skill.ability.toUpperCase()} ({mod >= 0 ? "+" : ""}{mod}) — {skill.description}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => adjustRank(skill.id, -1)} disabled={ranks === 0}
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: "rgba(220,38,38,0.1)", color: "rgba(220,38,38,0.6)", opacity: ranks === 0 ? 0.3 : 1, fontSize: "0.6rem" }}>
                    -
                  </button>
                  <span className="w-6 text-center font-bold" style={{ fontSize: "0.6rem", color: ranks > 0 ? "rgba(74,222,128,0.9)" : "rgba(232,213,176,0.3)" }}>
                    {ranks}
                  </span>
                  <button onClick={() => adjustRank(skill.id, 1)} disabled={!canIncrease}
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: "rgba(74,222,128,0.1)", color: "rgba(74,222,128,0.6)", opacity: !canIncrease ? 0.3 : 1, fontSize: "0.6rem" }}>
                    +
                  </button>
                  <span className="w-8 text-right" style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.4)" }}>
                    ={total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep("abilities")} className="px-3 py-1.5 rounded text-xs"
            style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
            Back
          </button>
          <button onClick={() => setStep("confirm")}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.9)", border: "1px solid rgba(34,197,94,0.4)" }}>
            Review Character
          </button>
        </div>
      </div>
    );
  }

  // ── Step 5: Confirm ──
  if (step !== "faction") return (
    <div className="w-full flex flex-col items-center gap-4 max-w-lg mx-auto">
      <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
        Confirm Your Character
      </span>

      <div className="w-full rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.2)" }}>

        {/* Hero + Class */}
        <div className="flex items-center gap-3">
          {pickedNft?.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/images?url=${encodeURIComponent(pickedNft.imageUrl)}`} alt={pickedNft.name}
              className="w-14 h-14 rounded-full object-cover" style={{ border: "2px solid rgba(34,197,94,0.4)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div>
            <div className="text-sm font-black" style={{ color: "rgba(232,213,176,0.9)" }}>{pickedNft?.name}</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(34,197,94,0.8)" }}>
              {pickedClass?.emoji} {pickedClass?.name} · {pickedClass?.hitDie}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 flex-wrap" style={{ fontSize: "0.5rem" }}>
          {(["str","dex","con","int","wis","cha"] as const).map(a => (
            <span key={a} style={{ color: "rgba(232,213,176,0.6)" }}>
              {a.toUpperCase()} {stats[a].toFixed(0)} ({abilityMod(stats[a]) >= 0 ? "+" : ""}{abilityMod(stats[a])})
            </span>
          ))}
        </div>

        {/* Abilities (feats) */}
        <div>
          <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }} className="font-bold uppercase mb-1">Abilities</div>
          <div className="flex flex-col gap-0.5">
            {pickedFeats.map(fid => {
              const choice = parseFeatChoice(fid);
              const feat = FEATS.find(f => f.id === (choice?.baseFeatId ?? fid));
              const choiceSkill = choice ? SKILLS.find(s => s.id === choice.choiceId) : null;
              return feat ? (
                <div key={fid} style={{ fontSize: "0.5rem", color: "rgba(251,191,36,0.7)" }}>
                  {feat.name}{choiceSkill ? ` (${choiceSkill.name})` : ""} — <span style={{ color: "rgba(232,213,176,0.5)" }}>{feat.benefit}</span>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Skills with ranks */}
        <div>
          <div style={{ fontSize: "0.45rem", color: "rgba(201,168,76,0.5)" }} className="font-bold uppercase mb-1">
            Skills ({remainingSkillPoints > 0 ? `${remainingSkillPoints} points unspent` : "all points spent"})
          </div>
          <div className="flex flex-col gap-0.5">
            {Object.entries(skillRanks).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([sid, ranks]) => {
              const skill = SKILLS.find(s => s.id === sid);
              const mod = abilityMod(stats[skill?.ability as keyof typeof stats] ?? 10);
              return (
                <div key={sid} style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.6)" }}>
                  {skill?.name ?? sid}: {ranks} ranks + {mod >= 0 ? "+" : ""}{mod} = <span className="font-bold" style={{ color: "rgba(74,222,128,0.8)" }}>{ranks + mod}</span>
                </div>
              );
            })}
            {Object.keys(skillRanks).length === 0 && (
              <div style={{ fontSize: "0.45rem", color: "rgba(232,213,176,0.3)" }}>No skill ranks allocated</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setStep("skills")} className="px-3 py-1.5 rounded text-xs"
          style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Back
        </button>
        <button onClick={() => setStep("faction")}
          className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest"
          style={{ background: "rgba(34,197,94,0.2)", color: "rgba(34,197,94,0.95)", border: "1px solid rgba(34,197,94,0.5)" }}>
          Next
        </button>
      </div>
    </div>
  );

  // ── Step 6: Name Your Faction ──
  if (step === "faction") {
    return (
      <div className="w-full flex flex-col items-center gap-4 max-w-lg mx-auto">
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(34,197,94,0.8)" }}>
          Name Your Faction
        </span>
        <div className="w-full rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,168,76,0.2)" }}>
          <div style={{ fontSize: "0.5rem", color: "rgba(232,213,176,0.5)", lineHeight: 1.5 }}>
            Your faction is your name on the island. All parties you send into the world carry this banner.
            Temples, guilds, and townsfolk will know you by it. Choose wisely — reputation follows the name.
          </div>
          <input
            type="text"
            value={factionName}
            onChange={e => setFactionName(e.target.value.slice(0, 40))}
            placeholder="e.g. The Iron Wolves, Stormwatch Company, Order of the Silver Flame"
            className="w-full px-3 py-2 rounded text-sm"
            style={{
              background: "rgba(0,0,0,0.4)", color: "rgba(232,213,176,0.9)",
              border: "1px solid rgba(201,168,76,0.3)", outline: "none",
              fontSize: "0.65rem",
            }}
            autoFocus
          />
          <div style={{ fontSize: "0.4rem", color: "rgba(201,168,76,0.3)", textAlign: "right" }}>
            {factionName.length}/40
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep("skills")} className="px-3 py-1.5 rounded text-xs"
            style={{ color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
            Back
          </button>
          <button onClick={() => {
              if (!pickedNft || !pickedClass) return;
              const sc = pickedClass.spellcasting;
              const spellConfig: SpellConfig | undefined = sc ? {
                known_spells: pickedKnownSpells.length > 0 ? pickedKnownSpells : undefined,
                spellbook: sc.casterClass === "wizard"
                  ? [...getClassSpells("wizard", 0).map(s => s.id), ...pickedKnownSpells.filter(id => getClassSpells("wizard", 1).some(s => s.id === id))]
                  : undefined,
                domains: pickedDomains.length === 2 ? [pickedDomains[0], pickedDomains[1]] as [string, string] : null,
                school_specialization: pickedSpecialization ?? null,
                prohibited_schools: pickedProhibited,
              } : undefined;
              onStart(pickedNft, pickedClass.id, skillRanks, pickedFeats, spellConfig, factionName.trim() || undefined);
            }}
            disabled={factionName.trim().length === 0}
            className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest"
            style={{
              background: "rgba(34,197,94,0.2)", color: "rgba(34,197,94,0.95)",
              border: "1px solid rgba(34,197,94,0.5)",
              opacity: factionName.trim().length === 0 ? 0.4 : 1,
            }}>
            Begin Adventure
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { characters, assetTotals, tokenBreakdown, loading, error, refreshStats } = useNftStats();
  const [pieCategory, setPieCategory] = useState<"traditional" | "game" | "impact" | null>(null);
  // Chain check only needed for power-up payments, not for viewing heroes
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  // Navigation
  const [view, setView] = useState<"menu" | "heroes" | "army" | "battle" | "worldMap" | "adventure" | "inventory" | "levelUp" | "powerUp" | "tokenPowers">("menu");
  const [lastBattleRewards, setLastBattleRewards] = useState<{ xp: number; goldCp: number; loot: { name: string }[]; levelsGained: number } | null>(null);
  const [levelUpQueue, setLevelUpQueue] = useState<import("@/hooks/useCharacterSave").LevelUpEntry[]>([]);
  const [questEncounter, setQuestEncounter] = useState<QuestEncounter | null>(null);
  const [prevHex, setPrevHex] = useState<{ q: number; r: number } | null>(null);
  const [mailCollected, setMailCollected] = useState<{ coins: { gp: number; sp: number; cp: number }; messages: string[] } | null>(null);

  // Character save system
  const { save, hasCharacter, updateSave, createCharacter, recordBattle } = useCharacterSave();
  const { data: walletClient } = useWalletClient();
  // Find the player's original NFT from their save
  const playerCharacter = save
    ? characters.find(c => c.contractAddress.toLowerCase() === save.nft_address.toLowerCase()) ?? null
    : null;
  // Active party's leader NFT (changes when switching parties)
  const activePartyLeaderAddr = save?.parties?.[save.active_party_index ?? 0]?.heroes[0]?.nft_address;
  const activeCharacter = activePartyLeaderAddr
    ? characters.find(c => c.contractAddress.toLowerCase() === activePartyLeaderAddr) ?? playerCharacter
    : playerCharacter;

  // Migrate old saves: give each party its own coins/food/inventory/equipment/hp
  if (save?.parties && !save.parties.some(p => p.coins !== undefined)) {
    const migrated = migratePartySupplies(save.parties, save.active_party_index ?? 0, {
      coins: save.coins, food: save.food, inventory: save.inventory, equipment: save.equipment,
      current_hp: save.current_hp, max_hp: save.max_hp,
    });
    updateSave({ parties: migrated });
  }
  // Rename legacy "Main Party" → "Party 1"
  if (save?.parties?.[0]?.name === "Main Party") {
    updateSave({ parties: save.parties.map((p, i) => i === 0 ? { ...p, name: "Party 1" } : p) });
  }
  // Migrate: move top-level progression into hero.progression + add follower xp/loyalty
  if (save && !save.party?.heroes?.[0]?.progression) {
    const progPatch = migrateEntityProgression(save);
    if (progPatch) updateSave(progPatch);
  }

  // ── Daily: spoilage check + follower upkeep ──
  const lastUpkeepDay = useRef<number>(-1);
  const currentDay = save ? Math.floor((save.hour ?? 0) / 24) + 1 : 0;
  if (save && currentDay > 0 && currentDay !== lastUpkeepDay.current) {
    lastUpkeepDay.current = currentDay;
    const gameHour = save.hour ?? 0;
    const dayUpdates: Record<string, unknown> = {};

    // Spoilage: fresh food past its spoilHour turns into spoiled meat or loam
    const spoiledFresh = save.inventory.filter(it => it.spoilHour !== undefined && it.id.startsWith("fresh_") && gameHour >= it.spoilHour);
    // Spoiled meat that's been sitting 2+ days turns to loam (useful on farms)
    const spoiledMeatToLoam = save.inventory.filter(it => it.id === "spoiled_meat" && it.spoilHour !== undefined && gameHour >= it.spoilHour);
    if (spoiledFresh.length > 0 || spoiledMeatToLoam.length > 0) {
      let inv = save.inventory.filter(it => {
        if (it.id.startsWith("fresh_") && it.spoilHour !== undefined && gameHour >= it.spoilHour) return false;
        if (it.id === "spoiled_meat" && it.spoilHour !== undefined && gameHour >= it.spoilHour) return false;
        return true;
      });
      const PRODUCE_IDS = new Set(["fresh_berries", "fresh_tubers", "fresh_mushrooms", "fresh_seaweed", "fresh_herbs"]);
      // Fresh meat → spoiled meat (same weight as source), spoils to loam in 2 more days
      const meatItems = spoiledFresh.filter(it => !PRODUCE_IDS.has(it.id));
      const newSpoiledMeat = meatItems.reduce((s, it) => s + it.qty, 0);
      if (newSpoiledMeat > 0) {
        const totalMeatWeight = meatItems.reduce((s, it) => s + (it.itemWeight ?? getItemWeight(it.id)) * it.qty, 0);
        const spoiledUnitWeight = totalMeatWeight / newSpoiledMeat;
        inv.push({ id: "spoiled_meat", name: "Spoiled Meat", qty: newSpoiledMeat, spoilHour: gameHour + 48, itemWeight: spoiledUnitWeight });
      }
      // Fresh produce → straight to loam (half weight)
      const produceItems = spoiledFresh.filter(it => PRODUCE_IDS.has(it.id));
      const produceLoamCount = produceItems.reduce((s, it) => s + it.qty, 0);
      const produceLoamWeight = produceItems.reduce((s, it) => s + (it.itemWeight ?? getItemWeight(it.id)) * it.qty, 0) / 2;
      // Old spoiled meat → loam (half weight)
      const meatToLoamCount = spoiledMeatToLoam.reduce((s, it) => s + it.qty, 0);
      const meatToLoamWeight = spoiledMeatToLoam.reduce((s, it) => s + (it.itemWeight ?? getItemWeight(it.id)) * it.qty, 0) / 2;
      const totalLoam = produceLoamCount + meatToLoamCount;
      const totalLoamWeight = produceLoamWeight + meatToLoamWeight;
      const loamUnitWeight = totalLoam > 0 ? totalLoamWeight / totalLoam : 1;
      if (totalLoam > 0) {
        const existingLoam = inv.find(it => it.id === "loam");
        if (existingLoam) {
          // Weighted average of old and new loam weights
          const oldW = (existingLoam.itemWeight ?? getItemWeight("loam")) * existingLoam.qty;
          const mergedUnit = (oldW + loamUnitWeight * totalLoam) / (existingLoam.qty + totalLoam);
          inv = inv.map(it => it.id === "loam" ? { ...it, qty: it.qty + totalLoam, itemWeight: mergedUnit } : it);
        } else {
          inv.push({ id: "loam", name: "Loam", qty: totalLoam, itemWeight: loamUnitWeight });
        }
      }
      dayUpdates.inventory = inv;
    }

    // Follower upkeep: pay wages, consume food, feast bonus
    const hasFollowers = save.party.heroes.some(h => h.followers.some(f => f.alive));
    if (hasFollowers) {
      const currentInv = (dayUpdates.inventory as typeof save.inventory) ?? save.inventory;
      // Fresh food feast requires a Camp Cook follower (or character with craft_cooking)
      const hasCook = save.party.heroes.some(h => h.followers.some(f => f.alive && f.templateId === "merc_cook"))
        || (save.skill_ranks?.["craft_cooking"] ?? 0) > 0;
      // Build food inventory list for feast check (fresh food only counts if party has a cook)
      const foodInv = currentInv
        .filter(it => it.id.startsWith("food_") || (hasCook && it.id.startsWith("fresh_")))
        .map(it => {
          const info = getItemInfo(it.id);
          return { id: it.id, name: it.name, priceCp: info?.valueCp ?? 0 };
        });
      const result = processDailyUpkeep(save.party, totalCp(save.coins), save.food, foodInv);
      dayUpdates.party = result.party;
      dayUpdates.coins = cpToCoins(result.goldRemaining);
      dayUpdates.food = result.foodRemaining;
      // Remove consumed feast item from inventory
      if (result.consumedFoodItemId) {
        let removed = false;
        const inv = (dayUpdates.inventory as typeof save.inventory) ?? save.inventory;
        dayUpdates.inventory = inv.map(it => {
          if (!removed && it.id === result.consumedFoodItemId) {
            removed = true;
            return it.qty > 1 ? { ...it, qty: it.qty - 1 } : null;
          }
          return it;
        }).filter(Boolean);
      }
    }

    // Noble Birth boon: daily coin income accumulates at Kardov's Gate mail
    const leaderChar = characters.find(c => c.contractAddress.toLowerCase() === save.nft_address?.toLowerCase());
    if (leaderChar?.boons?.length) {
      const nobleBoon = leaderChar.boons.filter(b => b.category === "mft");
      if (nobleBoon.length > 0) {
        const highest = nobleBoon[nobleBoon.length - 1];
        const gpMatch = highest.effect.match(/(\d+)gp per day/);
        const spMatch = highest.effect.match(/(\d+)sp per day/);
        const cpMatch = highest.effect.match(/(\d+)cp per day/);
        let incomeCp = 0;
        if (gpMatch) incomeCp = parseInt(gpMatch[1]) * 100;
        else if (spMatch) incomeCp = parseInt(spMatch[1]) * 10;
        else if (cpMatch) incomeCp = parseInt(cpMatch[1]);
        if (incomeCp > 0) {
          const mail = (dayUpdates.gate_mail as typeof save.gate_mail) ?? save.gate_mail ?? { coins: { gp: 0, sp: 0, cp: 0 }, messages: [] };
          const titleName = highest.name;
          dayUpdates.gate_mail = {
            coins: addCp(mail.coins, incomeCp),
            messages: [...mail.messages.slice(-19), `Day ${currentDay}: ${formatCoins(cpToCoins(incomeCp))} tribute from ${titleName} estates`],
          };
        }
      }
    }

    if (Object.keys(dayUpdates).length > 0) updateSave(dayUpdates);
  }

  // Cycling background images
  const BG_IMAGES = ["/bg-plains-1.webp", "/bg-plains-2.webp", "/bg-plains-3.webp", "/bg-plains-4.webp", "/bg-desert-1.webp", "/bg-desert-2.webp", "/bg-desert-3.webp", "/bg-desert-4.webp"];
  const [bgIndex, setBgIndex] = useState(0);
  const cycleView = (v: typeof view) => { setBgIndex(i => (i + 1) % BG_IMAGES.length); setView(v); };


  const totalStats = (c: NftCharacter) => {
    const s = c.stats;
    return s.str + s.dex + s.con + s.int + s.wis + s.cha;
  };
  const filtered = search.trim()
    ? characters.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.contractAddress.toLowerCase().includes(search.toLowerCase()))
    : characters;
  const sorted = [...filtered].sort((a, b) => {
    const ownDiff = (b.owned ? 1 : 0) - (a.owned ? 1 : 0);
    if (ownDiff !== 0) return ownDiff;
    return totalStats(a) - totalStats(b);
  });
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageChars = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const maxStats = useMemo(() => ({
    str: Math.max(...characters.map(c => c.stats.str), 1),
    dex: Math.max(...characters.map(c => c.stats.dex), 1),
    con: Math.max(...characters.map(c => c.stats.con), 1),
    int: Math.max(...characters.map(c => c.stats.int), 1),
    wis: Math.max(...characters.map(c => c.stats.wis), 1),
    cha: Math.max(...characters.map(c => c.stats.cha), 1),
  }), [characters]);


  // Sub-page wrapper with consistent header
  const subPage = (subtitle: string, content: React.ReactNode) => (
    <main className="flex flex-col min-h-screen fantasy-bg relative" style={{ isolation: 'isolate' }}>
      <div className="fixed inset-0" style={{
        backgroundImage: `url(${BG_IMAGES[bgIndex]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.12,
        filter: 'blur(2px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />
      <header className="header-fantasy flex items-center justify-between px-6 py-4 relative" style={{ zIndex: 1 }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => cycleView("menu")}>
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>{subtitle}</p>
          </div>
        </div>
        <Wallet>
          <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
          <WalletDropdown>{isConnected && <Address />}<WalletDropdownDisconnect /></WalletDropdown>
        </Wallet>
      </header>
      <div className="flex-1 px-4 py-6 relative" style={{ zIndex: 1 }}>{content}</div>
    </main>
  );

  if (view === "levelUp" && save && levelUpQueue.length > 0) {
    const entry = levelUpQueue[0];
    return subPage(`Level Up: ${entry.entityName}`, <LevelUpFlow
      save={save} character={playerCharacter} fromLevel={entry.fromLevel} toLevel={entry.toLevel} entry={entry}
      onComplete={(patch) => {
        updateSave(patch);
        const remaining = levelUpQueue.slice(1);
        setLevelUpQueue(remaining);
        if (remaining.length === 0) cycleView("worldMap");
      }}
    />);
  }
  const leaderProg = save ? getLeaderProgression(save) : undefined;
  if (view === "battle") return subPage(questEncounter ? questEncounter.questName : "Battle", <HexBattle characters={characters}
    questEncounter={questEncounter ?? undefined}
    playerFeats={leaderProg?.feats ?? save?.feats}
    playerWeapon={leaderProg?.equipment?.weapon ?? save?.equipment?.weapon}
    playerArmorEffect={getItemById(leaderProg?.equipment?.armor ?? save?.equipment?.armor ?? "")?.effect}
    playerShieldEffect={getItemById(leaderProg?.equipment?.shield ?? save?.equipment?.shield ?? "")?.effect}
    playerKnownSpells={leaderProg?.known_spells ?? save?.known_spells}
    playerPreparedSpells={leaderProg?.prepared_spells ?? save?.prepared_spells}
    playerSpellSlotsUsed={leaderProg?.spell_slots_used ?? save?.spell_slots_used}
    playerLevel={leaderProg?.total_level ?? save?.level}
    playerCurrentHp={leaderProg ? (leaderProg.current_hp < leaderProg.max_hp ? leaderProg.current_hp : undefined) : (save?.current_hp !== undefined && save.current_hp < save.max_hp ? save.current_hp : undefined)}
    playerFollowers={save?.party?.heroes?.flatMap(h => h.followers) ?? []}
    playerProgression={leaderProg}
    extraHeroes={save?.party?.heroes?.filter(h => !h.isLeader).map(h => {
      const hChar = characters?.find(c => c.contractAddress.toLowerCase() === h.nft_address);
      if (!hChar) return null;
      const hClass = h.progression ? getClassById(h.progression.class_levels[0]?.class_id ?? save?.class_id) : getClassById(save?.class_id);
      return {
        char: hChar,
        charClass: hClass ?? undefined,
        featIds: h.progression?.feats ?? [],
        weaponName: h.progression?.equipment?.weapon,
        currentHp: h.progression?.current_hp,
        progression: h.progression,
      };
    }).filter(Boolean) as { char: import("@/hooks/useNftStats").NftCharacter; charClass?: import("@/lib/classes").CharacterClass; featIds?: string[]; weaponName?: string; currentHp?: number; progression?: EntityProgression }[]}
    playerUseRopeBonus={(leaderProg?.skill_ranks?.["useRope"] ?? save?.skill_ranks?.["useRope"] ?? 0) + Math.floor(((activeCharacter?.stats?.dex ?? 10) - 10) / 2)}
    onExit={() => {
      setQuestEncounter(null);
      if (levelUpQueue.length > 0) {
        setLastBattleRewards(null);
        setView("levelUp");
      } else {
        setLastBattleRewards(null);
        cycleView(hasCharacter ? "worldMap" : "menu");
      }
    }}
    onBattleEnd={async (outcome, difficulty, enemies, rounds, spellSlotsUsed, remainingHp) => {
      const result = await recordBattle({ difficulty, enemies, outcome, rounds });
      const rewards = result ? { xp: result.rewards.xp, goldCp: result.rewards.goldCp, loot: (result.rewards.loot ?? []).map((l: { name: string }) => ({ name: l.name })), levelsGained: result.levelsGained, newLevel: (save?.level ?? 1) + result.levelsGained } : null;
      if (rewards) setLastBattleRewards(rewards);
      // Populate level-up queue from battle results
      if (result?.levelUpQueue && result.levelUpQueue.length > 0) {
        setLevelUpQueue(prev => [...prev, ...result.levelUpQueue]);
      }
      // Persist spell slots and remaining HP after battle (no auto-heal)
      const battleUpdates: Record<string, unknown> = {};
      if (spellSlotsUsed && spellSlotsUsed.length > 0) {
        battleUpdates.spell_slots_used = spellSlotsUsed;
      }
      if (remainingHp !== undefined && save) {
        battleUpdates.current_hp = Math.max(0, Math.round(remainingHp));
      }
      if (Object.keys(battleUpdates).length > 0) updateSave(battleUpdates);
      // Retreat: move back to previous hex, mark hex as territorial threat for 10 days
      if (outcome === "retreat" && save) {
        const retreatUpdates: Record<string, unknown> = {};
        if (prevHex) {
          retreatUpdates.map_hex = prevHex;
          if (save.parties?.[save.active_party_index ?? 0]) {
            const idx = save.active_party_index ?? 0;
            retreatUpdates.parties = save.parties.map((p, i) => i === idx ? { ...p, map_hex: prevHex } : p);
          }
        }
        // Save territorial threat on the hex for 10 in-game days
        const currentDay = Math.floor((save.hour ?? 0) / 24) + 1;
        const threatHex = save.map_hex;
        const threatKey = `${threatHex.q},${threatHex.r}`;
        const encounterKey = questEncounter?.questId ?? enemies.join(",");
        retreatUpdates.hex_threats = {
          ...(save.hex_threats ?? {}),
          [threatKey]: { expires_day: currentDay + 10, encounter_key: encounterKey },
        };
        updateSave(retreatUpdates);
        setPrevHex(null);
        return null;
      }
      // Clear territorial hex threat on victory
      if (outcome === "victory" && save) {
        const hexKey = `${save.map_hex.q},${save.map_hex.r}`;
        if ((save.hex_threats ?? {})[hexKey]) {
          const cleaned = { ...(save.hex_threats ?? {}) };
          delete cleaned[hexKey];
          updateSave({ hex_threats: cleaned });
        }
      }
      // Quest completion: set cooldowns (repeatable) or flags (one-time rumors)
      if (outcome === "victory" && questEncounter && save) {
        const qid = questEncounter.questId;
        const questUpdates: Record<string, unknown> = {};
        // Repeatable tavern quests — cooldown in minutes
        // Real-time cooldowns (minutes) for tavern quests
        const cooldowns: Record<string, number> = {
          tavern_rats: 60, tavern_pests: 120, tavern_thugs: 180, tavern_undead: 360, tavern_wolves: 240,
        };
        // In-game-day cooldowns for world quests
        const dayCooldowns: Record<string, number> = {
          goblin_hills_raid: 60,
        };
        if (cooldowns[qid]) {
          questUpdates.quest_cooldowns = setQuestCooldown(save.quest_cooldowns ?? {}, qid, cooldowns[qid]);
        }
        if (dayCooldowns[qid]) {
          const currentDay = Math.floor((save.hour ?? 0) / 24) + 1;
          const base = (questUpdates.quest_cooldowns as Record<string, string> | undefined) ?? save.quest_cooldowns ?? {};
          questUpdates.quest_cooldowns = setQuestCooldownDays(base, qid, currentDay, dayCooldowns[qid]);
        }
        // One-time rumor quests — set flag so they don't appear again
        const rumorFlags: Record<string, string> = {
          rumor_smugglers: "heard_smuggler_rumor", rumor_haunted_manor: "heard_manor_rumor",
          rumor_cultists: "heard_cultist_rumor", rumor_bounty: "heard_bounty_rumor",
          rumor_lost_caravan: "heard_caravan_rumor",
        };
        if (rumorFlags[qid]) {
          questUpdates.quest_flags = { ...(save.quest_flags ?? {}), [rumorFlags[qid]]: true };
        }
        if (Object.keys(questUpdates).length > 0) updateSave(questUpdates);
      }
      return rewards;
    }}
    onDefeatChoice={async (choice) => {
      if (!save) return;
      if (choice === "rescue") {
        // Pay 0.0005 ETH to teleport back to Kardov's Gate with everything intact
        if (!walletClient) { alert("Connect wallet to pay for rescue"); return; }
        try {
          await walletClient.sendTransaction({
            to: "0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2",
            value: parseEther("0.0005"),
          });
          // Teleport active party to Kardov's Gate, restore full HP
          const rescueUpdates: Record<string, unknown> = {
            map_region: "kardovs-gate",
            map_node: "tavern",
            map_hex: { q: 36, r: 32 },
            current_hp: save.max_hp,
          };
          if (save.parties) {
            const idx = save.active_party_index ?? 0;
            rescueUpdates.parties = save.parties.map((p, i) =>
              i === idx ? { ...p, map_hex: { q: 36, r: 32 }, map_region: "kardovs-gate", map_node: "tavern", auto_action: null } : p
            );
          }
          updateSave(rescueUpdates);
        } catch (e: any) {
          alert("Transaction failed: " + (e.shortMessage ?? e.message));
          return;
        }
      } else if (save.parties && save.parties.length > 1) {
        // Party death with other parties alive — remove this party, switch to next
        const idx = save.active_party_index ?? 0;
        const remaining = save.parties.filter((_, i) => i !== idx);
        const nextIdx = Math.min(idx, remaining.length - 1);
        const nextParty = remaining[nextIdx];
        updateSave({
          parties: remaining,
          active_party_index: nextIdx,
          // Load the surviving party's supplies and position
          coins: nextParty.coins ?? { gp: 0, sp: 0, cp: 0 },
          food: nextParty.food ?? 0,
          inventory: nextParty.inventory ?? [],
          equipment: nextParty.equipment ?? {},
          map_hex: nextParty.map_hex,
          map_region: nextParty.map_region,
          map_node: nextParty.map_node,
          current_hp: nextParty.current_hp ?? save.max_hp,
          max_hp: nextParty.max_hp ?? save.max_hp,
        });
      } else {
        // Last party — full death reset
        updateSave({
          level: 1,
          xp: 0,
          skill_ranks: {},
          feats: [],
          known_spells: [],
          prepared_spells: [],
          spellbook: [],
          spell_slots_used: [],
          domains: null,
          school_specialization: null,
          prohibited_schools: [],
          inventory: [],
          equipment: {},
          coins: { gp: 0, sp: 0, cp: 0 },
          current_hp: 12,
          max_hp: 12,
          food: 9,
          map_region: "kardovs-gate",
          map_node: "tavern",
          map_hex: { q: 36, r: 32 },
          quest_flags: {},
          quest_cooldowns: {},
          faction_rep: {},
        });
      }
      setQuestEncounter(null);
      cycleView("worldMap");
    }}
  />);
  // ── Adventure: New Game / Load Game ──────────────────────────────────────
  if (view === "adventure") {
    const ownedChars = characters.filter(c => c.owned && c.stats.con > 0);
    return subPage("Adventure", (
      <div className="flex flex-col items-center gap-6 max-w-lg mx-auto">
        <h2 className="text-xl font-black tracking-widest uppercase"
          style={{ color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          Adventure
        </h2>

        {/* Load Game — if save exists */}
        {hasCharacter && save && (
          <button onClick={() => cycleView("worldMap")}
            className="w-full flex flex-col items-center gap-3 px-6 py-6 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: "rgba(96,165,250,0.1)", border: "2px solid rgba(96,165,250,0.3)" }}>
            <span className="text-3xl">📜</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: "rgba(96,165,250,0.9)" }}>Continue Adventure</span>
            <div className="flex gap-4 text-xs" style={{ color: "rgba(96,165,250,0.6)" }}>
              <span>Lv {save.level}</span>
              <span>{save.xp} XP</span>
              <span>Day {Math.floor((save.hour ?? 0) / 24) + 1}</span>
              <span>{formatCoins(save.coins)}</span>
              <span>{save.battles_won}W / {save.battles_lost}L</span>
            </div>
            {playerCharacter && (
              <span style={{ fontSize: "0.55rem", color: "rgba(232,213,176,0.5)" }}>
                {playerCharacter.name} · {save.class_id}
              </span>
            )}
          </button>
        )}

        {/* New Game */}
        {!isConnected ? (
          <div className="w-full flex flex-col items-center gap-3 px-6 py-6 rounded-2xl"
            style={{ background: "rgba(201,168,76,0.06)", border: "2px solid rgba(201,168,76,0.15)" }}>
            <span className="text-sm" style={{ color: "rgba(201,168,76,0.6)" }}>Connect wallet to start a new adventure</span>
            <Wallet>
              <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
              <WalletDropdown><WalletDropdownDisconnect /></WalletDropdown>
            </Wallet>
          </div>
        ) : ownedChars.length === 0 ? (
          <div className="w-full flex flex-col items-center gap-3 px-6 py-6 rounded-2xl"
            style={{ background: "rgba(201,168,76,0.06)", border: "2px solid rgba(201,168,76,0.15)" }}>
            <span className="text-sm" style={{ color: "rgba(201,168,76,0.6)" }}>You need to own at least one hero NFT to play</span>
            <a href="https://marketplace.memefortrees.com" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest inline-block"
              style={{ background: "rgba(251,191,36,0.2)", color: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.4)" }}>
              Visit Marketplace
            </a>
          </div>
        ) : (
          <NewGameFlow
            ownedChars={ownedChars}
            onStart={async (nft, classId, skillRanks, feats, spellConfig, factionName) => {
              await createCharacter(nft.contractAddress, classId, skillRanks, feats, spellConfig, factionName);
              cycleView("worldMap");
            }}
          />
        )}

        <button onClick={() => cycleView("menu")} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)", border: "1px solid rgba(201,168,76,0.15)" }}>
          Back
        </button>
      </div>
    ));
  }

  if (view === "inventory" && save && playerCharacter) {
    // Calculate follower carry bonuses
    const followerBonus = save.party.heroes.flatMap(h => h.followers)
      .filter(f => f.alive)
      .reduce((sum, f) => {
        if (f.abilities.includes("carry_bonus_50")) return sum + 50;
        if (f.abilities.includes("carry_bonus_30")) return sum + 30;
        return sum;
      }, 0);

    return subPage("Inventory", (
      <PlayerInventory
        save={save}
        str={Math.max(1, playerCharacter.stats.str)}
        followerCarryBonus={followerBonus}
        onEquip={(slot, itemId) => {
          const newEquipment = { ...save.equipment, [slot]: itemId };
          updateSave({ equipment: newEquipment });
        }}
        onDrop={(itemId, qty) => {
          const existing = save.inventory.find(i => i.id === itemId);
          if (!existing) return;
          // Unequip if dropping equipped item
          const newEquipment = { ...save.equipment };
          for (const s of ["weapon", "armor", "shield", "accessory"] as const) {
            if (newEquipment[s] === itemId && qty >= existing.qty) {
              newEquipment[s] = undefined;
            }
          }
          const newInventory = existing.qty <= qty
            ? save.inventory.filter(i => i.id !== itemId)
            : save.inventory.map(i => i.id === itemId ? { ...i, qty: i.qty - qty } : i);
          updateSave({ inventory: newInventory, equipment: newEquipment });
        }}
        onBack={() => cycleView("worldMap")}
      />
    ));
  }

  if (view === "worldMap" && save) return subPage("Kardov's Gate", (
    <div style={{ position: "relative", height: "100%" }}>
    <TutorialOverlay save={save} onSetFlag={(flag) => updateSave({ quest_flags: { ...(save.quest_flags ?? {}), [flag]: true } })} />
    <WorldMap
      save={save}
      character={activeCharacter}
      characters={characters}
      onSwitchParty={(newIndex) => {
        if (!save.parties || newIndex === save.active_party_index) return;
        const { parties, coins, food, inventory, equipment, current_hp, max_hp } = swapActiveParty(
          save.parties, save.active_party_index ?? 0, newIndex,
          { coins: save.coins, food: save.food, inventory: save.inventory, equipment: save.equipment, current_hp: save.current_hp, max_hp: save.max_hp },
        );
        updateSave({ parties, coins, food, inventory, equipment, current_hp, max_hp, active_party_index: newIndex });
      }}
      onCreateParty={(nftAddress) => {
        if (!save.parties) return;
        const newId = `party-${save.parties.length}`;
        const newParty = createAdventureParty(newId, `Party ${save.parties.length + 1}`, nftAddress);
        updateSave({
          parties: [...save.parties, newParty],
        });
      }}
      onAddHero={(nftAddress) => {
        if (save.party.heroes.length >= 4) return;
        const newHeroes = [...save.party.heroes, { nft_address: nftAddress.toLowerCase(), isLeader: false, followers: [] as import("@/lib/party").Follower[] }];
        const updatedParty = { ...save.party, heroes: newHeroes };
        const activeIdx = save.active_party_index ?? 0;
        const updatedParties = save.parties?.map((p, i) => i === activeIdx ? { ...p, heroes: newHeroes } : p);
        updateSave({ party: updatedParty, ...(updatedParties ? { parties: updatedParties } : {}) });
      }}
      onRemoveHero={(nftAddress) => {
        const hero = save.party.heroes.find(h => h.nft_address === nftAddress.toLowerCase());
        if (!hero || hero.isLeader) return;
        const newHeroes = save.party.heroes.filter(h => h.nft_address !== nftAddress.toLowerCase());
        const updatedParty = { ...save.party, heroes: newHeroes };
        const activeIdx = save.active_party_index ?? 0;
        const updatedParties = save.parties?.map((p, i) => i === activeIdx ? { ...p, heroes: newHeroes } : p);
        updateSave({ party: updatedParty, ...(updatedParties ? { parties: updatedParties } : {}) });
      }}
      onTravel={(hex, result, destHex, encounter) => {
        // Remember previous hex for retreat
        setPrevHex(save.map_hex);
        const updates: Record<string, unknown> = {
          map_hex: hex,
          food: result.newFood,
          current_hp: Math.min(save.max_hp, Math.max(1, result.newHp + (encounter.hpChange ?? 0))),
        };
        // If food was consumed during travel, update last_ate_hour
        if (result.newFood < save.food) updates.last_ate_hour = result.newHour;
        if (encounter.coinReward) updates.coins = addCoinsRaw(save.coins, encounter.coinReward);
        if ((encounter.goldChange ?? 0) > 0) {
          const base = (updates.coins as { gp: number; sp: number; cp: number } | undefined) ?? save.coins;
          updates.coins = addCp(base, encounter.goldChange!);
        }
        if ((encounter.foodChange ?? 0) > 0) {
          updates.food = (updates.food as number) + encounter.foodChange!;
          updates.last_ate_hour = result.newHour; // found food = fed
        }
        // Travel does not award XP — XP comes from battles and skill use only

        // Multi-party: move this party's hex and mark as acted
        if (save.parties && save.parties.length > 1) {
          const idx = save.active_party_index ?? 0;
          const updatedParties = save.parties.map((p, i) =>
            i === idx ? { ...p, map_hex: hex, has_acted: true } : p
          );
          if (allPartiesActed(updatedParties)) {
            updates.hour = result.newHour;
            updates.day = result.newDay;
            updates.parties = resetPartyRound(updatedParties);
            updates.active_party_index = 0;
          } else {
            updates.parties = updatedParties;
            updates.active_party_index = nextUnactedParty(updatedParties, idx);
          }
        } else {
          updates.hour = result.newHour;
          updates.day = result.newDay;
          if (save.parties?.[0]) {
            updates.parties = [{ ...save.parties[0], map_hex: hex }];
          }
        }

        updateSave(updates);

        // (travel gives no XP — no level-up check needed here)
        // Fights from world luck are handled by WorldMap — player chooses Fight or Escape
      }}
      onAction={(result: WorldLuckResult) => {
        const newHour = (save.hour ?? 0) + 8;  // 8 hours per rest/search
        const updates: Record<string, unknown> = {};
        const isInnRest = result.interaction === "rest" && result.worldRoll === 0 && result.goldChange < 0;

        if (isInnRest) {
          updates.coins = subtractCp(save.coins, Math.abs(result.goldChange)) ?? { gp: 0, sp: 0, cp: 0 };
          updates.current_hp = Math.min(save.max_hp, save.current_hp + result.hpChange);
          updates.last_rest_hour = newHour;
          updates.last_ate_hour = newHour; // inn provides a meal
        } else if (result.interaction === "rest") {
          const foodCost = Math.min(save.food, 1);
          updates.food = save.food - foodCost;
          if (foodCost >= 1) {
            const healPerRest = Math.floor(Math.max(1, playerCharacter?.stats.con ?? 1) / 2) + save.level;
            updates.current_hp = Math.min(save.max_hp, save.current_hp + healPerRest + result.hpChange);
            updates.last_ate_hour = newHour; // ate food while resting
          } else {
            updates.current_hp = Math.min(save.max_hp, Math.max(1, save.current_hp + result.hpChange));
          }
          updates.last_rest_hour = newHour;
        } else {
          const foodCost = Math.min(save.food, 1);
          updates.food = save.food - foodCost;
          if (foodCost >= 1) updates.last_ate_hour = newHour; // ate food during action
          if (result.hpChange !== 0) updates.current_hp = Math.min(save.max_hp, Math.max(1, save.current_hp + result.hpChange));
        }
        if (result.foodChange > 0) updates.food = ((updates.food as number) ?? save.food) + result.foodChange;
        const coinBase = (updates.coins as { gp: number; sp: number; cp: number } | undefined) ?? save.coins;
        if (result.coinReward) {
          updates.coins = addCoinsRaw(coinBase, result.coinReward);
        }
        if (result.goldChange > 0) {
          const base2 = (updates.coins as { gp: number; sp: number; cp: number } | undefined) ?? coinBase;
          updates.coins = addCp(base2, result.goldChange);
        }
        // Add hunted fresh food to inventory with spoil timer
        if (result.huntedFood && result.huntedFood.length > 0) {
          let inv = [...((updates.inventory as typeof save.inventory) ?? save.inventory)];
          const gameHour = (updates.hour as number) ?? newHour;
          for (const fresh of result.huntedFood) {
            const spoilHour = gameHour + fresh.spoilDays * 24;
            // Fresh food doesn't stack (different spoil times) — add new entry
            inv.push({ id: fresh.id, name: fresh.name, qty: 1, spoilHour });
          }
          updates.inventory = inv;
        }
        // Add reward items (social encounters, etc.) to inventory
        if (result.rewardItems && result.rewardItems.length > 0) {
          let inv = [...((updates.inventory as typeof save.inventory) ?? save.inventory)];
          for (const item of result.rewardItems) {
            const existing = inv.find(i => i.id === item.id);
            if (existing) { existing.qty += item.qty; }
            else { inv.push({ id: item.id, name: item.name, qty: item.qty, itemWeight: item.itemWeight }); }
          }
          updates.inventory = inv;
        }
        // Skill XP goes to ALL heroes and ALL alive followers (everyone is participating)
        const actionLevelUpQueue: import("@/hooks/useCharacterSave").LevelUpEntry[] = [];
        if (result.xpChange > 0) {
          const xpAmt = result.xpChange;
          const lIdx = save.party.heroes.findIndex(h => h.isLeader);
          const leaderIdx = lIdx >= 0 ? lIdx : 0;
          const heroesWithXp = save.party.heroes.map((h, hIdx) => {
            // Hero XP
            const hLevel = h.progression?.total_level ?? (hIdx === leaderIdx ? save.level : 1);
            const hXp = h.progression?.xp ?? (hIdx === leaderIdx ? save.xp : 0);
            const hResult = addXp(hLevel, hXp, xpAmt);
            let updProg = h.progression ? { ...h.progression, xp: hResult.xp, total_level: hResult.level } : h.progression;
            if (hResult.levelsGained > 0) {
              actionLevelUpQueue.push({
                entityId: h.nft_address, entityType: "hero" as const,
                entityName: hIdx === leaderIdx ? "Leader" : `Hero ${hIdx + 1}`,
                heroIndex: hIdx, fromLevel: hLevel, toLevel: hResult.level,
              });
            }
            // Keep top-level fields in sync for leader
            if (hIdx === leaderIdx) {
              updates.xp = hResult.xp;
              updates.level = hResult.level;
            }
            // Follower XP — all alive followers participate in skill use
            const updFollowers = h.followers.map((f, fIdx) => {
              if (!f.alive) return f;
              const fLevel = f.progression?.total_level ?? f.level;
              const fXp = f.progression?.xp ?? f.xp ?? 0;
              const fResult = addXp(fLevel, fXp, xpAmt);
              let updated = { ...f, xp: fResult.xp };
              if (fResult.levelsGained > 0) {
                if (f.progression) {
                  updated = { ...updated, progression: { ...f.progression, xp: fResult.xp, total_level: fResult.level } };
                  actionLevelUpQueue.push({
                    entityId: f.id, entityType: "follower" as const, entityName: f.name,
                    heroIndex: hIdx, followerIndex: fIdx, fromLevel: fLevel, toLevel: fResult.level,
                  });
                } else if ((f.loyalty ?? 0) >= 80) {
                  actionLevelUpQueue.push({
                    entityId: f.id, entityType: "follower" as const, entityName: f.name,
                    heroIndex: hIdx, followerIndex: fIdx, fromLevel: fLevel, toLevel: fResult.level,
                  });
                  updated = { ...updated, level: fResult.level };
                } else {
                  // Non-loyal: auto-level as warrior
                  for (let i = 0; i < fResult.levelsGained; i++) {
                    updated = { ...updated, level: updated.level + 1, maxHp: updated.maxHp + 5, attack: updated.attack + 1 };
                  }
                }
              }
              return updated;
            });
            return { ...h, progression: updProg, followers: updFollowers };
          });
          updates.party = { heroes: heroesWithXp };
        }
        if (result.fameChange && result.fameChange > 0) updates.fame = (save.fame ?? 0) + result.fameChange;
        if (result.factionRepChange) {
          const { newRep } = changeRep(save.faction_rep ?? {}, result.factionRepChange.factionId, result.factionRepChange.amount);
          updates.faction_rep = newRep;
        }

        // Recruited follower — add to leader's party
        if (result.newFollower) {
          const baseHeroes = (updates.party as { heroes: typeof save.party.heroes } | undefined)?.heroes ?? save.party.heroes;
          const leaderIdx = baseHeroes.findIndex(h => h.isLeader);
          const hIdx = leaderIdx >= 0 ? leaderIdx : 0;
          const updatedHeroes = baseHeroes.map((h, i) =>
            i === hIdx ? { ...h, followers: [...h.followers, result.newFollower!] } : h
          );
          updates.party = { heroes: updatedHeroes };
        }

        // Multi-party: mark current party as acted, auto-advance
        if (save.parties && save.parties.length > 1) {
          const idx = save.active_party_index ?? 0;
          const updatedParties = save.parties.map((p, i) =>
            i === idx ? { ...p, has_acted: true } : p
          );
          if (allPartiesActed(updatedParties)) {
            updates.hour = newHour;
            updates.day = Math.floor(newHour / 24) + 1;
            updates.parties = resetPartyRound(updatedParties);
            updates.active_party_index = 0;
          } else {
            updates.parties = updatedParties;
            updates.active_party_index = nextUnactedParty(updatedParties, idx);
          }
        } else {
          updates.hour = newHour;
          updates.day = Math.floor(newHour / 24) + 1;
        }

        updateSave(updates);

        if (actionLevelUpQueue.length > 0) {
          setLevelUpQueue(prev => [...prev, ...actionLevelUpQueue]);
          setView("levelUp");
        }
        // Fights from world luck are handled by WorldMap — player chooses Fight or Escape
      }}
      onBuyItem={(item) => {
        const newCoins = subtractCp(save.coins, item.buyPrice);
        if (newCoins) {
          // Food items convert directly to food supply (not inventory items)
          // 1 day = 3 food (FOOD_PER_DAY), individual meals = 1 food each
          const foodItems: Record<string, number> = {
            shop_rations_1: 3, shop_rations_5: 15, shop_rations_7: 21, shop_rations_10: 30,
            shop_bread: 1, shop_cheese: 1, shop_meat_chunk: 1, shop_banquet: 3,
          };
          if (foodItems[item.id]) {
            updateSave({ coins: newCoins, food: save.food + foodItems[item.id], last_ate_hour: save.hour ?? 0 });
            return;
          }
          // Mercenary items — hire as follower, not inventory
          if (item.id.startsWith("merc_")) {
            const template = GENERAL_TEMPLATES.find(t => t.templateId === item.id);
            if (template) {
              const hero = save.party.heroes[0];
              const chaScore = playerCharacter?.stats.cha ?? 10;
              const maxF = maxFollowers(chaScore);
              if (hero.followers.length >= maxF) return; // party full
              const follower = hireFollower(template);
              const newHeroes = save.party.heroes.map((h, i) =>
                i === 0 ? { ...h, followers: [...h.followers, follower] } : h
              );
              updateSave({ coins: newCoins, party: { ...save.party, heroes: newHeroes } });
              return;
            }
          }
          const existing = save.inventory.find((i) => i.id === item.id);
          const newInventory = existing
            ? save.inventory.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
            : [...save.inventory, { id: item.id, name: item.name, qty: 1 }];
          updateSave({ coins: newCoins, inventory: newInventory });
        }
      }}
      onBattle={(difficulty) => {
        cycleView("battle");
      }}
      onQuestBattle={(encounter) => {
        const cls = save ? getClassById(save.class_id) : undefined;
        setQuestEncounter({
          ...encounter,
          playerChar: activeCharacter ?? undefined,
          playerClass: cls,
          playerFeats: save?.feats,
          playerWeapon: save?.equipment?.weapon,
        });
        cycleView("battle");
      }}
      onExhaustionCollapse={(isSafe) => {
        // Collapse from exhaustion — reset rest timer
        const updates: Record<string, unknown> = {
          last_rest_hour: save.hour ?? 0,
          last_ate_hour: save.hour ?? 0, // infirmary/recovery feeds you
          current_hp: Math.max(1, Math.floor(save.max_hp * 0.25)), // wake up at 25% HP
        };
        if (isSafe) {
          // Town/farm: found by locals, taken to infirmary. Rested but lose random items.
          const lostItems: string[] = [];
          let newInventory = [...save.inventory];
          // Lose ~30% of inventory items (at least 1 if any exist)
          const loseCount = Math.max(1, Math.floor(newInventory.length * 0.3));
          for (let i = 0; i < loseCount && newInventory.length > 0; i++) {
            const idx = Math.floor(Math.random() * newInventory.length);
            lostItems.push(newInventory[idx].name ?? newInventory[idx].id);
            newInventory = newInventory.filter((_, j) => j !== idx);
          }
          updates.inventory = newInventory;
          // Also lose some coins (thieves while unconscious)
          const lostCp = Math.floor(totalCp(save.coins) * 0.2);
          if (lostCp > 0) {
            updates.coins = subtractCp(save.coins, lostCp) ?? { gp: 0, sp: 0, cp: 0 };
          }
          alert(`You collapse from exhaustion! Locals find you and carry you to the infirmary.\n\nYou wake up rested but some of your belongings are missing:\n${lostItems.length > 0 ? lostItems.join(", ") : "nothing"}${lostCp > 0 ? `\nSome coins were also taken (${lostCp}cp)` : ""}`);
        } else {
          // Wilderness: you collapse where you fall. Forced rest, no item loss but danger.
          // Lose more HP from exposure
          updates.current_hp = Math.max(1, Math.floor(save.max_hp * 0.1));
          alert("You collapse from exhaustion in the wilderness!\n\nYou pass out where you fall. Hours later you wake, battered and barely alive.\n\nYou need to rest properly and get to safety.");
        }
        updateSave(updates);
      }}
      onInventory={() => cycleView("inventory")}
      onEquip={(itemId, slot) => {
        const item = save.inventory.find(i => i.id === itemId);
        if (!item) return;
        // Move currently equipped item (if any) back to inventory
        const oldItemId = save.equipment[slot];
        let newInventory = save.inventory.map(i =>
          i.id === itemId ? { ...i, qty: i.qty - 1 } : i
        ).filter(i => i.qty > 0);
        if (oldItemId) {
          const existing = newInventory.find(i => i.id === oldItemId);
          if (existing) {
            newInventory = newInventory.map(i => i.id === oldItemId ? { ...i, qty: i.qty + 1 } : i);
          } else {
            const oldInfo = getItemInfo(oldItemId);
            newInventory.push({ id: oldItemId, name: oldInfo?.name ?? oldItemId, qty: 1 });
          }
        }
        updateSave({
          equipment: { ...save.equipment, [slot]: itemId },
          inventory: newInventory,
        });
      }}
      onUnequip={(slot) => {
        const itemId = save.equipment[slot];
        if (!itemId) return;
        const existing = save.inventory.find(i => i.id === itemId);
        const newInventory = existing
          ? save.inventory.map(i => i.id === itemId ? { ...i, qty: i.qty + 1 } : i)
          : [...save.inventory, { id: itemId, name: getItemInfo(itemId)?.name ?? itemId, qty: 1 }];
        updateSave({
          equipment: { ...save.equipment, [slot]: undefined },
          inventory: newInventory,
        });
      }}
      onExchange={(updatedParties, newCoins, newFood) => {
        updateSave({ parties: updatedParties, coins: newCoins, food: newFood });
      }}
      onSetAutoAction={(partyIndex, action) => {
        if (!save.parties) return;
        const updated = save.parties.map((p, i) =>
          i === partyIndex ? { ...p, auto_action: action } : p
        );
        updateSave({ parties: updated });
      }}
      onCollectMail={() => {
        const mail = save.gate_mail;
        if (!mail || (totalCp(mail.coins) === 0 && mail.messages.length === 0)) return;
        // Transfer accumulated coins to party purse
        const newCoins = addCoinsRaw(save.coins, mail.coins);
        // Clear the mailbox
        updateSave({
          coins: newCoins,
          gate_mail: { coins: { gp: 0, sp: 0, cp: 0 }, messages: [] },
        });
        setMailCollected(mail);
      }}
      onGiveGift={(followerIdx, heroIdx, itemId, result) => {
        // Remove 1 of the gifted item from inventory
        const newInv = save.inventory.map(it => it.id === itemId ? { ...it, qty: it.qty - 1 } : it).filter(it => it.qty > 0);
        // Auto-equip if the gifted item is a weapon/armor/shield
        const equippedFollower = autoEquipFollower(result.follower, itemId);
        // Update the follower in the party
        const newHeroes = save.party.heroes.map((h, hi) => {
          if (hi !== heroIdx) return h;
          return { ...h, followers: h.followers.map((f, fi) => fi === followerIdx ? equippedFollower : f) };
        });
        const updatedParty = { ...save.party, heroes: newHeroes };
        const activeIdx = save.active_party_index ?? 0;
        const updatedParties = save.parties?.map((p, i) => i === activeIdx ? { ...p, heroes: newHeroes } : p);
        updateSave({ inventory: newInv, party: updatedParty, ...(updatedParties ? { parties: updatedParties } : {}) });
      }}
      onBuyShip={(shipId, shipName) => {
        const template = getShip(shipId);
        if (!template) return;
        const costCp = template.costGp * 100;
        if (totalCp(save.coins) < costCp) return;
        const newShip = purchaseShip(shipId, shipName, save.map_hex);
        if (!newShip) return;
        const newCoins = addCp(save.coins, -costCp);
        updateSave({ ships: [...(save.ships ?? []), newShip], coins: newCoins });
      }}
      onBoardShip={(shipIndex) => {
        const ships = save.ships ?? [];
        if (shipIndex < 0 || shipIndex >= ships.length) return;
        updateSave({ active_ship_index: shipIndex });
      }}
      onDisembark={() => {
        // Dock the ship at current hex
        const ships = save.ships ?? [];
        const idx = save.active_ship_index;
        if (idx == null || idx < 0 || idx >= ships.length) return;
        const updated = ships.map((s, i) => i === idx ? { ...s, dockedAt: save.map_hex } : s);
        updateSave({ ships: updated, active_ship_index: null });
      }}
      onBack={() => cycleView("adventure")}
      onPowerUp={() => cycleView("powerUp")}
    />
    {/* ── Mail Collected Popup ── */}
    {mailCollected && (
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "rgba(20,15,8,0.95)", border: "2px solid rgba(251,191,36,0.5)",
        borderRadius: "12px", padding: "16px 20px", zIndex: 9999, maxWidth: "320px", width: "90%",
        boxShadow: "0 0 30px rgba(251,191,36,0.15)",
      }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "1.2rem" }}>{"📬"}</span>
            <span className="font-bold uppercase tracking-wider" style={{ fontSize: "0.55rem", color: "rgba(251,191,36,0.9)" }}>
              Mail Collected
            </span>
          </div>
          {totalCp(mailCollected.coins) > 0 && (
            <div className="px-2 py-1.5 rounded" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <span style={{ fontSize: "0.5rem", color: "rgba(251,191,36,0.9)" }}>
                {"+"} {formatCoins(mailCollected.coins)} added to purse
              </span>
            </div>
          )}
          {mailCollected.messages.length > 0 && (
            <div className="flex flex-col gap-0.5" style={{ maxHeight: "150px", overflowY: "auto" }}>
              {mailCollected.messages.slice(-10).map((msg, i) => (
                <div key={i} style={{ fontSize: "0.4rem", color: "rgba(232,213,176,0.5)", paddingLeft: "4px", borderLeft: "1px solid rgba(201,168,76,0.15)" }}>
                  {msg}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setMailCollected(null)}
            className="mt-1 px-3 py-1.5 rounded font-bold uppercase tracking-wider transition-all hover:scale-105"
            style={{ fontSize: "0.45rem", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "rgba(251,191,36,0.9)" }}>
            Done
          </button>
        </div>
      </div>
    )}
    </div>
  ));
  // My Army page
  if (view === "army") {
    const myNfts = characters.filter(c => c.owned);
    const totalCopies = myNfts.reduce((sum, c) => sum + c.ownedCount, 0);
    const baseArmy = myNfts.filter(c => c.chain === "base");
    const polyArmy = myNfts.filter(c => c.chain === "polygon");
    const totalBacking = myNfts.reduce((sum, c) => sum + c.usdBacking * c.ownedCount, 0);
    const totalStr = myNfts.reduce((sum, c) => sum + c.stats.str * c.ownedCount, 0);
    const totalDex = myNfts.reduce((sum, c) => sum + c.stats.dex * c.ownedCount, 0);
    const totalCon = myNfts.reduce((sum, c) => sum + c.stats.con * c.ownedCount, 0);
    const totalInt = myNfts.reduce((sum, c) => sum + c.stats.int * c.ownedCount, 0);
    const totalWis = myNfts.reduce((sum, c) => sum + c.stats.wis * c.ownedCount, 0);
    const totalCha = myNfts.reduce((sum, c) => sum + c.stats.cha * c.ownedCount, 0);
    const fmtStat = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(1);
    const fmtUsd = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;

    return subPage("My Army", (
      <div className="flex flex-col items-center gap-6 px-2">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ ← Back ⚜
        </button>

        {/* Army stats banner */}
        <div className="w-full max-w-lg rounded-xl p-5 text-center"
          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <h2 className="text-xl font-black tracking-widest text-gold-shimmer uppercase mb-3"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
            ⚜ My Heroes ⚜
          </h2>
          {myNfts.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(220,38,38,0.7)' }}>Connect wallet to see your heroes</p>
          ) : (<>
            {/* Value bar — matches Heroes of the Realm style */}
            <div className="flex items-center justify-center gap-4 px-4 py-2 flex-wrap rounded-lg mb-4"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>🔒 Your Locked Liquidity</span>
              <span className="text-lg font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>{fmtUsd(totalBacking)}</span>
            </div>

            {/* Counts */}
            <div className="flex justify-center gap-6 flex-wrap mb-4">
              <div>
                <p className="text-2xl font-black" style={{ color: '#f0d070' }}>{myNfts.length}</p>
                <p style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.5)' }}>Unique Heroes</p>
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: '#f0d070' }}>{totalCopies}</p>
                <p style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.5)' }}>Total NFTs</p>
              </div>
              <div className="flex gap-3">
                <div>
                  <p className="text-lg font-black" style={{ color: 'rgba(96,165,250,0.9)' }}>{baseArmy.length}</p>
                  <p style={{ fontSize: '0.5rem', color: 'rgba(96,165,250,0.4)' }}>⬡ Base</p>
                </div>
                <div>
                  <p className="text-lg font-black" style={{ color: 'rgba(167,139,250,0.9)' }}>{polyArmy.length}</p>
                  <p style={{ fontSize: '0.5rem', color: 'rgba(167,139,250,0.4)' }}>⬡ Polygon</p>
                </div>
              </div>
            </div>

            {/* Total army stats */}
            <div className="flex items-center justify-center gap-3 px-4 py-2 flex-wrap rounded-lg"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.4)' }}>Army Power</span>
              {totalStr > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>STR {fmtStat(totalStr)}</span>}
              {totalDex > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>DEX {fmtStat(totalDex)}</span>}
              {totalCon > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(251,113,133,0.8)' }}>CON {fmtStat(totalCon)}</span>}
              {totalInt > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(96,165,250,0.8)' }}>INT {fmtStat(totalInt)}</span>}
              {totalWis > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(45,212,191,0.8)' }}>WIS {fmtStat(totalWis)}</span>}
              {totalCha > 0 && <span className="text-xs font-bold" style={{ color: 'rgba(167,139,250,0.8)' }}>CHA {fmtStat(totalCha)}</span>}
            </div>
          </>)}
        </div>

        {/* Download images for offline play */}
        {myNfts.length > 0 && (
          <DownloadImages characters={characters} />
        )}

        {/* Army grid */}
        {myNfts.length > 0 && (
          <div className="w-full max-w-2xl">
            {[{ label: "Base Forces", chain: "base" as const, army: baseArmy, color: "rgba(96,165,250" },
              { label: "Polygon Forces", chain: "polygon" as const, army: polyArmy, color: "rgba(167,139,250" }]
              .filter(g => g.army.length > 0)
              .map(group => (
              <div key={group.chain} className="mb-6">
                <h3 className="text-sm font-black tracking-widest uppercase mb-3 text-center"
                  style={{ color: `${group.color},0.8)` }}>
                  ⬡ {group.label} ({group.army.reduce((s, c) => s + c.ownedCount, 0)} NFTs)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.army.map(card => (
                    <div key={card.contractAddress}
                      className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${group.color},0.3)` }}>
                      <div className="relative" style={{ height: 100, background: '#0a0810' }}>
                        {card.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={`/api/images?url=${encodeURIComponent(card.imageUrl)}`} alt={card.name}
                            className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-20">
                            <span className="text-2xl">🛡️</span>
                          </div>
                        )}
                        {card.ownedCount > 1 && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full font-black text-xs"
                            style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0608', fontSize: '0.6rem' }}>
                            x{card.ownedCount}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-black text-xs truncate" style={{ color: 'rgba(232,213,176,0.8)', fontSize: '0.55rem' }}>
                          {card.name}
                        </p>
                        {card.usdBacking > 0 && (
                          <p style={{ color: 'rgba(74,222,128,0.7)', fontSize: '0.45rem' }}>
                            ${(card.usdBacking * card.ownedCount).toFixed(2)} backing
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1" style={{ fontSize: '0.4rem', color: 'rgba(232,213,176,0.4)' }}>
                          {card.stats.str > 0 && <span>STR {card.stats.str.toFixed(1)}</span>}
                          {card.stats.dex > 0 && <span>DEX {card.stats.dex.toFixed(1)}</span>}
                          {card.stats.con > 0 && <span>CON {card.stats.con.toFixed(1)}</span>}
                          {card.stats.int > 0 && <span>INT {card.stats.int.toFixed(1)}</span>}
                          {card.stats.wis > 0 && <span>WIS {card.stats.wis.toFixed(1)}</span>}
                          {card.stats.cha > 0 && <span>CHA {card.stats.cha.toFixed(1)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  }



  if (view === "powerUp") return subPage("Power Up", <PowerUp characters={characters} onBack={() => cycleView("menu")} onStatsRefresh={refreshStats} />);

  // Token Powers reference page — which tokens give which stats and boons
  if (view === "tokenPowers") {
    const STAT_TOKENS_REF = [
      { chain: "Base", tokens: [
        { symbol: "EGP", stats: "DEX + INT + WIS", rate: "1x", color: "rgba(34,197,94,0.8)", type: "game", note: "Base + Polygon" },
        { symbol: "BURGERS", stats: "CON + CON + CON", rate: "1.5x", color: "rgba(251,113,133,0.8)", type: "impact", boon: "🍔 Feast of the Burger",
          boonTiers: ["$10: Half rations, +1 HP/rest", "$50: Auto-stabilize, 2x CON healing", "$100: Bonus action half-HP heal, 1/long rest", "$200: Short rest: allies +1 HP per CON mod"] },
        { symbol: "TGN", stats: "WIS + CON + CHA", rate: "1.5x", color: "rgba(74,222,128,0.8)", type: "impact", boon: "🌲 Canopy Council",
          boonTiers: ["$10: Adv Survival in forests", "$50: Speak with Plants 1/long rest", "$100: Tree Stride 1/long rest", "$200: Transport via Plants 1/long rest"] },
        { symbol: "MfT", stats: "All 6 (split)", rate: "0.5x per stat", color: "rgba(251,191,36,0.8)", type: "hub", boon: "👑 Noble Birth",
          boonTiers: ["$10: 5cp/day", "$25: 1sp/day", "$50: 3sp/day", "$100: 1gp/day", "$250: 3gp/day", "$500: 5gp/day", "$1k: 10gp/day", "$2.5k: 25gp/day", "$5k: 50gp/day", "$10k: 1000gp/day"] },
        { symbol: "USDGLO", stats: "All 6 (split)", rate: "0.5x per stat", color: "rgba(96,165,250,0.8)", type: "stable" },
        { symbol: "AZOS", stats: "All 6 (split)", rate: "0.5x per stat", color: "rgba(74,222,128,0.8)", type: "stable" },
      ]},
      { chain: "Polygon", tokens: [
        { symbol: "DDD", stats: "STR + INT + CHA", rate: "1x", color: "rgba(251,191,36,0.8)", type: "game" },
        { symbol: "OGC", stats: "STR + DEX + CON", rate: "1x", color: "rgba(251,146,60,0.8)", type: "game" },
        { symbol: "IGS", stats: "CON + WIS + CHA", rate: "1x", color: "rgba(192,132,252,0.8)", type: "game" },
        { symbol: "BTN", stats: "STR + CON + WIS", rate: "1x", color: "rgba(148,163,184,0.8)", type: "game" },
        { symbol: "LGP", stats: "DEX + INT + CHA", rate: "1x", color: "rgba(56,189,248,0.8)", type: "game" },
        { symbol: "DHG", stats: "STR + DEX + WIS", rate: "1x", color: "rgba(251,113,133,0.8)", type: "game" },
        { symbol: "PKT", stats: "CON + INT + CHA", rate: "1x", color: "rgba(74,222,128,0.8)", type: "game" },
        { symbol: "REGEN", stats: "DEX + CON + WIS", rate: "1.5x", color: "rgba(34,197,94,0.8)", type: "impact", boon: "♻️ Rebuilder's Resolve",
          boonTiers: ["$10: Regen 1 HP/turn if above 0", "$50: Greater Restoration 1/long rest", "$100: Resist necrotic, immune aging", "$200: Revive at half HP on death, 1/long rest"] },
        { symbol: "Grant Wizard", stats: "WIS + CHA + INT", rate: "1.5x", color: "rgba(167,139,250,0.8)", type: "impact", boon: "🧙 The Grantmaker",
          boonTiers: ["$10: Proficiency in one extra skill", "$50: Reroll one d20, 1/short rest", "$100: +/-1d10 any roll, 1/short rest", "$200: Adv on saves vs spells"] },
        { symbol: "USDGLO", stats: "All 6 (split)", rate: "0.5x per stat", color: "rgba(96,165,250,0.8)", type: "stable" },
      ]},
    ];
    const BOON_ONLY_REF = [
      { category: "Carbon Guardians", icon: "🌿", tokens: "CCC, CHAR, CRISP-M, NCT, BCT", color: "rgba(34,197,94,0.8)", unit: "effective lbs",
        thresholds: ["220 lbs (0.1 CHAR / 220 CCC)", "1,102 lbs (0.5 CHAR / 1 CRISP-M)", "2,204 lbs (1 CHAR / 2 CRISP-M)", "4,408 lbs (2 CHAR / 4 CRISP-M)"],
        tiers: ["Immune to poison condition", "Lesser Restoration 1/long rest", "Immune to disease & poison dmg", "Aura: allies adv CON saves"] },
      { category: "Wardens of the Grove", icon: "🌳", tokens: "JCGWR, AU24T", color: "rgba(74,222,128,0.8)", unit: "trees",
        thresholds: ["100 trees", "500 trees", "2,000 trees", "10,000 trees"],
        tiers: ["+1 NA (natural armor)", "Entangle 1/long rest", "+2 NA (natural armor), resist bludgeoning", "Wall of Thorns 1/long rest"] },
      { category: "Stormborn", icon: "⚡", tokens: "JLT-F24, JLT-B23", color: "rgba(250,204,21,0.8)", unit: "MWh",
        thresholds: ["1 MWh", "5 MWh", "10 MWh", "20 MWh"],
        tiers: ["+1d4 lightning on melee", "Resist lightning & thunder", "Call Lightning 1/long rest", "Immune lightning; 2d6 retaliation"] },
      { category: "Lightbearers", icon: "🔥", tokens: "LANTERN", color: "rgba(249,115,22,0.8)", unit: "lanterns",
        thresholds: ["0.25 lanterns", "1.25 lanterns", "2.5 lanterns", "6.25 lanterns"],
        tiers: ["+1d4 fire on melee", "Resist fire, darkvision 60ft", "Daylight at will", "Immune fire; Fireball 1/short rest"] },
      { category: "Tidekeepers", icon: "🛡️", tokens: "LTK, TB01", color: "rgba(96,165,250,0.8)", unit: "tokens",
        thresholds: ["10 tokens", "100 tokens", "500 tokens", "2,000 tokens"],
        tiers: ["+1 AC", "Resist one damage type", "Can't be grappled/restrained", "Resist all 1 round, 1/short rest"] },
      { category: "Heralds of Hope", icon: "💨", tokens: "PR24, PR25", color: "rgba(167,139,250,0.8)", unit: "kids helped",
        thresholds: ["1 kid", "5 kids", "10 kids", "25 kids"],
        tiers: ["+5ft speed", "Misty Step 1/short rest", "+15ft speed, opp atks disadv", "Guardian teleport reaction"] },
    ];
    const TRADFI_REF = [
      { category: "Vaults of Ether", icon: "💎", tokens: "WETH", color: "rgba(98,126,234,0.8)",
        thresholds: ["$10", "$50", "$100", "$200"],
        tiers: ["Arcana proficiency", "Spell Recall 1/long rest", "Counterspell 1/long rest", "Extra spell slot (5th)"] },
      { category: "The Bitcoin Bastion", icon: "🪙", tokens: "WBTC", color: "rgba(247,147,26,0.8)",
        thresholds: ["$10", "$50", "$100", "$200"],
        tiers: ["+5 max HP", "+1 AC", "+20 max HP", "Drop to 1 HP instead of 0, 1/long rest"] },
      { category: "Threads of Polygon", icon: "🕸️", tokens: "WPOL", color: "rgba(130,71,229,0.8)",
        thresholds: ["$10", "$50", "$100", "$200"],
        tiers: ["+5ft speed", "+2 initiative", "Evasion (half→none, fail→half)", "Action Surge 1/long rest"] },
    ];
    return subPage("Token Powers", (
      <div className="flex flex-col items-center gap-6 px-2 relative max-w-lg w-full mx-auto">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
          &larr; Back
        </button>

        <p className="text-xs text-center max-w-sm" style={{ color: 'rgba(232,213,176,0.6)' }}>
          Tokens deposited into NFT heroes give D20 ability scores and unlock powerful boons.
          Impact tokens earn stats at 1.5x AND unlock boon tiers.
        </p>

        {/* ── STAT TOKENS ── */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.4))' }} />
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.8)' }}>Stat Tokens</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.4))' }} />
        </div>

        {/* Scaling curve */}
        <div className="w-full rounded-lg px-4 py-3" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: 'rgba(201,168,76,0.7)' }}>Scaling Curve</p>
          <div className="flex flex-col gap-1">
            <p style={{ fontSize: '0.6rem', color: 'rgba(232,213,176,0.6)' }}>First 10 points: <span style={{ color: 'rgba(74,222,128,0.9)' }}>$1 / point</span></p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(232,213,176,0.6)' }}>Next 10 points: <span style={{ color: 'rgba(251,191,36,0.9)' }}>$10 / point</span></p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(232,213,176,0.6)' }}>Next 10 points: <span style={{ color: 'rgba(251,113,133,0.9)' }}>$100 / point</span></p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(232,213,176,0.5)' }}>...exponential brackets continue</p>
          </div>
        </div>

        {STAT_TOKENS_REF.map(chain => (
          <div key={chain.chain} className="w-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.2))' }} />
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
                {chain.chain}
              </span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.2))' }} />
            </div>
            <div className="flex flex-col gap-2">
              {chain.tokens.map(t => (
                <div key={`${chain.chain}-${t.symbol}`} className="flex flex-col px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs" style={{ color: t.color }}>{t.symbol}</span>
                      {t.type === "impact" && <span className="px-1 rounded font-bold" style={{ fontSize: '0.4rem', background: 'rgba(34,197,94,0.15)', color: 'rgba(34,197,94,0.8)', border: '1px solid rgba(34,197,94,0.3)' }}>IMPACT</span>}
                      {t.type === "stable" && <span className="px-1 rounded font-bold" style={{ fontSize: '0.4rem', background: 'rgba(96,165,250,0.15)', color: 'rgba(96,165,250,0.8)', border: '1px solid rgba(96,165,250,0.3)' }}>STABLE</span>}
                      {t.type === "hub" && <span className="px-1 rounded font-bold" style={{ fontSize: '0.4rem', background: 'rgba(251,191,36,0.15)', color: 'rgba(251,191,36,0.8)', border: '1px solid rgba(251,191,36,0.3)' }}>HUB</span>}
                      {"note" in t && (t as any).note && <span style={{ fontSize: '0.4rem', color: 'rgba(232,213,176,0.4)' }}>({(t as any).note})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: 'rgba(232,213,176,0.8)' }}>{t.stats}</span>
                      <span className="text-xs" style={{ color: t.rate.includes("1.5") ? 'rgba(34,197,94,0.7)' : 'rgba(232,213,176,0.4)' }}>{t.rate}</span>
                    </div>
                  </div>
                  {"boon" in t && t.boon && (
                    <div style={{ marginTop: '3px' }}>
                      <p style={{ fontSize: '0.5rem', color: 'rgba(34,197,94,0.7)', fontWeight: 'bold' }}>+ {t.boon}</p>
                      {"boonTiers" in t && (t as any).boonTiers && (
                        <div className="flex flex-col gap-0.5 mt-1">
                          {((t as any).boonTiers as string[]).map((tier: string, i: number) => (
                            <p key={i} style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.6)', paddingLeft: '8px' }}>{tier}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── IMPACT BOONS ── */}
        <div className="flex items-center gap-2 w-full mt-4">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(34,197,94,0.4))' }} />
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(34,197,94,0.8)' }}>Impact Boons</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(34,197,94,0.4))' }} />
        </div>

        <p className="text-xs text-center max-w-sm" style={{ color: 'rgba(232,213,176,0.5)' }}>
          Count-based boons from impact tokens. Hold more tokens to unlock higher tiers.
        </p>

        {BOON_ONLY_REF.map(b => (
          <div key={b.category} className="w-full rounded-lg px-3 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${b.color.replace('0.8)', '0.15)')}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{b.icon}</span>
              <div>
                <span className="font-black text-xs" style={{ color: b.color }}>{b.category}</span>
                <p style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.4)' }}>Tokens: {b.tokens}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {b.tiers.map((tier, i) => (
                <div key={i} className="flex items-start gap-2 cursor-help" title={`Requires: ${b.thresholds[i]}`}>
                  <span className="font-black shrink-0" style={{ fontSize: '0.5rem', color: b.color, opacity: 0.7 }}>T{i + 1}</span>
                  <span style={{ fontSize: '0.5rem', color: 'rgba(232,213,176,0.7)' }}>{tier}</span>
                  <span className="shrink-0 opacity-50" style={{ fontSize: '0.4rem', color: b.color }}>{b.thresholds[i]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── TRADFI BOONS ── */}
        <div className="flex items-center gap-2 w-full mt-2">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(247,147,26,0.4))' }} />
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(247,147,26,0.8)' }}>TradFi Boons</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(247,147,26,0.4))' }} />
        </div>

        <p className="text-xs text-center max-w-sm" style={{ color: 'rgba(232,213,176,0.5)' }}>
          Dollar-value boons from traditional crypto. No base stats &mdash; boons only at $10/$50/$100/$200.
        </p>

        {TRADFI_REF.map(b => (
          <div key={b.category} className="w-full rounded-lg px-3 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${b.color.replace('0.8)', '0.15)')}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{b.icon}</span>
              <div>
                <span className="font-black text-xs" style={{ color: b.color }}>{b.category}</span>
                <p style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.4)' }}>Tokens: {b.tokens}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {b.tiers.map((tier, i) => (
                <div key={i} className="flex items-start gap-2 cursor-help" title={`Requires: ${b.thresholds[i]} USD value`}>
                  <span className="font-black shrink-0" style={{ fontSize: '0.5rem', color: b.color, opacity: 0.7 }}>{b.thresholds[i]}</span>
                  <span style={{ fontSize: '0.5rem', color: 'rgba(232,213,176,0.7)' }}>{tier}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Link to Power Up */}
        <button onClick={() => cycleView("powerUp")}
          className="px-6 py-3 rounded-lg text-sm font-black uppercase tracking-widest mt-4"
          style={{ background: 'rgba(139,92,246,0.15)', color: 'rgba(139,92,246,0.9)', border: '1px solid rgba(139,92,246,0.4)' }}>
          Power Up Your Heroes
        </button>
      </div>
    ));
  }

  // Heroes gallery page
  if (view === "heroes") {
    const myNfts = characters.filter(c => c.owned);
    const totalBacking = myNfts.reduce((sum, c) => sum + c.usdBacking * c.ownedCount, 0);
    return subPage("All Heroes", (
      <div className="flex flex-col items-center gap-6 px-2 relative">
        <button onClick={() => cycleView("menu")}
          className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
          style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ← Back
        </button>

        {/* Your heroes summary */}
        {myNfts.length > 0 && (
          <div className="w-full max-w-lg rounded-xl p-4"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: '#f0d070' }}>
                Your Heroes ({myNfts.length})
              </span>
              {totalBacking > 0 && (
                <span className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>
                  ${totalBacking >= 1000 ? `${(totalBacking / 1000).toFixed(1)}K` : totalBacking.toFixed(2)} locked
                </span>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {myNfts.map(card => (
                <div key={card.contractAddress} className="flex-shrink-0 w-20 rounded-lg overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <div className="relative" style={{ height: 60, background: '#0a0810' }}>
                    {card.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/api/images?url=${encodeURIComponent(card.imageUrl)}`} alt={card.name}
                        className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20"><span>🛡️</span></div>
                    )}
                    {card.ownedCount > 1 && (
                      <span className="absolute top-0.5 right-0.5 px-1 rounded-full font-black"
                        style={{ background: 'rgba(201,168,76,0.9)', color: '#0a0608', fontSize: '0.45rem' }}>
                        x{card.ownedCount}
                      </span>
                    )}
                  </div>
                  <div className="px-1 py-0.5">
                    <p className="font-bold truncate" style={{ color: 'rgba(232,213,176,0.8)', fontSize: '0.4rem' }}>{card.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DownloadImages characters={characters} />

        {/* Asset totals */}
        {(assetTotals.traditional > 0 || assetTotals.game > 0 || assetTotals.impact > 0) && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 flex-wrap rounded-lg"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>🔒 Forever Locked Liquidity</span>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "traditional" ? null : "traditional")}>
              <span style={{ fontSize: '0.6rem', color: 'rgba(251,191,36,0.6)' }}>💰</span>
              <span className="text-xs font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>
                ${assetTotals.traditional >= 1000 ? `${(assetTotals.traditional / 1000).toFixed(1)}K` : assetTotals.traditional.toFixed(2)}
              </span>
              <span style={{ fontSize: '0.5rem', color: 'rgba(251,191,36,0.4)' }}>Traditional</span>
            </button>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "game" ? null : "game")}>
              <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.6)' }}>🎮</span>
              <span className="text-xs font-bold" style={{ color: 'rgba(167,139,250,0.8)' }}>
                ${assetTotals.game >= 1000 ? `${(assetTotals.game / 1000).toFixed(1)}K` : assetTotals.game.toFixed(2)}
              </span>
              <span style={{ fontSize: '0.5rem', color: 'rgba(167,139,250,0.4)' }}>Game Tokens</span>
            </button>
            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" onClick={() => setPieCategory(pieCategory === "impact" ? null : "impact")}>
              <span style={{ fontSize: '0.6rem', color: 'rgba(74,222,128,0.6)' }}>🌱</span>
              <span className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>
                ${assetTotals.impact >= 1000 ? `${(assetTotals.impact / 1000).toFixed(1)}K` : assetTotals.impact.toFixed(2)}
              </span>
              <span style={{ fontSize: '0.5rem', color: 'rgba(74,222,128,0.4)' }}>Impact Assets</span>
            </button>
          </div>
        )}

        {/* Pie chart */}
        {pieCategory && (() => {
          const items = tokenBreakdown.filter(t => t.category === pieCategory).sort((a, b) => b.usd - a.usd);
          const total = items.reduce((s, t) => s + t.usd, 0);
          if (total <= 0 || items.length === 0) return null;
          const catColor = pieCategory === "traditional" ? "rgba(251,191,36" : pieCategory === "game" ? "rgba(167,139,250" : "rgba(74,222,128";
          const catLabel = pieCategory === "traditional" ? "Traditional" : pieCategory === "game" ? "Game Tokens" : "Impact Assets";
          const sliceColors = items.map((_, i) => {
            const h = pieCategory === "traditional" ? 45 : pieCategory === "game" ? 260 : 145;
            return `hsl(${h + i * 17}, ${70 + (i % 2) * 15}%, ${70 - (i / Math.max(items.length, 1)) * 40}%)`;
          });
          let cumAngle = -Math.PI / 2;
          const slices = items.map((item, i) => {
            const angle = (item.usd / total) * Math.PI * 2;
            const sa = cumAngle; cumAngle += angle;
            const x1 = 50 + 45 * Math.cos(sa), y1 = 50 + 45 * Math.sin(sa);
            const x2 = 50 + 45 * Math.cos(cumAngle), y2 = 50 + 45 * Math.sin(cumAngle);
            const d = items.length === 1 ? `M50,50 L${x1},${y1} A45,45 0 1,1 ${x1 - 0.001},${y1} Z`
              : `M50,50 L${x1},${y1} A45,45 0 ${angle > Math.PI ? 1 : 0},1 ${x2},${y2} Z`;
            return <path key={i} d={d} fill={sliceColors[i]} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />;
          });
          return (
            <div className="flex items-center justify-center gap-6 px-4 py-4 flex-wrap rounded-lg"
              style={{ background: `${catColor},0.03)`, border: `1px solid ${catColor},0.2)` }}>
              <svg viewBox="0 0 100 100" width="120" height="120">{slices}</svg>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: `${catColor},0.8)` }}>{catLabel}</span>
                {items.map((item, i) => (
                  <div key={`${item.symbol}-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: sliceColors[i] }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.symbol}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>${item.usd >= 1000 ? `${(item.usd / 1000).toFixed(1)}K` : item.usd.toFixed(2)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>({((item.usd / total) * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {loading ? (
          <div className="flex flex-col items-center gap-4 mt-12">
            <div className="text-4xl animate-pulse">🔮</div>
            <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>Consulting the Oracle...</p>
          </div>
        ) : (
          <>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search heroes by name or address..." className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }} />
            <p className="text-center text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length} Owned · {sorted.length}{search ? ' matching' : ''} of {characters.length} · Page {page + 1} of {totalPages}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {pageChars.map((char) => (
                <CharacterCard key={`${char.contractAddress}-${char.tokenId}`} character={char} maxStats={maxStats} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>← Prev</button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)} className="w-7 h-7 rounded text-xs font-bold"
                      style={i === page ? { background: 'rgba(201,168,76,0.4)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)' }
                        : { background: 'rgba(201,168,76,0.05)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.15)' }}>{i + 1}</button>
                  ))}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  className="px-4 py-2 rounded text-sm font-bold uppercase tracking-widest disabled:opacity-30"
                  style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.9)', border: '1px solid rgba(201,168,76,0.3)' }}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    ));
  }

  // Main Menu
  const totalLocked = assetTotals.traditional + assetTotals.game + assetTotals.impact;
  return (
    <main className="flex flex-col min-h-screen relative">
      {/* Tavern background */}
      <div className="fixed inset-0 z-0" style={{ pointerEvents: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tavern-bg.webp" alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(10,6,8,0.8) 80%)' }} />
      </div>

      <header className="header-fantasy flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-xl font-black tracking-widest text-gold-shimmer uppercase">Tales of Tasern</h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>◆ The Realm Awaits ◆</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            const url = window.location.href;
            const text = "Tales of Tasern — NFT card battle game powered by real impact assets on Base";
            if (navigator.share) navigator.share({ title: "Tales of Tasern", text, url });
            else { navigator.clipboard.writeText(`${text}\n${url}`); alert("Link copied!"); }
          }} className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.9)', border: '1px solid rgba(139,92,246,0.4)' }}>
            📤
          </button>
          <Wallet>
            <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
            <WalletDropdown>{isConnected && <Address />}<WalletDropdownDisconnect /></WalletDropdown>
          </Wallet>
        </div>
      </header>


      <div className="flex flex-col items-center flex-1 px-6 py-10 gap-8 relative z-10">
        {/* Locked liquidity summary */}
        {totalLocked > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl"
            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.6)' }}>
              🔒 ${totalLocked >= 1000 ? `${(totalLocked / 1000).toFixed(1)}K` : totalLocked.toFixed(0)} Forever Locked
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.3)' }}>·</span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(201,168,76,0.4)' }}>{characters.length} Heroes</span>
          </div>
        )}

        {/* Main menu — 3 core actions */}
        <div className="flex flex-col gap-5 w-full max-w-lg">
          {/* All Heroes */}
          <button onClick={() => cycleView("heroes")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.3)', boxShadow: '0 0 25px rgba(201,168,76,0.05)' }}>
            <span className="text-4xl">⚔️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: '#f0d070' }}>All Heroes</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(201,168,76,0.5)' }}>
              {characters.filter(c => c.owned).length > 0
                ? `${characters.filter(c => c.owned).length} owned · ${characters.length} total champions`
                : `Browse all ${characters.length} champions`}
            </span>
          </button>

          {/* Play Game */}
          <button onClick={() => cycleView("adventure")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 25px rgba(34,197,94,0.05)' }}>
            <span className="text-4xl">🗺️</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(34,197,94,0.9)' }}>Play Game</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(34,197,94,0.5)' }}>
              {save && hasCharacter ? `Lv${save.level} · Day ${Math.floor((save.hour ?? 0) / 24) + 1} · ${formatCoins(save.coins)} · ${save.battles_won}W` : 'New adventure awaits'}
            </span>
          </button>

          {/* Power Up */}
          <button onClick={() => cycleView("powerUp")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(139,92,246,0.1)', border: '2px solid rgba(139,92,246,0.3)', boxShadow: '0 0 25px rgba(139,92,246,0.05)' }}>
            <span className="text-4xl">⚡</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(139,92,246,0.9)' }}>Power Up</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(139,92,246,0.5)' }}>Boost hero stats with LP tokens</span>
          </button>

          {/* Token Powers */}
          <button onClick={() => cycleView("tokenPowers")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(45,212,191,0.1)', border: '2px solid rgba(45,212,191,0.3)', boxShadow: '0 0 25px rgba(45,212,191,0.05)' }}>
            <span className="text-4xl">📖</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(45,212,191,0.9)' }}>Token Powers</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(45,212,191,0.5)' }}>Stats & boons reference guide</span>
          </button>

          {/* Marketplace — external site */}
          <a href="https://marketplace.memefortrees.com" target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)', boxShadow: '0 0 25px rgba(251,191,36,0.05)' }}>
            <span className="text-4xl">🛒</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.9)' }}>Marketplace</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(251,191,36,0.5)' }}>Buy and sell hero NFTs</span>
          </a>
        </div>

        {/* Download game assets */}
        <DownloadImages characters={characters} />

        {/* Connect prompt */}
        {!isConnected && (
          <div className="flex items-center gap-4 px-5 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <span style={{ color: 'rgba(201,168,76,0.7)' }}>Connect wallet to see your champions</span>
            <Wallet>
              <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
              <WalletDropdown>{isConnected && <Address />}<WalletDropdownDisconnect /></WalletDropdown>
            </Wallet>
          </div>
        )}

      </div>
    </main>
  );
}
