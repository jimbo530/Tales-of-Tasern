import { STAT_TOKENS } from "./contracts";

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

type D20Stats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  ac: number;
  atk: number;
  speed: number;
  lightningDmg: number;
  fireDmg: number;
};

// Build combined lookup sets from STAT_TOKENS (both chains)
const lower = (arr: readonly string[]) => arr.map(t => t.toLowerCase());
const strTokens = lower([...STAT_TOKENS.base.str, ...STAT_TOKENS.polygon.str]);
const dexTokens = lower([...STAT_TOKENS.base.dex, ...STAT_TOKENS.polygon.dex]);
const conTokens = lower([...STAT_TOKENS.base.con, ...STAT_TOKENS.polygon.con]);
const intTokens = lower([...(STAT_TOKENS.base as any).int ?? [], ...(STAT_TOKENS.polygon as any).int ?? []]);
const wisTokens = lower([...STAT_TOKENS.base.wis, ...STAT_TOKENS.polygon.wis]);
const chaTokens = lower([...STAT_TOKENS.base.cha, ...STAT_TOKENS.polygon.cha]);
const btcTokens = lower([...(STAT_TOKENS.base as any).btc ?? [], ...(STAT_TOKENS.polygon as any).btc ?? []]);
const ethTokens = lower([...(STAT_TOKENS.base as any).eth ?? [], ...(STAT_TOKENS.polygon as any).eth ?? []]);
const egpTokens = lower([...(STAT_TOKENS.base as any).egp ?? [], ...(STAT_TOKENS.polygon as any).egp ?? []]);
const dddTokens = lower([...(STAT_TOKENS.polygon as any).ddd ?? []]);
const ogcTokens = lower([...(STAT_TOKENS.polygon as any).ogc ?? []]);
const igsTokens = lower([...(STAT_TOKENS.polygon as any).igs ?? []]);
const btnTokens = lower([...(STAT_TOKENS.polygon as any).btn ?? []]);
const lgpTokens = lower([...(STAT_TOKENS.polygon as any).lgp ?? []]);
const dhgTokens = lower([...(STAT_TOKENS.polygon as any).dhg ?? []]);
const pktTokens = lower([...(STAT_TOKENS.polygon as any).pkt ?? []]);
const atkBonusTokens = lower([...(STAT_TOKENS.base as any).atkBonus ?? [], ...(STAT_TOKENS.polygon as any).atkBonus ?? []]);
const acTokens = lower([...(STAT_TOKENS.polygon as any).ac ?? []]);
const speedTokens = lower([...(STAT_TOKENS.polygon as any).speed ?? []]);
const lightningTokens = lower([...(STAT_TOKENS.polygon as any).lightning ?? []]);
const fireTokens = lower([...(STAT_TOKENS.polygon as any).fire ?? []]);
const stablecoinTokens = lower([...STAT_TOKENS.base.stablecoin, ...STAT_TOKENS.polygon.stablecoin]);

/**
 * Compute D20 ability scores from token amounts and USD prices.
 * Client-side equivalent of the stat computation in /api/stats/route.ts.
 */
export function computeD20Stats(
  tokenAmounts: TokenAmount[],
  tokenUsdPrices: Record<string, number>,
): { stats: D20Stats; subtypes: string[] } {
  let strUsd = 0, dexUsd = 0, conUsd = 0, intUsd = 0, wisUsd = 0, chaUsd = 0;
  let acUsd = 0, atkUsd = 0, speedUsd = 0, lightningUsd = 0, fireUsd = 0;
  let totalUsdBacking = 0;

  for (const ta of tokenAmounts) {
    const addr = ta.addr?.toLowerCase();
    if (!addr || ta.amount === 0) continue;
    const usdPrice = tokenUsdPrices[addr] ?? 0;
    const usdValue = ta.amount * usdPrice;
    if (usdPrice > 0) totalUsdBacking += usdValue;

    if (btcTokens.includes(addr)) {
      strUsd += usdValue; dexUsd += usdValue; conUsd += usdValue;
    } else if (ethTokens.includes(addr)) {
      intUsd += usdValue; wisUsd += usdValue; chaUsd += usdValue;
    } else if (dddTokens.includes(addr)) {
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
    } else if (atkBonusTokens.includes(addr)) {
      atkUsd += usdValue;
    } else if (stablecoinTokens.includes(addr)) {
      const each = usdValue * 0.5;
      strUsd += each; dexUsd += each; conUsd += each; intUsd += each; wisUsd += each; chaUsd += each;
    } else if (acTokens.includes(addr)) {
      acUsd += usdValue;
    } else if (speedTokens.includes(addr)) {
      speedUsd += usdValue;
    } else if (lightningTokens.includes(addr)) {
      lightningUsd += usdValue;
    } else if (fireTokens.includes(addr)) {
      fireUsd += usdValue;
    } else {
      // Single-stat tokens (can appear in multiple lists, e.g. REGEN → con+dex+wis)
      let matched = false;
      if (strTokens.includes(addr)) { strUsd += usdValue; matched = true; }
      if (dexTokens.includes(addr)) { dexUsd += usdValue; matched = true; }
      if (conTokens.includes(addr)) { conUsd += usdValue; matched = true; }
      if (intTokens.includes(addr)) { intUsd += usdValue; matched = true; }
      if (wisTokens.includes(addr)) { wisUsd += usdValue; matched = true; }
      if (chaTokens.includes(addr)) { chaUsd += usdValue; matched = true; }
      if (!matched) conUsd += usdValue; // Unrecognized → CON
    }
  }

  const stats: D20Stats = {
    str: Math.max(1, usdToPoints(strUsd)),
    dex: Math.max(1, usdToPoints(dexUsd)),
    con: Math.max(1, usdToPoints(conUsd)),
    int: Math.max(1, usdToPoints(intUsd)),
    wis: Math.max(1, usdToPoints(wisUsd)),
    cha: Math.max(1, usdToPoints(chaUsd)),
    ac: 10 + usdToPoints(acUsd),
    atk: usdToPoints(atkUsd),
    speed: 30 + Math.floor(speedUsd / 20) * 5,
    lightningDmg: usdToPoints(lightningUsd),
    fireDmg: usdToPoints(fireUsd),
  };

  const subtypes: string[] = [];
  if (totalUsdBacking > 0) {
    if (lightningUsd / totalUsdBacking >= 0.10) subtypes.push("electric");
    if (fireUsd / totalUsdBacking >= 0.10) subtypes.push("fire");
  }

  return { stats, subtypes };
}
