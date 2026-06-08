/**
 * Configuration variables for Equinox.
 */

export const STABLE_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'PYUSD',
  'USDG',
  'USDH',
  'FDUSD',
  'DAI',
  'USDS',
  'USDE',
  'SUSDE',
  'USDY',
  'EURC',
  'USDR',
  'USD*',
  'GHO',
]);

export const API_BASE = 'https://api.kamino.finance';
export const AAVE_API = 'https://api.v3.aave.com/graphql';

export const AAVE_CHAINS: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  gnosis: 100,
  polygon: 137,
  sonic: 146,
  zksync: 324,
  metis: 1088,
  base: 8453,
  arbitrum: 42161,
  avalanche: 43114,
  celo: 42220,
  linea: 59144,
  scroll: 534352,
};
