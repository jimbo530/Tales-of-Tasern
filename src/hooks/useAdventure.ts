"use client";

import { useState, useEffect } from "react";
import { ADVENTURE_CHAPTERS, type Chapter, type Encounter } from "@/lib/adventureData";

type AdventureState = {
  currentChapter: number;
  currentEncounter: number;
  mftEarned: number;
  completedChapters: string[];
  phase: "map" | "story" | "battle" | "reward" | "chapterComplete" | "victory";
};

const STORAGE_KEY = "tot-adventure";

function loadState(): AdventureState {
  if (typeof window === "undefined") return defaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultState();
}

function defaultState(): AdventureState {
  return {
    currentChapter: 0,
    currentEncounter: 0,
    mftEarned: 0,
    completedChapters: [],
    phase: "map",
  };
}

export function useAdventure() {
  const [state, setState] = useState<AdventureState>(defaultState);

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const chapter: Chapter | null = ADVENTURE_CHAPTERS[state.currentChapter] ?? null;
  const encounter: Encounter | null = chapter?.encounters[state.currentEncounter] ?? null;

  function startChapter(chapterIdx: number) {
    setState(s => ({ ...s, currentChapter: chapterIdx, currentEncounter: 0, phase: "story" }));
  }

  function startBattle() {
    setState(s => ({ ...s, phase: "battle" }));
  }

  function winBattle() {
    if (!encounter) return;
    setState(s => {
      const newMft = s.mftEarned + encounter.mftReward;
      const isLastEncounter = chapter && s.currentEncounter >= chapter.encounters.length - 1;
      if (isLastEncounter) {
        return {
          ...s,
          mftEarned: newMft + (chapter?.completionBonus ?? 0),
          phase: "chapterComplete",
          completedChapters: [...new Set([...s.completedChapters, chapter!.id])],
        };
      }
      return { ...s, mftEarned: newMft, phase: "reward" };
    });
  }

  function loseBattle() {
    // Can retry the same encounter
    setState(s => ({ ...s, phase: "story" }));
  }

  function nextEncounter() {
    setState(s => ({ ...s, currentEncounter: s.currentEncounter + 1, phase: "story" }));
  }

  function backToMap() {
    setState(s => ({ ...s, phase: "map" }));
  }

  function resetAdventure() {
    const fresh = defaultState();
    setState(fresh);
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    state,
    chapter,
    encounter,
    chapters: ADVENTURE_CHAPTERS,
    startChapter,
    startBattle,
    winBattle,
    loseBattle,
    nextEncounter,
    backToMap,
    resetAdventure,
  };
}
