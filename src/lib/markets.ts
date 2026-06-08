/**
 * Helpers for describing a position's market: which protocol it belongs to and
 * which network it lives on. Mirrors the Kamino-vs-Aave detection used across
 * the UI (Kamino marketIds have no "chainId:" prefix).
 */

import { AAVE_CHAINS } from './config';

const CHAIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(AAVE_CHAINS).map(([name, id]) => [id, name])
);

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
  const name = CHAIN_ID_TO_NAME[chainId] ?? 'EVM';
  const network = name.charAt(0).toUpperCase() + name.slice(1);
  return { protocol: 'Aave V3', network, isKamino: false };
}
