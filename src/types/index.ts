/**
 * Shared domain contract: the unified portfolio shape produced by the API
 * route and consumed across clients, routes, and the dashboard.
 *
 * Raw provider response types live next to their client in src/lib/clients/.
 */

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
