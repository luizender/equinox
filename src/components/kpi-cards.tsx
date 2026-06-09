'use client';

import { ArrowDownRight, ArrowUpRight, DollarSign, Percent } from 'lucide-react';
import { Position } from '@/lib/math-engine';

// Net-worth-weighted average of the protocol-reported net APY across positions
// that expose one (Aave). Returns null when none do (e.g. Kamino), so the
// caller computes from per-asset rates instead.
function reportedNetApy(posList: Position[]): number | null {
  const withReported = posList.filter((p) => p.reportedNetApy != null);
  if (withReported.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const p of withReported) {
    const borrowValue = p.borrows.reduce((sum, b) => sum + b.value, 0);
    const weight = p.depositValue - borrowValue;
    weightedSum += (p.reportedNetApy as number) * weight;
    weightTotal += weight;
  }
  return weightTotal !== 0 ? weightedSum / weightTotal : (withReported[0].reportedNetApy as number);
}

interface KpiCardsProps {
  positions: Position[];
  simulatedPositions?: Position[];
  isSimulating: boolean;
}

export default function KpiCards({ positions, simulatedPositions, isSimulating }: KpiCardsProps) {
  // Calculations helper
  const calculateMetrics = (posList: Position[]) => {
    let totalCollateral = 0;
    let totalDebt = 0;
    let weightedDepositYield = 0;
    let weightedBorrowCost = 0;
    let borrowValue = 0; // actual (unadjusted) borrow value, for APY math

    posList.forEach((pos) => {
      pos.collateral.forEach((c) => {
        const val = c.value;
        totalCollateral += val;
        weightedDepositYield += val * c.supplyApy;
      });
      pos.borrows.forEach((b) => {
        const val = b.value;
        weightedBorrowCost += val * b.borrowApy;
        borrowValue += val;
      });
      totalDebt += pos.debtValue;
    });

    const netWorth = totalCollateral - totalDebt;
    const depositApy = totalCollateral > 0 ? weightedDepositYield / totalCollateral : 0;
    const borrowApy = borrowValue > 0 ? weightedBorrowCost / borrowValue : 0;

    // Net APY = (Yield USD - Cost USD) / Net Worth, using actual borrow value so
    // borrow factors don't distort the denominator. Prefer the protocol-reported
    // figure when present (exact, and folds in incentives); otherwise compute it.
    const apyNetWorth = totalCollateral - borrowValue;
    const computedNetApy =
      apyNetWorth !== 0 ? (weightedDepositYield - weightedBorrowCost) / apyNetWorth : 0;
    const netApy = reportedNetApy(posList) ?? computedNetApy;

    return { totalCollateral, totalDebt, netWorth, netApy, depositApy, borrowApy };
  };

  const current = calculateMetrics(positions);
  const simulated = simulatedPositions ? calculateMetrics(simulatedPositions) : current;

  const active = isSimulating ? simulated : current;

  // Format Helper
  const formatUsd = (val: number) => {
    if (Math.abs(val) >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(2)}M`;
    }
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPct = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  // Sparkline data generation (just placeholder curves for design beauty)
  const drawSparkline = (type: 'net' | 'collateral' | 'debt' | 'apy') => {
    const pointsMap = {
      net: [10, 15, 12, 18, 25, 20, 28],
      collateral: [12, 14, 18, 22, 21, 25, 30],
      debt: [5, 9, 8, 12, 10, 11, 9],
      apy: [15, 12, 16, 14, 19, 17, 21],
    };
    const pts = pointsMap[type];
    const width = 80;
    const height = 25;
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const spread = max - min || 1;
    
    return pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * width;
        const y = height - ((p - min) / spread) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Net Worth */}
      <div className="relative overflow-hidden rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg group hover:border-[#00f2fe]/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#00f2fe]/5 rounded-full blur-2xl group-hover:bg-[#00f2fe]/10 transition-all"></div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium tracking-wide">MARKET NET VALUE</span>
          <div className="w-7 h-7 rounded bg-[#00f2fe]/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-[#00f2fe]" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100 tracking-tight font-mono tabular-nums">
            {formatUsd(active.netWorth)}
          </span>
          {isSimulating && simulated.netWorth !== current.netWorth && (
            <span className={`text-xs font-semibold flex items-center font-mono ${
              simulated.netWorth >= current.netWorth ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {simulated.netWorth >= current.netWorth ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatUsd(Math.abs(simulated.netWorth - current.netWorth))}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">Simulated Net Equity</span>
          <svg className="w-20 h-6" viewBox="0 0 80 25">
            <polyline
              fill="none"
              stroke="#00f2fe"
              strokeWidth="1.5"
              points={drawSparkline('net')}
            />
          </svg>
        </div>
      </div>

      {/* 2. Total Collateral */}
      <div className="relative overflow-hidden rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg group hover:border-emerald-500/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium tracking-wide">TOTAL COLLATERAL</span>
          <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100 tracking-tight font-mono tabular-nums">
            {formatUsd(active.totalCollateral)}
          </span>
          {isSimulating && simulated.totalCollateral !== current.totalCollateral && (
            <span className={`text-xs font-semibold flex items-center font-mono ${
              simulated.totalCollateral >= current.totalCollateral ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {simulated.totalCollateral >= current.totalCollateral ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatUsd(Math.abs(simulated.totalCollateral - current.totalCollateral))}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">Yield Avg: {formatPct(active.depositApy)}</span>
          <svg className="w-20 h-6" viewBox="0 0 80 25">
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              points={drawSparkline('collateral')}
            />
          </svg>
        </div>
      </div>

      {/* 3. Total Debt */}
      <div className="relative overflow-hidden rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg group hover:border-purple-500/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium tracking-wide">TOTAL ADJUSTED DEBT</span>
          <div className="w-7 h-7 rounded bg-purple-500/10 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4 text-purple-400" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100 tracking-tight font-mono tabular-nums">
            {formatUsd(active.totalDebt)}
          </span>
          {isSimulating && simulated.totalDebt !== current.totalDebt && (
            <span className={`text-xs font-semibold flex items-center font-mono ${
              simulated.totalDebt <= current.totalDebt ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {simulated.totalDebt <= current.totalDebt ? <ArrowDownRight className="w-3 h-3 text-emerald-400" /> : <ArrowUpRight className="w-3 h-3 text-rose-400" />}
              {formatUsd(Math.abs(simulated.totalDebt - current.totalDebt))}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">Borrow Avg: {formatPct(active.borrowApy)}</span>
          <svg className="w-20 h-6" viewBox="0 0 80 25">
            <polyline
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.5"
              points={drawSparkline('debt')}
            />
          </svg>
        </div>
      </div>

      {/* 4. Global Net APY */}
      <div className="relative overflow-hidden rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg group hover:border-pink-500/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition-all"></div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium tracking-wide">MARKET NET APY</span>
          <div className="w-7 h-7 rounded bg-pink-500/10 flex items-center justify-center">
            <Percent className="w-4 h-4 text-pink-400" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
            active.netApy >= 0 ? 'text-slate-100' : 'text-rose-400'
          }`}>
            {formatPct(active.netApy)}
          </span>
          {isSimulating && simulated.netApy !== current.netApy && (
            <span className={`text-xs font-semibold flex items-center font-mono ${
              simulated.netApy >= current.netApy ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {simulated.netApy >= current.netApy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatPct(Math.abs(simulated.netApy - current.netApy))}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">Weighted Market APY</span>
          <svg className="w-20 h-6" viewBox="0 0 80 25">
            <polyline
              fill="none"
              stroke="#ec4899"
              strokeWidth="1.5"
              points={drawSparkline('apy')}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
