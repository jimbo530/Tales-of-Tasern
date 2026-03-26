"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { createLobby, joinLobby, findRandomLobby, subscribeLobby, type Lobby } from "@/lib/supabase";
import type { NftCharacter } from "@/hooks/useNftStats";
import { buildDeck } from "@/lib/deckBuilder";

type Props = {
  characters: NftCharacter[];
  onMatchFound: (lobby: Lobby, myDeck: NftCharacter[], opponentDeck: NftCharacter[], isHost: boolean) => void;
  onBack: () => void;
};

export function Matchmaking({ characters, onMatchFound, onBack }: Props) {
  const { address } = useAccount();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "queue">("menu");
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const myDeck = buildDeck(characters, characters.filter(c => c.owned));

  // Subscribe to lobby updates
  useEffect(() => {
    if (!lobby) return;
    const channel = subscribeLobby(lobby.id, (updated) => {
      setLobby(updated);
      if (updated.status === "matched") {
        // Match found!
        const opponentDeck = buildDeck(characters);
        const isHost = updated.host_wallet === (address ?? "");
        onMatchFound(updated, myDeck, opponentDeck, isHost);
      }
    });
    return () => { channel.unsubscribe(); };
  }, [lobby?.id]);

  // Check if lobby got matched (for host)
  useEffect(() => {
    if (lobby?.status === "matched") {
      const opponentDeck = buildDeck(characters);
      onMatchFound(lobby, myDeck, opponentDeck, true);
    }
  }, [lobby?.status]);

  async function handleCreate() {
    setError(null);
    const l = await createLobby(address);
    if (l) { setLobby(l); setMode("create"); }
    else setError("Failed to create lobby");
  }

  async function handleJoin() {
    setError(null);
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    const l = await joinLobby(joinCode.trim(), address);
    if (l) {
      const opponentDeck = buildDeck(characters);
      onMatchFound(l, myDeck, opponentDeck, false);
    } else {
      setError("Room not found or already full");
    }
  }

  async function handleQueue() {
    setError(null);
    setSearching(true);
    setMode("queue");

    // Try to find an existing lobby
    const existing = await findRandomLobby(address);
    if (existing) {
      const joined = await joinLobby(existing.code, address);
      if (joined) {
        const opponentDeck = buildDeck(characters);
        onMatchFound(joined, myDeck, opponentDeck, false);
        return;
      }
    }

    // No lobby found — create one and wait
    const l = await createLobby(address);
    if (l) { setLobby(l); }
    else { setError("Failed to queue"); setSearching(false); }
  }

  return (
    <div className="flex flex-col items-center gap-6 mt-12 max-w-md mx-auto">
      <h2 className="text-2xl font-black tracking-widest text-gold-shimmer uppercase"
        style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif" }}>
        ⚔️ Arena ⚔️
      </h2>

      {error && (
        <div className="px-4 py-2 rounded text-sm text-center"
          style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>
          {error}
        </div>
      )}

      {/* Menu */}
      {mode === "menu" && (
        <div className="flex flex-col gap-4 w-full">
          <p className="text-center text-sm" style={{ color: 'rgba(201,168,76,0.6)' }}>
            Challenge warriors across the realm
          </p>
          <button onClick={handleQueue}
            className="w-full px-6 py-4 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)', boxShadow: '0 0 20px rgba(220,38,38,0.1)' }}>
            ⚔️ Find Opponent
          </button>
          <div className="flex gap-3">
            <button onClick={handleCreate}
              className="flex-1 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(201,168,76,0.15)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
              🏰 Create Room
            </button>
            <button onClick={() => setMode("join")}
              className="flex-1 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest"
              style={{ background: 'rgba(96,165,250,0.15)', color: 'rgba(96,165,250,0.9)', border: '1px solid rgba(96,165,250,0.4)' }}>
              🚪 Join Room
            </button>
          </div>
          <button onClick={onBack}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Back
          </button>
        </div>
      )}

      {/* Waiting for opponent (created room) */}
      {mode === "create" && lobby && (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm" style={{ color: 'rgba(201,168,76,0.6)' }}>Share this code with your opponent:</p>
          <div className="px-8 py-4 rounded-lg text-center"
            style={{ background: 'rgba(201,168,76,0.1)', border: '2px solid rgba(201,168,76,0.5)' }}>
            <span className="text-3xl font-black tracking-[0.3em] text-gold-shimmer">{lobby.code}</span>
          </div>
          <button onClick={() => {
            navigator.clipboard.writeText(lobby.code);
          }}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(201,168,76,0.15)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.3)' }}>
            📋 Copy Code
          </button>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: 'rgba(201,168,76,0.9)' }} />
            <span className="text-sm tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.5)' }}>
              Waiting for opponent...
            </span>
          </div>
          <button onClick={() => { setMode("menu"); setLobby(null); }}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest mt-4"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Join room */}
      {mode === "join" && (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm" style={{ color: 'rgba(201,168,76,0.6)' }}>Enter room code:</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="TOT-XXXX"
            className="w-full px-4 py-3 rounded-lg text-center text-xl font-black tracking-[0.2em] uppercase"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)', outline: 'none' }}
          />
          <button onClick={handleJoin}
            className="w-full px-6 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{ background: 'rgba(34,197,94,0.25)', color: 'rgba(74,222,128,0.9)', border: '1px solid rgba(34,197,94,0.5)' }}>
            ⚔️ Join Battle
          </button>
          <button onClick={() => setMode("menu")}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            ← Back
          </button>
        </div>
      )}

      {/* Queue */}
      {mode === "queue" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(220,38,38,0.3)', borderTopColor: 'rgba(220,38,38,0.9)' }} />
          <span className="text-sm tracking-widest uppercase" style={{ color: 'rgba(220,38,38,0.7)' }}>
            Searching for opponent...
          </span>
          {lobby && (
            <p className="text-xs" style={{ color: 'rgba(201,168,76,0.3)' }}>
              Room: {lobby.code}
            </p>
          )}
          <button onClick={() => { setMode("menu"); setLobby(null); setSearching(false); }}
            className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest mt-4"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.5)', border: '1px solid rgba(201,168,76,0.15)' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
