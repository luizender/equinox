'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Activity, Wifi, WifiOff, RefreshCw, Loader2, ChevronDown, Check } from 'lucide-react';
import Link from 'next/link';
import { validateAddress } from '@/lib/validation';
import { AAVE_CHAINS } from '@/lib/config';

interface DashboardHeaderProps {
  initialAddress: string;
  onSearch: (address: string, chain: string) => void;
  isLoading: boolean;
  watchMode: boolean;
  onWatchModeToggle: (active: boolean) => void;
  countdown: number;
  onRefresh: () => void;
  selectedChain: string;
  onChainChange: (chain: string) => void;
  flashing: boolean;
}

export default function DashboardHeader({
  initialAddress,
  onSearch,
  isLoading,
  watchMode,
  onWatchModeToggle,
  countdown,
  onRefresh,
  selectedChain,
  onChainChange,
  flashing,
}: DashboardHeaderProps) {
  const [addressInput, setAddressInput] = useState(initialAddress);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // errorMsg + protocolBadge derive purely from `addressInput` — compute during
  // render instead of mirroring the input into state via an effect.
  const validation = addressInput ? validateAddress(addressInput) : null;
  const errorMsg =
    validation && !validation.isValid ? validation.error || 'Invalid address format' : '';
  const protocolBadge =
    validation && validation.isValid
      ? validation.protocol === 'kamino'
        ? { text: 'Kamino (Solana)', gradient: 'from-cyan-400 to-purple-500' }
        : { text: 'Aave V3 (EVM)', gradient: 'from-blue-500 to-indigo-600' }
      : null;

  // Handle click outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setChainDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress(addressInput).isValid) {
      return;
    }
    onSearch(addressInput, selectedChain);
  };

  const aaveChains = ['all', ...Object.keys(AAVE_CHAINS)];

  return (
    <header
      className={`w-full py-4 px-6 bg-[#0c1224]/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 transition-all duration-300 ${flashing ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : ''
        }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title / Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#00f2fe] to-[#9b51e0] flex items-center justify-center shadow-lg shadow-[#00f2fe]/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent group-hover:brightness-110 transition">
              EQUINOX
            </h1>
            <p className="text-[10px] text-slate-400 tracking-widest font-mono">Lending & Liquidation Dashboard</p>
          </div>
        </Link>

        {/* Search & Configuration Forms */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-2xl flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Paste Solana or EVM address..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className={`w-full h-11 pl-4 pr-32 rounded-lg bg-slate-900/60 border ${errorMsg
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                  : 'border-slate-800/80 focus:border-[#00f2fe]/50 focus:ring-1 focus:ring-[#00f2fe]/20'
                } text-slate-100 text-sm placeholder-slate-500 focus:outline-none transition-all`}
            />
            {protocolBadge && (
              <span className={`absolute right-3 top-2.5 px-2.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${protocolBadge.gradient} shadow-sm`}>
                {protocolBadge.text}
              </span>
            )}
            {errorMsg && (
              <p className="absolute left-1 -bottom-5 text-[10px] text-red-400 font-mono">{errorMsg}</p>
            )}
          </div>

          <div className="flex gap-2 h-11">
            {/* Chain Selector dropdown (only active if address is EVM or not resolved yet) */}
            {(!protocolBadge || protocolBadge.text.includes('Aave')) && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
                  className="h-full px-4 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-300 text-sm flex items-center gap-2 hover:bg-slate-800/40 transition-colors focus:outline-none"
                >
                  <span className="capitalize">{selectedChain === 'all' ? 'All Networks' : selectedChain}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {chainDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg bg-slate-900 border border-slate-800 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-xs text-slate-500 border-b border-slate-800 font-mono">EVM Chain Filter</div>
                    <div className="max-h-60 overflow-y-auto">
                      {aaveChains.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            onChainChange(c);
                            setChainDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white flex items-center justify-between transition-colors capitalize"
                        >
                          <span>{c === 'all' ? 'All Networks' : c}</span>
                          {selectedChain === c && <Check className="w-4 h-4 text-[#00f2fe]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Visualize Button */}
            <button
              type="submit"
              disabled={isLoading || !!errorMsg || !addressInput}
              className="px-5 rounded-lg bg-gradient-to-r from-[#00f2fe]/80 to-[#9b51e0]/80 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00f2fe]/10 hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Analyze</span>
            </button>
          </div>
        </form>

        {/* Watch Mode & Polling Controls */}
        <div className="flex items-center gap-4 border-l border-slate-800/80 pl-0 md:pl-4">
          {/* Watch Mode Toggle */}
          <button
            onClick={() => onWatchModeToggle(!watchMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${watchMode
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900/40 border-slate-800/80 text-slate-400'
              }`}
          >
            {watchMode ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="text-xs font-medium font-mono">Live Watch</span>
            {watchMode && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          {/* Countdown & Refresh */}
          <div className="flex items-center gap-3">
            {watchMode && (
              <div className="relative w-8 h-8 flex items-center justify-center">
                {/* SVG Countdown Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    stroke="#1e293b"
                    strokeWidth="2.5"
                    fill="transparent"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    fill="transparent"
                    strokeDasharray={75.4}
                    strokeDashoffset={75.4 - (75.4 * countdown) / 15}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold font-mono text-emerald-400">{countdown}</span>
              </div>
            )}

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all cursor-pointer disabled:opacity-50"
              title="Manual refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00f2fe]' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
