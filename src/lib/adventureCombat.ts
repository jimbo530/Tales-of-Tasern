import { computeStats, type ComputedStats } from "./battleStats";
import type { NftCharacter } from "@/hooks/useNftStats";

export type CombatUnit = {
  character: NftCharacter;
  stats: ComputedStats;
  currentHp: number;
  maxHp: number;
  isPlayer: boolean;
  index: number;
  burns: number[]; // fire DoT
};

export type CombatEvent = {
  attackerName: string;
  targetName: string;
  damage: number;
  damageType: "physical" | "electric" | "fire" | "mana" | "burn";
  targetHpAfter: number;
  killed: boolean;
};

export function makeUnit(char: NftCharacter, isPlayer: boolean, index: number, strengthMult = 1): CombatUnit {
  const stats = computeStats(char.stats);
  // Scale enemy stats by strength multiplier
  const s: ComputedStats = isPlayer ? stats : {
    attack: stats.attack * strengthMult,
    mAtk: stats.mAtk * strengthMult,
    fAtk: stats.fAtk * strengthMult,
    def: stats.def * strengthMult,
    mDef: stats.mDef * strengthMult,
    hp: stats.hp * strengthMult,
    healing: stats.healing * strengthMult,
    mana: stats.mana * strengthMult,
  };
  return { character: char, stats: s, currentHp: s.hp, maxHp: s.hp, isPlayer, index, burns: [] };
}

function calcDamage(attacker: ComputedStats, defender: ComputedStats): {
  phys: number; electric: number; fire: number; mana: number;
} {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.fAtk > 0;
  const defenderHasSpecial = defender.mAtk > 0 || defender.fAtk > 0;
  const effectiveMDef = defenderHasSpecial ? defender.mDef : defender.mDef + defender.mana;
  const physArmor = defenderHasSpecial ? defender.def : defender.def + effectiveMDef * 0.5;

  return {
    phys: Math.max(attacker.attack * (100 / (100 + physArmor)), 0.5),
    electric: Math.max(attacker.mAtk * (100 / (100 + effectiveMDef)), 0),
    fire: Math.max(attacker.fAtk * (100 / (100 + defender.def)), 0),
    mana: attackerHasSpecial && attacker.mana > 0 ? Math.max(attacker.mana * (100 / (100 + effectiveMDef)), 0) : 0,
  };
}

/** Pick target: alive enemy with lowest HP */
function pickTarget(enemies: CombatUnit[]): CombatUnit | null {
  const alive = enemies.filter(e => e.currentHp > 0);
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Resolve one full round of combat
 * @param targetMap — maps player index to enemy index they want to attack. If not provided, auto-targets lowest HP.
 */
export function resolveRound(
  players: CombatUnit[],
  enemies: CombatUnit[],
  targetMap?: Map<number, number>,
): { events: CombatEvent[]; players: CombatUnit[]; enemies: CombatUnit[] } {
  const events: CombatEvent[] = [];
  let p = players.map(u => ({ ...u, burns: [...u.burns] }));
  let e = enemies.map(u => ({ ...u, burns: [...u.burns] }));

  // Resolve healing first — heal self, overflow to adjacent allies
  for (const units of [p, e]) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.currentHp <= 0 || !u.stats.healing || u.stats.healing <= 0) continue;
      let healAmt = u.stats.healing;
      const missing = u.maxHp - u.currentHp;
      if (missing > 0) {
        const selfHeal = Math.min(healAmt, missing);
        u.currentHp += selfHeal;
        healAmt -= selfHeal;
        if (selfHeal > 0) events.push({ attackerName: "💚 Heal", targetName: u.character.name, damage: selfHeal, damageType: "physical", targetHpAfter: u.currentHp, killed: false });
      }
      // Overflow to adjacent allies
      if (healAmt > 0) {
        for (const adj of [i - 1, i + 1]) {
          if (adj < 0 || adj >= units.length || healAmt <= 0) continue;
          const ally = units[adj];
          if (ally.currentHp <= 0) continue;
          const allyMissing = ally.maxHp - ally.currentHp;
          if (allyMissing > 0) {
            const adjHeal = Math.min(healAmt, allyMissing);
            ally.currentHp += adjHeal;
            healAmt -= adjHeal;
            if (adjHeal > 0) events.push({ attackerName: "💚 Heal", targetName: ally.character.name, damage: adjHeal, damageType: "physical", targetHpAfter: ally.currentHp, killed: false });
          }
        }
      }
    }
  }

  // Resolve burns
  for (const units of [p, e]) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.currentHp <= 0 || u.burns.length === 0) continue;
      const burnDmg = u.burns[0];
      u.burns = u.burns.slice(1);
      u.currentHp = Math.max(0, u.currentHp - burnDmg);
      events.push({
        attackerName: "🔥 Burn", targetName: u.character.name,
        damage: burnDmg, damageType: "burn", targetHpAfter: u.currentHp, killed: u.currentHp <= 0,
      });
    }
  }

  // Players attack enemies
  for (const player of p) {
    if (player.currentHp <= 0) continue;
    // Use player-chosen target if available, fall back to auto-target
    let target: CombatUnit | null = null;
    if (targetMap && targetMap.has(player.index)) {
      const chosenIdx = targetMap.get(player.index)!;
      const chosen = e[chosenIdx];
      target = chosen && chosen.currentHp > 0 ? chosen : pickTarget(e);
    } else {
      target = pickTarget(e);
    }
    if (!target) break;

    const dmg = calcDamage(player.stats, target.stats);

    // Physical
    if (dmg.phys > 0) {
      target.currentHp = Math.max(0, target.currentHp - dmg.phys);
      events.push({ attackerName: player.character.name, targetName: target.character.name, damage: dmg.phys, damageType: "physical", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
    // Electric — also hits adjacent enemy
    if (dmg.electric > 0) {
      target.currentHp = Math.max(0, target.currentHp - dmg.electric);
      events.push({ attackerName: player.character.name, targetName: target.character.name, damage: dmg.electric, damageType: "electric", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
      // Splash to one other alive enemy
      const splash = e.find(x => x.currentHp > 0 && x.index !== target.index);
      if (splash) {
        const splashDmg = dmg.electric * 0.5;
        splash.currentHp = Math.max(0, splash.currentHp - splashDmg);
        events.push({ attackerName: player.character.name, targetName: `${splash.character.name} ⚡`, damage: splashDmg, damageType: "electric", targetHpAfter: splash.currentHp, killed: splash.currentHp <= 0 });
      }
    }
    // Fire — apply DoT
    if (dmg.fire > 0) {
      target.currentHp = Math.max(0, target.currentHp - dmg.fire);
      target.burns.push(dmg.fire, dmg.fire); // 2 more turns
      events.push({ attackerName: player.character.name, targetName: target.character.name, damage: dmg.fire, damageType: "fire", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
    // Mana
    if (dmg.mana > 0) {
      target.currentHp = Math.max(0, target.currentHp - dmg.mana);
      events.push({ attackerName: player.character.name, targetName: target.character.name, damage: dmg.mana, damageType: "mana", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
  }

  // Enemies attack players
  for (const enemy of e) {
    if (enemy.currentHp <= 0) continue;
    const target = pickTarget(p);
    if (!target) break;

    const dmg = calcDamage(enemy.stats, target.stats);
    const totalDmg = dmg.phys + dmg.electric + dmg.fire + dmg.mana;
    target.currentHp = Math.max(0, target.currentHp - totalDmg);
    if (dmg.fire > 0) target.burns.push(dmg.fire, dmg.fire);
    events.push({
      attackerName: enemy.character.name, targetName: target.character.name,
      damage: totalDmg, damageType: "physical", targetHpAfter: target.currentHp, killed: target.currentHp <= 0,
    });
  }

  return { events, players: p, enemies: e };
}

/** Generate enemy party based on encounter settings */
export function generateEnemies(
  allCharacters: NftCharacter[],
  playerCount: number,
  aiStrength: number,
  aiDeckBias: string,
): CombatUnit[] {
  // Enemy count scales with player count
  const enemyCount = Math.max(1, Math.min(playerCount + 1, 5));

  let pool = [...allCharacters];
  if (aiDeckBias === "aggressive") {
    pool.sort((a, b) => (b.stats.attack + b.stats.mAtk + b.stats.fAtk) - (a.stats.attack + a.stats.mAtk + a.stats.fAtk));
  } else if (aiDeckBias === "defensive") {
    pool.sort((a, b) => (b.stats.def + b.stats.mDef + b.stats.hp) - (a.stats.def + a.stats.mDef + a.stats.hp));
  } else if (aiDeckBias === "magic") {
    pool.sort((a, b) => (b.stats.mAtk + b.stats.mana) - (a.stats.mAtk + a.stats.mana));
  }

  // Strength scales with player count too
  const scaledStrength = aiStrength * (1 + (playerCount - 1) * 0.3);

  return pool.slice(0, enemyCount).map((char, i) => makeUnit(char, false, i, scaledStrength));
}
