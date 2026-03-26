"use client";

import { useEffect, useRef } from "react";
import type { NftCharacter } from "@/hooks/useNftStats";
import { useBattle } from "@/hooks/useBattle";
import { useNftImage } from "@/hooks/useNftImage";

type Props = {
  fighter1: NftCharacter;
  fighter2: NftCharacter;
  onExit: () => void;
};

function Portrait({ metadataUri, name, defeated }: { metadataUri?: string; name: string; defeated?: boolean }) {
  const { imageUrl, imgLoaded, imgFailed, setImgLoaded, setImgFailed } = useNftImage(metadataUri);
  return (
    <div className="relative w-full rounded-lg overflow-hidden mb-3" style={{ background: '#0a0810' }}>
      {imgFailed ? (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <span className="text-4xl">🛡️</span>
        </div>
      ) : imageUrl ? (
        <>
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: 'rgba(201,168,76,0.9)' }} />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            className="w-full transition-opacity duration-500"
            style={{ opacity: imgLoaded ? (defeated ? 0.3 : 1) : 0 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgLoaded(false); setImgFailed(true); }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: 'rgba(201,168,76,0.7)' }} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a12] via-transparent to-transparent" />
      {defeated && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <span className="text-4xl">💀</span>
        </div>
      )}
    </div>
  );
}

function HpBar({ current, max, side }: { current: number; max: number; side: "left" | "right" }) {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  const critical = pct < 25;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-mono mb-1" style={{ color: 'rgba(232,213,176,0.8)' }}>
        <span>{current.toFixed(1)}</span>
        <span style={{ color: 'rgba(201,168,76,0.4)' }}>/ {max.toFixed(1)}</span>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: critical
              ? 'linear-gradient(90deg, #dc2626, #f87171)'
              : 'linear-gradient(90deg, #16a34a, #4ade80)',
            boxShadow: critical ? '0 0 8px #dc2626' : '0 0 6px #16a34a',
            float: side === "right" ? "right" : "left",
          }}
        />
      </div>
    </div>
  );
}

function StatLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between text-xs" style={{ color }}>
      <span className="tracking-wider uppercase" style={{ fontSize: '0.6rem' }}>{label}</span>
      <span className="font-mono font-bold">{value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)}</span>
    </div>
  );
}

export function BattleView({ fighter1, fighter2, onExit }: Props) {
  const battle = useBattle(fighter1, fighter2);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll combat log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battle.log.length]);

  const dmgFlash1 = battle.log.length > 0 && battle.log[battle.log.length - 1]?.attacker === 2;
  const dmgFlash2 = battle.log.length > 0 && battle.log[battle.log.length - 2]?.attacker === 1;

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto gap-6">
      {/* Back button */}
      <button
        onClick={onExit}
        className="self-start px-4 py-2 rounded text-sm font-bold uppercase tracking-widest"
        style={{ background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.7)', border: '1px solid rgba(201,168,76,0.2)' }}>
        ← Back to Grid
      </button>

      {/* Arena */}
      <div className="w-full rounded-xl p-6" style={{
        background: 'radial-gradient(ellipse at center, rgba(20,15,25,0.95) 0%, rgba(8,6,12,0.98) 100%)',
        border: '1px solid rgba(201,168,76,0.2)',
      }}>
        {/* Fighter panels */}
        <div className="flex items-start gap-4">
          {/* Fighter 1 */}
          <div className={`flex-1 rounded-lg p-4 transition-all duration-200 ${dmgFlash1 && battle.status === "running" ? "ring-2 ring-red-500/50" : ""}`}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <Portrait metadataUri={fighter1.metadataUri} name={fighter1.name} defeated={battle.winner === 2} />
            <h3 className="font-black text-sm tracking-widest uppercase text-center mb-3 text-gold-shimmer">
              {fighter1.name}
            </h3>
            <HpBar current={battle.hp1} max={battle.maxHp1} side="left" />
            <div className="mt-3 flex flex-col gap-1">
              <StatLine label="⚔️ ATK" value={battle.stats1.attack} color="rgba(251,191,36,0.8)" />
              {battle.stats1.mAtk > 0 && <StatLine label="⚡ EATK" value={battle.stats1.mAtk} color="rgba(192,132,252,0.8)" />}
              {battle.stats1.fAtk > 0 && <StatLine label="🔥 FATK" value={battle.stats1.fAtk} color="rgba(251,146,60,0.8)" />}
              <StatLine label="🛡️ DEF" value={battle.stats1.def} color="rgba(148,163,184,0.8)" />
              {battle.stats1.mDef > 0 && <StatLine label="🛡️ MDEF" value={battle.stats1.mDef} color="rgba(45,212,191,0.8)" />}
              {battle.stats1.mana > 0 && <StatLine label="💧 MANA" value={battle.stats1.mana} color="rgba(96,165,250,0.8)" />}
            </div>
            {battle.winner === 1 && (
              <div className="mt-3 text-center font-black text-lg tracking-widest text-gold-shimmer uppercase">Victory</div>
            )}
            {battle.winner === 2 && (
              <div className="mt-3 text-center font-bold text-sm tracking-widest uppercase" style={{ color: '#8b1a1a' }}>Defeated</div>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center justify-center pt-12 flex-shrink-0">
            <span className="text-3xl font-black" style={{ color: 'rgba(201,168,76,0.6)' }}>
              {battle.status === "finished" ? (battle.winner === "draw" ? "DRAW" : "💀") : "⚔️"}
            </span>
            <span className="text-xs tracking-widest uppercase mt-1" style={{ color: 'rgba(201,168,76,0.3)' }}>
              {battle.status === "waiting" ? "ready" : battle.status === "running" ? `tick ${battle.tick}` : "finished"}
            </span>
          </div>

          {/* Fighter 2 */}
          <div className={`flex-1 rounded-lg p-4 transition-all duration-200 ${dmgFlash2 && battle.status === "running" ? "ring-2 ring-red-500/50" : ""}`}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <Portrait metadataUri={fighter2.metadataUri} name={fighter2.name} defeated={battle.winner === 1} />
            <h3 className="font-black text-sm tracking-widest uppercase text-center mb-3 text-gold-shimmer">
              {fighter2.name}
            </h3>
            <HpBar current={battle.hp2} max={battle.maxHp2} side="right" />
            <div className="mt-3 flex flex-col gap-1">
              <StatLine label="⚔️ ATK" value={battle.stats2.attack} color="rgba(251,191,36,0.8)" />
              {battle.stats2.mAtk > 0 && <StatLine label="⚡ EATK" value={battle.stats2.mAtk} color="rgba(192,132,252,0.8)" />}
              {battle.stats2.fAtk > 0 && <StatLine label="🔥 FATK" value={battle.stats2.fAtk} color="rgba(251,146,60,0.8)" />}
              <StatLine label="🛡️ DEF" value={battle.stats2.def} color="rgba(148,163,184,0.8)" />
              {battle.stats2.mDef > 0 && <StatLine label="🛡️ MDEF" value={battle.stats2.mDef} color="rgba(45,212,191,0.8)" />}
              {battle.stats2.mana > 0 && <StatLine label="💧 MANA" value={battle.stats2.mana} color="rgba(96,165,250,0.8)" />}
            </div>
            {battle.winner === 2 && (
              <div className="mt-3 text-center font-black text-lg tracking-widest text-gold-shimmer uppercase">Victory</div>
            )}
            {battle.winner === 1 && (
              <div className="mt-3 text-center font-bold text-sm tracking-widest uppercase" style={{ color: '#8b1a1a' }}>Defeated</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-6">
          {battle.status === "waiting" && (
            <button onClick={battle.start}
              className="px-8 py-3 rounded-lg text-sm font-black uppercase tracking-widest"
              style={{ background: 'rgba(201,168,76,0.3)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.6)', boxShadow: '0 0 20px rgba(201,168,76,0.15)' }}>
              Fight!
            </button>
          )}
          {battle.status === "finished" && (
            <>
              <button onClick={battle.reset}
                className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#f0d070', border: '1px solid rgba(201,168,76,0.4)' }}>
                Rematch
              </button>
              <button onClick={onExit}
                className="px-6 py-2 rounded text-sm font-bold uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(201,168,76,0.6)', border: '1px solid rgba(201,168,76,0.15)' }}>
                Back to Grid
              </button>
            </>
          )}
        </div>

        {/* Combat Log */}
        {battle.log.length > 0 && (
          <div ref={logRef}
            className="mt-6 rounded-lg p-3 max-h-48 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(201,168,76,0.1)' }}>
            {battle.log.map((e, i) => {
              const attackerName = e.attacker === 1 ? fighter1.name : fighter2.name;
              const targetName = e.attacker === 1 ? fighter2.name : fighter1.name;
              return (
                <div key={i} className="text-xs py-0.5 font-mono" style={{
                  color: e.targetHpAfter <= 0 ? '#f87171' : 'rgba(232,213,176,0.5)',
                }}>
                  <span style={{ color: 'rgba(201,168,76,0.3)' }}>[{e.tick}]</span>{' '}
                  <span style={{ color: e.attacker === 1 ? 'rgba(251,191,36,0.7)' : 'rgba(96,165,250,0.7)' }}>{attackerName}</span>
                  {' → '}
                  <span style={{ color: 'rgba(251,191,36,0.6)' }}>{e.physDmg.toFixed(1)}</span>
                  {e.magicDmg > 0 && <> + <span style={{ color: 'rgba(192,132,252,0.6)' }}>{e.magicDmg.toFixed(1)}</span></>}
                  {e.fireDmg > 0 && <> + <span style={{ color: 'rgba(251,146,60,0.6)' }}>{e.fireDmg.toFixed(1)}</span></>}
                  {e.manaDmg > 0 && <> + <span style={{ color: 'rgba(96,165,250,0.6)' }}>{e.manaDmg.toFixed(1)}💧</span></>}
                  {' = '}
                  <span style={{ color: '#f87171' }}>{e.totalDmg.toFixed(1)}</span>
                  {' dmg → '}
                  <span>{targetName}</span>
                  {' ('}
                  <span style={{ color: e.targetHpAfter <= 0 ? '#dc2626' : 'rgba(74,222,128,0.7)' }}>
                    {e.targetHpAfter.toFixed(1)} HP
                  </span>
                  {')'}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
