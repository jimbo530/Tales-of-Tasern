"use client";

import React, { useState } from "react";
import {
  ConnectWallet,
  Wallet,
} from "@coinbase/onchainkit/wallet";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { parseEther, parseUnits, formatEther, decodeEventLog } from "viem";
import { base } from "wagmi/chains";

// ── UPDATE THIS after deploying the factory ──────────────────────────────────
const FACTORY_ADDRESS = "0xd95f901dB6B1CADc799Aa6646a256B2d1fcAB299" as `0x${string}`;

const FACTORY_ABI = [
  {
    name: "launch",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_symbol", type: "string" },
      { name: "_totalSupply", type: "uint256" },
    ],
    outputs: [
      { name: "tokenAddr", type: "address" },
      { name: "reactorAddr", type: "address" },
    ],
  },
  {
    name: "minSeed",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "launchCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "TokenLaunched",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "reactor", type: "address", indexed: true },
      { name: "launcher", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "supply", type: "uint256", indexed: false },
      { name: "seed", type: "uint256", indexed: false },
    ],
  },
] as const;

export default function LaunchPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [totalSupply, setTotalSupply] = useState("1000000000");
  const [seedAmount, setSeedAmount] = useState("0.0003");
  const [status, setStatus] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<{ token: string; reactor: string } | null>(null);

  function log(msg: string) {
    setStatus((prev) => [...prev, msg]);
  }

  async function handleLaunch() {
    if (!walletClient || !address) return;
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      log("Enter a name and symbol");
      return;
    }

    setLaunching(true);
    setStatus([]);
    setResult(null);

    try {
      if (chainId !== base.id) {
        log("Switching to Base...");
        switchChain({ chainId: base.id });
        return;
      }

      const supply = parseUnits(totalSupply, 18);
      const seed = parseEther(seedAmount);

      log(`Launching ${tokenName} (${tokenSymbol})...`);
      log(`Supply: ${Number(totalSupply).toLocaleString()}`);
      log(`Seed: ${seedAmount} ETH`);
      log(`You receive: ${(Number(totalSupply) * 0.01).toLocaleString()} ${tokenSymbol} (1%)`);
      log("");

      const hash = await walletClient.writeContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "launch",
        args: [tokenName, tokenSymbol, supply],
        value: seed,
      });

      log(`Tx sent: ${hash}`);
      log("Waiting for confirmation...");

      const { createPublicClient, http } = await import("viem");
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      log(`Confirmed in block ${receipt.blockNumber}`);

      for (const eventLog of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: FACTORY_ABI,
            data: eventLog.data,
            topics: eventLog.topics,
          });
          if (decoded.eventName === "TokenLaunched") {
            const args = decoded.args as { token: string; reactor: string };
            setResult({ token: args.token, reactor: args.reactor });
            log("");
            log("TOKEN LAUNCHED SUCCESSFULLY!");
            log(`Token: ${args.token}`);
            log(`Reactor: ${args.reactor}`);
          }
        } catch {
          // not our event
        }
      }

      log(`Gas used: ${receipt.gasUsed.toString()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Error: ${msg}`);
    }

    setLaunching(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-8">
      <h1 className="text-2xl font-bold text-green-400 mb-1">
        Launch an Unruggable Token
      </h1>
      <p className="text-sm text-cyan-400 mb-6">
        3 markets. Permanent liquidity. Buyback reactor. From $1.
      </p>

      {/* Wallet */}
      <div className="mb-6">
        {!isConnected ? (
          <Wallet>
            <ConnectWallet />
          </Wallet>
        ) : (
          <div className="text-xs text-gray-400">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="w-full max-w-md space-y-4">
        <div>
          <label className="block text-xs text-cyan-400 mb-1">Token Name</label>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono focus:border-green-400 outline-none"
            placeholder="e.g. TreeCoin"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-cyan-400 mb-1">Token Symbol</label>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono focus:border-green-400 outline-none"
            placeholder="e.g. TREE"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-cyan-400 mb-1">Total Supply</label>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono focus:border-green-400 outline-none"
            type="number"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-cyan-400 mb-1">
            Seed Amount (ETH) — min ~0.0003 (~$1)
          </label>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono focus:border-green-400 outline-none"
            value={seedAmount}
            onChange={(e) => setSeedAmount(e.target.value)}
          />
        </div>

        {/* What happens box */}
        <div className="border border-gray-700 rounded p-3 bg-gray-900 text-xs space-y-1">
          <div className="text-cyan-400 mb-2 font-bold">What happens:</div>
          <div className="flex justify-between">
            <span className="text-gray-500">0.1% supply</span>
            <span className="text-green-400">MfT treasury</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">1% supply</span>
            <span className="text-green-400">Your wallet</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">~40% supply</span>
            <span className="text-green-400">TOKEN/USDC pool (lead)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">~35% supply</span>
            <span className="text-green-400">TOKEN/WETH pool</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">~25% supply</span>
            <span className="text-green-400">TOKEN/cbBTC pool</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Seed split</span>
            <span className="text-green-400">60% USDC / 20% WETH / 20% BTC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Liquidity</span>
            <span className="text-yellow-400">Locked FOREVER in reactor</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Reactor</span>
            <span className="text-green-400">Buyback + burn, anyone can run</span>
          </div>
          <div className="text-yellow-500 mt-2">
            No one can rug this token. Not even you.
          </div>
        </div>

        <button
          onClick={handleLaunch}
          disabled={!isConnected || launching}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 rounded font-mono text-lg transition-colors"
        >
          {launching ? "LAUNCHING..." : "LAUNCH TOKEN"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 w-full max-w-md border border-green-500 rounded p-4 bg-gray-900">
          <div className="text-green-400 font-bold mb-2">
            Token Launched!
          </div>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-cyan-400">Token: </span>
              <a
                href={`https://basescan.org/address/${result.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 underline break-all"
              >
                {result.token}
              </a>
            </div>
            <div>
              <span className="text-cyan-400">Reactor: </span>
              <a
                href={`https://basescan.org/address/${result.reactor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 underline break-all"
              >
                {result.reactor}
              </a>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            3 pools live on Uniswap V3. Reactor running. Liquidity locked forever.
          </div>
        </div>
      )}

      {/* Log */}
      {status.length > 0 && (
        <div className="mt-4 w-full max-w-md bg-gray-900 border border-gray-700 rounded p-3 font-mono text-xs text-green-400 whitespace-pre-wrap">
          {status.map((line, i) => (
            <div key={i} className={line.startsWith("Error") ? "text-red-400" : ""}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
