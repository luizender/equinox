'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ShieldAlert, ArrowRight, History, ChevronRight } from 'lucide-react';
import { validateAddress } from '@/lib/validation';
import { getRecentWallets, type RecentWallet } from '@/lib/recent-wallets';

// Recent wallets come from localStorage (client-only). Read them through
// useSyncExternalStore so the server/hydration render sees an empty list and
// the real list resolves on the client without a hydration mismatch.
const EMPTY_RECENTS: RecentWallet[] = [];
let recentsCache: RecentWallet[] = EMPTY_RECENTS;
let recentsCacheKey = '';

function subscribeRecents(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

// getSnapshot must be referentially stable while the data is unchanged, so the
// freshly-built array is cached and only swapped when its contents differ.
function recentsSnapshot(): RecentWallet[] {
  const list = getRecentWallets();
  const key = JSON.stringify(list);
  if (key !== recentsCacheKey) {
    recentsCacheKey = key;
    recentsCache = list;
  }
  return recentsCache;
}

// Compact "first6…last4" address, leaving short strings untouched.
function shortenAddress(addr: string): string {
  return addr.length <= 13 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');

  const recents = useSyncExternalStore(subscribeRecents, recentsSnapshot, () => EMPTY_RECENTS);

  const openWallet = (addr: string) => {
    router.push(`/dashboard?address=${encodeURIComponent(addr)}&chain=all`);
  };

  // errorMsg and protocolBadge are pure functions of `address` — derive them
  // during render instead of mirroring `address` into state via an effect.
  const validation = address ? validateAddress(address) : null;
  const errorMsg =
    validation && !validation.isValid ? validation.error || 'Invalid address format' : '';
  const protocolBadge =
    validation && validation.isValid
      ? validation.protocol === 'kamino'
        ? { text: 'Kamino (Solana)', gradient: 'from-cyan-400 to-purple-500' }
        : { text: 'Aave V3 (EVM)', gradient: 'from-blue-500 to-indigo-600' }
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress(address).isValid) {
      return;
    }
    router.push(`/dashboard?address=${encodeURIComponent(address)}&chain=all`);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-obsidian relative overflow-hidden px-4 py-12">
      {/* Decorative Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00f2fe]/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#9b51e0]/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-xl w-full text-center z-10 space-y-8">
        {/* Logo Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00f2fe] to-[#9b51e0] flex items-center justify-center shadow-xl shadow-[#00f2fe]/10 relative group hover:scale-105 transition-all duration-300">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#00f2fe] to-[#9b51e0] blur-md opacity-50 group-hover:opacity-85 transition-opacity"></div>
          <Activity className="w-8 h-8 text-white relative z-10" />
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            EQUINOX
          </h1>
          <p className="text-slate-400 max-w-sm mx-auto text-sm leading-relaxed">
            Beautiful, keyless cross-chain DeFi portfolio analyzer and interactive liquidation simulator.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-glass-card rounded-2xl p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Paste EVM (Aave V3) or Solana (Kamino) wallet address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full h-12 pl-4 pr-32 rounded-xl bg-slate-950 border ${
                  errorMsg
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-slate-800 focus:border-[#00f2fe]/50 focus:ring-1 focus:ring-[#00f2fe]/20'
                } text-slate-100 text-sm placeholder-slate-600 focus:outline-none transition-all`}
              />
              {protocolBadge && (
                <span className={`absolute right-3 top-3 px-2.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${protocolBadge.gradient}`}>
                  {protocolBadge.text}
                </span>
              )}
            </div>

            {errorMsg && (
              <p className="text-left text-[10px] text-red-400 font-mono flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={!!errorMsg || !address}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#9b51e0] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00f2fe]/10 hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <span>Visualize Portfolio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Recent wallets — quick links to previously visualized addresses,
            most-recently-used first. */}
        {recents.length > 0 && (
          <div className="bg-glass-card rounded-2xl p-5 border border-slate-800/80 shadow-2xl text-left space-y-3">
            <div className="flex items-center gap-2 text-slate-400">
              <History className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold tracking-widest font-mono uppercase">Recent</span>
            </div>
            <ul className="space-y-1.5">
              {recents.map((w) => {
                const protocol = validateAddress(w.address).protocol;
                const badge =
                  protocol === 'kamino'
                    ? { text: 'Kamino', gradient: 'from-cyan-400 to-purple-500' }
                    : { text: 'Aave V3', gradient: 'from-blue-500 to-indigo-600' };
                return (
                  <li key={w.address}>
                    <button
                      type="button"
                      onClick={() => openWallet(w.address)}
                      className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-[#00f2fe]/40 hover:bg-slate-900/60 transition-all cursor-pointer"
                    >
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${badge.gradient}`}>
                        {badge.text}
                      </span>
                      <span className="font-mono text-sm text-slate-200 truncate">{shortenAddress(w.address)}</span>
                      <span className="ml-auto text-[10px] text-slate-500 font-mono whitespace-nowrap">{timeAgo(w.lastUsedAt)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#00f2fe] transition-colors" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
