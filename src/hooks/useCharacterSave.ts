"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  type CharacterSave,
  loadCharacterSave,
  saveCharacter,
  syncToCloud,
  setLocalSave,
  getLocalSave,
  defaultSave,
  addXp,
  battleRewards,
  logBattle,
  setQuestCooldown,
  addCp,
} from "@/lib/saveSystem";
import { type EntityProgression, type Follower, getLeaderProgression, autoLevelFollower, isFollowerLoyal } from "@/lib/party";

export type LevelUpEntry = {
  entityId: string;           // hero nft_address or follower id
  entityType: "hero" | "follower";
  entityName: string;
  heroIndex: number;          // which hero owns this follower (or is self)
  followerIndex?: number;     // index in hero's followers array
  fromLevel: number;
  toLevel: number;
};

export type SyncStatus = "saved" | "saving" | "error" | "offline";

export function useCharacterSave() {
  const { address, isConnected } = useAccount();
  const [save, setSave] = useState<CharacterSave | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCharacter, setHasCharacter] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const dirtyRef = useRef(false);

  // Track online/offline status and reflect in syncStatus
  useEffect(() => {
    const goOnline = () => { setOnline(true); setSyncStatus("saved"); };
    const goOffline = () => { setOnline(false); setSyncStatus("offline"); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Sync local RPG save → cloud when coming back online
  useEffect(() => {
    if (online && address && save) {
      syncToCloud(address);
    }
  }, [online, address, save]);

  // Load save on wallet connect (local wins for RPG data)
  useEffect(() => {
    if (!isConnected || !address) {
      setSave(null);
      setHasCharacter(false);
      return;
    }

    setLoading(true);
    loadCharacterSave(address).then(data => {
      setSave(data);
      setHasCharacter(!!data);
      setLoading(false);
    });
  }, [address, isConnected]);

  // Auto-save every 30s if dirty: local write is instant, cloud write is awaited
  useEffect(() => {
    if (!save) return;
    const interval = setInterval(async () => {
      if (dirtyRef.current && save) {
        // Local save is instant and always works
        setLocalSave(save);

        if (!navigator.onLine) {
          setSyncStatus("offline");
          // dirtyRef stays true — will retry when back online / next interval
          return;
        }

        setSyncStatus("saving");
        const ok = await saveCharacter(save);
        if (ok) {
          dirtyRef.current = false;
          setSyncStatus("saved");
        } else {
          setSyncStatus("error");
          // dirtyRef stays true — will retry on the next interval
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [save]);

  // Save locally on tab close — synchronous localStorage only.
  // beforeunload handlers cannot await async work (the browser won't wait),
  // so cloud sync is intentionally skipped here. The next session will pick up
  // the local save and sync it to cloud on load via syncToCloud().
  useEffect(() => {
    function handleUnload() {
      if (save && dirtyRef.current) {
        setLocalSave({ ...save, updated_at: new Date().toISOString() });
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [save]);

  // Create new character
  const createCharacter = useCallback(async (
    nftAddress: string,
    classId: string,
    skillRanks?: Record<string, number>,
    feats?: string[],
    spellConfig?: {
      known_spells?: string[];
      prepared_spells?: string[];
      spellbook?: string[];
      domains?: [string, string] | null;
      school_specialization?: string | null;
      prohibited_schools?: string[];
    },
    factionName?: string,
  ) => {
    if (!address) return false;
    const newSave = defaultSave(address, nftAddress, classId, skillRanks ?? {}, feats ?? [], factionName);
    if (spellConfig) {
      if (spellConfig.known_spells) newSave.known_spells = spellConfig.known_spells;
      if (spellConfig.prepared_spells) newSave.prepared_spells = spellConfig.prepared_spells;
      if (spellConfig.spellbook) newSave.spellbook = spellConfig.spellbook;
      if (spellConfig.domains !== undefined) newSave.domains = spellConfig.domains;
      if (spellConfig.school_specialization !== undefined) newSave.school_specialization = spellConfig.school_specialization;
      if (spellConfig.prohibited_schools) newSave.prohibited_schools = spellConfig.prohibited_schools;
    }
    const full: CharacterSave = {
      ...newSave,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Save locally first (instant)
    setLocalSave(full);
    setSave(full);
    setHasCharacter(true);
    // Then push to cloud (backup)
    saveCharacter(full);
    return true;
  }, [address]);

  // Update save (partial) — local-first
  const updateSave = useCallback((patch: Partial<CharacterSave>) => {
    setSave(prev => {
      if (!prev) return prev;
      dirtyRef.current = true;
      const updated = { ...prev, ...patch, updated_at: new Date().toISOString() };
      // Instant local save
      setLocalSave(updated);
      return updated;
    });
  }, []);

  // Force save to cloud now
  const forceSave = useCallback(async () => {
    if (!save) return false;
    dirtyRef.current = false;
    return saveCharacter(save);
  }, [save]);

  // Record battle result, distribute XP per-entity (ALL heroes + their combat followers), award gold/loot
  const recordBattle = useCallback(async (result: {
    difficulty: "easy" | "medium" | "hard" | "deadly";
    enemies: string[];
    outcome: "victory" | "defeat" | "retreat";
    rounds: number;
    // Per-entity surviving HP + spell slots from the battle, keyed by save-side
    // id (hero nft_address / follower id). HP persists between battles for ALL
    // heroes and followers (no auto-heal to full on the next fight).
    survivors?: { key: string; currentHp: number; maxHp: number; spellSlotsUsed?: number[] }[];
  }) => {
    if (!save || !address) return null;

    // Lookup of post-battle survival state by entity key.
    const survivorByKey = new Map((result.survivors ?? []).map(s => [s.key, s]));

    const leaderProg = getLeaderProgression(save);
    const leaderHeroIdx = save.party.heroes.findIndex(h => h.isLeader) ?? 0;

    // Count ALL combat participants across ALL heroes
    let participantCount = 0;
    for (const hero of save.party.heroes) {
      participantCount += 1; // the hero itself
      participantCount += hero.followers.filter(f =>
        f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged" || f.role === "faction")
      ).length;
    }

    const rewards = result.outcome === "victory"
      ? battleRewards(result.difficulty, leaderProg.total_level, participantCount)
      : { xp: 0, xpPerEntity: 0, goldCp: 0, loot: [] };

    const xpEach = rewards.xpPerEntity;
    const levelUpQueue: LevelUpEntry[] = [];
    let leaderLevelsGained = 0;
    let leaderNewLevel = leaderProg.total_level;
    let leaderNewXp = leaderProg.xp;

    // ── Process every hero and their followers ──
    const updatedHeroes = save.party.heroes.map((hero, hIdx) => {
      // Hero XP
      const heroProg = hero.progression;
      const heroLevel = heroProg?.total_level ?? (hIdx === (leaderHeroIdx >= 0 ? leaderHeroIdx : 0) ? save.level : 1);
      const heroXp = heroProg?.xp ?? (hIdx === (leaderHeroIdx >= 0 ? leaderHeroIdx : 0) ? save.xp : 0);
      const heroResult = addXp(heroLevel, heroXp, xpEach);

      let updatedProg = heroProg
        ? { ...heroProg, xp: heroResult.xp, total_level: heroResult.level }
        : undefined;

      // Persist this hero's surviving HP + spell slots (HP carries between battles).
      const heroSurvivor = survivorByKey.get(hero.nft_address);
      if (updatedProg && heroSurvivor) {
        updatedProg = {
          ...updatedProg,
          current_hp: Math.max(0, Math.min(heroSurvivor.currentHp, updatedProg.max_hp)),
          ...(heroSurvivor.spellSlotsUsed ? { spell_slots_used: heroSurvivor.spellSlotsUsed } : {}),
        };
      }

      if (heroResult.levelsGained > 0) {
        const isLeader = hIdx === (leaderHeroIdx >= 0 ? leaderHeroIdx : 0);
        levelUpQueue.push({
          entityId: hero.nft_address,
          entityType: "hero",
          entityName: isLeader ? "Leader" : `Hero ${hIdx + 1}`,
          heroIndex: hIdx,
          fromLevel: heroLevel,
          toLevel: heroResult.level,
        });
        if (isLeader) {
          leaderLevelsGained = heroResult.levelsGained;
          leaderNewLevel = heroResult.level;
          leaderNewXp = heroResult.xp;
        }
      } else {
        const isLeader = hIdx === (leaderHeroIdx >= 0 ? leaderHeroIdx : 0);
        if (isLeader) {
          leaderNewLevel = heroResult.level;
          leaderNewXp = heroResult.xp;
        }
      }

      // Follower XP for this hero's followers
      const combatFollowers = hero.followers.filter(f =>
        f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged" || f.role === "faction"));
      const updatedFollowers = hero.followers.map((f, fIdx) => {
        if (!f.alive || !combatFollowers.includes(f)) return f;
        const fLevel = f.progression?.total_level ?? f.level;
        const fXp = f.progression?.xp ?? f.xp ?? 0;
        const fResult = addXp(fLevel, fXp, xpEach);

        let updated = { ...f, xp: fResult.xp };
        if (fResult.levelsGained > 0) {
          if (f.progression) {
            updated = { ...updated, progression: { ...f.progression, xp: fResult.xp, total_level: fResult.level } };
            levelUpQueue.push({
              entityId: f.id, entityType: "follower", entityName: f.name,
              heroIndex: hIdx, followerIndex: fIdx,
              fromLevel: fLevel, toLevel: fResult.level,
            });
          } else if (isFollowerLoyal(f)) {
            levelUpQueue.push({
              entityId: f.id, entityType: "follower", entityName: f.name,
              heroIndex: hIdx, followerIndex: fIdx,
              fromLevel: fLevel, toLevel: fResult.level,
            });
            updated = { ...updated, level: fResult.level };
          } else {
            let autoF = updated;
            for (let i = 0; i < fResult.levelsGained; i++) autoF = autoLevelFollower(autoF);
            updated = autoF;
          }
        }
        // Persist this follower's surviving HP + spell slots (HP carries between battles).
        const fSurvivor = survivorByKey.get(f.id);
        if (fSurvivor) {
          const survHp = Math.max(0, Math.min(fSurvivor.currentHp, updated.maxHp));
          updated = { ...updated, hp: survHp };
          if (updated.progression) {
            updated = {
              ...updated,
              progression: {
                ...updated.progression,
                current_hp: Math.max(0, Math.min(fSurvivor.currentHp, updated.progression.max_hp)),
                ...(fSurvivor.spellSlotsUsed ? { spell_slots_used: fSurvivor.spellSlotsUsed } : {}),
              },
            };
          }
        }
        return updated;
      });

      return { ...hero, progression: updatedProg ?? hero.progression, followers: updatedFollowers };
    });

    // ── Build save patch ──
    let newInventory = [...save.inventory];
    for (const item of rewards.loot) {
      const existing = newInventory.find(i => i.id === item.id);
      if (existing) {
        newInventory = newInventory.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      } else {
        newInventory.push({ id: item.id, name: item.name, qty: 1 });
      }
    }

    // Keep top-level fields in sync with leader for backward compat
    const patch: Partial<CharacterSave> = {
      level: leaderNewLevel,
      xp: leaderNewXp,
      coins: addCp(save.coins, rewards.goldCp),
      inventory: newInventory,
      party: { heroes: updatedHeroes },
      battles_won: save.battles_won + (result.outcome === "victory" ? 1 : 0),
      battles_lost: save.battles_lost + (result.outcome === "defeat" ? 1 : 0),
    };

    updateSave(patch);

    logBattle({
      wallet: address,
      nft_address: save.nft_address,
      class_id: leaderProg.class_levels[0]?.class_id ?? save.class_id,
      level: leaderProg.total_level,
      difficulty: result.difficulty,
      enemies: result.enemies,
      result: result.outcome,
      rounds: result.rounds,
      xp_earned: rewards.xp,
      gold_earned: rewards.goldCp,
    }).catch(() => {});

    return { rewards, levelsGained: leaderLevelsGained, levelUpQueue };
  }, [save, address, updateSave]);

  // Set a quest flag
  const setQuestFlag = useCallback((questId: string, value: boolean) => {
    if (!save) return;
    updateSave({
      quest_flags: { ...save.quest_flags, [questId]: value },
    });
  }, [save, updateSave]);

  // Set a quest cooldown
  const startQuestCooldown = useCallback((questId: string, minutes: number) => {
    if (!save) return;
    updateSave({
      quest_cooldowns: setQuestCooldown(save.quest_cooldowns, questId, minutes),
    });
  }, [save, updateSave]);

  // Change class (respec)
  const changeClass = useCallback((classId: string) => {
    updateSave({ class_id: classId });
  }, [updateSave]);

  return {
    save,
    loading,
    hasCharacter,
    online,
    syncStatus,
    createCharacter,
    updateSave,
    forceSave,
    recordBattle,
    setQuestFlag,
    startQuestCooldown,
    changeClass,
  };
}
