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
  gridPos: number; // 0-8 position on 3x3 grid (0=front-left, 2=front-right, 6=back-left, 8=back-right)
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
  return { character: char, stats: s, currentHp: s.hp, maxHp: s.hp, isPlayer, index, burns: [], gridPos: -1 };
}

/** Roll 1-20: 1=miss, 20=crit (2x), else normal */
function rollD20(): { roll: number; mult: number; label: string } {
  const roll = Math.floor(Math.random() * 20) + 1;
  if (roll === 1) return { roll, mult: 0, label: "MISS" };
  if (roll === 20) return { roll, mult: 2, label: "CRIT" };
  return { roll, mult: 1, label: "" };
}

/** Check if attacker is flanking: no enemy directly ahead in same column */
function isFlanking(attacker: CombatUnit, opponents: CombatUnit[]): boolean {
  if (attacker.gridPos < 0) return false;
  const col = gridCol(attacker.gridPos);
  const row = gridRow(attacker.gridPos);
  // Flanking if no opponent in the same column in a row closer to attacker (between attacker and target)
  // Simplified: flanking if no opponent in front row of attacker's column
  const blocking = opponents.filter(o =>
    o.currentHp > 0 && o.gridPos >= 0 &&
    gridCol(o.gridPos) === col && gridRow(o.gridPos) === 0
  );
  return blocking.length === 0;
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

// Grid helpers: 3x3 grid, rows 0=front, 1=mid, 2=back
export function gridRow(pos: number): number { return Math.floor(pos / 3); }
export function gridCol(pos: number): number { return pos % 3; }

/** Get valid moves from a grid position (1 square: up/down/left/right) */
export function getValidMoves(pos: number, occupied: Set<number>): number[] {
  const row = gridRow(pos);
  const col = gridCol(pos);
  const moves: number[] = [];
  if (row > 0) moves.push((row - 1) * 3 + col); // forward
  if (row < 2) moves.push((row + 1) * 3 + col); // backward
  if (col > 0) moves.push(row * 3 + (col - 1)); // left
  if (col < 2) moves.push(row * 3 + (col + 1)); // right
  return moves.filter(m => !occupied.has(m));
}

/** Find forward attack target: front row (row 0) attacks matching column, then adjacent columns */
function pickForwardTarget(attacker: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
  if (attacker.gridPos < 0) return pickTargetByHp(enemies);
  const col = gridCol(attacker.gridPos);
  const alive = enemies.filter(e => e.currentHp > 0 && e.gridPos >= 0);
  if (alive.length === 0) return pickTargetByHp(enemies);

  // Priority: same column front row, then same column any row, then adjacent columns, then any
  const sameColFront = alive.filter(e => gridCol(e.gridPos) === col && gridRow(e.gridPos) === 0);
  if (sameColFront.length > 0) return sameColFront.reduce((a, b) => a.currentHp < b.currentHp ? a : b);

  const sameCol = alive.filter(e => gridCol(e.gridPos) === col);
  if (sameCol.length > 0) return sameCol.reduce((a, b) => gridRow(a.gridPos) < gridRow(b.gridPos) ? a : b);

  const adjCol = alive.filter(e => Math.abs(gridCol(e.gridPos) - col) === 1);
  if (adjCol.length > 0) return adjCol.reduce((a, b) => a.currentHp < b.currentHp ? a : b);

  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Pick target: alive enemy with lowest HP (fallback) */
function pickTargetByHp(enemies: CombatUnit[]): CombatUnit | null {
  const alive = enemies.filter(e => e.currentHp > 0);
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Can this unit attack? Must be in front row (row 0) or no one in front of them */
export function canAttack(unit: CombatUnit, allies: CombatUnit[]): boolean {
  if (unit.gridPos < 0) return true; // no grid = legacy mode
  const row = gridRow(unit.gridPos);
  if (row === 0) return true; // front row always attacks
  // Can attack if no alive ally is in any row ahead in the same column
  const col = gridCol(unit.gridPos);
  const aliveAhead = allies.filter(a =>
    a.currentHp > 0 && a.gridPos >= 0 && a.index !== unit.index &&
    gridCol(a.gridPos) === col && gridRow(a.gridPos) < row
  );
  return aliveAhead.length === 0; // attack if column ahead is clear
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

  // Resolve burns — each entry is one tick of one fire stack, all tick simultaneously
  for (const units of [p, e]) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.currentHp <= 0 || u.burns.length === 0) continue;
      // Sum all active burn ticks for this round
      const totalBurn = u.burns.reduce((sum, b) => sum + b, 0);
      // Each burn stack loses one tick (remove one entry per stack)
      // burns is stored as groups of 3: [d,d,d, d,d,d, ...] — each fire hit adds 3 ticks
      // Decrement: remove one tick from each active fire (every 3rd starting from end)
      // Simpler: just pop one entry per stack. Since each hit pushes 3, we track by counting.
      // Actually the simplest correct approach: each entry = 1 tick. All tick this round, then remove them.
      // But we want stacking: hit1 adds [10,10,10], hit2 adds [15,15,15] → burns = [10,10,10,15,15,15]
      // This round: total = 10+10+10+15+15+15 = 75? No, that's wrong — should be 10+15=25 this round.
      //
      // Better model: burns = array of { dmg, ticksLeft }
      // But to keep it simple with the number[] format:
      // Store as pairs: burns[i] = damage for that specific tick
      // Each fire hit pushes 3 ticks at that damage
      // Each round, we take the FIRST tick from each group-of-3 and sum them
      //
      // Simplest correct fix: burns = each element is one remaining tick.
      // All elements tick this round (sum them all), then decrement by removing one per original-fire-group.
      //
      // Actually let's just sum all and remove one from each: stride through removing every element
      // with the same damage value once... this is getting complicated.
      //
      // Clean approach: just sum all burn values, then remove one tick per distinct fire source.
      // Since we push 3 identical values per fire hit, group by value, tick once per group.
      const stacks = new Map<number, number>(); // dmg -> count
      for (const b of u.burns) stacks.set(b, (stacks.get(b) || 0) + 1);
      let stackDmg = 0;
      const remaining: number[] = [];
      for (const [dmg, count] of stacks) {
        stackDmg += dmg; // each stack does its damage once this round
        for (let t = 0; t < count - 1; t++) remaining.push(dmg); // remove one tick per stack
      }
      u.burns = remaining;
      u.currentHp = Math.max(0, u.currentHp - stackDmg);
      events.push({
        attackerName: `🔥 Burn (×${stacks.size})`, targetName: u.character.name,
        damage: stackDmg, damageType: "burn", targetHpAfter: u.currentHp, killed: u.currentHp <= 0,
      });
    }
  }

  // Players attack enemies — all units attack every round, grid affects targeting
  for (const player of p) {
    if (player.currentHp <= 0) continue;
    // Use player-chosen target if available, fall back to forward-target
    let target: CombatUnit | null = null;
    if (targetMap && targetMap.has(player.index)) {
      const chosenIdx = targetMap.get(player.index)!;
      const chosen = e[chosenIdx];
      target = chosen && chosen.currentHp > 0 ? chosen : pickForwardTarget(player, e);
    } else {
      target = pickForwardTarget(player, e);
    }
    if (!target) break;

    // D20 roll
    const { roll, mult, label } = rollD20();
    if (mult === 0) {
      events.push({ attackerName: `🎲${roll} ${player.character.name}`, targetName: target.character.name, damage: 0, damageType: "physical", targetHpAfter: target.currentHp, killed: false });
      continue;
    }

    // Flank check: no enemy in front row of attacker's column = 1.5x
    const flanking = isFlanking(player, e);
    const flankMult = flanking ? 1.5 : 1;
    const totalMult = mult * flankMult;
    const rollPrefix = `🎲${roll}${label ? ` ${label}` : ""}${flanking ? " FLANK" : ""} `;

    const dmg = calcDamage(player.stats, target.stats);

    // Physical
    if (dmg.phys > 0) {
      const d = dmg.phys * totalMult;
      target.currentHp = Math.max(0, target.currentHp - d);
      events.push({ attackerName: rollPrefix + player.character.name, targetName: target.character.name, damage: d, damageType: "physical", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
    // Electric — also hits adjacent enemy
    if (dmg.electric > 0) {
      const d = dmg.electric * totalMult;
      target.currentHp = Math.max(0, target.currentHp - d);
      events.push({ attackerName: rollPrefix + player.character.name, targetName: target.character.name, damage: d, damageType: "electric", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
      // Splash to adjacent column enemy only (not far column)
      const targetCol = target.gridPos >= 0 ? gridCol(target.gridPos) : -1;
      const splash = e.find(x => x.currentHp > 0 && x.index !== target.index &&
        (x.gridPos < 0 || targetCol < 0 || Math.abs(gridCol(x.gridPos) - targetCol) === 1));
      if (splash) {
        const splashDmg = d * 0.5;
        splash.currentHp = Math.max(0, splash.currentHp - splashDmg);
        events.push({ attackerName: player.character.name, targetName: `${splash.character.name} ⚡`, damage: splashDmg, damageType: "electric", targetHpAfter: splash.currentHp, killed: splash.currentHp <= 0 });
      }
    }
    // Fire — initial hit + 3 ticks of burn DoT (stacks independently with other fires)
    if (dmg.fire > 0) {
      const d = dmg.fire * totalMult;
      target.currentHp = Math.max(0, target.currentHp - d);
      target.burns.push(d, d, d); // 3 burn ticks at scaled damage
      events.push({ attackerName: rollPrefix + player.character.name, targetName: target.character.name, damage: d, damageType: "fire", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
    // Mana
    if (dmg.mana > 0) {
      const d = dmg.mana * totalMult;
      target.currentHp = Math.max(0, target.currentHp - d);
      events.push({ attackerName: rollPrefix + player.character.name, targetName: target.character.name, damage: d, damageType: "mana", targetHpAfter: target.currentHp, killed: target.currentHp <= 0 });
    }
  }

  // Enemies attack players — all attack, grid affects targeting, with D20 and flank
  for (const enemy of e) {
    if (enemy.currentHp <= 0 || enemy.gridPos === -1) continue;
    const target = pickForwardTarget(enemy, p);
    if (!target) break;

    const { roll, mult, label } = rollD20();
    if (mult === 0) {
      events.push({ attackerName: `🎲${roll} ${enemy.character.name}`, targetName: target.character.name, damage: 0, damageType: "physical", targetHpAfter: target.currentHp, killed: false });
      continue;
    }

    const flanking = isFlanking(enemy, p);
    const flankMult = flanking ? 1.5 : 1;
    const totalMult = mult * flankMult;
    const rollPrefix = `🎲${roll}${label ? ` ${label}` : ""}${flanking ? " FLANK" : ""} `;

    const dmg = calcDamage(enemy.stats, target.stats);
    const totalDmg = (dmg.phys + dmg.electric + dmg.fire + dmg.mana) * totalMult;
    target.currentHp = Math.max(0, target.currentHp - totalDmg);
    if (dmg.fire > 0) {
      const fireDmg = dmg.fire * totalMult;
      target.burns.push(fireDmg, fireDmg, fireDmg);
    }
    events.push({
      attackerName: rollPrefix + enemy.character.name, targetName: target.character.name,
      damage: totalDmg, damageType: "physical", targetHpAfter: target.currentHp, killed: target.currentHp <= 0,
    });
  }

  // Bring reserves onto the grid to fill empty spots
  const occupiedEnemyPos = new Set(e.filter(u => u.currentHp > 0 && u.gridPos >= 0).map(u => u.gridPos));
  const backfillPositions = [1, 0, 2, 4, 3, 5, 7, 6, 8].filter(pos => !occupiedEnemyPos.has(pos));
  for (const reserve of e) {
    if (reserve.gridPos !== -1 || reserve.currentHp <= 0 || backfillPositions.length === 0) continue;
    reserve.gridPos = backfillPositions.shift()!;
    events.push({
      attackerName: "📢 Reinforcement", targetName: reserve.character.name,
      damage: 0, damageType: "physical", targetHpAfter: reserve.currentHp, killed: false,
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
  npcAddress?: string,
  npcAddresses?: string[],
): CombatUnit[] {
  // Multiple named NPCs — first 9 on grid, rest are reserves (gridPos = -1)
  if (npcAddresses && npcAddresses.length > 0) {
    const positions = [1, 0, 2, 4, 3, 5, 7, 6, 8];
    const units: CombatUnit[] = [];
    npcAddresses.forEach((addr, i) => {
      const npc = allCharacters.find(c => c.contractAddress.toLowerCase() === addr.toLowerCase());
      if (npc) {
        const unit = makeUnit(npc, false, i, aiStrength);
        unit.gridPos = i < 9 ? positions[i] : -1; // reserves off-grid
        units.push(unit);
      }
    });
    if (units.length > 0) return units;
  }

  // Single named NPC
  if (npcAddress) {
    const npc = allCharacters.find(c => c.contractAddress.toLowerCase() === npcAddress.toLowerCase());
    if (npc) {
      const unit = makeUnit(npc, false, 0, aiStrength);
      unit.gridPos = 1; // front-center
      return [unit];
    }
  }

  // Fixed enemy count — not scaled by player count (encourages owning more/stronger NFTs)
  const enemyCount = Math.max(1, Math.min(5, Math.ceil(allCharacters.length * 0.03)));

  let pool = [...allCharacters];
  if (aiDeckBias === "aggressive") {
    pool.sort((a, b) => (b.stats.attack + b.stats.mAtk + b.stats.fAtk) - (a.stats.attack + a.stats.mAtk + a.stats.fAtk));
  } else if (aiDeckBias === "defensive") {
    pool.sort((a, b) => (b.stats.def + b.stats.mDef + b.stats.hp) - (a.stats.def + a.stats.mDef + a.stats.hp));
  } else if (aiDeckBias === "magic") {
    pool.sort((a, b) => (b.stats.mAtk + b.stats.mana) - (a.stats.mAtk + a.stats.mana));
  }

  // Place enemies on grid: fill front row first, then mid
  const enemyPositions = [1, 0, 2, 4, 3, 5, 7, 6, 8]; // center-first placement
  return pool.slice(0, enemyCount).map((char, i) => {
    const unit = makeUnit(char, false, i, aiStrength);
    unit.gridPos = enemyPositions[i] ?? i;
    return unit;
  });
}
