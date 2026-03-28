"use client";

import { useState, useMemo } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useNftImage } from "@/hooks/useNftImage";

type Props = {
  characters: NftCharacter[];
  onBack: () => void;
};

const SELLER_ADDRESS = "0x0780b1456D5E60CF26C8Cd6541b85E805C8c05F2";

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return "$0";
}

function formatMft(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function MarketCard({ character }: { character: NftCharacter }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri);
  const usdBacking = (character as any).usdBacking ?? 0;
  const s = character.stats;
  const hasStats = s.attack > 0 || s.hp > 0 || s.def > 0 || s.mAtk > 0 || s.fAtk > 0;

  return (
    <div className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{ background: 'linear-gradient(160deg, #130d10 0%, #0d0a12 100%)', border: '1px solid rgba(201,168,76,0.3)', width: '200px' }}>

      {/* Image */}
      <div style={{ height: '140px', background: '#0a0810' }}>
        {imgFailed || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <span className="text-3xl">🛡️</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={character.name} className="w-full h-full object-contain"
            onError={() => setImgFailed(true)} />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-black text-xs tracking-widest uppercase truncate text-gold-shimmer">
          {character.name}
        </h3>

        {/* Stats summary */}
        {hasStats && (
          <div className="flex flex-wrap gap-1 mt-1" style={{ fontSize: '0.45rem', color: 'rgba(232,213,176,0.5)' }}>
            {s.attack > 0 && <span>⚔️{s.attack.toFixed(1)}</span>}
            {s.hp > 0 && <span>❤️{s.hp.toFixed(1)}</span>}
            {s.def > 0 && <span>🛡️{s.def.toFixed(1)}</span>}
            {s.mAtk > 0 && <span>⚡{s.mAtk.toFixed(1)}</span>}
            {s.fAtk > 0 && <span>🔥{s.fAtk.toFixed(1)}</span>}
          </div>
        )}

        {/* USD backing */}
        <div className="mt-2 px-2 py-1 rounded text-center"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="text-xs font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
            {formatUsd(usdBacking)}
          </p>
          <p style={{ color: 'rgba(34,197,94,0.4)', fontSize: '0.4rem' }}>
            Token backing (24h high)
          </p>
        </div>

        {/* Buy button */}
        <div className="mt-2 flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert(`Purchase coming soon!\n\n${character.name}\nBacking: ${formatUsd(usdBacking)}\n\nThis feature is in beta.`);
            }}
            className="w-full px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.25)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', fontSize: '0.55rem' }}>
            Buy with MfT
          </button>
        </div>
      </div>
    </div>
  );
}

export function Marketplace({ characters, onBack }: Props) {
  const [sortBy, setSortBy] = useState<"price-low" | "price-high" | "name">("price-high");

  // Only show NFTs owned by the approved seller
  const forSale = useMemo(() => {
    return characters.filter(c => c.forSale);
  }, [characters]);

  const sorted = useMemo(() => {
    const list = [...forSale];
    const usd = (c: NftCharacter) => (c as any).usdBacking ?? 0;
    if (sortBy === "price-low") return list.sort((a, b) => usd(a) - usd(b));
    if (sortBy === "price-high") return list.sort((a, b) => usd(b) - usd(a));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [forSale, sortBy]);

  const totalUsd = sorted.reduce((s, c) => s + ((c as any).usdBacking ?? 0), 0);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl mx-auto">
      <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
        style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        ⚜ Marketplace ⚜
      </h2>
      <p className="text-sm text-center" style={{ color: 'rgba(201,168,76,0.5)' }}>
        Heroes for sale — priced at daily high of token backing. Pay with MfT at daily low.
      </p>

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <span className="text-sm font-black" style={{ color: 'rgba(74,222,128,0.9)' }}>
          {sorted.length} heroes · Total backing: {formatUsd(totalUsd)}
        </span>
        <span className="text-xs" style={{ color: 'rgba(201,168,76,0.3)' }}>
          Seller: {SELLER_ADDRESS.slice(0, 6)}…{SELLER_ADDRESS.slice(-4)}
        </span>
      </div>

      {/* Sort controls */}
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

      {/* Beta notice */}
      <div className="px-4 py-2 rounded-lg text-center"
        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
        <p className="text-xs" style={{ color: 'rgba(167,139,250,0.8)' }}>
          🧪 Beta — Prices based on 24h high of LP backing assets. MfT price uses daily low. Updates at midnight UTC.
        </p>
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-4 justify-center">
        {sorted.map(c => (
          <MarketCard key={c.contractAddress} character={c} />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="text-sm mt-8" style={{ color: 'rgba(201,168,76,0.4)' }}>
          No heroes available yet. Check back soon.
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
