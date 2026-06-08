'use client';

import React, { useState } from 'react';
import { Position, singleAssetLevels, crashScenario, CrashStatus } from '@/lib/math-engine';
import { AlertCircle, AlertTriangle, ShieldCheck, TrendingDown } from 'lucide-react';

interface LiquidationViewsProps {
  position: Position | null;
}

export default function LiquidationViews({ position }: LiquidationViewsProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'crash'>('single');

  if (!position) {
    return (
      <div className="rounded-xl bg-glass-card border border-slate-800/80 p-6 shadow-lg flex flex-col items-center justify-center text-slate-500 text-sm h-64">
        Select a position to view liquidation scenarios
      </div>
    );
  }

  const levels = singleAssetLevels(position);
  const crash = crashScenario(position);

  const formatUsd = (val: number) => {
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBufferColorClass = (buffer: number) => {
    if (buffer >= 0.3) return 'bg-emerald-500';
    if (buffer >= 0.12) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getBufferTextColorClass = (buffer: number) => {
    if (buffer >= 0.3) return 'text-emerald-400';
    if (buffer >= 0.12) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg flex flex-col">
      {/* Header and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/50 pb-4 mb-5 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">Liquidation Analysis</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{position.marketName}</p>
        </div>
        
        {/* Tab Buttons */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Single Asset Drop
          </button>
          <button
            onClick={() => setActiveTab('crash')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'crash'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Global Market Crash
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {/* TAB 1: Single Asset Drop */}
        {activeTab === 'single' && (
          <div className="space-y-4">
            {levels.map((lvl) => {
              const isSafe = lvl.price === null || lvl.buffer === null;
              
              return (
                <div
                  key={lvl.collateral.symbol}
                  className="rounded-lg bg-slate-900/40 border border-slate-800/60 p-4 hover:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-sm">{lvl.collateral.symbol}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {lvl.collateral.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
                      </span>
                    </div>

                    {isSafe ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                        SAFE AT $0
                      </span>
                    ) : (
                      <span className={`text-xs font-bold font-mono ${getBufferTextColorClass(lvl.buffer!)}`}>
                        -{(lvl.buffer! * 100).toFixed(1)}% drop
                      </span>
                    )}
                  </div>

                  {/* Prices & Buffer Bar */}
                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Current Price</div>
                      <div className="text-slate-300 text-sm font-semibold mt-0.5">{formatUsd(lvl.collateral.price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Liquidation Price</div>
                      <div className="text-slate-300 text-sm font-semibold mt-0.5">
                        {isSafe ? '$0.00' : formatUsd(lvl.price!)}
                      </div>
                    </div>
                  </div>

                  {/* Buffer Progress Bar */}
                  {!isSafe && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                        <span>Drop Buffer</span>
                        <span className={getBufferTextColorClass(lvl.buffer!)}>
                          {(lvl.buffer! * 100).toFixed(1)}% remaining
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getBufferColorClass(lvl.buffer!)}`}
                          style={{ width: `${Math.min(100, lvl.buffer! * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Global Market Crash */}
        {activeTab === 'crash' && (
          <div className="space-y-4">
            {/* Status Card */}
            {crash.status === CrashStatus.SAFE && (
              <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-4 flex gap-3 items-start">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400">Peg-Stable Collateral Coverage</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    All debt is covered by stablecoin collateral. No market drop in volatile assets can trigger liquidation.
                  </p>
                </div>
              </div>
            )}

            {crash.status === CrashStatus.EXCEEDED && (
              <div className="rounded-lg bg-rose-950/20 border border-rose-500/20 p-4 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-400">Insolvent Stable Collateral</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Total debt exceeds the liquidation threshold of your stablecoin deposits. Volatile assets are insufficient to buffer.
                  </p>
                </div>
              </div>
            )}

            {crash.status === CrashStatus.AT_RISK && (
              <div className="rounded-lg bg-rose-950/20 border border-rose-500/20 p-4 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-400">Position At Risk</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Your position is already at or past the liquidation threshold (Health Factor &lt; 1.0).
                  </p>
                </div>
              </div>
            )}

            {crash.status === CrashStatus.VOLATILE_DEBT && (
              <div className="rounded-lg bg-amber-950/20 border border-amber-500/20 p-4 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-400">Volatile Debt Detected</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Position contains volatile borrowed assets. A uniform crash drop is not mathematically defined for both assets simultaneously. Please use the simulation panel to test individual price drops.
                  </p>
                </div>
              </div>
            )}

            {crash.status === CrashStatus.TRIGGERABLE && (
              <>
                {/* Trigger Banner */}
                <div className="rounded-lg bg-[#9b51e0]/10 border border-[#9b51e0]/20 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#9b51e0]/20 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-[#9b51e0]" />
                    </div>
                    <div>
                      <h4 className="text-xs text-slate-400 font-mono uppercase tracking-wide">Crash Liquidation Drop</h4>
                      <p className="text-base font-bold text-slate-200 mt-0.5">Uniform drop in volatile assets</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    -{(crash.drop! * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Crash Prices list */}
                <div className="rounded-lg border border-slate-800/80 overflow-hidden bg-slate-900/10">
                  <div className="px-4 py-2 bg-slate-900/40 text-[10px] text-slate-500 font-mono uppercase tracking-wider border-b border-slate-800">
                    Asset Prices at Crash Point
                  </div>
                  <div className="divide-y divide-slate-800/30">
                    {crash.prices!.map(([col, crashPrice]) => (
                      <div key={col.symbol} className="px-4 py-3 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="font-semibold text-slate-200">{col.symbol}</span>
                          <span className="text-slate-500 text-[10px] ml-2 font-sans">
                            {col.isStable ? 'Stable' : 'Volatile'}
                          </span>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <span className="text-slate-500">Current: </span>
                            <span className="text-slate-400">{formatUsd(col.price)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Crash: </span>
                            <span className={col.isStable ? 'text-slate-400 font-semibold' : 'text-rose-400 font-semibold'}>
                              {formatUsd(crashPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
