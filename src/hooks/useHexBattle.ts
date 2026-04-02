"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { type HexCoord, hexDistance, hexesInRange, isAdjacent } from "@/lib/hexGrid";
import {
  type BattleUnit,
  type CombatLogEntry,
  type AttackResult,
  type EnemySpec,
  type SpellUnitInfo,
  createPlayerUnit,
  createEnemyUnit,
  generateEncounter,
  generateSpawnPositions,
  rollD20,
  resolveAttack,
  resolveSpellCast,
  computeEnemyMove,
  canAttack,
  isCharge,
  hasCondition,
  getAoOThreats,
  createFollowerUnit,
} from "@/lib/hexCombat";
import { getSpell, requiresConcentration, type SpellBattleEffect } from "@/lib/spells";
import { getFeatCombatFlags } from "@/lib/feats";
import type { NftCharacter } from "@/hooks/useNftStats";
import type { CharacterClass } from "@/lib/classes";
import type { Follower, EntityProgression } from "@/lib/party";

// ── State ────────────────────────────────────────────────────────────────────

export type BattlePhase =
  | "setup"
  | "playerTurn"
  | "playerRoll"
  | "playerResult"
  | "playerReaction"
  | "enemyTurn"
  | "victory"
  | "defeat";

export type PlayerSubMode = "idle" | "moving" | "attacking" | "casting";

type BattleState = {
  units: BattleUnit[];
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;
  phase: BattlePhase;
  subMode: PlayerSubMode;
  reachableHexes: HexCoord[];
  attackableEnemies: string[];
  pendingTargetId: string | null;
  lastRollNatural: number | null;
  lastAttackResult: AttackResult | null;
  combatLog: CombatLogEntry[];
  logCounter: number;
  pendingAoO: { attackerId: string; targetId: string } | null;
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "INIT"; player: BattleUnit; enemies: BattleUnit[]; followers?: BattleUnit[] }
  | { type: "MOVE"; hex: HexCoord }
  | { type: "SELECT_TARGET"; targetId: string }
  | { type: "ROLL"; natural: number }
  | { type: "APPLY_RESULT" }
  | { type: "END_TURN" }
  | { type: "READY_ATTACK" }
  | { type: "ENEMY_MOVE"; unitId: string; hex: HexCoord }
  | { type: "ENEMY_ATTACK"; unitId: string; natural: number; result: AttackResult }
  | { type: "READIED_TRIGGER"; attackerId: string; targetId: string; natural: number; result: AttackResult }
  | { type: "NEXT_TURN" }
  | { type: "CAST_SPELL"; spellId: string; targetId: string }
  | { type: "SET_SUBMODE"; subMode: PlayerSubMode }
  | { type: "AOO_TAKE" }
  | { type: "AOO_PASS" };

function addLog(state: BattleState, text: string, logType: CombatLogEntry["type"]): BattleState {
  const id = state.logCounter + 1;
  return {
    ...state,
    logCounter: id,
    combatLog: [...state.combatLog.slice(-50), { id, text, type: logType }],
  };
}

/** 5e Concentration check: when a concentrating unit takes damage, roll CON save
 *  DC = max(10, floor(damage/2)). On failure, remove all effects from that spell. */
function checkConcentration(state: BattleState, unitId: string, damage: number): BattleState {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit || !unit.concentrationSpellId || damage <= 0) return state;

  const dc = Math.max(10, Math.floor(damage / 2));
  const conMod = Math.floor((unit.rawAbilities.con - 10) / 2);
  const roll = rollD20();
  const total = roll + conMod;

  if (total >= dc) {
    return addLog(state, `${unit.name} maintains concentration (d20(${roll})+${conMod}=${total} vs DC ${dc})`, "info");
  }

  // Failed — break concentration: remove all effects with this spellId from this caster
  const spellId = unit.concentrationSpellId;
  const spellName = unit.activeEffects.find(e => e.spellId === spellId)?.spellName ?? "spell";
  const units = state.units.map(u => {
    const cleaned = { ...u, activeEffects: u.activeEffects.filter(e => !(e.concentration && e.sourceId === unitId && e.spellId === spellId)) };
    if (u.id === unitId) cleaned.concentrationSpellId = undefined;
    return cleaned;
  });
  let s = { ...state, units };
  s = addLog(s, `${unit.name} loses concentration on ${spellName}! (d20(${roll})+${conMod}=${total} vs DC ${dc})`, "system");
  return s;
}

/** Drop an existing concentration spell from a caster (used when casting a new one) */
function dropConcentration(state: BattleState, casterId: string): BattleState {
  const caster = state.units.find(u => u.id === casterId);
  if (!caster?.concentrationSpellId) return state;
  const spellId = caster.concentrationSpellId;
  const spellName = caster.activeEffects.find(e => e.spellId === spellId)?.spellName ?? "spell";
  const units = state.units.map(u => {
    const cleaned = { ...u, activeEffects: u.activeEffects.filter(e => !(e.concentration && e.sourceId === casterId && e.spellId === spellId)) };
    if (u.id === casterId) cleaned.concentrationSpellId = undefined;
    return cleaned;
  });
  let s = { ...state, units };
  s = addLog(s, `${caster.name} drops concentration on ${spellName}.`, "system");
  return s;
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
  // Clean up concentration effects from dead units
  const deadConcentrators = state.units.filter(u => u.currentHp <= 0 && u.concentrationSpellId);
  if (deadConcentrators.length > 0) {
    let units = state.units;
    for (const dead of deadConcentrators) {
      const sid = dead.concentrationSpellId!;
      units = units.map(u => {
        const cleaned = { ...u, activeEffects: u.activeEffects.filter(e => !(e.concentration && e.sourceId === dead.id && e.spellId === sid)) };
        if (u.id === dead.id) cleaned.concentrationSpellId = undefined;
        return cleaned;
      });
    }
    state = { ...state, units };
  }
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

  const newRound = round > state.round;  // reactions reset each full round

  // Reset turn flags — clear readiedAttack when it's your turn again (unused ready expires)
  // Save turnStartPos for charge detection
  // Tick buff/debuff durations for the unit whose turn is starting
  const units = state.units.map(u => {
    if (u.id === nextUnit.id) {
      const tickedEffects = u.activeEffects
        .map(e => e.remainingRounds === -1 ? e : { ...e, remainingRounds: e.remainingRounds - 1 })
        .filter(e => e.remainingRounds !== 0);
      return { ...u, hasMoved: false, hasActed: false, hasBonusActed: false, readiedAttack: false, turnStartPos: u.position, activeEffects: tickedEffects, reactionUsed: newRound ? false : u.reactionUsed };
    }
    // Reset reactions for all units on new round
    return newRound ? { ...u, reactionUsed: false } : u;
  });

  const phase: BattlePhase = nextUnit.isPlayer ? "playerTurn" : "enemyTurn";
  let s: BattleState = { ...state, units, currentTurnIndex: idx, round, phase, subMode: "idle", pendingTargetId: null, lastRollNatural: null, lastAttackResult: null };

  // Check conditions that skip turns (dazed, stunned)
  const updatedNext = s.units.find(u => u.id === nextUnit.id)!;
  if (hasCondition(updatedNext, "dazed") || hasCondition(updatedNext, "stunned")) {
    s = addLog(s, `${updatedNext.name} is ${hasCondition(updatedNext, "stunned") ? "stunned" : "dazed"} and loses their turn!`, "system");
    return advanceTurn(s);
  }

  if (phase === "playerTurn") {
    s.reachableHexes = calcReachable(updatedNext, units);
    s.attackableEnemies = calcAttackable(updatedNext, units);
    s = addLog(s, `--- Round ${round} --- ${updatedNext.name}'s turn`, "system");
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
      const allUnits = [action.player, ...(action.followers ?? []), ...action.enemies];
      const sorted = [...allUnits].sort((a, b) => b.stats.initiative - a.stats.initiative);
      const turnOrder = sorted.map(u => u.id);
      const first = sorted[0];
      const phase: BattlePhase = first.isPlayer ? "playerTurn" : "enemyTurn";
      let s: BattleState = {
        units: allUnits,
        turnOrder,
        currentTurnIndex: 0,
        round: 1,
        phase,
        subMode: "idle",
        reachableHexes: [],
        attackableEnemies: [],
        pendingTargetId: null,
        lastRollNatural: null,
        lastAttackResult: null,
        combatLog: [],
        logCounter: 0,
        pendingAoO: null,
      };
      s = addLog(s, "Battle begins!", "system");
      s = addLog(s, `Initiative: ${sorted.map(u => `${u.name} (${u.stats.initiative})`).join(", ")}`, "info");
      if (phase === "playerTurn") {
        s.reachableHexes = calcReachable(first, allUnits);
        s.attackableEnemies = calcAttackable(first, allUnits);
        s = addLog(s, `--- Round 1 --- ${first.name}'s turn`, "system");
      }
      return s;
    }

    case "MOVE": {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const mover = state.units.find(u => u.id === activeId)!;
      const oldPos = mover.position;
      let units = state.units.map(u =>
        u.id === activeId ? { ...u, position: action.hex, hasMoved: true } : u
      );

      let s: BattleState = { ...state, units };

      // Enemy AoOs against player movement (auto-resolve)
      const threats = getAoOThreats(mover, oldPos, action.hex, units);
      for (const enemy of threats) {
        const playerNow = s.units.find(u => u.id === activeId)!;
        if (playerNow.currentHp <= 0) break;
        const natural = rollD20();
        const threatRange = enemy.weaponProperties.includes("reach") ? 2 : 1;
        const result = resolveAttack(enemy, playerNow, natural, threatRange);
        s = { ...s, units: s.units.map(u => u.id === enemy.id ? { ...u, reactionUsed: true } : u) };
        s = addLog(s, `Opportunity attack! ${enemy.name} strikes at ${playerNow.name}: ${result.breakdown}`, result.hit ? "hit" : "miss");
        if (result.hit) {
          s = { ...s, units: s.units.map(u => u.id === activeId ? { ...u, currentHp: Math.max(0, u.currentHp - result.damage) } : u) };
          s = checkConcentration(s, activeId, result.damage);
          const hitUnit = s.units.find(u => u.id === activeId)!;
          if (hitUnit.currentHp <= 0) {
            s = addLog(s, `${hitUnit.name} has fallen!`, "kill");
            return checkEnd(s);
          }
        }
      }

      const active = s.units.find(u => u.id === activeId)!;
      const attackable = calcAttackable(active, s.units);
      s = { ...s, phase: "playerTurn", subMode: "idle", reachableHexes: [], attackableEnemies: attackable };
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
        const updActive = units.find(u => u.id === active.id)!;
        const reachLeft = !updActive.hasMoved ? calcReachable(updActive, units) : [];
        return checkEnd({ ...state, units, phase: "playerTurn", subMode: "idle", reachableHexes: reachLeft, attackableEnemies: [], pendingTargetId: null });
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
      const updAtk = units.find(u => u.id === activeId)!;
      const mvLeft = !updAtk.hasMoved ? calcReachable(updAtk, units) : [];
      let s: BattleState = { ...state, units, phase: "playerTurn", subMode: "idle", reachableHexes: mvLeft, attackableEnemies: [], pendingTargetId: null };
      s = checkConcentration(s, state.pendingTargetId!, finalDamage);
      if (target.currentHp <= 0) {
        s = addLog(s, `${target.name} is defeated!`, "kill");

        // Cleave: free attack on adjacent enemy after a kill
        // Great Cleave: chain indefinitely as long as each swing kills
        const flags = getFeatCombatFlags(attacker.feats);
        if (flags.cleave || flags.greatCleave) {
          const cleavedIds = new Set<string>([target.id]);
          let keepCleaving = true;
          while (keepCleaving) {
            keepCleaving = false;
            const cleaveTarget = s.units.find(u =>
              u.currentHp > 0 && !u.isPlayer && !cleavedIds.has(u.id) && isAdjacent(attacker.position, u.position)
            );
            if (!cleaveTarget) break;
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
              s = checkConcentration(s, cleaveTarget.id, cleaveResult.damage);
              const cleavedUnit = s.units.find(u => u.id === cleaveTarget.id)!;
              if (cleavedUnit.currentHp <= 0) {
                s = addLog(s, `${cleavedUnit.name} is defeated!`, "kill");
                cleavedIds.add(cleaveTarget.id);
                if (flags.greatCleave) keepCleaving = true; // chain continues
              }
            }
          }
        }
      }
      return checkEnd(s);
    }

    case "CAST_SPELL": {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const caster = state.units.find(u => u.id === activeId)!;
      const target = state.units.find(u => u.id === action.targetId)!;
      const spell = getSpell(action.spellId);
      if (!spell?.battle) return state;

      const isConc = requiresConcentration(spell);

      // Determine spell level for this caster's class
      const casterClassId = caster.charClass?.spellcasting?.casterClass;
      const spellLevel = casterClassId ? (spell.levels[casterClassId] ?? 0) : 0;

      // If casting a concentration spell, drop existing concentration first
      let s: BattleState = state;
      if (isConc) {
        s = dropConcentration(s, activeId);
      }

      // Deduct spell slot
      let units = s.units.map(u => {
        if (u.id !== activeId || !u.spellSlotsUsed) return u;
        const used = [...u.spellSlotsUsed];
        while (used.length <= spellLevel) used.push(0);
        used[spellLevel]++;
        return { ...u, spellSlotsUsed: used, hasActed: true };
      });
      s = { ...s, units };

      // Resolve spell (pass concentration flag so effect gets marked)
      const result = resolveSpellCast(caster, target, action.spellId, spell.name, spellLevel, spell.battle as SpellBattleEffect, isConc);

      // Apply damage
      if (result.damage) {
        // AoE: hit all enemies within area (if hexArea defined)
        const dmgAmt = result.damage ?? 0;
        if (spell.battle.hexArea && spell.battle.hexArea > 0) {
          const hitIds: string[] = [];
          units = s.units.map(u => {
            if (u.id === activeId || u.currentHp <= 0) return u;
            if (hexDistance(u.position, target.position) <= (spell.battle!.hexArea ?? 0)) {
              hitIds.push(u.id);
              return { ...u, currentHp: Math.max(0, u.currentHp - dmgAmt) };
            }
            return u;
          });
          s = { ...s, units };
          for (const hid of hitIds) s = checkConcentration(s, hid, dmgAmt);
        } else {
          units = s.units.map(u =>
            u.id === action.targetId ? { ...u, currentHp: Math.max(0, u.currentHp - dmgAmt) } : u
          );
          s = { ...s, units };
          s = checkConcentration(s, action.targetId, dmgAmt);
        }
        const killed = s.units.find(u => u.id === action.targetId);
        if (killed && killed.currentHp <= 0) {
          s = addLog(s, `${killed.name} is defeated!`, "kill");
        }
      }

      // Apply healing
      if (result.healing) {
        units = s.units.map(u =>
          u.id === action.targetId ? { ...u, currentHp: Math.min(u.maxHp, u.currentHp + (result.healing ?? 0)) } : u
        );
        s = { ...s, units };
      }

      // Apply buff/debuff/condition effect
      if (result.effect) {
        units = s.units.map(u =>
          u.id === action.targetId ? { ...u, activeEffects: [...u.activeEffects, result.effect!] } : u
        );
        s = { ...s, units };
      }

      // Set concentration on caster if this is a concentration spell with an applied effect
      if (isConc && result.effect) {
        s = { ...s, units: s.units.map(u =>
          u.id === activeId ? { ...u, concentrationSpellId: action.spellId } : u
        ) };
      }

      const logType: CombatLogEntry["type"] = result.success ? (result.damage ? "hit" : "info") : "miss";
      s = addLog(s, result.breakdown, logType);
      const casterNow = s.units.find(u => u.id === activeId)!;
      const castReach = !casterNow.hasMoved ? calcReachable(casterNow, s.units) : [];
      s = { ...s, phase: "playerTurn", subMode: "idle", reachableHexes: castReach, attackableEnemies: [], pendingTargetId: null };
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
      const enemy = state.units.find(u => u.id === action.unitId)!;
      const units = state.units.map(u =>
        u.id === action.unitId ? { ...u, position: action.hex, hasMoved: true } : u
      );

      // Check if player can take AoO (skip if player has readied attack — that fires separately)
      const player = units.find(u => u.isPlayer && u.currentHp > 0);
      if (player && !player.reactionUsed && !player.readiedAttack && !player.isRanged
          && !hasCondition(player, "stunned") && !hasCondition(player, "dazed")) {
        const threatRange = player.weaponProperties.includes("reach") ? 2 : 1;
        const wasInRange = hexDistance(enemy.position, player.position) <= threatRange;
        const isInRange = hexDistance(action.hex, player.position) <= threatRange;
        if ((!wasInRange && isInRange) || (wasInRange && !isInRange)) {
          return { ...state, units, phase: "playerReaction", pendingAoO: { attackerId: player.id, targetId: action.unitId } };
        }
      }

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
        s = checkConcentration(s, action.targetId, finalDmg);
        const hit = s.units.find(u => u.id === action.targetId)!;
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
          u.id === target.id ? { ...u, currentHp: Math.max(0, u.currentHp - action.result.damage) } : u
        );
        s = { ...s, units };
        s = checkConcentration(s, target.id, action.result.damage);
        const p = s.units.find(u => u.id === target.id)!;
        if (p.currentHp <= 0) {
          s = addLog(s, `${p.name} has fallen!`, "kill");
        }
      }
      s = { ...s, lastRollNatural: action.natural, lastAttackResult: action.result };
      return checkEnd(s);
    }

    case "AOO_TAKE": {
      if (!state.pendingAoO) return state;
      const { attackerId, targetId } = state.pendingAoO;
      const attacker = state.units.find(u => u.id === attackerId)!;
      const target = state.units.find(u => u.id === targetId)!;
      const natural = rollD20();
      const threatRange = attacker.weaponProperties.includes("reach") ? 2 : 1;
      const result = resolveAttack(attacker, target, natural, threatRange);
      let units = state.units.map(u => u.id === attackerId ? { ...u, reactionUsed: true } : u);
      let s: BattleState = { ...state, units, pendingAoO: null, phase: "enemyTurn" };
      s = addLog(s, `Opportunity attack! ${attacker.name} strikes at ${target.name}: ${result.breakdown}`, result.hit ? "hit" : "miss");
      if (result.hit) {
        s = { ...s, units: s.units.map(u => u.id === targetId ? { ...u, currentHp: Math.max(0, u.currentHp - result.damage) } : u) };
        s = checkConcentration(s, targetId, result.damage);
        const hit = s.units.find(u => u.id === targetId)!;
        if (hit.currentHp <= 0) {
          s = addLog(s, `${hit.name} is defeated!`, "kill");
        }
      }
      return checkEnd(s);
    }

    case "AOO_PASS": {
      return { ...state, pendingAoO: null, phase: "enemyTurn" };
    }

    case "SET_SUBMODE": {
      return { ...state, subMode: action.subMode };
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
  subMode: "idle",
  reachableHexes: [],
  attackableEnemies: [],
  pendingTargetId: null,
  lastRollNatural: null,
  lastAttackResult: null,
  combatLog: [],
  logCounter: 0,
  pendingAoO: null,
};

export function useHexBattle() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const activeUnit = state.turnOrder.length > 0
    ? state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]) ?? null
    : null;

  const startBattle = useCallback((character: NftCharacter, difficulty: "easy" | "medium" | "hard" | "deadly", charClass?: CharacterClass, allCharacters?: NftCharacter[], featIds?: string[], weaponName?: string, spellInfo?: SpellUnitInfo, currentHp?: number, followers?: Follower[], progression?: EntityProgression) => {
    const player = createPlayerUnit(character, { q: 1, r: 5 }, charClass, featIds ?? [], weaponName, spellInfo, currentHp, progression);
    const followerPositions: HexCoord[] = [{ q: 1, r: 4 }, { q: 1, r: 6 }, { q: 2, r: 4 }, { q: 2, r: 6 }];
    const followerUnits = (followers ?? [])
      .filter(f => f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged"))
      .slice(0, 4)
      .map((f, i) => createFollowerUnit(f, followerPositions[i], i));
    const specs = generateEncounter(difficulty, allCharacters ?? []);
    const startPositions: HexCoord[] = [{ q: 8, r: 4 }, { q: 8, r: 6 }, { q: 7, r: 5 }];
    const enemies = specs.map((s, i) => createEnemyUnit(s, startPositions[i], i));
    dispatch({ type: "INIT", player, enemies, followers: followerUnits });
  }, []);

  /** Start a quest battle with pre-built enemy specs (bypasses encounter generation) */
  const startQuestBattle = useCallback((character: NftCharacter, specs: EnemySpec[], charClass?: CharacterClass, featIds?: string[], weaponName?: string, spellInfo?: SpellUnitInfo, currentHp?: number, followers?: Follower[], progression?: EntityProgression) => {
    const playerPos = { q: 1, r: 5 };
    const player = createPlayerUnit(character, playerPos, charClass, featIds ?? [], weaponName, spellInfo, currentHp, progression);
    const followerPositions: HexCoord[] = [{ q: 1, r: 4 }, { q: 1, r: 6 }, { q: 2, r: 4 }, { q: 2, r: 6 }];
    const followerUnits = (followers ?? [])
      .filter(f => f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged"))
      .slice(0, 4)
      .map((f, i) => createFollowerUnit(f, followerPositions[i], i));
    const spawnPositions = generateSpawnPositions(specs.length, playerPos);
    const enemies = specs.map((s, i) => createEnemyUnit(s, spawnPositions[i], i));
    dispatch({ type: "INIT", player, enemies, followers: followerUnits });
  }, []);

  const clickHex = useCallback((hex: HexCoord) => {
    if (state.phase !== "playerTurn") return;
    const au = state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]);
    if (!au) return;
    // Move: click a reachable hex (if haven't moved yet)
    if (!au.hasMoved) {
      const isReachable = state.reachableHexes.some(h => h.q === hex.q && h.r === hex.r);
      if (isReachable) { dispatch({ type: "MOVE", hex }); return; }
    }
    // Attack: click an attackable enemy (if haven't acted yet)
    if (!au.hasActed) {
      const enemy = state.units.find(u => u.position.q === hex.q && u.position.r === hex.r && !u.isPlayer && u.currentHp > 0);
      if (enemy && state.attackableEnemies.includes(enemy.id)) {
        dispatch({ type: "SELECT_TARGET", targetId: enemy.id });
      }
    }
  }, [state.phase, state.reachableHexes, state.attackableEnemies, state.units, state.turnOrder, state.currentTurnIndex]);

  const playerRoll = useCallback(() => {
    if (state.phase !== "playerRoll") return;
    const natural = rollD20();
    dispatch({ type: "ROLL", natural });
    // Auto-apply after a pause
    timerRef.current = setTimeout(() => dispatch({ type: "APPLY_RESULT" }), 1200);
  }, [state.phase]);

  const skipMove = useCallback(() => {
    if (state.phase === "playerTurn") {
      const activeId = state.turnOrder[state.currentTurnIndex];
      const active = state.units.find(u => u.id === activeId)!;
      const attackable = calcAttackable(active, state.units);
      dispatch({ type: "MOVE", hex: active.position }); // "move" to same spot
      // Override to action phase
    }
  }, [state.phase, state.turnOrder, state.currentTurnIndex, state.units]);

  const endTurn = useCallback(() => {
    if (state.phase === "playerTurn") {
      dispatch({ type: "END_TURN" });
    }
  }, [state.phase]);

  const readyAttack = useCallback(() => {
    if (state.phase === "playerTurn") {
      dispatch({ type: "READY_ATTACK" });
    }
  }, [state.phase]);

  const castSpell = useCallback((spellId: string, targetId: string) => {
    if (state.phase !== "playerTurn") return;
    dispatch({ type: "CAST_SPELL", spellId, targetId });
  }, [state.phase]);

  const takeAoO = useCallback(() => {
    if (state.phase === "playerReaction") dispatch({ type: "AOO_TAKE" });
  }, [state.phase]);

  const passAoO = useCallback(() => {
    if (state.phase === "playerReaction") dispatch({ type: "AOO_PASS" });
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

    // ── Resumed after AoO prompt — enemy already moved, skip to attack ──
    if (enemy.hasMoved) {
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const dist = hexDistance(enemy.position, player.position);
        if (dist <= enemy.attackRange && enemy.currentHp > 0) {
          const natural = rollD20();
          const result = resolveAttack(enemy, player, natural, dist);
          dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, natural, result });
          timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 1000);
        } else {
          dispatch({ type: "NEXT_TURN" });
        }
      }, 400);
      return () => { cancelled = true; };
    }

    // ── Full move + attack sequence ──
    const newPos = computeEnemyMove(enemy, player, state.units);
    const moved = newPos.q !== enemy.position.q || newPos.r !== enemy.position.r;
    const wasInRange = hexDistance(enemy.position, player.position) <= player.attackRange;
    const nowInRange = hexDistance(newPos, player.position) <= player.attackRange;

    timerRef.current = setTimeout(() => {
      if (cancelled) return;
      if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });
      // Note: ENEMY_MOVE may set phase to "playerReaction" if player has AoO.
      // If so, the cleanup function cancels all remaining timeouts, and this
      // effect re-triggers with hasMoved=true once AoO resolves.

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

  // Auto-end turn when all actions are used
  useEffect(() => {
    if (state.phase !== "playerTurn") return;
    const au = state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]);
    if (au && au.hasMoved && au.hasActed) {
      const timer = setTimeout(() => dispatch({ type: "END_TURN" }), 600);
      return () => clearTimeout(timer);
    }
  }, [state.phase, state.units, state.turnOrder, state.currentTurnIndex]);

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
    castSpell,
    takeAoO,
    passAoO,
  };
}
