"use client";

import { useState } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterSave } from "@/lib/saveSystem";
import type { LevelUpEntry } from "@/hooks/useCharacterSave";
import { CLASSES, getClassById, HIT_DIE_VALUES } from "@/lib/classes";
import { SKILLS, abilityMod } from "@/lib/skills";
import { FEATS, getAvailableFeats, featsForLevelUp, featNeedsChoice, parseFeatChoice } from "@/lib/feats";
import { SPELLS, getClassSpells, getSpellsKnown, getSpellSlots } from "@/lib/spells";
import { getLeaderProgression, defaultProgression, type EntityProgression } from "@/lib/party";

export function LevelUpFlow({ save, character, fromLevel, toLevel, entry, onComplete }: {
  save: CharacterSave;
  character: NftCharacter | null;
  fromLevel: number;
  toLevel: number;
  entry?: LevelUpEntry;
  onComplete: (patch: Partial<CharacterSave>) => void;
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
  const [classChoices, setClassChoices] = useState<string[]>([]);
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
  const [luFeatFilter, setLuFeatFilter] = useState<"all" | "combat" | "general" | "magic" | "skill" | "epic">("all");
  const allFeats = [...prog.feats, ...luFeats];
  const availableFeats = cls ? getAvailableFeats(toLevel, cls.id, stats as Record<string, number>, allFeats) : [];
  const filteredFeats = luFeatFilter === "all" ? availableFeats : availableFeats.filter(f => f.category === luFeatFilter);

  // HP roll state
  const [hpRolls, setHpRolls] = useState<number[]>([]);
  const totalHpGain = hpRolls.length === levelsGained
    ? hpRolls.reduce((s, r) => s + Math.max(1, r + conMod), 0)
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
    const currentLevelIdx = hpRolls.length;
    const allRolled = hpRolls.length >= levelsGained;
    const lastRoll = hpRolls.length > 0 ? hpRolls[hpRolls.length - 1] : null;
    const canReroll = lastRoll === 1;
    const currentDie = getHitDieForChoice(currentLevelIdx);

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
        <div className="flex gap-1 justify-center flex-wrap">
          {(["all", "combat", "general", "magic", "skill", "epic"] as const).map(cat => (
            <button key={cat} onClick={() => setLuFeatFilter(cat)}
              className="px-2 py-0.5 rounded text-xs uppercase" style={{ background: luFeatFilter === cat ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)", color: luFeatFilter === cat ? "rgba(168,85,247,0.9)" : gold, border: `1px solid ${luFeatFilter === cat ? "rgba(168,85,247,0.4)" : "rgba(201,168,76,0.1)"}` }}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "45vh" }}>
          {filteredFeats.map(feat => {
            const picked = luFeats.includes(feat.id) || luFeats.some(f => f.startsWith(feat.id + ":"));
            const disabled = luFeats.length >= totalFeatSlots && !picked;
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
    const mergedRanks = { ...prog.skill_ranks };
    for (const [id, v] of Object.entries(luSkillRanks)) {
      mergedRanks[id] = (mergedRanks[id] ?? 0) + v;
    }
    const mergedFeats = [...prog.feats, ...luFeats];
    const mergedKnown = isSpontaneous ? [...prog.known_spells, ...luSpells] : prog.known_spells;
    const mergedSpellbook = isWizard ? [...prog.spellbook, ...luSpells] : prog.spellbook;
    const newMaxHp = prog.max_hp + totalHpGain;

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

    const hIdx = isFollower ? (entry?.heroIndex ?? 0) : (save.party.heroes.findIndex(h => h.isLeader) >= 0 ? save.party.heroes.findIndex(h => h.isLeader) : 0);
    const updatedHeroes = save.party.heroes.map((h, i) => {
      if (i !== hIdx) return h;
      if (isFollower && entry?.followerIndex !== undefined) {
        const updatedFollowers = h.followers.map((f, fi) =>
          fi === entry.followerIndex ? { ...f, level: toLevel, progression: updatedProg } : f
        );
        return { ...h, followers: updatedFollowers };
      }
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
          ...(isFollower ? {} : {
            level: toLevel,
            skill_ranks: mergedRanks,
            feats: mergedFeats,
            known_spells: mergedKnown,
            spellbook: mergedSpellbook,
            max_hp: newMaxHp,
            current_hp: Math.min(newMaxHp, prog.current_hp + totalHpGain),
          }),
          party: { heroes: updatedHeroes },
        })} className={btn} style={btnStyle}>
          Continue Adventure
        </button>
      </div>
    );
  }

  return null;
}
