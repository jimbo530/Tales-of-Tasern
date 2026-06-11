"use client";

import React, { useState } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { CLASSES, type CharacterClass } from "@/lib/classes";
import { SKILLS, abilityMod } from "@/lib/skills";
import { FEATS, getAvailableFeats, getStartingFeatCount, featNeedsChoice, parseFeatChoice } from "@/lib/feats";
import { SPELLS, SPECIALIZABLE_SCHOOLS, getClassSpells, getSpellsKnown, type SpellSchool } from "@/lib/spells";
import { DOMAINS } from "@/lib/domains";

export type SpellConfig = {
  known_spells?: string[];
  prepared_spells?: string[];
  spellbook?: string[];
  domains?: [string, string] | null;
  school_specialization?: string | null;
  prohibited_schools?: string[];
};

export function CharacterCreation({ ownedChars, onStart }: {
  ownedChars: NftCharacter[];
  onStart: (nft: NftCharacter, classId: string, skillRanks: Record<string, number>, feats: string[], spellConfig?: SpellConfig, factionName?: string) => void;
}) {
  const [step, setStep] = useState<"nft" | "class" | "spells" | "abilities" | "skills" | "confirm" | "faction">("nft");
  const [pickedNft, setPickedNft] = useState<NftCharacter | null>(null);
  const [pickedClass, setPickedClass] = useState<CharacterClass | null>(null);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [pickedFeats, setPickedFeats] = useState<string[]>([]);
  const [skillRanks, setSkillRanks] = useState<Record<string, number>>({});
  const [featFilter, setFeatFilter] = useState<"all" | "combat" | "general" | "magic" | "skill" | "epic">("all");
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
