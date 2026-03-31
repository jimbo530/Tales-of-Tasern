"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { type HexCoord, hexDistance, hexesInRange, isAdjacent } from "@/lib/hexGrid";
import {
  type BattleUnit,
  type CombatLogEntry,
  type AttackResult,
  type EnemySpec,
  createPlayerUnit,
  createEnemyUnit,
  generateEncounter,
  generateSpawnPositions,
  rollD20,
  resolveAttack,
  computeEnemyMove,
  canAttack,
  isCharge,
} from "@/lib/hexCombat";
import { getFeatCombatFlags } from "@/lib/feats";
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
  | { type: "READY_ATTACK" }
  | { type: "ENEMY_MOVE"; unitId: string; hex: HexCoord }
  | { type: "ENEMY_ATTACK"; unitId: string; natural: number; result: AttackResult }
  | { type: "READIED_TRIGGER"; attackerId: string; targetId: string; natural: number; result: AttackResult }
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
    .filter(u => u.currentHp > 0 && u.isPlayer !== unit.isPlayer && hexDistance(unit.position, u.position) <= unit.attackRange)
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

  // Reset turn flags — clear readiedAttack when it's your turn again (unused ready expires)
  // Save turnStartPos for charge detection
  const units = state.units.map(u =>
    u.id === nextUnit.id ? { ...u, hasMoved: false, hasActed: false, readiedAttack: false, turnStartPos: u.position } : u
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
      const dist = hexDistance(attacker.position, target.position);
      const result = resolveAttack(attacker, target, action.natural, dist);
      const charged = attacker.weaponProperties.includes("charge") && isCharge(attacker, target);
      let s: BattleState = { ...state, lastRollNatural: action.natural, lastAttackResult: result, phase: "playerResult" };
      const logType: CombatLogEntry["type"] = !result.hit ? (action.natural === 1 ? "miss" : "miss") : (action.natural === 20 ? "crit" : "hit");
      const rangeTag = dist > 1 ? ` at ${dist} hex range` : "";
      const chargeTag = charged ? " (Lance charge!)" : "";
      s = addLog(s, `${attacker.name} attacks ${target.name}${rangeTag}${chargeTag}: ${result.breakdown}`, logType);
      if (charged && result.hit && result.damage > 0) {
        s = addLog(s, `Charge! Double damage: ${result.damage * 2}!`, "crit");
      }
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
      // Lance charge: double damage when attacker has charge property and moved 2+ hexes toward target
      const activeId2 = state.turnOrder[state.currentTurnIndex];
      const attacker2 = state.units.find(u => u.id === activeId2)!;
      const target2 = state.units.find(u => u.id === state.pendingTargetId)!;
      const charged = attacker2.weaponProperties.includes("charge") && isCharge(attacker2, target2);
      const finalDamage = charged ? damage * 2 : damage;
      let units = state.units.map(u =>
        u.id === state.pendingTargetId ? { ...u, currentHp: Math.max(0, u.currentHp - finalDamage) } : u
      );
      const target = units.find(u => u.id === state.pendingTargetId)!;
      const activeId = state.turnOrder[state.currentTurnIndex];
      const attacker = units.find(u => u.id === activeId)!;
      units = units.map(u => u.id === activeId ? { ...u, hasActed: true } : u);
      let s: BattleState = { ...state, units, phase: "playerAction", attackableEnemies: [], pendingTargetId: null };
      if (target.currentHp <= 0) {
        s = addLog(s, `${target.name} is defeated!`, "kill");

        // Cleave: free attack on adjacent enemy after a kill
        const flags = getFeatCombatFlags(attacker.feats);
        if (flags.cleave || flags.greatCleave) {
          const cleaveTarget = s.units.find(u =>
            u.currentHp > 0 && !u.isPlayer && u.id !== target.id && isAdjacent(attacker.position, u.position)
          );
          if (cleaveTarget) {
            const cleaveRoll = rollD20();
            const cleaveResult = resolveAttack(attacker, cleaveTarget, cleaveRoll, 1);
            const logType: CombatLogEntry["type"] = !cleaveResult.hit ? "miss" : (cleaveResult.damage > 0 ? "hit" : "miss");
            s = addLog(s, `Cleave! ${attacker.name} swings at ${cleaveTarget.name}: ${cleaveResult.breakdown}`, logType);
            if (cleaveResult.hit) {
              s = {
                ...s,
                units: s.units.map(u =>
                  u.id === cleaveTarget.id ? { ...u, currentHp: Math.max(0, u.currentHp - cleaveResult.damage) } : u
                ),
              };
              const cleaved = s.units.find(u => u.id === cleaveTarget.id)!;
              if (cleaved.currentHp <= 0) {
                s = addLog(s, `${cleaved.name} is defeated!`, "kill");
              }
            }
          }
        }
      }
      return checkEnd(s);
    }

    case "END_TURN": {
      return advanceTurn(state);
    }

    case "READY_ATTACK": {
      // Player holds action — attack triggers when an enemy enters range
      const activeId = state.turnOrder[state.currentTurnIndex];
      const units = state.units.map(u =>
        u.id === activeId ? { ...u, hasActed: true, readiedAttack: true } : u
      );
      const active = units.find(u => u.id === activeId)!;
      const hasBrace = active.weaponProperties.includes("brace");
      let s: BattleState = { ...state, units };
      s = addLog(s, `${active.name} readies an attack${hasBrace ? " (set against charge — x2 damage)" : ""}.`, "system");
      return advanceTurn(s);
    }

    case "ENEMY_MOVE": {
      const units = state.units.map(u =>
        u.id === action.unitId ? { ...u, position: action.hex, hasMoved: true } : u
      );
      return { ...state, units };
    }

    case "READIED_TRIGGER": {
      // A readied attack fires — brace weapons deal double damage
      const attacker = state.units.find(u => u.id === action.attackerId)!;
      const target = state.units.find(u => u.id === action.targetId)!;
      const hasBrace = attacker.weaponProperties.includes("brace");
      let s = state;
      const logType: CombatLogEntry["type"] = !action.result.hit ? "miss" : (action.result.damage > 0 ? "hit" : "miss");
      const label = hasBrace ? "Set against charge! " : "Readied attack! ";
      s = addLog(s, `${label}${attacker.name} strikes ${target.name}: ${action.result.breakdown}`, logType);

      if (action.result.hit) {
        // Brace weapons deal double on a readied trigger
        const finalDmg = hasBrace ? action.result.damage * 2 : action.result.damage;
        if (hasBrace && action.result.damage > 0) {
          s = addLog(s, `Brace! Double damage: ${finalDmg}!`, "crit");
        }
        const units = s.units.map(u =>
          u.id === action.targetId ? { ...u, currentHp: Math.max(0, u.currentHp - finalDmg) } : u
        );
        s = { ...s, units };
        const hit = units.find(u => u.id === action.targetId)!;
        if (hit.currentHp <= 0) {
          s = addLog(s, `${hit.name} is defeated!`, "kill");
        }
      }
      // Clear readied flag
      s = { ...s, units: s.units.map(u => u.id === action.attackerId ? { ...u, readiedAttack: false } : u) };
      return checkEnd(s);
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

  const startBattle = useCallback((character: NftCharacter, difficulty: "easy" | "medium" | "hard", charClass?: CharacterClass, allCharacters?: NftCharacter[], featIds?: string[], weaponName?: string) => {
    const player = createPlayerUnit(character, { q: 1, r: 5 }, charClass, featIds ?? [], weaponName);
    const specs = generateEncounter(difficulty, allCharacters ?? []);
    const startPositions: HexCoord[] = [{ q: 8, r: 4 }, { q: 8, r: 6 }, { q: 7, r: 5 }];
    const enemies = specs.map((s, i) => createEnemyUnit(s, startPositions[i], i));
    dispatch({ type: "INIT", player, enemies });
  }, []);

  /** Start a quest battle with pre-built enemy specs (bypasses encounter generation) */
  const startQuestBattle = useCallback((character: NftCharacter, specs: EnemySpec[], charClass?: CharacterClass, featIds?: string[], weaponName?: string) => {
    const playerPos = { q: 1, r: 5 };
    const player = createPlayerUnit(character, playerPos, charClass, featIds ?? [], weaponName);
    const spawnPositions = generateSpawnPositions(specs.length, playerPos);
    const enemies = specs.map((s, i) => createEnemyUnit(s, spawnPositions[i], i));
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

  const readyAttack = useCallback(() => {
    if (state.phase === "playerAction") {
      dispatch({ type: "READY_ATTACK" });
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
    const wasInRange = hexDistance(enemy.position, player.position) <= player.attackRange;
    const nowInRange = hexDistance(newPos, player.position) <= player.attackRange;

    timerRef.current = setTimeout(() => {
      if (cancelled) return;
      if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });

      // Readied attack trigger — fires when enemy enters player's threat range
      const playerNow = state.units.find(u => u.isPlayer);
      if (playerNow?.readiedAttack && moved && !wasInRange && nowInRange && playerNow.currentHp > 0) {
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          const dist = hexDistance(newPos, playerNow.position);
          const natural = rollD20();
          const result = resolveAttack(playerNow, enemy, natural, dist);
          dispatch({ type: "READIED_TRIGGER", attackerId: playerNow.id, targetId: enemy.id, natural, result });

          // After readied attack resolves, enemy still gets their attack if alive
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            const distAfter = hexDistance(newPos, playerNow.position);
            if (distAfter <= enemy.attackRange) {
              const n2 = rollD20();
              const r2 = resolveAttack(enemy, playerNow, n2, distAfter);
              dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, natural: n2, result: r2 });
              timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 1000);
            } else {
              dispatch({ type: "NEXT_TURN" });
            }
          }, 1200);
        }, moved ? 500 : 100);
        return;
      }

      // Normal: check if in range after move, then attack
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const dist = hexDistance(newPos, player.position);
        if (dist <= enemy.attackRange) {
          const natural = rollD20();
          const result = resolveAttack(enemy, player, natural, dist);
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
    startQuestBattle,
    clickHex,
    playerRoll,
    skipMove,
    readyAttack,
    endTurn,
  };
}
