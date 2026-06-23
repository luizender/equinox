'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Position, Collateral, Borrow, AmountChange, applyOverrides } from '@/lib/math-engine';
import { Slider } from '@/components/ui/slider';
import { RefreshCw, Trash2, Plus, Info, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

interface SimulationPanelProps {
  position: Position | null;
  onSimulationChange: (simPosition: Position | null) => void;
  setIsSimulating: (simulating: boolean) => void;
}

interface AmountState {
  value: number;
  isDelta: boolean;
}

export default function SimulationPanel({
  position,
  onSimulationChange,
  setIsSimulating,
}: SimulationPanelProps) {
  // Price overrides by uppercase symbol
  const [prices, setPrices] = useState<Record<string, number>>({});
  // Collateral changes by uppercase symbol
  const [collateralAmounts, setCollateralAmounts] = useState<Record<string, AmountState>>({});
  // Borrow changes by uppercase symbol
  const [borrowAmounts, setBorrowAmounts] = useState<Record<string, AmountState>>({});
  
  // Added assets
  const [addedCollateral, setAddedCollateral] = useState<Collateral[]>([]);
  const [addedBorrows, setAddedBorrows] = useState<Borrow[]>([]);
  
  // Add Asset form state
  const [newSymbol, setNewSymbol] = useState('');
  const [newType, setNewType] = useState<'collateral' | 'borrow'>('collateral');
  const [resolvingReserve, setResolvingReserve] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // Clearing the override inputs cascades through the memo + notify effect below,
  // which resets the simulated position and tells the parent simulation is off.
  const handleClear = () => {
    setPrices({});
    setCollateralAmounts({});
    setBorrowAmounts({});
    setAddedCollateral([]);
    setAddedBorrows([]);
    setNewSymbol('');
    setResolveError('');
  };

  // The simulated position is a pure function of the position + override inputs —
  // derive it (and whether anything changed) instead of storing it in state.
  const { simulatedPosition, hasChanges } = useMemo(() => {
    if (!position) return { simulatedPosition: null as Position | null, hasChanges: false };

    const changed =
      Object.keys(prices).length > 0 ||
      Object.keys(collateralAmounts).length > 0 ||
      Object.keys(borrowAmounts).length > 0 ||
      addedCollateral.length > 0 ||
      addedBorrows.length > 0;

    if (!changed) return { simulatedPosition: null as Position | null, hasChanges: false };

    const colChanges: Record<string, AmountChange> = {};
    Object.entries(collateralAmounts).forEach(([sym, state]) => {
      colChanges[sym] = new AmountChange(state.value, state.isDelta);
    });
    const borChanges: Record<string, AmountChange> = {};
    Object.entries(borrowAmounts).forEach(([sym, state]) => {
      borChanges[sym] = new AmountChange(state.value, state.isDelta);
    });

    const simPos = applyOverrides(position, {
      prices,
      collateralAmounts: colChanges,
      borrowAmounts: borChanges,
      addCollateral: addedCollateral,
      addBorrows: addedBorrows,
    });
    return { simulatedPosition: simPos, hasChanges: true };
  }, [position, prices, collateralAmounts, borrowAmounts, addedCollateral, addedBorrows]);

  // Push the derived result up so sibling panels (KPIs, allocation, liquidation)
  // can react. onSimulationChange/setIsSimulating are stable parent state setters.
  useEffect(() => {
    onSimulationChange(simulatedPosition);
    setIsSimulating(hasChanges);
  }, [simulatedPosition, hasChanges, onSimulationChange, setIsSimulating]);

  if (!position) {
    return (
      <div className="rounded-xl bg-glass-card border border-slate-800/80 p-6 shadow-lg flex flex-col items-center justify-center text-slate-500 text-sm h-96">
        Select a position to load the What-If Simulation
      </div>
    );
  }

  // --------------------------------------------------------------------------- //
  // Amount adjustment handlers
  // --------------------------------------------------------------------------- //

  const handleAmountChange = (
    symbol: string,
    type: 'collateral' | 'borrow',
    value: number,
    isDelta: boolean,
    originalAmount: number
  ) => {
    const sym = symbol.toUpperCase();
    const setter = type === 'collateral' ? setCollateralAmounts : setBorrowAmounts;
    
    // Check if it is the default state
    const isDefault = isDelta ? value === 0 : value === originalAmount;

    if (isDefault) {
      setter((prev) => {
        const copy = { ...prev };
        delete copy[sym];
        return copy;
      });
    } else {
      setter((prev) => ({
        ...prev,
        [sym]: { value, isDelta },
      }));
    }
  };

  const toggleDeltaMode = (
    symbol: string,
    type: 'collateral' | 'borrow',
    currentState: AmountState | undefined,
    originalAmount: number
  ) => {
    const sym = symbol.toUpperCase();
    const setter = type === 'collateral' ? setCollateralAmounts : setBorrowAmounts;

    if (!currentState) {
      // Toggle from absolute (default) to delta
      setter((prev) => ({
        ...prev,
        [sym]: { value: 0, isDelta: true },
      }));
    } else {
      // Convert value
      const newVal = currentState.isDelta
        ? Math.max(0, originalAmount + currentState.value) // delta -> absolute
        : currentState.value - originalAmount; // absolute -> delta
      
      setter((prev) => ({
        ...prev,
        [sym]: { value: newVal, isDelta: !currentState.isDelta },
      }));
    }
  };

  // --------------------------------------------------------------------------- //
  // Price adjustment handlers
  // --------------------------------------------------------------------------- //

  const handlePriceChange = (symbol: string, value: number, originalPrice: number) => {
    const sym = symbol.toUpperCase();
    if (value === originalPrice || value < 0) {
      setPrices((prev) => {
        const copy = { ...prev };
        delete copy[sym];
        return copy;
      });
    } else {
      setPrices((prev) => ({
        ...prev,
        [sym]: value,
      }));
    }
  };

  // --------------------------------------------------------------------------- //
  // Dynamic Reserve Loader (Add Asset)
  // --------------------------------------------------------------------------- //

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;
    setResolveError('');
    setResolvingReserve(true);

    const isKamino = position.marketId.includes('MKT') || !position.marketId.includes(':');
    const protocol = isKamino ? 'kamino' : 'aave';

    // Check if asset already exists in position or added list
    const symUpper = newSymbol.toUpperCase();
    const existsInCollateral =
      position.collateral.some((c) => c.symbol.toUpperCase() === symUpper) ||
      addedCollateral.some((c) => c.symbol.toUpperCase() === symUpper);
    const existsInBorrows =
      position.borrows.some((b) => b.symbol.toUpperCase() === symUpper) ||
      addedBorrows.some((b) => b.symbol.toUpperCase() === symUpper);

    if (newType === 'collateral' && existsInCollateral) {
      setResolveError(`${newSymbol} already exists in collateral.`);
      setResolvingReserve(false);
      return;
    }
    if (newType === 'borrow' && existsInBorrows) {
      setResolveError(`${newSymbol} already exists in borrows.`);
      setResolvingReserve(false);
      return;
    }

    try {
      const url = `/api/reserve?protocol=${protocol}&marketId=${encodeURIComponent(
        position.marketId
      )}&symbol=${encodeURIComponent(newSymbol)}&user=${encodeURIComponent(position.address)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to resolve reserve: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data || data.error) {
        throw new Error(data?.error || 'Reserve not found in market catalog.');
      }

      // Append asset
      if (newType === 'collateral') {
        const newCol = new Collateral(
          data.symbol,
          0, // Starts at 0 amount
          data.price,
          data.liquidationThreshold
        );
        setAddedCollateral((prev) => [...prev, newCol]);
      } else {
        const newBor = new Borrow(
          data.symbol,
          0, // Starts at 0 amount
          data.price,
          data.borrowFactor
        );
        setAddedBorrows((prev) => [...prev, newBor]);
      }

      setNewSymbol('');
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to add asset');
    } finally {
      setResolvingReserve(false);
    }
  };

  const removeAddedAsset = (symbol: string, type: 'collateral' | 'borrow') => {
    const symUpper = symbol.toUpperCase();
    if (type === 'collateral') {
      setAddedCollateral((prev) => prev.filter((c) => c.symbol.toUpperCase() !== symUpper));
      // Delete any overrides
      setCollateralAmounts((prev) => {
        const copy = { ...prev };
        delete copy[symUpper];
        return copy;
      });
    } else {
      setAddedBorrows((prev) => prev.filter((b) => b.symbol.toUpperCase() !== symUpper));
      setBorrowAmounts((prev) => {
        const copy = { ...prev };
        delete copy[symUpper];
        return copy;
      });
    }
    setPrices((prev) => {
      const copy = { ...prev };
      delete copy[symUpper];
      return copy;
    });
  };

  // --------------------------------------------------------------------------- //
  // Rendering helpers
  // --------------------------------------------------------------------------- //

  const renderAssetControls = (
    symbol: string,
    originalAmount: number,
    originalPrice: number,
    type: 'collateral' | 'borrow',
    isAdded = false
  ) => {
    const symUpper = symbol.toUpperCase();
    const amtState = type === 'collateral' ? collateralAmounts[symUpper] : borrowAmounts[symUpper];
    const currentPrice = prices[symUpper] !== undefined ? prices[symUpper] : originalPrice;
    
    // Amount parameters
    const isDelta = amtState?.isDelta ?? false;
    const amountVal = amtState !== undefined ? amtState.value : (isDelta ? 0 : originalAmount);
    const resolvedAmount = isDelta ? Math.max(0, originalAmount + amountVal) : amountVal;

    // Sliders thresholds
    const maxAmtMultiplier = 3;
    const maxAmountSlider = Math.max(10, originalAmount * maxAmtMultiplier);
    const minAmountSlider = isDelta ? -originalAmount : 0;
    const maxPriceSlider = Math.max(10, originalPrice * 3);

    return (
      <div key={symbol} className="border-b border-slate-800/30 py-4 last:border-b-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">{symbol}</span>
            {isAdded && (
              <span className="px-1.5 py-0.5 rounded text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-bold">
                Added
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Toggle Absolute vs Delta */}
            <button
              onClick={() => toggleDeltaMode(symbol, type, amtState, originalAmount)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                isDelta
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle adjustment mode (+/- offsets vs absolute value)"
            >
              {isDelta ? 'Delta Offset' : 'Absolute'}
            </button>
            
            {/* Reset buttons */}
            {(amtState !== undefined || currentPrice !== originalPrice || isAdded) && (
              <button
                onClick={() => {
                  if (isAdded) {
                    removeAddedAsset(symbol, type);
                  } else {
                    setCollateralAmounts((prev) => {
                      const copy = { ...prev };
                      delete copy[symUpper];
                      return copy;
                    });
                    setBorrowAmounts((prev) => {
                      const copy = { ...prev };
                      delete copy[symUpper];
                      return copy;
                    });
                    setPrices((prev) => {
                      const copy = { ...prev };
                      delete copy[symUpper];
                      return copy;
                    });
                  }
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={isAdded ? "Remove added asset" : "Reset symbol simulation"}
              >
                {isAdded ? <Trash2 className="w-3.5 h-3.5 text-rose-400" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-3">
          {/* Amount parameter */}
          <div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-1.5">
              <span>Simulated Amount</span>
              <span className="text-slate-300">
                {resolvedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                {isDelta && ` (${amountVal >= 0 ? '+' : ''}${amountVal.toLocaleString(undefined, { maximumFractionDigits: 4 })})`}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Slider */}
              <div className="flex-1 px-1 min-w-0">
                <Slider
                  min={minAmountSlider}
                  max={maxAmountSlider}
                  step={maxAmountSlider / 100}
                  value={[Math.min(Math.max(amountVal, minAmountSlider), maxAmountSlider)]}
                  onValueChange={(val) => {
                    const num = Array.isArray(val) ? val[0] : val;
                    handleAmountChange(symbol, type, num, isDelta, originalAmount);
                  }}
                />
              </div>
              {/* Precise input */}
              <input
                type="number"
                value={amountVal === 0 ? '' : parseFloat(amountVal.toFixed(6))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handleAmountChange(symbol, type, val, isDelta, originalAmount);
                }}
                className="w-20 h-7 rounded bg-slate-950 border border-slate-800 text-right pr-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#00f2fe]/40"
              />
            </div>
          </div>

          {/* Price parameter */}
          <div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-1.5">
              <span>Simulated Price</span>
              <span className="text-slate-300">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Slider */}
              <div className="flex-1 px-1">
                <Slider
                  min={0}
                  max={maxPriceSlider}
                  step={maxPriceSlider / 100}
                  value={[currentPrice]}
                  onValueChange={(val) => {
                    const num = Array.isArray(val) ? val[0] : val;
                    handlePriceChange(symbol, num, originalPrice);
                  }}
                />
              </div>
              {/* Precise input */}
              <input
                type="number"
                value={currentPrice === 0 ? '' : parseFloat(currentPrice.toFixed(4))}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  handlePriceChange(symbol, val, originalPrice);
                }}
                className="w-20 h-7 rounded bg-slate-950 border border-slate-800 text-right pr-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#00f2fe]/40"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isSolana = position.marketId.includes('MKT') || !position.marketId.includes(':');
  const addAssetPlaceholder = isSolana ? 'e.g. USDC, SOL, JupSOL' : 'e.g. USDC, DAI, WBTC';

  return (
    <div className="rounded-xl bg-glass-card border border-slate-800/80 p-5 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">What-If Simulation</h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Override parameters to test health outcomes</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-400 hover:bg-rose-900/40 text-xs font-semibold font-mono cursor-pointer transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Comparison Engine Banner */}
      {hasChanges && simulatedPosition && (
        <div className="mb-4 p-4 rounded-lg bg-slate-900/60 border border-[#00f2fe]/20 shadow-glow-cyan">
          <div className="text-[10px] text-[#00f2fe] font-bold font-mono tracking-widest uppercase mb-2">
            Simulated Health Status
          </div>
          {/* Health Factor — primary risk indicator */}
          <div className={`mb-3 rounded-xl border p-4 text-center transition-colors ${
            simulatedPosition.healthFactor < 1.0
              ? 'border-rose-500/40 bg-rose-500/5 shadow-glow-rose'
              : simulatedPosition.healthFactor < 1.2
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
          }`}>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              {simulatedPosition.healthFactor < 1.2 ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <ShieldCheck className="w-3 h-3" />
              )}
              Health Factor
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-lg font-semibold font-sans tabular-nums text-slate-500">
                {(() => {
                  const baseHf = position.reportedHealthFactor ?? position.healthFactor;
                  return baseHf === Infinity ? '∞' : baseHf.toFixed(2);
                })()}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span className={`text-4xl font-extrabold font-sans tabular-nums tracking-tight ${
                simulatedPosition.healthFactor < 1.0
                  ? 'text-rose-400 animate-pulse'
                  : simulatedPosition.healthFactor < 1.2
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {simulatedPosition.healthFactor === Infinity ? '∞' : simulatedPosition.healthFactor.toFixed(2)}
              </span>
            </div>
            <div className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
              simulatedPosition.healthFactor < 1.0
                ? 'text-rose-400 animate-pulse'
                : simulatedPosition.healthFactor < 1.2
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {simulatedPosition.healthFactor < 1.0
                ? 'Liquidation Risk'
                : simulatedPosition.healthFactor < 1.2
                ? 'At Risk'
                : 'Safe'}
            </div>
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {/* Current LTV */}
            <div className="border-r border-slate-800/60 pr-1">
              <div className="text-[8px] text-slate-500 uppercase font-mono">Current LTV</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {(position.currentLtv * 100).toFixed(1)}%
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-sm font-bold font-mono tabular-nums text-slate-200">
                  {(simulatedPosition.currentLtv * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Net Value */}
            <div className="px-1">
              <div className="text-[8px] text-slate-500 uppercase font-mono">Net Value</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  ${position.netValue >= 1000 ? `${(position.netValue / 1000).toFixed(1)}k` : position.netValue.toFixed(0)}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className={`text-sm font-bold font-mono tabular-nums ${
                  simulatedPosition.netValue >= position.netValue ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ${simulatedPosition.netValue >= 1000 ? `${(simulatedPosition.netValue / 1000).toFixed(1)}k` : simulatedPosition.netValue.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
 
      <div className="flex-1 space-y-4">
        {/* COLLATERAL SECTION */}
        <div>
          <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1 border-b border-slate-800/60 pb-1 flex justify-between">
            <span>Collateral Deposits</span>
            <span className="text-[9px] font-medium font-mono text-slate-500">Overrides count to Ltv limit</span>
          </div>
          {position.collateral.map((c) =>
            renderAssetControls(c.symbol, c.amount, c.price, 'collateral')
          )}
          {addedCollateral.map((c) =>
            renderAssetControls(c.symbol, c.amount, c.price, 'collateral', true)
          )}
        </div>

        {/* BORROWS SECTION */}
        {position.borrows.length > 0 || addedBorrows.length > 0 ? (
          <div>
            <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1 border-b border-slate-800/60 pb-1 flex justify-between">
              <span>Borrowed Debt</span>
              <span className="text-[9px] font-medium font-mono text-slate-500">Overrides count to Debt value</span>
            </div>
            {position.borrows.map((b) =>
              renderAssetControls(b.symbol, b.amount, b.price, 'borrow')
            )}
            {addedBorrows.map((b) =>
              renderAssetControls(b.symbol, b.amount, b.price, 'borrow', true)
            )}
          </div>
        ) : null}

        {/* ADD ASSET SECTION */}
        <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3.5">
          <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5 text-[#00f2fe]" />
            <span>Add Asset to Position</span>
          </div>

          <form onSubmit={handleAddAsset} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={addAssetPlaceholder}
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="h-8 rounded bg-slate-900 border border-slate-800 text-xs px-2.5 text-slate-200 focus:outline-none focus:border-[#00f2fe]/40 placeholder-slate-600"
              />
              
              <div className="flex rounded bg-slate-900 p-0.5 border border-slate-850">
                <button
                  type="button"
                  onClick={() => setNewType('collateral')}
                  className={`flex-1 text-[10px] font-semibold rounded py-1 transition-all cursor-pointer ${
                    newType === 'collateral'
                      ? 'bg-slate-800 text-slate-200'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Collateral
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('borrow')}
                  className={`flex-1 text-[10px] font-semibold rounded py-1 transition-all cursor-pointer ${
                    newType === 'borrow'
                      ? 'bg-slate-800 text-slate-200'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Borrow
                </button>
              </div>
            </div>

            {resolveError && (
              <p className="text-[10px] text-red-400 font-mono flex items-center gap-1">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>{resolveError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={resolvingReserve || !newSymbol}
              className="w-full h-8 rounded bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {resolvingReserve ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Add to Simulation</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
