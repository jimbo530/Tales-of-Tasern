"use client";

/**
 * CombatUI — Canvas + DOM Combat Renderer for Tales of Tasern
 *
 * Provides a rich visual layer for D20 hex combat:
 *   - HTML5 Canvas battle map with animations (slash, projectile, particle, AoE)
 *   - DOM overlays: turn order bar, action bar, ability/item/spell submenus
 *   - Floating damage numbers (color-coded, sized by magnitude)
 *   - Victory/Defeat screens with XP/loot
 *   - Integrates with useHexBattle hook + classAbilitySystem + manaSystem
 *
 * Drop-in alongside HexBattle.tsx — same state shape, upgraded visuals.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { BattlePhase } from "@/hooks/useHexBattle";
import {
  type BattleUnit,
  type CombatLogEntry,
  type AttackResult,
  isConscious,
  isUnconscious,
  isDead,
  isAlive,
} from "@/lib/hexCombat";
import {
  type HexCoord,
  hexToPixel,
  hexDistance,
  GRID_COLS,
  GRID_ROWS,
  HEX_SIZE,
  hexPolygonPoints,
  allHexes,
  gridPixelDimensions,
} from "@/lib/hexGrid";
import type { ClassAbility } from "@/lib/classAbilitySystem";
import type { ManaPool, CooldownTracker } from "@/lib/manaSystem";

// ── Types ────────────────────────────────────────────────────────────────────

export type AnimationType =
  | "melee_slash"
  | "ranged_projectile"
  | "magic_burst"
  | "healing_rise"
  | "aoe_expand"
  | "critical_shake"
  | "death_dissolve";

type DamagePopup = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  opacity: number;
  age: number; // ms since creation
};

type Animation = {
  id: string;
  type: AnimationType;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
  duration: number;
  color: string;
  particles?: Particle[];
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
};

export type CombatAction = {
  type: "attack" | "ability" | "item" | "defend" | "flee" | "move" | "end_turn";
  abilityId?: string;
  itemId?: string;
  targetId?: string;
  targetHex?: HexCoord;
};

export type AbilityDisplay = {
  id: string;
  name: string;
  manaCost: number;
  cooldownRemaining: number;
  cooldownMax: number;
  targetType: string;
  range: number;
  damageType?: string;
  description: string;
  canUse: boolean;
  reason?: string; // why it can't be used
};

export type Reward = {
  xp: number;
  goldCp: number;
  loot: { name: string; rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary" }[];
  levelsGained: number;
  newLevel: number;
};

type CombatUIProps = {
  // State from useHexBattle
  units: BattleUnit[];
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;
  phase: BattlePhase;
  combatLog: CombatLogEntry[];
  reachableHexes: HexCoord[];
  attackableEnemies: string[];

  // Active unit info
  activeUnit: BattleUnit | null;
  isPlayerTurn: boolean;

  // Mana/Ability state
  manaPool?: ManaPool;
  cooldowns?: CooldownTracker;
  availableAbilities?: AbilityDisplay[];

  // Callbacks
  onHexClick: (hex: HexCoord) => void;
  onAction: (action: CombatAction) => void;
  onAbilitySelect?: (abilityId: string) => void;
  onTargetSelect?: (unitId: string) => void;

  // Battle end
  rewards?: Reward | null;
  onContinue?: () => void;
  onDefeatChoice?: (choice: "perish" | "rescue") => void;

  // Display options
  mapImage?: string;
  questName?: string;
  dungeonInfo?: { name: string; roomIndex: number; totalRooms: number };
};

// ── Constants ────────────────────────────────────────────────────────────────

const POPUP_DURATION = 1500;
const ANIMATION_DURATION_MELEE = 300;
const ANIMATION_DURATION_RANGED = 500;
const ANIMATION_DURATION_MAGIC = 600;
const ANIMATION_DURATION_HEAL = 800;
const ANIMATION_DURATION_AOE = 700;
const SHAKE_DURATION = 400;

const DAMAGE_COLORS: Record<string, string> = {
  normal: "#ffffff",
  crit: "#fbbf24",
  fire: "#ef4444",
  cold: "#60a5fa",
  lightning: "#facc15",
  radiant: "#fef08a",
  necrotic: "#a855f7",
  poison: "#22c55e",
  healing: "#4ade80",
  miss: "#6b7280",
};

// ── Canvas Rendering Helpers ─────────────────────────────────────────────────

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  stroke: string,
  lineWidth: number = 1.5
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: BattleUnit,
  cx: number,
  cy: number,
  isActive: boolean,
  imageCache: Map<string, HTMLImageElement>
) {
  const r = HEX_SIZE * 0.55;
  const unconscious = isUnconscious(unit);
  const hpPct = Math.max(0, unit.currentHp) / unit.maxHp;

  // Pulsing border for active unit
  if (isActive) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + pulse * 0.6})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Token circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = unconscious ? "rgba(40, 20, 20, 0.8)" : "rgba(0, 0, 0, 0.7)";
  ctx.fill();
  const borderColor = unconscious
    ? "rgba(120, 80, 80, 0.6)"
    : unit.isPlayer
      ? "rgba(96, 165, 250, 0.9)"
      : "rgba(220, 38, 38, 0.9)";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Character image or emoji fallback
  const imgSrc = unit.imageUrl;
  if (imgSrc && imageCache.has(imgSrc)) {
    const img = imageCache.get(imgSrc)!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - r + 2, cy - r + 2, (r - 2) * 2, (r - 2) * 2);
    ctx.restore();
  } else {
    // Emoji fallback
    ctx.font = `${r * 1.2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(unit.imageEmoji ?? "\u2694\uFE0F", cx, cy);
  }

  // HP bar
  const barWidth = r * 2;
  const barHeight = 5;
  const barX = cx - r;
  const barY = cy + r + 4;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const hpColor = unconscious
    ? "rgba(120, 80, 80, 0.9)"
    : hpPct > 0.5
      ? "rgba(74, 222, 128, 0.9)"
      : hpPct > 0.25
        ? "rgba(251, 191, 36, 0.9)"
        : "rgba(220, 38, 38, 0.9)";
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);

  // Mana bar (if unit has spell slots)
  if (unit.spellSlots && unit.spellSlots.length > 0) {
    const totalSlots = unit.spellSlots.reduce((a, b) => a + b, 0);
    const usedSlots = (unit.spellSlotsUsed ?? []).reduce((a, b) => a + b, 0);
    const manaPct = totalSlots > 0 ? Math.max(0, 1 - usedSlots / totalSlots) : 1;
    const manaBarY = barY + barHeight + 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(barX, manaBarY, barWidth, 3);
    ctx.fillStyle = "rgba(96, 165, 250, 0.9)";
    ctx.fillRect(barX, manaBarY, barWidth * manaPct, 3);
  }

  // Name
  ctx.font = "bold 8px 'Cinzel', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(232, 213, 176, 0.7)";
  const displayName = unit.name.length > 12 ? unit.name.slice(0, 10) + ".." : unit.name;
  ctx.fillText(displayName, cx, cy + r + 14);

  // Status effects icons row
  if (unit.activeEffects.length > 0) {
    const effectY = cy - r - 12;
    const iconSize = 8;
    const startX = cx - (unit.activeEffects.length * (iconSize + 2)) / 2;
    unit.activeEffects.forEach((eff, i) => {
      const ex = startX + i * (iconSize + 2);
      const isBuff = !!(eff.buffAC || eff.buffAtk || eff.buffDmg || eff.buffSave || eff.buffSpeed);
      ctx.fillStyle = isBuff
        ? "rgba(74, 222, 128, 0.8)"
        : eff.condition
          ? "rgba(220, 38, 38, 0.8)"
          : "rgba(251, 191, 36, 0.8)";
      ctx.fillRect(ex, effectY, iconSize, iconSize);
      ctx.font = "6px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = eff.condition === "poisoned" ? "P"
        : eff.condition === "stunned" ? "S"
        : eff.condition === "frightened" ? "F"
        : eff.condition === "entangled" ? "E"
        : eff.condition === "blinded" ? "B"
        : isBuff ? "+" : "-";
      ctx.fillText(icon, ex + iconSize / 2, effectY + iconSize / 2);
    });
  }

  // Unconscious overlay
  if (unconscious) {
    ctx.globalAlpha = 0.5;
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = unit.stabilized ? "rgba(251, 191, 36, 0.9)" : "rgba(220, 38, 38, 0.9)";
    ctx.fillText(
      unit.stabilized ? "STABLE" : `DYING (${unit.currentHp})`,
      cx,
      cy + r + 24
    );
    ctx.globalAlpha = 1;
  }
}

function drawAnimation(ctx: CanvasRenderingContext2D, anim: Animation, elapsed: number) {
  const progress = Math.min(1, elapsed / anim.duration);

  switch (anim.type) {
    case "melee_slash": {
      // Slash line from attacker to target with trail
      const x = anim.fromX + (anim.toX - anim.fromX) * progress;
      const y = anim.fromY + (anim.toY - anim.fromY) * progress;
      const trailLength = 20;
      const angle = Math.atan2(anim.toY - anim.fromY, anim.toX - anim.fromX);
      const perpAngle = angle + Math.PI / 2;

      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.5;
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3 * (1 - progress * 0.5);
      ctx.lineCap = "round";

      // Main slash
      ctx.beginPath();
      ctx.moveTo(
        x - Math.cos(perpAngle) * trailLength * (1 - progress),
        y - Math.sin(perpAngle) * trailLength * (1 - progress)
      );
      ctx.lineTo(
        x + Math.cos(perpAngle) * trailLength * (1 - progress),
        y + Math.sin(perpAngle) * trailLength * (1 - progress)
      );
      ctx.stroke();

      // Impact flash at target
      if (progress > 0.7) {
        const flashAlpha = (1 - progress) * 3;
        ctx.globalAlpha = flashAlpha;
        ctx.beginPath();
        ctx.arc(anim.toX, anim.toY, 15 * progress, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case "ranged_projectile": {
      // Arcing projectile
      const x = anim.fromX + (anim.toX - anim.fromX) * progress;
      const arcHeight = -40 * Math.sin(progress * Math.PI);
      const y = anim.fromY + (anim.toY - anim.fromY) * progress + arcHeight;

      ctx.save();
      ctx.globalAlpha = 1;

      // Trail
      for (let i = 0; i < 5; i++) {
        const t = Math.max(0, progress - i * 0.05);
        const tx = anim.fromX + (anim.toX - anim.fromX) * t;
        const ty = anim.fromY + (anim.toY - anim.fromY) * t + (-40 * Math.sin(t * Math.PI));
        ctx.beginPath();
        ctx.arc(tx, ty, 2 - i * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = anim.color;
        ctx.globalAlpha = 0.3 - i * 0.05;
        ctx.fill();
      }

      // Projectile head
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = anim.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
      break;
    }

    case "magic_burst": {
      // Particle burst at target
      ctx.save();
      const burstProgress = progress;
      const numParticles = 12;
      for (let i = 0; i < numParticles; i++) {
        const angle = (Math.PI * 2 * i) / numParticles + burstProgress * 0.5;
        const dist = burstProgress * 30;
        const px = anim.toX + Math.cos(angle) * dist;
        const py = anim.toY + Math.sin(angle) * dist;
        const size = 4 * (1 - burstProgress);
        ctx.globalAlpha = 1 - burstProgress;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = anim.color;
        ctx.fill();
      }

      // Central flash
      if (burstProgress < 0.3) {
        ctx.globalAlpha = 1 - burstProgress * 3;
        ctx.beginPath();
        ctx.arc(anim.toX, anim.toY, 20 * burstProgress, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case "healing_rise": {
      // Green particles rising
      ctx.save();
      const numP = 8;
      for (let i = 0; i < numP; i++) {
        const offset = (i / numP) * Math.PI * 2;
        const riseProg = (progress + i * 0.1) % 1;
        const px = anim.toX + Math.sin(offset + progress * 3) * 12;
        const py = anim.toY - riseProg * 40;
        const size = 3 * (1 - riseProg);
        ctx.globalAlpha = 1 - riseProg;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = anim.color || "#4ade80";
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case "aoe_expand": {
      // Expanding circle
      ctx.save();
      const radius = progress * 50;
      ctx.globalAlpha = 0.6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(anim.toX, anim.toY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.stroke();
      ctx.fillStyle = anim.color;
      ctx.globalAlpha = 0.1 * (1 - progress);
      ctx.fill();
      ctx.restore();
      break;
    }

    case "death_dissolve": {
      // Particles fading out from unit position
      ctx.save();
      const numD = 15;
      for (let i = 0; i < numD; i++) {
        const angle = (Math.PI * 2 * i) / numD;
        const dist = progress * 25 + Math.random() * 5;
        const px = anim.toX + Math.cos(angle) * dist;
        const py = anim.toY + Math.sin(angle) * dist - progress * 10;
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 2 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = anim.color || "#6b7280";
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    default:
      break;
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CombatUI({
  units,
  turnOrder,
  currentTurnIndex,
  round,
  phase,
  combatLog,
  reachableHexes,
  attackableEnemies,
  activeUnit,
  isPlayerTurn,
  manaPool,
  cooldowns,
  availableAbilities,
  onHexClick,
  onAction,
  onAbilitySelect,
  onTargetSelect,
  rewards,
  onContinue,
  onDefeatChoice,
  mapImage,
  questName,
  dungeonInfo,
}: CombatUIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const [showAbilities, setShowAbilities] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [targetingMode, setTargetingMode] = useState<string | null>(null); // ability ID being targeted
  const logRef = useRef<HTMLDivElement>(null);
  const prevLogLen = useRef(0);
  const [mapImageEl, setMapImageEl] = useState<HTMLImageElement | null>(null);

  // Canvas dimensions
  const { width: canvasW, height: canvasH } = useMemo(() => gridPixelDimensions(), []);

  // Sets for quick lookup
  const reachableSet = useMemo(
    () => new Set(reachableHexes.map((h) => `${h.q},${h.r}`)),
    [reachableHexes]
  );
  const attackablePositions = useMemo(
    () => new Set(units.filter((u) => attackableEnemies.includes(u.id)).map((u) => `${u.position.q},${u.position.r}`)),
    [units, attackableEnemies]
  );

  // Turn order sorted by initiative
  const turnOrderUnits = useMemo(() => {
    return turnOrder
      .map((id) => units.find((u) => u.id === id))
      .filter((u): u is BattleUnit => !!u);
  }, [turnOrder, units]);

  // Load map image
  useEffect(() => {
    if (!mapImage) { setMapImageEl(null); return; }
    const img = new Image();
    img.src = mapImage;
    img.onload = () => setMapImageEl(img);
  }, [mapImage]);

  // Preload unit images
  useEffect(() => {
    for (const unit of units) {
      const src = unit.imageUrl;
      if (src && !imageCache.current.has(src)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src.startsWith("/") ? src : `/api/images?url=${encodeURIComponent(src)}`;
        img.onload = () => imageCache.current.set(src, img);
        imageCache.current.set(src, img); // set placeholder to prevent re-loading
      }
    }
  }, [units]);

  // Auto-scroll combat log
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [combatLog.length]);

  // Detect new log entries to spawn damage popups
  useEffect(() => {
    const newEntries = combatLog.slice(prevLogLen.current);
    prevLogLen.current = combatLog.length;
    if (newEntries.length === 0) return;

    const newPopups: DamagePopup[] = [];
    for (const entry of newEntries) {
      // Damage detection
      const dmgMatch =
        entry.text.match(/(\d+)\s*(?:damage|dmg)/i);
      const healMatch = entry.text.match(/heals?\s+.*?(\d+)/i);
      const isCrit = entry.type === "crit";
      const isMiss = entry.type === "miss";

      let targetUnit: BattleUnit | undefined;
      // Try to find target unit from log text
      for (const u of units) {
        if (entry.text.toLowerCase().includes(u.name.toLowerCase())) {
          if (!u.isPlayer || healMatch) {
            targetUnit = u;
            break;
          }
        }
      }
      // Fallback: use active enemy for damage, active player for heals
      if (!targetUnit && dmgMatch) {
        targetUnit = units.find((u) => !u.isPlayer && isConscious(u));
      }

      if (targetUnit && (dmgMatch || healMatch || isMiss)) {
        const { x, y } = hexToPixel(targetUnit.position);
        const amount = dmgMatch ? parseInt(dmgMatch[1]) : healMatch ? parseInt(healMatch[1]) : 0;
        const color = isMiss
          ? DAMAGE_COLORS.miss
          : healMatch
            ? DAMAGE_COLORS.healing
            : isCrit
              ? DAMAGE_COLORS.crit
              : DAMAGE_COLORS.normal;
        const text = isMiss ? "MISS" : healMatch ? `+${amount}` : `-${amount}`;
        const size = isMiss ? 12 : Math.min(24, 12 + Math.floor(amount / 5));

        newPopups.push({
          id: `${Date.now()}-${entry.id}-${Math.random()}`,
          x: x + (Math.random() - 0.5) * 20,
          y: y - HEX_SIZE * 0.3,
          text,
          color,
          size,
          opacity: 1,
          age: 0,
        });
      }

      // Spawn animations for hits
      if (dmgMatch && !isMiss) {
        const attacker = activeUnit;
        if (attacker && targetUnit) {
          const from = hexToPixel(attacker.position);
          const to = hexToPixel(targetUnit.position);
          const dist = hexDistance(attacker.position, targetUnit.position);

          let animType: AnimationType = "melee_slash";
          let duration = ANIMATION_DURATION_MELEE;
          let color = "#ffffff";

          if (dist > 2 || attacker.isRanged) {
            animType = "ranged_projectile";
            duration = ANIMATION_DURATION_RANGED;
            color = "#f97316";
          }
          if (entry.text.includes("fire") || entry.text.includes("Fire")) {
            animType = "magic_burst";
            duration = ANIMATION_DURATION_MAGIC;
            color = "#ef4444";
          }
          if (entry.text.includes("lightning") || entry.text.includes("Lightning")) {
            animType = "magic_burst";
            duration = ANIMATION_DURATION_MAGIC;
            color = "#facc15";
          }
          if (isCrit) {
            // Screen shake on crit
            triggerShake();
          }

          setAnimations((prev) => [
            ...prev,
            {
              id: `anim-${Date.now()}-${Math.random()}`,
              type: animType,
              fromX: from.x,
              fromY: from.y,
              toX: to.x,
              toY: to.y,
              startTime: Date.now(),
              duration,
              color,
            },
          ]);
        }
      }

      // Healing animation
      if (healMatch && targetUnit) {
        const to = hexToPixel(targetUnit.position);
        setAnimations((prev) => [
          ...prev,
          {
            id: `anim-heal-${Date.now()}`,
            type: "healing_rise",
            fromX: to.x,
            fromY: to.y,
            toX: to.x,
            toY: to.y,
            startTime: Date.now(),
            duration: ANIMATION_DURATION_HEAL,
            color: "#4ade80",
          },
        ]);
      }

      // Death animation
      if (entry.type === "kill") {
        const deadUnit = units.find(
          (u) => isDead(u) && entry.text.toLowerCase().includes(u.name.toLowerCase())
        );
        if (deadUnit) {
          const pos = hexToPixel(deadUnit.position);
          setAnimations((prev) => [
            ...prev,
            {
              id: `anim-death-${Date.now()}`,
              type: "death_dissolve",
              fromX: pos.x,
              fromY: pos.y,
              toX: pos.x,
              toY: pos.y,
              startTime: Date.now(),
              duration: 1000,
              color: "#6b7280",
            },
          ]);
        }
      }
    }

    if (newPopups.length > 0) {
      setPopups((prev) => [...prev, ...newPopups]);
    }
  }, [combatLog, units, activeUnit]);

  // Screen shake
  function triggerShake() {
    const start = Date.now();
    const shakeInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > SHAKE_DURATION) {
        clearInterval(shakeInterval);
        setShakeOffset({ x: 0, y: 0 });
        return;
      }
      const intensity = 5 * (1 - elapsed / SHAKE_DURATION);
      setShakeOffset({
        x: (Math.random() - 0.5) * intensity * 2,
        y: (Math.random() - 0.5) * intensity * 2,
      });
    }, 16);
  }

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    function render() {
      if (!running || !ctx || !canvas) return;
      const now = Date.now();

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply shake
      ctx.save();
      ctx.translate(shakeOffset.x, shakeOffset.y);

      // Background map image
      if (mapImageEl) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(mapImageEl, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }

      // Draw hex grid
      const allHexCoords = allHexes();
      for (const hex of allHexCoords) {
        const { x, y } = hexToPixel(hex);
        const key = `${hex.q},${hex.r}`;
        const isReachable = reachableSet.has(key);
        const isAttackable = attackablePositions.has(key);
        const unitOnHex = units.find(
          (u) => isAlive(u) && u.position.q === hex.q && u.position.r === hex.r
        );
        const isActiveHex = unitOnHex && activeUnit && unitOnHex.id === activeUnit.id;

        let fill = "rgba(201, 168, 76, 0.04)";
        let stroke = "rgba(201, 168, 76, 0.12)";

        if (isReachable) {
          fill = "rgba(74, 222, 128, 0.15)";
          stroke = "rgba(74, 222, 128, 0.45)";
        }
        if (isAttackable) {
          fill = "rgba(220, 38, 38, 0.2)";
          stroke = "rgba(220, 38, 38, 0.55)";
        }
        if (targetingMode) {
          // Highlight valid targets for abilities
          if (unitOnHex && !unitOnHex.isPlayer && isConscious(unitOnHex)) {
            fill = "rgba(168, 85, 247, 0.25)";
            stroke = "rgba(168, 85, 247, 0.6)";
          }
        }
        if (isActiveHex) {
          fill = "rgba(96, 165, 250, 0.15)";
          stroke = "rgba(96, 165, 250, 0.55)";
        }

        drawHexagon(ctx, x, y, HEX_SIZE, fill, stroke);
      }

      // Draw units
      for (const unit of units) {
        if (!isAlive(unit)) continue;
        const { x, y } = hexToPixel(unit.position);
        const isActive = activeUnit?.id === unit.id;
        drawUnit(ctx, unit, x, y, isActive, imageCache.current);
      }

      // Draw animations
      const activeAnims: Animation[] = [];
      for (const anim of animations) {
        const elapsed = now - anim.startTime;
        if (elapsed < anim.duration) {
          drawAnimation(ctx, anim, elapsed);
          activeAnims.push(anim);
        }
      }
      if (activeAnims.length !== animations.length) {
        setAnimations(activeAnims);
      }

      // Draw damage popups
      const activePopups: DamagePopup[] = [];
      for (const popup of popups) {
        const age = now - parseInt(popup.id.split("-")[0]);
        if (age < POPUP_DURATION) {
          const progress = age / POPUP_DURATION;
          const yOffset = -progress * 30;
          const alpha = 1 - progress * progress; // ease out
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `bold ${popup.size}px 'Cinzel', serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Outline
          ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
          ctx.lineWidth = 3;
          ctx.strokeText(popup.text, popup.x, popup.y + yOffset);
          // Fill
          ctx.fillStyle = popup.color;
          ctx.fillText(popup.text, popup.x, popup.y + yOffset);
          ctx.restore();
          activePopups.push(popup);
        }
      }
      if (activePopups.length !== popups.length) {
        setPopups(activePopups);
      }

      ctx.restore(); // undo shake transform

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    units,
    reachableSet,
    attackablePositions,
    activeUnit,
    animations,
    popups,
    shakeOffset,
    mapImageEl,
    targetingMode,
  ]);

  // Canvas click handler — translate pixel to hex
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;

      // Find closest hex
      let closest: HexCoord | null = null;
      let minDist = Infinity;
      for (const hex of allHexes()) {
        const { x, y } = hexToPixel(hex);
        const d = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
        if (d < HEX_SIZE && d < minDist) {
          minDist = d;
          closest = hex;
        }
      }

      if (closest) {
        // If in targeting mode, find unit on hex and call target select
        if (targetingMode) {
          const targetUnit = units.find(
            (u) => u.position.q === closest!.q && u.position.r === closest!.r && isConscious(u)
          );
          if (targetUnit && onTargetSelect) {
            onTargetSelect(targetUnit.id);
            setTargetingMode(null);
          }
          return;
        }
        onHexClick(closest);
      }
    },
    [onHexClick, units, targetingMode, onTargetSelect]
  );

  // ── Ability handler ──
  const handleAbilityClick = useCallback(
    (ability: AbilityDisplay) => {
      if (!ability.canUse) return;
      setShowAbilities(false);
      if (ability.targetType === "self" || ability.targetType === "allAllies" || ability.targetType === "none") {
        onAction({ type: "ability", abilityId: ability.id });
      } else {
        // Enter targeting mode
        setTargetingMode(ability.id);
        if (onAbilitySelect) onAbilitySelect(ability.id);
      }
    },
    [onAction, onAbilitySelect]
  );

  // ── Phase label ──
  function getPhaseLabel(): string {
    switch (phase) {
      case "playerTurn": return "Your Turn";
      case "playerRoll": return "Roll to Attack";
      case "playerResult": return "Attack Result";
      case "playerReaction": return "Reaction!";
      case "enemyTurn": return "Enemy Turn";
      case "victory": return "Victory!";
      case "defeat": return "Defeat!";
      case "room_cleared": return "Room Cleared";
      default: return "";
    }
  }

  // ── Victory Screen ──
  if (phase === "victory" && rewards) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl" style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(20,30,10,0.95) 100%)",
        border: "2px solid rgba(74, 222, 128, 0.4)",
        boxShadow: "0 0 40px rgba(74, 222, 128, 0.15)",
        maxWidth: 500,
        margin: "0 auto",
      }}>
        <h2 className="text-3xl font-black tracking-widest uppercase" style={{
          color: "#4ade80",
          fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
          textShadow: "0 0 20px rgba(74, 222, 128, 0.5)",
        }}>
          Victory!
        </h2>

        {/* XP */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between items-center px-4 py-2 rounded-lg" style={{
            background: "rgba(251, 191, 36, 0.1)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
          }}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "rgba(251, 191, 36, 0.9)" }}>
              Experience
            </span>
            <span className="text-lg font-black" style={{ color: "#fbbf24" }}>
              +{rewards.xp} XP
            </span>
          </div>

          {/* Level up */}
          {rewards.levelsGained > 0 && (
            <div className="px-4 py-3 rounded-lg text-center" style={{
              background: "rgba(168, 85, 247, 0.15)",
              border: "2px solid rgba(168, 85, 247, 0.5)",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.2)",
            }}>
              <span className="text-lg font-black uppercase tracking-widest" style={{
                color: "#a855f7",
                fontFamily: "'Cinzel Decorative', serif",
              }}>
                Level Up! {rewards.newLevel - rewards.levelsGained} → {rewards.newLevel}
              </span>
            </div>
          )}

          {/* Gold */}
          <div className="flex justify-between items-center px-4 py-2 rounded-lg" style={{
            background: "rgba(201, 168, 76, 0.08)",
            border: "1px solid rgba(201, 168, 76, 0.25)",
          }}>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "rgba(201, 168, 76, 0.8)" }}>
              Gold
            </span>
            <span className="text-lg font-black" style={{ color: "rgba(201, 168, 76, 0.9)" }}>
              {Math.floor(rewards.goldCp / 100)} gp {Math.floor((rewards.goldCp % 100) / 10)} sp {rewards.goldCp % 10} cp
            </span>
          </div>

          {/* Loot */}
          {rewards.loot.length > 0 && (
            <div className="px-4 py-3 rounded-lg" style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}>
              <span className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "rgba(201, 168, 76, 0.6)" }}>
                Loot
              </span>
              <div className="flex flex-col gap-1">
                {rewards.loot.map((item, i) => {
                  const rarityColor = item.rarity === "legendary" ? "#fbbf24"
                    : item.rarity === "epic" ? "#a855f7"
                    : item.rarity === "rare" ? "#3b82f6"
                    : item.rarity === "uncommon" ? "#22c55e"
                    : "rgba(232, 213, 176, 0.8)";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: rarityColor,
                        boxShadow: item.rarity === "legendary" || item.rarity === "epic"
                          ? `0 0 8px ${rarityColor}` : "none",
                        display: "inline-block",
                      }} />
                      <span className="text-sm" style={{ color: rarityColor }}>
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onContinue}
          className="w-full px-8 py-4 rounded-xl text-lg font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
          style={{
            background: "rgba(74, 222, 128, 0.15)",
            color: "#4ade80",
            border: "2px solid rgba(74, 222, 128, 0.4)",
            fontFamily: "'Cinzel Decorative', serif",
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  // ── Defeat Screen ──
  if (phase === "defeat") {
    return (
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl" style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(30,10,10,0.95) 100%)",
        border: "2px solid rgba(220, 38, 38, 0.4)",
        boxShadow: "0 0 40px rgba(220, 38, 38, 0.15)",
        maxWidth: 500,
        margin: "0 auto",
      }}>
        <h2 className="text-3xl font-black tracking-widest uppercase" style={{
          color: "#ef4444",
          fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
          textShadow: "0 0 20px rgba(220, 38, 38, 0.5)",
        }}>
          Defeat
        </h2>
        <p className="text-center" style={{ color: "rgba(232, 213, 176, 0.6)", fontFamily: "'Cinzel', serif" }}>
          Your party has fallen...
        </p>

        {onDefeatChoice && (
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => onDefeatChoice("rescue")}
              className="w-full px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(251, 191, 36, 0.12)",
                color: "rgba(251, 191, 36, 0.9)",
                border: "1px solid rgba(251, 191, 36, 0.3)",
              }}
            >
              Return to Town (Lose 10% Gold)
            </button>
            <button
              onClick={() => onDefeatChoice("perish")}
              className="w-full px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                color: "rgba(220, 38, 38, 0.7)",
                border: "1px solid rgba(220, 38, 38, 0.2)",
              }}
            >
              Perish (Reset to Last Save)
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Main Combat Layout ──
  return (
    <div className="flex flex-col gap-2 w-full max-w-5xl mx-auto">
      {/* Header: Round + Phase */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg" style={{
        background: "rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(201, 168, 76, 0.2)",
      }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(201, 168, 76, 0.6)" }}>
          {dungeonInfo
            ? `${dungeonInfo.name} ${dungeonInfo.roomIndex + 1}/${dungeonInfo.totalRooms}`
            : questName ?? "Combat"}
        </span>
        <span className="text-sm font-black tracking-widest uppercase" style={{
          color: "#f0d070",
          fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
        }}>
          Round {round} - {getPhaseLabel()}
        </span>
        {isPlayerTurn && phase === "playerTurn" && (
          <button
            onClick={() => onAction({ type: "end_turn" })}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
            style={{
              background: "rgba(220, 38, 38, 0.15)",
              color: "rgba(220, 38, 38, 0.8)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
            }}
          >
            End Turn
          </button>
        )}
      </div>

      {/* Turn Order Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg overflow-x-auto" style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(201, 168, 76, 0.1)",
      }}>
        <span style={{
          fontSize: "0.5rem",
          color: "rgba(201, 168, 76, 0.5)",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}>
          Turn
        </span>
        {turnOrderUnits.slice(0, 10).map((u, i) => {
          const isCurrent = u.id === turnOrder[currentTurnIndex];
          const dead = isDead(u);
          const unconscious = isUnconscious(u);
          const borderColor = dead
            ? "rgba(100, 100, 100, 0.3)"
            : unconscious
              ? "rgba(120, 80, 80, 0.5)"
              : isCurrent
                ? "rgba(251, 191, 36, 1)"
                : u.isPlayer
                  ? "rgba(96, 165, 250, 0.7)"
                  : "rgba(220, 38, 38, 0.6)";
          const bgColor = dead
            ? "rgba(50, 50, 50, 0.4)"
            : isCurrent
              ? "rgba(251, 191, 36, 0.15)"
              : "rgba(0, 0, 0, 0.3)";

          return (
            <div
              key={u.id}
              className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded"
              style={{
                background: bgColor,
                border: `1.5px solid ${borderColor}`,
                boxShadow: isCurrent ? "0 0 8px rgba(251, 191, 36, 0.4)" : "none",
                opacity: dead ? 0.4 : 1,
              }}
              title={`${u.name} (Init ${Math.round(u.stats.initiative)})`}
            >
              <span style={{
                fontSize: "0.6rem",
                fontWeight: 800,
                color: dead ? "rgba(100, 100, 100, 0.5)" : "rgba(232, 213, 176, 0.85)",
              }}>
                {u.imageEmoji ?? u.name.slice(0, 2).toUpperCase()}
              </span>
              <span style={{
                fontSize: "0.5rem",
                color: dead ? "rgba(100, 100, 100, 0.4)" : "rgba(232, 213, 176, 0.6)",
                textDecoration: dead ? "line-through" : undefined,
                whiteSpace: "nowrap",
                maxWidth: 50,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {u.name.length > 8 ? u.name.slice(0, 7) + ".." : u.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main content: Canvas + Side Panel */}
      <div className="flex gap-3 flex-col lg:flex-row">
        {/* Canvas Battle Map */}
        <div className="flex-1 rounded-lg overflow-hidden" style={{
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(201, 168, 76, 0.15)",
        }}>
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            onClick={handleCanvasClick}
            className="w-full cursor-pointer"
            style={{ maxHeight: 500, objectFit: "contain" }}
          />
          {/* Targeting mode indicator */}
          {targetingMode && (
            <div className="px-3 py-1.5 text-center" style={{
              background: "rgba(168, 85, 247, 0.15)",
              borderTop: "1px solid rgba(168, 85, 247, 0.3)",
            }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(168, 85, 247, 0.9)" }}>
                Select Target - Click an enemy
              </span>
              <button
                onClick={() => setTargetingMode(null)}
                className="ml-3 px-2 py-0.5 rounded text-xs"
                style={{ background: "rgba(220, 38, 38, 0.2)", color: "rgba(220, 38, 38, 0.8)", border: "1px solid rgba(220, 38, 38, 0.3)" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Side Panel: Stats + Actions */}
        <div className="w-full lg:w-80 flex flex-col gap-2">
          {/* Active Unit Stats */}
          {activeUnit && (
            <div className="px-4 py-3 rounded-lg" style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: `1px solid ${activeUnit.isPlayer ? "rgba(96, 165, 250, 0.3)" : "rgba(220, 38, 38, 0.3)"}`,
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black tracking-widest uppercase" style={{
                  color: activeUnit.isPlayer ? "rgba(96, 165, 250, 0.9)" : "rgba(220, 38, 38, 0.9)",
                }}>
                  {activeUnit.name}
                </span>
                {activeUnit.charClass && (
                  <span className="text-xs" style={{ color: "rgba(201, 168, 76, 0.6)" }}>
                    {activeUnit.charClass.emoji} {activeUnit.charClass.name}
                  </span>
                )}
              </div>

              {/* HP Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-0.5">
                  <span style={{ color: "rgba(232, 213, 176, 0.6)" }}>HP</span>
                  <span style={{ color: "rgba(251, 113, 133, 0.9)" }}>
                    {Math.round(activeUnit.currentHp)}/{Math.round(activeUnit.maxHp)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, (activeUnit.currentHp / activeUnit.maxHp) * 100)}%`,
                      background: activeUnit.currentHp / activeUnit.maxHp > 0.5
                        ? "rgba(74, 222, 128, 0.9)"
                        : activeUnit.currentHp / activeUnit.maxHp > 0.25
                          ? "rgba(251, 191, 36, 0.9)"
                          : "rgba(220, 38, 38, 0.9)",
                    }}
                  />
                </div>
              </div>

              {/* Mana Bar (if applicable) */}
              {manaPool && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: "rgba(232, 213, 176, 0.6)" }}>Mana</span>
                    <span style={{ color: "rgba(96, 165, 250, 0.9)" }}>
                      {manaPool.current}/{manaPool.max}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(manaPool.current / manaPool.max) * 100}%`,
                        background: "rgba(96, 165, 250, 0.9)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-1 text-center" style={{ fontSize: "0.6rem", color: "rgba(232, 213, 176, 0.6)" }}>
                <StatCell label="AC" value={activeUnit.stats.ac} color="rgba(209, 213, 219, 0.9)" />
                <StatCell label="ATK" value={`+${activeUnit.stats.atkBonus}`} color="rgba(251, 191, 36, 0.9)" />
                <StatCell label="DMG" value={Math.round(activeUnit.stats.attack)} color="rgba(220, 38, 38, 0.9)" />
                <StatCell label="SPD" value={`${activeUnit.stats.speed}ft`} color="rgba(56, 189, 248, 0.9)" />
                <StatCell label="INIT" value={Math.round(activeUnit.stats.initiative)} color="rgba(167, 139, 250, 0.9)" />
                <StatCell label="DEF" value={Math.round(activeUnit.stats.def)} color="rgba(74, 222, 128, 0.9)" />
              </div>

              {/* Active effects */}
              {activeUnit.activeEffects.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {activeUnit.activeEffects.map((eff, i) => {
                    const isBuff = !!(eff.buffAC || eff.buffAtk || eff.buffDmg || eff.buffSave || eff.buffSpeed);
                    const color = isBuff ? "rgba(74, 222, 128, 0.8)" : eff.condition ? "rgba(220, 38, 38, 0.8)" : "rgba(251, 191, 36, 0.8)";
                    return (
                      <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{
                        background: isBuff ? "rgba(74, 222, 128, 0.1)" : eff.condition ? "rgba(220, 38, 38, 0.1)" : "rgba(251, 191, 36, 0.1)",
                        color,
                        border: `1px solid ${color.replace("0.8", "0.3")}`,
                        fontSize: "0.55rem",
                      }}>
                        {eff.spellName}{eff.condition ? ` (${eff.condition})` : ""}
                        {eff.remainingRounds > 0 ? ` ${eff.remainingRounds}r` : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          {isPlayerTurn && phase === "playerTurn" && !showAbilities && !showItems && (
            <div className="px-3 py-3 rounded-lg" style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}>
              <div className="grid grid-cols-5 gap-1.5">
                <ActionButton
                  label="Attack"
                  sublabel={activeUnit?.hasActed ? "Used" : "Melee/Ranged"}
                  color="rgba(220, 38, 38, 0.9)"
                  disabled={!!activeUnit?.hasActed || attackableEnemies.length === 0}
                  onClick={() => {
                    // Click the nearest attackable enemy
                    if (attackableEnemies.length > 0) {
                      const nearestId = attackableEnemies[0];
                      const enemy = units.find((u) => u.id === nearestId);
                      if (enemy) onHexClick(enemy.position);
                    }
                  }}
                />
                <ActionButton
                  label="Ability"
                  sublabel={availableAbilities?.length ? `${availableAbilities.length} ready` : "None"}
                  color="rgba(251, 191, 36, 0.9)"
                  disabled={!availableAbilities || availableAbilities.length === 0}
                  onClick={() => setShowAbilities(true)}
                />
                <ActionButton
                  label="Items"
                  sublabel="Potions"
                  color="rgba(74, 222, 128, 0.9)"
                  disabled={true} // TODO: integrate item inventory
                  onClick={() => setShowItems(true)}
                />
                <ActionButton
                  label="Defend"
                  sublabel="+2 AC"
                  color="rgba(96, 165, 250, 0.9)"
                  disabled={!!activeUnit?.hasActed}
                  onClick={() => onAction({ type: "defend" })}
                />
                <ActionButton
                  label="Flee"
                  sublabel="DEX check"
                  color="rgba(156, 163, 175, 0.9)"
                  disabled={false}
                  onClick={() => onAction({ type: "flee" })}
                />
              </div>

              {/* Context hint */}
              <div className="mt-2 text-center">
                {!activeUnit?.hasMoved && (
                  <span className="text-xs" style={{ color: "rgba(74, 222, 128, 0.7)" }}>
                    Click a green hex to move ({Math.floor((activeUnit?.stats.speed ?? 30) / 5)} hexes)
                  </span>
                )}
                {activeUnit?.hasMoved && !activeUnit?.hasActed && attackableEnemies.length > 0 && (
                  <span className="text-xs" style={{ color: "rgba(220, 38, 38, 0.7)" }}>
                    Click an enemy in range to attack
                  </span>
                )}
                {activeUnit?.hasMoved && !activeUnit?.hasActed && attackableEnemies.length === 0 && (
                  <span className="text-xs" style={{ color: "rgba(201, 168, 76, 0.5)" }}>
                    No enemies in range - end turn or use ability
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ability Submenu */}
          {showAbilities && availableAbilities && (
            <div className="px-3 py-3 rounded-lg" style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
            }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(251, 191, 36, 0.8)" }}>
                  Abilities
                </span>
                <button
                  onClick={() => setShowAbilities(false)}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: "rgba(220, 38, 38, 0.15)", color: "rgba(220, 38, 38, 0.8)", border: "1px solid rgba(220, 38, 38, 0.3)" }}
                >
                  Back
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                {availableAbilities.map((ability) => (
                  <button
                    key={ability.id}
                    disabled={!ability.canUse}
                    onClick={() => handleAbilityClick(ability)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                    style={{
                      background: ability.canUse ? "rgba(251, 191, 36, 0.08)" : "rgba(50, 50, 50, 0.3)",
                      border: `1px solid ${ability.canUse ? "rgba(251, 191, 36, 0.25)" : "rgba(100, 100, 100, 0.15)"}`,
                      opacity: ability.canUse ? 1 : 0.5,
                      cursor: ability.canUse ? "pointer" : "not-allowed",
                    }}
                    title={ability.description}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold" style={{ color: ability.canUse ? "rgba(232, 213, 176, 0.9)" : "rgba(150, 150, 150, 0.6)" }}>
                        {ability.name}
                      </span>
                      <span style={{ fontSize: "0.5rem", color: "rgba(201, 168, 76, 0.5)" }}>
                        {ability.damageType ? `${ability.damageType} ` : ""}{ability.targetType} | Range {ability.range}
                      </span>
                      {!ability.canUse && ability.reason && (
                        <span style={{ fontSize: "0.45rem", color: "rgba(220, 38, 38, 0.6)" }}>
                          {ability.reason}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {ability.manaCost > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{
                          background: "rgba(96, 165, 250, 0.15)",
                          color: "rgba(96, 165, 250, 0.9)",
                          fontSize: "0.6rem",
                          border: "1px solid rgba(96, 165, 250, 0.3)",
                        }}>
                          {ability.manaCost} MP
                        </span>
                      )}
                      {ability.cooldownRemaining > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{
                          background: "rgba(220, 38, 38, 0.1)",
                          color: "rgba(220, 38, 38, 0.7)",
                          fontSize: "0.5rem",
                          border: "1px solid rgba(220, 38, 38, 0.2)",
                        }}>
                          CD {ability.cooldownRemaining}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Combat Log */}
          <div
            ref={logRef}
            className="px-3 py-2 rounded-lg overflow-y-auto"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(201, 168, 76, 0.1)",
              maxHeight: 200,
              minHeight: 120,
            }}
          >
            <span className="text-xs font-bold uppercase tracking-widest block mb-1" style={{ color: "rgba(201, 168, 76, 0.4)" }}>
              Combat Log
            </span>
            {combatLog.map((entry) => {
              const color =
                entry.type === "crit" ? "rgba(251, 191, 36, 0.9)"
                : entry.type === "hit" ? "rgba(232, 213, 176, 0.8)"
                : entry.type === "miss" ? "rgba(156, 163, 175, 0.6)"
                : entry.type === "kill" ? "rgba(220, 38, 38, 0.9)"
                : entry.type === "system" ? "rgba(96, 165, 250, 0.7)"
                : "rgba(232, 213, 176, 0.6)";
              return (
                <div key={entry.id} style={{ fontSize: "0.6rem", color, lineHeight: 1.4, marginBottom: 2 }}>
                  {entry.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span style={{ fontSize: "0.5rem", color: "rgba(201, 168, 76, 0.5)", textTransform: "uppercase" }}>{label}</span>
      <span className="font-bold text-xs" style={{ color }}>{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  sublabel,
  color,
  disabled,
  onClick,
}: {
  label: string;
  sublabel: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg transition-all hover:scale-105"
      style={{
        background: disabled ? "rgba(50, 50, 50, 0.3)" : `${color.replace("0.9", "0.1")}`,
        border: `1px solid ${disabled ? "rgba(100, 100, 100, 0.15)" : color.replace("0.9", "0.3")}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: disabled ? "rgba(150, 150, 150, 0.5)" : color }}>
        {label}
      </span>
      <span style={{ fontSize: "0.45rem", color: disabled ? "rgba(100, 100, 100, 0.4)" : "rgba(201, 168, 76, 0.5)" }}>
        {sublabel}
      </span>
    </button>
  );
}

// ── API for programmatic animation triggers ──────────────────────────────────

export function createAnimation(
  type: AnimationType,
  from: HexCoord,
  to: HexCoord,
  color: string = "#ffffff"
): Animation {
  const fromPixel = hexToPixel(from);
  const toPixel = hexToPixel(to);
  const duration =
    type === "melee_slash" ? ANIMATION_DURATION_MELEE
    : type === "ranged_projectile" ? ANIMATION_DURATION_RANGED
    : type === "magic_burst" ? ANIMATION_DURATION_MAGIC
    : type === "healing_rise" ? ANIMATION_DURATION_HEAL
    : type === "aoe_expand" ? ANIMATION_DURATION_AOE
    : 500;

  return {
    id: `anim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    fromX: fromPixel.x,
    fromY: fromPixel.y,
    toX: toPixel.x,
    toY: toPixel.y,
    startTime: Date.now(),
    duration,
    color,
  };
}
