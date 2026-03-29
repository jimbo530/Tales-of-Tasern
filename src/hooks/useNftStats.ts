"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { ERC1155_ABI, GAME_NFTS } from "@/lib/contracts";

const TOKEN_ID = BigInt(1);
const MAX_TOKEN_ID = 200;
const STATS_CACHE_KEY = "tot-stats-cache";
const STATS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
  stats: { attack: number; mAtk: number; fAtk: number; def: number; mDef: number; hp: number; healing: number; charMultiplier: number; magicMultiplier: number; mana: number };
  tokenAmounts: TokenAmount[];
  usdBacking: number;
  forSale: boolean;
};

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
        // Load stats: local file (dev) → localStorage → API
        let data: any;
        let fetched = false;

        // In dev mode, always try local file first (npm run refresh-stats)
        if (process.env.NODE_ENV === "development") {
          try {
            const localRes = await fetch("/stats-cache.json?t=" + Date.now());
            if (localRes.ok) {
              data = await localRes.json();
              fetched = true;
              console.log("[ToT] Loaded from local file (dev mode):", data.characters?.length, "NFTs");
            }
          } catch {}
        }

        // Then check localStorage cache
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

        setCachedStats(data);

        // Check ownership — cached for 24h per wallet
        let ownershipMap = new Map<string, number>();

        if (isConnected && address) {
          const cachedOwn = getCachedOwnership(address);
          if (cachedOwn && (Date.now() - cachedOwn.timestamp) < STATS_CACHE_TTL) {
            Object.entries(cachedOwn.map).forEach(([k, v]) => ownershipMap.set(k, v));
            console.log("[ToT] Using cached ownership (age:", Math.round((Date.now() - cachedOwn.timestamp) / 60000), "min)");
          }
        }

        async function checkOwnership(client: any, nfts: typeof GAME_NFTS, chainName: string) {
          if (!client || nfts.length === 0) return;
          // Build balanceOfBatch calls: one per contract, checking IDs 1-MAX_TOKEN_ID
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
            // Fallback: just check token ID 1
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

        if (isConnected && address && ownershipMap.size === 0) {
          // Only hit RPC if no cached ownership
          await checkOwnership(baseClient, GAME_NFTS.filter(n => n.chain === "base"), "Base");
          await checkOwnership(polygonClient, GAME_NFTS.filter(n => n.chain === "polygon"), "Polygon");
          setCachedOwnership(address, ownershipMap);
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
          stats: c.stats,
          tokenAmounts: c.tokenAmounts ?? [],
          usdBacking: c.usdBacking ?? 0,
          forSale: sellerOwnedSet.has(c.contractAddress.toLowerCase()),
        }));

        setCharacters(characters);
        if (data.assetTotals) setAssetTotals(data.assetTotals);
        if (data.tokenBreakdown) setTokenBreakdown(data.tokenBreakdown);

        // Fetch cached images from API (7-day cache, much faster than per-card IPFS)
        try {
          const imgRes = await fetch("/api/images");
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
      } catch (err) {
        console.error("[ToT]", err);
        setError(String(err));
      }

      setLoading(false);
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
        stats: c.stats, tokenAmounts: c.tokenAmounts ?? [], usdBacking: c.usdBacking ?? 0,
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
