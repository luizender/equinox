import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  upsertRecentWallet,
  getRecentWallets,
  addRecentWallet,
  MAX_RECENT_WALLETS,
  type RecentWallet,
} from '../src/lib/recent-wallets';

describe('upsertRecentWallet', () => {
  it('prepends a brand-new address as the most recent', () => {
    expect(upsertRecentWallet([], 'A', 100)).toEqual([{ address: 'A', lastUsedAt: 100 }]);
  });

  it('moves an existing address to the front and refreshes its timestamp', () => {
    const existing: RecentWallet[] = [
      { address: 'A', lastUsedAt: 1 },
      { address: 'B', lastUsedAt: 2 },
    ];
    expect(upsertRecentWallet(existing, 'A', 5)).toEqual([
      { address: 'A', lastUsedAt: 5 },
      { address: 'B', lastUsedAt: 2 },
    ]);
  });

  it('never duplicates an existing address', () => {
    expect(upsertRecentWallet([{ address: 'A', lastUsedAt: 1 }], 'A', 2)).toHaveLength(1);
  });

  it('caps the list at MAX_RECENT_WALLETS, dropping the oldest', () => {
    let list: RecentWallet[] = [];
    for (let i = 0; i < MAX_RECENT_WALLETS + 3; i++) {
      list = upsertRecentWallet(list, `addr-${i}`, i);
    }
    expect(list).toHaveLength(MAX_RECENT_WALLETS);
    expect(list[0].address).toBe(`addr-${MAX_RECENT_WALLETS + 2}`); // newest first
    expect(list.some((w) => w.address === 'addr-0')).toBe(false); // oldest dropped
  });

  it('trims surrounding whitespace before storing', () => {
    expect(upsertRecentWallet([], '  A  ', 1)[0].address).toBe('A');
  });
});

describe('getRecentWallets / addRecentWallet (persisted)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips added wallets, newest first', () => {
    addRecentWallet('A');
    addRecentWallet('B');
    expect(getRecentWallets().map((w) => w.address)).toEqual(['B', 'A']);
  });

  it('ignores blank addresses', () => {
    addRecentWallet('   ');
    expect(getRecentWallets()).toEqual([]);
  });

  it('returns [] when storage holds malformed JSON', () => {
    window.localStorage.setItem('equinox:recent-wallets', '{not json');
    expect(getRecentWallets()).toEqual([]);
  });

  it('drops malformed entries while keeping valid ones', () => {
    window.localStorage.setItem(
      'equinox:recent-wallets',
      JSON.stringify([{ address: 'A', lastUsedAt: 1 }, { foo: 'bar' }, 'nope', null])
    );
    expect(getRecentWallets()).toEqual([{ address: 'A', lastUsedAt: 1 }]);
  });
});
