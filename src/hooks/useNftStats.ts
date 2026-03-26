"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { base, polygon } from "viem/chains";
import { ERC1155_ABI } from "@/lib/contracts";
import { GAME_NFTS } from "@/lib/contracts";
import { ERC721_ABI } from "@/lib/contracts";

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
  stats: { attack: number; mAtk: number; fAtk: number; def: number; mDef: number; hp: number; charMultiplier: number; magicMultiplier: number; mana: number };
  tokenAmounts: TokenAmount[];
};

export function useNftStats() {
  const { address, isConnected } = useAccount();
  const baseClient = usePublicClient({ chainId: base.id });
  const polygonClient = usePublicClient({ chainId: polygon.id });

  const [characters, setCharacters] = useState<NftCharacter[]>([]);
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
        let ownershipMap = new Map<string, boolean>();
        if (isConnected && address && baseClient) {
          try {
            const ownershipCalls = GAME_NFTS.map((nft) => ({
              address: nft.contractAddress,
              abi: ERC1155_ABI,
              functionName: "balanceOf" as const,
              args: [address, TOKEN_ID] as [`0x${string}`, bigint],
            }));
            const results = await baseClient.multicall({ contracts: ownershipCalls, allowFailure: true });
            GAME_NFTS.forEach((nft, i) => {
              const r = results[i];
              ownershipMap.set(nft.contractAddress.toLowerCase(), r.status === "success" && (r.result as bigint) > 0n);
            });
          } catch (e) {
            console.warn("[ToT] Ownership check failed:", e);
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
          owned: ownershipMap.get(c.contractAddress.toLowerCase()) ?? false,
          stats: c.stats,
          tokenAmounts: c.tokenAmounts ?? [],
        }));

        setCharacters(characters);

        // Background: resolve URIs for visible cards (updates incrementally)
        if (baseClient) {
          const URI_BATCH = 20;
          for (let i = 0; i < GAME_NFTS.length; i += URI_BATCH) {
            const batch = GAME_NFTS.slice(i, i + URI_BATCH);
            const uriResults = await Promise.all(batch.map(async (nft) => {
              try { const r = await baseClient.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] }); const raw = (r as string).replace("{id}", TOKEN_ID.toString()); if (raw) return { uri: raw, chain: "base" as const }; } catch {}
              try { const r = await baseClient.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] }); if (r) return { uri: r as string, chain: "base" as const }; } catch {}
              if (polygonClient) {
                try { const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] }); const raw = (r as string).replace("{id}", TOKEN_ID.toString()); if (raw) return { uri: raw, chain: "polygon" as const }; } catch {}
                try { const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] }); if (r) return { uri: r as string, chain: "polygon" as const }; } catch {}
              }
              return null;
            }));
            setCharacters(prev => prev.map((char, idx) => {
              if (idx < i || idx >= i + URI_BATCH) return char;
              const result = uriResults[idx - i];
              if (!result) return char;
              return { ...char, metadataUri: result.uri, chain: result.chain };
            }));
          }
        }
      } catch (err) {
        console.error("[ToT]", err);
        setError(String(err));
      }

      setLoading(false);
    }

    load();
  }, [address, isConnected, baseClient]);

  return { characters, loading, error };
}
