'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ShieldAlert, Copy, Check, ArrowRight } from 'lucide-react';
import { validateAddress } from '@/lib/validation';

const DEMO_WALLETS = [
  {
    protocol: 'Kamino (Solana)',
    address: '8B4F8g46B8KkL6Vs742d35Cc6634C0532925a3b8',
    label: 'Solana whales / Active klend loans',
  },
  {
    protocol: 'Aave V3 (EVM)',
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    label: 'vitalik.eth / Large multi-collateral Aave position',
  },
];

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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

        {/* Demo Wallets Catalog */}
        <div className="space-y-3 text-left">
          <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase pl-1">Demo Wallet Addresses</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {DEMO_WALLETS.map((demo, idx) => (
              <div
                key={demo.address}
                className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-4 group hover:border-slate-700/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">
                      {demo.protocol}
                    </span>
                    <span className="text-[9px] text-slate-500 font-sans truncate">{demo.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate mt-1">{demo.address}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(demo.address, idx)}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-850 hover:text-white transition-colors cursor-pointer text-slate-400"
                    title="Copy address"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setAddress(demo.address);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
