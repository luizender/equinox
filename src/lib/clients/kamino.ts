/**
 * Read-only client for the public Kamino REST API.
 * All fetch calls use Next.js revalidation for short-lived server-side caching.
 */

import { API_BASE } from '../config';
import type {
  PortfolioPosition,
  PortfolioAsset,
  PortfolioBorrowAsset,
  ReserveInfoData,
} from '@/types';

// --------------------------------------------------------------------------- //
// Kamino REST API response types (private to this client)
// --------------------------------------------------------------------------- //

interface KaminoPortfolioDeposit {
  symbol: string;
  amount: string;
  price: string;
  liquidationLtv: string;
}

interface KaminoPortfolioBorrow {
  symbol: string;
  amount: string;
  price: string;
  value: string;
  borrowFactor: string;
}

interface KaminoPortfolioLoan {
  obligation: string;
  market: string;
  deposits: KaminoPortfolioDeposit[];
  borrows: KaminoPortfolioBorrow[];
}

interface KaminoMarketResponse {
  name: string;
}

interface KaminoReserveItem {
  liquidityToken: string;
  reserve: string;
}

/**
 * Reserve-level supply/borrow rates from the market's reserves/metrics endpoint.
 * Rates arrive as JSON numbers (decimal fractions, e.g. 0.054 = 5.4%).
 */
interface KaminoReserveMetric {
  liquidityToken: string;
  reserve: string;
  supplyApy: number;
  borrowApy: number;
}

interface KaminoReserveHistoryMetrics {
  assetPriceUSD: string;
  borrowFactor: string;
  liquidationThreshold: string;
}

interface KaminoReserveHistoryPoint {
  metrics?: KaminoReserveHistoryMetrics;
}

interface KaminoReserveHistoryResponse {
  history?: KaminoReserveHistoryPoint[];
}

/** Per-asset supply/borrow APY for a market, keyed by uppercased symbol. */
type ReserveApyMap = Map<string, { supplyApy: number; borrowApy: number }>;

const REVALIDATE_SECONDS = 15;
const USER_AGENT = 'equinox/0.1';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Kamino API error: ${response.status} ${response.statusText} — ${body}`);
  }
  return response.json() as Promise<T>;
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Load all lending positions for a Solana wallet from Kamino.
 */
export async function loadKaminoPositions(wallet: string): Promise<PortfolioPosition[]> {
  const portfolioData = await fetchJson<{ lending?: KaminoPortfolioLoan[] }>(
    `${API_BASE}/portfolio/${wallet}`
  );
  const loans = portfolioData.lending ?? [];
  if (loans.length === 0) return [];

  const names: Record<string, string> = {};
  const apyMaps: Record<string, ReserveApyMap> = {};
  const positions: PortfolioPosition[] = [];

  for (const loan of loans) {
    const market = loan.market;
    if (!(market in names)) {
      const marketData = await fetchJson<KaminoMarketResponse>(
        `${API_BASE}/v2/kamino-market/${market}`
      );
      names[market] = marketData.name;
      apyMaps[market] = await loadReserveApyMap(market);
    }

    positions.push(buildPosition(names[market], loan.obligation, loan, market, apyMaps[market]));
  }

  return positions;
}

/**
 * Fetch per-reserve supply/borrow APY for a market, keyed by uppercased symbol.
 * Kamino doesn't report a net APY per loan, so we compute it downstream from
 * these rates.
 */
async function loadReserveApyMap(marketId: string): Promise<ReserveApyMap> {
  const reserves = await fetchJson<KaminoReserveMetric[]>(
    `${API_BASE}/kamino-market/${marketId}/reserves/metrics`
  );
  const map: ReserveApyMap = new Map();
  for (const r of reserves) {
    map.set(r.liquidityToken.toUpperCase(), {
      supplyApy: Number(r.supplyApy) || 0,
      borrowApy: Number(r.borrowApy) || 0,
    });
  }
  return map;
}

/**
 * Resolve a reserve's configuration by symbol from a Kamino market.
 */
export async function resolveKaminoReserve(
  marketId: string,
  symbol: string
): Promise<ReserveInfoData | null> {
  const reserves = await fetchJson<KaminoReserveItem[]>(
    `${API_BASE}/kamino-market/${marketId}/reserves/metrics`
  );

  const match = reserves.find(
    (r) => r.liquidityToken.toUpperCase() === symbol.toUpperCase()
  );
  if (!match) return null;

  const historyData = await fetchJson<KaminoReserveHistoryResponse>(
    `${API_BASE}/kamino-market/${marketId}/reserves/${match.reserve}/metrics/history?env=mainnet-beta&frequency=day`
  );

  const history = historyData?.history;
  if (!history || !Array.isArray(history) || history.length === 0) return null;

  const latestPoint = history[history.length - 1];
  const metrics = latestPoint?.metrics;
  if (!metrics) return null;

  return {
    symbol: match.liquidityToken,
    price: parseFloat(metrics.assetPriceUSD || '0'),
    liquidationThreshold: parseFloat(metrics.liquidationThreshold || '0'),
    borrowFactor: parseFloat(metrics.borrowFactor || '100') / 100,
  };
}

// --------------------------------------------------------------------------- //
// Internal helpers
// --------------------------------------------------------------------------- //

function buildPosition(
  marketName: string,
  address: string,
  loan: KaminoPortfolioLoan,
  marketId: string,
  apyMap: ReserveApyMap
): PortfolioPosition {
  const deposits = loan.deposits;
  const borrows = loan.borrows;

  const collateral: PortfolioAsset[] = deposits.map((d: KaminoPortfolioDeposit) => ({
    symbol: d.symbol,
    amount: parseFloat(d.amount),
    price: parseFloat(d.price),
    liquidationThreshold: parseFloat(d.liquidationLtv),
    supplyApy: apyMap.get(d.symbol.toUpperCase())?.supplyApy ?? 0,
  }));

  const borrowAssets: PortfolioBorrowAsset[] = borrows.map((b: KaminoPortfolioBorrow) => ({
    symbol: b.symbol,
    amount: parseFloat(b.amount),
    price: parseFloat(b.price),
    borrowFactor: parseFloat(b.borrowFactor),
    borrowApy: apyMap.get(b.symbol.toUpperCase())?.borrowApy ?? 0,
  }));

  const debtValue = borrows.reduce(
    (sum: number, b: KaminoPortfolioBorrow) => sum + parseFloat(b.value) * parseFloat(b.borrowFactor),
    0
  );

  // Kamino exposes no per-loan net APY or health factor; both are computed
  // client-side from the assets above.
  return {
    marketName,
    address,
    marketId,
    collateral,
    borrows: borrowAssets,
    debtValue,
    netApy: null,
    healthFactor: null,
  };
}
