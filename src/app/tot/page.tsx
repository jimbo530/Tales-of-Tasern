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
import { CharacterCreation } from "@/components/CharacterCreation";
import { CharacterCard } from "@/components/CharacterCard";
import { HexBattle, type QuestEncounter } from "@/components/HexBattle";
import { WorldMap, type WorldLuckResult } from "@/components/WorldMap";
import { PlayerInventory } from "@/components/PlayerInventory";
import { PowerUp } from "@/components/PowerUp";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { getClassById, type CharacterClass } from "@/lib/classes";
import { SKILLS, abilityMod, type Skill } from "@/lib/skills";
import { FEATS, getAvailableFeats, featsForLevelUp, featNeedsChoice, parseFeatChoice } from "@/lib/feats";
import { SPELLS, getClassSpells, getSpellsKnown, getSpellSlots, type SpellSchool } from "@/lib/spells";
import { formatCoins, addCp, subtractCp, totalCp, cpToCoins, addCoinsRaw, setQuestCooldown, setQuestCooldownDays, getExhaustionPoints, lowestExhaustedStat, addXp, addGateMail } from "@/lib/saveSystem";
import { changeRep } from "@/lib/factions";
import { createMonsterSpec, type EnemySpec } from "@/lib/hexCombat";
import { MONSTERS } from "@/lib/monsters";
import { DEFAULT_BOON_FIELDS } from "@/lib/computeD20Stats";
import { getItemInfo, getItemWeight } from "@/lib/itemRegistry";
import { purchaseShip, getShip } from "@/lib/ships";
import { getItemById } from "@/lib/loot";
import { allPartiesActed, resetPartyRound, nextUnactedParty, hireFollower, GENERAL_TEMPLATES, maxFollowers, createAdventureParty, swapActiveParty, migratePartySupplies, migrateEntityProgression, processDailyUpkeep, getLeaderProgression, defaultProgression, autoEquipFollower, type EntityProgression } from "@/lib/party";
import { ARTIFACT_QUESTS, GONE_ARTIFACT_RUMORS } from "@/lib/artifactQuests";
import { DownloadImages } from "@/components/DownloadImages";
import { LevelUpFlow } from "@/components/LevelUpFlow";
import { CraftingPanel } from "@/components/CraftingPanel";
import { initSkillProgress, addSkillXp, type CraftingSkill } from "@/lib/craftingSystem";

const PAGE_SIZE = 10;

/* DownloadImages and LevelUpFlow extracted to src/components/ */


/* NewGameFlow extracted to CharacterCreation component — see src/components/CharacterCreation.tsx */
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
  const [view, setView] = useState<"menu" | "heroes" | "army" | "battle" | "worldMap" | "adventure" | "inventory" | "crafting" | "levelUp" | "powerUp" | "tokenPowers">("menu");
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

  // ── Restore pending fight on page load (anti-refresh exploit) ──
  const pendingFightRestored = useRef(false);
  useEffect(() => {
    if (pendingFightRestored.current || !save?.pending_fight || !activeCharacter) return;
    pendingFightRestored.current = true;
    const pf = save.pending_fight;
    const cls = getClassById(save.class_id);
    const enemies: EnemySpec[] = pf.enemies.map(e => ({
      name: e.name, imageEmoji: e.imageEmoji, imageUrl: e.imageUrl,
      stats: e.stats as unknown as NftCharacter["stats"],
      subtypes: e.subtypes, hpOverride: e.hpOverride,
      motivation: e.motivation as EnemySpec["motivation"],
      cruel: e.cruel, attackRange: e.attackRange, rangeIncrement: e.rangeIncrement,
    }));
    setQuestEncounter({
      questId: "pending_fight", questName: pf.questName, enemies,
      mapImage: pf.mapImage, difficulty: pf.difficulty,
      playerChar: activeCharacter, playerClass: cls,
      playerFeats: save.feats, playerWeapon: save.equipment?.weapon,
    });
    cycleView("battle");
  }, [save, activeCharacter]);

  // One-time save migrations. These must run in an effect (not the render body),
  // because calling updateSave() during render is a setState-during-render bug.
  // Keyed on the loaded wallet so they run once per save load; each migration is
  // self-guarded so a re-run is a harmless no-op.
  useEffect(() => {
    if (!save) return;
    // Migrate old saves: give each party its own coins/food/inventory/equipment/hp
    if (save.parties && !save.parties.some(p => p.coins !== undefined)) {
      const migrated = migratePartySupplies(save.parties, save.active_party_index ?? 0, {
        coins: save.coins, food: save.food, inventory: save.inventory, equipment: save.equipment,
        current_hp: save.current_hp, max_hp: save.max_hp,
      });
      updateSave({ parties: migrated });
    }
    // Rename legacy "Main Party" → "Party 1"
    if (save.parties?.[0]?.name === "Main Party") {
      updateSave({ parties: save.parties.map((p, i) => i === 0 ? { ...p, name: "Party 1" } : p) });
    }
    // Migrate: move top-level progression into hero.progression + add follower xp/loyalty
    if (!save.party?.heroes?.[0]?.progression) {
      const progPatch = migrateEntityProgression(save);
      if (progPatch) updateSave(progPatch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.wallet]);

  // ── Daily: spoilage check + follower upkeep ──
  // Runs in an effect (not the render body — that was a setState-during-render bug)
  // and guards on the PERSISTED last_upkeep_day rather than a per-mount ref, so a
  // remount with the clock past a day boundary can't double-run wages/spoilage.
  const currentDay = save ? Math.floor((save.hour ?? 0) / 24) + 1 : 0;
  useEffect(() => {
    if (!save || currentDay <= 0) return;
    const lastUpkeepDay = save.last_upkeep_day ?? 0;
    if (currentDay <= lastUpkeepDay) return;
    const gameHour = save.hour ?? 0;
    const dayUpdates: Record<string, unknown> = { last_upkeep_day: currentDay };

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
          dayUpdates.gate_mail = addGateMail(mail, incomeCp, `Day ${currentDay}: ${formatCoins(cpToCoins(incomeCp))} tribute from ${titleName} estates`);
        }
      }
    }

    // dayUpdates always carries last_upkeep_day, so this also advances the guard.
    updateSave(dayUpdates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save?.wallet, currentDay]);

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
      updateSave({ pending_fight: null });  // clear pending fight
      if (levelUpQueue.length > 0) {
        setLastBattleRewards(null);
        setView("levelUp");
      } else {
        setLastBattleRewards(null);
        cycleView(hasCharacter ? "worldMap" : "menu");
      }
    }}
    onBattleEnd={async (outcome, difficulty, enemies, rounds, spellSlotsUsed, remainingHp, _prisoners, survivors) => {
      // recordBattle writes per-entity surviving HP + spell slots for ALL heroes
      // and followers (HP persists between battles — no auto-heal on next fight).
      const result = await recordBattle({ difficulty, enemies, outcome, rounds, survivors });
      const rewards = result ? { xp: result.rewards.xp, goldCp: result.rewards.goldCp, loot: (result.rewards.loot ?? []).map((l: { name: string }) => ({ name: l.name })), levelsGained: result.levelsGained, newLevel: (save?.level ?? 1) + result.levelsGained } : null;
      if (rewards) setLastBattleRewards(rewards);
      // Populate level-up queue from battle results
      if (result?.levelUpQueue && result.levelUpQueue.length > 0) {
        setLevelUpQueue(prev => [...prev, ...result.levelUpQueue]);
      }
      // Persist spell slots and remaining HP after battle (no auto-heal)
      const battleUpdates: Record<string, unknown> = { pending_fight: null };  // clear pending fight
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
        // Add artifact quest initial rumors
        for (const quest of ARTIFACT_QUESTS) {
          rumorFlags[`artifact_rumor_${quest.id}`] = quest.rumorFlag;
        }
        if (rumorFlags[qid]) {
          questUpdates.quest_flags = { ...(save.quest_flags ?? {}), [rumorFlags[qid]]: true };
        }
        // ── Artifact quest leg completion ──
        for (const quest of ARTIFACT_QUESTS) {
          for (const leg of quest.legs) {
            if (leg.legId === qid) {
              // Set completion flag for this leg
              const updatedFlags = { ...(questUpdates.quest_flags as Record<string, boolean> ?? save.quest_flags ?? {}), [leg.completionFlag]: true };
              questUpdates.quest_flags = updatedFlags;

              // Check for "already gone" outcome on final legs
              const isGone = leg.goneChance && leg.goneChance > 0 && Math.random() < leg.goneChance;

              if (isGone) {
                // Artifact was already taken — set follow-up flag, exclude artifact from rewards
                if (leg.goneFollowupFlag) {
                  updatedFlags[leg.goneFollowupFlag] = true;
                  questUpdates.quest_flags = updatedFlags;
                }
                // Still give non-artifact reward items (keys, maps, etc.)
                if (leg.rewardItems?.length) {
                  const artifactId = quest.artifact;
                  const filteredItems = leg.rewardItems.filter(id => id !== artifactId);
                  if (filteredItems.length > 0) {
                    const currentInv = save.inventory ?? [];
                    const newItems = filteredItems.map(itemId => ({
                      id: itemId,
                      name: itemId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                      qty: 1,
                    }));
                    questUpdates.inventory = [...currentInv, ...newItems];
                  }
                }
              } else {
                // Normal completion — give all rewards including artifact
                if (leg.rewardItems?.length) {
                  const currentInv = save.inventory ?? [];
                  const newItems = leg.rewardItems.map(itemId => ({
                    id: itemId,
                    name: itemId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                    qty: 1,
                  }));
                  questUpdates.inventory = [...currentInv, ...newItems];
                }
              }

              // Add bonus gold (always given — you looted the dungeon either way)
              if (leg.rewardGoldCp) {
                const currentCoins = save.coins ?? { gp: 0, sp: 0, cp: 0 };
                const bonusGp = Math.floor(leg.rewardGoldCp / 100);
                const bonusSp = Math.floor((leg.rewardGoldCp % 100) / 10);
                const bonusCp = leg.rewardGoldCp % 10;
                questUpdates.coins = {
                  gp: currentCoins.gp + bonusGp,
                  sp: currentCoins.sp + bonusSp,
                  cp: currentCoins.cp + bonusCp,
                };
              }

              // When completing leg 1, also set the rumorFlag so the initial
              // rumor won't be offered again (safety net — the rumorFlags
              // Record above should already handle this for the initial battle,
              // but if the player reached leg 1 via questKeyword match this
              // ensures consistency).
              if (leg === quest.legs[0] && !updatedFlags[quest.rumorFlag]) {
                questUpdates.quest_flags = { ...updatedFlags, [quest.rumorFlag]: true };
              }

              break;
            }
          }
        }
        // ── Standalone "gone" artifact quest completion ──
        for (const gq of GONE_ARTIFACT_RUMORS) {
          if (qid === gq.id) {
            questUpdates.quest_flags = { ...(questUpdates.quest_flags as Record<string, boolean> ?? save.quest_flags ?? {}), [gq.flag]: true };
          }
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
          <CharacterCreation
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

  if (view === "crafting" && save && playerCharacter) {
    return subPage("Crafting", (
      <CraftingPanel
        save={save}
        onCraftItem={(result) => {
          // Build crafting state from save (or fresh defaults)
          const skills: CraftingSkill[] = ["blacksmithing", "leatherworking", "alchemy", "enchanting", "jewelcrafting", "inscription"];
          const currentMaterials = save.crafting?.materials ?? [];
          const currentSkills = save.crafting?.skills
            ? save.crafting.skills.map(s => ({ skill: s.skill as CraftingSkill, level: s.level, xp: s.xp, xpToNext: s.xpToNext }))
            : skills.map(s => initSkillProgress(s));

          // Update materials (subtract consumed)
          const newMaterials = currentMaterials.map(m => ({ ...m }));
          for (const mat of result.removeMaterials) {
            const stack = newMaterials.find(m => m.materialId === mat.materialId);
            if (stack) {
              stack.quantity -= mat.quantity;
            }
          }

          // Update skill XP
          const newSkills = currentSkills.map(s => {
            if (s.skill === result.skillXp.skill) {
              return addSkillXp(s, result.skillXp.xp);
            }
            return s;
          });

          // Add crafted item to inventory
          const newInventory = [...save.inventory];
          const existing = newInventory.find(i => i.id === result.addItem.id);
          if (existing) {
            existing.qty += result.addItem.qty;
          } else {
            newInventory.push({ id: result.addItem.id, name: result.addItem.name, qty: result.addItem.qty });
          }

          updateSave({
            inventory: newInventory,
            crafting: {
              playerId: save.wallet,
              materials: newMaterials.filter(m => m.quantity > 0),
              skills: newSkills,
              knownRecipes: save.crafting?.knownRecipes ?? [],
              discoveredByExperiment: save.crafting?.discoveredByExperiment ?? [],
            },
          });
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

        // Save pending fight at travel time so refreshing can't skip it
        if (encounter.outcome === "fight" && encounter.encounter) {
          const terrainEmoji: Record<string, string> = {
            forest: "\u{1F43B}", desert: "\u{1F982}", jungle: "\u{1F40D}", swamp: "\u{1F40A}",
            mountain: "\u{1F9CC}", plains: "\u{1F43A}", coast: "\u{1F419}", town: "\u{1F5E1}\u{FE0F}",
          };
          const hexType = destHex.type ?? "plains";
          const emoji = terrainEmoji[hexType] ?? "\u{1F47E}";
          const specs = encounter.encounter.monsters.flatMap(m =>
            Array.from({ length: m.count }, () => createMonsterSpec(m.monster, emoji))
          );
          updates.pending_fight = {
            enemies: specs.map(e => ({
              name: e.name, imageEmoji: e.imageEmoji, imageUrl: e.imageUrl,
              stats: e.stats as unknown as Record<string, number>,
              subtypes: e.subtypes, hpOverride: e.hpOverride,
              motivation: e.motivation, cruel: e.cruel,
              attackRange: e.attackRange, rangeIncrement: e.rangeIncrement,
            })),
            difficulty: encounter.difficulty ?? "medium",
            questName: encounter.description?.slice(0, 60) ?? "Encounter",
            mapImage: undefined,
          };
        } else if (encounter.outcome === "thug_fight") {
          const isKiller = encounter.thugType === "killer";
          const count = encounter.enemyCount ?? 3;
          const thugs = Array.from({ length: count }, (_, i) => ({
            name: isKiller ? `Assassin ${i + 1}` : `Thug ${i + 1}`,
            imageEmoji: isKiller ? "\u{1F5E1}\u{FE0F}" : "\u{1F44A}",
            stats: (isKiller
              ? { str: 7, dex: 8, con: 6, int: 5, wis: 5, cha: 5, ac: 15, naturalArmor: 0, atk: 3, speed: 30, lightningDmg: 0, fireDmg: 0, ...DEFAULT_BOON_FIELDS }
              : { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5, ac: 13, naturalArmor: 0, atk: 1, speed: 30, lightningDmg: 0, fireDmg: 0, ...DEFAULT_BOON_FIELDS }
            ) as unknown as Record<string, number>,
            subtypes: [] as string[],
            hpOverride: isKiller ? 14 + Math.floor(Math.random() * 6) + 1 : 8 + Math.floor(Math.random() * 4) + 1,
            motivation: isKiller ? "kill" : undefined,
            cruel: undefined,
          }));
          updates.pending_fight = {
            enemies: thugs,
            difficulty: isKiller ? "hard" as const : "medium" as const,
            questName: isKiller ? "Assassins!" : "Street Ambush",
          };
        }

        updateSave(updates);
      }}
      onAction={(result: WorldLuckResult) => {
        const newHour = (save.hour ?? 0) + 8;  // 8 hours per rest/search
        const updates: Record<string, unknown> = {};
        // A paid service (money changer, healing prayer) is NOT a rest: it must not
        // clear exhaustion, grant rest-heal, or skip 8h — even though it uses
        // interaction:"rest" for styling. Genuine inns/sleep set service:false/undefined.
        const isService = result.service === true;
        const isInnRest = !isService && result.interaction === "rest" && result.worldRoll === 0 && result.goldChange < 0;

        if (isService) {
          // Pay any flat fee (e.g. Healing Prayer). Money Changer carries goldChange:0
          // and expresses its value change via setCoinsAbsolute instead.
          if (result.goldChange < 0) {
            updates.coins = subtractCp(save.coins, Math.abs(result.goldChange)) ?? save.coins;
          }
          // Apply the service's explicit hp effect (Healing Prayer full restore; 0 for changer).
          if (result.hpChange !== 0) {
            updates.current_hp = Math.min(save.max_hp, Math.max(1, save.current_hp + result.hpChange));
          }
          // NOTE: deliberately no last_rest_hour / last_ate_hour / time-skip here.
        } else if (isInnRest) {
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
        // Money changer: replace the purse outright with the consolidated coins.
        // The fee is already baked into setCoinsAbsolute, so this takes final precedence.
        if (result.setCoinsAbsolute) {
          updates.coins = result.setCoinsAbsolute;
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

        // A paid service (money changer, healing prayer) does NOT consume a turn:
        // no 8h time-skip and the party is not marked as acted. Only genuine
        // rests/searches/actions advance the clock.
        if (!isService) {
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
        // Save pending fight so refreshing can't skip it
        updateSave({ pending_fight: {
          enemies: encounter.enemies.map(e => ({
            name: e.name, imageEmoji: e.imageEmoji, imageUrl: e.imageUrl,
            stats: e.stats as unknown as Record<string, number>,
            subtypes: e.subtypes, hpOverride: e.hpOverride,
            motivation: e.motivation, cruel: e.cruel,
            attackRange: e.attackRange, rangeIncrement: e.rangeIncrement,
          })),
          difficulty: encounter.difficulty,
          questName: encounter.questName,
          mapImage: encounter.mapImage,
        }});
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
      onCraft={() => cycleView("crafting")}
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
      onEscapeFight={() => updateSave({ pending_fight: null })}
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
            const text = "Tales of Tasern — D20 hex exploration RPG with play-for-impact on Base";
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

          {/* Games Hub */}
          <a href="/games"
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', boxShadow: '0 0 25px rgba(34,197,94,0.05)' }}>
            <span className="text-4xl">🎮</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(34,197,94,0.9)' }}>Games</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(34,197,94,0.5)' }}>Baselings, RPG, Arcade & more</span>
          </a>

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

          {/* Token Launcher */}
          <a href="/launch"
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-2xl transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', boxShadow: '0 0 25px rgba(16,185,129,0.05)' }}>
            <span className="text-4xl">🚀</span>
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'rgba(16,185,129,0.9)' }}>Launch Token</span>
            <span style={{ fontSize: '0.55rem', color: 'rgba(16,185,129,0.5)' }}>Unruggable token in one click</span>
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

        {/* Token links */}
        <div className="flex gap-4 justify-center mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <a href="https://app.uniswap.org/swap?chain=base&outputCurrency=0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3"
            target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">MfT</a>
          <span>·</span>
          <a href="/poop/"
            className="hover:text-amber-400 transition-colors">POOP</a>
          <span>·</span>
          <a href="/earth/"
            className="hover:text-blue-400 transition-colors">EARTH</a>
        </div>

      </div>
    </main>
  );
}
