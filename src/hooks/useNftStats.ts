"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { ERC1155_ABI, GAME_NFTS } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";

const TOKEN_ID = BigInt(1);
const MAX_TOKEN_ID = 200;
const STATS_CACHE_KEY = "tot-stats-cache-v2"; // v2: D20 ability scores
const STATS_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours — markets are slow, reduce API calls

const OWNERSHIP_CACHE_KEY = "tot-ownership-cache";

function getCachedStats(): { data: any; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && parsed.timestamp) return parsed;
  } catch {}
  return null;
}

function setCachedStats(data: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function getCachedOwnership(wallet: string): { map: Record<string, number>; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${OWNERSHIP_CACHE_KEY}-${wallet.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.map && parsed.timestamp) return parsed;
  } catch {}
  return null;
}

function setCachedOwnership(wallet: string, map: Map<string, number>) {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = {};
    map.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(`${OWNERSHIP_CACHE_KEY}-${wallet.toLowerCase()}`, JSON.stringify({ map: obj, timestamp: Date.now() }));
  } catch {}
}

/** Fetch computed D20 stats from Supabase nft_d20_stats table (fast, ~100ms) */
async function fetchFromSupabase(): Promise<any | null> {
  try {
    const { data: rows, error } = await supabase
      .from("nft_d20_stats")
      .select("key, data");
    if (error || !rows || rows.length === 0) return null;

    const summaryRow = rows.find((r: any) => r.key === "__summary__");
    const characterRows = rows.filter((r: any) => r.key !== "__summary__");
    if (characterRows.length === 0) return null;

    return {
      characters: characterRows.map((r: any) => r.data),
      sellerOwned: summaryRow?.data?.sellerOwned ?? [],
      assetTotals: summaryRow?.data?.assetTotals ?? { traditional: 0, game: 0, impact: 0 },
      tokenBreakdown: summaryRow?.data?.tokenBreakdown ?? [],
    };
  } catch {
    return null;
  }
}

export type TokenAmount = {
  symbol: string;
  amount: number;
  stat: string;
};

export type NftCharacter = {
  name: string;
  contractAddress: string;
  chain: "base" | "polygon";
  tokenId: bigint;
  metadataUri?: string;
  imageUrl?: string;
  owned: boolean;
  ownedCount: number;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number; ac: number; atk: number; speed: number; lightningDmg: number; fireDmg: number };
  subtypes: string[];
  tokenAmounts: TokenAmount[];
  usdBacking: number;
  forSale: boolean;
};

/** Ensure all 6 core ability scores are at least 1 */
function floorStats(s: NftCharacter["stats"]): NftCharacter["stats"] {
  return {
    ...s,
    str: Math.max(1, s.str),
    dex: Math.max(1, s.dex),
    con: Math.max(1, s.con),
    int: Math.max(1, s.int),
    wis: Math.max(1, s.wis),
    cha: Math.max(1, s.cha),
  };
}

export function useNftStats() {
  const { address, isConnected } = useAccount();
  const baseClient = usePublicClient({ chainId: base.id });
  const polygonClient = usePublicClient({ chainId: polygon.id });

  const [characters, setCharacters] = useState<NftCharacter[]>([]);
  const [assetTotals, setAssetTotals] = useState<{ traditional: number; game: number; impact: number }>({ traditional: 0, game: 0, impact: 0 });
  const [tokenBreakdown, setTokenBreakdown] = useState<{ symbol: string; usd: number; category: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Load stats: Supabase → local file → localStorage → API
        let data: any;
        let fetched = false;

        // Priority 1: Supabase nft_d20_stats (fast, always fresh from daily cron)
        try {
          const sbData = await fetchFromSupabase();
          if (sbData && sbData.characters?.length > 0) {
            data = sbData;
            fetched = true;
            console.log("[ToT] Loaded from Supabase:", data.characters.length, "NFTs");
          }
        } catch {}

        // Priority 2: In dev mode, try local file (npm run refresh-stats)
        if (!fetched && process.env.NODE_ENV === "development") {
          try {
            const localRes = await fetch("/stats-cache.json?t=" + Date.now());
            if (localRes.ok) {
              data = await localRes.json();
              fetched = true;
              console.log("[ToT] Loaded from local file (dev mode):", data.characters?.length, "NFTs");
            }
          } catch {}
        }

        // Priority 3: localStorage cache
        if (!fetched) {
          const cached = getCachedStats();
          if (cached && (Date.now() - cached.timestamp) < STATS_CACHE_TTL) {
            data = cached.data;
            fetched = true;
            console.log("[ToT] Using localStorage cache (age:", Math.round((Date.now() - cached.timestamp) / 60000), "min)");
          }
        }

        // Then try local file (production, after cache clear)
        if (!fetched) {
          try {
            const localRes = await fetch("/stats-cache.json");
            if (localRes.ok) {
              data = await localRes.json();
              fetched = true;
              console.log("[ToT] Loaded from local file cache");
            }
          } catch {}
        }

        // Last resort: API
        if (!fetched) {
          const res = await fetch("/api/stats");
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          data = await res.json();
          console.log("[ToT] Fetched fresh stats from API:", data.characters?.length, "NFTs");
        }

        // Zero-protection: if new data has more zeros than cached, keep cached
        const prevCached = getCachedStats();
        if (prevCached && prevCached.data?.characters?.length > 0 && data?.characters?.length > 0) {
          const oldBacking = (prevCached.data.characters as any[]).reduce((s: number, c: any) => s + (c.usdBacking ?? 0), 0);
          const newBacking = (data.characters as any[]).reduce((s: number, c: any) => s + (c.usdBacking ?? 0), 0);
          // If new data lost >50% of total backing, it's a bad fetch — keep old
          if (newBacking < oldBacking * 0.5 && oldBacking > 0) {
            console.warn("[ToT] New data has", Math.round((1 - newBacking / oldBacking) * 100) + "% less backing — keeping cached data");
            data = prevCached.data;
          } else {
            // Per-NFT zero protection: if an NFT had stats but now has all-1s, keep old stats
            const oldMap = new Map((prevCached.data.characters as any[]).map((c: any) => [c.contractAddress?.toLowerCase(), c]));
            for (const c of data.characters) {
              const old = oldMap.get(c.contractAddress?.toLowerCase());
              if (!old) continue;
              const oldTotal = old.stats.str + old.stats.dex + old.stats.con + old.stats.int + old.stats.wis + old.stats.cha;
              const newTotal = c.stats.str + c.stats.dex + c.stats.con + c.stats.int + c.stats.wis + c.stats.cha;
              // If old had real stats (>6 = all 1s) but new is all 1s, keep old
              if (oldTotal > 6 && newTotal <= 6) {
                c.stats = old.stats;
                c.usdBacking = old.usdBacking;
                c.tokenAmounts = old.tokenAmounts;
                c.subtypes = old.subtypes;
              }
            }
          }
        }

        setCachedStats(data);

        // Check ownership — always fresh from chain (fast multicall)
        let ownershipMap = new Map<string, number>();

        async function checkOwnership(client: any, nfts: typeof GAME_NFTS, chainName: string) {
          if (!client || nfts.length === 0) return;
          const accounts = Array(MAX_TOKEN_ID).fill(address) as `0x${string}`[];
          const ids = Array.from({ length: MAX_TOKEN_ID }, (_, i) => BigInt(i + 1));
          const calls = nfts.map((nft) => ({
            address: nft.contractAddress,
            abi: ERC1155_ABI,
            functionName: "balanceOfBatch" as const,
            args: [accounts, ids] as [readonly `0x${string}`[], readonly bigint[]],
          }));
          try {
            const results = await client.multicall({ contracts: calls, allowFailure: true });
            nfts.forEach((nft, i) => {
              const r = results[i];
              if (r.status === "success" && Array.isArray(r.result)) {
                const total = (r.result as bigint[]).reduce((sum: number, b: bigint) => sum + Number(b), 0);
                ownershipMap.set(nft.contractAddress.toLowerCase(), total);
              } else {
                ownershipMap.set(nft.contractAddress.toLowerCase(), 0);
              }
            });
          } catch (e) {
            console.warn(`[ToT] ${chainName} batch ownership check failed, falling back to ID 1:`, e);
            try {
              const fallbackCalls = nfts.map((nft) => ({
                address: nft.contractAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOf" as const,
                args: [address, BigInt(1)] as [`0x${string}`, bigint],
              }));
              const fallbackResults = await client.multicall({ contracts: fallbackCalls, allowFailure: true });
              nfts.forEach((nft, i) => {
                const r = fallbackResults[i];
                ownershipMap.set(nft.contractAddress.toLowerCase(), r.status === "success" ? Number(r.result as bigint) : 0);
              });
            } catch {}
          }
        }

        if (isConnected && address) {
          // Always check chain for fresh ownership (multicall is fast)
          await checkOwnership(baseClient, GAME_NFTS.filter(n => n.chain === "base"), "Base");
          await checkOwnership(polygonClient, GAME_NFTS.filter(n => n.chain === "polygon"), "Polygon");
          // Fall back to cache only if RPC returned nothing
          if (ownershipMap.size === 0) {
            const cachedOwn = getCachedOwnership(address);
            if (cachedOwn) {
              Object.entries(cachedOwn.map).forEach(([k, v]) => ownershipMap.set(k, v));
              console.log("[ToT] RPC failed, using cached ownership");
            }
          } else {
            setCachedOwnership(address, ownershipMap);
            console.log("[ToT] Fresh ownership:", [...ownershipMap.entries()].filter(([,v]) => v > 0).length, "owned NFTs");
          }
        }

        // Backfill: ensure every NFT in GAME_NFTS appears — use last known stats if available
        const dataAddrs = new Set((data.characters ?? []).map((c: any) => c.contractAddress?.toLowerCase()));
        const prevCachedForBackfill = getCachedStats();
        const prevMap = new Map((prevCachedForBackfill?.data?.characters ?? []).map((c: any) => [c.contractAddress?.toLowerCase(), c]));
        for (const nft of GAME_NFTS) {
          if (!dataAddrs.has(nft.contractAddress.toLowerCase())) {
            const prev = prevMap.get(nft.contractAddress.toLowerCase());
            data.characters.push(prev ?? {
              name: nft.name,
              contractAddress: nft.contractAddress,
              chain: nft.chain,
              stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1, ac: 10, atk: 0, speed: 30, lightningDmg: 0, fireDmg: 0 },
              subtypes: [],
              tokenAmounts: [],
              usdBacking: 0,
            });
            console.log("[ToT] Backfilled missing NFT:", nft.name, prev ? "(last known stats)" : "(baseline)");
          }
        }

        // Merge API data with ownership + seller info
        const sellerOwnedSet = new Set((data.sellerOwned ?? []).map((a: string) => a.toLowerCase()));
        const characters: NftCharacter[] = data.characters.map((c: any) => ({
          name: c.name,
          contractAddress: c.contractAddress,
          chain: c.chain ?? "base",
          tokenId: TOKEN_ID,
          metadataUri: c.metadataUri,
          imageUrl: c.imageUrl,
          owned: (ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0) > 0,
          ownedCount: ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0,
          stats: floorStats(c.stats),
          subtypes: c.subtypes ?? [],
          tokenAmounts: c.tokenAmounts ?? [],
          usdBacking: c.usdBacking ?? 0,
          forSale: sellerOwnedSet.has(c.contractAddress.toLowerCase()),
        }));

        setCharacters(characters);
        if (data.assetTotals) setAssetTotals(data.assetTotals);
        if (data.tokenBreakdown) setTokenBreakdown(data.tokenBreakdown);
      } catch (err) {
        console.error("[ToT]", err);
        setError(String(err));
      }

      setLoading(false);

      // Fetch cached images AFTER loading completes (non-blocking)
      try {
        const imgController = new AbortController();
        const imgTimeout = setTimeout(() => imgController.abort(), 8000);
        const imgRes = await fetch("/api/images", { signal: imgController.signal });
        clearTimeout(imgTimeout);
        if (imgRes.ok) {
          const imgData: Record<string, { metadataUri?: string; imageUrl?: string; chain?: string }> = await imgRes.json();
          setCharacters(prev => prev.map(char => {
            const img = imgData[char.contractAddress.toLowerCase()];
            if (!img) return char;
            return {
              ...char,
              metadataUri: img.metadataUri ?? char.metadataUri,
              imageUrl: img.imageUrl ?? char.imageUrl,
              chain: (img.chain as "base" | "polygon") ?? char.chain,
            };
          }));
          console.log("[ToT] Loaded cached images for", Object.keys(imgData).length, "NFTs");
        }
      } catch { /* images optional, cards still show without them */ }
    }

    load();
  }, [address, isConnected, baseClient]);

  // Refresh stats on demand (cache-busting) — use after LP deposits for instant level-up
  async function refreshStats() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      setCachedStats(data); // update local cache with fresh data

      let ownershipMap = new Map<string, number>();
      async function checkOwnership(client: any, nfts: typeof GAME_NFTS, chainName: string) {
        if (!client || nfts.length === 0) return;
        const accounts = Array(MAX_TOKEN_ID).fill(address) as `0x${string}`[];
        const ids = Array.from({ length: MAX_TOKEN_ID }, (_, i) => BigInt(i + 1));
        const calls = nfts.map((nft) => ({
          address: nft.contractAddress, abi: ERC1155_ABI,
          functionName: "balanceOfBatch" as const,
          args: [accounts, ids] as [readonly `0x${string}`[], readonly bigint[]],
        }));
        try {
          const results = await client.multicall({ contracts: calls, allowFailure: true });
          nfts.forEach((nft, i) => {
            const r = results[i];
            if (r.status === "success" && Array.isArray(r.result)) {
              ownershipMap.set(nft.contractAddress.toLowerCase(), (r.result as bigint[]).reduce((sum: number, b: bigint) => sum + Number(b), 0));
            }
          });
        } catch {}
      }
      if (isConnected && address) {
        await checkOwnership(baseClient, GAME_NFTS.filter(n => n.chain === "base"), "Base");
        await checkOwnership(polygonClient, GAME_NFTS.filter(n => n.chain === "polygon"), "Polygon");
        setCachedOwnership(address, ownershipMap);
      }

      const sellerOwnedSet = new Set((data.sellerOwned ?? []).map((a: string) => a.toLowerCase()));
      const updated: NftCharacter[] = data.characters.map((c: any) => ({
        name: c.name, contractAddress: c.contractAddress, chain: c.chain ?? "base",
        tokenId: TOKEN_ID, metadataUri: c.metadataUri, imageUrl: c.imageUrl,
        owned: (ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0) > 0,
        ownedCount: ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0,
        stats: floorStats(c.stats), subtypes: c.subtypes ?? [], tokenAmounts: c.tokenAmounts ?? [], usdBacking: c.usdBacking ?? 0,
        forSale: sellerOwnedSet.has(c.contractAddress.toLowerCase()),
      }));
      setCharacters(updated);
      if (data.assetTotals) setAssetTotals(data.assetTotals);
      if (data.tokenBreakdown) setTokenBreakdown(data.tokenBreakdown);
    } catch (e) { console.warn("[ToT] Refresh failed:", e); }
    setLoading(false);
  }

  return { characters, assetTotals, tokenBreakdown, loading, error, refreshStats };
}
