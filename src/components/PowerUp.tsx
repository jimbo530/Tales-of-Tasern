"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { parseEther } from "viem";
import { base, polygon } from "wagmi/chains";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useNftImage } from "@/hooks/useNftImage";

type Props = {
  characters: NftCharacter[];
  onBack: () => void;
  onStatsRefresh?: () => Promise<void>;
};

const POWERUP_ABI = [{ name: "powerUp", type: "function", stateMutability: "payable", inputs: [{ name: "nftContract", type: "address" }], outputs: [] }] as const;

// Deployed contracts
const CONTRACTS: Record<string, { address: `0x${string}`; abi: readonly any[]; chainId: number }> = {
  // Base (chainId 8453)
  attack:  { address: "0xc0BBFcCab2AAff810b8dB985635d055a3dc47c1C", abi: POWERUP_ABI, chainId: 8453 },
  hp:      { address: "0x46D885122FEa2AfaF3977a71872b35C409a9f6AB", abi: POWERUP_ABI, chainId: 8453 },
  azos:    { address: "0xD7C584D40216576f1d8651Eab8bEF9DE69497666", abi: POWERUP_ABI, chainId: 8453 },
  egp:     { address: "0x79F9208847848Ce4a0CF107d1115aa5a3c5CE849", abi: POWERUP_ABI, chainId: 8453 },
  wethegp: { address: "0x127AE66CdFA262c8A9CBA82F43da2953411D6Cf4", abi: POWERUP_ABI, chainId: 8453 },
  char:    { address: "0x731CA534ab575E21e0847894Cf9EfdD736935a93", abi: POWERUP_ABI, chainId: 8453 },
  burgers: { address: "0xDe76722Ec72F86D64B54DbB11A5c9211FE6FC8FF", abi: POWERUP_ABI, chainId: 8453 },
  // Polygon (chainId 137)
  pol_egpusdglo: { address: "0x627E6a6093403f415051755e3a85D85419cb0aBD", abi: POWERUP_ABI, chainId: 137 },
};
// Alias for backward compat
const BASE_CONTRACTS = CONTRACTS;

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
  { key: "attack", label: "💰 USDGLO", desc: "All 6 scores (split) + CON", tokens: "USDGLO + MfT LP", color: "rgba(251,191,36,0.8)", chain: "base", deployed: true },
  { key: "hp", label: "🌳 TGN", desc: "STR + CON + WIS", tokens: "TGN + MfT LP", color: "rgba(251,113,133,0.8)", chain: "base", deployed: true },
  { key: "azos", label: "💰 AZOS", desc: "All 6 scores (split) + CON", tokens: "AZOS + MfT LP", color: "rgba(74,222,128,0.8)", chain: "base", deployed: true },
  { key: "egp", label: "🌿 EGP", desc: "DEX + INT + WIS + CON", tokens: "EGP + MfT LP", color: "rgba(34,197,94,0.8)", chain: "base", deployed: true },
  { key: "wethegp", label: "⛓️ WETH/EGP", desc: "INT + WIS + CHA + DEX", tokens: "WETH + EGP LP", color: "rgba(96,165,250,0.8)", chain: "base", deployed: true },
  { key: "pol_egpusdglo", label: "🌿💰 EGP/USDGLO", desc: "DEX + INT + WIS + All (split)", tokens: "EGP + USDGLO LP", color: "rgba(167,139,250,0.8)", chain: "polygon", deployed: true },
  { key: "int", label: "⚡ JLT", desc: "Lightning DMG + STR + INT + CHA", tokens: "JLT-F24 + DDD LP", color: "rgba(96,165,250,0.8)", chain: "polygon", deployed: false },
  { key: "wis", label: "🏃 PR24", desc: "Speed + STR + INT + CHA", tokens: "PR24 + DDD LP", color: "rgba(45,212,191,0.8)", chain: "polygon", deployed: false },
  { key: "char", label: "⚔️ CHAR", desc: "ATK bonus + CON", tokens: "CHAR + MfT LP", color: "rgba(167,139,250,0.8)", chain: "base", deployed: true },
  { key: "burgers", label: "🍔 BURGERS", desc: "DEX + CON", tokens: "BURGERS + MfT LP", color: "rgba(251,146,60,0.8)", chain: "base", deployed: true },
];

function HeroPortrait({ character }: { character: NftCharacter }) {
  const { imageUrl, imgFailed, setImgFailed } = useNftImage(character.metadataUri);
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
      </div>
      <h3 className="font-black text-sm tracking-widest uppercase text-gold-shimmer">{character.name}</h3>
      <p className="text-xs" style={{ color: 'rgba(201,168,76,0.4)' }}>
        {character.contractAddress.slice(0, 8)}…{character.contractAddress.slice(-6)}
      </p>
      {character.usdBacking > 0 && (
        <p className="text-xs font-bold" style={{ color: 'rgba(74,222,128,0.8)' }}>
          ${character.usdBacking.toFixed(2)} backing
        </p>
      )}
    </div>
  );
}

export function PowerUp({ characters, onBack, onStatsRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [selectedHero, setSelectedHero] = useState<NftCharacter | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [chainTab, setChainTab] = useState<"base" | "polygon">("base");
  const [showOwned, setShowOwned] = useState(true);

  const owned = characters.filter(c => c.owned);
  const pool = showOwned && owned.length > 0 ? owned : characters;
  const searched = search.trim()
    ? pool.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.contractAddress.toLowerCase().includes(search.toLowerCase()))
    : pool;

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

        {/* Owned / All toggle */}
        <div className="flex gap-2">
          <button onClick={() => setShowOwned(true)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: showOwned ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.03)',
              color: showOwned ? 'rgba(74,222,128,0.9)' : 'rgba(74,222,128,0.4)',
              border: `1px solid ${showOwned ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            My Heroes ({owned.length})
          </button>
          <button onClick={() => setShowOwned(false)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: !showOwned ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.03)',
              color: !showOwned ? '#f0d070' : 'rgba(201,168,76,0.4)',
              border: `1px solid ${!showOwned ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            All ({characters.length})
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
            {searched.map(card => (
              <div key={card.contractAddress} onClick={() => { setSelectedHero(card); setSelectedStat(null); }}
                className="rounded-lg p-2 cursor-pointer transition-all text-center hover:scale-105 relative"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.25)' }}>
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

  // Stat selection + power up — all power-ups available for all heroes regardless of chain
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
          {[
            { key: "str", label: "STR", color: "rgba(251,191,36,0.8)" },
            { key: "dex", label: "DEX", color: "rgba(74,222,128,0.8)" },
            { key: "con", label: "CON", color: "rgba(251,113,133,0.8)" },
            { key: "int", label: "INT", color: "rgba(96,165,250,0.8)" },
            { key: "wis", label: "WIS", color: "rgba(45,212,191,0.8)" },
            { key: "cha", label: "CHA", color: "rgba(167,139,250,0.8)" },
          ].map(s => {
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

      {/* Power-ups with chain tabs */}
      <div className="w-full">
        <div className="flex gap-2 justify-center mb-3">
          <button onClick={() => { setSelectedStat(null); setChainTab("base"); }}
            className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest"
            style={{ background: chainTab === "base" ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)', color: chainTab === "base" ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.4)', border: `1px solid ${chainTab === "base" ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
            ⬡ Base (ETH)
          </button>
          <button onClick={() => { setSelectedStat(null); setChainTab("polygon"); }}
            className="px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest"
            style={{ background: chainTab === "polygon" ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.03)', color: chainTab === "polygon" ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.4)', border: `1px solid ${chainTab === "polygon" ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
            ⬡ Polygon (POL)
          </button>
        </div>

        <div className="w-full rounded-xl p-4" style={{ background: chainTab === "base" ? 'rgba(96,165,250,0.05)' : 'rgba(167,139,250,0.05)', border: `1px solid ${chainTab === "base" ? 'rgba(96,165,250,0.3)' : 'rgba(167,139,250,0.3)'}` }}>
          <p className="text-center mb-3" style={{ color: chainTab === "base" ? 'rgba(96,165,250,0.5)' : 'rgba(167,139,250,0.5)', fontSize: '0.5rem' }}>
            {chainTab === "base" ? "Pay with ETH on Base — switch wallet to Base chain" : "Pay with POL on Polygon — switch wallet to Polygon chain"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {STAT_OPTIONS.filter(s => s.chain === chainTab).map(s => (
              <button key={s.key} onClick={() => s.deployed ? setSelectedStat(s.key) : null}
                className="px-4 py-3 rounded-lg text-left transition-all relative"
                style={{
                  background: selectedStat === s.key ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedStat === s.key ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  opacity: s.deployed ? 1 : 0.5,
                  cursor: s.deployed ? 'pointer' : 'not-allowed',
                }}>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.label}</span>
                {!s.deployed && <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-white font-bold" style={{ fontSize: '0.4rem', background: 'rgba(255,255,255,0.1)' }}>SOON</span>}
                <p style={{ color: 'rgba(232,213,176,0.4)', fontSize: '0.5rem' }}>{s.desc}</p>
                <p style={{ color: 'rgba(201,168,76,0.3)', fontSize: '0.45rem' }}>{s.tokens}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payment */}
      {selectedStat && CONTRACTS[selectedStat] && (
        <PowerUpPayment
          contract={CONTRACTS[selectedStat]}
          nftContract={selectedHero.contractAddress as `0x${string}`}
          heroName={selectedHero.name}
          statLabel={STAT_OPTIONS.find(s => s.key === selectedStat)?.label ?? ""}
          onStatsRefresh={onStatsRefresh}
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

const MAX_ETH = 0.001;

function PowerUpPayment({ contract, nftContract, heroName, statLabel, onStatsRefresh }: {
  contract: { address: `0x${string}`; abi: readonly any[]; chainId: number };
  nftContract: `0x${string}`;
  heroName: string;
  statLabel: string;
  onStatsRefresh?: () => Promise<void>;
}) {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: client, isLoading: walletLoading } = useWalletClient();
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [amount, setAmount] = useState("0.0005");

  const needsChainSwitch = currentChainId !== contract.chainId;
  const chainName = contract.chainId === 137 ? "Polygon" : "Base";

  async function handlePowerUp(amt: string) {
    if (!client) { setStatus("Wallet loading — try again in a moment"); return; }
    setAmount(amt);
    setTxHash(null);

    // Auto-switch chain if needed
    if (currentChainId !== contract.chainId) {
      setStatus(`Switching to ${chainName}...`);
      try {
        await switchChainAsync({ chainId: contract.chainId });
      } catch (e: any) {
        setStatus(`Failed to switch to ${chainName}: ${e.shortMessage ?? e.message}`);
        return;
      }
    }

    setStatus(`Confirm in your wallet — sending ${contract.chainId === 137 ? "POL" : "ETH"}...`);

    try {
      const hash = await client.writeContract({
        address: contract.address,
        abi: contract.abi as any,
        functionName: "powerUp",
        args: [nftContract],
        value: parseEther(amt),
        chain: contract.chainId === 137 ? polygon : base,
      });
      setTxHash(hash);
      setStatus("⚔️ Power up complete! Refreshing stats...");
      if (onStatsRefresh) {
        await onStatsRefresh();
        setStatus("⚔️ Power up complete! Stats updated.");
      } else {
        setStatus("⚔️ Power up complete! Stats will update at midnight UTC.");
      }
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
          {needsChainSwitch && (
            <p className="text-center text-xs font-bold" style={{ color: 'rgba(251,191,36,0.8)' }}>
              Wallet on wrong chain — will auto-switch to {chainName} when you pay
            </p>
          )}
          <p className="text-center text-xs" style={{ color: 'rgba(201,168,76,0.5)' }}>
            Pay with {contract.chainId === 137 ? "POL on Polygon" : "ETH on Base"} — auto-swaps to LP tokens
          </p>

          <div className="flex gap-2 w-full">
            {["0.0005", "0.001", "0.0025"].map(amt => (
              <button key={amt} onClick={() => handlePowerUp(amt)} disabled={walletLoading || !client}
                className="flex-1 px-3 py-3 rounded-lg text-xs font-black uppercase tracking-widest"
                style={{ background: walletLoading ? 'rgba(100,100,100,0.2)' : 'rgba(34,197,94,0.3)', color: walletLoading ? 'rgba(150,150,150,0.5)' : 'rgba(74,222,128,0.9)', border: `1px solid ${walletLoading ? 'rgba(100,100,100,0.3)' : 'rgba(34,197,94,0.5)'}` }}>
                {walletLoading ? '⏳' : `⬆️ ${amt}`}
              </button>
            ))}
          </div>
          <p className="text-center" style={{ fontSize: '0.45rem', color: 'rgba(201,168,76,0.4)' }}>ETH amounts · lower = less slippage</p>

          {status && (
            <p className="text-center text-xs" style={{ color: status.includes("Failed") ? '#f87171' : status.includes("complete") ? '#4ade80' : 'rgba(201,168,76,0.7)' }}>
              {status}
            </p>
          )}
          {txHash && (
            <a href={`${contract.chainId === 137 ? "https://polygonscan.com" : "https://basescan.org"}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-center text-xs hover:underline" style={{ color: 'rgba(96,165,250,0.8)' }}>
              View on {contract.chainId === 137 ? "PolygonScan" : "BaseScan"} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
