"use client";

import { useState, useEffect } from "react";
import { StatBar } from "./StatBar";
import type { NftCharacter } from "@/hooks/useNftStats";

type Props = {
  character: NftCharacter;
  maxStats: { attack: number; mAtk: number; fAtk: number; def: number; mDef: number; hp: number; mana: number };
  selectable?: boolean;
  selected?: 1 | 2 | null;
  onSelect?: () => void;
};

const STAT_META: Record<string, { label: string; color: string }> = {
  attack:         { label: "⚔️ ATK",   color: "rgba(251,191,36,0.9)"  },
  mAtk:           { label: "⚡ EATK",  color: "rgba(250,204,21,0.9)"  },
  fAtk:           { label: "🔥 FATK",  color: "rgba(251,146,60,0.9)"  },
  def:            { label: "🛡️ DEF",  color: "rgba(148,163,184,0.9)" },
  mDef:           { label: "🛡️ MDEF", color: "rgba(45,212,191,0.9)"  },
  hp:             { label: "❤️ HP",    color: "rgba(251,113,133,0.9)" },
  charMultiplier: { label: "♦ CHAR×",  color: "rgba(167,139,250,0.9)" },
  magicBoost:     { label: "✦ MAG×",   color: "rgba(236,72,153,0.9)"  },
  mana:           { label: "💧 MANA",  color: "rgba(96,165,250,0.9)"  },
};

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

function toHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return GATEWAYS[0] + uri.slice(7);
  return uri;
}

function ipfsCidUrls(uri: string): string[] {
  const cid = GATEWAYS.reduce<string | null>(
    (a, gw) => a ?? (uri.startsWith(gw) ? uri.slice(gw.length) : null), null
  );
  if (cid) return GATEWAYS.map((gw) => gw + cid);
  if (uri.startsWith("ipfs://")) return GATEWAYS.map((gw) => gw + uri.slice(7));
  return [uri];
}

async function fetchFirstOk(urls: string[]): Promise<Response> {
  return Promise.any(
    urls.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(15000) }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r;
      })
    )
  );
}

async function resolveImage(metadataUri: string): Promise<string | null> {
  try {
    const urls = ipfsCidUrls(metadataUri);
    console.log("[img] fetching metadata from", urls[0]);
    const res = await fetchFirstOk(urls);
    const meta = await res.json();
    if (!meta?.image) { console.warn("[img] no image field in metadata"); return null; }
    const imageUrl = toHttp(meta.image as string);
    console.log("[img] resolved:", imageUrl);
    return imageUrl;
  } catch (e) {
    console.warn("[img] resolveImage FAILED for", metadataUri, e);
    return null;
  }
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1)         return n.toFixed(2);
  return n.toFixed(4);
}

export function CharacterCard({ character, maxStats, selectable, selected, onSelect }: Props) {
  const { name, metadataUri, stats, contractAddress, tokenId, owned, tokenAmounts } = character;
  const multiplier = 1 + stats.charMultiplier;
  const magicMult = 1 + stats.magicMultiplier;
  const attack = stats.attack * multiplier;
  const mAtk = stats.mAtk * multiplier * magicMult;
  const fAtk = stats.fAtk * multiplier;
  const def = stats.def * multiplier;
  const hp = stats.hp * multiplier;
  const mana = stats.mana * multiplier;
  const hasSpecial = mAtk > 0 || fAtk > 0;
  // Mana folds into MDEF if no special, otherwise it's an offensive stat shown in battle only
  const mDef = (stats.mDef * multiplier * magicMult) + (hasSpecial ? 0 : mana);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    console.log("[card]", name, "metadataUri:", metadataUri);
    if (!metadataUri) { setImgFailed(true); return; }
    let cancelled = false;
    resolveImage(toHttp(metadataUri)).then((url) => {
      if (cancelled) return;
      if (url) setImageUrl(url);
      else setImgFailed(true);
    });
    return () => { cancelled = true; };
  }, [metadataUri]);

  const borderColor = owned ? 'rgba(201,168,76,0.5)' : 'rgba(120,120,140,0.25)';
  const cardBg = owned
    ? 'linear-gradient(160deg, #130d10 0%, #0d0a12 100%)'
    : 'linear-gradient(160deg, #0c0b0e 0%, #09080f 100%)';

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: cardBg,
    border: `1px solid ${borderColor}`,
  };

  const corners = (
    <>
      <div className="absolute top-0 left-0 w-5 h-5 border-t border-l z-10 rounded-tl-xl" style={{ borderColor }} />
      <div className="absolute top-0 right-0 w-5 h-5 border-t border-r z-10 rounded-tr-xl" style={{ borderColor }} />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l z-10 rounded-bl-xl" style={{ borderColor }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r z-10 rounded-br-xl" style={{ borderColor }} />
    </>
  );

  return (
    <div
      className="relative w-56 cursor-pointer select-none"
      style={{
        perspective: '1000px',
        height: '520px',
        opacity: owned ? 1 : 0.6,
        outline: selected ? '2px solid rgba(220,38,38,0.8)' : undefined,
        outlineOffset: '2px',
        boxShadow: selected ? '0 0 20px rgba(220,38,38,0.3)' : undefined,
      }}
      onClick={() => selectable && onSelect ? onSelect() : setFlipped(f => !f)}
      title={flipped ? "Click to flip back" : "Click to see token amounts"}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>

        {/* ── FRONT ─────────────────────────────────────────────────────── */}
        <div style={faceBase}>
          {corners}

          {/* Selection badge */}
          {selected && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black"
                style={{ background: 'rgba(220,38,38,0.8)', color: 'white', boxShadow: '0 0 20px rgba(220,38,38,0.5)' }}>
                {selected}
              </div>
            </div>
          )}

          {/* Owned badge */}
          <div className="absolute top-2 right-2 z-20 text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-widest"
            style={owned
              ? { background: 'rgba(10,6,8,0.9)', color: 'rgba(201,168,76,0.95)', border: '1px solid rgba(201,168,76,0.4)' }
              : { background: 'rgba(10,6,8,0.9)', color: 'rgba(150,150,170,0.6)', border: '1px solid rgba(150,150,170,0.15)' }}>
            {owned ? '✦' : '○'}
          </div>

          {/* Flip hint */}
          <div className="absolute top-2 left-2 z-20" style={{ color: 'rgba(201,168,76,0.25)', fontSize: '0.5rem' }}>
            flip ↺
          </div>

          {/* Image */}
          <div className="relative w-full flex-shrink-0" style={{ minHeight: '120px', background: '#0a0810' }}>
            {imgFailed ? (
              <div className="flex items-center justify-center py-8 opacity-20">
                <span className="text-3xl">🛡️</span>
              </div>
            ) : imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={name}
                className="w-full"
                style={{ maxHeight: '150px', objectFit: 'contain' }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: 'rgba(201,168,76,0.7)' }} />
              </div>
            )}
          </div>

          {/* Name */}
          <div className="px-3 pt-2 pb-1 text-center flex-shrink-0">
            <h2 className={`font-black text-xs tracking-widest uppercase leading-tight${owned ? " text-gold-shimmer" : ""}`}
              style={owned ? undefined : { color: 'rgba(200,190,210,0.7)' }}>
              {name}
            </h2>
            <a
              href={`https://opensea.io/item/${character.chain === 'polygon' ? 'matic' : 'base'}/${contractAddress}/${tokenId.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest hover:opacity-100"
              style={{ background: 'rgba(59,130,246,0.15)', color: 'rgba(96,165,250,0.8)', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.5rem', opacity: 0.7 }}>
              🔗 OpenSea
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 my-1.5 px-3 flex-shrink-0">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${borderColor})` }} />
            <span style={{ color: borderColor, fontSize: '0.5rem' }}>✦</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${borderColor})` }} />
          </div>

          {/* Stats */}
          <div className="px-3 pb-3 flex flex-col gap-1.5 flex-shrink-0">
            {stats.charMultiplier > 0 && (
              <div className="flex items-center justify-between px-2 py-0.5 rounded"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <span className="text-xs font-bold" style={{ color: 'rgba(167,139,250,0.8)' }}>♦</span>
                <span className="text-xs font-black" style={{ color: '#a78bfa' }}>×{multiplier.toFixed(3)}</span>
              </div>
            )}
            {stats.magicMultiplier > 0 && (
              <div className="flex items-center justify-between px-2 py-0.5 rounded"
                style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)' }}>
                <span className="text-xs tracking-widest uppercase font-bold" style={{ color: 'rgba(236,72,153,0.8)', fontSize: '0.55rem' }}>✦ MAG ×</span>
                <span className="text-xs font-black" style={{ color: '#ec4899' }}>×{magicMult.toFixed(3)}</span>
              </div>
            )}
            <StatBar label="⚔️ ATK"   value={attack} max={maxStats.attack} color="bg-amber-500" />
            {mAtk > 0 && (
              <StatBar label="⚡ EATK"  value={mAtk}   max={maxStats.mAtk}   color="bg-purple-500" />
            )}
            {fAtk > 0 && (
              <StatBar label="🔥 FATK"  value={fAtk}   max={maxStats.fAtk}   color="bg-orange-500" />
            )}
            <StatBar label="❤️ HP"    value={hp}     max={maxStats.hp}     color="bg-rose-600" />
            {def > 0 && (
              <StatBar label="🛡️ DEF"   value={def}    max={maxStats.def}    color="bg-slate-400" />
            )}
            {mDef > 0 && (
              <StatBar label="🛡️ MDEF"  value={mDef}   max={maxStats.mDef}   color="bg-teal-500" />
            )}
          </div>
        </div>

        {/* ── BACK ──────────────────────────────────────────────────────── */}
        <div style={{ ...faceBase, transform: 'rotateY(180deg)' }}>
          {corners}

          {/* Header */}
          <div className="px-3 pt-4 pb-2 text-center flex-shrink-0">
            <h2 className={`font-black text-xs tracking-widest uppercase leading-tight${owned ? " text-gold-shimmer" : ""}`}
              style={owned ? undefined : { color: 'rgba(200,190,210,0.7)' }}>
              {name}
            </h2>
            <p style={{ color: 'rgba(201,168,76,0.35)', fontSize: '0.55rem' }} className="mt-0.5 tracking-widest uppercase">
              Token Holdings
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-2 px-3 flex-shrink-0">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${borderColor})` }} />
            <span style={{ color: borderColor, fontSize: '0.5rem' }}>✦</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${borderColor})` }} />
          </div>

          {/* Token list */}
          <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1.5">
            {tokenAmounts.length === 0 ? (
              <p className="text-center text-xs mt-6" style={{ color: 'rgba(200,190,210,0.3)' }}>
                No LP positions found
              </p>
            ) : (
              tokenAmounts.map(({ symbol, amount, stat }) => {
                const meta = STAT_META[stat];
                return (
                  <div key={symbol}
                    className="flex items-center justify-between px-2 py-1.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs" style={{ color: meta.color }}>
                        {symbol}
                      </span>
                      <span style={{ color: 'rgba(200,190,210,0.3)', fontSize: '0.5rem' }}>
                        {meta.label}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold" style={{ color: 'rgba(232,213,176,0.85)' }}>
                      {formatAmount(amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 mt-2 flex-shrink-0 text-center"
            style={{ borderTop: `1px solid rgba(201,168,76,0.1)` }}>
            <a
              href={character.chain === 'polygon'
                ? `https://polygonscan.com/address/${contractAddress}`
                : `https://basescan.org/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-widest hover:opacity-100"
              style={{ background: 'rgba(34,197,94,0.15)', color: 'rgba(74,222,128,0.8)', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.5rem', opacity: 0.7 }}>
              🔍 View on {character.chain === 'polygon' ? 'PolygonScan' : 'BaseScan'}
            </a>
            <p style={{ color: 'rgba(201,168,76,0.15)', fontSize: '0.45rem' }} className="font-mono tracking-widest mt-1">
              {contractAddress.slice(0, 10)}…{contractAddress.slice(-6)}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
