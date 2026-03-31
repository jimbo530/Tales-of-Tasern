import { getTokenAmounts, getTokenPrices, getNftSummaries, getSellerOwnership, type TokenAmountRow, type TokenPriceRow } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Token → D20 stat mapping ────────────────────────────────────────────────
// Each token maps to one or more D20 ability accumulators.
// Multi-stat tokens (BTC, ETH, DDD, EGP, OGC, etc.) add full USD value to each.
// Stablecoins split at 0.5x across all six ability scores.

type StatKey = "str" | "dex" | "con" | "int" | "wis" | "cha" | "ac" | "atk" | "speed" | "lightning" | "fire" | "all";

const TOKEN_STAT_MAP: Record<string, StatKey[]> = {
  // BTC → STR, DEX, CON
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": ["str", "dex", "con"],
  // WETH Base → INT, WIS, CHA
  "0x4200000000000000000000000000000000000006": ["int", "wis", "cha"],
  // WETH Polygon → INT, WIS, CHA
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": ["int", "wis", "cha"],
  // WPOL → STR
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": ["str"],
  // DDD → STR, INT, CHA
  "0x4bf82cf0d6b2afc87367052b793097153c859d38": ["str", "int", "cha"],
  // EGP Base → DEX, INT, WIS
  "0xc1ba76771bbf0dd841347630e57c793f9d5accee": ["dex", "int", "wis"],
  // EGP Polygon → DEX, INT, WIS
  "0x64f6f111e9fdb753877f17f399b759de97379170": ["dex", "int", "wis"],
  // OGC → STR, DEX, CON
  "0xccf37622e6b72352e7b410481dd4913563038b7c": ["str", "dex", "con"],
  // IGS → CON, WIS, CHA
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": ["con", "wis", "cha"],
  // BTN → STR, CON, WIS
  "0xd7c584d40216576f1d8651eab8bef9de69497666": ["str", "con", "wis"],
  // LGP → DEX, INT, CHA
  "0xddc330761761751e005333208889bfe36c6e6760": ["dex", "int", "cha"],
  // DHG → STR, DEX, WIS
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": ["str", "dex", "wis"],
  // PKT → CON, INT, CHA
  "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": ["con", "int", "cha"],
  // MfT → CON
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": ["con"],
  // TGN → CON
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29": ["con"],
  // BURGERS → DEX
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5": ["dex"],
  // REGEN → CON
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": ["con"],
  // JCGWR → STR
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca": ["str"],
  // AU24T → DEX
  "0x146642d83879257ac9ed35074b1c3714b7e8f452": ["dex"],
  // CHAR → atk bonus
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": ["atk"],
  // CCC → atk bonus
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": ["atk"],
  // TB01 → AC
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4": ["ac"],
  // LTK → AC
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82": ["ac"],
  // JLT-F24 → lightning
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": ["lightning"],
  // JLT-B23 → lightning
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": ["lightning"],
  // LANTERN → fire
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020": ["fire"],
  // NCT → WIS
  "0xd838290e877e0188a4a44700463419ed96c16107": ["wis"],
  // BCT → WIS
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": ["wis"],
  // Grant Wizard → WIS
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb": ["wis"],
  // PR24 → speed
  "0xd84415c956f44b2300a2e56c5b898401913e9a29": ["speed"],
  // PR25 → speed
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": ["speed"],
  // CRISP-M → CHA
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": ["cha"],
  // USDGLO → split all 6
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": ["all"],
  // AZOS → split all 6
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": ["all"],
};

const TOKEN_SYMBOLS: Record<string, string> = {
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": "USDGLO",
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": "MfT",
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": "CHAR",
  "0xc1ba76771bbf0dd841347630e57c793f9d5accee": "EGP",
  "0x4bf82cf0d6b2afc87367052b793097153c859d38": "DDD",
  "0x64f6f111e9fdb753877f17f399b759de97379170": "EGP",
  "0xccf37622e6b72352e7b410481dd4913563038b7c": "OGC",
  "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": "PKT",
  "0xd7c584d40216576f1d8651eab8bef9de69497666": "BTN",
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": "IGS",
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": "DHG",
  "0xddc330761761751e005333208889bfe36c6e6760": "LGP",
  "0xd838290e877e0188a4a44700463419ed96c16107": "NCT",
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": "BCT",
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": "CCC",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "WBTC",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "WPOL",
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": "JLT-F24",
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": "JLT-B23",
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": "PR25",
  "0xd84415c956f44b2300a2e56c5b898401913e9a29": "PR24",
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4": "TB01",
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca": "JCGWR",
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020": "LANTERN",
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": "REGEN",
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5": "BURGERS",
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82": "LTK",
  "0x146642d83879257ac9ed35074b1c3714b7e8f452": "AU24T",
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": "CRISP-M",
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb": "GRANTS",
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29": "TGN",
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": "AZOS",
};

const TOKEN_CATEGORY: Record<string, "traditional" | "game" | "impact"> = {
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": "impact",   // USDGLO — stablecoin that funds impact
  "0x4200000000000000000000000000000000000006": "traditional",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "traditional",
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "traditional",
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "traditional",
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": "impact",   // AZOS — stablecoin that funds impact
  "0x4bf82cf0d6b2afc87367052b793097153c859d38": "game",
  "0x64f6f111e9fdb753877f17f399b759de97379170": "game",
  "0xc1ba76771bbf0dd841347630e57c793f9d5accee": "game",
  "0xccf37622e6b72352e7b410481dd4913563038b7c": "game",
  "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": "game",
  "0xd7c584d40216576f1d8651eab8bef9de69497666": "game",
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": "game",
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": "game",
  "0xddc330761761751e005333208889bfe36c6e6760": "game",
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": "game",
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": "impact",
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": "impact",
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": "impact",
  "0xd838290e877e0188a4a44700463419ed96c16107": "impact",
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": "impact",
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": "impact",
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": "impact",
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020": "impact",
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4": "impact",
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca": "impact",
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82": "impact",
  "0x146642d83879257ac9ed35074b1c3714b7e8f452": "impact",
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": "impact",
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb": "impact",
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5": "impact",
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29": "impact",
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": "impact",
  "0xd84415c956f44b2300a2e56c5b898401913e9a29": "impact",
};

// ── Scaling curve ────────────────────────────────────────────────────────────
// First 10 pts = $1/pt, next 10 = $10/pt, next 10 = $100/pt, etc.
// This creates diminishing returns so no single token dominates.

function usdToPoints(usd: number): number {
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

// ── D20 stat computation from raw token amounts ─────────────────────────────

function computeD20Stats(tokens: TokenAmountRow[], priceMap: Map<string, TokenPriceRow>) {
  let strUsd = 0, dexUsd = 0, conUsd = 0, intUsd = 0, wisUsd = 0, chaUsd = 0;
  let acUsd = 0, atkUsd = 0, speedUsd = 0, lightningUsd = 0, fireUsd = 0;
  let totalUsdBacking = 0;

  const tokenAmounts: { symbol: string; amount: number; stat: string; addr?: string }[] = [];

  for (const ta of tokens) {
    const addr = ta.token_address;
    const rawAmount = ta.raw_amount;
    const price = priceMap.get(addr);
    const usdPrice = price?.usd_price ?? 0;
    const usdValue = rawAmount * usdPrice;
    if (usdPrice > 0) totalUsdBacking += usdValue;

    const mapping = TOKEN_STAT_MAP[addr];
    let stat: string;

    if (!mapping) {
      // Unrecognized tokens → CON (general hardiness)
      stat = "con";
      conUsd += usdValue;
    } else if (mapping.includes("all")) {
      // Stablecoins → 0.5x to all 6
      const each = usdValue * 0.5;
      strUsd += each; dexUsd += each; conUsd += each;
      intUsd += each; wisUsd += each; chaUsd += each;
      stat = "all";
    } else {
      stat = mapping[0];
      for (const s of mapping) {
        if (s === "str") strUsd += usdValue;
        else if (s === "dex") dexUsd += usdValue;
        else if (s === "con") conUsd += usdValue;
        else if (s === "int") intUsd += usdValue;
        else if (s === "wis") wisUsd += usdValue;
        else if (s === "cha") chaUsd += usdValue;
        else if (s === "ac") acUsd += usdValue;
        else if (s === "atk") atkUsd += usdValue;
        else if (s === "speed") speedUsd += usdValue;
        else if (s === "lightning") lightningUsd += usdValue;
        else if (s === "fire") fireUsd += usdValue;
      }
    }

    tokenAmounts.push({
      symbol: ta.symbol || TOKEN_SYMBOLS[addr] || addr.slice(0, 8),
      amount: rawAmount,
      stat,
      addr,
    });
  }

  const str = Math.max(1, usdToPoints(strUsd));
  const dex = Math.max(1, usdToPoints(dexUsd));
  const con = Math.max(1, usdToPoints(conUsd));
  const int_ = Math.max(1, usdToPoints(intUsd));
  const wis = Math.max(1, usdToPoints(wisUsd));
  const cha = Math.max(1, usdToPoints(chaUsd));
  const ac = 10 + usdToPoints(acUsd);
  const atk = usdToPoints(atkUsd);
  const speed = 30 + Math.floor(speedUsd / 20) * 5;
  const lightningDmg = usdToPoints(lightningUsd);
  const fireDmg = usdToPoints(fireUsd);

  // Elemental subtypes: 10%+ of portfolio
  const subtypes: string[] = [];
  if (totalUsdBacking > 0) {
    if (lightningUsd / totalUsdBacking >= 0.10) subtypes.push("electric");
    if (fireUsd / totalUsdBacking >= 0.10) subtypes.push("fire");
  }

  return {
    stats: { str, dex, con, int: int_, wis, cha, ac, atk, speed, lightningDmg, fireDmg },
    subtypes,
    tokenAmounts: tokenAmounts.sort((a, b) => b.amount - a.amount),
    usdBacking: totalUsdBacking,
  };
}

// ── API Route ────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Read all data from Supabase (populated by /api/update-chain-data cron)
    const [allTokenAmounts, tokenPrices, summaries, sellerRows] = await Promise.all([
      getTokenAmounts(),
      getTokenPrices(),
      getNftSummaries(),
      getSellerOwnership(),
    ]);

    if (summaries.length === 0) {
      return NextResponse.json(
        { error: "No chain data yet — run /api/update-chain-data first", characters: [] },
        { status: 200 },
      );
    }

    // Build lookup maps
    const priceMap = new Map<string, TokenPriceRow>();
    for (const p of tokenPrices) priceMap.set(p.token_address, p);

    const nftTokens = new Map<string, TokenAmountRow[]>();
    for (const ta of allTokenAmounts) {
      const list = nftTokens.get(ta.nft_address);
      if (list) list.push(ta);
      else nftTokens.set(ta.nft_address, [ta]);
    }

    const sellerOwned = new Set(sellerRows.map(r => r.nft_address));

    // Compute D20 stats for each NFT
    const characters = summaries.map(nft => {
      const tokens = nftTokens.get(nft.nft_address) ?? [];
      const { stats, subtypes, tokenAmounts, usdBacking } = computeD20Stats(tokens, priceMap);
      return {
        name: nft.name,
        contractAddress: nft.nft_address,
        chain: nft.chain,
        stats,
        subtypes,
        tokenAmounts,
        usdBacking,
      };
    });

    // Fallback: if seller ownership empty, mark all backed NFTs as for sale
    if (sellerOwned.size === 0) {
      characters.forEach(c => {
        const s = c.stats;
        if (s.str > 1 || s.dex > 1 || s.con > 1 || s.int > 1 || s.wis > 1 || s.cha > 1) {
          sellerOwned.add(c.contractAddress.toLowerCase());
        }
      });
    }

    // Category totals from token amounts
    const categoryTotals = { traditional: 0, game: 0, impact: 0 };
    const tokenBreakdown: Record<string, { symbol: string; usd: number; category: string }> = {};
    for (const ta of allTokenAmounts) {
      const price = priceMap.get(ta.token_address);
      if (!price || price.usd_price <= 0) continue;
      const usdVal = ta.raw_amount * price.usd_price;
      const cat = (TOKEN_CATEGORY[ta.token_address] ?? price.category ?? "game") as keyof typeof categoryTotals;
      if (categoryTotals[cat] !== undefined) categoryTotals[cat] += usdVal;
      const sym = ta.symbol || TOKEN_SYMBOLS[ta.token_address] || ta.token_address.slice(0, 8);
      if (!tokenBreakdown[sym]) tokenBreakdown[sym] = { symbol: sym, usd: 0, category: cat };
      tokenBreakdown[sym].usd += usdVal;
    }

    console.log("[API/stats] Served", characters.length, "characters from Supabase");

    return NextResponse.json({
      characters,
      sellerOwned: [...sellerOwned],
      assetTotals: categoryTotals,
      tokenBreakdown: Object.values(tokenBreakdown),
      updatedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[API/stats]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
