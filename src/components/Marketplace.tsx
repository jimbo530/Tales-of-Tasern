"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useNftImage } from "@/hooks/useNftImage";
import { listNft, cancelListing, getActiveListings, type Listing } from "@/lib/supabase";
import { STORY_NPCS } from "@/lib/adventureData";

type Props = {
  characters: NftCharacter[];
  onBack: () => void;
};

const PLATFORM_MARKUP = 0.05; // 5% markup kept by platform
const SELLER_ADDRESS = "0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2";

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return "$0";
}

function MarketCard({ character, isOwner, isListed, onList, onCancel }: {
  character: NftCharacter; isOwner: boolean; isListed: boolean;
  onList: () => void; onCancel: () => void;
}) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri);
  const backing = character.usdBacking ?? 0;
  const price = backing * (1 + PLATFORM_MARKUP);
  const s = character.stats;
  const hasStats = s.attack > 0 || s.hp > 0 || s.def > 0 || s.mAtk > 0 || s.fAtk > 0;

  return (
    <div className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{ background: 'linear-gradient(160deg, #130d10 0%, #0d0a12 100%)', border: '1px solid rgba(201,168,76,0.3)', width: '200px' }}>
      <div style={{ height: '140px', background: '#0a0810' }}>
        {imgFailed || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center opacity-20"><span className="text-3xl">🛡️</span></div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={character.name} className="w-full h-full object-contain" onError={() => setImgFailed(true)} />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-black text-xs tracking-widest uppercase truncate text-gold-shimmer">{character.name}</h3>
        {hasStats && (
          <div className="flex flex-wrap gap-1 mt-1" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
            {s.attack > 0 && <span>⚔️{s.attack.toFixed(1)}</span>}
            {s.hp > 0 && <span>❤️{s.hp.toFixed(1)}</span>}
            {s.def > 0 && <span>🛡️{s.def.toFixed(1)}</span>}
          </div>
        )}
        <div className="mt-2 px-2 py-1 rounded text-center"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="text-xs font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>{formatUsd(price)}</p>
          <p style={{ color: 'rgba(34,197,94,0.4)', fontSize: '0.4rem' }}>
            {formatUsd(backing)} backing + 5% fee
          </p>
        </div>
        <div className="mt-2">
          {isOwner && !isListed && (
            <button onClick={onList}
              className="w-full px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest"
              style={{ background: 'rgba(201,168,76,0.25)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', fontSize: '0.55rem' }}>
              List for Sale
            </button>
          )}
          {isOwner && isListed && (
            <button onClick={onCancel}
              className="w-full px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)', fontSize: '0.55rem' }}>
              Cancel Listing
            </button>
          )}
          {!isOwner && isListed && (
            <button onClick={() => alert(`Purchase coming soon!\n\n${character.name}\nPrice: ${formatUsd(price)} in MfT\n\nListing does not guarantee sale.\nThis feature is in beta.`)}
              className="w-full px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest"
              style={{ background: 'rgba(34,197,94,0.25)', color: 'rgba(74,222,128,0.9)', border: '1px solid rgba(34,197,94,0.5)', fontSize: '0.55rem' }}>
              Buy with MfT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Marketplace({ characters, onBack }: Props) {
  const { address } = useAccount();
  const [sortBy, setSortBy] = useState<"price-low" | "price-high" | "name">("price-high");
  const [search, setSearch] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [tab, setTab] = useState<"buy" | "sell">("buy");

  // Load listings
  useEffect(() => {
    getActiveListings().then(setListings);
  }, []);

  const listedAddrs = new Set(listings.map(l => l.nft_address));

  // For sale: seller-owned + community listings
  const forSale = useMemo(() => {
    return characters.filter(c => {
      if (STORY_NPCS.has(c.contractAddress.toLowerCase())) return false;
      const hasValue = c.usdBacking > 0;
      const isSellerOwned = c.forSale;
      const isCommunityListed = listedAddrs.has(c.contractAddress.toLowerCase());
      return hasValue && (isSellerOwned || isCommunityListed);
    });
  }, [characters, listedAddrs]);

  // My NFTs (for sell tab)
  const myNfts = useMemo(() => {
    return characters.filter(c => c.owned && c.usdBacking > 0);
  }, [characters]);

  const searched = useMemo(() => {
    const pool = tab === "buy" ? forSale : myNfts;
    if (!search.trim()) return pool;
    return pool.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [tab === "buy" ? forSale : myNfts, search, tab]);

  const sorted = useMemo(() => {
    const list = [...searched];
    const price = (c: NftCharacter) => (c.usdBacking ?? 0) * (1 + PLATFORM_MARKUP);
    if (sortBy === "price-low") return list.sort((a, b) => price(a) - price(b));
    if (sortBy === "price-high") return list.sort((a, b) => price(b) - price(a));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [searched, sortBy]);

  const totalUsd = forSale.reduce((s, c) => s + (c.usdBacking ?? 0) * (1 + PLATFORM_MARKUP), 0);

  async function handleList(nftAddress: string) {
    if (!address) { alert("Connect wallet first"); return; }
    const result = await listNft(nftAddress, address);
    if (result) {
      setListings(prev => [...prev, result]);
    }
  }

  async function handleCancel(nftAddress: string) {
    if (!address) return;
    const ok = await cancelListing(nftAddress, address);
    if (ok) {
      setListings(prev => prev.filter(l => l.nft_address !== nftAddress.toLowerCase() || l.status !== "active"));
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl mx-auto relative">
      {/* Floating back button */}
      <button onClick={onBack}
        className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
        style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        ⚜ ← Back ⚜
      </button>

      <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
        style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        ⚜ Marketplace ⚜
      </h2>

      {/* Tabs */}
      <div className="flex gap-3">
        <button onClick={() => setTab("buy")}
          className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
          style={tab === "buy"
            ? { background: 'rgba(201,168,76,0.25)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }
            : { background: 'rgba(255,255,255,0.03)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.1)' }}>
          🛒 Buy Heroes
        </button>
        <button onClick={() => setTab("sell")}
          className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
          style={tab === "sell"
            ? { background: 'rgba(201,168,76,0.25)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }
            : { background: 'rgba(255,255,255,0.03)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.1)' }}>
          📤 Sell My NFTs
        </button>
      </div>

      {tab === "buy" && (
        <>
          <p className="text-sm text-center" style={{ color: 'rgba(201,168,76,0.5)' }}>
            Auto-priced at daily LP backing + 5% fee. Listing does not guarantee sale.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="text-sm font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
              {sorted.length} heroes · Total: {formatUsd(totalUsd)}
            </span>
          </div>
        </>
      )}

      {tab === "sell" && (
        <p className="text-sm text-center" style={{ color: 'rgba(201,168,76,0.5)' }}>
          {address ? `List your owned NFTs for sale. Price = LP backing + 5% platform fee.` : "Connect wallet to list your NFTs."}
        </p>
      )}

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search heroes..."
        className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
        style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }} />

      {/* Sort (buy tab only) */}
      {tab === "buy" && (
        <div className="flex gap-2">
          {(["price-high", "price-low", "name"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-widest"
              style={sortBy === s
                ? { background: 'rgba(201,168,76,0.25)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)' }
                : { background: 'rgba(255,255,255,0.03)', color: 'rgba(201,168,76,0.4)', border: '1px solid rgba(201,168,76,0.1)' }}>
              {s === "price-low" ? "Cheapest" : s === "price-high" ? "Most Valuable" : "A-Z"}
            </button>
          ))}
        </div>
      )}

      {/* Beta notice */}
      <div className="px-4 py-2 rounded-lg text-center"
        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <p className="text-xs" style={{ color: 'rgba(167,139,250,0.8)' }}>
          🧪 Beta — Prices update daily at midnight UTC. Listing does not guarantee sale. 5% platform fee on all sales.
        </p>
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map(c => {
          const isOwner = address ? c.owned : false;
          const isListed = c.forSale || listedAddrs.has(c.contractAddress.toLowerCase());
          return (
            <MarketCard key={c.contractAddress} character={c}
              isOwner={isOwner} isListed={isListed}
              onList={() => handleList(c.contractAddress)}
              onCancel={() => handleCancel(c.contractAddress)} />
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-sm mt-8" style={{ color: 'rgba(201,168,76,0.4)' }}>
          {tab === "sell" ? "Connect wallet and own NFTs to list them." : "No heroes listed yet."}
        </p>
      )}

      <button onClick={onBack}
        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest mt-4"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ← Back
      </button>
    </div>
  );
}
