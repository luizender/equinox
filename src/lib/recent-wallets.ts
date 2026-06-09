/**
 * Recently-used wallet addresses, persisted in localStorage.
 *
 * Keeps the last few addresses a visitor looked up so the home screen can offer
 * them as quick links, most-recently-used first.
 */

export interface RecentWallet {
  address: string;
  lastUsedAt: number;
}

const STORAGE_KEY = 'equinox:recent-wallets';
export const MAX_RECENT_WALLETS = 5;

/**
 * Merge a freshly-used address into the list: deduped, newest first, and capped
 * at MAX_RECENT_WALLETS. Pure — separated from storage so it can be unit-tested.
 */
export function upsertRecentWallet(
  wallets: RecentWallet[],
  address: string,
  now: number = Date.now()
): RecentWallet[] {
  const trimmed = address.trim();
  const without = wallets.filter((w) => w.address !== trimmed);
  return [{ address: trimmed, lastUsedAt: now }, ...without].slice(0, MAX_RECENT_WALLETS);
}

function readRaw(): RecentWallet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is RecentWallet =>
        !!w && typeof w.address === 'string' && typeof w.lastUsedAt === 'number'
    );
  } catch {
    // Malformed JSON or storage access denied — start fresh.
    return [];
  }
}

/** Read the recent wallets, most-recently-used first. */
export function getRecentWallets(): RecentWallet[] {
  return readRaw()
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_RECENT_WALLETS);
}

/** Record a wallet as just used and persist. Returns the updated list. */
export function addRecentWallet(address: string): RecentWallet[] {
  if (typeof window === 'undefined' || !address.trim()) return getRecentWallets();
  const next = upsertRecentWallet(getRecentWallets(), address);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage disabled — keep the in-memory result.
  }
  return next;
}
