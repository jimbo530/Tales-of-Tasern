import { createPublicClient, http, formatUnits } from "viem";
import { base, polygon } from "viem/chains";
import {
  GAME_NFTS as HARDCODED_NFTS,
  KNOWN_LP_PAIRS as HARDCODED_LP_PAIRS,
  V2_PAIR_ABI,
  ERC1155_ABI,
  type GameNft,
} from "@/lib/contracts";
import { getSharedNfts, getSharedLpPairs } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const baseClient = createPublicClient({ chain: base, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL ?? undefined) });
const polygonClient = createPublicClient({ chain: polygon, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_URL ?? undefined) });

type McResult = { status: string; result?: unknown };

async function chunkedMulticall(client: any, contracts: any[], chunkSize = 50): Promise<McResult[]> {
  if (contracts.length === 0) return [];
  const results: McResult[] = [];
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await client.multicall({ contracts: chunk as any, allowFailure: true });
        results.push(...(r as McResult[]));
        break;
      } catch {
        if (attempt === 2) results.push(...chunk.map(() => ({ status: "failure" as const })));
        else await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (i + chunkSize < contracts.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return results;
}

// ── Token metadata ──────────────────────────────────────────────────────────

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
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": "traditional",
  "0x4200000000000000000000000000000000000006": "traditional",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "traditional",
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "traditional",
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "traditional",
  "0x3595ca37596d5895b70efab592ac315d5b9809b2": "traditional",
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

const TOKEN_DECIMALS: Record<string, number> = {
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": 8,
  "0xd7c584d40216576f1d8651eab8bef9de69497666": 8,
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": 8,
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": 8,
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 16,
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": 6,
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": 6,
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": 6,
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": 10,
};

const NFT_SUPPLY_DIVISOR: Record<string, number> = {
  "0x234b58ecdb0026b2aaf829cc46e91895f609f6d1": 300,
  "0x2953399124f0cbb46d2cbacd8a89cf0599974963": 1163,
  "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f": 80,
  "0x99b772412c0d6e0fb31f227ecff4e92b98379fa8": 50,
};

const SELLER = "0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2" as `0x${string}`;
const TOKEN_ID = BigInt(1);

// ── Pricing pairs (reference-only, not in game) ─────────────────────────────
const PRICING_ONLY_PAIRS: `0x${string}`[] = [
  "0x0fdef11a0b332b3e723d181c0cb5cb10ea52d135",
  "0x5afb2de297ae4ad8bf2aab6e8ea057c2123172c0",
  "0xcb027ee5ca3d68ae44bc443566e7acb1f1699726",
  "0xe5d269496e8e3845b6044f344cbf1021aec33ebe",
  "0x5efc46f24c3bf9e0185a3ed3f3c8df721a9296ba",
];

// ── Main handler ────────────────────────────────────────────────────────────

export async function GET() {
  const start = Date.now();
  try {
    // Load NFT/LP registries from Supabase (fallback to hardcoded)
    let GAME_NFTS: GameNft[];
    let KNOWN_LP_PAIRS: { base: `0x${string}`[]; polygon: `0x${string}`[] };
    try {
      const [nftRows, lpPairs] = await Promise.all([getSharedNfts(), getSharedLpPairs()]);
      GAME_NFTS = nftRows.length > 0
        ? nftRows.map(r => ({ name: r.name, contractAddress: r.contract_address as `0x${string}`, chain: r.chain }))
        : HARDCODED_NFTS;
      KNOWN_LP_PAIRS = (lpPairs.base.length > 0 || lpPairs.polygon.length > 0) ? lpPairs : HARDCODED_LP_PAIRS;
    } catch {
      GAME_NFTS = HARDCODED_NFTS;
      KNOWN_LP_PAIRS = HARDCODED_LP_PAIRS;
    }
    console.log("[UPDATE] Starting chain data update:", GAME_NFTS.length, "NFTs,", KNOWN_LP_PAIRS.base.length, "+", KNOWN_LP_PAIRS.polygon.length, "LP pairs");

    // ── Step 1: Fetch CoinGecko prices ──────────────────────────────────────
    let btcHigh24h = 0, ethHigh24h = 0, polHigh24h = 0;
    try {
      const priceRes = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,matic-network", { next: { revalidate: 3600 } });
      if (priceRes.ok) {
        const data: any[] = await priceRes.json();
        btcHigh24h = data.find((c) => c.id === "bitcoin")?.high_24h ?? 0;
        ethHigh24h = data.find((c) => c.id === "ethereum")?.high_24h ?? 0;
        polHigh24h = data.find((c) => c.id === "matic-network")?.high_24h ?? 0;
      }
    } catch {}

    // ── Step 2: Fetch all LP pair data + NFT LP balances via multicall ──────
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
    } catch {}

    // Retry failed Polygon LP balances
    if (polyLpBalanceResults.length > 0) {
      const polyPairCount = KNOWN_LP_PAIRS.polygon.length;
      for (let nftIdx = 0; nftIdx < GAME_NFTS.length; nftIdx++) {
        const start = nftIdx * polyPairCount;
        const nftResults = polyLpBalanceResults.slice(start, start + polyPairCount);
        if (nftResults.every(r => r.status !== "success") && polyPairCount > 0) {
          try {
            const retryCalls = KNOWN_LP_PAIRS.polygon.map(pair => ({
              address: pair, abi: V2_PAIR_ABI, functionName: "balanceOf" as const,
              args: [GAME_NFTS[nftIdx].contractAddress] as [`0x${string}`],
            }));
            const retryResults = await chunkedMulticall(polygonClient, retryCalls, 30);
            for (let j = 0; j < retryResults.length; j++) {
              polyLpBalanceResults[start + j] = retryResults[j];
            }
          } catch {}
        }
      }
    }

    // ── Step 3: Parse pair infos ────────────────────────────────────────────
    type PairInfo = { address: `0x${string}`; token0: string; token1: string; totalSupply: bigint; reserve0: bigint; reserve1: bigint };
    function parsePairInfos(pairs: `0x${string}`[], results: McResult[]): PairInfo[] {
      return pairs.map((pair, i) => {
        const b = i * 4;
        const rv = results[b + 3];
        const reserves = rv?.status === "success" ? rv.result as readonly [bigint, bigint, number] : [0n, 0n, 0];
        return {
          address: pair,
          token0: results[b]?.status === "success" ? (results[b].result as string).toLowerCase() : "",
          token1: results[b + 1]?.status === "success" ? (results[b + 1].result as string).toLowerCase() : "",
          totalSupply: results[b + 2]?.status === "success" ? (results[b + 2].result as bigint) : 0n,
          reserve0: reserves[0] as bigint,
          reserve1: reserves[1] as bigint,
        };
      });
    }

    const basePairInfos = parsePairInfos(KNOWN_LP_PAIRS.base, basePairStaticResults);
    const polyPairInfos = parsePairInfos(KNOWN_LP_PAIRS.polygon, polyPairStaticResults);

    // ── Step 4: Derive token USD prices ─────────────────────────────────────
    const tokenUsdPrices: Record<string, number> = {
      "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": 1,
      "0x3595ca37596d5895b70efab592ac315d5b9809b2": 1,
    };
    const USDC_POL = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
    const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
    const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    tokenUsdPrices[USDC_POL] = 1;
    tokenUsdPrices[USDC_BASE] = 1;
    tokenUsdPrices[USDT] = 1;

    // Fetch pricing-only pairs for price derivation
    const allPairInfos = [...basePairInfos, ...polyPairInfos];
    try {
      const pricingPairCalls = PRICING_ONLY_PAIRS.flatMap((pair) => [
        { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const, args: [] as [] },
        { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const, args: [] as [] },
        { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
        { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
      ]);
      const pricingResults = await chunkedMulticall(polygonClient, pricingPairCalls, 50);
      allPairInfos.push(...parsePairInfos(PRICING_ONLY_PAIRS, pricingResults));
    } catch {}

    // Stablecoin pass
    const stables = ["0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", USDC_POL, USDC_BASE, USDT];
    for (const stable of stables) {
      const stableDec = (stable === USDC_POL || stable === USDC_BASE || stable === USDT) ? 6 : 18;
      for (const p of allPairInfos) {
        if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
        if (p.token0 === stable && !tokenUsdPrices[p.token1]) {
          const tDec = TOKEN_DECIMALS[p.token1] ?? 18;
          const stableAmt = Number(p.reserve0) / (10 ** stableDec);
          const tokenAmt = Number(p.reserve1) / (10 ** tDec);
          if (tokenAmt > 0) tokenUsdPrices[p.token1] = stableAmt / tokenAmt;
        } else if (p.token1 === stable && !tokenUsdPrices[p.token0]) {
          const tDec = TOKEN_DECIMALS[p.token0] ?? 18;
          const stableAmt = Number(p.reserve1) / (10 ** stableDec);
          const tokenAmt = Number(p.reserve0) / (10 ** tDec);
          if (tokenAmt > 0) tokenUsdPrices[p.token0] = stableAmt / tokenAmt;
        }
      }
    }

    // Multi-hop derivation
    const hopTokens = [
      ...stables,
      "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3",
      "0x64f6f111e9fdb753877f17f399b759de97379170",
      "0xc1ba76771bbf0dd841347630e57c793f9d5accee",
      "0x4bf82cf0d6b2afc87367052b793097153c859d38",
      "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7",
      "0xd7c584d40216576f1d8651eab8bef9de69497666",
      "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce",
      "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
      "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
      "0x4200000000000000000000000000000000000006",
      "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      "0x06a05043eb2c1691b19c2c13219db9212269ddc5",
      "0xd75dfa972c6136f1c594fec1945302f885e1ab29",
      "0xddc330761761751e005333208889bfe36c6e6760",
    ];
    for (let pass = 0; pass < 4; pass++) {
      let newPrices = 0;
      for (const hop of hopTokens) {
        const hopPrice = tokenUsdPrices[hop];
        if (!hopPrice || hopPrice <= 0) continue;
        const hopDec = TOKEN_DECIMALS[hop] ?? 18;
        for (const p of allPairInfos) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          if (p.token0 === hop && !tokenUsdPrices[p.token1]) {
            const tDec = TOKEN_DECIMALS[p.token1] ?? 18;
            const hopAmt = Number(p.reserve0) / (10 ** hopDec);
            const tokenAmt = Number(p.reserve1) / (10 ** tDec);
            if (tokenAmt > 0) { tokenUsdPrices[p.token1] = (hopAmt * hopPrice) / tokenAmt; newPrices++; }
          } else if (p.token1 === hop && !tokenUsdPrices[p.token0]) {
            const tDec = TOKEN_DECIMALS[p.token0] ?? 18;
            const hopAmt = Number(p.reserve1) / (10 ** hopDec);
            const tokenAmt = Number(p.reserve0) / (10 ** tDec);
            if (tokenAmt > 0) { tokenUsdPrices[p.token0] = (hopAmt * hopPrice) / tokenAmt; newPrices++; }
          }
        }
      }
      if (newPrices === 0) break;
    }

    // Override with CoinGecko
    if (ethHigh24h > 0) {
      tokenUsdPrices["0x4200000000000000000000000000000000000006"] = ethHigh24h;
      tokenUsdPrices["0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"] = ethHigh24h;
    }
    if (btcHigh24h > 0) tokenUsdPrices["0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6"] = btcHigh24h;
    if (polHigh24h > 0) tokenUsdPrices["0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"] = polHigh24h;

    // ── Step 5: Compute raw token amounts per NFT ───────────────────────────
    const allTokenAmountRows: { nft_address: string; token_address: string; symbol: string; raw_amount: number; usd_value: number; decimals: number }[] = [];
    const allNftSummaryRows: { nft_address: string; name: string; chain: string; usd_backing: number; usd_traditional: number; usd_game: number; usd_impact: number }[] = [];

    for (let nftIdx = 0; nftIdx < GAME_NFTS.length; nftIdx++) {
      const nft = GAME_NFTS[nftIdx];
      const supplyDiv = BigInt(NFT_SUPPLY_DIVISOR[nft.contractAddress.toLowerCase()] ?? 1);
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
        if (amt0 > 0n) accum(p.token0, amt0);
        if (amt1 > 0n) accum(p.token1, amt1);
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
        if (amt0 > 0n) accum(p.token0, amt0);
        if (amt1 > 0n) accum(p.token1, amt1);
      });

      // Convert to rows
      let totalUsd = 0, tradUsd = 0, gameUsd = 0, impactUsd = 0;
      for (const [addr, amount] of tokenMap.entries()) {
        if (amount === 0n) continue;
        const decimals = TOKEN_DECIMALS[addr] ?? 18;
        const rawAmount = parseFloat(formatUnits(amount, decimals));
        const usdPrice = tokenUsdPrices[addr] ?? 0;
        const usdValue = rawAmount * usdPrice;

        allTokenAmountRows.push({
          nft_address: nft.contractAddress.toLowerCase(),
          token_address: addr,
          symbol: TOKEN_SYMBOLS[addr] ?? addr.slice(0, 8),
          raw_amount: rawAmount,
          usd_value: usdValue,
          decimals,
        });

        if (usdPrice > 0) {
          totalUsd += usdValue;
          const cat = TOKEN_CATEGORY[addr] ?? "game";
          if (cat === "traditional") tradUsd += usdValue;
          else if (cat === "game") gameUsd += usdValue;
          else impactUsd += usdValue;
        }
      }

      allNftSummaryRows.push({
        nft_address: nft.contractAddress.toLowerCase(),
        name: nft.name,
        chain: nft.chain,
        usd_backing: totalUsd,
        usd_traditional: tradUsd,
        usd_game: gameUsd,
        usd_impact: impactUsd,
      });
    }

    // ── Step 6: Check seller ownership ──────────────────────────────────────
    const sellerRows: { nft_address: string; chain: string; balance: number }[] = [];
    async function checkSeller(client: any, nfts: GameNft[], chainName: string) {
      if (nfts.length === 0) return;
      const calls = nfts.map((nft) => ({
        address: nft.contractAddress, abi: ERC1155_ABI,
        functionName: "balanceOf" as const,
        args: [SELLER, TOKEN_ID] as [`0x${string}`, bigint],
      }));
      try {
        const results = await chunkedMulticall(client, calls, 50);
        nfts.forEach((nft, i) => {
          const r = results[i];
          const bal = r?.status === "success" ? Number(r.result as bigint) : 0;
          sellerRows.push({ nft_address: nft.contractAddress.toLowerCase(), chain: nft.chain, balance: bal });
        });
      } catch {}
    }
    await checkSeller(baseClient, GAME_NFTS.filter(n => n.chain === "base"), "Base");
    await checkSeller(polygonClient, GAME_NFTS.filter(n => n.chain === "polygon"), "Polygon");

    // ── Step 7: Write everything to Supabase ────────────────────────────────
    const now = new Date().toISOString();

    // Token prices
    const priceRows = Object.entries(tokenUsdPrices)
      .filter(([, v]) => v > 0)
      .map(([addr, price]) => ({
        token_address: addr,
        symbol: TOKEN_SYMBOLS[addr] ?? addr.slice(0, 8),
        usd_price: price,
        decimals: TOKEN_DECIMALS[addr] ?? 18,
        category: TOKEN_CATEGORY[addr] ?? "game",
        updated_at: now,
      }));

    // Batch upsert (500 rows at a time)
    async function batchUpsert(table: string, rows: any[], conflictKey: string) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map(r => ({ ...r, updated_at: now }));
        const { error } = await supabaseAdmin.from(table).upsert(chunk, { onConflict: conflictKey });
        if (error) console.error(`[UPDATE] ${table} upsert error:`, error.message);
      }
    }

    await Promise.all([
      batchUpsert("token_prices", priceRows, "token_address"),
      batchUpsert("nft_token_amounts", allTokenAmountRows, "nft_address,token_address"),
      batchUpsert("nft_summary", allNftSummaryRows, "nft_address"),
      batchUpsert("seller_ownership", sellerRows, "nft_address"),
    ]);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const summary = {
      nfts: GAME_NFTS.length,
      tokenAmountRows: allTokenAmountRows.length,
      priceRows: priceRows.length,
      sellerRows: sellerRows.length,
      summaryRows: allNftSummaryRows.length,
      elapsed: `${elapsed}s`,
      prices: { btcHigh24h, ethHigh24h, polHigh24h },
    };
    console.log("[UPDATE] Done:", JSON.stringify(summary));

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[UPDATE] Fatal error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
