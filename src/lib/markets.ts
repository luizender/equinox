/**
 * Helpers for describing a position's market: which protocol it belongs to and
 * which network it lives on. Mirrors the Kamino-vs-Aave detection used across
 * the UI (Kamino marketIds have no "chainId:" prefix).
 */

import { AAVE_CHAINS } from './config';

const CHAIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(AAVE_CHAINS).map(([name, id]) => [id, name])
);

// A few chain keys don't read well from a naive capitalize.
const CHAIN_DISPLAY_NAME: Record<string, string> = {
  bsc: 'BNB Chain',
  zksync: 'zkSync',
};

function chainDisplayName(rawChain: string): string {
  return CHAIN_DISPLAY_NAME[rawChain] ?? rawChain.charAt(0).toUpperCase() + rawChain.slice(1);
}

export interface MarketMeta {
  protocol: 'Kamino' | 'Aave V3';
  network: string; // e.g. 'Solana', 'Ethereum'
  isKamino: boolean;
}

export function getMarketMeta(marketId: string): MarketMeta {
  const isKamino = marketId.includes('MKT') || !marketId.includes(':');
  if (isKamino) {
    return { protocol: 'Kamino', network: 'Solana', isKamino: true };
  }

  const chainId = parseInt(marketId.split(':')[0], 10);
  const rawChain = CHAIN_ID_TO_NAME[chainId];
  const network = rawChain ? chainDisplayName(rawChain) : 'EVM';
  return { protocol: 'Aave V3', network, isKamino: false };
}

/**
 * Human-friendly market name for display. Aave's API returns compact names like
 * "AaveV3Polygon"; we render the protocol and network instead (e.g. "Aave V3 · Polygon").
 * Kamino's API names are already friendly, so they pass through unchanged.
 */
export function getMarketDisplayName(marketId: string, rawName: string): string {
  const meta = getMarketMeta(marketId);
  if (meta.isKamino) return rawName;
  return `${meta.protocol} · ${meta.network}`;
}
