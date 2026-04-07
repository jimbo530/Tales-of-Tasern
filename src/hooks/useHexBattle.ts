"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import { type HexCoord, hexDistance, hexesInRange, isAdjacent, hexNeighbors, GRID_COLS, GRID_ROWS } from "@/lib/hexGrid";
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
  greedyPathTo,
  canAttack,
  isCharge,
  hasCondition,
  getAoOThreats,
  createFollowerUnit,
  isConscious,
  isUnconscious,
  isDead,
  isAlive,
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
  | "defeat"
  | "retreat";

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
  packFed: boolean;  // a food-motivated enemy escaped with a body — rest of pack flees
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "INIT"; player: BattleUnit; enemies: BattleUnit[]; followers?: BattleUnit[]; extraHeroes?: BattleUnit[] }
  | { type: "MOVE"; hex: HexCoord }
  | { type: "SELECT_TARGET"; targetId: string }
  | { type: "ROLL"; natural: number }
  | { type: "APPLY_RESULT" }
  | { type: "END_TURN" }
  | { type: "READY_ATTACK" }
  | { type: "ENEMY_MOVE"; unitId: string; hex: HexCoord }
  | { type: "ENEMY_ATTACK"; unitId: string; targetId: string; natural: number; result: AttackResult }
  | { type: "READIED_TRIGGER"; attackerId: string; targetId: string; natural: number; result: AttackResult }
  | { type: "NEXT_TURN" }
  | { type: "CAST_SPELL"; spellId: string; targetId: string }
  | { type: "SET_SUBMODE"; subMode: PlayerSubMode }
  | { type: "GRAB_BODY"; unitId: string; bodyId: string }
  | { type: "ENEMY_FLEE"; unitId: string; escaped: boolean }
  | { type: "RETREAT"; roll: number; dc: number }
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

/** Log the right message when a unit drops: unconscious (0 to -9) or dead (-10) */
function logDowned(state: BattleState, unit: BattleUnit): BattleState {
  if (isDead(unit)) return addLog(state, `${unit.name} is slain!`, "kill");
  if (isUnconscious(unit)) return addLog(state, `${unit.name} falls unconscious! (${unit.currentHp} HP)`, "kill");
  return state;
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
    units.filter(u => u.id !== unit.id && isConscious(u)).map(u => `${u.position.q},${u.position.r}`)
  );
  return hexesInRange(unit.position, Math.floor(unit.stats.speed / 5), occupied);
}

function calcAttackable(unit: BattleUnit, units: BattleUnit[]): string[] {
  return units
    .filter(u => isAlive(u) && u.isPlayer !== unit.isPlayer && hexDistance(unit.position, u.position) <= unit.attackRange)
    .map(u => u.id);
}

function checkEnd(state: BattleState): BattleState {
  // Clean up concentration effects from dead/unconscious units
  const lostConcentrators = state.units.filter(u => !isConscious(u) && u.concentrationSpellId);
  if (lostConcentrators.length > 0) {
    let units = state.units;
    for (const dead of lostConcentrators) {
      const sid = dead.concentrationSpellId!;
      units = units.map(u => {
        const cleaned = { ...u, activeEffects: u.activeEffects.filter(e => !(e.concentration && e.sourceId === dead.id && e.spellId === sid)) };
        if (u.id === dead.id) cleaned.concentrationSpellId = undefined;
        return cleaned;
      });
    }
    state = { ...state, units };
  }
  // Defeat: all player-side units are dead (-10) or unconscious (no one left to fight)
  const playerSideConscious = state.units.filter(u => u.isPlayer && isConscious(u));
  const playerSideAlive = state.units.filter(u => u.isPlayer && isAlive(u));
  // Victory: all enemies are dead (-10) or unconscious
  const enemiesConscious = state.units.filter(u => !u.isPlayer && isConscious(u));
  // Party wipe: everyone dead (not just unconscious — unconscious allies can still be saved)
  if (playerSideAlive.length === 0) return { ...state, phase: "defeat" };
  // No conscious player-side units but some alive (all unconscious) = also defeat
  if (playerSideConscious.length === 0) return { ...state, phase: "defeat" };
  // All enemies down (dead or unconscious) = victory
  if (enemiesConscious.length === 0) return { ...state, phase: "victory" };
  return state;
}

function advanceTurn(state: BattleState): BattleState {
  let idx = state.currentTurnIndex;
  let round = state.round;

  // Find next conscious unit (skip dead and unconscious)
  for (let i = 0; i < state.turnOrder.length; i++) {
    idx = (idx + 1) % state.turnOrder.length;
    if (idx === 0) round++;
    const unit = state.units.find(u => u.id === state.turnOrder[idx]);
    if (!unit) continue;
    // Unconscious units bleed out: -1 HP per round (unless stabilized or auto-stabilize boon)
    if (isUnconscious(unit)) {
      if (!unit.stabilized && (unit.stats.autoStabilize)) {
        // Auto-stabilize boon (Wound Closure)
        state = {
          ...state,
          units: state.units.map(u => u.id === unit.id ? { ...u, stabilized: true } : u),
        };
        state = addLog(state, `${unit.name} auto-stabilizes! (Wound Closure)`, "system");
      } else if (!unit.stabilized) {
        const newHp = unit.currentHp - 1;
        state = {
          ...state,
          units: state.units.map(u => u.id === unit.id ? { ...u, currentHp: newHp } : u),
        };
        if (newHp <= -10) {
          state = addLog(state, `${unit.name} bleeds out and dies!`, "kill");
        } else {
          state = addLog(state, `${unit.name} is bleeding out... (${newHp} HP)`, "system");
        }
      }
      continue; // skip their turn
    }
    // Regeneration boon: +1 HP at start of turn if conscious
    if (isConscious(unit) && unit.stats.hasRegen) {
      const regenHp = Math.min(unit.maxHp, unit.currentHp + 1);
      if (regenHp > unit.currentHp) {
        state = {
          ...state,
          units: state.units.map(u => u.id === unit.id ? { ...u, currentHp: regenHp } : u),
        };
        state = addLog(state, `${unit.name} regenerates 1 HP (${regenHp}/${unit.maxHp})`, "system");
      }
    }
    if (isConscious(unit)) break;
  }

  const nextUnit = state.units.find(u => u.id === state.turnOrder[idx]);
  if (!nextUnit || !isConscious(nextUnit)) return checkEnd(state);

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
      const allUnits = [action.player, ...(action.extraHeroes ?? []), ...(action.followers ?? []), ...action.enemies];
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
        packFed: false,
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
        if (!isConscious(playerNow)) break;
        const natural = rollD20();
        const threatRange = enemy.weaponProperties.includes("reach") ? 2 : 1;
        const result = resolveAttack(enemy, playerNow, natural, threatRange);
        s = { ...s, units: s.units.map(u => u.id === enemy.id ? { ...u, reactionUsed: true } : u) };
        s = addLog(s, `Opportunity attack! ${enemy.name} strikes at ${playerNow.name}: ${result.breakdown}`, result.hit ? "hit" : "miss");
        if (result.hit) {
          s = { ...s, units: s.units.map(u => u.id === activeId ? { ...u, currentHp: Math.max(-10, u.currentHp - result.damage) } : u) };
          s = checkConcentration(s, activeId, result.damage);
          const hitUnit = s.units.find(u => u.id === activeId)!;
          if (!isConscious(hitUnit)) {
            s = logDowned(s, hitUnit);
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
      // Apply damage with death save / phoenix checks
      let units = state.units.map(u => {
        if (u.id !== state.pendingTargetId) return u;
        let newHp = u.currentHp - finalDamage;
        // Death Save boon: drop to 1 HP instead of 0 (once per battle)
        if (newHp <= 0 && u.currentHp > 0 && u.stats.hasDeathSave && !u._deathSaveUsed) {
          newHp = 1;
          return { ...u, currentHp: newHp, _deathSaveUsed: true } as any;
        }
        return { ...u, currentHp: Math.max(-10, newHp) };
      });
      let target = units.find(u => u.id === state.pendingTargetId)!;
      // Check if death save fired
      if (target.currentHp === 1 && (target as any)._deathSaveUsed) {
        // Log it after state is built
      }
      const activeId = state.turnOrder[state.currentTurnIndex];
      let attacker = units.find(u => u.id === activeId)!;
      // Retaliation damage (Tempest boon)
      if (state.lastAttackResult.retaliationDmg && state.lastAttackResult.retaliationDmg > 0) {
        const retDmg = state.lastAttackResult.retaliationDmg;
        units = units.map(u => u.id === activeId ? { ...u, currentHp: Math.max(-10, u.currentHp - retDmg) } : u);
        attacker = units.find(u => u.id === activeId)!;
      }
      units = units.map(u => u.id === activeId ? { ...u, hasActed: true } : u);
      const updAtk = units.find(u => u.id === activeId)!;
      const mvLeft = !updAtk.hasMoved ? calcReachable(updAtk, units) : [];
      let s: BattleState = { ...state, units, phase: "playerTurn", subMode: "idle", reachableHexes: mvLeft, attackableEnemies: [], pendingTargetId: null };
      s = checkConcentration(s, state.pendingTargetId!, finalDamage);
      // Log death save
      if (target.currentHp === 1 && (target as any)._deathSaveUsed) {
        s = addLog(s, `${target.name} refuses to fall! (Unbreakable — drops to 1 HP)`, "system");
      }
      // Log retaliation
      if (state.lastAttackResult.retaliationText) {
        s = addLog(s, state.lastAttackResult.retaliationText, "hit");
        if (!isConscious(attacker)) {
          s = logDowned(s, attacker);
        }
      }
      if (!isConscious(target)) {
        // Phoenix boon: revive at half HP once per battle
        if (target.stats.hasPhoenix && !(target as any)._phoenixUsed) {
          const reviveHp = Math.floor(target.maxHp / 2);
          s = { ...s, units: s.units.map(u => u.id === target.id ? { ...u, currentHp: reviveHp, _phoenixUsed: true } as any : u) };
          s = addLog(s, `${target.name} rises from the ashes! Phoenix revive — ${reviveHp} HP!`, "crit");
        } else {
          s = logDowned(s, target);

          // Cleave: free attack on adjacent enemy after a kill/knockout
          // Great Cleave: chain indefinitely as long as each swing drops a foe
          const flags = getFeatCombatFlags(attacker.feats);
          if (flags.cleave || flags.greatCleave) {
            const cleavedIds = new Set<string>([target.id]);
            let keepCleaving = true;
            while (keepCleaving) {
              keepCleaving = false;
              const cleaveTarget = s.units.find(u =>
                isConscious(u) && !u.isPlayer && !cleavedIds.has(u.id) && isAdjacent(attacker.position, u.position)
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
                    u.id === cleaveTarget.id ? { ...u, currentHp: Math.max(-10, u.currentHp - cleaveResult.damage) } : u
                  ),
                };
                s = checkConcentration(s, cleaveTarget.id, cleaveResult.damage);
                const cleavedUnit = s.units.find(u => u.id === cleaveTarget.id)!;
                if (!isConscious(cleavedUnit)) {
                  s = logDowned(s, cleavedUnit);
                  cleavedIds.add(cleaveTarget.id);
                  if (flags.greatCleave) keepCleaving = true; // chain continues
                }
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
            if (u.id === activeId || isDead(u)) return u; // AoE hits unconscious units too
            if (hexDistance(u.position, target.position) <= (spell.battle!.hexArea ?? 0)) {
              hitIds.push(u.id);
              return { ...u, currentHp: Math.max(-10, u.currentHp - dmgAmt) };
            }
            return u;
          });
          s = { ...s, units };
          for (const hid of hitIds) {
            s = checkConcentration(s, hid, dmgAmt);
            const hitU = s.units.find(u => u.id === hid)!;
            if (isDead(hitU)) s = addLog(s, `${hitU.name} is slain by the blast!`, "kill");
          }
        } else {
          units = s.units.map(u =>
            u.id === action.targetId ? { ...u, currentHp: Math.max(-10, u.currentHp - dmgAmt) } : u
          );
          s = { ...s, units };
          s = checkConcentration(s, action.targetId, dmgAmt);
        }
        const killed = s.units.find(u => u.id === action.targetId);
        if (killed && !isConscious(killed)) {
          s = logDowned(s, killed);
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
          u.id === action.targetId ? { ...u, currentHp: Math.max(-10, u.currentHp - finalDmg) } : u
        );
        s = { ...s, units };
        s = checkConcentration(s, action.targetId, finalDmg);
        const hit = s.units.find(u => u.id === action.targetId)!;
        if (!isConscious(hit)) {
          s = logDowned(s, hit);
        }
      }
      // Clear readied flag
      s = { ...s, units: s.units.map(u => u.id === action.attackerId ? { ...u, readiedAttack: false } : u) };
      return checkEnd(s);
    }

    case "ENEMY_ATTACK": {
      const attacker = state.units.find(u => u.id === action.unitId)!;
      const target = state.units.find(u => u.id === action.targetId) ?? state.units.find(u => u.isPlayer && isConscious(u))!;
      let s = state;
      const logType: CombatLogEntry["type"] = !action.result.hit ? "miss" : (action.natural === 20 ? "crit" : "hit");
      s = addLog(s, `${attacker.name} attacks ${target.name}: ${action.result.breakdown}`, logType);

      if (action.result.hit) {
        // Apply damage with death save check
        const units = s.units.map(u => {
          if (u.id !== target.id) return u;
          let newHp = u.currentHp - action.result.damage;
          if (newHp <= 0 && u.currentHp > 0 && u.stats.hasDeathSave && !(u as any)._deathSaveUsed) {
            return { ...u, currentHp: 1, _deathSaveUsed: true } as any;
          }
          return { ...u, currentHp: Math.max(-10, newHp) };
        });
        s = { ...s, units };
        s = checkConcentration(s, target.id, action.result.damage);
        const p = s.units.find(u => u.id === target.id)!;
        if (p.currentHp === 1 && (p as any)._deathSaveUsed) {
          s = addLog(s, `${p.name} refuses to fall! (Unbreakable — drops to 1 HP)`, "system");
        }
        // Retaliation damage
        if (action.result.retaliationDmg && action.result.retaliationDmg > 0) {
          s = { ...s, units: s.units.map(u => u.id === attacker.id ? { ...u, currentHp: Math.max(-10, u.currentHp - action.result.retaliationDmg!) } : u) };
          s = addLog(s, action.result.retaliationText!, "hit");
          const retUnit = s.units.find(u => u.id === attacker.id)!;
          if (!isConscious(retUnit)) s = logDowned(s, retUnit);
        }
        if (!isConscious(p)) {
          // Phoenix revive
          if (p.stats.hasPhoenix && !(p as any)._phoenixUsed) {
            const reviveHp = Math.floor(p.maxHp / 2);
            s = { ...s, units: s.units.map(u => u.id === p.id ? { ...u, currentHp: reviveHp, _phoenixUsed: true } as any : u) };
            s = addLog(s, `${p.name} rises from the ashes! Phoenix revive — ${reviveHp} HP!`, "crit");
          } else {
            s = logDowned(s, p);
          }
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
        s = { ...s, units: s.units.map(u => u.id === targetId ? { ...u, currentHp: Math.max(-10, u.currentHp - result.damage) } : u) };
        s = checkConcentration(s, targetId, result.damage);
        const hit = s.units.find(u => u.id === targetId)!;
        if (!isConscious(hit)) {
          s = logDowned(s, hit);
        }
      }
      return checkEnd(s);
    }

    case "AOO_PASS": {
      return { ...state, pendingAoO: null, phase: "enemyTurn" };
    }

    case "GRAB_BODY": {
      // Predator grabs an unconscious unit — marks carrying
      const units = state.units.map(u =>
        u.id === action.unitId ? { ...u, carrying: action.bodyId, hasActed: true } : u
      );
      let s: BattleState = { ...state, units };
      const grabber = s.units.find(u => u.id === action.unitId)!;
      const body = s.units.find(u => u.id === action.bodyId)!;
      s = addLog(s, `${grabber.name} seizes ${body.name}'s body!`, "system");
      return s;
    }

    case "ENEMY_FLEE": {
      // Predator carrying a body reaches the edge and escapes
      if (action.escaped) {
        const fleeing = state.units.find(u => u.id === action.unitId)!;
        const carriedId = fleeing.carrying;
        const carried = carriedId ? state.units.find(u => u.id === carriedId) : null;
        // Remove both the fleeing enemy and the carried body from combat
        const units = state.units.map(u =>
          u.id === action.unitId || u.id === carriedId
            ? { ...u, currentHp: -10 }  // mark as dead/gone
            : u
        );
        let s: BattleState = { ...state, units, packFed: true };
        s = addLog(s, `${fleeing.name} drags ${carried?.name ?? "a body"} away into the wilderness!`, "kill");
        // Check if remaining food-motivated enemies should flee too
        const foodEnemiesLeft = s.units.some(u => !u.isPlayer && u.motivation === "food" && isConscious(u));
        if (foodEnemiesLeft) {
          s = addLog(s, "The rest of the pack begins to scatter!", "system");
        }
        return checkEnd(s);
      }
      return state;
    }

    case "RETREAT": {
      let s = state;
      if (action.roll >= action.dc) {
        s = addLog(s, `Retreat succeeds! (${action.roll} vs DC ${action.dc}) — your party flees!`, "system");
        return { ...s, phase: "retreat" };
      }
      // Failed — waste your turn
      const au = s.units.find(u => u.id === s.turnOrder[s.currentTurnIndex]);
      s = addLog(s, `Retreat fails! (${action.roll} vs DC ${action.dc}) — ${au?.name ?? "you"} can't disengage!`, "system");
      const units = s.units.map(u =>
        u.id === s.turnOrder[s.currentTurnIndex] ? { ...u, hasMoved: true, hasActed: true } : u
      );
      return advanceTurn({ ...s, units });
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
  packFed: false,
};

export function useHexBattle() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const activeUnit = state.turnOrder.length > 0
    ? state.units.find(u => u.id === state.turnOrder[state.currentTurnIndex]) ?? null
    : null;

  const startBattle = useCallback((character: NftCharacter, difficulty: "easy" | "medium" | "hard" | "deadly", charClass?: CharacterClass, allCharacters?: NftCharacter[], featIds?: string[], weaponName?: string, spellInfo?: SpellUnitInfo, currentHp?: number, followers?: Follower[], progression?: EntityProgression, extraHeroes?: { char: NftCharacter; charClass?: CharacterClass; featIds?: string[]; weaponName?: string; spellInfo?: SpellUnitInfo; currentHp?: number; progression?: EntityProgression }[], armorEffect?: string, shieldEffect?: string) => {
    const player = createPlayerUnit(character, { q: 1, r: 5 }, charClass, featIds ?? [], weaponName, spellInfo, currentHp, progression, undefined, armorEffect, shieldEffect);
    // Extra hero positions (behind leader)
    const heroPositions: HexCoord[] = [{ q: 0, r: 5 }, { q: 0, r: 4 }, { q: 0, r: 6 }];
    const extraHeroUnits = (extraHeroes ?? []).slice(0, 3).map((h, i) =>
      createPlayerUnit(h.char, heroPositions[i], h.charClass, h.featIds ?? [], h.weaponName, h.spellInfo, h.currentHp, h.progression, i + 1)
    );
    const followerPositions: HexCoord[] = [{ q: 1, r: 4 }, { q: 1, r: 6 }, { q: 2, r: 4 }, { q: 2, r: 6 }];
    const followerUnits = (followers ?? [])
      .filter(f => f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged"))
      .slice(0, 4)
      .map((f, i) => createFollowerUnit(f, followerPositions[i], i));
    const specs = generateEncounter(difficulty, allCharacters ?? []);
    const startPositions: HexCoord[] = [{ q: 8, r: 4 }, { q: 8, r: 6 }, { q: 7, r: 5 }];
    const enemies = specs.map((s, i) => createEnemyUnit(s, startPositions[i], i));
    dispatch({ type: "INIT", player, enemies, followers: followerUnits, extraHeroes: extraHeroUnits });
  }, []);

  /** Start a quest battle with pre-built enemy specs (bypasses encounter generation) */
  const startQuestBattle = useCallback((character: NftCharacter, specs: EnemySpec[], charClass?: CharacterClass, featIds?: string[], weaponName?: string, spellInfo?: SpellUnitInfo, currentHp?: number, followers?: Follower[], progression?: EntityProgression, extraHeroes?: { char: NftCharacter; charClass?: CharacterClass; featIds?: string[]; weaponName?: string; spellInfo?: SpellUnitInfo; currentHp?: number; progression?: EntityProgression }[], armorEffect?: string, shieldEffect?: string) => {
    const playerPos = { q: 1, r: 5 };
    const player = createPlayerUnit(character, playerPos, charClass, featIds ?? [], weaponName, spellInfo, currentHp, progression, undefined, armorEffect, shieldEffect);
    const heroPositions: HexCoord[] = [{ q: 0, r: 5 }, { q: 0, r: 4 }, { q: 0, r: 6 }];
    const extraHeroUnits = (extraHeroes ?? []).slice(0, 3).map((h, i) =>
      createPlayerUnit(h.char, heroPositions[i], h.charClass, h.featIds ?? [], h.weaponName, h.spellInfo, h.currentHp, h.progression, i + 1)
    );
    const followerPositions: HexCoord[] = [{ q: 1, r: 4 }, { q: 1, r: 6 }, { q: 2, r: 4 }, { q: 2, r: 6 }];
    const followerUnits = (followers ?? [])
      .filter(f => f.alive && f.hp > 0 && (f.role === "melee" || f.role === "ranged"))
      .slice(0, 4)
      .map((f, i) => createFollowerUnit(f, followerPositions[i], i));
    const spawnPositions = generateSpawnPositions(specs.length, playerPos);
    const enemies = specs.map((s, i) => createEnemyUnit(s, spawnPositions[i], i));
    dispatch({ type: "INIT", player, enemies, followers: followerUnits, extraHeroes: extraHeroUnits });
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

  const attemptRetreat = useCallback((roll: number, dc: number) => {
    if (state.phase !== "playerTurn") return;
    dispatch({ type: "RETREAT", roll, dc });
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
    // Target nearest conscious player-side unit (cruel enemies also target unconscious)
    const targetFilter = enemy?.cruel
      ? (u: BattleUnit) => u.isPlayer && isAlive(u)
      : (u: BattleUnit) => u.isPlayer && isConscious(u);
    const player = state.units
      .filter(targetFilter)
      // Prefer conscious targets even for cruel enemies — only hit downed foes if nothing else
      .sort((a, b) => {
        const aConscious = isConscious(a) ? 0 : 1;
        const bConscious = isConscious(b) ? 0 : 1;
        if (aConscious !== bConscious) return aConscious - bConscious;
        return hexDistance(enemy?.position ?? a.position, a.position) - hexDistance(enemy?.position ?? b.position, b.position);
      })[0] ?? null;
    if (!enemy || !isConscious(enemy)) {
      timerRef.current = setTimeout(() => {
        if (!cancelled) dispatch({ type: "NEXT_TURN" });
      }, 300);
      return () => { cancelled = true; };
    }

    // ── Food-motivated predator AI ────────────────────────────────────────
    if (enemy.motivation === "food") {
      const occupied = new Set(
        state.units.filter(u => u.id !== enemy.id && isConscious(u)).map(u => `${u.position.q},${u.position.r}`)
      );
      const maxSteps = Math.floor(enemy.stats.speed / 5);
      const isAtEdge = (p: HexCoord) => p.q === 0 || p.q === GRID_COLS - 1 || p.r === 0 || p.r === GRID_ROWS - 1;

      // Find nearest edge hex for fleeing
      const nearestEdgeHex = (from: HexCoord): HexCoord => {
        const edges: HexCoord[] = [];
        for (let q = 0; q < GRID_COLS; q++) { edges.push({ q, r: 0 }); edges.push({ q, r: GRID_ROWS - 1 }); }
        for (let r = 1; r < GRID_ROWS - 1; r++) { edges.push({ q: 0, r }); edges.push({ q: GRID_COLS - 1, r }); }
        return edges.reduce((a, b) => hexDistance(from, b) < hexDistance(from, a) ? b : a);
      };

      // (1) Pack already fed — flee toward edge
      if (state.packFed && !enemy.carrying) {
        const edgeDest = nearestEdgeHex(enemy.position);
        const newPos = greedyPathTo(enemy.position, edgeDest, maxSteps, occupied, 0);
        const atEdge = isAtEdge(newPos);
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          const moved = newPos.q !== enemy.position.q || newPos.r !== enemy.position.r;
          if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            if (atEdge) {
              // Fleeing without a body — just remove from combat
              dispatch({ type: "ENEMY_FLEE", unitId: enemy.id, escaped: true });
              timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 800);
            } else {
              dispatch({ type: "NEXT_TURN" });
            }
          }, moved ? 500 : 100);
        }, 400);
        return () => { cancelled = true; };
      }

      // (2) Carrying a body — flee toward edge
      if (enemy.carrying) {
        const edgeDest = nearestEdgeHex(enemy.position);
        const newPos = greedyPathTo(enemy.position, edgeDest, maxSteps, occupied, 0);
        const atEdge = isAtEdge(newPos);
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          const moved = newPos.q !== enemy.position.q || newPos.r !== enemy.position.r;
          if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            if (atEdge) {
              dispatch({ type: "ENEMY_FLEE", unitId: enemy.id, escaped: true });
              timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 800);
            } else {
              dispatch({ type: "NEXT_TURN" });
            }
          }, moved ? 500 : 100);
        }, 400);
        return () => { cancelled = true; };
      }

      // (3) Adjacent to an unconscious body — grab it
      const adjacentBody = state.units.find(u =>
        u.isPlayer && isUnconscious(u) && isAdjacent(enemy.position, u.position)
      );
      if (adjacentBody) {
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          dispatch({ type: "GRAB_BODY", unitId: enemy.id, bodyId: adjacentBody.id });
          timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 800);
        }, 400);
        return () => { cancelled = true; };
      }

      // (4) Unconscious body exists — move toward it
      const nearestBody = state.units
        .filter(u => u.isPlayer && isUnconscious(u))
        .sort((a, b) => hexDistance(enemy.position, a.position) - hexDistance(enemy.position, b.position))[0];
      if (nearestBody) {
        const newPos = computeEnemyMove(enemy, nearestBody, state.units);
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          const moved = newPos.q !== enemy.position.q || newPos.r !== enemy.position.r;
          if (moved) dispatch({ type: "ENEMY_MOVE", unitId: enemy.id, hex: newPos });
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            // Check if now adjacent after moving
            if (isAdjacent(newPos, nearestBody.position)) {
              dispatch({ type: "GRAB_BODY", unitId: enemy.id, bodyId: nearestBody.id });
              timerRef.current = setTimeout(() => { if (!cancelled) dispatch({ type: "NEXT_TURN" }); }, 800);
            } else {
              dispatch({ type: "NEXT_TURN" });
            }
          }, moved ? 500 : 100);
        }, 400);
        return () => { cancelled = true; };
      }
      // (5) No bodies available — fall through to normal combat to down someone
    }

    // ── Normal AI needs a target ──
    if (!player) {
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
        if (dist <= enemy.attackRange && isConscious(enemy)) {
          const natural = rollD20();
          const result = resolveAttack(enemy, player, natural, dist);
          dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, targetId: player.id, natural, result });
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
      if (playerNow?.readiedAttack && moved && !wasInRange && nowInRange && isConscious(playerNow)) {
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
              dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, targetId: playerNow.id, natural: n2, result: r2 });
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
          dispatch({ type: "ENEMY_ATTACK", unitId: enemy.id, targetId: player.id, natural, result });
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
    attemptRetreat,
    takeAoO,
    passAoO,
  };
}
