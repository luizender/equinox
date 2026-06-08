'use client';

import React from 'react';
import { Position } from '@/lib/math-engine';
import { getMarketMeta } from '@/lib/markets';
import { Layers } from 'lucide-react';

interface MarketSelectorProps {
  positions: Position[];
  selectedMarketId: string;
  onSelectPosition: (pos: Position) => void;
}

export default function MarketSelector({
  positions,
  selectedMarketId,
  onSelectPosition,
}: MarketSelectorProps) {
  const formatUsd = (val: number) =>
    val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`;

  const healthDot = (health: number) => {
    if (health === Infinity || isNaN(health)) return 'bg-slate-500';
    if (health >= 2.0) return 'bg-emerald-400';
    if (health >= 1.2) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  return (
    <div className="rounded-xl bg-glass-card border border-slate-800/80 shadow-lg p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00f2fe]" />
          Your Open Positions
        </h3>
        <span className="text-[10px] text-slate-400 font-mono">
          {positions.length} market{positions.length === 1 ? '' : 's'} · select one to analyze
        </span>
      </div>

      {/* Wrapping pill bar — every market stays visible, no horizontal scroll */}
      <div className="flex flex-wrap gap-2.5">
        {positions.map((pos) => {
          const meta = getMarketMeta(pos.marketId);
          const isSelected = pos.marketId === selectedMarketId;
          const badge = meta.isKamino
            ? 'bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/20'
            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';

          return (
            <button
              key={pos.marketId}
              onClick={() => onSelectPosition(pos)}
              className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/60 border-[#00f2fe]/50 shadow-[0_0_0_1px_rgba(0,242,254,0.15)]'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <span
                className={`flex h-2 w-2 flex-shrink-0 rounded-full ${healthDot(pos.healthFactor)} ${
                  pos.hasDebt && pos.healthFactor < 1.2 ? 'animate-pulse' : ''
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${badge}`}>
                    {meta.protocol}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${
                      isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {pos.marketName}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>{meta.network}</span>
                  <span className="text-slate-600">•</span>
                  <span>{formatUsd(pos.depositValue)} collat</span>
                  {pos.hasDebt && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>HF {pos.healthFactor === Infinity ? '∞' : pos.healthFactor.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
