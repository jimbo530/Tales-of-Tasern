import { createClient } from "@supabase/supabase-js";

// Graceful fallback: during build/SSG the env vars may be missing.
// The client will be non-functional but won't crash the build.
// At runtime in the browser the real env vars are always present.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(url, key);

export type Lobby = {
  id: string;
  code: string;
  host_wallet: string | null;
  host_deck: any[] | null;
  guest_wallet: string | null;
  guest_deck: any[] | null;
  status: "waiting" | "matched" | "playing" | "finished";
  created_at: string;
};

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TOT-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createLobby(hostWallet?: string, hostDeck?: any[]): Promise<Lobby | null> {
  const code = randomCode();
  const { data, error } = await supabase
    .from("lobbies")
    .insert({ code, host_wallet: hostWallet ?? null, host_deck: hostDeck ?? null, status: "waiting" })
    .select()
    .single();
  if (error) { console.error("createLobby:", error); return null; }
  return data as Lobby;
}

export async function joinLobby(code: string, guestWallet?: string, guestDeck?: any[]): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from("lobbies")
    .update({ guest_wallet: guestWallet ?? null, guest_deck: guestDeck ?? null, status: "matched" })
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .select()
    .single();
  if (error) { console.error("joinLobby:", error); return null; }
  return data as Lobby;
}

export async function findRandomLobby(myWallet?: string): Promise<Lobby | null> {
  // Try to join an existing waiting lobby
  const { data } = await supabase
    .from("lobbies")
    .select("*")
    .eq("status", "waiting")
    .neq("host_wallet", myWallet ?? "")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  return (data as Lobby) ?? null;
}

export function subscribeLobby(lobbyId: string, callback: (lobby: Lobby) => void) {
  return supabase
    .channel(`lobby-${lobbyId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "lobbies",
      filter: `id=eq.${lobbyId}`,
    }, (payload) => {
      callback(payload.new as Lobby);
    })
    .subscribe();
}

export async function updateLobbyStatus(lobbyId: string, status: Lobby["status"]) {
  await supabase.from("lobbies").update({ status }).eq("id", lobbyId);
}

// ── Marketplace Listings ────────────────────────────────────────────────────

export type Listing = {
  id: string;
  nft_address: string;
  seller_address: string;
  listed_at: string;
  status: "active" | "sold" | "cancelled";
};

export async function listNft(nftAddress: string, sellerAddress: string): Promise<Listing | null> {
  // Check not already listed
  const { data: existing } = await supabase
    .from("listings")
    .select("*")
    .eq("nft_address", nftAddress.toLowerCase())
    .eq("status", "active")
    .single();
  if (existing) return existing as Listing;

  const { data, error } = await supabase
    .from("listings")
    .insert({ nft_address: nftAddress.toLowerCase(), seller_address: sellerAddress.toLowerCase(), status: "active" })
    .select()
    .single();
  if (error) { console.error("listNft:", error); return null; }
  return data as Listing;
}

export async function cancelListing(nftAddress: string, sellerAddress: string): Promise<boolean> {
  const { error } = await supabase
    .from("listings")
    .update({ status: "cancelled" })
    .eq("nft_address", nftAddress.toLowerCase())
    .eq("seller_address", sellerAddress.toLowerCase())
    .eq("status", "active");
  return !error;
}

export async function getActiveListings(): Promise<Listing[]> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("listed_at", { ascending: false });
  return (data ?? []) as Listing[];
}

// ── Shared NFT/LP Registry ─────────────────────────────────────────────────

export type NftRow = {
  id: string;
  name: string;
  contract_address: string;
  chain: "base" | "polygon";
};

export type LpPairRow = {
  id: string;
  pair_address: string;
  chain: "base" | "polygon";
  label: string | null;
};

let _nftCache: NftRow[] | null = null;
let _lpCache: { base: string[]; polygon: string[] } | null = null;

export async function getSharedNfts(): Promise<NftRow[]> {
  if (_nftCache) return _nftCache;
  const { data, error } = await supabase
    .from("nfts")
    .select("id, name, contract_address, chain")
    .order("created_at", { ascending: true });
  if (error) { console.error("getSharedNfts:", error); return []; }
  _nftCache = (data ?? []) as NftRow[];
  return _nftCache;
}

export async function getSharedLpPairs(): Promise<{ base: `0x${string}`[]; polygon: `0x${string}`[] }> {
  if (_lpCache) return _lpCache as { base: `0x${string}`[]; polygon: `0x${string}`[] };
  const { data, error } = await supabase
    .from("lp_pairs")
    .select("pair_address, chain")
    .order("created_at", { ascending: true });
  if (error) { console.error("getSharedLpPairs:", error); return { base: [], polygon: [] }; }
  const rows = (data ?? []) as LpPairRow[];
  const result = {
    base: rows.filter(r => r.chain === "base").map(r => r.pair_address as `0x${string}`),
    polygon: rows.filter(r => r.chain === "polygon").map(r => r.pair_address as `0x${string}`),
  };
  _lpCache = { base: result.base as string[], polygon: result.polygon as string[] };
  return result;
}

// ── Chain Data Queries (read from update-chain-data cron) ───────────────────

export type TokenAmountRow = {
  nft_address: string;
  token_address: string;
  symbol: string;
  raw_amount: number;
  usd_value: number;
  decimals: number;
};

export type TokenPriceRow = {
  token_address: string;
  symbol: string;
  usd_price: number;
  decimals: number;
  category: string;
};

export type NftSummaryRow = {
  nft_address: string;
  name: string;
  chain: string;
  usd_backing: number;
  usd_traditional: number;
  usd_game: number;
  usd_impact: number;
};

export type SellerOwnershipRow = {
  nft_address: string;
  chain: string;
  balance: number;
};

export type NftImageRow = {
  nft_address: string;
  chain: string;
  metadata_uri: string | null;
  image_url: string | null;
};

/** All token amounts for every NFT (for stat computation) */
export async function getTokenAmounts(): Promise<TokenAmountRow[]> {
  const { data, error } = await supabase
    .from("nft_token_amounts")
    .select("nft_address, token_address, symbol, raw_amount, usd_value, decimals");
  if (error) { console.error("getTokenAmounts:", error); return []; }
  return (data ?? []) as TokenAmountRow[];
}

/** Token USD prices and categories */
export async function getTokenPrices(): Promise<TokenPriceRow[]> {
  const { data, error } = await supabase
    .from("token_prices")
    .select("token_address, symbol, usd_price, decimals, category");
  if (error) { console.error("getTokenPrices:", error); return []; }
  return (data ?? []) as TokenPriceRow[];
}

/** Per-NFT summary with USD backing breakdown */
export async function getNftSummaries(): Promise<NftSummaryRow[]> {
  const { data, error } = await supabase
    .from("nft_summary")
    .select("nft_address, name, chain, usd_backing, usd_traditional, usd_game, usd_impact");
  if (error) { console.error("getNftSummaries:", error); return []; }
  return (data ?? []) as NftSummaryRow[];
}

/** Which NFTs the seller wallet owns */
export async function getSellerOwnership(): Promise<SellerOwnershipRow[]> {
  const { data, error } = await supabase
    .from("seller_ownership")
    .select("nft_address, chain, balance")
    .gt("balance", 0);
  if (error) { console.error("getSellerOwnership:", error); return []; }
  return (data ?? []) as SellerOwnershipRow[];
}

/** Cached NFT images */
export async function getNftImages(): Promise<NftImageRow[]> {
  const { data, error } = await supabase
    .from("nft_images")
    .select("nft_address, chain, metadata_uri, image_url");
  if (error) { console.error("getNftImages:", error); return []; }
  return (data ?? []) as NftImageRow[];
}

// ── Adventure Saves ─────────────────────────────────────────────────────────

export type AdventureSave = {
  wallet: string;
  state: any;
  intro_seen: boolean;
  updated_at: string;
};

export async function loadAdventureSave(wallet: string): Promise<AdventureSave | null> {
  const { data, error } = await supabase
    .from("adventure_saves")
    .select("*")
    .eq("wallet", wallet.toLowerCase())
    .single();
  if (error) return null;
  return data as AdventureSave;
}

export async function saveAdventure(wallet: string, state: any, introSeen: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("adventure_saves")
    .upsert({
      wallet: wallet.toLowerCase(),
      state,
      intro_seen: introSeen,
      updated_at: new Date().toISOString(),
    }, { onConflict: "wallet" });
  return !error;
}
