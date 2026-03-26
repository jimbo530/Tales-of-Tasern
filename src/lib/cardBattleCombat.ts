import type { Board, BoardCard, CombatEvent } from "./cardBattleTypes";
import type { ComputedStats } from "./battleStats";

const SUPPORT_BONUS = 0.2;
const FIRE_DOT_TURNS = 2; // fire burns for 2 additional turns after initial hit

function calcDamage(attacker: ComputedStats, defender: ComputedStats): {
  phys: number; magic: number; fire: number; mana: number;
} {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.fAtk > 0;
  const defenderHasSpecial = defender.mAtk > 0 || defender.fAtk > 0;

  const effectiveMDef = defenderHasSpecial ? defender.mDef : defender.mDef + defender.mana;
  const physArmor = defenderHasSpecial ? defender.def : defender.def + effectiveMDef * 0.5;

  const phys = attacker.attack * (100 / (100 + physArmor));
  const magic = attacker.mAtk * (100 / (100 + effectiveMDef));
  const fire = attacker.fAtk * (100 / (100 + defender.def));
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

// Fortress takes raw damage — all types hit it
function calcFortressDamage(attacker: ComputedStats): number {
  const attackerHasSpecial = attacker.mAtk > 0 || attacker.fAtk > 0;
  return attacker.attack + attacker.mAtk + attacker.fAtk +
    (attackerHasSpecial ? attacker.mana : 0);
}

function getEffectiveStats(card: BoardCard, backRowCard: BoardCard | null): ComputedStats {
  if (!backRowCard) return card.stats;
  return {
    ...card.stats,
    def: card.stats.def + backRowCard.stats.def * SUPPORT_BONUS,
    mDef: card.stats.mDef + backRowCard.stats.mDef * SUPPORT_BONUS,
  };
}

function addDamage(map: Map<string, number>, key: string, dmg: number) {
  map.set(key, (map.get(key) ?? 0) + dmg);
}

// Apply lightning splash to adjacent columns (heroes only, not fortress)
function applyLightningSplash(
  attackerStats: ComputedStats,
  col: number,
  defenderBoard: Board,
  damageMap: Map<string, number>,
  events: CombatEvent[],
  attackerPlayer: 1 | 2,
  attackerName: string,
) {
  if (attackerStats.mAtk <= 0) return;

  for (const adjCol of [col - 1, col + 1]) {
    if (adjCol < 0 || adjCol >= 5) continue;
    const adjFront = defenderBoard[adjCol][1];
    const adjBack = defenderBoard[adjCol][0];
    const adjTarget = adjFront ?? adjBack;
    if (!adjTarget) continue; // no hero = no splash (lightning doesn't hit fortress)

    const adjDefender = adjFront
      ? getEffectiveStats(adjFront, adjBack)
      : adjTarget.stats;
    const defenderHasSpecial = adjDefender.mAtk > 0 || adjDefender.fAtk > 0;
    const effectiveMDef = defenderHasSpecial ? adjDefender.mDef : adjDefender.mDef + adjDefender.mana;
    const splashDmg = attackerStats.mAtk * (100 / (100 + effectiveMDef));

    if (splashDmg > 0) {
      const targetKey = adjFront ? `${adjCol}-1` : `${adjCol}-0`;
      addDamage(damageMap, targetKey, splashDmg);
      events.push({
        col: adjCol, attackerPlayer, attackerName,
        targetName: `${adjTarget.character.name} ⚡`,
        physDmg: 0, magicDmg: splashDmg, fireDmg: 0, manaDmg: 0, totalDmg: splashDmg,
      });
    }
  }
}

// Apply fire DoT burns stored on cards
function applyBurnDamage(
  board: Board,
  damageMap: Map<string, number>,
  events: CombatEvent[],
  attackerPlayer: 1 | 2,
): Board {
  return board.map((col, c) =>
    col.map((card, r) => {
      if (!card || card.burns.length === 0) return card;
      const burnDmg = card.burns[0];
      const remainingBurns = card.burns.slice(1);
      if (burnDmg > 0) {
        addDamage(damageMap, `${c}-${r}`, burnDmg);
        events.push({
          col: c, attackerPlayer, attackerName: "🔥 Burn",
          targetName: card.character.name,
          physDmg: 0, magicDmg: 0, fireDmg: burnDmg, manaDmg: 0, totalDmg: burnDmg,
        });
      }
      return { ...card, burns: remainingBurns };
    })
  );
}

// Store fire DoT on a target card — full damage for 2 more turns
function addFireBurn(
  board: Board,
  col: number,
  row: number,
  fireDmg: number,
): Board {
  if (fireDmg <= 0) return board;
  return board.map((c, ci) =>
    c.map((card, ri) => {
      if (ci !== col || ri !== row || !card) return card;
      return { ...card, burns: [...card.burns, fireDmg, fireDmg] };
    })
  );
}

export function resolveCombat(
  board1: Board,
  board2: Board,
): { events: CombatEvent[]; board1Damage: Map<string, number>; board2Damage: Map<string, number>; fortress1Dmg: number; fortress2Dmg: number; newBoard1: Board; newBoard2: Board } {
  const events: CombatEvent[] = [];
  const board1Damage = new Map<string, number>();
  const board2Damage = new Map<string, number>();
  let fortress1Dmg = 0;
  let fortress2Dmg = 0;

  // Clone boards for fire DoT tracking
  let b1 = board1.map((col) => col.map((card) => card ? { ...card, burns: [...card.burns] } : null));
  let b2 = board2.map((col) => col.map((card) => card ? { ...card, burns: [...card.burns] } : null));

  // Phase 1: Resolve existing burns
  b1 = applyBurnDamage(b1, board1Damage, events, 2); // P2's fire is burning P1's cards
  b2 = applyBurnDamage(b2, board2Damage, events, 1); // P1's fire is burning P2's cards

  // Phase 2: Normal combat per column
  for (let col = 0; col < 5; col++) {
    const p1Front = b1[col][1];
    const p1Back = b1[col][0];
    const p2Front = b2[col][1];
    const p2Back = b2[col][0];

    // Player 1's front row attacks Player 2
    if (p1Front) {
      const target = p2Front ?? p2Back;
      if (target) {
        const effectiveDefender = p2Front
          ? getEffectiveStats(p2Front, p2Back)
          : target.stats;
        const dmg = calcDamage(p1Front.stats, effectiveDefender);

        // Fire: 1/3 immediate, 2/3 as DoT
        const total = dmg.phys + dmg.magic + dmg.fire + dmg.mana;
        const targetKey = p2Front ? `${col}-1` : `${col}-0`;
        addDamage(board2Damage, targetKey, total);

        // Store fire DoT on target
        if (dmg.fire > 0) {
          const targetRow = p2Front ? 1 : 0;
          b2 = addFireBurn(b2, col, targetRow, dmg.fire);
        }

        events.push({
          col, attackerPlayer: 1, attackerName: p1Front.character.name,
          targetName: target.character.name,
          physDmg: dmg.phys, magicDmg: dmg.magic, fireDmg: dmg.fire, manaDmg: dmg.mana, totalDmg: total,
        });

        // Lightning splash to adjacent columns
        applyLightningSplash(p1Front.stats, col, b2, board2Damage, events, 1, p1Front.character.name);
      } else {
        // No cards — attack fortress (no lightning, no fire DoT on fortress)
        const dmg = calcFortressDamage(p1Front.stats);
        fortress2Dmg += dmg;
        events.push({
          col, attackerPlayer: 1, attackerName: p1Front.character.name,
          targetName: "Fortress",
          physDmg: dmg, magicDmg: 0, fireDmg: 0, manaDmg: 0, totalDmg: dmg,
        });
      }
    }

    // Player 2's front row attacks Player 1
    if (p2Front) {
      const target = p1Front ?? p1Back;
      if (target) {
        const effectiveDefender = p1Front
          ? getEffectiveStats(p1Front, p1Back)
          : target.stats;
        const dmg = calcDamage(p2Front.stats, effectiveDefender);

        const total = dmg.phys + dmg.magic + dmg.fire + dmg.mana;
        const targetKey = p1Front ? `${col}-1` : `${col}-0`;
        addDamage(board1Damage, targetKey, total);

        if (dmg.fire > 0) {
          const targetRow = p1Front ? 1 : 0;
          b1 = addFireBurn(b1, col, targetRow, dmg.fire);
        }

        events.push({
          col, attackerPlayer: 2, attackerName: p2Front.character.name,
          targetName: target.character.name,
          physDmg: dmg.phys, magicDmg: dmg.magic, fireDmg: dmg.fire, manaDmg: dmg.mana, totalDmg: total,
        });

        applyLightningSplash(p2Front.stats, col, b1, board1Damage, events, 2, p2Front.character.name);
      } else {
        const dmg = calcFortressDamage(p2Front.stats);
        fortress1Dmg += dmg;
        events.push({
          col, attackerPlayer: 2, attackerName: p2Front.character.name,
          targetName: "Fortress",
          physDmg: dmg, magicDmg: 0, fireDmg: 0, manaDmg: 0, totalDmg: dmg,
        });
      }
    }
  }

  return { events, board1Damage, board2Damage, fortress1Dmg, fortress2Dmg, newBoard1: b1, newBoard2: b2 };
}
