'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Position, Collateral, Borrow } from '@/lib/math-engine';
import { validateAddress } from '@/lib/validation';
import { addRecentWallet } from '@/lib/recent-wallets';
import type { PortfolioPosition } from '@/types';
import DashboardHeader from '@/components/dashboard-header';
import KpiCards from '@/components/kpi-cards';
import HealthFactorHero from '@/components/health-factor-hero';
import AllocationChart from '@/components/allocation-chart';
import MarketSelector from '@/components/market-selector';
import LiquidationViews from '@/components/liquidation-views';
import SimulationPanel from '@/components/simulation-panel';
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

// Convert the API's plain JSON positions into rich Position instances.
function parsePositions(rawPositions: PortfolioPosition[]): Position[] {
  return rawPositions.map((p) => {
    const colList = p.collateral.map(
      (c) => new Collateral(c.symbol, c.amount, c.price, c.liquidationThreshold, c.supplyApy)
    );
    const borList = p.borrows.map(
      (b) => new Borrow(b.symbol, b.amount, b.price, b.borrowFactor, b.borrowApy)
    );
    return new Position(
      p.marketName,
      p.address,
      colList,
      borList,
      p.debtValue,
      p.marketId,
      p.netApy,
      p.healthFactor
    );
  });
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const address = searchParams.get('address') ?? '';
  const initialChain = searchParams.get('chain') ?? 'all';

  const [selectedChain, setSelectedChain] = useState(initialChain);
  const [positions, setPositions] = useState<Position[]>([]);
  const [simulatedPosition, setSimulatedPosition] = useState<Position | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  
  const [isLoading, setIsLoading] = useState(true); // a fetch always kicks off on mount
  const [error, setError] = useState('');
  
  // Watch mode states
  const [watchMode, setWatchMode] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [flashing, setFlashing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Keep the latest selection in a ref so fetchPortfolio can preserve it across
  // refreshes without being re-created — and thus re-fetching — on every click.
  const selectedPositionRef = useRef<Position | null>(null);
  useEffect(() => {
    selectedPositionRef.current = selectedPosition;
  }, [selectedPosition]);

  // Fetch portfolio data. Stable across renders except when the watched address
  // or chain changes, so it can be a safe effect dependency.
  const fetchPortfolio = useCallback(
    async (showLoading = true) => {
      if (!address) return;
      if (showLoading) setIsLoading(true);
      setError('');

      try {
        const url = `/api/portfolio/${encodeURIComponent(address)}?chain=${encodeURIComponent(selectedChain)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP Error ${res.status}`);
        }

        const data = await res.json();
        const parsed = parsePositions(data.positions || []);
        setPositions(parsed);

        // Preserve selection if possible, otherwise select first position
        if (parsed.length > 0) {
          const prev = selectedPositionRef.current;
          const matchingPos = prev ? parsed.find((p) => p.marketId === prev.marketId) : null;
          setSelectedPosition(matchingPos || parsed[0]);
        } else {
          setSelectedPosition(null);
        }

        // Flash green border to notify update
        setFlashing(true);
        setTimeout(() => setFlashing(false), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch portfolio data');
      } finally {
        setIsLoading(false);
      }
    },
    [address, selectedChain]
  );

  // Initial fetch / refetch whenever the watched address or chain changes. The
  // effect's job is only to *kick off* the request — the actual state updates
  // happen inside the scheduled fetch, not synchronously in the effect body.
  useEffect(() => {
    if (!address) {
      router.push('/');
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) fetchPortfolio(true);
    });
    return () => {
      cancelled = true;
    };
  }, [address, fetchPortfolio, router]);

  // Remember every valid address that gets visualized so the home screen can
  // offer it as a recent shortcut. Runs for any entry point (search, direct
  // link, recent click) since they all flow through this address param.
  useEffect(() => {
    if (address && validateAddress(address).isValid) {
      addRecentWallet(address);
    }
  }, [address]);

  // Watch mode: poll on a 15s countdown while active; reset the timer on exit.
  useEffect(() => {
    if (!watchMode || !address) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchPortfolio(false);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      setCountdown(15);
    };
  }, [watchMode, address, fetchPortfolio]);

  // Search trigger from header
  const handleSearch = (newAddress: string, newChain: string) => {
    setWatchMode(false);
    router.push(`/dashboard?address=${encodeURIComponent(newAddress)}&chain=${encodeURIComponent(newChain)}`);
  };

  // Manual refresh trigger
  const handleRefresh = () => {
    setCountdown(15);
    fetchPortfolio(true);
  };

  // The dashboard focuses on a single market at a time. Scope every metric view
  // (KPIs, allocation) to the selected market, swapping in the simulated copy
  // while a what-if simulation is active.
  const scopedCurrent = selectedPosition ? [selectedPosition] : [];
  const scopedSimulated =
    isSimulating && simulatedPosition ? [simulatedPosition] : scopedCurrent;
  const allocationPosition = isSimulating && simulatedPosition ? simulatedPosition : selectedPosition;

  return (
    <div className="flex-1 flex flex-col bg-obsidian">
      {/* Header */}
      <DashboardHeader
        initialAddress={address}
        onSearch={handleSearch}
        isLoading={isLoading}
        watchMode={watchMode}
        onWatchModeToggle={setWatchMode}
        countdown={countdown}
        onRefresh={handleRefresh}
        selectedChain={selectedChain}
        onChainChange={setSelectedChain}
        flashing={flashing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 flex gap-3 items-center text-red-200">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
        )}

        {isLoading && positions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#00f2fe]" />
            <p className="text-sm font-medium font-mono">Fetching lending obligations...</p>
          </div>
        ) : positions.length === 0 && !error ? (
          <div className="rounded-xl bg-glass-card border border-slate-800/80 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto mt-12">
            <ShieldAlert className="w-12 h-12 text-slate-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-200">No Lending Obligations Found</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This address does not have active obligations on Kamino Lend (Solana) or Aave V3 (EVM) for the chosen chain filter.
            </p>
            <Link href="/" className="mt-6 flex items-center gap-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:text-white px-4 py-2 rounded-lg transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Market selector — pick one market/network to focus the dashboard on */}
            <MarketSelector
              positions={positions}
              selectedMarketId={selectedPosition?.marketId ?? ''}
              onSelectPosition={setSelectedPosition}
            />

            {/* Health Factor — the primary risk metric, surfaced prominently
                so it's the first thing seen once a wallet's positions load. */}
            <HealthFactorHero position={allocationPosition} />

            {/* KPI Section (scoped to the selected market) */}
            <KpiCards
              positions={scopedCurrent}
              simulatedPositions={scopedSimulated}
              isSimulating={isSimulating}
            />

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left: Allocation + Liquidation Analysis */}
              <div className="space-y-6">
                <AllocationChart positions={allocationPosition ? [allocationPosition] : []} />
                <LiquidationViews position={isSimulating ? simulatedPosition : selectedPosition} />
              </div>

              {/* Right: What-If Simulation (inline with the liquidation analysis).
                  Keyed by market so switching markets remounts it with a clean slate. */}
              <SimulationPanel
                key={selectedPosition?.marketId ?? 'none'}
                position={selectedPosition}
                onSimulationChange={setSimulatedPosition}
                setIsSimulating={setIsSimulating}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center bg-obsidian text-slate-400 gap-4 h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#00f2fe]" />
        <p className="text-sm font-medium font-mono">Loading dashboard...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
