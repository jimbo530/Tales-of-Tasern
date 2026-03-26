"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { NftCharacter } from "./useNftStats";
import { computeStats, type ComputedStats } from "@/lib/battleStats";

export type BattleEvent = {
  tick: number;
  attacker: 1 | 2;
  physDmg: number;
  magicDmg: number;
  fireDmg: number;
  manaDmg: number;
  totalDmg: number;
  targetHpAfter: number;
};

export type BattleState = {
  hp1: number;
  hp2: number;
  maxHp1: number;
  maxHp2: number;
  stats1: ComputedStats;
  stats2: ComputedStats;
  log: BattleEvent[];
  status: "waiting" | "running" | "finished";
  winner: 1 | 2 | "draw" | null;
  tick: number;
  start: () => void;
  reset: () => void;
};

const TICK_MS = 1500;

function calcDamage(attacker: ComputedStats, defender: ComputedStats): { phys: number; magic: number; fire: number; mana: number } {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.fAtk > 0;
  const defenderHasSpecial = defender.mAtk > 0 || defender.fAtk > 0;

  // Defender's effective MDEF:
  // If defender has no special attacks, their MANA adds to MDEF
  const effectiveMDef = defenderHasSpecial
    ? defender.mDef
    : defender.mDef + defender.mana;

  // If defender has no special attacks, MDEF also blocks 50% physical
  const physArmor = defenderHasSpecial
    ? defender.def
    : defender.def + effectiveMDef * 0.5;

  // Physical ATK — reduced by DEF (+ 50% effective MDEF if defender has no specials)
  const phys = attacker.attack * (100 / (100 + physArmor));

  // Electric ATK — reduced by MDEF
  const magic = attacker.mAtk * (100 / (100 + effectiveMDef));

  // Fire ATK — reduced by DEF
  const fire = attacker.fAtk * (100 / (100 + defender.def));

  // MANA as special attack — only if attacker HAS special attacks, reduced by MDEF
  const mana = attackerHasSpecial && attacker.mana > 0
    ? attacker.mana * (100 / (100 + effectiveMDef))
    : 0;

  return {
    phys: Math.max(phys, 0.5),
    magic: Math.max(magic, 0),
    fire: Math.max(fire, 0),
    mana: Math.max(mana, 0),
  };
}

export function useBattle(fighter1: NftCharacter, fighter2: NftCharacter): BattleState {
  const stats1 = computeStats(fighter1.stats);
  const stats2 = computeStats(fighter2.stats);

  const [hp1, setHp1] = useState(stats1.hp);
  const [hp2, setHp2] = useState(stats2.hp);
  const [log, setLog] = useState<BattleEvent[]>([]);
  const [status, setStatus] = useState<"waiting" | "running" | "finished">("waiting");
  const [winner, setWinner] = useState<1 | 2 | "draw" | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setHp1(stats1.hp);
    setHp2(stats2.hp);
    setLog([]);
    setStatus("waiting");
    setWinner(null);
    setTick(0);
  }, [stats1.hp, stats2.hp]);

  const start = useCallback(() => {
    reset();
    setStatus("running");
  }, [reset]);

  useEffect(() => {
    if (status !== "running") return;

    intervalRef.current = setInterval(() => {
      setTick((prev) => {
        const t = prev + 1;

        setHp1((prevHp1) => {
          setHp2((prevHp2) => {
            if (prevHp1 <= 0 || prevHp2 <= 0) return prevHp2;

            // Fighter 1 attacks Fighter 2
            const dmg1 = calcDamage(stats1, stats2);
            const total1 = dmg1.phys + dmg1.magic + dmg1.fire + dmg1.mana;

            // Fighter 2 attacks Fighter 1
            const dmg2 = calcDamage(stats2, stats1);
            const total2 = dmg2.phys + dmg2.magic + dmg2.fire + dmg2.mana;

            const newHp2 = Math.max(0, prevHp2 - total1);
            const newHp1 = Math.max(0, prevHp1 - total2);

            setLog((prevLog) => [
              ...prevLog,
              {
                tick: t, attacker: 1,
                physDmg: dmg1.phys, magicDmg: dmg1.magic, fireDmg: dmg1.fire, manaDmg: dmg1.mana,
                totalDmg: total1, targetHpAfter: newHp2,
              },
              {
                tick: t, attacker: 2,
                physDmg: dmg2.phys, magicDmg: dmg2.magic, fireDmg: dmg2.fire, manaDmg: dmg2.mana,
                totalDmg: total2, targetHpAfter: newHp1,
              },
            ]);

            if (newHp1 <= 0 || newHp2 <= 0) {
              if (newHp1 <= 0 && newHp2 <= 0) {
                setWinner(newHp1 > newHp2 ? 1 : newHp2 > newHp1 ? 2 : "draw");
              } else {
                setWinner(newHp1 <= 0 ? 2 : 1);
              }
              setStatus("finished");
              if (intervalRef.current) clearInterval(intervalRef.current);
            }

            setHp1(newHp1);
            return newHp2;
          });
          return prevHp1; // actual update happens inside setHp2
        });

        return t;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, stats1, stats2]);

  return { hp1, hp2, maxHp1: stats1.hp, maxHp2: stats2.hp, stats1, stats2, log, status, winner, tick, start, reset };
}
