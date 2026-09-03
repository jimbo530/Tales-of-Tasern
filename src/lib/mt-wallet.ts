// mt-wallet.ts — SERVER-ONLY Monkey Town wallet resolution + read-only balances on Base.
//
// This is the SAME server-managed CDP wallet the summon-bot uses for an X handle: the CDP account
// name is "mt-" + sanitized handle, resolved via cdp.evm.getOrCreateAccount({ name }). Ported 1:1
// from C:\Users\bigji\monkey-town\wallet-service\{player-wallets,balance-for-player,base-tokens}.mjs
// so the site and the bot resolve the EXACT same address for a handle.
//
// SECURITY: the `handle` passed to these functions must ALWAYS come from the verified session
// cookie (see session.ts), never from client input. Nothing here trusts an address or wallet id.
// CDP creds are read from the environment by the SDK (server-side only) and never sent to a client.
//
// House laws: reads live or THROW (no hardcoded balances), loud failures / no silent catch,
//   never expose a key, exact 1:1 port of the grounded token map (verified on-chain 2026-07-25).
//
// NOTE: imported ONLY by server-side route handlers (never the client bundle — the wallet page
// reaches it via fetch), so CDP creds and the SDK stay strictly server-side.
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, getContract, type Address } from "viem";
import { base } from "viem/chains";

// Base RPC for read-only balance calls. CDP_RPC_URL overrides; publicnode is the grounded default.
const RPC = process.env.CDP_RPC_URL || "https://base-rpc.publicnode.com";

// Grounded, on-chain-verified Base token map (2026-07-25) — mirrors base-tokens.mjs. We list ONLY
// the player-facing tokens the wallet view shows (GOLD, NANA/bananas, USDC, MfT the public meme,
// RWI) plus native ETH. The 6-dec "Money" membrane is intentionally NOT shown (backend-only, founder
// law: nothing is ever priced/shown in Money).
export type TokenDef = {
  symbol: string;
  address: Address;
  decimals: number;
  label: string; // player-facing label
  game: boolean; // in-game item (shown, but marked as a game credit)
};

export const WALLET_TOKENS: TokenDef[] = [
  { symbol: "GOLD", address: "0x2065d87b3a1FACc9A4fE037D7a58bC069F597004", decimals: 18, label: "Gold", game: true },
  { symbol: "NANA", address: "0x85A39421DBEDa43342AD2F8f3CCA4C3DCa93cB7b", decimals: 18, label: "Bananas", game: true },
  { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, label: "USDC", game: false },
  { symbol: "MfT", address: "0x8FB87d13B40B1A67B22ED1a17e2835fe7e3a9bA3", decimals: 18, label: "MfT", game: false },
  { symbol: "RWI", address: "0x4380DDb7e666A4398153da293dEb2B4C01D25FCA", decimals: 18, label: "RWI", game: false },
];

const ERC20 = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Sanitize an X handle to the CDP account-name convention. IDENTICAL to the bot:
//   lowercase, strip a leading @, keep [a-z0-9] -> hyphen, cap at 32 chars, prefix "mt-".
// Exported so both wallet resolution and any future action rail derive the SAME name.
export function cdpNameForHandle(handle: string): string {
  const h = String(handle || "").trim().toLowerCase().replace(/^@/, "");
  if (!h) throw new Error("cdpNameForHandle: handle required");
  return "mt-" + h.replace(/[^a-z0-9]/g, "-").slice(0, 32);
}

// Assert CDP creds are present (server-side). Loud failure if a deploy is missing them, so we never
// silently fail to resolve a wallet.
function assertCdpEnv() {
  for (const k of ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]) {
    if (!process.env[k]) throw new Error(`MISSING ${k} — set CDP creds in the server environment`);
  }
}

// Resolve (create-if-new, idempotent) the Monkey Town wallet address for a handle. The handle MUST
// be the verified session handle.
export async function addressForHandle(handle: string): Promise<Address> {
  assertCdpEnv();
  const name = cdpNameForHandle(handle);
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name });
  if (!account?.address) throw new Error(`CDP returned no address for ${name}`);
  return account.address as Address;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 4, baseMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw new Error(`RPC ${label} failed after ${tries} tries: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export type WalletBalances = {
  address: Address;
  eth: string; // human-readable string (avoids float loss over the wire)
  tokens: { symbol: string; label: string; address: Address; decimals: number; amount: string; game: boolean }[];
};

// Read ETH + all WALLET_TOKENS balances for the handle's Monkey Town wallet. Read-only. All tokens
// are returned (even zero) so the wallet view can show a stable, complete list. Amounts are strings
// formatted from raw wei to preserve precision.
export async function balancesForHandle(handle: string): Promise<WalletBalances> {
  const address = await addressForHandle(handle);
  const pub = createPublicClient({ chain: base, transport: http(RPC) });

  const ethWei = await withRetry("getBalance(ETH)", () => pub.getBalance({ address }));

  const raws = await Promise.all(
    WALLET_TOKENS.map((t) =>
      withRetry(`${t.symbol}.balanceOf`, () =>
        getContract({ address: t.address, abi: ERC20, client: pub }).read.balanceOf([address]) as Promise<bigint>
      )
    )
  );

  const tokens = WALLET_TOKENS.map((t, i) => ({
    symbol: t.symbol,
    label: t.label,
    address: t.address,
    decimals: t.decimals,
    amount: formatUnitsStr(raws[i], t.decimals),
    game: t.game,
  }));

  return { address, eth: formatUnitsStr(ethWei, 18), tokens };
}

// Minimal wei -> decimal string (no rounding). Keeps full precision; UI trims for display.
function formatUnitsStr(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  let s = (neg ? -raw : raw).toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  let frac = decimals ? s.slice(s.length - decimals) : "";
  frac = frac.replace(/0+$/, "");
  return (neg ? "-" : "") + (frac ? `${whole}.${frac}` : whole);
}
