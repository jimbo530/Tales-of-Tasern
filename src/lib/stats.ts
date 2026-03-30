import { createPublicClient, http, formatUnits } from "viem";
import { base, polygon } from "viem/chains";
import { V2_PAIR_ABI, STAT_TOKENS } from "./contracts";

export type CharacterStats = {
  str: number;
  con: number;
};

const clients = {
  base: createPublicClient({ chain: base, transport: http() }),
  polygon: createPublicClient({ chain: polygon, transport: http() }),
};

/**
 * Read LP reserves held by `holderAddress` in `lpPairAddress` and map
 * token amounts to game stats.
 *
 * @param nftTotalSupply - pass for external collections to divide stats per NFT
 */
export async function getLpStats(
  chain: "base" | "polygon",
  lpPairAddress: `0x${string}`,
  holderAddress: `0x${string}`,
  nftTotalSupply?: bigint
): Promise<CharacterStats & { rawStr: bigint; rawCon: bigint }> {
  const client = clients[chain];
  const statTokens = STAT_TOKENS["base"];

  const [reserves, token0, token1, lpTotal, lpHeld] = await Promise.all([
    client.readContract({ address: lpPairAddress, abi: V2_PAIR_ABI, functionName: "getReserves" }),
    client.readContract({ address: lpPairAddress, abi: V2_PAIR_ABI, functionName: "token0" }),
    client.readContract({ address: lpPairAddress, abi: V2_PAIR_ABI, functionName: "token1" }),
    client.readContract({ address: lpPairAddress, abi: V2_PAIR_ABI, functionName: "totalSupply" }),
    client.readContract({ address: lpPairAddress, abi: V2_PAIR_ABI, functionName: "balanceOf", args: [holderAddress] }),
  ]);

  const [res0, res1] = reserves as readonly [bigint, bigint, number];
  const t0 = (token0 as string).toLowerCase();
  const t1 = (token1 as string).toLowerCase();
  const lpTotalSupply = lpTotal as bigint;
  const lpHolderBalance = lpHeld as bigint;

  // Holder's share of the pool (scaled by 1e18)
  const share = lpTotalSupply > 0n
    ? (lpHolderBalance * BigInt(1e18)) / lpTotalSupply
    : 0n;

  // Per-NFT divisor for external collections
  const nftDivisor = nftTotalSupply && nftTotalSupply > 0n ? nftTotalSupply : 1n;

  const amt0 = (res0 * share) / BigInt(1e18) / nftDivisor;
  const amt1 = (res1 * share) / BigInt(1e18) / nftDivisor;

  const strTokens = statTokens.str.map((t: string) => t.toLowerCase());
  const conTokens = statTokens.con.map((t: string) => t.toLowerCase());

  let rawStr = 0n;
  let rawCon = 0n;

  if (strTokens.includes(t0)) rawStr = amt0;
  else if (strTokens.includes(t1)) rawStr = amt1;

  if (conTokens.includes(t0)) rawCon = amt0;
  else if (conTokens.includes(t1)) rawCon = amt1;

  return {
    str: parseFloat(formatUnits(rawStr, 18)),
    con: parseFloat(formatUnits(rawCon, 18)),
    rawStr,
    rawCon,
  };
}
