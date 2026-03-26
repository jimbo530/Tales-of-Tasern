import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
