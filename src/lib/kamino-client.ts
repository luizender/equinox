/**
 * Read-only client for the public Kamino REST API.
 * All fetch calls use Next.js revalidation for short-lived server-side caching.
 */

import { API_BASE } from './config';
import type {
  KaminoPortfolioLoan,
  KaminoMarketResponse,
  KaminoLoanDetail,
  KaminoReserveItem,
  KaminoReserveHistoryResponse,
  PortfolioPosition,
  PortfolioAsset,
  PortfolioBorrowAsset,
  ReserveInfoData,
} from '@/types';

const REVALIDATE_SECONDS = 15;
const USER_AGENT = 'equinox/0.1';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`Kamino API error: ${response.status} ${response.statusText}`);
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
  const positions: PortfolioPosition[] = [];

  for (const loan of loans) {
    const market = loan.marketAddress;
    if (!(market in names)) {
      const marketData = await fetchJson<KaminoMarketResponse>(
        `${API_BASE}/v2/kamino-market/${market}`
      );
      names[market] = marketData.name;
    }

    const detail = await fetchJson<KaminoLoanDetail>(`${API_BASE}/klend/loans/${loan.address}`);
    positions.push(buildPosition(names[market], loan.address, detail, market));
  }

  return positions;
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
  detail: KaminoLoanDetail,
  marketId: string
): PortfolioPosition {
  const info = detail.loanInfo;
  const deposits = info.collateral.deposits;
  const borrows = info.debt.borrows;

  const collateral: PortfolioAsset[] = deposits.map((d) => ({
    symbol: d.tokenName,
    amount: parseFloat(d.tokenAmount),
    price: parseFloat(d.tokenPrice),
    liquidationThreshold: parseFloat(d.liquidationLtv),
  }));

  const borrowAssets: PortfolioBorrowAsset[] = borrows.map((b) => ({
    symbol: b.tokenName,
    amount: parseFloat(b.tokenAmount),
    price: parseFloat(b.tokenPrice),
    borrowFactor: parseFloat(b.borrowFactor),
  }));

  const debtValue = borrows.reduce(
    (sum, b) => sum + parseFloat(b.tokenValue) * parseFloat(b.borrowFactor),
    0
  );

  return { marketName, address, marketId, collateral, borrows: borrowAssets, debtValue };
}
