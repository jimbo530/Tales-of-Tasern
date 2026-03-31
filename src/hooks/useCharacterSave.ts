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

export function useCharacterSave() {
  const { address, isConnected } = useAccount();
  const [save, setSave] = useState<CharacterSave | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasCharacter, setHasCharacter] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const dirtyRef = useRef(false);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
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

  // Auto-save locally every 30s if dirty, cloud every 60s
  useEffect(() => {
    if (!save) return;
    const interval = setInterval(() => {
      if (dirtyRef.current && save) {
        // Local save is instant and always works
        setLocalSave(save);
        // Cloud backup is best-effort
        saveCharacter(save);
        dirtyRef.current = false;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [save]);

  // Save locally on tab close (synchronous, always works)
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
  ) => {
    if (!address) return false;
    const newSave = defaultSave(address, nftAddress, classId, skillRanks ?? {}, feats ?? []);
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

  // Record battle result, award XP/gold, level up
  const recordBattle = useCallback(async (result: {
    difficulty: "easy" | "medium" | "hard";
    enemies: string[];
    outcome: "victory" | "defeat" | "retreat";
    rounds: number;
  }) => {
    if (!save || !address) return null;

    const rewards = result.outcome === "victory"
      ? battleRewards(result.difficulty, save.level)
      : { xp: 0, goldCp: 0 };

    const { level, xp, levelsGained } = addXp(save.level, save.xp, rewards.xp);

    const patch: Partial<CharacterSave> = {
      level,
      xp,
      coins: addCp(save.coins, rewards.goldCp),
      battles_won: save.battles_won + (result.outcome === "victory" ? 1 : 0),
      battles_lost: save.battles_lost + (result.outcome === "defeat" ? 1 : 0),
    };

    // Local save is instant
    updateSave(patch);

    // Battle log to cloud (best-effort, non-blocking)
    logBattle({
      wallet: address,
      nft_address: save.nft_address,
      class_id: save.class_id,
      level: save.level,
      difficulty: result.difficulty,
      enemies: result.enemies,
      result: result.outcome,
      rounds: result.rounds,
      xp_earned: rewards.xp,
      gold_earned: rewards.goldCp,
    }).catch(() => {}); // offline is fine

    return { rewards, levelsGained };
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
    createCharacter,
    updateSave,
    forceSave,
    recordBattle,
    setQuestFlag,
    startQuestCooldown,
    changeClass,
  };
}
