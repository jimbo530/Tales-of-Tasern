"use client";

type Props = {
  label: string;
  value: number;
  max: number;
  color: string;
};

export function StatBar({ label, value, max, color }: Props) {
  const raw = max > 0 ? (value / max) * 100 : 0;
  // Clamp: any value shows at least 10%, 90%+ shows as full
  const pct = value > 0 ? (raw >= 90 ? 100 : Math.max(10, Math.min(raw, 100))) : 0;
  const display = value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(2);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs tracking-widest uppercase font-semibold">
        <span style={{ color: 'rgba(232,213,176,0.7)' }}>{label}</span>
        <span style={{ color: 'rgba(201,168,76,0.9)' }}>{display}</span>
      </div>
      <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 6px currentColor` }}
        />
      </div>
    </div>
  );
}
