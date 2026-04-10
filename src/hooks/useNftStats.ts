"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { ERC1155_ABI, GAME_NFTS } from "@/lib/contracts";
import { supabase } from "@/lib/supabase";
import { computeD20Stats, DEFAULT_BOON_FIELDS } from "@/lib/computeD20Stats";

const TOKEN_ID = BigInt(1);
const MAX_TOKEN_ID = 200;
const STATS_CACHE_KEY = "tot-stats-cache-v2"; // v2: D20 ability scores
const STATS_CACHE_TTL = 48 * 60 * 60 * 1000; // 48 hours — markets are slow, reduce API calls

const OWNERSHIP_CACHE_KEY = "tot-ownership-cache";
const OWNERSHIP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — avoid hitting Alchemy on every page load

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

/** Fetch chain data from nft_backing, compute D20 stats client-side */
async function fetchFromSupabase(): Promise<any | null> {
  try {
    const { data: backingRows, error } = await supabase
      .from("nft_backing")
      .select("key, data");

    if (error || !backingRows || backingRows.length === 0) return null;

    // First pass: extract summary (includes tokenUsdPrices for stat computation)
    let assetTotals = { traditional: 0, game: 0, impact: 0 };
    let tokenBreakdown: any[] = [];
    let tokenUsdPrices: Record<string, number> = {};
    const nftRows: typeof backingRows = [];

    for (const r of backingRows) {
      if (r.key === "__summary__") {
        assetTotals = r.data?.assetTotals ?? assetTotals;
        tokenBreakdown = r.data?.tokenBreakdown ?? tokenBreakdown;
        tokenUsdPrices = r.data?.tokenUsdPrices ?? {};
      } else {
        nftRows.push(r);
      }
    }

    if (nftRows.length === 0) return null;

    // Compute D20 stats client-side from chain data + prices
    const characters = nftRows.map((r: any) => {
      const backing = r.data;
      const amounts = backing.tokenAmounts ?? [];
      const { stats, subtypes, boons } = computeD20Stats(amounts, tokenUsdPrices);
      return {
        name: backing.name ?? r.key,
        contractAddress: backing.contractAddress ?? r.key,
        chain: backing.chain ?? "base",
        stats,
        subtypes,
        boons,
        usdBacking: backing.usdBacking ?? 0,
        tokenAmounts: amounts,
      };
    });

    return { characters, assetTotals, tokenBreakdown };
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
  stats: import("@/lib/computeD20Stats").D20Stats;
  subtypes: string[];
  boons: import("@/lib/boons").Boon[];
  tokenAmounts: TokenAmount[];
  usdBacking: number;
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

        // Priority 1: Supabase nft_backing (chain data + client-side D20 stat computation)
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
          // Use cached ownership if fresh enough (saves Alchemy calls on repeated page loads)
          const cachedOwn = getCachedOwnership(address);
          if (cachedOwn && (Date.now() - cachedOwn.timestamp) < OWNERSHIP_CACHE_TTL) {
            Object.entries(cachedOwn.map).forEach(([k, v]) => ownershipMap.set(k, v));
            console.log("[ToT] Using cached ownership (age:", Math.round((Date.now() - cachedOwn.timestamp) / 1000), "s)");
          } else {
            // Cache expired or missing — fetch fresh from chain
            await checkOwnership(baseClient, GAME_NFTS.filter(n => n.chain === "base"), "Base");
            await checkOwnership(polygonClient, GAME_NFTS.filter(n => n.chain === "polygon"), "Polygon");
            if (ownershipMap.size === 0 && cachedOwn) {
              // RPC failed, fall back to stale cache
              Object.entries(cachedOwn.map).forEach(([k, v]) => ownershipMap.set(k, v));
              console.log("[ToT] RPC failed, using stale cached ownership");
            } else if (ownershipMap.size > 0) {
              setCachedOwnership(address, ownershipMap);
              console.log("[ToT] Fresh ownership:", [...ownershipMap.entries()].filter(([,v]) => v > 0).length, "owned NFTs");
            }
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
              stats: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1, ac: 10, naturalArmor: 0, atk: 0, speed: 30, lightningDmg: 0, fireDmg: 0, ...DEFAULT_BOON_FIELDS },
              subtypes: [],
              boons: [],
              tokenAmounts: [],
              usdBacking: 0,
            });
            console.log("[ToT] Backfilled missing NFT:", nft.name, prev ? "(last known stats)" : "(baseline)");
          }
        }

        // Merge API data with ownership
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
          boons: c.boons ?? [],
          tokenAmounts: c.tokenAmounts ?? [],
          usdBacking: c.usdBacking ?? 0,
        }));

        setCharacters(characters);
        if (data.assetTotals) setAssetTotals(data.assetTotals);
        if (data.tokenBreakdown) setTokenBreakdown(data.tokenBreakdown);
      } catch (err) {
        console.error("[ToT]", err);
        setError(String(err));
      }

      setLoading(false);

      // Load images: localStorage cache first (instant), then /api/images in background
      try {
        type ImgEntry = { metadataUri?: string; imageUrl?: string; chain?: string };
        const IMG_CACHE_KEY = "tot_nft_images";

        // 1. Apply cached images immediately
        const cachedImgRaw = localStorage.getItem(IMG_CACHE_KEY);
        let imgData: Record<string, ImgEntry> = cachedImgRaw ? JSON.parse(cachedImgRaw) : {};
        if (Object.keys(imgData).length > 0) {
          setCharacters(prev => prev.map(char => {
            const img = imgData[char.contractAddress.toLowerCase()];
            if (!img?.imageUrl) return char;
            return { ...char, metadataUri: img.metadataUri ?? char.metadataUri, imageUrl: img.imageUrl, chain: (img.chain as "base" | "polygon") ?? char.chain };
          }));
          console.log("[ToT] Applied cached images for", Object.keys(imgData).length, "NFTs");
        }

        // 2. Refresh from API in background (non-blocking)
        const imgController = new AbortController();
        const imgTimeout = setTimeout(() => imgController.abort(), 8000);
        const imgRes = await fetch("/api/images", { signal: imgController.signal });
        clearTimeout(imgTimeout);
        if (imgRes.ok) {
          const freshImgData: Record<string, ImgEntry> = await imgRes.json();
          // Merge with existing cache (keep old entries for NFTs not in fresh response)
          imgData = { ...imgData, ...freshImgData };
          localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(imgData));
          setCharacters(prev => prev.map(char => {
            const img = imgData[char.contractAddress.toLowerCase()];
            if (!img?.imageUrl) return char;
            return { ...char, metadataUri: img.metadataUri ?? char.metadataUri, imageUrl: img.imageUrl, chain: (img.chain as "base" | "polygon") ?? char.chain };
          }));
          console.log("[ToT] Refreshed images for", Object.keys(freshImgData).length, "NFTs");
        }
      } catch { /* images optional */ }
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

      const updated: NftCharacter[] = data.characters.map((c: any) => ({
        name: c.name, contractAddress: c.contractAddress, chain: c.chain ?? "base",
        tokenId: TOKEN_ID, metadataUri: c.metadataUri, imageUrl: c.imageUrl,
        owned: (ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0) > 0,
        ownedCount: ownershipMap.get(c.contractAddress.toLowerCase()) ?? 0,
        stats: floorStats(c.stats), subtypes: c.subtypes ?? [], boons: c.boons ?? [], tokenAmounts: c.tokenAmounts ?? [], usdBacking: c.usdBacking ?? 0,
      }));
      setCharacters(updated);
      if (data.assetTotals) setAssetTotals(data.assetTotals);
      if (data.tokenBreakdown) setTokenBreakdown(data.tokenBreakdown);
    } catch (e) { console.warn("[ToT] Refresh failed:", e); }
    setLoading(false);
  }

  return { characters, assetTotals, tokenBreakdown, loading, error, refreshStats };
}
