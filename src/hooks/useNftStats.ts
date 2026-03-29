"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { ERC1155_ABI, GAME_NFTS } from "@/lib/contracts";

const TOKEN_ID = BigInt(1);

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
        // Fetch pre-computed stats from API (cached 24h)
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        console.log("[ToT] Loaded stats from API:", data.characters?.length, "NFTs, updated:", data.updatedAt);

        // Check ownership if wallet connected
        let ownershipMap = new Map<string, number>();
        if (isConnected && address) {
          const baseNfts = GAME_NFTS.filter(n => n.chain === "base");
          const polyNfts = GAME_NFTS.filter(n => n.chain === "polygon");

          // Check Base NFT ownership
          if (baseClient && baseNfts.length > 0) {
            try {
              const calls = baseNfts.map((nft) => ({
                address: nft.contractAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOf" as const,
                args: [address, TOKEN_ID] as [`0x${string}`, bigint],
              }));
              const results = await baseClient.multicall({ contracts: calls, allowFailure: true });
              baseNfts.forEach((nft, i) => {
                const r = results[i];
                ownershipMap.set(nft.contractAddress.toLowerCase(), r.status === "success" ? Number(r.result as bigint) : 0);
              });
            } catch (e) {
              console.warn("[ToT] Base ownership check failed:", e);
            }
          }

          // Check Polygon NFT ownership
          if (polygonClient && polyNfts.length > 0) {
            try {
              const calls = polyNfts.map((nft) => ({
                address: nft.contractAddress,
                abi: ERC1155_ABI,
                functionName: "balanceOf" as const,
                args: [address, TOKEN_ID] as [`0x${string}`, bigint],
              }));
              const results = await polygonClient.multicall({ contracts: calls, allowFailure: true });
              polyNfts.forEach((nft, i) => {
                const r = results[i];
                ownershipMap.set(nft.contractAddress.toLowerCase(), r.status === "success" ? Number(r.result as bigint) : 0);
              });
            } catch (e) {
              console.warn("[ToT] Polygon ownership check failed:", e);
            }
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

  return { characters, assetTotals, tokenBreakdown, loading, error };
}
