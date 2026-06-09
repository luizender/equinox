/**
 * Shared TypeScript interfaces for API responses and parsed portfolio data.
 */

// --------------------------------------------------------------------------- //
// Kamino REST API response types
// --------------------------------------------------------------------------- //

export interface KaminoPortfolioLoan {
  address: string;
  marketAddress: string;
}

export interface KaminoMarketResponse {
  name: string;
}

export interface KaminoDeposit {
  tokenName: string;
  tokenAmount: string;
  tokenPrice: string;
  liquidationLtv: string;
}

export interface KaminoBorrow {
  tokenName: string;
  tokenAmount: string;
  tokenPrice: string;
  tokenValue: string;
  borrowFactor: string;
}

export interface KaminoLoanDetail {
  loanInfo: {
    collateral: { deposits: KaminoDeposit[] };
    debt: { borrows: KaminoBorrow[] };
  };
}

export interface KaminoReserveItem {
  liquidityToken: string;
  reserve: string;
}

/**
 * Reserve-level supply/borrow rates from the market's reserves/metrics endpoint.
 * Rates arrive as JSON numbers (decimal fractions, e.g. 0.054 = 5.4%).
 */
export interface KaminoReserveMetric {
  liquidityToken: string;
  reserve: string;
  supplyApy: number;
  borrowApy: number;
}

export interface KaminoReserveHistoryMetrics {
  assetPriceUSD: string;
  borrowFactor: string;
  liquidationThreshold: string;
}

export interface KaminoReserveHistoryPoint {
  metrics?: KaminoReserveHistoryMetrics;
}

export interface KaminoReserveHistoryResponse {
  history?: KaminoReserveHistoryPoint[];
}

// --------------------------------------------------------------------------- //
// Aave GraphQL API response types
// --------------------------------------------------------------------------- //

export interface AaveMarket {
  address: string;
  name: string;
  chain: { chainId: number };
  userState: { healthFactor: number; eModeEnabled: boolean } | null;
  reserves: AaveReserve[];
}

export interface AaveReserve {
  underlyingToken: { symbol: string; address: string };
  supplyInfo: { liquidationThreshold: { value: string } };
  userState: { emode: { liquidationThreshold: { value: string } } | null } | null;
  usdExchangeRate: string;
}

export interface AaveSupply {
  market: { address: string; chain: { chainId: number } };
  currency: { symbol: string; address: string };
  balance: { amount: { value: string }; usdPerToken: string; usd: string };
  apy: { value: string };
  isCollateral: boolean;
}

export interface AaveBorrow {
  market: { address: string; chain: { chainId: number } };
  currency: { symbol: string; address: string };
  debt: { amount: { value: string }; usdPerToken: string; usd: string };
  apy: { value: string };
}

/**
 * Per-user, per-market state. Aave computes this directly, so it already folds
 * in incentive rewards and non-collateral supplies. Only reliable when the
 * market is queried for a single chain (multi-chain requests zero it out).
 */
export interface AaveUserState {
  netAPY: { value: string } | null;
  healthFactor: string | null;
}

// --------------------------------------------------------------------------- //
// Unified portfolio response sent from the API route to the client
// --------------------------------------------------------------------------- //

export interface PortfolioPosition {
  marketName: string;
  address: string;
  marketId: string;
  collateral: PortfolioAsset[];
  borrows: PortfolioBorrowAsset[];
  debtValue: number;
  // Protocol-reported live figures, when the source exposes them (Aave). Null
  // for sources that don't (Kamino), where the client computes from rates.
  netApy: number | null;
  healthFactor: number | null;
}

export interface PortfolioAsset {
  symbol: string;
  amount: number;
  price: number;
  liquidationThreshold: number;
  supplyApy: number;
}

export interface PortfolioBorrowAsset {
  symbol: string;
  amount: number;
  price: number;
  borrowFactor: number;
  borrowApy: number;
}

export interface PortfolioResponse {
  protocol: 'kamino' | 'aave';
  positions: PortfolioPosition[];
}

export interface ReserveInfoData {
  symbol: string;
  price: number;
  liquidationThreshold: number;
  borrowFactor: number;
}
