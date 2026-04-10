"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, parseEther, createPublicClient, http } from "viem";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Avatar, Name, Address } from "@coinbase/onchainkit/identity";
import { supabase } from "@/lib/supabase";

// ── Constants ────────────────────────────────────────────────────────────────

const FACTORY_ADDR = "0x00EEeB923BDe1Af9a3DbBE41cE7a6bFD84BB75A0" as const;

// ── ABIs ─────────────────────────────────────────────────────────────────────

const FACTORY_ABI = [
  { name: "totalVaults", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "allVaults", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  { name: "isCrossChain", type: "function", stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

const VAULT_ABI = [
  { name: "NFT", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "LP_PAIR", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "FEE_BPS", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "COMMUNITY_RECIPIENT", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "userStake", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "tokenStake", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "lockedStake", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalStaked", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalLocked", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "communityPool", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

const CROSSCHAIN_ABI = [
  { name: "NFT_REF", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "tokenOwner", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
] as const;

const ERC1155_ABI = [
  { name: "balanceOfBatch", type: "function", stateMutability: "view",
    inputs: [{ name: "accounts", type: "address[]" }, { name: "ids", type: "uint256[]" }],
    outputs: [{ name: "", type: "uint256[]" }] },
] as const;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "symbol", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

const ERC1155_URI_ABI = [
  { name: "uri", type: "function", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  { name: "name", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

type VaultInfo = {
  address: `0x${string}`;
  nft: `0x${string}`;
  lpPair: `0x${string}`;
  feeBps: number;
  nftName: string;
  lpSymbol: string;
  totalStaked: bigint;
  totalLocked: bigint;
  communityPool: bigint;
  isCrossChain: boolean;
};

type UserNft = {
  vaultIndex: number;
  tokenId: number;
  userStake: bigint;
  tokenStake: bigint;
  lockedStake: bigint;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PowerVaultsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const baseClient = useMemo(() => createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://mainnet.base.org"),
  }), []);

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [userNfts, setUserNfts] = useState<UserNft[]>([]);
  const [selectedNft, setSelectedNft] = useState<UserNft | null>(null);
  const [selectedVaultIdx, setSelectedVaultIdx] = useState<number | null>(null);
  const [manualTokenId, setManualTokenId] = useState("");
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState("");
  const [withdrawPct, setWithdrawPct] = useState(100);
  const [depositAmount, setDepositAmount] = useState("");
  const [lpBalances, setLpBalances] = useState<Record<string, bigint>>({});
  const [manualVaultAddr, setManualVaultAddr] = useState("");

  // ── Load a single vault's info ──
  const loadSingleVault = useCallback(async (va: `0x${string}`, crossChain?: boolean): Promise<VaultInfo | null> => {
    try {
      // Detect cross-chain if not specified: try NFT_REF (only exists on CrossChainVault)
      let isCrossChain = crossChain ?? false;
      if (crossChain === undefined) {
        try {
          await baseClient.readContract({ address: va, abi: CROSSCHAIN_ABI, functionName: "NFT_REF" });
          isCrossChain = true;
        } catch { isCrossChain = false; }
      }

      let nft: `0x${string}`;
      if (isCrossChain) {
        nft = await baseClient.readContract({ address: va, abi: CROSSCHAIN_ABI, functionName: "NFT_REF" }) as `0x${string}`;
      } else {
        nft = await baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "NFT" }) as `0x${string}`;
      }

      const [lpPair, feeBps, totalStaked, totalLocked, communityPool] = await Promise.all([
        baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "LP_PAIR" }),
        baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "FEE_BPS" }),
        baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "totalStaked" }),
        baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "totalLocked" }),
        baseClient.readContract({ address: va, abi: VAULT_ABI, functionName: "communityPool" }),
      ]);

      let nftName = nft.slice(0, 8) + "...";
      let lpSymbol = "LP";
      // Cross-chain: NFT is on another chain, can't read name() on Base
      if (!isCrossChain) {
        try { nftName = await baseClient.readContract({ address: nft, abi: ERC1155_URI_ABI, functionName: "name" }); } catch {}
      } else {
        nftName = "Cross-Chain " + nft.slice(0, 8) + "...";
      }
      try { lpSymbol = await baseClient.readContract({ address: lpPair as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }); } catch {}

      return {
        address: va, nft, lpPair: lpPair as `0x${string}`,
        feeBps: Number(feeBps), nftName, lpSymbol, totalStaked, totalLocked, communityPool, isCrossChain,
      };
    } catch (e) { console.error("loadSingleVault:", va, e); return null; }
  }, [baseClient]);

  // ── Load all vaults from factory + any manually added ──
  const loadVaults = useCallback(async () => {
    try {
      setLoading(true);
      const vaultAddrs: `0x${string}`[] = [];

      // From factory
      const crossChainFlags: boolean[] = [];
      try {
        const count = await baseClient.readContract({
          address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: "totalVaults",
        });
        for (let i = 0; i < Number(count); i++) {
          const [addr, cc] = await Promise.all([
            baseClient.readContract({ address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: "allVaults", args: [BigInt(i)] }),
            baseClient.readContract({ address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: "isCrossChain", args: [BigInt(i)] }),
          ]);
          vaultAddrs.push(addr as `0x${string}`);
          crossChainFlags.push(cc as boolean);
        }
      } catch (e) { console.error("factory load:", e); }

      const infos: VaultInfo[] = [];
      for (let i = 0; i < vaultAddrs.length; i++) {
        const info = await loadSingleVault(vaultAddrs[i], crossChainFlags[i]);
        if (info) infos.push(info);
      }
      setVaults(infos);
    } catch (e) {
      console.error("loadVaults:", e);
    } finally {
      setLoading(false);
    }
  }, [baseClient, loadSingleVault]);

  // ── Add a vault by address ──
  async function addVaultByAddress() {
    const addr = manualVaultAddr.trim() as `0x${string}`;
    if (!addr || addr.length !== 42) return;
    // Don't add duplicates
    if (vaults.some(v => v.address.toLowerCase() === addr.toLowerCase())) {
      setSelectedVaultIdx(vaults.findIndex(v => v.address.toLowerCase() === addr.toLowerCase()));
      return;
    }
    setTxStatus("Loading vault...");
    const info = await loadSingleVault(addr);
    if (info) {
      setVaults(prev => [...prev, info]);
      setSelectedVaultIdx(vaults.length); // select the new one
      setTxStatus("");
    } else {
      setTxStatus("Error: Could not read vault at " + addr);
    }
  }

  // ── Scan user's NFTs across all vault collections ──
  const scanUserNfts = useCallback(async () => {
    if (!address || vaults.length === 0) return;
    const found: UserNft[] = [];
    const balances: Record<string, bigint> = {};

    for (let vi = 0; vi < vaults.length; vi++) {
      const v = vaults[vi];

      // Get user's LP balance for this pair
      try {
        const bal = await baseClient.readContract({
          address: v.lpPair, abi: ERC20_ABI, functionName: "balanceOf", args: [address],
        });
        balances[v.lpPair.toLowerCase()] = bal;
      } catch {}

      if (v.isCrossChain) {
        // Cross-chain: check tokenOwner mapping on vault contract
        // Scan IDs 1-100 in parallel batches of 25
        for (let batch = 0; batch < 4; batch++) {
          const promises = [];
          for (let j = 0; j < 25; j++) {
            const id = batch * 25 + j + 1;
            promises.push(
              baseClient.readContract({
                address: v.address, abi: CROSSCHAIN_ABI, functionName: "tokenOwner", args: [BigInt(id)],
              }).then(owner => ({ id, owner: owner as string })).catch(() => ({ id, owner: "0x0000000000000000000000000000000000000000" }))
            );
          }
          const results = await Promise.all(promises);
          for (const r of results) {
            if (r.owner.toLowerCase() === address.toLowerCase()) {
              const [userStake, tokenStake, lockedStk] = await Promise.all([
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "userStake", args: [BigInt(r.id), address] }),
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "tokenStake", args: [BigInt(r.id)] }),
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "lockedStake", args: [BigInt(r.id)] }),
              ]);
              found.push({ vaultIndex: vi, tokenId: r.id, userStake, tokenStake, lockedStake: lockedStk });
            }
          }
        }
      } else {
        // Same-chain: use balanceOfBatch on the NFT contract
        try {
          const addrs = Array(200).fill(address) as `0x${string}`[];
          const ids = Array.from({ length: 200 }, (_, i) => BigInt(i + 1));
          const bals = await baseClient.readContract({
            address: v.nft, abi: ERC1155_ABI, functionName: "balanceOfBatch",
            args: [addrs, ids],
          });
          for (let i = 0; i < bals.length; i++) {
            if (bals[i] > 0n) {
              const [userStake, tokenStake, lockedStk] = await Promise.all([
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "userStake", args: [BigInt(i + 1), address] }),
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "tokenStake", args: [BigInt(i + 1)] }),
                baseClient.readContract({ address: v.address, abi: VAULT_ABI, functionName: "lockedStake", args: [BigInt(i + 1)] }),
              ]);
              found.push({ vaultIndex: vi, tokenId: i + 1, userStake, tokenStake, lockedStake: lockedStk });
            }
          }
        } catch (e) {
          console.error("scan NFTs for vault", v.address, e);
        }
      }
    }
    setUserNfts(found);
    setLpBalances(balances);
    if (found.length > 0 && !selectedNft) setSelectedNft(found[0]);
  }, [address, vaults, selectedNft, baseClient]);

  useEffect(() => { loadVaults(); }, [loadVaults]);
  useEffect(() => { if (isConnected && address && vaults.length > 0) scanUserNfts(); }, [isConnected, address, vaults, scanUserNfts]);

  // ── Selected vault info ──
  const selVault = selectedVaultIdx !== null ? vaults[selectedVaultIdx] : (selectedNft ? vaults[selectedNft.vaultIndex] : null);
  const withdrawLp = selectedNft && selectedNft.userStake > 0n
    ? (selectedNft.userStake * BigInt(withdrawPct)) / 100n : 0n;
  const selLpBalance = selVault ? (lpBalances[selVault.lpPair.toLowerCase()] ?? 0n) : 0n;

  // Active token ID: from selected NFT or manual input
  const activeTokenId = selectedNft ? selectedNft.tokenId : (manualTokenId ? parseInt(manualTokenId) : null);

  // ── Load stake for manual token ID ──
  async function loadManualStake() {
    if (!address || !selVault || !manualTokenId) return;
    const tid = parseInt(manualTokenId);
    if (isNaN(tid) || tid < 1) return;
    try {
      const [userStake, tokenStake, lockedStk] = await Promise.all([
        baseClient.readContract({ address: selVault.address, abi: VAULT_ABI, functionName: "userStake", args: [BigInt(tid), address] }),
        baseClient.readContract({ address: selVault.address, abi: VAULT_ABI, functionName: "tokenStake", args: [BigInt(tid)] }),
        baseClient.readContract({ address: selVault.address, abi: VAULT_ABI, functionName: "lockedStake", args: [BigInt(tid)] }),
      ]);
      setSelectedNft({ vaultIndex: selectedVaultIdx!, tokenId: tid, userStake, tokenStake, lockedStake: lockedStk });
    } catch (e) {
      console.error("loadManualStake:", e);
    }
  }

  // ── Deposit LP handler ──
  async function handleDeposit() {
    if (!walletClient || !address || !selVault || !depositAmount || activeTokenId === null) return;
    try {
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      // Cross-chain: verify tokenOwner is set to this wallet
      if (selVault.isCrossChain) {
        const owner = await baseClient.readContract({
          address: selVault.address, abi: CROSSCHAIN_ABI, functionName: "tokenOwner", args: [BigInt(activeTokenId)],
        }) as string;
        if (owner.toLowerCase() !== address.toLowerCase()) {
          setTxStatus("Error: Token #" + activeTokenId + " owner not set to your wallet. Ask vault owner to run setTokenOwner.");
          return;
        }
      }

      const amt = parseEther(depositAmount);

      setTxStatus("Approving LP...");
      const allowance = await baseClient.readContract({
        address: selVault.lpPair, abi: ERC20_ABI, functionName: "allowance",
        args: [address, selVault.address],
      });
      if (allowance < amt) {
        const approveTx = await walletClient.writeContract({
          address: selVault.lpPair, abi: ERC20_ABI, functionName: "approve",
          args: [selVault.address, amt * 10n], chain: base,
        });
        await baseClient.waitForTransactionReceipt({ hash: approveTx });
      }

      setTxStatus("Depositing LP to vault...");
      const tx = await walletClient.writeContract({
        address: selVault.address, abi: VAULT_ABI, functionName: "deposit",
        args: [BigInt(activeTokenId), amt], chain: base,
      });
      setTxStatus("Confirming...");
      await baseClient.waitForTransactionReceipt({ hash: tx });
      setTxStatus("Deposited!");
      setDepositAmount("");
      scanUserNfts();
      loadVaults();
      if (manualTokenId) loadManualStake();
    } catch (e: any) {
      setTxStatus("Error: " + (e.shortMessage || e.message));
      console.error(e);
    }
  }

  // ── Withdraw LP handler ──
  async function handleWithdraw() {
    if (!walletClient || !address || !selVault || withdrawLp === 0n || activeTokenId === null) return;
    try {
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      setTxStatus(`Withdrawing ${fmt(withdrawLp)} LP (${withdrawPct}%)...`);
      const tx = await walletClient.writeContract({
        address: selVault.address, abi: VAULT_ABI, functionName: "withdraw",
        args: [BigInt(activeTokenId), withdrawLp], chain: base,
      });
      setTxStatus("Confirming...");
      await baseClient.waitForTransactionReceipt({ hash: tx });
      setTxStatus(`Withdrawn ${fmt(withdrawLp)} LP!`);
      scanUserNfts();
      loadVaults();
      if (manualTokenId) loadManualStake();
    } catch (e: any) {
      setTxStatus("Error: " + (e.shortMessage || e.message));
      console.error(e);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "#0a0608", fontFamily: "'Cinzel', Georgia, serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-widest" style={{ color: "#8b5cf6" }}>
            Power Vaults
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(232,213,176,0.5)" }}>
            Stake LP to power up your NFTs &middot; 0.5% locked forever + 0.5% to community
          </p>
        </div>

        {/* Wallet */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <Wallet>
            <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
            <WalletDropdown>{isConnected && <Address />}<WalletDropdownDisconnect /></WalletDropdown>
          </Wallet>
        </div>

        {/* Load vault by address */}
        <div className="flex gap-2 items-center justify-center mb-6">
          <input type="text" value={manualVaultAddr}
            onChange={e => setManualVaultAddr(e.target.value)}
            placeholder="Paste vault address to load..."
            className="rounded-lg px-3 py-2 text-xs font-mono w-80 text-center"
            style={{ background: "#1a1418", color: "#f0d070", border: "1px solid rgba(139,92,246,0.3)" }}
          />
          <button onClick={addVaultByAddress}
            className="px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: "rgba(139,92,246,0.3)", color: "#c4b5fd", border: "1px solid #8b5cf6" }}>
            Load
          </button>
        </div>

        {loading ? (
          <p className="text-center" style={{ color: "rgba(232,213,176,0.3)" }}>Loading vaults...</p>
        ) : vaults.length === 0 ? (
          <p className="text-center" style={{ color: "rgba(232,213,176,0.3)" }}>No vaults found — paste an address above or create one via factory</p>
        ) : (
          <>
            {/* Vault cards — click to select */}
            <div className="grid gap-3 mb-6">
              {vaults.map((v, i) => (
                <button key={v.address} onClick={() => { setSelectedVaultIdx(i); setSelectedNft(null); setManualTokenId(""); setTxStatus(""); }}
                  className="rounded-xl p-4 text-left transition-all w-full" style={{
                    background: selectedVaultIdx === i ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.06)",
                    border: selectedVaultIdx === i ? "2px solid #8b5cf6" : "1px solid rgba(139,92,246,0.2)",
                    cursor: "pointer",
                  }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: "#f0d070" }}>{v.nftName}</span>
                        {v.isCrossChain && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                            CROSS-CHAIN
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono" style={{ color: "rgba(232,213,176,0.3)" }}>{v.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: "#4ade80" }}>{fmt(v.totalStaked)} {v.lpSymbol}</div>
                      <div className="text-xs" style={{ color: "#c084fc" }}>{fmt(v.totalLocked)} locked</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected vault panel */}
            {selVault && isConnected && (
              <div className="rounded-xl p-6 mb-6" style={{
                background: "rgba(26,20,24,0.8)",
                border: "1px solid rgba(139,92,246,0.2)",
              }}>
                <h2 className="text-xl font-black text-center mb-4" style={{ color: "#c4b5fd" }}>
                  {selVault.nftName}
                </h2>

                {/* Your NFTs in this collection */}
                {userNfts.filter(n => n.vaultIndex === selectedVaultIdx).length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {userNfts.filter(n => n.vaultIndex === selectedVaultIdx).map(nft => (
                      <button key={nft.tokenId}
                        onClick={() => { setSelectedNft(nft); setManualTokenId(""); }}
                        className="px-3 py-1 rounded-lg font-bold text-xs transition-all"
                        style={{
                          background: selectedNft?.tokenId === nft.tokenId ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.03)",
                          border: selectedNft?.tokenId === nft.tokenId ? "2px solid #8b5cf6" : "1px solid rgba(139,92,246,0.15)",
                          color: selectedNft?.tokenId === nft.tokenId ? "#c4b5fd" : "rgba(232,213,176,0.5)",
                        }}>
                        #{nft.tokenId}
                      </button>
                    ))}
                  </div>
                )}

                {/* Manual token ID input */}
                <div className="flex gap-2 items-center justify-center mb-4">
                  <span className="text-xs" style={{ color: "rgba(232,213,176,0.4)" }}>Token ID:</span>
                  <input type="number" value={selectedNft ? selectedNft.tokenId : manualTokenId}
                    onChange={e => { setManualTokenId(e.target.value); setSelectedNft(null); }}
                    className="rounded px-3 py-1 text-sm font-mono w-20 text-center"
                    style={{ background: "#1a1418", color: "#f0d070", border: "1px solid rgba(139,92,246,0.3)" }}
                    placeholder="#"
                  />
                  {manualTokenId && !selectedNft && (
                    <button onClick={loadManualStake}
                      className="px-3 py-1 rounded text-xs font-bold"
                      style={{ background: "rgba(139,92,246,0.3)", color: "#c4b5fd", border: "1px solid #8b5cf6" }}>
                      Load
                    </button>
                  )}
                </div>

                {/* Stats (show when we have a token selected) */}
                {selectedNft && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <StatBox label="Your Staked" value={fmt(selectedNft.userStake)} sub={selVault.lpSymbol} color="#4ade80" />
                    <StatBox label="Total Token Power" value={fmt(selectedNft.tokenStake)} sub={`${selVault.lpSymbol} from all stakers`} color="#f0d070" />
                    <StatBox label="Forever Locked" value={fmt(selectedNft.lockedStake)} sub="Can never be withdrawn" color="#c084fc" />
                    <StatBox label="Total Backing" value={fmt(selectedNft.tokenStake + selectedNft.lockedStake)} sub="Staked + locked" color="#8b5cf6" />
                  </div>
                )}

                {/* Deposit — always visible when vault + token selected */}
                {activeTokenId !== null && (
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="text-center text-xs mb-1" style={{ color: "rgba(232,213,176,0.4)" }}>
                      Wallet: {fmt(selLpBalance)} {selVault.lpSymbol}
                    </div>
                    <div className="flex gap-2 items-center justify-center">
                      <input
                        type="text" value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                        placeholder="LP amount"
                        className="rounded-lg px-3 py-2 text-sm font-mono w-36 text-center"
                        style={{ background: "#1a1418", color: "#f0d070", border: "1px solid rgba(139,92,246,0.3)" }}
                      />
                      <button onClick={() => setDepositAmount(formatEther(selLpBalance))}
                        className="px-3 py-2 rounded text-xs font-bold"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(232,213,176,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        MAX
                      </button>
                      <button onClick={handleDeposit}
                        disabled={!depositAmount}
                        className="px-6 py-2 rounded-lg font-black text-sm transition-all"
                        style={{ background: "rgba(22,163,74,0.8)", color: "#fff", opacity: depositAmount ? 1 : 0.4 }}>
                        Deposit LP
                      </button>
                    </div>

                    {/* Withdraw */}
                    {selectedNft && selectedNft.userStake > 0n && (
                      <div className="flex flex-col items-center gap-2 mt-2">
                        <div className="flex gap-2">
                          {[25, 50, 75, 100].map(pct => (
                            <button key={pct} onClick={() => setWithdrawPct(pct)}
                              className="px-3 py-1 rounded text-xs font-bold transition-all"
                              style={{
                                background: withdrawPct === pct ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.05)",
                                color: withdrawPct === pct ? "#fff" : "rgba(232,213,176,0.5)",
                                border: withdrawPct === pct ? "1px solid #dc2626" : "1px solid rgba(255,255,255,0.1)",
                              }}>
                              {pct}%
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs" style={{ color: "rgba(232,213,176,0.4)" }}>
                            {fmt(withdrawLp)} {selVault.lpSymbol}
                          </span>
                          <button onClick={handleWithdraw}
                            className="px-6 py-2 rounded-lg font-bold text-sm transition-all"
                            style={{ background: "rgba(220,38,38,0.6)", color: "#fff" }}>
                            Withdraw {withdrawPct}%
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {txStatus && (
                  <p className="text-center text-sm mt-3" style={{ color: txStatus.startsWith("Error") ? "#ef4444" : "#8b5cf6" }}>
                    {txStatus}
                  </p>
                )}
              </div>
            )}

            {!isConnected && (
              <p className="text-center mb-6" style={{ color: "rgba(232,213,176,0.3)" }}>Connect wallet to manage your vaults</p>
            )}

            {/* Global Stats */}
            <div className="rounded-xl p-4" style={{
              background: "rgba(26,20,24,0.5)",
              border: "1px solid rgba(139,92,246,0.1)",
            }}>
              <h3 className="text-sm font-bold text-center mb-3" style={{ color: "rgba(139,92,246,0.5)" }}>
                All Vaults
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Total Staked</div>
                  <div className="font-bold text-sm" style={{ color: "#f0d070" }}>
                    {fmt(vaults.reduce((a, v) => a + v.totalStaked, 0n))}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Forever Locked</div>
                  <div className="font-bold text-sm" style={{ color: "#c084fc" }}>
                    {fmt(vaults.reduce((a, v) => a + v.totalLocked, 0n))}
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Vaults</div>
                  <div className="font-bold text-sm" style={{ color: "#8b5cf6" }}>{vaults.length}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-center mt-8">
          <a href="/vaults" className="text-sm font-bold mr-6" style={{ color: "rgba(201,168,76,0.4)" }}>
            Ork Vaults
          </a>
          <a href="/" className="text-sm font-bold" style={{ color: "rgba(201,168,76,0.4)" }}>
            Back to Game
          </a>
        </div>
      </div>
    </main>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="text-xs mb-1" style={{ color: "rgba(232,213,176,0.4)" }}>{label}</div>
      <div className="font-black text-lg" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "rgba(232,213,176,0.3)" }}>{sub}</div>}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: bigint): string {
  const n = Number(formatEther(val));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  if (n < 1) return n.toFixed(6);
  if (n < 1000) return n.toFixed(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
