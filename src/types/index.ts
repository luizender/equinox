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
  isCollateral: boolean;
}

export interface AaveBorrow {
  market: { address: string; chain: { chainId: number } };
  currency: { symbol: string; address: string };
  debt: { amount: { value: string }; usdPerToken: string; usd: string };
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
}

export interface PortfolioAsset {
  symbol: string;
  amount: number;
  price: number;
  liquidationThreshold: number;
}

export interface PortfolioBorrowAsset {
  symbol: string;
  amount: number;
  price: number;
  borrowFactor: number;
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
