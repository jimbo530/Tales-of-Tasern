import { createPublicClient, http, formatUnits } from "viem";
import { base, polygon } from "viem/chains";
import { GAME_NFTS, KNOWN_LP_PAIRS, V2_PAIR_ABI, STAT_TOKENS } from "@/lib/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for RPC calls

const TOKEN_ID = BigInt(1);

const baseClient = createPublicClient({ chain: base, transport: http() });
const polygonClient = createPublicClient({ chain: polygon, transport: http() });

type McResult = { status: string; result?: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chunkedMulticall(client: any, contracts: any[], chunkSize = 80): Promise<McResult[]> {
  if (contracts.length === 0) return [];
  const results: McResult[] = [];
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize);
    try {
      const r = await client.multicall({ contracts: chunk as any, allowFailure: true });
      results.push(...(r as McResult[]));
    } catch {
      results.push(...chunk.map(() => ({ status: "failure" as const, result: undefined })));
    }
    if (i + chunkSize < contracts.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  return results;
}

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
};

export async function GET() {
  try {
    // Fetch prices
    let btcHigh24h = 0, ethHigh24h = 0, polHigh24h = 0;
    try {
      const priceRes = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,matic-network", { next: { revalidate: 3600 } });
      if (priceRes.ok) {
        const data: any[] = await priceRes.json();
        btcHigh24h = data.find((c) => c.id === "bitcoin")?.high_24h ?? 0;
        ethHigh24h = data.find((c) => c.id === "ethereum")?.high_24h ?? 0;
        polHigh24h = data.find((c) => c.id === "matic-network")?.high_24h ?? 0;
      }
    } catch { /* prices optional */ }

    const nftSupplyDivisor: Record<string, number> = {
      "0x234b58ecdb0026b2aaf829cc46e91895f609f6d1": 300,
      "0x2953399124f0cbb46d2cbacd8a89cf0599974963": 1163,
      "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f": 80,
    };

    const tokenStatScale: Record<string, number> = {
      "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": 1 / 1000000,
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 1 / 2200,
      "0x06a05043eb2c1691b19c2c13219db9212269ddc5": 1 / 1000,
      "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": 0.05,
      "0x72e4327f592e9cb09d5730a55d1d68de144af53c": 1,
    };

    type ExtraStat = { stat: "attack" | "hp" | "mana" | "def" | "mDef" | "mAtk"; scale: number };
    const extraStats: Record<string, ExtraStat[]> = {
      "0xccf37622e6b72352e7b410481dd4913563038b7c": [{ stat: "attack", scale: 1 / 1000 }],
      "0x64f6f111e9fdb753877f17f399b759de97379170": [{ stat: "mana", scale: 1 / 1000 }],
      "0xddc330761761751e005333208889bfe36c6e6760": [{ stat: "def", scale: 1 / 1000 }],
      "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": [{ stat: "mAtk", scale: 1 / 1000 }],
      "0xd7c584d40216576f1d8651eab8bef9de69497666": [{ stat: "mana", scale: 1 / 1000 }],
      "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": [{ stat: "mDef", scale: 1 / 1000 }],
      "0x4bf82cf0d6b2afc87367052b793097153c859d38": [{ stat: "def", scale: 1 / 1000 }],
      "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": [{ stat: "attack", scale: 1 / 1000 }],
      "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": [{ stat: "attack", scale: 0.05 }],
      "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": [
        { stat: "attack", scale: 1 / 2000000 },
        { stat: "def", scale: 1 / 2000000 },
      ],
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": [
        { stat: "hp", scale: 1 },
        { stat: "def", scale: 1 },
      ],
    };

    const tokenPriceConfig: Record<string, { price: number; decimals: number }> = {
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": { price: 1, decimals: 18 },
      "0x4200000000000000000000000000000000000006": { price: ethHigh24h, decimals: 18 },
      "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": { price: btcHigh24h, decimals: 8 },
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": { price: ethHigh24h, decimals: 18 },
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": { price: polHigh24h, decimals: 18 },
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": { price: 1, decimals: 16 },
      "0xd7c584d40216576f1d8651eab8bef9de69497666": { price: 1, decimals: 8 },
      "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": { price: 1, decimals: 8 },
      "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": { price: 1, decimals: 8 },
      "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": { price: 1, decimals: 6 },
      "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": { price: 1, decimals: 6 },
      "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": { price: 1, decimals: 6 },
      "0x72e4327f592e9cb09d5730a55d1d68de144af53c": { price: 1, decimals: 10 },
    };

    // Build stat token lookups
    const attackTokens = STAT_TOKENS.base.attack.map(t => t.toLowerCase());
    const baseHpTokens = STAT_TOKENS.base.hp.map(t => t.toLowerCase());
    const magicTokens = STAT_TOKENS.base.magic.map(t => t.toLowerCase());
    const polyAttackTokens = STAT_TOKENS.polygon.attack.map(t => t.toLowerCase());
    const polyMatkTokens = STAT_TOKENS.polygon.mAtk.map(t => t.toLowerCase());
    const polyFatkTokens = STAT_TOKENS.polygon.fAtk.map(t => t.toLowerCase());
    const polyHpTokens = STAT_TOKENS.polygon.hp.map(t => t.toLowerCase());
    const polyMagicTokens = STAT_TOKENS.polygon.magic.map(t => t.toLowerCase());
    const polyMagicBoostTokens = STAT_TOKENS.polygon.magicBoost.map(t => t.toLowerCase());
    const polyDefTokens = STAT_TOKENS.polygon.def.map(t => t.toLowerCase());
    const polyMDefTokens = STAT_TOKENS.polygon.mDef.map(t => t.toLowerCase());
    const manaTokens = STAT_TOKENS.polygon.mana.map(t => t.toLowerCase());

    // Pair static data
    const basePairStaticCalls = KNOWN_LP_PAIRS.base.flatMap((pair) => [
      { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
    ]);
    const polyPairStaticCalls = KNOWN_LP_PAIRS.polygon.flatMap((pair) => [
      { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
    ]);

    // LP balance calls
    const baseLpBalanceCalls = GAME_NFTS.flatMap((nft) =>
      KNOWN_LP_PAIRS.base.map((pair) => ({
        address: pair, abi: V2_PAIR_ABI, functionName: "balanceOf" as const,
        args: [nft.contractAddress] as [`0x${string}`],
      }))
    );
    const polyLpBalanceCalls = GAME_NFTS.flatMap((nft) =>
      KNOWN_LP_PAIRS.polygon.map((pair) => ({
        address: pair, abi: V2_PAIR_ABI, functionName: "balanceOf" as const,
        args: [nft.contractAddress] as [`0x${string}`],
      }))
    );

    // Fire all multicalls
    const [basePairStaticResults, baseLpBalanceResults] = await Promise.all([
      chunkedMulticall(baseClient, basePairStaticCalls, 50),
      chunkedMulticall(baseClient, baseLpBalanceCalls, 80),
    ]);

    let polyPairStaticResults: McResult[] = [];
    let polyLpBalanceResults: McResult[] = [];
    try {
      const polyResults = await Promise.all([
        chunkedMulticall(polygonClient, polyPairStaticCalls, 100),
        chunkedMulticall(polygonClient, polyLpBalanceCalls, 200),
      ]);
      polyPairStaticResults = polyResults[0];
      polyLpBalanceResults = polyResults[1];
    } catch { /* polygon optional */ }

    // Parse pair infos
    type PairInfo = { address: `0x${string}`; token0: string; token1: string; totalSupply: bigint; reserve0: bigint; reserve1: bigint };
    function parsePairInfos(pairs: `0x${string}`[], results: McResult[]): PairInfo[] {
      return pairs.map((pair, i) => {
        const b = i * 4;
        const rv = results[b + 3];
        const reserves = rv?.status === "success" ? rv.result as readonly [bigint, bigint, number] : [0n, 0n, 0];
        return {
          address: pair,
          token0: results[b]?.status === "success" ? (results[b].result as string).toLowerCase() : "",
          token1: results[b+1]?.status === "success" ? (results[b+1].result as string).toLowerCase() : "",
          totalSupply: results[b+2]?.status === "success" ? (results[b+2].result as bigint) : 0n,
          reserve0: reserves[0] as bigint,
          reserve1: reserves[1] as bigint,
        };
      });
    }

    const basePairInfos = parsePairInfos(KNOWN_LP_PAIRS.base, basePairStaticResults);
    const polyPairInfos = parsePairInfos(KNOWN_LP_PAIRS.polygon, polyPairStaticResults);

    // Assemble stats for each NFT
    const characters = GAME_NFTS.map((nft, nftIdx) => {
      const supplyDiv = BigInt(nftSupplyDivisor[nft.contractAddress.toLowerCase()] ?? 1);
      const tokenMap = new Map<string, bigint>();
      const accum = (addr: string, amt: bigint) => tokenMap.set(addr, (tokenMap.get(addr) ?? 0n) + amt);

      // Base LP
      KNOWN_LP_PAIRS.base.forEach((_, pairIdx) => {
        const balResult = baseLpBalanceResults[nftIdx * KNOWN_LP_PAIRS.base.length + pairIdx];
        if (!balResult || balResult.status !== "success") return;
        const lpHeld = balResult.result as bigint;
        if (lpHeld === 0n) return;
        const p = basePairInfos[pairIdx];
        if (p.totalSupply === 0n) return;
        const share = (lpHeld * BigInt(1e18)) / p.totalSupply;
        const amt0 = (p.reserve0 * share) / BigInt(1e18) / supplyDiv;
        const amt1 = (p.reserve1 * share) / BigInt(1e18) / supplyDiv;
        if (attackTokens.includes(p.token0)) { accum(p.token0, amt0); }
        if (attackTokens.includes(p.token1)) { accum(p.token1, amt1); }
        if (baseHpTokens.includes(p.token0)) { accum(p.token0, amt0); }
        if (baseHpTokens.includes(p.token1)) { accum(p.token1, amt1); }
        if (magicTokens.includes(p.token0)) { accum(p.token0, amt0); }
        if (magicTokens.includes(p.token1)) { accum(p.token1, amt1); }
      });

      // Polygon LP
      KNOWN_LP_PAIRS.polygon.forEach((_, pairIdx) => {
        const balResult = polyLpBalanceResults[nftIdx * KNOWN_LP_PAIRS.polygon.length + pairIdx];
        if (!balResult || balResult.status !== "success") return;
        const lpHeld = balResult.result as bigint;
        if (lpHeld === 0n) return;
        const p = polyPairInfos[pairIdx];
        if (!p || p.totalSupply === 0n) return;
        const share = (lpHeld * BigInt(1e18)) / p.totalSupply;
        const amt0 = (p.reserve0 * share) / BigInt(1e18) / supplyDiv;
        const amt1 = (p.reserve1 * share) / BigInt(1e18) / supplyDiv;
        for (const [token, amt] of [[p.token0, amt0], [p.token1, amt1]] as [string, bigint][]) {
          let recognized = false;
          if (polyAttackTokens.includes(token)) { recognized = true; }
          if (polyMatkTokens.includes(token)) { recognized = true; }
          if (polyFatkTokens.includes(token)) { recognized = true; }
          if (polyDefTokens.includes(token)) { recognized = true; }
          if (polyMDefTokens.includes(token)) { recognized = true; }
          if (polyHpTokens.includes(token)) { recognized = true; }
          if (polyMagicTokens.includes(token)) { recognized = true; }
          if (polyMagicBoostTokens.includes(token)) { recognized = true; }
          if (manaTokens.includes(token)) { recognized = true; }
          if (recognized) accum(token, amt);
        }
      });

      // Compute final stats from tokenMap
      let attackUsd = 0, mAtkScaled = 0, fAtkScaled = 0, defScaled = 0, mDefScaled = 0;
      let hpScaled = 0, magicScaled = 0, magicBoostScaled = 0, manaScaled = 0;

      const tokenAmounts: { symbol: string; amount: number; stat: string }[] = [];

      for (const [addr, amount] of tokenMap.entries()) {
        if (amount === 0n) continue;
        const decimals = tokenPriceConfig[addr]?.decimals ?? 18;
        const rawAmount = parseFloat(formatUnits(amount, decimals));
        const scale = tokenStatScale[addr] ?? 1;
        let stat: string;

        if (attackTokens.includes(addr) || polyAttackTokens.includes(addr)) {
          stat = "attack";
          const price = tokenPriceConfig[addr]?.price ?? 1;
          attackUsd += rawAmount * price;
        } else if (polyMatkTokens.includes(addr)) {
          stat = "mAtk"; mAtkScaled += rawAmount * scale;
        } else if (polyFatkTokens.includes(addr)) {
          stat = "fAtk"; fAtkScaled += rawAmount * scale;
        } else if (magicTokens.includes(addr) || polyMagicTokens.includes(addr)) {
          stat = "charMultiplier"; magicScaled += rawAmount * scale;
        } else if (polyMagicBoostTokens.includes(addr)) {
          stat = "magicBoost"; magicBoostScaled += rawAmount * scale;
        } else if (polyDefTokens.includes(addr)) {
          stat = "def"; defScaled += rawAmount * scale;
        } else if (polyMDefTokens.includes(addr)) {
          stat = "mDef"; mDefScaled += rawAmount * scale;
        } else if (manaTokens.includes(addr)) {
          stat = "mana"; manaScaled += rawAmount * scale;
        } else {
          stat = "hp"; hpScaled += (rawAmount * scale) / 100;
        }

        tokenAmounts.push({ symbol: TOKEN_SYMBOLS[addr] ?? addr.slice(0, 8), amount: rawAmount, stat });

        // Extra stats
        const extras = extraStats[addr];
        if (extras) {
          for (const ex of extras) {
            const v = rawAmount * ex.scale;
            if (ex.stat === "attack") attackUsd += v * (tokenPriceConfig[addr]?.price ?? 1);
            if (ex.stat === "hp") hpScaled += v / 100;
            if (ex.stat === "mana") manaScaled += v;
            if (ex.stat === "def") defScaled += v;
            if (ex.stat === "mDef") mDefScaled += v;
            if (ex.stat === "mAtk") mAtkScaled += v;
          }
        }
      }

      return {
        name: nft.name,
        contractAddress: nft.contractAddress,
        chain: nft.chain,
        stats: {
          attack: attackUsd,
          mAtk: mAtkScaled,
          fAtk: fAtkScaled,
          def: defScaled,
          mDef: mDefScaled,
          hp: hpScaled,
          charMultiplier: magicScaled,
          magicMultiplier: magicBoostScaled,
          mana: manaScaled,
        },
        tokenAmounts: tokenAmounts.sort((a, b) => b.amount - a.amount),
      };
    });

    return NextResponse.json({
      characters,
      prices: { btcHigh24h, ethHigh24h, polHigh24h },
      updatedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
