/**
 * Read-only client for the public Aave (AaveKit) GraphQL API.
 * Uses short-lived server-side caching via a manual in-memory cache
 * since fetch POST requests cannot use Next.js revalidation.
 */

import { AAVE_API, AAVE_CHAINS } from './config';
import type {
  AaveMarket,
  AaveReserve,
  AaveSupply,
  AaveBorrow,
  PortfolioPosition,
  PortfolioAsset,
  PortfolioBorrowAsset,
  ReserveInfoData,
} from '@/types';

const USER_AGENT = 'equinox/0.1';
const CACHE_TTL_MS = 15_000;

// --------------------------------------------------------------------------- //
// GraphQL queries (matching lend-liq's Python implementation)
// --------------------------------------------------------------------------- //

const MARKETS_QUERY = `query Markets($req: MarketsRequest!) {
  markets(request: $req) {
    address
    name
    chain { chainId }
    userState { healthFactor eModeEnabled }
    reserves {
      underlyingToken { symbol address }
      supplyInfo { liquidationThreshold { value } }
      userState { emode { liquidationThreshold { value } } }
      usdExchangeRate
    }
  }
}`;

const POSITIONS_QUERY = `query Positions(
  $supplies: UserSuppliesRequest!
  $borrows: UserBorrowsRequest!
) {
  userSupplies(request: $supplies) {
    market { address chain { chainId } }
    currency { symbol address }
    balance { amount { value } usdPerToken usd }
    isCollateral
  }
  userBorrows(request: $borrows) {
    market { address chain { chainId } }
    currency { symbol address }
    debt { amount { value } usdPerToken usd }
  }
}`;

// --------------------------------------------------------------------------- //
// Simple in-memory cache for GraphQL POST responses
// --------------------------------------------------------------------------- //

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --------------------------------------------------------------------------- //
// GraphQL transport
// --------------------------------------------------------------------------- //

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(AAVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`Aave API error: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as { data: T; errors?: unknown[] };
  if (payload.errors) {
    throw new Error(`Aave GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  setCache(cacheKey, payload.data);
  return payload.data;
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

type MarketKey = string; // "chainId:address"

function marketKey(chainId: number, address: string): MarketKey {
  return `${chainId}:${address}`;
}

/**
 * Resolve chain IDs from an optional chain name. Defaults to all supported chains.
 */
export function resolveChainIds(chain?: string): number[] {
  if (!chain || chain === 'all') {
    return Object.values(AAVE_CHAINS);
  }
  const id = AAVE_CHAINS[chain.toLowerCase()];
  if (id === undefined) {
    throw new Error(
      `Unknown chain '${chain}'; supported: ${Object.keys(AAVE_CHAINS).join(', ')}`
    );
  }
  return [id];
}

/**
 * Load all lending positions for an EVM address from Aave V3.
 */
export async function loadAavePositions(
  user: string,
  chainIds: number[]
): Promise<PortfolioPosition[]> {
  const marketsData = await graphql<{ markets: AaveMarket[] }>(MARKETS_QUERY, {
    req: { chainIds, user },
  });
  const markets = marketsData.markets;
  if (markets.length === 0) return [];

  const thresholds = buildThresholdMap(markets);
  const names = new Map<MarketKey, string>();
  const inputs: { address: string; chainId: number }[] = [];

  for (const m of markets) {
    const key = marketKey(m.chain.chainId, m.address);
    names.set(key, m.name);
    inputs.push({ address: m.address, chainId: m.chain.chainId });
  }

  const positionsData = await graphql<{ userSupplies: AaveSupply[]; userBorrows: AaveBorrow[] }>(
    POSITIONS_QUERY,
    {
      supplies: {
        markets: inputs,
        user,
        collateralsOnly: false,
        orderBy: { balance: 'DESC' },
      },
      borrows: { markets: inputs, user, orderBy: { debt: 'DESC' } },
    }
  );

  const suppliesByMarket = groupByMarket(positionsData.userSupplies);
  const borrowsByMarket = groupByMarket(positionsData.userBorrows);

  const positions: PortfolioPosition[] = [];

  for (const [key, name] of names) {
    const supplies = suppliesByMarket.get(key) ?? [];
    const borrows = borrowsByMarket.get(key) ?? [];

    const collateral = buildCollateral(
      supplies as AaveSupply[],
      thresholds
    );
    const debt = (borrows as AaveBorrow[]).map(buildBorrow);

    if (collateral.length === 0 && debt.length === 0) continue;

    const debtValue = (borrows as AaveBorrow[]).reduce(
      (sum, b) => sum + parseFloat(b.debt.usd),
      0
    );

    const [, address] = key.split(':');
    positions.push({
      marketName: name,
      address,
      marketId: key,
      collateral,
      borrows: debt,
      debtValue,
    });
  }

  return positions;
}

/**
 * Resolve a reserve's configuration by symbol from an Aave market.
 */
export async function resolveAaveReserve(
  user: string,
  marketId: string,
  symbol: string
): Promise<ReserveInfoData | null> {
  const parts = marketId.split(':');
  if (parts.length !== 2) return null;

  const chainId = parseInt(parts[0], 10);
  if (isNaN(chainId)) return null;

  const marketAddress = parts[1];

  const marketsData = await graphql<{ markets: AaveMarket[] }>(MARKETS_QUERY, {
    req: { chainIds: [chainId], user },
  });

  const matchingMarket = marketsData.markets.find(
    (m) => m.address.toLowerCase() === marketAddress.toLowerCase()
  );
  if (!matchingMarket) return null;

  const matchingReserve = matchingMarket.reserves.find(
    (r) => r.underlyingToken.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!matchingReserve) return null;

  return {
    symbol: matchingReserve.underlyingToken.symbol,
    price: parseFloat(matchingReserve.usdExchangeRate || '0'),
    liquidationThreshold: effectiveLt(matchingReserve),
    borrowFactor: 1.0, // Aave has no borrow factor
  };
}

// --------------------------------------------------------------------------- //
// Internal helpers
// --------------------------------------------------------------------------- //

type ThresholdKey = string; // "chainId:marketAddress:tokenAddressLower"

function buildThresholdMap(markets: AaveMarket[]): Map<ThresholdKey, number> {
  const thresholds = new Map<ThresholdKey, number>();
  for (const m of markets) {
    for (const reserve of m.reserves) {
      const key = `${m.chain.chainId}:${m.address}:${reserve.underlyingToken.address.toLowerCase()}`;
      thresholds.set(key, effectiveLt(reserve));
    }
  }
  return thresholds;
}

function effectiveLt(reserve: AaveReserve): number {
  const emode = reserve.userState?.emode;
  const info = emode ?? reserve.supplyInfo;
  return parseFloat(info.liquidationThreshold.value);
}

function groupByMarket<T extends { market: { address: string; chain: { chainId: number } } }>(
  rows: T[]
): Map<MarketKey, T[]> {
  const grouped = new Map<MarketKey, T[]>();
  for (const row of rows) {
    const key = marketKey(row.market.chain.chainId, row.market.address);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

function buildCollateral(
  supplies: AaveSupply[],
  thresholds: Map<ThresholdKey, number>
): PortfolioAsset[] {
  return supplies
    .filter((s) => s.isCollateral)
    .map((s) => {
      const key = `${s.market.chain.chainId}:${s.market.address}:${s.currency.address.toLowerCase()}`;
      return {
        symbol: s.currency.symbol,
        amount: parseFloat(s.balance.amount.value),
        price: parseFloat(s.balance.usdPerToken),
        liquidationThreshold: thresholds.get(key) ?? 0,
      };
    });
}

function buildBorrow(b: AaveBorrow): PortfolioBorrowAsset {
  return {
    symbol: b.currency.symbol,
    amount: parseFloat(b.debt.amount.value),
    price: parseFloat(b.debt.usdPerToken),
    borrowFactor: 1.0, // Aave has no borrow factor
  };
}
