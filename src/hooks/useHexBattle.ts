"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { type HexCoord, hexesInRange, isAdjacent } from "@/lib/hexGrid";
import {
  type BattleUnit,
  type CombatLogEntry,
  type AttackResult,
  createPlayerUnit,
  createEnemyUnit,
  generateEncounter,
  rollD20,
  resolveAttack,
  computeEnemyMove,
} from "@/lib/hexCombat";
import { computeStats } from "@/lib/battleStats";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterClass } from "@/lib/classes";

// ── State ────────────────────────────────────────────────────────────────────

export type BattlePhase =
  | "setup"
  | "playerMove"
  | "playerAction"
  | "playerRoll"
  | "playerResult"
  | "enemyTurn"
  | "victory"
  | "defeat";

type BattleState = {
  units: BattleUnit[];
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;
  phase: BattlePhase;
  reachableHexes: HexCoord[];
  attackableEnemies: string[];
  pendingTargetId: string | null;
  lastRollNatural: number | null;
  lastAttackResult: AttackResult | null;
  combatLog: CombatLogEntry[];
  logCounter: number;
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "INIT"; player: BattleUnit; enemies: BattleUnit[] }
  | { type: "MOVE"; hex: HexCoord }
  | { type: "SELECT_TARGET"; targetId: string }
  | { type: "ROLL"; natural: number }
  | { type: "APPLY_RESULT" }
  | { type: "END_TURN" }
  | { type: "ENEMY_MOVE"; unitId: string; hex: HexCoord }
  | { type: "ENEMY_ATTACK"; unitId: string; natural: number; result: AttackResult }
  | { type: "NEXT_TURN" };

function addLog(state: BattleState, text: string, logType: CombatLogEntry["type"]): BattleState {
  const id = state.logCounter + 1;
  return {
    ...state,
    logCounter: id,
    combatLog: [...state.combatLog.slice(-50), { id, text, type: logType }],
  };
}

function calcReachable(unit: BattleUnit, units: BattleUnit[]): HexCoord[] {
  const occupied = new Set(
    units.filter(u => u.id !== unit.id && u.currentHp > 0).map(u => `${u.position.q},${u.position.r}`)
  );
  return hexesInRange(unit.position, Math.floor(unit.stats.speed / 5), occupied);
}

function calcAttackable(unit: BattleUnit, units: BattleUnit[]): string[] {
  return units
    .filter(u => u.currentHp > 0 && u.isPlayer !== unit.isPlayer && isAdjacent(unit.position, u.position))
    .map(u => u.id);
}

function checkEnd(state: BattleState): BattleState {
  const player = state.units.find(u => u.isPlayer);
  const enemiesAlive = state.units.filter(u => !u.isPlayer && u.currentHp > 0);
  if (!player || player.currentHp <= 0) return { ...state, phase: "defeat" };
  if (enemiesAlive.length === 0) return { ...state, phase: "victory" };
  return state;
}

function advanceTurn(state: BattleState): BattleState {
  let idx = state.currentTurnIndex;
  let round = state.round;

  // Find next living unit
  for (let i = 0; i < state.turnOrder.length; i++) {
    idx = (idx + 1) % state.turnOrder.length;
    if (idx === 0) round++;
    const unit = state.units.find(u => u.id === state.turnOrder[idx]);
    if (unit && unit.currentHp > 0) break;
  }

  const nextUnit = state.units.find(u => u.id === state.turnOrder[idx]);
  if (!nextUnit || nextUnit.currentHp <= 0) return { ...state, phase: "victory" };

  // Reset turn flags
  const units = state.units.map(u =>
    u.id === nextUnit.id ? { ...u, hasMoved: false, hasActed: false } : u
  );

  const phase: BattlePhase = nextUnit.isPlayer ? "playerMove" : "enemyTurn";
  let s: BattleState = { ...state, units, currentTurnIndex: idx, round, phase, pendingTargetId: null, lastRollNatural: null, lastAttackResult: null };

  if (phase === "playerMove") {
    s.reachableHexes = calcReachable(nextUnit, units);
    s.attackableEnemies = [];
    s = addLog(s, `--- Round ${round} --- ${nextUnit.name}'s turn`, "system");
  } else {
    s.reachableHexes = [];
    s.attackableEnemies = [];
  }

  return s;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: BattleState, action: Action): BattleState {
  switch (action.type) {
    case "INIT": {
      const allUnits = [action.player, ...action.enemies];
      const sorted = [...allUnits].sort((a, b) => b.stats.initiative - a.stats.initiative);
      const turnOrder = sorted.map(u => u.id);
      const first = sorted[0];
      const phase: BattlePhase = first.isPlayer ? "playerMove" : "enemyTurn";
      let s: BattleState = {
        units: allUnits,
        turnOrder,
        currentTurnIndex: 0,
        round: 1,
        phase,
        reachableHexes: [],
        attackableEnemies: [],
        pendingTargetId: null,
        lastRollNatural: null,
        lastAttackResult: null,
        combatLog: [],
        logCounter: 0,
      };
      s = addLog(s, "Battle begins!", "system");
      s = addLog(s, `Initiative: ${sorted.map(u => `${u.name} (${u.stats.initiative})`).join(", ")}`, "info");
      if (phase === "playerMove") {
        s.reachableHexes = calcReachable(first, allUnits);
        s = addLog(s, `--- Round 1 --- ${first.name}'s turn`, "system");
      }
      return s;
    }

    case "MOVE": {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const units = state.units.map(u =>
        u.id === activeId ? { ...u, position: action.hex, hasMoved: true } : u
      );
      const active = units.find(u => u.id === activeId)!;
      const attackable = calcAttackable(active, units);
      let s: BattleState = { ...state, units, phase: "playerAction", reachableHexes: [], attackableEnemies: attackable };
      s = addLog(s, `${active.name} moves to (${action.hex.q}, ${action.hex.r})`, "info");
      return s;
    }

    case "SELECT_TARGET": {
      return { ...state, pendingTargetId: action.targetId, phase: "playerRoll", lastRollNatural: null, lastAttackResult: null };
    }

    case "ROLL": {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const attacker = state.units.find(u => u.id === activeId)!;
      const target = state.units.find(u => u.id === state.pendingTargetId)!;
      const result = resolveAttack(attacker, target, action.natural);
      let s: BattleState = { ...state, lastRollNatural: action.natural, lastAttackResult: result, phase: "playerResult" };
      const logType: CombatLogEntry["type"] = !result.hit ? (action.natural === 1 ? "miss" : "miss") : (action.natural === 20 ? "crit" : "hit");
      s = addLog(s, `${attacker.name} attacks ${target.name}: ${result.breakdown}`, logType);
      return s;
    }

    case "APPLY_RESULT": {
      if (!state.lastAttackResult || !state.pendingTargetId) return state;
      const { hit, damage } = state.lastAttackResult;
      if (!hit) {
        const active = state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex])!;
        const units = state.units.map(u => u.id === active.id ? { ...u, hasActed: true } : u);
        return checkEnd({ ...state, units, phase: "playerAction", attackableEnemies: [], pendingTargetId: null });
      }
      let units = state.units.map(u =>
        u.id === state.pendingTargetId ? { ...u, currentHp: Math.max(0, u.currentHp - damage) } : u
      );
      const target = units.find(u => u.id === state.pendingTargetId)!;
      const activeId = state.turnOrder[state.currentTurnIndex];
      units = units.map(u => u.id === activeId ? { ...u, hasActed: true } : u);
      let s: BattleState = { ...state, units, phase: "playerAction", attackableEnemies: [], pendingTargetId: null };
      if (target.currentHp <= 0) {
        s = addLog(s, `${target.name} is defeated!`, "kill");
      }
      return checkEnd(s);
    }

    case "END_TURN": {
      return advanceTurn(state);
    }

    case "ENEMY_MOVE": {
      const units = state.units.map(u =>
        u.id === action.unitId ? { ...u, position: action.hex, hasMoved: true } : u
      );
      return { ...state, units };
    }

    case "ENEMY_ATTACK": {
      const attacker = state.units.find(u => u.id === action.unitId)!;
      const target = state.units.find(u => u.isPlayer)!;
      let s = state;
      const logType: CombatLogEntry["type"] = !action.result.hit ? "miss" : (action.natural === 20 ? "crit" : "hit");
      s = addLog(s, `${attacker.name} attacks ${target.name}: ${action.result.breakdown}`, logType);

      if (action.result.hit) {
        const units = s.units.map(u =>
          u.isPlayer ? { ...u, currentHp: Math.max(0, u.currentHp - action.result.damage) } : u
        );
        s = { ...s, units };
        const p = units.find(u => u.isPlayer)!;
        if (p.currentHp <= 0) {
          s = addLog(s, `${p.name} has fallen!`, "kill");
        }
      }
      s = { ...s, lastRollNatural: action.natural, lastAttackResult: action.result };
      return checkEnd(s);
    }

    case "NEXT_TURN": {
      return advanceTurn(state);
    }

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: BattleState = {
  units: [],
  turnOrder: [],
  currentTurnIndex: 0,
  round: 0,
  phase: "setup",
  reachableHexes: [],
  attackableEnemies: [],
  pendingTargetId: null,
  lastRollNatural: null,
  lastAttackResult: null,
  combatLog: [],
  logCounter: 0,
};

export function useHexBattle() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const activeUnit = state.turnOrder.length > 0
    ? state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]) ?? null
    : null;

  const startBattle = useCallback((character: NftCharacter, difficulty: "easy" | "medium" | "hard", charClass?: CharacterClass, allCharacters?: NftCharacter[]) => {
    const player = createPlayerUnit(character, { q: 1, r: 5 }, charClass);
    const specs = generateEncounter(difficulty, allCharacters ?? []);
    const startPositions: HexCoord[] = [{ q: 8, r: 4 }, { q: 8, r: 6 }, { q: 7, r: 5 }];
    const enemies = specs.map((s, i) => createEnemyUnit(s, startPositions[i], i));
    dispatch({ type: "INIT", player, enemies });
  }, []);

  const clickHex = useCallback((hex: HexCoord) => {
    if (state.phase === "playerMove") {
      const isReachable = state.reachableHexes.some(h => h.q === hex.q && h.r === hex.r);
      if (isReachable) dispatch({ type: "MOVE", hex });
    } else if (state.phase === "playerAction") {
      // Check if clicked an attackable enemy
      const enemy = state.units.find(u => u.position.q === hex.q && u.position.r === hex.r && !u.isPlayer && u.currentHp > 0);
      if (enemy && state.attackableEnemies.includes(enemy.id)) {
        dispatch({ type: "SELECT_TARGET", targetId: enemy.id });
      }
    }
  }, [state.phase, state.reachableHexes, state.attackableEnemies, state.units]);

  const playerRoll = useCallback(() => {
    if (state.phase !== "playerRoll") return;
    const natural = rollD20();
    dispatch({ type: "ROLL", natural });
    // Auto-apply after a pause
    timerRef.current = setTimeout(() => dispatch({ type: "APPLY_RESULT" }), 1200);
  }, [state.phase]);

  const skipMove = useCallback(() => {
    if (state.phase === "playerMove") {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const active = state.units.find(u => u.id === activeId)!;
      const attackable = calcAttackable(active, state.units);
      dispatch({ type: "MOVE", hex: active.position }); // "move" to same spot
      // Override to action phase
    }
  }, [state.phase, state.turnOrder, state.currentTurnIndex, state.units]);

  const endTurn = useCallback(() => {
    if (state.phase === "playerMove" || state.phase === "playerAction") {
      dispatch({ type: "END_TURN" });
    }
  }, [state.phase]);

  // ── Enemy AI auto-play ───────────────────────────────────────────────────
  // Only re-trigger on phase/turn changes — NOT on units changes (which
  // ENEMY_MOVE and ENEMY_ATTACK cause), otherwise duplicate timer chains
  // cascade through every round without waiting for player input.
  useEffect(() => {
    if (state.phase !== "enemyTurn") return;

    let cancelled = false;

    const activeId = state.turnOrder[state.currentTurnIndex];
    const enemy = state.units.find(u => u.id === activeId);
    const player = state.units.find(u => u.isPlayer);
    if (!enemy || !player || enemy.currentHp <= 0 || player.currentHp <= 0) {
      timerRef.current = setTimeout(() => {
        if (!cancelled) dispatch({ type: "NEXT_TURN" });
      }, 300);
      return () => { cancelled = true; };
    }

    // Enemy move
    const newPos = computeEnemyMove(enemy, player, state.units);
    const moved = newPos.q !== enemy.position.q || newPos.r !== enemy.position.r;

    timerRef.current = setTimeout(() => {
      if (cancelled) return;
      if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });

      // Check if adjacent after move, then attack
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        if (isAdjacent(newPos, player.position)) {
          const natural = rollD20();
          const result = resolveAttack(enemy, player, natural);
          dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, natural, result });
          timerRef.current = setTimeout(() => {
            if (!cancelled) dispatch({ type: "NEXT_TURN" });
          }, 1000);
        } else {
          dispatch({ type: "NEXT_TURN" });
        }
      }, moved ? 500 : 100);
    }, 400);

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentTurnIndex]);

  return {
    state,
    activeUnit,
    isPlayerTurn: activeUnit?.isPlayer ?? false,
    startBattle,
    clickHex,
    playerRoll,
    skipMove,
    endTurn,
  };
}
