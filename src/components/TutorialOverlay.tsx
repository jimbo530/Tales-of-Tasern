"use client";

import { useState } from "react";
import { INTRO_PARAGRAPHS } from "@/lib/lore/intro";
import type { CharacterSave } from "@/lib/saveSystem";

type Props = {
  save: CharacterSave;
  onSetFlag: (flag: string) => void;
};

/**
 * Tutorial overlay — two phases:
 * 1. Intro lore modal (shown once, sets "intro_seen" flag)
 * 2. Persistent guidance banner (infers step from game state)
 *    - Step 1: Buy gear at the Market
 *    - Step 2: Hire a companion
 *    - Step 3: Explore the outskirts
 *    - Auto-completes after first battle win
 */
export function TutorialOverlay({ save, onSetFlag }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [introPage, setIntroPage] = useState(0);
  const introSeen = save.quest_flags?.intro_seen;
  const tutorialComplete = save.quest_flags?.tutorial_complete;

  // Auto-complete tutorial after first battle win
  if (save.battles_won > 0 && !tutorialComplete) {
    onSetFlag("tutorial_complete");
    return null;
  }

  if (tutorialComplete) return null;

  // ── Phase 1: Intro Lore Modal ──
  if (!introSeen) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}>
        <div style={{
          maxWidth: 640, width: "100%",
          background: "linear-gradient(135deg, rgba(30,25,15,0.98), rgba(20,18,12,0.98))",
          border: "2px solid rgba(201,168,76,0.3)",
          borderRadius: 16, padding: "2rem",
          maxHeight: "85vh", overflow: "auto",
        }}>
          <h2 style={{
            color: "#f0d070", fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
            fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.15em",
            textAlign: "center", marginBottom: "1.5rem", textTransform: "uppercase",
          }}>
            Tales of Tasern
          </h2>

          <p style={{
            color: "rgba(232,213,176,0.85)", lineHeight: 1.75,
            fontSize: "0.875rem", marginBottom: "1.5rem",
            fontFamily: "'EB Garamond', 'Garamond', serif",
          }}>
            {INTRO_PARAGRAPHS[introPage]}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(201,168,76,0.4)", fontSize: "0.7rem" }}>
              {introPage + 1} / {INTRO_PARAGRAPHS.length}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {introPage > 0 && (
                <button
                  onClick={() => setIntroPage(p => p - 1)}
                  style={{
                    padding: "0.5rem 1rem", borderRadius: 8, fontSize: "0.75rem",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    background: "rgba(255,255,255,0.05)", color: "rgba(201,168,76,0.5)",
                    border: "1px solid rgba(201,168,76,0.15)", cursor: "pointer",
                  }}>
                  Back
                </button>
              )}
              {introPage < INTRO_PARAGRAPHS.length - 1 ? (
                <button
                  onClick={() => setIntroPage(p => p + 1)}
                  style={{
                    padding: "0.5rem 1.5rem", borderRadius: 8, fontSize: "0.75rem",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    background: "rgba(201,168,76,0.2)", color: "rgba(201,168,76,0.9)",
                    border: "1px solid rgba(201,168,76,0.4)", cursor: "pointer",
                  }}>
                  Continue
                </button>
              ) : (
                <button
                  onClick={() => onSetFlag("intro_seen")}
                  style={{
                    padding: "0.5rem 1.5rem", borderRadius: 8, fontSize: "0.75rem",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    background: "rgba(96,165,250,0.2)", color: "rgba(96,165,250,0.9)",
                    border: "1px solid rgba(96,165,250,0.4)", cursor: "pointer",
                  }}>
                  Begin Adventure
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 2: Tutorial Banner ──
  if (dismissed) return null;

  const hasWeapon = !!save.equipment?.weapon;
  const hasArmor = !!save.equipment?.armor;
  const hasGear = hasWeapon || hasArmor;
  const hasFollowers = save.party?.heroes?.[0]?.followers?.some(f => f.alive) ?? false;

  let step: number;
  let message: string;
  let hint: string;

  if (!hasGear) {
    step = 1;
    message = "You have 100gp to spend. Visit the Market district to buy a weapon and armor.";
    hint = "Click on Kardov's Gate (your current hex) to see the city districts.";
  } else if (!hasFollowers) {
    step = 2;
    message = "Well armed! Now visit the Mercenary Guild to hire a companion.";
    hint = "The wilds are dangerous alone. Followers fight alongside you in battle.";
  } else {
    step = 3;
    message = "Your party is ready! Click a nearby hex to explore the outskirts.";
    hint = "Each hex triggers a world luck roll. Stay close to the city at first.";
  }

  return (
    <div style={{
      position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
      zIndex: 50, maxWidth: 520, width: "calc(100% - 2rem)",
      background: "linear-gradient(135deg, rgba(30,60,30,0.95), rgba(20,40,20,0.95))",
      border: "1px solid rgba(120,200,80,0.3)",
      borderRadius: 12, padding: "0.75rem 1rem",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{
              fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.15em", color: "rgba(120,200,80,0.7)",
              background: "rgba(120,200,80,0.1)", padding: "2px 6px", borderRadius: 4,
            }}>
              Step {step}/3
            </span>
            <span style={{ fontSize: "0.6rem", color: "rgba(120,200,80,0.4)" }}>Tutorial</span>
          </div>
          <p style={{ color: "rgba(232,213,176,0.9)", fontSize: "0.8rem", margin: 0, lineHeight: 1.4 }}>
            {message}
          </p>
          <p style={{ color: "rgba(232,213,176,0.5)", fontSize: "0.7rem", margin: "0.25rem 0 0", lineHeight: 1.3, fontStyle: "italic" }}>
            {hint}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none", border: "none", color: "rgba(232,213,176,0.4)",
            cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0,
          }}
          title="Dismiss tutorial"
        >
          x
        </button>
      </div>
    </div>
  );
}
