'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ShieldAlert, ArrowRight } from 'lucide-react';
import { validateAddress } from '@/lib/validation';

export default function Home() {
  const router = useRouter();
  const [address, setAddress] = useState('');

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
      </div>
    </div>
  );
}
