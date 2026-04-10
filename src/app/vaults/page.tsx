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

const ORK_NFT = "0xCd43D8eB17736bFDBd8862B7E03b6B5a4ad476A2" as const;
const LP_PAIR = "0xa2A61fD7816951A0bCf8C67eA8f153C1AB5De288" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
const MFT = "0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3" as const;
const BURGERS = "0x06A05043eb2C1691b19c2C13219dB9212269dDc5" as const;

// Deployed vault contracts
const VAULT_ADDR = "0x3dd06514e93887324667208b25bA5811bCB4A95f" as const;
const ROUTER_ADDR = "0x9A9a82EfdCB0903613bBcb78257B38DcBdC8C62f" as const;

// USDGLO/MfT pair on Base — used to get MfT price in USD
const USDGLO_MFT_PAIR = "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84" as const;
// USDGLO (stablecoin, 18 decimals)
const USDGLO = "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3" as const;

// ── ABIs ─────────────────────────────────────────────────────────────────────

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
  { name: "totalSupply", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const VAULT_ABI = [
  { name: "userStake", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "tokenStake", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "communityPool", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalStaked", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "deposit", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

const PAIR_ABI = [
  { name: "getReserves", type: "function", stateMutability: "view",
    inputs: [], outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ] },
  { name: "totalSupply", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "token0", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

const ROUTER_ABI = [
  { name: "powerUp", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "wethAmount", type: "uint256" }, { name: "tokenId", type: "uint256" }], outputs: [] },
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

type OrkVaultData = {
  tokenId: number;
  userStake: bigint;
  totalStake: bigint;
};

type PoolInfo = {
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  token0: string;
  mftPriceUsd: number;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VaultsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  // Base-only public client — created inside component to avoid SSR issues
  const baseClient = useMemo(() => createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_ALCHEMY_BASE_URL || "https://mainnet.base.org"),
  }), []);

  const [debugMsg, setDebugMsg] = useState("");

  const [ownedOrks, setOwnedOrks] = useState<number[]>([]);
  const [selectedOrk, setSelectedOrk] = useState<number | null>(null);
  const [vaultData, setVaultData] = useState<OrkVaultData | null>(null);
  const [communityPool, setCommunityPool] = useState<bigint>(0n);
  const [totalVaultStaked, setTotalVaultStaked] = useState<bigint>(0n);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [wethBalance, setWethBalance] = useState<bigint>(0n);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [depositAmt, setDepositAmt] = useState("0.001");
  const [withdrawPct, setWithdrawPct] = useState(100);
  const [entryData, setEntryData] = useState<{ totalLp: number; totalEth: number } | null>(null);

  // ── Scan owned Orks ──
  const scanOrks = useCallback(async () => {
    if (!address) return;
    try {
      setDebugMsg("Scanning Orks for " + address.slice(0,8) + "...");
      const addrs = Array(200).fill(address) as `0x${string}`[];
      const ids = Array.from({ length: 200 }, (_, i) => BigInt(i + 1));
      const bals = await baseClient.readContract({
        address: ORK_NFT, abi: ERC1155_ABI, functionName: "balanceOfBatch",
        args: [addrs, ids],
      });
      // Filter out multi-edition tokens (Ork #1 has 50 copies — shared IDs are a vault risk)
      const BLOCKED_IDS = new Set([1]);
      const owned: number[] = [];
      for (let i = 0; i < bals.length; i++) {
        if (bals[i] > 0n && !BLOCKED_IDS.has(i + 1)) owned.push(i + 1);
      }
      setOwnedOrks(owned);
      if (owned.length > 0 && !selectedOrk) setSelectedOrk(owned[0]);
      setDebugMsg("Found " + owned.length + " Orks: " + owned.join(", "));
    } catch (e: any) {
      console.error("Ork scan failed:", e);
      setDebugMsg("Ork scan error: " + (e.shortMessage || e.message));
    }
  }, [address, selectedOrk, baseClient]);

  // ── Load pool info (reserves, supply) + MfT price from stablecoin pair ──
  const loadPoolInfo = useCallback(async () => {
    try {
      const [reserves, supply, t0, gloMftReserves, gloMftT0] = await Promise.all([
        baseClient.readContract({ address: LP_PAIR, abi: PAIR_ABI, functionName: "getReserves" }),
        baseClient.readContract({ address: LP_PAIR, abi: PAIR_ABI, functionName: "totalSupply" }),
        baseClient.readContract({ address: LP_PAIR, abi: PAIR_ABI, functionName: "token0" }),
        baseClient.readContract({ address: USDGLO_MFT_PAIR, abi: PAIR_ABI, functionName: "getReserves" }),
        baseClient.readContract({ address: USDGLO_MFT_PAIR, abi: PAIR_ABI, functionName: "token0" }),
      ]);

      // Derive MfT price in USD from USDGLO/MfT pair
      const gloIsToken0 = gloMftT0.toLowerCase() === USDGLO.toLowerCase();
      const gloReserve = Number(formatEther(gloIsToken0 ? gloMftReserves[0] : gloMftReserves[1]));
      const mftReserve = Number(formatEther(gloIsToken0 ? gloMftReserves[1] : gloMftReserves[0]));
      const mftPriceUsd = mftReserve > 0 ? gloReserve / mftReserve : 0;

      setPoolInfo({
        reserve0: reserves[0], reserve1: reserves[1],
        totalSupply: supply, token0: t0.toLowerCase(),
        mftPriceUsd,
      });
    } catch (e: any) {
      console.error("Pool info failed:", e);
      setDebugMsg(prev => prev + " | Pool error: " + (e.shortMessage || e.message));
    }
  }, [baseClient]);

  // ── Load vault data for selected Ork ──
  const loadVaultData = useCallback(async () => {
    if (!address || selectedOrk === null) return;
    try {
      const [userSt, tokenSt, community, totalSt] = await Promise.all([
        baseClient.readContract({
          address: VAULT_ADDR, abi: VAULT_ABI, functionName: "userStake",
          args: [BigInt(selectedOrk), address],
        }),
        baseClient.readContract({
          address: VAULT_ADDR, abi: VAULT_ABI, functionName: "tokenStake",
          args: [BigInt(selectedOrk)],
        }),
        baseClient.readContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: "communityPool" }),
        baseClient.readContract({ address: VAULT_ADDR, abi: VAULT_ABI, functionName: "totalStaked" }),
      ]);
      setVaultData({ tokenId: selectedOrk, userStake: userSt, totalStake: tokenSt });
      setCommunityPool(community);
      setTotalVaultStaked(totalSt);
    } catch (e) {
      console.error("Vault data failed:", e);
      setVaultData({ tokenId: selectedOrk, userStake: 0n, totalStake: 0n });
    }
  }, [address, selectedOrk, baseClient]);

  // ── Load wallet balances ──
  const loadBalances = useCallback(async () => {
    if (!address) return;
    try {
      const [weth, lp] = await Promise.all([
        baseClient.readContract({ address: WETH, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
        baseClient.readContract({ address: LP_PAIR, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
      ]);
      setWethBalance(weth);
      setLpBalance(lp);
    } catch (e: any) {
      console.error("Balance load failed:", e);
      setDebugMsg(prev => prev + " | Balance error: " + (e.shortMessage || e.message));
    }
  }, [address, baseClient]);

  // ── Load entry value from Supabase ──
  const loadEntryData = useCallback(async () => {
    if (!address || selectedOrk === null) return;
    try {
      const { data } = await supabase
        .from("vault_entries")
        .select("total_lp_deposited, total_eth_deposited")
        .eq("wallet", address.toLowerCase())
        .eq("token_id", selectedOrk)
        .eq("vault_address", VAULT_ADDR.toLowerCase())
        .single();
      if (data) {
        setEntryData({ totalLp: Number(data.total_lp_deposited), totalEth: Number(data.total_eth_deposited) });
      } else {
        setEntryData(null);
      }
    } catch {
      setEntryData(null);
    }
  }, [address, selectedOrk]);

  // ── Load pool info on mount (public data, no wallet needed) ──
  useEffect(() => {
    loadPoolInfo();
  }, [loadPoolInfo]);

  // ── Load wallet-dependent data ──
  useEffect(() => {
    if (isConnected && address) {
      scanOrks();
      loadBalances();
    }
  }, [isConnected, address, scanOrks, loadBalances]);

  // ── Load vault data + entry data when ork changes ──
  useEffect(() => {
    if (selectedOrk !== null) {
      loadVaultData();
      loadEntryData();
    }
  }, [selectedOrk, loadVaultData, loadEntryData]);

  // ── Computed values ──
  const lpPerTokenValue = poolInfo && poolInfo.totalSupply > 0n
    ? computeLpValue(poolInfo)
    : null;

  const userStakeUsd = vaultData && lpPerTokenValue
    ? Number(formatEther(vaultData.userStake)) * lpPerTokenValue.perLpUsd
    : 0;

  const totalOrkUsd = vaultData && lpPerTokenValue
    ? Number(formatEther(vaultData.totalStake)) * lpPerTokenValue.perLpUsd
    : 0;

  const communityUsd = lpPerTokenValue
    ? Number(formatEther(communityPool)) * lpPerTokenValue.perLpUsd
    : 0;

  const communityShare = ownedOrks.length > 0 && communityPool > 0n
    ? communityPool / BigInt(200) // split across all 200 possible tokens
    : 0n;

  const communityShareUsd = lpPerTokenValue
    ? Number(formatEther(communityShare)) * lpPerTokenValue.perLpUsd
    : 0;

  const totalVaultUsd = lpPerTokenValue
    ? Number(formatEther(totalVaultStaked)) * lpPerTokenValue.perLpUsd
    : 0;

  const walletLpUsd = lpPerTokenValue
    ? Number(formatEther(lpBalance)) * lpPerTokenValue.perLpUsd
    : 0;

  // Entry value / P&L (tracked in ETH — what users actually pay/receive)
  const totalEthIn = entryData?.totalEth ?? null;

  // Withdraw amount from percentage
  const withdrawLp = vaultData && vaultData.userStake > 0n
    ? (vaultData.userStake * BigInt(withdrawPct)) / 100n : 0n;

  // Rough APY from V2 fee share (0.3% of volume)
  const estimatedApy = poolInfo ? estimateApy(poolInfo) : null;

  // ── Power Up handler ──
  async function handlePowerUp() {
    if (!walletClient || !address || selectedOrk === null) return;
    try {
      setTxStatus("Switching to Base...");
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      const wethAmt = parseEther(depositAmt);
      setTxStatus("Approving WETH for Router...");
      const allowance = await baseClient.readContract({
        address: WETH, abi: ERC20_ABI, functionName: "allowance",
        args: [address, ROUTER_ADDR],
      });
      if (allowance < wethAmt) {
        const approveTx = await walletClient.writeContract({
          address: WETH, abi: ERC20_ABI, functionName: "approve",
          args: [ROUTER_ADDR, wethAmt * 10n], chain: base,
        });
        setTxStatus("Waiting for approval...");
        await baseClient.waitForTransactionReceipt({ hash: approveTx });
      }

      setTxStatus("Power Up: WETH -> MfT -> BURGERS+MfT -> LP -> Vault...");
      const tx = await walletClient.writeContract({
        address: ROUTER_ADDR, abi: ROUTER_ABI, functionName: "powerUp",
        args: [wethAmt, BigInt(selectedOrk)], chain: base,
      });
      setTxStatus("Confirming...");
      await baseClient.waitForTransactionReceipt({ hash: tx });
      setTxStatus("Power Up complete!");

      // Save ETH entry to Supabase
      const ethAmt = Number(depositAmt);
      const key = { wallet: address.toLowerCase(), token_id: selectedOrk, vault_address: VAULT_ADDR.toLowerCase() };
      const { data: existing } = await supabase
        .from("vault_entries")
        .select("total_lp_deposited, total_eth_deposited")
        .eq("wallet", key.wallet).eq("token_id", key.token_id).eq("vault_address", key.vault_address)
        .single();
      // Read new LP from chain to get actual amount deposited
      const newStake = await baseClient.readContract({
        address: VAULT_ADDR, abi: VAULT_ABI, functionName: "userStake",
        args: [BigInt(selectedOrk), address],
      });
      const newLp = Number(formatEther(newStake));
      const prevLp = existing ? Number(existing.total_lp_deposited) : 0;
      const prevEth = existing ? Number(existing.total_eth_deposited) : 0;
      await supabase.from("vault_entries").upsert({
        ...key,
        total_lp_deposited: prevLp + (newLp - (vaultData?.userStake ? Number(formatEther(vaultData.userStake)) : 0)),
        total_eth_deposited: prevEth + ethAmt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "wallet,token_id,vault_address" });

      loadVaultData();
      loadBalances();
      loadPoolInfo();
      loadEntryData();
    } catch (e: any) {
      setTxStatus("Error: " + (e.shortMessage || e.message));
      console.error(e);
    }
  }

  // ── Withdraw handler (fractional) ──
  async function handleWithdraw() {
    if (!walletClient || !address || !vaultData || vaultData.userStake === 0n || withdrawLp === 0n) return;
    try {
      setTxStatus("Switching to Base...");
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      const amt = withdrawLp;
      setTxStatus(`Withdrawing ${fmt(amt)} LP (${withdrawPct}%)...`);
      const tx = await walletClient.writeContract({
        address: VAULT_ADDR, abi: VAULT_ABI, functionName: "withdraw",
        args: [BigInt(selectedOrk!), amt], chain: base,
      });
      setTxStatus("Confirming withdrawal...");
      await baseClient.waitForTransactionReceipt({ hash: tx });
      setTxStatus(`Withdrawn ${fmt(amt)} LP!`);
      loadVaultData();
      loadBalances();
      loadPoolInfo();
      loadEntryData();
    } catch (e: any) {
      setTxStatus("Error: " + (e.shortMessage || e.message));
      console.error(e);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "#0a0608", fontFamily: "'Cinzel', Georgia, serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-widest" style={{ color: "#c9a84c" }}>
            Ork Power Vaults
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(232,213,176,0.5)" }}>
            Stake LP to power up your Mountain Orks &middot; 10% locked for the tribe
          </p>
        </div>

        {/* Wallet */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <Wallet>
            <ConnectWallet><Avatar className="h-6 w-6" /><Name /></ConnectWallet>
            <WalletDropdown>{isConnected && <Address />}<WalletDropdownDisconnect /></WalletDropdown>
          </Wallet>
          {isConnected && address && (
            <div className="text-center">
              <p className="text-xs font-mono" style={{ color: "rgba(240,208,112,0.6)" }}>{address}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(232,213,176,0.4)" }}>
                {Number(formatEther(wethBalance)).toFixed(4)} WETH
                {" | "}
                {fmt(lpBalance)} LP
                {lpPerTokenValue && lpPerTokenValue.perLpUsd > 0 && (
                  <> ({usd(Number(formatEther(lpBalance)) * lpPerTokenValue.perLpUsd)})</>
                )}
              </p>
            </div>
          )}
        </div>

        {debugMsg && (
          <p className="text-center text-xs mb-4" style={{ color: "rgba(201,168,76,0.4)" }}>{debugMsg}</p>
        )}

        {!isConnected ? (
          <p className="text-center" style={{ color: "rgba(232,213,176,0.3)" }}>Connect wallet to view your Ork vaults</p>
        ) : ownedOrks.length === 0 ? (
          <p className="text-center" style={{ color: "rgba(232,213,176,0.3)" }}>No Mountain Orks found in this wallet</p>
        ) : (
          <>
            {/* Ork Selector */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {ownedOrks.map(id => (
                <button key={id} onClick={() => setSelectedOrk(id)}
                  className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
                  style={{
                    background: selectedOrk === id ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.03)",
                    border: selectedOrk === id ? "2px solid #c9a84c" : "1px solid rgba(201,168,76,0.15)",
                    color: selectedOrk === id ? "#f0d070" : "rgba(232,213,176,0.5)",
                  }}>
                  Ork #{id}
                </button>
              ))}
            </div>

            {/* Vault Stats */}
            {selectedOrk !== null && vaultData && (
              <div className="rounded-xl p-6 mb-6" style={{
                background: "rgba(26,20,24,0.8)",
                border: "1px solid rgba(201,168,76,0.2)",
              }}>
                <h2 className="text-xl font-black text-center mb-4" style={{ color: "#f0d070" }}>
                  Ork #{selectedOrk} Vault
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <StatBox label="Your Staked LP" value={userStakeUsd > 0 ? usd(userStakeUsd) : fmt(vaultData.userStake)} sub={`${fmt(vaultData.userStake)} LP`} color="#4ade80" />
                  <StatBox label="Total Ork Power" value={totalOrkUsd > 0 ? usd(totalOrkUsd) : fmt(vaultData.totalStake)} sub={`${fmt(vaultData.totalStake)} LP`} color="#f0d070" />
                  <StatBox label="Community Pool" value={communityUsd > 0 ? usd(communityUsd) : fmt(communityPool)} sub="10% of all deposits — locked forever" color="#c084fc" />
                  {totalEthIn !== null && totalEthIn > 0 ? (
                    <StatBox label="Total ETH In" value={`${totalEthIn.toFixed(4)} ETH`} sub="What you paid to power up" color="#60a5fa" />
                  ) : (
                    <StatBox label="Your Community Share" value={communityShareUsd > 0 ? usd(communityShareUsd) : fmt(communityShare)} sub="Split across all Orks" color="#c084fc" />
                  )}
                </div>

                {estimatedApy !== null && (
                  <div className="text-center mb-4 py-2 rounded-lg" style={{ background: "rgba(74,222,128,0.08)" }}>
                    <span className="text-xs" style={{ color: "rgba(232,213,176,0.5)" }}>Estimated Pool APY: </span>
                    <span className="font-bold" style={{ color: "#4ade80" }}>{estimatedApy}</span>
                  </div>
                )}

                {/* Pool Composition */}
                {poolInfo && (
                  <div className="text-center text-xs mb-4" style={{ color: "rgba(232,213,176,0.3)" }}>
                    Pool: {fmtShort(poolInfo.reserve0)} {poolInfo.token0 === BURGERS.toLowerCase() ? "BURGERS" : "MfT"}
                    {" + "}
                    {fmtShort(poolInfo.reserve1)} {poolInfo.token0 === BURGERS.toLowerCase() ? "MfT" : "BURGERS"}
                    {" | "}
                    Total LP: {fmtShort(poolInfo.totalSupply)}
                    {poolInfo.mftPriceUsd > 0 && (
                      <> | MfT: {usd(poolInfo.mftPriceUsd)}</>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 mt-4">
                  {/* Power Up */}
                  <div className="flex gap-2 items-center justify-center">
                    <select value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                      className="rounded-lg px-3 py-2 text-sm font-bold"
                      style={{ background: "#1a1418", color: "#f0d070", border: "1px solid rgba(201,168,76,0.3)" }}>
                      <option value="0.0005">0.0005 WETH</option>
                      <option value="0.001">0.001 WETH</option>
                      <option value="0.0025">0.0025 WETH</option>
                      <option value="0.005">0.005 WETH</option>
                      <option value="0.01">0.01 WETH</option>
                    </select>
                    <button onClick={handlePowerUp}
                      className="px-6 py-2 rounded-lg font-black text-sm transition-all"
                      style={{ background: "rgba(22,163,74,0.8)", color: "#fff" }}>
                      Power Up
                    </button>
                  </div>

                  {/* Withdraw */}
                  {vaultData.userStake > 0n && (
                    <div className="flex flex-col items-center gap-2">
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
                          {fmt(withdrawLp)} LP
                          {lpPerTokenValue && lpPerTokenValue.perLpUsd > 0 && (
                            <> ({usd(Number(formatEther(withdrawLp)) * lpPerTokenValue.perLpUsd)})</>
                          )}
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

                {txStatus && (
                  <p className="text-center text-sm mt-3" style={{ color: txStatus.startsWith("Error") ? "#ef4444" : "#c9a84c" }}>
                    {txStatus}
                  </p>
                )}
              </div>
            )}

            {/* Global Stats */}
            <div className="rounded-xl p-4" style={{
              background: "rgba(26,20,24,0.5)",
              border: "1px solid rgba(201,168,76,0.1)",
            }}>
              <h3 className="text-sm font-bold text-center mb-3" style={{ color: "rgba(201,168,76,0.5)" }}>
                Global Vault Stats
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Total Staked</div>
                  <div className="font-bold text-sm" style={{ color: "#f0d070" }}>{totalVaultUsd > 0 ? usd(totalVaultUsd) : fmt(totalVaultStaked)}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Community Locked</div>
                  <div className="font-bold text-sm" style={{ color: "#c084fc" }}>{communityUsd > 0 ? usd(communityUsd) : fmt(communityPool)}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: "rgba(232,213,176,0.3)" }}>Your Wallet LP</div>
                  <div className="font-bold text-sm" style={{ color: "#4ade80" }}>{walletLpUsd > 0 ? usd(walletLpUsd) : fmt(lpBalance)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Back link */}
        <div className="text-center mt-8">
          <a href="/" className="text-sm font-bold" style={{ color: "rgba(201,168,76,0.4)" }}>
            Back to Game
          </a>
        </div>
      </div>
    </main>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

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

function usd(val: number): string {
  if (val === 0) return "$0.00";
  if (val < 0.01) return `$${val.toFixed(6)}`;
  if (val < 1) return `$${val.toFixed(4)}`;
  if (val < 1000) return `$${val.toFixed(2)}`;
  return "$" + val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtShort(val: bigint): string {
  const n = Number(formatEther(val));
  if (n > 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n > 1000) return (n / 1000).toFixed(1) + "K";
  return n.toFixed(2);
}

function computeLpValue(pool: PoolInfo): { perLpUsd: number } {
  const totalLp = Number(formatEther(pool.totalSupply));
  if (totalLp === 0 || pool.mftPriceUsd === 0) return { perLpUsd: 0 };

  // AMM invariant: both sides are always equal in dollar value
  // Find which side is MfT, get its reserve, double it for total pool USD
  const mftIsToken0 = pool.token0 === MFT.toLowerCase();
  const mftReserve = Number(formatEther(mftIsToken0 ? pool.reserve0 : pool.reserve1));
  const totalPoolUsd = 2 * mftReserve * pool.mftPriceUsd;

  return { perLpUsd: totalPoolUsd / totalLp };
}

function estimateApy(pool: PoolInfo): string {
  // V2 pools earn 0.3% on every swap
  // Without volume data, we show the pool size context instead
  const r0 = Number(formatEther(pool.reserve0));
  const r1 = Number(formatEther(pool.reserve1));
  if (r0 === 0 || r1 === 0) return "No liquidity";
  // Can't estimate without volume — show pool health indicator
  return "Fee-earning (0.3% per swap)";
}
