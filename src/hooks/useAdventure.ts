"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ADVENTURE_CHAPTERS, type Chapter, type Encounter } from "@/lib/adventureData";
import { loadAdventureSave, saveAdventure } from "@/lib/supabase";

// Items the party can carry
export type InventoryItem = {
  id: string;        // e.g. "wood", "food-bread", "lumber"
  name: string;
  category: "food" | "resource" | "crafted" | "equipment";
  quantity: number;
  weight: number;    // per unit — total weight = quantity * weight
  icon: string;      // emoji
};

export type AdventureState = {
  currentChapter: number;
  currentEncounter: number;
  mftEarned: number;
  completedChapters: string[];
  chapterCooldowns: Record<string, number>;
  encounterCooldowns: Record<string, number>;
  unlockedNpcs: string[]; // contract addresses of NPCs unlocked via joinsParty
  phase: "map" | "story" | "battle" | "reward" | "chapterComplete" | "victory";
  mapPosition: string; // current node id on the Londa map
  inventory: InventoryItem[];
  carryCapacity: number; // max total weight the party can carry
};

const STORAGE_KEY = "tot-adventure";
const INTRO_KEY = "tot-adventure-intro-seen";

const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

function defaultState(): AdventureState {
  return {
    currentChapter: 0,
    currentEncounter: 0,
    mftEarned: 0,
    completedChapters: [],
    chapterCooldowns: {},
    encounterCooldowns: {},
    unlockedNpcs: [],
    phase: "map",
    mapPosition: "village",
    inventory: [],
    carryCapacity: 50, // base carry capacity (weight units)
  };
}

function loadLocal(): AdventureState {
  if (typeof window === "undefined") return defaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState(), ...parsed };
    }
  } catch {}
  return defaultState();
}

export function useAdventure(wallet?: string) {
  const [state, setState] = useState<AdventureState>(defaultState);
  const [introSeen, setIntroSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load: try cloud first (if wallet connected), fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Always load local first for instant display
      const local = loadLocal();
      const localIntro = typeof window !== "undefined" && localStorage.getItem(INTRO_KEY) === "1";

      if (wallet) {
        try {
          const cloud = await loadAdventureSave(wallet);
          if (!cancelled && cloud) {
            // Use whichever save has more progress
            const cloudState = { ...defaultState(), ...(cloud.state as AdventureState) };
            const cloudProgress = cloudState.completedChapters?.length ?? 0;
            const localProgress = local.completedChapters?.length ?? 0;
            const best = cloudProgress >= localProgress ? cloudState : local;
            setState({ ...defaultState(), ...best, phase: "map" });
            setIntroSeen(cloud.intro_seen || localIntro);
            setLoaded(true);
            return;
          }
        } catch {}
      }
      if (!cancelled) {
        setState(local);
        setIntroSeen(localIntro);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [wallet]);

  // Save to localStorage immediately, debounce cloud save
  const persist = useCallback((newState: AdventureState, newIntroSeen?: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      if (newIntroSeen !== undefined) {
        localStorage.setItem(INTRO_KEY, newIntroSeen ? "1" : "");
      }
    }
    if (wallet) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const intro = newIntroSeen ?? introSeen;
        saveAdventure(wallet, newState, intro);
      }, 2000);
    }
  }, [wallet, introSeen]);

  function update(fn: (s: AdventureState) => AdventureState) {
    setState(s => {
      const next = fn(s);
      persist(next);
      return next;
    });
  }

  const chapter: Chapter | null = ADVENTURE_CHAPTERS[state.currentChapter] ?? null;
  const encounter: Encounter | null = chapter?.encounters[state.currentEncounter] ?? null;

  function markIntroSeen() {
    setIntroSeen(true);
    persist(state, true);
  }

  function startChapter(chapterIdx: number) {
    update(s => {
      const resumeEncounter = s.currentChapter === chapterIdx ? s.currentEncounter : 0;
      return { ...s, currentChapter: chapterIdx, currentEncounter: resumeEncounter, phase: "story" };
    });
  }

  function startEncounter(chapterIdx: number, encounterIdx: number) {
    update(s => ({ ...s, currentChapter: chapterIdx, currentEncounter: encounterIdx, phase: "story" }));
  }

  function startBattle() {
    update(s => ({ ...s, phase: "battle" }));
  }

  function winBattle() {
    if (!encounter || !chapter) return;
    const encKey = `${chapter.id}-${state.currentEncounter}`;
    update(s => {
      const newMft = s.mftEarned + encounter.mftReward;
      const newEncCooldowns = { ...(s.encounterCooldowns ?? {}), [encKey]: Date.now() };
      // Permanently unlock NPC if encounter has joinsParty
      const newUnlocked = [...(s.unlockedNpcs ?? [])];
      if (encounter.joinsParty && !newUnlocked.includes(encounter.joinsParty.toLowerCase())) {
        newUnlocked.push(encounter.joinsParty.toLowerCase());
      }
      const isLastEncounter = s.currentEncounter >= chapter.encounters.length - 1;
      if (isLastEncounter) {
        return {
          ...s,
          mftEarned: newMft + (chapter.completionBonus ?? 0),
          phase: "chapterComplete",
          completedChapters: [...new Set([...s.completedChapters, chapter.id])],
          chapterCooldowns: { ...(s.chapterCooldowns ?? {}), [chapter.id]: Date.now() },
          encounterCooldowns: newEncCooldowns,
          unlockedNpcs: newUnlocked,
        };
      }
      return { ...s, mftEarned: newMft, phase: "reward", encounterCooldowns: newEncCooldowns, unlockedNpcs: newUnlocked };
    });
  }

  function isOnCooldown(chapterId: string): boolean {
    const last = (state.chapterCooldowns ?? {})[chapterId];
    if (!last) return false;
    return Date.now() - last < COOLDOWN_MS;
  }

  function cooldownRemaining(chapterId: string): number {
    const last = (state.chapterCooldowns ?? {})[chapterId];
    if (!last) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  }

  function encounterOnCooldown(chapterId: string, encounterIdx: number): boolean {
    const last = (state.encounterCooldowns ?? {})[`${chapterId}-${encounterIdx}`];
    if (!last) return false;
    const ch = ADVENTURE_CHAPTERS.find(c => c.id === chapterId);
    const cd = ch?.cooldownMs ?? COOLDOWN_MS;
    return Date.now() - last < cd;
  }

  function encounterCooldownRemaining(chapterId: string, encounterIdx: number): number {
    const last = (state.encounterCooldowns ?? {})[`${chapterId}-${encounterIdx}`];
    if (!last) return 0;
    const ch = ADVENTURE_CHAPTERS.find(c => c.id === chapterId);
    const cd = ch?.cooldownMs ?? COOLDOWN_MS;
    return Math.max(0, cd - (Date.now() - last));
  }

  function loseBattle() {
    update(s => ({ ...s, phase: "story" }));
  }

  function nextEncounter() {
    update(s => ({ ...s, currentEncounter: s.currentEncounter + 1, phase: "story" }));
  }

  function backToMap() {
    update(s => ({ ...s, phase: "map" }));
  }

  function resetAdventure() {
    const fresh = defaultState();
    setState(fresh);
    setIntroSeen(false);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INTRO_KEY);
    if (wallet) saveAdventure(wallet, fresh, false);
  }

  function skipLevel(chapterIdx: number) {
    const ch = ADVENTURE_CHAPTERS[chapterIdx];
    if (!ch) return;
    update(s => ({
      ...s,
      completedChapters: [...new Set([...s.completedChapters, ch.id])],
      phase: "map",
    }));
  }

  function setMapPosition(pos: string) {
    update(s => ({ ...s, mapPosition: pos }));
  }

  // Inventory helpers
  function currentWeight(): number {
    return (state.inventory ?? []).reduce((sum, item) => sum + item.quantity * item.weight, 0);
  }

  function addItem(item: Omit<InventoryItem, "quantity"> & { quantity?: number }, qty = 1): boolean {
    const amount = item.quantity ?? qty;
    const itemWeight = amount * item.weight;
    if (currentWeight() + itemWeight > state.carryCapacity) return false; // over capacity
    update(s => {
      const inv = [...(s.inventory ?? [])];
      const existing = inv.find(i => i.id === item.id);
      if (existing) {
        existing.quantity += amount;
      } else {
        inv.push({ ...item, quantity: amount } as InventoryItem);
      }
      return { ...s, inventory: inv };
    });
    return true;
  }

  function removeItem(itemId: string, qty = 1): boolean {
    const existing = (state.inventory ?? []).find(i => i.id === itemId);
    if (!existing || existing.quantity < qty) return false;
    update(s => {
      const inv = (s.inventory ?? []).map(i =>
        i.id === itemId ? { ...i, quantity: i.quantity - qty } : i
      ).filter(i => i.quantity > 0);
      return { ...s, inventory: inv };
    });
    return true;
  }

  function hasItem(itemId: string, qty = 1): boolean {
    const item = (state.inventory ?? []).find(i => i.id === itemId);
    return !!item && item.quantity >= qty;
  }

  function skipEncounter() {
    if (!chapter || !encounter) return;
    update(s => {
      const isLast = s.currentEncounter >= chapter.encounters.length - 1;
      if (isLast) {
        return {
          ...s,
          phase: "chapterComplete",
          completedChapters: [...new Set([...s.completedChapters, chapter.id])],
        };
      }
      return { ...s, currentEncounter: s.currentEncounter + 1, phase: "story" };
    });
  }

  return {
    state,
    loaded,
    introSeen,
    chapter,
    encounter,
    chapters: ADVENTURE_CHAPTERS,
    markIntroSeen,
    startChapter,
    startBattle,
    winBattle,
    loseBattle,
    nextEncounter,
    backToMap,
    resetAdventure,
    skipLevel,
    skipEncounter,
    startEncounter,
    isOnCooldown,
    cooldownRemaining,
    encounterOnCooldown,
    encounterCooldownRemaining,
    setMapPosition,
    addItem,
    removeItem,
    hasItem,
    currentWeight,
  };
}
