import { STAT_TOKENS } from "./contracts";
import { BOON_ONLY_TOKENS, computeBoons, type Boon } from "./boons";

/**
 * D20 scaling curve: first 10 pts = $1/pt, next 10 = $10/pt, next 10 = $100/pt, etc.
 */
export function usdToPoints(usd: number): number {
  let pts = 0;
  let remaining = usd;
  let bracket = 0;
  while (remaining > 0) {
    const costPerPoint = Math.pow(10, bracket);
    const bracketCost = 10 * costPerPoint;
    if (remaining >= bracketCost) {
      pts += 10;
      remaining -= bracketCost;
    } else {
      pts += remaining / costPerPoint;
      remaining = 0;
    }
    bracket++;
  }
  return pts;
}

type TokenAmount = {
  symbol: string;
  amount: number;
  stat: string;
  addr?: string;
};

export type D20Stats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  naturalArmor: number;  // NA from boons (tree tokens, etc.) — blocks magic AND physical
  atk: number;
  speed: number;
  lightningDmg: number;
  fireDmg: number;
  lightningDice: DiceExpr | null;
  fireDice: DiceExpr | null;
  retaliationDice: DiceExpr | null;
  // ── Boon-derived combat fields ──
  bonusHp: number;            // +5/+20 from Fortitude boons
  initiativeBonus: number;    // +2 from Boon of Initiative
  hasEvasion: boolean;        // DEX saves: half→none, fail→half
  hasRegen: boolean;          // 1 HP/turn if above 0 HP
  autoStabilize: boolean;     // auto-stabilize at 0 HP
  hasDeathSave: boolean;      // drop to 1 HP instead of 0, 1/long rest
  hasPhoenix: boolean;        // revive at half HP on death, 1/long rest
  hasActionSurge: boolean;    // one extra action, 1/long rest
  resistances: string[];      // damage types with half damage
  immunities: string[];       // damage types with zero damage
  conditionImmunities: string[];  // immune to these conditions
  saveAdvantages: string[];   // advantage on saves vs these (e.g. "spells", "poison")
  boonSpells: BoonSpell[];    // spell-like abilities from boons
  retaliationDmg: number;     // lightning damage dealt to melee attackers (Tempest)
  hasGuardianReaction: boolean; // teleport to protect ally when hit
  oppAttackDisadvantage: boolean; // opportunity attacks against you have disadvantage
  halfRations: boolean;       // only need half food
  restHpBonus: number;        // +HP per rest from Sustenance/Wound Closure
  doubleConHealing: boolean;  // double CON mod healing on rest
  bonusActionHeal: boolean;   // bonus action regain half max HP, 1/long rest
  feastAura: boolean;         // short rest: allies 30ft get +1 HP per CON mod
  rerollD20: boolean;         // reroll one d20, 1/short rest
  fateDie: boolean;           // +/-1d10 any creature's roll, 1/short rest
  spellResistance: boolean;   // advantage on all saves vs spells
};

export type DiceExpr = { n: number; sides: number };

export type BoonSpell = {
  name: string;
  recharge: "short" | "long" | "at_will";
  damage?: number;         // average damage if offensive (kept for display)
  damageDice?: DiceExpr;   // actual dice to roll in combat
  range?: number;          // range in hexes (0 = self/touch)
  aoe?: number;            // radius in hexes
  effect?: string;         // description of non-damage effect
  isHealing?: boolean;
};

/** Default values for all boon-derived fields — spread into any inline D20Stats literal */
export const DEFAULT_BOON_FIELDS = {
  lightningDice: null as DiceExpr | null, fireDice: null as DiceExpr | null, retaliationDice: null as DiceExpr | null,
  bonusHp: 0, initiativeBonus: 0,
  hasEvasion: false, hasRegen: false, autoStabilize: false,
  hasDeathSave: false, hasPhoenix: false, hasActionSurge: false,
  resistances: [] as string[], immunities: [] as string[], conditionImmunities: [] as string[],
  saveAdvantages: [] as string[], boonSpells: [] as BoonSpell[], retaliationDmg: 0,
  hasGuardianReaction: false, oppAttackDisadvantage: false,
  halfRations: false, restHpBonus: 0, doubleConHealing: false,
  bonusActionHeal: false, feastAura: false,
  rerollD20: false, fateDie: false, spellResistance: false,
} as const;

// ─── Build lookup sets from STAT_TOKENS ──────────────────────────────────────
const lower = (arr: readonly string[]) => arr.map(t => t.toLowerCase());

// Game tokens (1x rate, 3 stats each)
const dddTokens = lower([...(STAT_TOKENS.polygon as any).ddd ?? []]);
const egpTokens = lower([...(STAT_TOKENS.base as any).egp ?? [], ...(STAT_TOKENS.polygon as any).egp ?? []]);
const ogcTokens = lower([...(STAT_TOKENS.polygon as any).ogc ?? []]);
const igsTokens = lower([...(STAT_TOKENS.polygon as any).igs ?? []]);
const btnTokens = lower([...(STAT_TOKENS.polygon as any).btn ?? []]);
const lgpTokens = lower([...(STAT_TOKENS.polygon as any).lgp ?? []]);
const dhgTokens = lower([...(STAT_TOKENS.polygon as any).dhg ?? []]);
const pktTokens = lower([...(STAT_TOKENS.polygon as any).pkt ?? []]);

// Impact stat tokens (1.5x rate, 3 stats each)
const burgersTokens = lower([...(STAT_TOKENS.base as any).burgers ?? []]);
const tgnTokens = lower([...(STAT_TOKENS.base as any).tgn ?? []]);
const regenTokens = lower([...(STAT_TOKENS.polygon as any).regen ?? []]);
const grantWizardTokens = lower([...(STAT_TOKENS.polygon as any).grantWizard ?? []]);

// Single-stat game tokens
const conTokens = lower([...(STAT_TOKENS.base as any).con ?? []]);

// Stablecoins (1x rate, split all 6)
const stablecoinTokens = lower([...STAT_TOKENS.base.stablecoin, ...STAT_TOKENS.polygon.stablecoin]);

const IMPACT_RATE = 1.5;

/**
 * Compute D20 ability scores + boons from token amounts and USD prices.
 * - Game tokens (8 nations + EGP) → 3 stats each at 1x
 * - Impact stat tokens (BURGERS, TGN, REGEN, Grant Wizard) → 3 stats at 1.5x
 * - Stablecoins → split all 6 at 0.5x per stat
 * - MfT → CON at 1x
 * - Boon-only tokens (impact + tradfi) → no base stats, resolved via boons
 */
export function computeD20Stats(
  tokenAmounts: TokenAmount[],
  tokenUsdPrices: Record<string, number>,
): { stats: D20Stats; subtypes: string[]; boons: Boon[] } {
  let strUsd = 0, dexUsd = 0, conUsd = 0, intUsd = 0, wisUsd = 0, chaUsd = 0;

  for (const ta of tokenAmounts) {
    const addr = ta.addr?.toLowerCase();
    if (!addr || ta.amount === 0) continue;

    // Skip boon-only tokens (they contribute via boons, not base stats)
    if (BOON_ONLY_TOKENS.has(addr)) continue;

    const usdPrice = tokenUsdPrices[addr] ?? 0;
    const usdValue = ta.amount * usdPrice;

    // ── Game tokens (1x, 3 stats) ──
    if (dddTokens.includes(addr)) {
      strUsd += usdValue; intUsd += usdValue; chaUsd += usdValue;
    } else if (egpTokens.includes(addr)) {
      dexUsd += usdValue; intUsd += usdValue; wisUsd += usdValue;
    } else if (ogcTokens.includes(addr)) {
      strUsd += usdValue; dexUsd += usdValue; conUsd += usdValue;
    } else if (igsTokens.includes(addr)) {
      conUsd += usdValue; wisUsd += usdValue; chaUsd += usdValue;
    } else if (btnTokens.includes(addr)) {
      strUsd += usdValue; conUsd += usdValue; wisUsd += usdValue;
    } else if (lgpTokens.includes(addr)) {
      dexUsd += usdValue; intUsd += usdValue; chaUsd += usdValue;
    } else if (dhgTokens.includes(addr)) {
      strUsd += usdValue; dexUsd += usdValue; wisUsd += usdValue;
    } else if (pktTokens.includes(addr)) {
      conUsd += usdValue; intUsd += usdValue; chaUsd += usdValue;
    }
    // ── Impact stat tokens (1.5x, 3 stats) ──
    else if (burgersTokens.includes(addr)) {
      const v = usdValue * IMPACT_RATE;
      conUsd += v; conUsd += v; conUsd += v; // CON+CON+CON
    } else if (tgnTokens.includes(addr)) {
      const v = usdValue * IMPACT_RATE;
      wisUsd += v; conUsd += v; chaUsd += v; // WIS+CON+CHA
    } else if (regenTokens.includes(addr)) {
      const v = usdValue * IMPACT_RATE;
      dexUsd += v; conUsd += v; wisUsd += v; // DEX+CON+WIS
    } else if (grantWizardTokens.includes(addr)) {
      const v = usdValue * IMPACT_RATE;
      wisUsd += v; chaUsd += v; intUsd += v; // WIS+CHA+INT
    }
    // ── Stablecoins (split all 6 at 0.5x) ──
    else if (stablecoinTokens.includes(addr)) {
      const each = usdValue * 0.5;
      strUsd += each; dexUsd += each; conUsd += each;
      intUsd += each; wisUsd += each; chaUsd += each;
    }
    // ── MfT hub token (0.5x, split all 6 + Noble Birth boon) ──
    else if (conTokens.includes(addr)) {
      const each = usdValue * 0.5 / 6;
      strUsd += each; dexUsd += each; conUsd += each;
      intUsd += each; wisUsd += each; chaUsd += each;
    }
    // ── Unrecognized → CON fallback ──
    else {
      conUsd += usdValue;
    }
  }

  const stats: D20Stats = {
    str: Math.max(1, usdToPoints(strUsd)),
    dex: Math.max(1, usdToPoints(dexUsd)),
    con: Math.max(1, usdToPoints(conUsd)),
    int: Math.max(1, usdToPoints(intUsd)),
    wis: Math.max(1, usdToPoints(wisUsd)),
    cha: Math.max(1, usdToPoints(chaUsd)),
    ac: 10,
    naturalArmor: 0,
    atk: 0,
    speed: 30,
    lightningDmg: 0,
    fireDmg: 0,
    lightningDice: null,
    fireDice: null,
    retaliationDice: null,
    // Boon-derived defaults
    bonusHp: 0, initiativeBonus: 0,
    hasEvasion: false, hasRegen: false, autoStabilize: false,
    hasDeathSave: false, hasPhoenix: false, hasActionSurge: false,
    resistances: [], immunities: [], conditionImmunities: [],
    saveAdvantages: [], boonSpells: [], retaliationDmg: 0,
    hasGuardianReaction: false, oppAttackDisadvantage: false,
    halfRations: false, restHpBonus: 0, doubleConHealing: false,
    bonusActionHeal: false, feastAura: false,
    rerollD20: false, fateDie: false, spellResistance: false,
  };

  // Compute boons (both count-based and dollar-value)
  const boons = computeBoons(tokenAmounts, tokenUsdPrices);
  const boonNames = new Set(boons.map(b => b.name));

  // Apply ALL boon effects to stats
  for (const b of boons) {
    switch (b.name) {
      // ── Natural Armor (tree boons) ──
      case "Blessing of Barkskin": stats.naturalArmor += 1; break;
      case "Boon of the Treant": stats.naturalArmor += 2; break; // cumulative with Barkskin

      // ── AC bonuses ──
      case "Blessing of the Shield": stats.ac += 1; break;
      case "Boon of Iron Skin": stats.ac += 1; break;

      // ── Speed bonuses ──
      case "Blessing of Swiftness": stats.speed += 5; break;
      case "Boon of Speed":
        stats.speed += 15; // cumulative with Swiftness
        stats.oppAttackDisadvantage = true;
        break;
      case "Blessing of Haste": stats.speed += 5; break;

      // ── Lightning damage (Storm boons) ──
      case "Blessing of Static": stats.lightningDmg += 2; stats.lightningDice = { n: 1, sides: 4 }; break; // 1d4
      case "Boon of the Stormborn":
        stats.resistances.push("lightning", "thunder");
        break;
      case "Boon of Thunder":
        stats.boonSpells.push({ name: "Call Lightning", recharge: "long", damage: 10, damageDice: { n: 3, sides: 6 }, range: 6, aoe: 1 });
        break;
      case "Boon of the Tempest":
        stats.immunities.push("lightning");
        stats.retaliationDmg = 7; stats.retaliationDice = { n: 2, sides: 6 }; // 2d6
        break;

      // ── Fire damage (Light boons) ──
      case "Blessing of the Flame": stats.fireDmg += 2; stats.fireDice = { n: 1, sides: 4 }; break; // 1d4
      case "Boon of the Fire Soul":
        stats.resistances.push("fire");
        break;
      case "Boon of Radiance":
        stats.boonSpells.push({ name: "Daylight", recharge: "at_will", range: 0, effect: "bright light 60ft — reveals invisible creatures" });
        break;
      case "Boon of the Sun":
        stats.immunities.push("fire");
        stats.boonSpells.push({ name: "Fireball", recharge: "short", damage: 28, damageDice: { n: 8, sides: 6 }, range: 8, aoe: 2 }); // 8d6
        break;

      // ── Carbon Guardian boons ──
      case "Blessing of Pure Air":
        stats.conditionImmunities.push("poison");
        break;
      case "Boon of Restoration":
        stats.boonSpells.push({ name: "Lesser Restoration", recharge: "long", range: 1, effect: "cure one condition: blind, deaf, paralyzed, poisoned", isHealing: true });
        break;
      case "Boon of Perfect Health":
        stats.conditionImmunities.push("disease");
        stats.immunities.push("poison");
        break;
      case "Boon of the Purifier":
        stats.saveAdvantages.push("poison", "disease"); // aura: allies get advantage
        break;

      // ── Tree boons (resistance + spells) ──
      case "Boon of Entanglement":
        stats.boonSpells.push({ name: "Entangle", recharge: "long", range: 4, aoe: 2, effect: "roots enemies in area — DC 14 STR save or restrained" });
        break;
      case "Boon of the Living Forest":
        stats.boonSpells.push({ name: "Wall of Thorns", recharge: "long", range: 4, aoe: 1, damage: 14, damageDice: { n: 4, sides: 6 }, effect: "wall of thorns — 4d6 to anyone passing through" });
        break;

      // ── Treant also gives resistance ──
      // (Boon of the Treant already handled for NA above, add bludgeoning resist here)

      // ── Tide boons ──
      case "Boon of Resilience":
        stats.resistances.push("chosen"); // one damage type, chosen on long rest
        break;
      case "Boon of the Unfettered":
        stats.conditionImmunities.push("grappled", "restrained");
        break;
      case "Boon of Invincibility":
        stats.boonSpells.push({ name: "Invincibility", recharge: "short", range: 0, effect: "resistance to ALL damage for 1 round" });
        break;

      // ── Herald boons ──
      case "Boon of Dimensional Step":
        stats.boonSpells.push({ name: "Misty Step", recharge: "short", range: 6, effect: "teleport up to 30ft" });
        break;
      case "Boon of the Guardian":
        stats.hasGuardianReaction = true;
        break;

      // ── Burger boons (sustenance/healing) ──
      case "Blessing of Sustenance":
        stats.halfRations = true;
        stats.restHpBonus += 1;
        break;
      case "Boon of Wound Closure":
        stats.autoStabilize = true;
        stats.doubleConHealing = true;
        break;
      case "Boon of Recovery":
        stats.bonusActionHeal = true; // bonus action regain half max HP, 1/long rest
        break;
      case "Boon of the Feast":
        stats.feastAura = true;
        break;

      // ── TGN / Canopy boons ──
      case "Boon of Speak with Plants":
        stats.boonSpells.push({ name: "Speak with Plants", recharge: "long", range: 0, effect: "communicate with plants — gain information about terrain" });
        break;
      case "Boon of the Dryad":
        stats.boonSpells.push({ name: "Tree Stride", recharge: "long", range: 0, effect: "teleport between trees within 500ft" });
        break;
      case "Boon of the World Tree":
        stats.boonSpells.push({ name: "Transport via Plants", recharge: "long", range: 0, effect: "teleport between any two trees on the map" });
        break;

      // ── Regen boons ──
      case "Blessing of Regeneration":
        stats.hasRegen = true;
        break;
      case "Boon of Mending":
        stats.boonSpells.push({ name: "Greater Restoration", recharge: "long", range: 1, effect: "remove one: charm, petrify, curse, ability drain, HP max reduction", isHealing: true });
        break;
      case "Boon of Renewal":
        stats.resistances.push("necrotic");
        break;
      case "Boon of the Phoenix":
        stats.hasPhoenix = true;
        break;

      // ── Grant Wizard boons ──
      case "Boon of Luck":
        stats.rerollD20 = true;
        break;
      case "Boon of Fate":
        stats.fateDie = true;
        break;
      case "Boon of Magic Resistance":
        stats.spellResistance = true;
        stats.saveAdvantages.push("spells");
        break;

      // ── WETH boons (arcane) ──
      case "Boon of Spell Recall":
        stats.boonSpells.push({ name: "Spell Recall", recharge: "long", range: 0, effect: "recover one spell slot (up to 3rd level)" });
        break;
      case "Boon of Counterspell":
        stats.boonSpells.push({ name: "Counterspell", recharge: "long", range: 6, effect: "negate one enemy spell being cast" });
        break;

      // ── WBTC boons (fortitude) ──
      case "Blessing of Fortitude": stats.bonusHp += 5; break;
      case "Boon of Fortitude": stats.bonusHp += 20; break;
      case "Boon of the Unbreakable":
        stats.hasDeathSave = true;
        break;

      // ── WPOL boons (speed/action) ──
      case "Boon of Initiative": stats.initiativeBonus += 2; break;
      case "Boon of Evasion": stats.hasEvasion = true; break;
      case "Boon of Action Surge": stats.hasActionSurge = true; break;
    }
  }

  // Add bludgeoning resistance from Treant (handled separately since NA was already set above)
  if (boonNames.has("Boon of the Treant")) {
    stats.resistances.push("bludgeoning");
  }

  // Subtypes from boons
  const subtypes: string[] = [];
  if (boonNames.has("Blessing of Static") || boonNames.has("Boon of the Stormborn") ||
      boonNames.has("Boon of Thunder") || boonNames.has("Boon of the Tempest")) {
    subtypes.push("electric");
  }
  if (boonNames.has("Blessing of the Flame") || boonNames.has("Boon of the Fire Soul") ||
      boonNames.has("Boon of Radiance") || boonNames.has("Boon of the Sun")) {
    subtypes.push("fire");
  }

  return { stats, subtypes, boons };
}
