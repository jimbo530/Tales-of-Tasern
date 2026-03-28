import { createPublicClient, http } from "viem";
import { base, polygon } from "viem/chains";
import { GAME_NFTS, ERC1155_ABI, ERC721_ABI } from "@/lib/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_ID = BigInt(1);
const baseClient = createPublicClient({ chain: base, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL ?? undefined) });
const polygonClient = createPublicClient({ chain: polygon, transport: http(process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_URL ?? undefined) });

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

function toHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return "https://ipfs.io/ipfs/" + uri.slice(7);
  return uri;
}

async function resolveImage(metadataUri: string): Promise<string | null> {
  const httpUri = toHttp(metadataUri);
  const cid = GATEWAYS.reduce<string | null>((a, gw) => a ?? (httpUri.startsWith(gw) ? httpUri.slice(gw.length) : null), null);
  const urls = cid ? GATEWAYS.map(gw => gw + cid) : [httpUri];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const meta = await res.json();
      if (meta?.image) return toHttp(meta.image as string);
    } catch { continue; }
  }
  return null;
}

async function resolveUri(nft: { contractAddress: `0x${string}` }): Promise<{ uri?: string; chain?: "base" | "polygon" }> {
  try { const r = await baseClient.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] }); const raw = (r as string).replace("{id}", TOKEN_ID.toString()); if (raw) return { uri: raw, chain: "base" }; } catch {}
  try { const r = await baseClient.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] }); if (r) return { uri: r as string, chain: "base" }; } catch {}
  try { const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [TOKEN_ID] }); const raw = (r as string).replace("{id}", TOKEN_ID.toString()); if (raw) return { uri: raw, chain: "polygon" }; } catch {}
  try { const r = await polygonClient.readContract({ address: nft.contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [TOKEN_ID] }); if (r) return { uri: r as string, chain: "polygon" }; } catch {}
  return {};
}

export async function GET() {
  const results: Record<string, { metadataUri?: string; imageUrl?: string; chain?: string }> = {};

  const BATCH = 10;
  for (let i = 0; i < GAME_NFTS.length; i += BATCH) {
    const batch = GAME_NFTS.slice(i, i + BATCH);
    const uris = await Promise.all(batch.map(resolveUri));
    const images = await Promise.all(uris.map(async (u) => {
      if (!u.uri) return null;
      return resolveImage(u.uri);
    }));
    batch.forEach((nft, j) => {
      results[nft.contractAddress.toLowerCase()] = {
        metadataUri: uris[j].uri,
        imageUrl: images[j] ?? undefined,
        chain: uris[j].chain,
      };
    });
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" }, // Cache 7 days
  });
}
