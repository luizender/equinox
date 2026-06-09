'use client';

import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Position } from '@/lib/math-engine';

interface HealthFactorHeroProps {
  position: Position | null;
}

// Risk tiers keyed off the health factor. Liquidation happens below 1.0.
function getTier(hf: number, hasDebt: boolean) {
  if (!hasDebt) {
    return {
      label: 'No Debt',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      bar: 'bg-emerald-400',
      glow: '',
      pulse: false,
      Icon: ShieldCheck,
    };
  }
  if (hf < 1.0) {
    return {
      label: 'Liquidation Risk',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      bg: 'bg-rose-500/5',
      bar: 'bg-rose-400',
      glow: 'shadow-glow-rose',
      pulse: true,
      Icon: AlertTriangle,
    };
  }
  if (hf < 1.2) {
    return {
      label: 'At Risk',
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/5',
      bar: 'bg-amber-400',
      glow: '',
      pulse: false,
      Icon: AlertTriangle,
    };
  }
  return {
    label: 'Safe',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    bar: 'bg-emerald-400',
    glow: '',
    pulse: false,
    Icon: ShieldCheck,
  };
}

export default function HealthFactorHero({ position }: HealthFactorHeroProps) {
  if (!position) return null;

  // Prefer the protocol-reported health factor (Aave) for the live view; fall
  // back to the locally computed value (Kamino, and all simulated positions).
  const hf = position.reportedHealthFactor ?? position.healthFactor;
  const tier = getTier(hf, position.hasDebt);
  const { Icon } = tier;

  // Fraction collateral can fall before liquidation, as a 0–100 bar.
  const buffer = Math.min(1, Math.max(0, position.dropToLiquidation)) * 100;

  return (
    <div
      className={`rounded-xl border ${tier.border} ${tier.glow} bg-glass-card p-6 transition-colors`}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Primary: the health factor itself */}
        <div className="flex items-center gap-5">
          <div
            className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border ${tier.border} ${tier.bg}`}
          >
            <Icon className={`h-7 w-7 ${tier.text} ${tier.pulse ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-slate-400">
              Health Factor
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tier.bg} ${tier.text}`}>
                {tier.label}
              </span>
            </div>
            <div
              className={`mt-1 font-sans text-5xl font-extrabold tabular-nums tracking-tight ${tier.text} ${
                tier.pulse ? 'animate-pulse' : ''
              }`}
            >
              {hf === Infinity ? '∞' : hf.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Supporting: safety buffer + LTV context */}
        {position.hasDebt ? (
          <div className="w-full md:max-w-xs">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="uppercase tracking-wider">Safety Buffer</span>
              <span className={`font-bold tabular-nums ${tier.text}`}>{buffer.toFixed(0)}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${tier.bar} transition-all duration-500`}
                style={{ width: `${buffer}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Collateral can fall{' '}
              <span className={`font-semibold tabular-nums ${tier.text}`}>{buffer.toFixed(0)}%</span> before
              liquidation
            </div>
            <div className="mt-1 flex gap-4 text-[11px] font-mono text-slate-500">
              <span>
                LTV <span className="tabular-nums text-slate-300">{(position.currentLtv * 100).toFixed(1)}%</span>
              </span>
              <span>
                Liq. LTV{' '}
                <span className="tabular-nums text-slate-300">{(position.liquidationLtv * 100).toFixed(1)}%</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 md:max-w-xs md:text-right">
            No outstanding debt — this position cannot be liquidated.
          </div>
        )}
      </div>
    </div>
  );
}
