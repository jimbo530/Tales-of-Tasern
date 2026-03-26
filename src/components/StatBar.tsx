"use client";

type Props = {
  label: string;
  value: number;
  max: number;
  color: string;
};

export function StatBar({ label, value, max, color }: Props) {
  const raw = max > 0 ? (value / max) * 100 : 0;
  const pct = value > 0 ? (raw >= 90 ? 100 : Math.max(10, Math.min(raw, 100))) : 0;
  const display = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value >= 1
    ? value.toFixed(1)
    : value > 0
    ? value.toFixed(4)
    : "0";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs tracking-widest uppercase font-semibold" style={{ fontSize: '0.6rem' }}>
        <span style={{ color: 'rgba(232,213,176,0.7)' }}>{label}</span>
        <span style={{ color: 'rgba(201,168,76,0.9)' }}>{display}</span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 6px currentColor` }}
        />
      </div>
    </div>
  );
}
