"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { parseEther } from "viem";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useNftImage } from "@/hooks/useNftImage";

type Props = {
  characters: NftCharacter[];
  onBack: () => void;
};

// Deployed contracts on Base
const BASE_CONTRACTS: Record<string, { address: `0x${string}`; abi: readonly any[] }> = {
  attack: {
    address: "0xc0BBFcCab2AAff810b8dB985635d055a3dc47c1C",
    abi: [{ name: "powerUp", type: "function", stateMutability: "payable", inputs: [{ name: "nftContract", type: "address" }], outputs: [] }] as const,
  },
  hp: {
    address: "0x46D885122FEa2AfaF3977a71872b35C409a9f6AB",
    abi: [{ name: "powerUp", type: "function", stateMutability: "payable", inputs: [{ name: "nftContract", type: "address" }], outputs: [] }] as const,
  },
};

type StatOption = {
  key: string;
  label: string;
  desc: string;
  tokens: string;
  color: string;
  chain: "base" | "polygon" | "both";
  deployed: boolean;
};

const STAT_OPTIONS: StatOption[] = [
  { key: "attack", label: "⚔️ ATK", desc: "Physical attack power", tokens: "USDGLO + MfT LP", color: "rgba(251,191,36,0.8)", chain: "base", deployed: true },
  { key: "hp", label: "❤️ HP", desc: "Hit points via TGN", tokens: "TGN + MfT LP", color: "rgba(251,113,133,0.8)", chain: "base", deployed: true },
  { key: "def", label: "🛡️ DEF", desc: "Physical defense", tokens: "TB01 + DDD LP", color: "rgba(148,163,184,0.8)", chain: "polygon", deployed: false },
  { key: "mAtk", label: "⚡ EATK", desc: "Electric attack", tokens: "JLT-F24 + DDD LP", color: "rgba(192,132,252,0.8)", chain: "polygon", deployed: false },
  { key: "fAtk", label: "🔥 FATK", desc: "Fire attack", tokens: "LANTERN + DDD LP", color: "rgba(251,146,60,0.8)", chain: "polygon", deployed: false },
  { key: "mDef", label: "🛡️ MDEF", desc: "Magic defense", tokens: "PR24 + DDD LP", color: "rgba(45,212,191,0.8)", chain: "polygon", deployed: false },
  { key: "mana", label: "💧 SP.ATK", desc: "Special attack / magic def", tokens: "NCT + DDD LP", color: "rgba(96,165,250,0.8)", chain: "polygon", deployed: false },
  { key: "charMultiplier", label: "♦ Multiplier", desc: "Boosts all stats", tokens: "CHAR + USDC LP", color: "rgba(167,139,250,0.8)", chain: "polygon", deployed: false },
];

function HeroPortrait({ character }: { character: NftCharacter }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri);
  const chainColor = character.chain === "base" ? "rgba(96,165,250,0.8)" : "rgba(167,139,250,0.8)";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl overflow-hidden relative" style={{ width: 120, height: 120, background: '#0a0810' }}>
        {imgFailed || !imageUrl ? (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <span className="text-4xl">🛡️</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt={character.name} className="w-full h-full object-contain"
            onError={() => setImgFailed(true)} />
        )}
        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-white font-bold"
          style={{ fontSize: '0.45rem', background: character.chain === "base" ? 'rgba(37,99,235,0.8)' : 'rgba(124,58,237,0.8)' }}>
          {character.chain === "base" ? "BASE" : "POL"}
        </span>
      </div>
      <h3 className="font-black text-sm tracking-widest uppercase text-gold-shimmer">{character.name}</h3>
      <p className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
        {character.contractAddress.slice(0, 8)}…{character.contractAddress.slice(-6)}
      </p>
      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: chainColor, background: character.chain === "base" ? 'rgba(37,99,235,0.15)' : 'rgba(124,58,237,0.15)', border: `1px solid ${chainColor}` }}>
        {character.chain === "base" ? "⬡ Base Chain" : "⬡ Polygon Chain"}
      </span>
      {character.usdBacking > 0 && (
        <p className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>
          ${character.usdBacking.toFixed(2)} backing
        </p>
      )}
    </div>
  );
}

export function PowerUp({ characters, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [selectedHero, setSelectedHero] = useState<NftCharacter | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<"all" | "base" | "polygon">("all");

  const owned = characters.filter(c => c.owned);
  const pool = owned.length > 0 ? owned : characters;
  const searched = search.trim()
    ? pool.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.contractAddress.toLowerCase().includes(search.toLowerCase()))
    : pool;
  const filtered = chainFilter === "all" ? searched : searched.filter(c => c.chain === chainFilter);

  const baseCount = searched.filter(c => c.chain === "base").length;
  const polCount = searched.filter(c => c.chain === "polygon").length;

  const floatingBack = (
    <button onClick={selectedHero ? () => { setSelectedHero(null); setSelectedStat(null); setSearch(""); } : onBack}
      className="fixed top-20 left-4 z-50 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
      style={{ background: 'rgba(10,6,8,0.95)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.5)', boxShadow: '0 0 15px rgba(0,0,0,0.5)', fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
      ⚜ ← Back ⚜
    </button>
  );

  // Hero selection
  if (!selectedHero) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-3xl mx-auto">
        {floatingBack}
        <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
          style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
          ⚜ Power Up ⚜
        </h2>
        <p className="text-sm" style={{ color: 'rgba(201,168,76,0.5)' }}>
          Choose a hero to power up. LP deposits boost their stats permanently.
        </p>

        {/* Chain filter tabs */}
        <div className="flex gap-2">
          <button onClick={() => setChainFilter("all")}
            className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: chainFilter === "all" ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.03)',
              color: chainFilter === "all" ? '#f0d070' : 'rgba(201,168,76,0.4)',
              border: `1px solid ${chainFilter === "all" ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            All ({baseCount + polCount})
          </button>
          <button onClick={() => setChainFilter("base")}
            className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: chainFilter === "base" ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.03)',
              color: chainFilter === "base" ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.4)',
              border: `1px solid ${chainFilter === "base" ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            ⬡ Base ({baseCount})
          </button>
          <button onClick={() => setChainFilter("polygon")}
            className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: chainFilter === "polygon" ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
              color: chainFilter === "polygon" ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.4)',
              border: `1px solid ${chainFilter === "polygon" ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            ⬡ Polygon ({polCount})
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hero by name or address..."
          className="w-full max-w-md px-4 py-2 rounded-lg text-sm text-center"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }}
        />

        <div className="w-full max-h-[50vh] overflow-y-auto rounded-lg p-3"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.1)' }}>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {filtered.map(card => (
              <div key={card.contractAddress} onClick={() => { setSelectedHero(card); setSelectedStat(null); }}
                className="rounded-lg p-2 cursor-pointer transition-all text-center hover:scale-105 relative"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.chain === "base" ? 'rgba(37,99,235,0.25)' : 'rgba(124,58,237,0.25)'}` }}>
                <span className="absolute top-0.5 right-0.5 px-1 rounded text-white font-bold"
                  style={{ fontSize: '0.4rem', background: card.chain === "base" ? 'rgba(37,99,235,0.7)' : 'rgba(124,58,237,0.7)' }}>
                  {card.chain === "base" ? "B" : "P"}
                </span>
                <p className="text-xs font-bold truncate" style={{ color: 'rgba(232,213,176,0.7)', fontSize: '0.5rem' }}>
                  {card.name}
                </p>
                {card.usdBacking > 0 && (
                  <p style={{ color: 'rgba(74,222,128,0.6)', fontSize: '0.45rem' }}>${card.usdBacking.toFixed(2)}</p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  const heroChain = selectedHero.chain;
  const chainColor = heroChain === "base" ? "rgba(96,165,250" : "rgba(167,139,250";
  const chainName = heroChain === "base" ? "Base" : "Polygon";

  // Filter stat options relevant to this hero's chain
  const baseStats = STAT_OPTIONS.filter(s => s.chain === "base" || s.chain === "both");
  const polStats = STAT_OPTIONS.filter(s => s.chain === "polygon" || s.chain === "both");
  const relevantStats = heroChain === "base" ? baseStats : polStats;
  const otherStats = heroChain === "base" ? polStats : baseStats;

  // Stat selection + power up
  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
      {floatingBack}
      <h2 className="text-xl font-black tracking-widest text-gold-shimmer uppercase"
        style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        ⚜ Power Up ⚜
      </h2>

      <HeroPortrait character={selectedHero} />

      {/* Current stats */}
      <div className="w-full rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.15)' }}>
        <p className="text-center text-xs tracking-widest uppercase mb-3" style={{ color: 'rgba(201,168,76,0.4)' }}>Current Stats</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAT_OPTIONS.map(s => {
            const val = (selectedHero.stats as any)[s.key] ?? 0;
            return (
              <div key={s.key} className="text-center px-2 py-1.5 rounded"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-bold" style={{ color: s.color }}>{s.label}</p>
                <p className="text-xs font-mono" style={{ color: 'rgba(232,213,176,0.7)' }}>
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val > 0 ? val.toFixed(2) : "0"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available power-ups for this chain */}
      <div className="w-full rounded-xl p-4" style={{ background: `${chainColor},0.05)`, border: `1px solid ${chainColor},0.3)` }}>
        <p className="text-center text-sm font-bold tracking-widest uppercase mb-1" style={{ color: `${chainColor},0.9)` }}>
          {heroChain === "base" ? "⬡" : "⬡"} {chainName} Power-Ups
        </p>
        <p className="text-center mb-3" style={{ color: `${chainColor},0.4)`, fontSize: '0.5rem' }}>
          {heroChain === "base" ? "Pay with ETH on Base — auto-swaps to LP tokens" : "Polygon contracts coming soon"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {relevantStats.map(s => (
            <button key={s.key} onClick={() => s.deployed ? setSelectedStat(s.key) : null}
              className="px-4 py-3 rounded-lg text-left transition-all relative"
              style={{
                background: selectedStat === s.key ? `${chainColor},0.15)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedStat === s.key ? `${chainColor},0.5)` : 'rgba(255,255,255,0.08)'}`,
                opacity: s.deployed ? 1 : 0.5,
                cursor: s.deployed ? 'pointer' : 'not-allowed',
              }}>
              <span className="text-sm font-bold" style={{ color: s.color }}>{s.label}</span>
              {!s.deployed && (
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-white font-bold"
                  style={{ fontSize: '0.4rem', background: 'rgba(255,255,255,0.1)' }}>
                  SOON
                </span>
              )}
              <p style={{ color: 'rgba(232,213,176,0.4)', fontSize: '0.5rem' }}>{s.desc}</p>
              <p style={{ color: `${chainColor},0.3)`, fontSize: '0.45rem' }}>Requires: {s.tokens}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Other chain stats (dimmed, informational) */}
      {otherStats.length > 0 && (
        <div className="w-full rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-center text-xs tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {heroChain === "base" ? "⬡ Polygon" : "⬡ Base"} Power-Ups
          </p>
          <p className="text-center mb-3" style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.45rem' }}>
            Available for {heroChain === "base" ? "Polygon" : "Base"} heroes only
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherStats.map(s => (
              <div key={s.key} className="px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', opacity: 0.4 }}>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.label}</span>
                <p style={{ color: 'rgba(232,213,176,0.3)', fontSize: '0.45rem' }}>{s.tokens}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment */}
      {selectedStat && heroChain === "base" && BASE_CONTRACTS[selectedStat] && (
        <PowerUpPayment
          contract={BASE_CONTRACTS[selectedStat]}
          nftContract={selectedHero.contractAddress as `0x${string}`}
          heroName={selectedHero.name}
          statLabel={STAT_OPTIONS.find(s => s.key === selectedStat)?.label ?? ""}
        />
      )}

      <button onClick={onBack}
        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
        ← Back to Home
      </button>
    </div>
  );
}

function PowerUpPayment({ contract, nftContract, heroName, statLabel }: {
  contract: { address: `0x${string}`; abi: readonly any[] };
  nftContract: `0x${string}`;
  heroName: string;
  statLabel: string;
}) {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handlePowerUp() {
    if (!walletClient || !amount || parseFloat(amount) <= 0) return;
    setStatus("Confirm in your wallet — sending ETH...");
    setTxHash(null);

    try {
      const hash = await walletClient.writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "powerUp",
        args: [nftContract],
        value: parseEther(amount),
      });
      setTxHash(hash);
      setStatus("⚔️ Power up complete! Stats will update at midnight UTC.");
    } catch (e: any) {
      setStatus("Failed: " + (e.shortMessage ?? e.message));
    }
  }

  return (
    <div className="w-full rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
      <p className="text-center text-sm font-bold mb-3" style={{ color: '#f0d070' }}>
        Power Up {heroName}&apos;s {statLabel}
      </p>

      {!isConnected ? (
        <p className="text-center text-xs" style={{ color: 'rgba(220,38,38,0.7)' }}>Connect wallet first</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-xs" style={{ color: 'rgba(201,168,76,0.5)' }}>Pay with ETH on Base — auto-swaps to LP tokens</p>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount of ETH to spend"
            className="w-full px-4 py-2 rounded-lg text-sm text-center"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)', outline: 'none' }}
          />

          <div className="flex gap-2 justify-center">
            {["0.001", "0.005", "0.01", "0.05"].map(a => (
              <button key={a} onClick={() => setAmount(a)}
                className="px-3 py-1 rounded text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.15)' }}>
                {a} ETH
              </button>
            ))}
          </div>

          <button onClick={handlePowerUp}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full px-6 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(34,197,94,0.3)', color: 'rgba(74,222,128,0.9)', border: '1px solid rgba(34,197,94,0.5)', opacity: amount && parseFloat(amount) > 0 ? 1 : 0.4 }}>
            ⬆️ Power Up with {amount || "0"} ETH
          </button>

          {status && (
            <p className="text-center text-xs" style={{ color: status.includes("Failed") ? '#f87171' : status.includes("complete") ? '#4ade80' : 'rgba(201,168,76,0.7)' }}>
              {status}
            </p>
          )}
          {txHash && (
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-center text-xs hover:underline" style={{ color: 'rgba(96,165,250,0.8)' }}>
              View on BaseScan ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
