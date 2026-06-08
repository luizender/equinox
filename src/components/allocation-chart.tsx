'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Position } from '@/lib/math-engine';

interface AllocationChartProps {
  positions: Position[];
}

const COLORS = [
  '#00f2fe', // neon cyan
  '#9b51e0', // electric purple
  '#10b981', // emerald green
  '#ec4899', // hot pink
  '#f59e0b', // amber yellow
  '#3b82f6', // blue
  '#ef4444', // crimson red
  '#84cc16', // lime green
];

export default function AllocationChart({ positions }: AllocationChartProps) {
  // Aggregate collateral by symbol
  const tokenTotals: Record<string, { symbol: string; value: number }> = {};
  let totalValue = 0;

  positions.forEach((pos) => {
    pos.collateral.forEach((c) => {
      const sym = c.symbol.toUpperCase();
      const val = c.value;
      if (val > 0) {
        if (!tokenTotals[sym]) {
          tokenTotals[sym] = { symbol: c.symbol, value: 0 };
        }
        tokenTotals[sym].value += val;
        totalValue += val;
      }
    });
  });

  const data = Object.values(tokenTotals).sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="h-64 rounded-xl bg-glass-card border border-slate-800/80 p-5 flex flex-col items-center justify-center text-slate-500 text-sm">
        No collateral assets found
      </div>
    );
  }

  const formatUsd = (val: number) => {
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const formatPct = (val: number) => {
    if (totalValue === 0) return '0%';
    return `${((val / totalValue) * 100).toFixed(1)}%`;
  };

  return (
    <div className="rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-200 tracking-wide mb-4 uppercase">Collateral Allocation</h3>
      
      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 min-h-[200px]">
        {/* Doughnut Chart container */}
        <div className="w-44 h-44 relative flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="rgba(6, 9, 19, 0.8)"
                    strokeWidth={2}
                    className="focus:outline-none"
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 text-xs font-mono shadow-2xl">
                        <p className="font-semibold text-slate-200">{item.symbol}</p>
                        <p className="text-slate-400 mt-0.5">Value: {formatUsd(item.value)}</p>
                        <p className="text-[#00f2fe] mt-0.5">Ratio: {formatPct(item.value)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Central label inside Doughnut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Total Collateral</span>
            <span className="text-base font-bold text-slate-100 font-mono mt-0.5">{formatUsd(totalValue)}</span>
          </div>
        </div>

        {/* Legend listing assets with colors & ratios */}
        <div className="flex-1 w-full max-h-56 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2.5">
            {data.map((item, index) => {
              const color = COLORS[index % COLORS.length];
              return (
                <div key={item.symbol} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="font-medium text-slate-200">{item.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-400">{formatUsd(item.value)}</span>
                    <span className="font-semibold" style={{ color: color }}>{formatPct(item.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
