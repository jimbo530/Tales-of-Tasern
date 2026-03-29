import { createPublicClient, http, formatUnits } from "viem";
import { base, polygon } from "viem/chains";
import { GAME_NFTS, KNOWN_LP_PAIRS, V2_PAIR_ABI, ERC1155_ABI, STAT_TOKENS } from "@/lib/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for RPC calls

const TOKEN_ID = BigInt(1);

const baseClient = createPublicClient({ chain: base, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL ?? undefined) });
const polygonClient = createPublicClient({ chain: polygon, transport: http() }); // Public RPC — works better than shared Alchemy rate limit

type McResult = { status: string; result?: unknown };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chunkedMulticall(client: any, contracts: any[], chunkSize = 50): Promise<McResult[]> {
  if (contracts.length === 0) return [];
  const results: McResult[] = [];
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize);
    // Retry up to 3 times on failure (this only runs once per day)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await client.multicall({ contracts: chunk as any, allowFailure: true });
        results.push(...(r as McResult[]));
        break;
      } catch {
        if (attempt === 2) results.push(...chunk.map(() => ({ status: "failure" as const, result: undefined })));
        else await new Promise(resolve => setTimeout(resolve, 1000)); // wait before retry
      }
    }
    if (i + chunkSize < contracts.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between chunks
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
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82": "LTK",
  "0x146642d83879257ac9ed35074b1c3714b7e8f452": "AU24T",
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": "CRISP-M",
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb": "GRANTS",
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29": "TGN",
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": "AZOS",
};

const TOKEN_CATEGORY: Record<string, "traditional" | "game" | "impact"> = {
  // Traditional
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": "traditional", // USDGLO
  "0x4200000000000000000000000000000000000006": "traditional", // WETH Base
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "traditional", // WETH Polygon
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "traditional", // WBTC
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "traditional", // WPOL
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": "traditional", // AZOS (stablecoin)
  // Game tokens
  "0x4bf82cf0d6b2afc87367052b793097153c859d38": "game", // DDD
  "0x64f6f111e9fdb753877f17f399b759de97379170": "game", // EGP Polygon
  "0xc1ba76771bbf0dd841347630e57c793f9d5accee": "game", // EGP Base
  "0xccf37622e6b72352e7b410481dd4913563038b7c": "game", // OGC
  "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": "game", // PKT
  "0xd7c584d40216576f1d8651eab8bef9de69497666": "game", // BTN
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": "game", // IGS
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": "game", // DHG
  "0xddc330761761751e005333208889bfe36c6e6760": "game", // LGP
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": "game", // MfT
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": "impact", // CHAR
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": "impact", // CCC
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": "impact", // REGEN
  // Impact
  "0xd838290e877e0188a4a44700463419ed96c16107": "impact", // NCT — carbon
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": "impact", // BCT — carbon
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": "impact", // JLT-F24 — renewable energy
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": "impact", // JLT-B23 — renewable energy
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020": "impact", // LANTERN — solar lanterns
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4": "impact", // TB01 — cigarette butt cleanup
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca": "impact", // JCGWR — tokenized trees
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82": "impact", // LTK — litter cleanup
  "0x146642d83879257ac9ed35074b1c3714b7e8f452": "impact", // AU24T — tokenized trees
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": "impact", // CRISP-M — multiplier
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb": "impact", // Grant Wizard — mana
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5": "impact", // BURGERS — feeds people
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29": "impact", // TGN
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": "impact", // PR25 — kids in school
  "0xd84415c956f44b2300a2e56c5b898401913e9a29": "impact", // PR24 — kids in school
};

export async function GET() {
  try {
    // Fetch prices — asset daily highs for backing, MfT daily low for marketplace pricing
    let btcHigh24h = 0, ethHigh24h = 0, polHigh24h = 0, mftLow24h = 0;
    try {
      const priceRes = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,matic-network", { next: { revalidate: 3600 } });
      if (priceRes.ok) {
        const data: any[] = await priceRes.json();
        btcHigh24h = data.find((c) => c.id === "bitcoin")?.high_24h ?? 0;
        ethHigh24h = data.find((c) => c.id === "ethereum")?.high_24h ?? 0;
        polHigh24h = data.find((c) => c.id === "matic-network")?.high_24h ?? 0;
      }
    } catch { /* prices optional */ }

    // USD prices for ALL tokens (daily highs) — used for marketplace backing value
    const tokenUsdPrices: Record<string, number> = {
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": 1,           // USDGLO = $1
      "0x4200000000000000000000000000000000000006": ethHigh24h,   // WETH (Base)
      "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": btcHigh24h,  // WBTC (Polygon)
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": ethHigh24h,  // WETH (Polygon)
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": polHigh24h,  // WPOL
      "0x3595ca37596d5895b70efab592ac315d5b9809b2": 1,           // AZOS = $1 (stablecoin)
    };

    const nftSupplyDivisor: Record<string, number> = {
      "0x234b58ecdb0026b2aaf829cc46e91895f609f6d1": 300,
      "0x2953399124f0cbb46d2cbacd8a89cf0599974963": 1163,
      "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f": 80,
    };

    // UNIVERSAL STAT FORMULA: $0.01 = 1 stat point (except multipliers)
    const POINTS_PER_DOLLAR = 100; // $0.01 = 1 primary stat point
    const SECONDARY_PER_DOLLAR = 50; // $0.02 = 1 secondary stat point
    const TERTIARY_PER_DOLLAR = 20;  // $0.05 = 1 tertiary stat point
    const QUATERNARY_PER_DOLLAR = 10; // $0.10 = 1 quaternary stat point

    // Secondary + tertiary + quaternary stats for the 8 game tokens (HP is primary)
    const bonusStats: Record<string, { secondary: string; tertiary: string; quaternary: string }> = {
      "0x4bf82cf0d6b2afc87367052b793097153c859d38": { secondary: "def",    tertiary: "attack", quaternary: "mana" },   // DDD
      "0x64f6f111e9fdb753877f17f399b759de97379170": { secondary: "healing", tertiary: "mDef",   quaternary: "mana" },   // EGP(POL)
      "0xccf37622e6b72352e7b410481dd4913563038b7c": { secondary: "attack", tertiary: "mAtk",   quaternary: "mana" },   // OGC
      "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": { secondary: "attack", tertiary: "mAtk",   quaternary: "def" },    // PKT
      "0xd7c584d40216576f1d8651eab8bef9de69497666": { secondary: "mana",   tertiary: "healing", quaternary: "def" },    // BTN
      "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": { secondary: "mDef",   tertiary: "attack", quaternary: "mAtk" },   // IGS
      "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": { secondary: "mAtk",  tertiary: "mDef",   quaternary: "def" },    // DHG
      "0xddc330761761751e005333208889bfe36c6e6760": { secondary: "def",    tertiary: "mDef",   quaternary: "attack" }, // LGP
    };

    // Multipliers keep original scaling (not USD-based — they multiply other stats)
    const multiplierScale: Record<string, number> = {
      "0x20b048fa035d5763685d695e66adf62c5d9f5055": 1,        // CHAR: 1:1
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 1 / 2200, // CCC: 2200 = 1 multiplier
      "0x72e4327f592e9cb09d5730a55d1d68de144af53c": 1,        // PR25: 1:1 magic multiplier
      "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": 0.5,     // CRISP-M: 2 tokens = 1 multiplier point
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

    // Retry failed Polygon LP balances — find chunks that returned all failures and retry them
    if (polyLpBalanceResults.length > 0) {
      const polyPairCount = KNOWN_LP_PAIRS.polygon.length;
      for (let nftIdx = 0; nftIdx < GAME_NFTS.length; nftIdx++) {
        const start = nftIdx * polyPairCount;
        const nftResults = polyLpBalanceResults.slice(start, start + polyPairCount);
        const allFailed = nftResults.every(r => r.status !== "success");
        if (allFailed && polyPairCount > 0) {
          // This NFT got no Polygon data — retry just its calls
          try {
            const retryCalls = KNOWN_LP_PAIRS.polygon.map(pair => ({
              address: pair, abi: V2_PAIR_ABI, functionName: "balanceOf" as const,
              args: [GAME_NFTS[nftIdx].contractAddress] as [`0x${string}`],
            }));
            const retryResults = await chunkedMulticall(polygonClient, retryCalls, 30);
            for (let j = 0; j < retryResults.length; j++) {
              polyLpBalanceResults[start + j] = retryResults[j];
            }
          } catch { /* retry failed too */ }
        }
      }
      const polySuccess = polyLpBalanceResults.filter(r => r.status === "success").length;
      console.log("[API] Polygon LP after retries:", polySuccess, "/", polyLpBalanceResults.length, "successful");
    }

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

    // Derive USD prices for game tokens from stablecoin pairs
    // USDGLO = $1, USDC = $1, USDT = $1
    const USDGLO = "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3";
    const USDC_POL = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
    const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    // Mark stablecoins as $1
    tokenUsdPrices[USDC_POL] = 1;
    tokenUsdPrices[USDC_BASE] = 1;
    tokenUsdPrices[USDT] = 1;
    const allPairInfos = [...basePairInfos, ...polyPairInfos];
    // Debug: check Base pair data loaded
    const basePairsWithReserves = basePairInfos.filter(p => p.reserve0 > 0n);
    console.log("[API] Base pairs with reserves:", basePairsWithReserves.length, "/", basePairInfos.length);
    const mftPair = basePairInfos.find(p => p.token1 === "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3" || p.token0 === "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3");
    if (mftPair) console.log("[API] MfT pair found:", mftPair.token0.slice(0,10), "/", mftPair.token1.slice(0,10), "reserves:", Number(mftPair.reserve0), Number(mftPair.reserve1));
    else console.log("[API] WARNING: No MfT pair found in basePairInfos!");
    // Also fetch reference-only pairs for pricing (not in game, just for price derivation)
    const pricingOnlyPairs: `0x${string}`[] = [
      "0x0fdef11a0b332b3e723d181c0cb5cb10ea52d135", // PKT/USDT
      "0x5afb2de297ae4ad8bf2aab6e8ea057c2123172c0", // TB01/USDT
      "0xcb027ee5ca3d68ae44bc443566e7acb1f1699726", // REGEN/WETH
      "0xe5d269496e8e3845b6044f344cbf1021aec33ebe", // REGEN/WBTC
      "0x5efc46f24c3bf9e0185a3ed3f3c8df721a9296ba", // BCT/USDT (Sushi)
    ];
    const pricingPairCalls = pricingOnlyPairs.flatMap((pair) => [
      { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
      { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
    ]);
    try {
      const pricingResults = await chunkedMulticall(polygonClient, pricingPairCalls, 50);
      const pricingPairInfos = parsePairInfos(pricingOnlyPairs, pricingResults);
      allPairInfos.push(...pricingPairInfos);
    } catch { /* pricing pairs optional */ }

    // First pass: stablecoin pairs (USDGLO, USDC, USDT = $1)
    const stables = [USDGLO, USDC_POL, USDC_BASE, USDT];
    for (const stable of stables) {
      const stableDec = (stable === USDC_POL || stable === USDC_BASE || stable === USDT) ? 6 : 18;
      for (const p of allPairInfos) {
        if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
        if (p.token0 === stable && !tokenUsdPrices[p.token1]) {
          const tDec = tokenPriceConfig[p.token1]?.decimals ?? 18;
          const stableAmt = Number(p.reserve0) / (10 ** stableDec);
          const tokenAmt = Number(p.reserve1) / (10 ** tDec);
          if (tokenAmt > 0) tokenUsdPrices[p.token1] = stableAmt / tokenAmt;
        } else if (p.token1 === stable && !tokenUsdPrices[p.token0]) {
          const tDec = tokenPriceConfig[p.token0]?.decimals ?? 18;
          const stableAmt = Number(p.reserve1) / (10 ** stableDec);
          const tokenAmt = Number(p.reserve0) / (10 ** tDec);
          if (tokenAmt > 0) tokenUsdPrices[p.token0] = stableAmt / tokenAmt;
        }
      }
    }
    // Multi-hop price derivation — keep running passes until no new prices found
    const hopTokens = [
      USDGLO, USDC_POL, USDC_BASE, USDT,
      "0x4bf82cf0d6b2afc87367052b793097153c859d38", // DDD
      "0x64f6f111e9fdb753877f17f399b759de97379170", // EGP
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7", // CCC
      "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH Polygon
      "0x4200000000000000000000000000000000000006", // WETH Base
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WPOL
      "0x06a05043eb2c1691b19c2c13219db9212269ddc5", // BURGERS
      "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", // MfT
    ];
    // Run multiple passes — each pass may unlock new prices that enable more hops
    for (let pass = 0; pass < 4; pass++) {
      let newPrices = 0;
      for (const hop of hopTokens) {
        const hopPrice = tokenUsdPrices[hop];
        if (!hopPrice || hopPrice <= 0) continue;
        const hopDec = tokenPriceConfig[hop]?.decimals ?? 18;
        for (const p of allPairInfos) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          if (p.token0 === hop && !tokenUsdPrices[p.token1]) {
            const tDec = tokenPriceConfig[p.token1]?.decimals ?? 18;
            const hopAmt = Number(p.reserve0) / (10 ** hopDec);
            const tokenAmt = Number(p.reserve1) / (10 ** tDec);
            if (tokenAmt > 0) { tokenUsdPrices[p.token1] = (hopAmt * hopPrice) / tokenAmt; newPrices++; }
          } else if (p.token1 === hop && !tokenUsdPrices[p.token0]) {
            const tDec = tokenPriceConfig[p.token0]?.decimals ?? 18;
            const hopAmt = Number(p.reserve1) / (10 ** hopDec);
            const tokenAmt = Number(p.reserve0) / (10 ** tDec);
            if (tokenAmt > 0) { tokenUsdPrices[p.token0] = (hopAmt * hopPrice) / tokenAmt; newPrices++; }
          }
        }
      }
      if (newPrices === 0) break; // No new prices found, stop
    }

    const pricedCount = Object.values(tokenUsdPrices).filter(v => v > 0).length;
    console.log("[API] Derived USD prices for", pricedCount, "tokens:", Object.entries(tokenUsdPrices).filter(([,v]) => v > 0).map(([k, v]) => `${TOKEN_SYMBOLS[k] ?? k.slice(0,8)}: $${v.toFixed(6)}`).join(", "));

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

      // Compute final stats: $0.01 = 1 stat point for ALL tokens
      let attack = 0, mAtk = 0, fAtk = 0, def = 0, mDef = 0;
      let hp = 0, healing = 0, charMultiplier = 0, magicBoost = 0, mana = 0;

      const tokenAmounts: { symbol: string; amount: number; stat: string }[] = [];

      for (const [addr, amount] of tokenMap.entries()) {
        if (amount === 0n) continue;
        const decimals = tokenPriceConfig[addr]?.decimals ?? 18;
        const rawAmount = parseFloat(formatUnits(amount, decimals));
        const usdPrice = tokenUsdPrices[addr] ?? 0;
        const points = rawAmount * usdPrice * POINTS_PER_DOLLAR;
        let stat: string;

        // Stablecoins → ATK + DEF + HP equally
        const STABLECOINS = ["0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", "0x3595ca37596d5895b70efab592ac315d5b9809b2"]; // USDGLO, AZOS
        const WBTC_ADDR = "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6";
        const WETH_ADDRS = ["0x4200000000000000000000000000000000000006", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"];

        if (STABLECOINS.includes(addr)) {
          stat = "attack"; attack += points; def += points; hp += points;
        } else if (addr === WBTC_ADDR) {
          stat = "attack"; attack += points * 3;
        } else if (WETH_ADDRS.includes(addr)) {
          stat = "def"; def += points * 3;
        } else if (attackTokens.includes(addr) || polyAttackTokens.includes(addr)) {
          stat = "attack"; attack += points;
        } else if (polyMatkTokens.includes(addr)) {
          stat = "mAtk"; mAtk += points;
        } else if (polyFatkTokens.includes(addr)) {
          stat = "fAtk"; fAtk += points;
        } else if (magicTokens.includes(addr) || polyMagicTokens.includes(addr)) {
          stat = "charMultiplier";
          const mScale = multiplierScale[addr] ?? 1;
          charMultiplier += rawAmount * mScale; // NOT USD-based — raw multiplier value
        } else if (polyMagicBoostTokens.includes(addr)) {
          stat = "magicBoost";
          const mScale = multiplierScale[addr] ?? 1;
          magicBoost += rawAmount * mScale; // NOT USD-based — raw multiplier value
        } else if (polyDefTokens.includes(addr)) {
          stat = "def"; def += points;
        } else if (polyMDefTokens.includes(addr)) {
          stat = "mDef"; mDef += points;
        } else if (manaTokens.includes(addr)) {
          stat = "mana"; mana += points;
        } else {
          stat = "hp"; hp += points;
        }

        tokenAmounts.push({ symbol: TOKEN_SYMBOLS[addr] ?? addr.slice(0, 8), amount: rawAmount, stat });

        // Bonus stats for game tokens (secondary at $0.02/pt, tertiary at $0.05/pt)
        const bonus = bonusStats[addr];
        if (bonus && usdPrice > 0) {
          const usdVal = rawAmount * usdPrice;
          const sec = usdVal * SECONDARY_PER_DOLLAR;
          const ter = usdVal * TERTIARY_PER_DOLLAR;
          const applyBonus = (s: string, pts: number) => {
            if (s === "attack") attack += pts;
            else if (s === "mAtk") mAtk += pts;
            else if (s === "fAtk") fAtk += pts;
            else if (s === "def") def += pts;
            else if (s === "mDef") mDef += pts;
            else if (s === "hp") hp += pts;
            else if (s === "healing") healing += pts;
            else if (s === "mana") mana += pts;
          };
          const quat = usdVal * QUATERNARY_PER_DOLLAR;
          applyBonus(bonus.secondary, sec);
          applyBonus(bonus.tertiary, ter);
          applyBonus(bonus.quaternary, quat);
        }
      }

      return {
        name: nft.name,
        contractAddress: nft.contractAddress,
        chain: nft.chain,
        stats: {
          attack,
          mAtk,
          fAtk,
          def,
          mDef,
          hp,
          healing,
          charMultiplier,
          magicMultiplier: magicBoost,
          mana,
        },
        tokenAmounts: tokenAmounts.sort((a, b) => b.amount - a.amount),
        // USD backing: sum of all token amounts × their USD price
        usdBacking: (() => {
          let total = 0;
          for (const [addr, amount] of tokenMap.entries()) {
            if (amount === 0n) continue;
            const decimals = tokenPriceConfig[addr]?.decimals ?? 18;
            const rawAmount = parseFloat(formatUnits(amount, decimals));
            const usdPrice = tokenUsdPrices[addr] ?? 0;
            if (usdPrice > 0) total += rawAmount * usdPrice;
          }
          return total;
        })(),
      };
    });

    // Check which NFTs the marketplace seller owns (try both chains)
    const SELLER = "0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2" as `0x${string}`;
    let sellerOwned: Set<string> = new Set();

    // Try Base first
    try {
      const baseCalls = GAME_NFTS.map((nft) => ({
        address: nft.contractAddress, abi: ERC1155_ABI,
        functionName: "balanceOf" as const,
        args: [SELLER, TOKEN_ID] as [`0x${string}`, bigint],
      }));
      const baseResults = await chunkedMulticall(baseClient, baseCalls, 50);
      GAME_NFTS.forEach((nft, i) => {
        const r = baseResults[i];
        if (r?.status === "success" && (r.result as bigint) > 0n) {
          sellerOwned.add(nft.contractAddress.toLowerCase());
        }
      });
    } catch {}

    // Also try Polygon
    try {
      const polyCalls = GAME_NFTS.map((nft) => ({
        address: nft.contractAddress, abi: ERC1155_ABI,
        functionName: "balanceOf" as const,
        args: [SELLER, TOKEN_ID] as [`0x${string}`, bigint],
      }));
      const polyResults = await chunkedMulticall(polygonClient, polyCalls, 100);
      GAME_NFTS.forEach((nft, i) => {
        const r = polyResults[i];
        if (r?.status === "success" && (r.result as bigint) > 0n) {
          sellerOwned.add(nft.contractAddress.toLowerCase());
        }
      });
    } catch {}

    // Fallback: if ownership check failed entirely, mark all backed NFTs as for sale
    if (sellerOwned.size === 0) {
      console.log("[API] Seller ownership check returned 0 — using fallback (all backed NFTs)");
      characters.forEach((c: any) => {
        const s = c.stats;
        if (s.attack > 0 || s.hp > 0 || s.def > 0 || s.mAtk > 0 || s.fAtk > 0 || s.mana > 0 || s.charMultiplier > 0) {
          sellerOwned.add(c.contractAddress.toLowerCase());
        }
      });
    } else {
      console.log("[API] Seller owns", sellerOwned.size, "NFTs");
    }

    // Compute global asset totals by category
    const assetTotals = { traditional: 0, game: 0, impact: 0 };
    for (const char of characters) {
      for (const [addr, amount] of Object.entries(char as any)) {
        // Skip non-tokenMap fields
      }
    }
    // Sum across ALL characters' tokenAmounts with USD prices
    const globalTokenTotals = new Map<string, number>();
    for (const char of characters as any[]) {
      for (const ta of char.tokenAmounts ?? []) {
        // Need address — tokenAmounts only has symbol. Use a reverse lookup.
      }
    }
    // Simpler: sum from the raw tokenMap data we already computed per character
    // Re-derive from usdBacking split by category
    // Actually, let's compute it directly from all pair infos
    const categoryTotals = { traditional: 0, game: 0, impact: 0 };
    const tokenBreakdown: Record<string, { symbol: string; usd: number; category: string }> = {};
    for (const char of characters as any[]) {
      for (const ta of char.tokenAmounts ?? []) {
        const addr = Object.entries(TOKEN_SYMBOLS).find(([, s]) => s === ta.symbol)?.[0];
        if (!addr) continue;
        const cat = TOKEN_CATEGORY[addr] ?? "game";
        const usdPrice = tokenUsdPrices[addr] ?? 0;
        const usdVal = ta.amount * (usdPrice > 0 ? usdPrice : 0);
        categoryTotals[cat] += usdVal;
        if (usdVal > 0) {
          if (!tokenBreakdown[ta.symbol]) tokenBreakdown[ta.symbol] = { symbol: ta.symbol, usd: 0, category: cat };
          tokenBreakdown[ta.symbol].usd += usdVal;
        }
      }
    }

    return NextResponse.json({
      characters,
      sellerOwned: [...sellerOwned],
      assetTotals: categoryTotals,
      tokenBreakdown: Object.values(tokenBreakdown),
      prices: { btcHigh24h, ethHigh24h, polHigh24h, mftLow24h },
      updatedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
