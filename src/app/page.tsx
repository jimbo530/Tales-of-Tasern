"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Marketplace } from "@/components/Marketplace";
import { PowerUp } from "@/components/PowerUp";
import { HexBattle, type QuestEncounter } from "@/components/HexBattle";
import { WorldMap, type WorldLuckResult } from "@/components/WorldMap";
import { PlayerInventory } from "@/components/PlayerInventory";
import { CLASSES, getClassById, type CharacterClass, type SpellcastingInfo } from "@/lib/classes";
import { SKILLS, abilityMod, type Skill } from "@/lib/skills";
import { FEATS, getAvailableFeats, getStartingFeatCount, type Feat } from "@/lib/feats";
import { SPELLS, SPELL_SCHOOLS, SPECIALIZABLE_SCHOOLS, getClassSpells, getSpellsKnown, type Spell, type SpellSchool } from "@/lib/spells";
import { DOMAINS, type Domain } from "@/lib/domains";
import { formatCoins, addCp, subtractCp, totalCp, addCoinsRaw, setQuestCooldown, setQuestCooldownDays, getExhaustionPoints, lowestExhaustedStat } from "@/lib/saveSystem";
import { changeRep } from "@/lib/factions";
import { allPartiesActed, resetPartyRound, nextUnactedParty } from "@/lib/party";
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

function NewGameFlow({ ownedChars, onStart }: {
  ownedChars: NftCharacter[];
  onStart: (nft: NftCharacter, classId: string, skillRanks: Record<string, number>, feats: string[], spellConfig?: SpellConfig) => void;
}) {
  const [step, setStep] = useState<"nft" | "class" | "spells" | "abilities" | "skills" | "confirm">("nft");
  const [pickedNft, setPickedNft] = useState<NftCharacter | null>(null);
  const [pickedClass, setPickedClass] = useState<CharacterClass | null>(null);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [pickedFeats, setPickedFeats] = useState<string[]>([]);
  const [skillRanks, setSkillRanks] = useState<Record<string, number>>({});
  const [featFilter, setFeatFilter] = useState<"all" | "combat" | "general" | "magic" | "skill">("all");
  // ── Spell creation state ──
  const [pickedDomains, setPickedDomains] = useState<string[]>([]);
  const [pickedSpecialization, setPickedSpecialization] = useState<SpellSchool | null>(null);
  const [pickedProhibited, setPickedProhibited] = useState<SpellSchool[]>([]);
  const [pickedKnownSpells, setPickedKnownSpells] = useState<string[]>([]);

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
              const feat = FEATS.find(f => f.id === fid);
              if (!feat) return null;
              return (
                <div key={fid} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)" }}>
                  <div className="flex-1">
                    <div className="text-xs font-bold" style={{ color: "rgba(74,222,128,0.9)" }}>{feat.name}</div>
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
            const alreadyPicked = pickedFeats.includes(feat.id);
            const slotsLeft = maxFeatSlots - pickedFeats.length;
            // Fighter bonus slot must be combat
            const needsCombatForBonus = pickedClass?.id === "fighter" && pickedFeats.length === 1 && feat.category !== "combat";
            const disabled = alreadyPicked || slotsLeft <= 0 || needsCombatForBonus;
            return (
              <button key={feat.id} onClick={() => { if (!disabled) setPickedFeats(prev => [...prev, feat.id]); }}
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
  return (
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
              const feat = FEATS.find(f => f.id === fid);
              return feat ? (
                <div key={fid} style={{ fontSize: "0.5rem", color: "rgba(251,191,36,0.7)" }}>
                  {feat.name} — <span style={{ color: "rgba(232,213,176,0.5)" }}>{feat.benefit}</span>
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
            onStart(pickedNft, pickedClass.id, skillRanks, pickedFeats, spellConfig);
          }}
          className="px-6 py-2 rounded text-sm font-black uppercase tracking-widest"
          style={{ background: "rgba(34,197,94,0.2)", color: "rgba(34,197,94,0.95)", border: "1px solid rgba(34,197,94,0.5)" }}>
          Begin Adventure
        </button>
      </div>
    </div>
  );
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
  const [view, setView] = useState<"menu" | "heroes" | "army" | "marketplace" | "powerUp" | "battle" | "worldMap" | "adventure" | "inventory">("menu");
  const [lastBattleRewards, setLastBattleRewards] = useState<{ xp: number; goldCp: number; levelsGained: number } | null>(null);
  const [questEncounter, setQuestEncounter] = useState<QuestEncounter | null>(null);

  // Character save system
  const { save, hasCharacter, updateSave, createCharacter, recordBattle } = useCharacterSave();
  const { data: walletClient } = useWalletClient();
  // Find the player's selected NFT from their save
  const playerCharacter = save
    ? characters.find(c => c.contractAddress.toLowerCase() === save.nft_address.toLowerCase()) ?? null
    : null;

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

  if (view === "powerUp") return subPage("Power Up", <PowerUp characters={characters} onBack={() => cycleView("menu")} onStatsRefresh={refreshStats} />);
  if (view === "marketplace") return subPage("Marketplace", <Marketplace characters={characters} onBack={() => cycleView("menu")} />);
  if (view === "battle") return subPage(questEncounter ? questEncounter.questName : "Battle", <HexBattle characters={characters}
    questEncounter={questEncounter ?? undefined}
    playerFeats={save?.feats}
    playerWeapon={save?.equipment?.weapon}
    onExit={() => {
      if (lastBattleRewards) setLastBattleRewards(null);
      setQuestEncounter(null);
      cycleView(hasCharacter ? "worldMap" : "menu");
    }}
    onBattleEnd={async (outcome, difficulty, enemies, rounds) => {
      const result = await recordBattle({ difficulty, enemies, outcome, rounds });
      if (result) setLastBattleRewards({ xp: result.rewards.xp, goldCp: result.rewards.goldCp, levelsGained: result.levelsGained });
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
          // Teleport to Kardov's Gate, restore full HP
          updateSave({
            map_region: "kardovs-gate",
            map_node: "tavern",
            map_hex: { q: 36, r: 32 },
            current_hp: save.max_hp,
          });
        } catch (e: any) {
          alert("Transaction failed: " + (e.shortMessage ?? e.message));
          return;
        }
      } else {
        // Accept death: lose all levels, items, gold — restart from scratch
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
            <button onClick={() => cycleView("marketplace")} className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: "rgba(251,191,36,0.2)", color: "rgba(251,191,36,0.9)", border: "1px solid rgba(251,191,36,0.4)" }}>
              Visit Marketplace
            </button>
          </div>
        ) : (
          <NewGameFlow
            ownedChars={ownedChars}
            onStart={async (nft, classId, skillRanks, feats, spellConfig) => {
              await createCharacter(nft.contractAddress, classId, skillRanks, feats, spellConfig);
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
    <WorldMap
      save={save}
      character={playerCharacter}
      characters={characters}
      onSwitchParty={(newIndex) => {
        if (!save.parties || newIndex === save.active_party_index) return;
        updateSave({ active_party_index: newIndex });
      }}
      onTravel={(hex, result, destHex, encounter) => {
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
        if ((encounter.xpChange ?? 0) > 0) updates.xp = save.xp + encounter.xpChange!;

        // Multi-party: move this party's hex and mark as acted
        if (save.parties && save.parties.length > 1) {
          const idx = save.active_party_index ?? 0;
          const updatedParties = save.parties.map((p, i) =>
            i === idx ? { ...p, map_hex: hex, has_acted: true } : p
          );
          // Check if all parties acted → advance time + reset round
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
          // Single party: also update the party's hex position
          if (save.parties?.[0]) {
            updates.parties = [{ ...save.parties[0], map_hex: hex }];
          }
        }

        updateSave(updates);
        if (encounter.outcome === "fight" && encounter.difficulty) {
          setLastBattleRewards(null);
          setTimeout(() => cycleView("battle"), 300);
        }
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
        if (result.xpChange > 0) updates.xp = save.xp + result.xpChange;
        if (result.fameChange && result.fameChange > 0) updates.fame = (save.fame ?? 0) + result.fameChange;
        if (result.factionRepChange) {
          const { newRep } = changeRep(save.faction_rep ?? {}, result.factionRepChange.factionId, result.factionRepChange.amount);
          updates.faction_rep = newRep;
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
        if (result.outcome === "fight" && result.difficulty) {
          setLastBattleRewards(null);
          setTimeout(() => cycleView("battle"), 300);
        }
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
          playerChar: playerCharacter ?? undefined,
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
      onBack={() => cycleView("adventure")}
    />
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
      <div className="fixed inset-0 z-0">
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

          {/* Marketplace */}
          <button onClick={() => cycleView("marketplace")}
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(251,191,36,0.1)', border: '2px solid rgba(251,191,36,0.3)', boxShadow: '0 0 25px rgba(251,191,36,0.05)' }}>
            <span className="text-4xl">🛒</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(251,191,36,0.9)' }}>Marketplace</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(251,191,36,0.5)' }}>Buy and sell hero NFTs</span>
          </button>
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
