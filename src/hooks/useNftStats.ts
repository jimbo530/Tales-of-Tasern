"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { GAME_NFTS, KNOWN_LP_PAIRS, ERC1155_ABI, ERC721_ABI, V2_PAIR_ABI, STAT_TOKENS } from "@/lib/contracts";
import { formatUnits } from "viem";

const TOKEN_ID = BigInt(1);

const TOKEN_SYMBOLS: Record<string, string> = {
  "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": "USDGLO",
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": "MfT",
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": "CHAR",
  "0xc1ba76771bbf0dd841347630e57c793f9d5accee": "EGP",   // Base
  "0x4bf82cf0d6b2afc87367052b793097153c859d38": "DDD",
  "0x64f6f111e9fdb753877f17f399b759de97379170": "EGP",   // Polygon
  "0xccf37622e6b72352e7b410481dd4913563038b7c": "OGC",
  "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": "PKT",
  "0xd7c584d40216576f1d8651eab8bef9de69497666": "BTN",
  "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": "IGS",
  "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": "DHG",
  "0xddc330761761751e005333208889bfe36c6e6760": "LGP",
  "0xd838290e877e0188a4a44700463419ed96c16107": "NCT",
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": "BCT",
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": "CCC",
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": "JLT-F24",
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c": "PR25",
  "0xd84415c956f44b2300a2e56c5b898401913e9a29": "PR24",
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4": "TB01",
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca": "JCGWR",
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020": "LANTERN",
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": "JLT-B23",
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "WPOL",
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5": "BURGERS",
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": "REGEN",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "WBTC",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
};

export type TokenAmount = {
  symbol: string;
  amount: number;
  stat: "attack" | "mAtk" | "fAtk" | "def" | "mDef" | "hp" | "charMultiplier" | "magicBoost" | "mana";
};

export type NftCharacter = {
  name: string;
  contractAddress: string;
  chain: "base" | "polygon";
  tokenId: bigint;
  metadataUri?: string;
  owned: boolean;
  stats: { attack: number; mAtk: number; fAtk: number; def: number; mDef: number; hp: number; charMultiplier: number; magicMultiplier: number; mana: number };
  tokenAmounts: TokenAmount[];
};

type McResult = { status: string; result?: unknown };

/** Split a large multicall into sequential chunks to avoid gas/size limits */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chunkedMulticall(client: any, contracts: any[], chunkSize = 400): Promise<McResult[]> {
  if (contracts.length === 0) return [];
  const results: McResult[] = [];
  for (let i = 0; i < contracts.length; i += chunkSize) {
    const chunk = contracts.slice(i, i + chunkSize);
    const r = await client.multicall({ contracts: chunk, allowFailure: true });
    results.push(...r);
  }
  return results;
}

export function useNftStats() {
  const { address, isConnected } = useAccount();
  const baseClient = usePublicClient({ chainId: base.id });
  const polygonClient = usePublicClient({ chainId: polygon.id });

  const [characters, setCharacters] = useState<NftCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseClient) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!baseClient) throw new Error("Base client not ready");

        // ── Fetch 24h high prices for ATK valuation ───────────────────────────
        let btcHigh24h = 0, ethHigh24h = 0, polHigh24h = 0;
        try {
          const priceRes = await fetch(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,matic-network"
          );
          if (priceRes.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data: any[] = await priceRes.json();
            btcHigh24h = data.find((c) => c.id === "bitcoin")?.high_24h ?? 0;
            ethHigh24h = data.find((c) => c.id === "ethereum")?.high_24h ?? 0;
            polHigh24h = data.find((c) => c.id === "matic-network")?.high_24h ?? 0;
            console.log("[ToT] Prices — BTC:", btcHigh24h, "ETH:", ethHigh24h, "POL:", polHigh24h);
          }
        } catch { console.warn("[ToT] Price fetch failed, ATK will use raw amounts"); }

        // Per-contract NFT supply — divide LP stats by total NFTs in collection
        const nftSupplyDivisor: Record<string, number> = {
          "0x234b58ecdb0026b2aaf829cc46e91895f609f6d1": 300,  // Guards of Kardov's Gate: 300 NFTs
          "0x2953399124f0cbb46d2cbacd8a89cf0599974963": 1163, // Space Donkeys: 1163 NFTs
          "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f": 80,   // MycoVault: 80 NFTs
        };

        // Per-token stat scaling (e.g. 1000 MfT = 1 HP)
        const tokenStatScale: Record<string, number> = {
          "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": 1 / 1000000, // MfT: 1,000,000 = 1 HP
          "0x06a05043eb2c1691b19c2c13219db9212269ddc5": 1 / 1000, // BURGERS: 1000 = 1 HP
          "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": 0.05,    // REGEN: half to HP (1/10 strength)
          "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 1 / 2200, // CCC: 2200 = 1 multiplier
        };

        // Dual-stat tokens — contribute to a secondary stat at a different scale
        type ExtraStat = { stat: "attack" | "hp" | "mana" | "def" | "mDef" | "mAtk"; scale: number };
        const extraStats: Record<string, ExtraStat[]> = {
          "0xccf37622e6b72352e7b410481dd4913563038b7c": [{ stat: "attack", scale: 1 / 1000 }], // OGC: +ATK
          "0x64f6f111e9fdb753877f17f399b759de97379170": [{ stat: "mana",   scale: 1 / 1000 }], // EGP(POL): +MANA
          "0xddc330761761751e005333208889bfe36c6e6760": [{ stat: "def",    scale: 1 / 1000 }], // LGP: +DEF
          "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": [{ stat: "mAtk",   scale: 1 / 1000 }], // DHG: +MATK
          "0xd7c584d40216576f1d8651eab8bef9de69497666": [{ stat: "mana",   scale: 1 / 1000 }], // BTN: +MANA
          "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": [{ stat: "mDef",   scale: 1 / 1000 }], // IGS: +MDEF
          "0x4bf82cf0d6b2afc87367052b793097153c859d38": [{ stat: "def",    scale: 1 / 1000 }], // DDD: +DEF
          "0x8a088dceecbcf457762eb7c66f78fff27dc0c04a": [{ stat: "attack", scale: 1 / 1000 }], // PKT: +ATK
          "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": [{ stat: "attack", scale: 0.05 }],      // REGEN: other half to ATK (1/10 strength)
          "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3": [                                      // MfT: 50% ATK + 50% DEF secondary
            { stat: "attack", scale: 1 / 2000000 },
            { stat: "def",    scale: 1 / 2000000 },
          ],
          "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": [                                      // USDGLO: ATK+DEF+HP 1:1
            { stat: "hp",  scale: 1 },
            { stat: "def", scale: 1 },
          ],
        };

        // Token price (USD) and decimals — price used for ATK, decimals for all tokens
        const tokenPriceConfig: Record<string, { price: number; decimals: number }> = {
          // ATK tokens with USD prices
          "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3": { price: 1, decimals: 18 },       // USDGLO
          "0x4200000000000000000000000000000000000006": { price: ethHigh24h, decimals: 18 }, // WETH (Base)
          "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": { price: btcHigh24h, decimals: 8 }, // WBTC (Polygon)
          "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": { price: ethHigh24h, decimals: 18 }, // WETH (Polygon)
          "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": { price: polHigh24h, decimals: 18 }, // WPOL (24h high)
          // Non-18-decimal tokens (price=1, only decimals matters for stat calc)
          "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": { price: 1, decimals: 16 }, // CCC (16 decimals)
          "0xd7c584d40216576f1d8651eab8bef9de69497666": { price: 1, decimals: 8 },  // BTN (8 decimals)
          "0xe302672798d12e7f68c783db2c2d5e6b48ccf3ce": { price: 1, decimals: 8 },  // IGS (8 decimals)
          "0x75c0a194cd8b4f01d5ed58be5b7c5b61a9c69d0a": { price: 1, decimals: 8 },  // DHG (8 decimals)
          "0xcdb4574adb7c6643153a65ee1a953afd5a189cef": { price: 1, decimals: 6 },  // JLT-F24 (6 decimals)
          "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e": { price: 1, decimals: 6 },  // JLT-B23 (6 decimals)
          "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b": { price: 1, decimals: 6 },  // REGEN (6 decimals)
          "0x72e4327f592e9cb09d5730a55d1d68de144af53c": { price: 1, decimals: 10 }, // PR25 (10 decimals)
        };

        const hasPolyPairs = KNOWN_LP_PAIRS.polygon.length > 0 && !!polygonClient;
        console.log("[ToT] polygonClient:", !!polygonClient, "polyPairs:", KNOWN_LP_PAIRS.polygon.length, "hasPolyPairs:", hasPolyPairs);

        // ── Pair static data calls ────────────────────────────────────────────
        const basePairStaticCalls = KNOWN_LP_PAIRS.base.flatMap((pair) => [
          { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const,      args: [] as [] },
          { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const,      args: [] as [] },
          { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
          { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
        ]);

        const polyPairStaticCalls = hasPolyPairs
          ? KNOWN_LP_PAIRS.polygon.flatMap((pair) => [
              { address: pair, abi: V2_PAIR_ABI, functionName: "token0" as const,      args: [] as [] },
              { address: pair, abi: V2_PAIR_ABI, functionName: "token1" as const,      args: [] as [] },
              { address: pair, abi: V2_PAIR_ABI, functionName: "totalSupply" as const, args: [] as [] },
              { address: pair, abi: V2_PAIR_ABI, functionName: "getReserves" as const, args: [] as [] },
            ])
          : [];

        // ── LP balance calls ──────────────────────────────────────────────────
        const baseLpBalanceCalls = GAME_NFTS.flatMap((nft) =>
          KNOWN_LP_PAIRS.base.map((pair) => ({
            address: pair,
            abi: V2_PAIR_ABI,
            functionName: "balanceOf" as const,
            args: [nft.contractAddress] as [`0x${string}`],
          }))
        );

        const polyLpBalanceCalls = hasPolyPairs
          ? GAME_NFTS.flatMap((nft) =>
              KNOWN_LP_PAIRS.polygon.map((pair) => ({
                address: pair,
                abi: V2_PAIR_ABI,
                functionName: "balanceOf" as const,
                args: [nft.contractAddress] as [`0x${string}`],
              }))
            )
          : [];

        // ── Ownership calls ────────────────────────────────────────────────────
        const ownershipCalls = GAME_NFTS.map((nft) => ({
          address: nft.contractAddress,
          abi: ERC1155_ABI,
          functionName: "balanceOf" as const,
          args: [address ?? "0x0000000000000000000000000000000000000000", TOKEN_ID] as [`0x${string}`, bigint],
        }));

        // ── Fire LP + ownership multicalls ────────────────────────────────────
        const [
          basePairStaticResults,
          baseLpBalanceResults,
          ownershipResults,
        ] = await Promise.all([
          baseClient!.multicall({ contracts: basePairStaticCalls, allowFailure: true }),
          chunkedMulticall(baseClient!, baseLpBalanceCalls),
          baseClient!.multicall({ contracts: ownershipCalls, allowFailure: true }),
        ]);

        // Polygon LP calls — chunked and wrapped in catch
        let polyPairStaticResults: McResult[] = [];
        let polyLpBalanceResults: McResult[] = [];

        if (hasPolyPairs) {
          try {
            const polyResults = await Promise.all([
              chunkedMulticall(polygonClient!, polyPairStaticCalls),
              chunkedMulticall(polygonClient!, polyLpBalanceCalls),
            ]);
            polyPairStaticResults = polyResults[0];
            polyLpBalanceResults  = polyResults[1];
            console.log("[ToT] Polygon LP multicalls OK — pairStatic:", polyPairStaticResults.length, "lpBal:", polyLpBalanceResults.length);
          } catch (e) {
            console.error("[ToT] Polygon LP multicalls FAILED:", e);
          }
        }

        // ── Resolve URIs via individual readContract calls ──
        async function resolveUri(nft: { contractAddress: `0x${string}` }): Promise<{ uri?: string; resolvedChain?: "base" | "polygon" }> {
          // 1. ERC-1155 uri() on Base
          try {
            const r = await baseClient!.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] });
            const raw = (r as string).replace("{id}", TOKEN_ID.toString());
            if (raw) return { uri: raw, resolvedChain: "base" };
          } catch { /* not ERC-1155 on Base */ }
          // 2. ERC-721 tokenURI() on Base
          try {
            const r = await baseClient!.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] });
            if (r) return { uri: r as string, resolvedChain: "base" };
          } catch { /* not ERC-721 on Base */ }
          // 3. ERC-1155 uri() on Polygon
          if (polygonClient) {
            try {
              const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] });
              const raw = (r as string).replace("{id}", TOKEN_ID.toString());
              if (raw) return { uri: raw, resolvedChain: "polygon" };
            } catch { /* not ERC-1155 on Polygon */ }
          }
          // 4. ERC-721 tokenURI() on Polygon
          if (polygonClient) {
            try {
              const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] });
              if (r) return { uri: r as string, resolvedChain: "polygon" };
            } catch { /* not ERC-721 on Polygon */ }
          }
          return {};
        }

        // URIs resolved AFTER initial render — don't block stats
        const uriResults: (string | undefined)[] = new Array(GAME_NFTS.length).fill(undefined);

        type PairInfo = { address: `0x${string}`; token0: string; token1: string; totalSupply: bigint; reserve0: bigint; reserve1: bigint };

        function parsePairInfos(pairs: `0x${string}`[], results: McResult[]): PairInfo[] {
          return pairs.map((pair, i) => {
            const b = i * 4;
            const rv = results[b + 3];
            const reserves = rv?.status === "success" ? rv.result as readonly [bigint, bigint, number] : [0n, 0n, 0];
            return {
              address: pair,
              token0:      results[b]?.status   === "success" ? (results[b].result as string).toLowerCase() : "",
              token1:      results[b+1]?.status === "success" ? (results[b+1].result as string).toLowerCase() : "",
              totalSupply: results[b+2]?.status === "success" ? (results[b+2].result as bigint) : 0n,
              reserve0: reserves[0] as bigint,
              reserve1: reserves[1] as bigint,
            };
          });
        }

        const basePairInfos = parsePairInfos(KNOWN_LP_PAIRS.base, basePairStaticResults);
        const polyPairInfos = parsePairInfos(KNOWN_LP_PAIRS.polygon, polyPairStaticResults);

        const attackTokens    = STAT_TOKENS.base.attack.map(t => t.toLowerCase());
        const baseHpTokens   = STAT_TOKENS.base.hp.map(t => t.toLowerCase());
        const magicTokens    = STAT_TOKENS.base.magic.map(t => t.toLowerCase());
        const polyAttackTokens    = STAT_TOKENS.polygon.attack.map(t => t.toLowerCase());
        const polyMatkTokens     = STAT_TOKENS.polygon.mAtk.map(t => t.toLowerCase());
        const polyFatkTokens     = STAT_TOKENS.polygon.fAtk.map(t => t.toLowerCase());
        const polyHpTokens       = STAT_TOKENS.polygon.hp.map(t => t.toLowerCase());
        const polyMagicTokens    = STAT_TOKENS.polygon.magic.map(t => t.toLowerCase());
        const polyMagicBoostTokens = STAT_TOKENS.polygon.magicBoost.map(t => t.toLowerCase());
        const polyDefTokens      = STAT_TOKENS.polygon.def.map(t => t.toLowerCase());
        const polyMDefTokens     = STAT_TOKENS.polygon.mDef.map(t => t.toLowerCase());
        const manaTokens         = STAT_TOKENS.polygon.mana.map(t => t.toLowerCase());

        // ── Assemble characters ───────────────────────────────────────────────
        const results: NftCharacter[] = GAME_NFTS.map((nft, nftIdx) => {
          const supplyDiv = BigInt(nftSupplyDivisor[nft.contractAddress.toLowerCase()] ?? 1);
          let rawAttack = 0n, rawMAtk = 0n, rawFAtk = 0n, rawDef = 0n, rawMDef = 0n, rawHp = 0n, rawMagic = 0n, rawMagicBoost = 0n, rawMana = 0n;
          const tokenMap = new Map<string, bigint>();
          const accum = (addr: string, amt: bigint) =>
            tokenMap.set(addr, (tokenMap.get(addr) ?? 0n) + amt);

          // Base LP stats
          KNOWN_LP_PAIRS.base.forEach((_, pairIdx) => {
            const balResult = baseLpBalanceResults[nftIdx * KNOWN_LP_PAIRS.base.length + pairIdx];
            if (!balResult || balResult.status !== "success") return;
            const lpHeld = balResult.result as bigint;
            if (lpHeld === 0n) return;
            const p = basePairInfos[pairIdx];
            if (p.totalSupply === 0n) return;
            const share = (lpHeld * BigInt(1e18)) / p.totalSupply;
            const amt0  = (p.reserve0 * share) / BigInt(1e18) / supplyDiv;
            const amt1  = (p.reserve1 * share) / BigInt(1e18) / supplyDiv;

            if (attackTokens.includes(p.token0))  { rawAttack += amt0; accum(p.token0, amt0); }
            if (attackTokens.includes(p.token1))  { rawAttack += amt1; accum(p.token1, amt1); }
            if (baseHpTokens.includes(p.token0))  { rawHp     += amt0; accum(p.token0, amt0); }
            if (baseHpTokens.includes(p.token1))  { rawHp     += amt1; accum(p.token1, amt1); }
            if (magicTokens.includes(p.token0))   { rawMagic  += amt0; accum(p.token0, amt0); }
            if (magicTokens.includes(p.token1))   { rawMagic  += amt1; accum(p.token1, amt1); }
          });

          // Polygon LP stats
          KNOWN_LP_PAIRS.polygon.forEach((_, pairIdx) => {
            const balResult = polyLpBalanceResults[nftIdx * KNOWN_LP_PAIRS.polygon.length + pairIdx];
            if (!balResult || balResult.status !== "success") return;
            const lpHeld = balResult.result as bigint;
            if (lpHeld === 0n) return;
            const p = polyPairInfos[pairIdx];
            if (!p || p.totalSupply === 0n) return;
            const share = (lpHeld * BigInt(1e18)) / p.totalSupply;
            const amt0  = (p.reserve0 * share) / BigInt(1e18) / supplyDiv;
            const amt1  = (p.reserve1 * share) / BigInt(1e18) / supplyDiv;

            // Accumulate token amounts once per token, then distribute to stats
            for (const [token, amt] of [[p.token0, amt0], [p.token1, amt1]] as [string, bigint][]) {
              let recognized = false;
              if (polyAttackTokens.includes(token))     { rawAttack     += amt; recognized = true; }
              if (polyMatkTokens.includes(token))       { rawMAtk       += amt; recognized = true; }
              if (polyFatkTokens.includes(token))       { rawFAtk       += amt; recognized = true; }
              if (polyDefTokens.includes(token))        { rawDef        += amt; recognized = true; }
              if (polyMDefTokens.includes(token))       { rawMDef       += amt; recognized = true; }
              if (polyHpTokens.includes(token))         { rawHp         += amt; recognized = true; }
              if (polyMagicTokens.includes(token))      { rawMagic      += amt; recognized = true; }
              if (polyMagicBoostTokens.includes(token)) { rawMagicBoost += amt; recognized = true; }
              if (manaTokens.includes(token))           { rawMana       += amt; recognized = true; }
              if (recognized) accum(token, amt);
            }
          });

          // Token breakdown for card back + USD-weighted ATK
          const tokenAmounts: TokenAmount[] = [];
          let attackUsd = 0;
          let mAtkScaled = 0;
          let fAtkScaled = 0;
          let defScaled = 0;
          let mDefScaled = 0;
          let hpScaled = 0;
          let magicScaled = 0;
          let magicBoostScaled = 0;
          let manaScaled = 0;
          for (const [addr, amount] of tokenMap.entries()) {
            if (amount === 0n) continue;
            const symbol = TOKEN_SYMBOLS[addr] ?? `${addr.slice(0, 6)}…`;
            const decimals = tokenPriceConfig[addr]?.decimals ?? 18;
            const rawAmount = parseFloat(formatUnits(amount, decimals));
            const scale = tokenStatScale[addr] ?? 1;
            let stat: TokenAmount["stat"];
            if (attackTokens.includes(addr) || polyAttackTokens.includes(addr)) {
              stat = "attack";
              const price = tokenPriceConfig[addr]?.price ?? 1;
              attackUsd += rawAmount * price;
            }
            else if (polyMatkTokens.includes(addr)) {
              stat = "mAtk";
              mAtkScaled += rawAmount * scale;
            }
            else if (polyFatkTokens.includes(addr)) {
              stat = "fAtk";
              fAtkScaled += rawAmount * scale;
            }
            else if (polyDefTokens.includes(addr)) {
              stat = "def";
              defScaled += rawAmount * scale;
            }
            else if (polyMDefTokens.includes(addr)) {
              stat = "mDef";
              mDefScaled += rawAmount * scale;
            }
            else if (magicTokens.includes(addr) || polyMagicTokens.includes(addr)) {
              stat = "charMultiplier";
              magicScaled += rawAmount * scale;
            }
            else if (polyMagicBoostTokens.includes(addr)) {
              stat = "magicBoost";
              magicBoostScaled += rawAmount * scale;
            }
            else if (manaTokens.includes(addr)) {
              stat = "mana";
              manaScaled += rawAmount * scale;
            }
            else {
              stat = "hp";
              hpScaled += (rawAmount * scale) / 100;
            }
            tokenAmounts.push({ symbol, amount: rawAmount, stat });

            // Dual-stat: secondary contribution at different scale
            const extras = extraStats[addr];
            if (extras) {
              for (const ex of extras) {
                const v = rawAmount * ex.scale;
                if (ex.stat === "attack") attackUsd += v * (tokenPriceConfig[addr]?.price ?? 1);
                if (ex.stat === "hp")     hpScaled += v / 100;
                if (ex.stat === "mana")   manaScaled += v;
                if (ex.stat === "def")    defScaled += v;
                if (ex.stat === "mDef")   mDefScaled += v;
                if (ex.stat === "mAtk")   mAtkScaled += v;
              }
            }
          }
          tokenAmounts.sort((a, b) => b.amount - a.amount);

          // Ownership
          const ownerResult = ownershipResults[nftIdx];
          const owned = isConnected && address != null &&
            ownerResult.status === "success" && (ownerResult.result as bigint) > 0n;

          // Metadata URI — resolved earlier via individual readContract calls
          const metadataUri = uriResults[nftIdx];

          return {
            name: nft.name,
            contractAddress: nft.contractAddress,
            chain: nft.chain === "base" ? "base" : "polygon",
            tokenId: TOKEN_ID,
            metadataUri,
            owned,
            stats: {
              attack:          attackUsd,
              mAtk:            mAtkScaled,
              fAtk:            fAtkScaled,
              def:             defScaled,
              mDef:            mDefScaled,
              hp:              hpScaled,
              charMultiplier:  magicScaled,
              magicMultiplier: magicBoostScaled,
              mana:            manaScaled,
            },
            tokenAmounts,
          };
        });

        // Debug: log first 3 NFT stats
        results.slice(0, 3).forEach((r, i) => console.log(`[ToT] STATS NFT#${i} ${r.name}:`, JSON.stringify(r.stats)));
        setCharacters(results);

        // Background: resolve URIs and update characters incrementally
        const URI_BATCH = 20;
        for (let i = 0; i < GAME_NFTS.length; i += URI_BATCH) {
          const batch = GAME_NFTS.slice(i, i + URI_BATCH);
          const batchResults = await Promise.all(batch.map(resolveUri));
          setCharacters((prev) => prev.map((char, idx) => {
            if (idx < i || idx >= i + URI_BATCH) return char;
            const result = batchResults[idx - i];
            if (!result.uri) return char;
            return {
              ...char,
              metadataUri: result.uri,
              chain: result.resolvedChain ?? char.chain,
            };
          }));
        }
      } catch (err) {
        console.error("[ToT]", err);
        setError(String(err));
      }

      setLoading(false);
    }

    load();
  }, [address, isConnected, baseClient, polygonClient]);

  return { characters, loading, error };
}
