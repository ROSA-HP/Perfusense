import React from 'react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isApiConnected?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isApiConnected = false,
  onToggleSidebar,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#f1fcf9] border-b-[3px] border-[#121c1b] h-14 sm:h-16 px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 select-none">
      {/* Left Side: Hamburger (Mobile) + Brand Logo + Desktop Nav */}
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 min-w-0">
        {/* Mobile / Tablet Menu Drawer Button */}
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-[#ffffff] hover:bg-[#ebf6f4] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-[#121c1b] transition-all cursor-pointer neo-btn shrink-0"
          title="Open Location & Unit Menu"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[19px] sm:text-[21px]">menu</span>
        </button>

        {/* Brand Logo: Perfusense */}
        <div
          onClick={() => setActiveTab('monitor')}
          className="flex items-center cursor-pointer select-none group shrink-0"
          title="Perfusense | Clinical OS"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] mr-1.5 text-[#f1fcf9] font-label-mono-sm font-bold text-xs">
            PS
          </div>
          <div className="flex items-baseline whitespace-nowrap">
            <span className="font-bold text-xs sm:text-base tracking-tight text-[#121c1b]">
              PERFUSENSE
            </span>
            <span className="font-bold text-xs sm:text-base text-[#1d635d]">
              .
            </span>
          </div>
        </div>

        {/* Desktop Navigation Pill Buttons (Hidden on mobile; mobile uses ergonomic bottom nav bar) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 ml-2 shrink-0">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
              activeTab === 'monitor'
                ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            MONITOR
          </button>

          <button
            onClick={() => setActiveTab('bed-roster')}
            className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
              activeTab === 'bed-roster'
                ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            BEDS (8)
          </button>

          <button
            onClick={() => setActiveTab('turn-schedule')}
            className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
              activeTab === 'turn-schedule'
                ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            HISTORY
          </button>

          <button
            onClick={() => setActiveTab('peak-alerts')}
            className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
              activeTab === 'peak-alerts'
                ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            ZONES (6)
          </button>

          <button
            onClick={() => setActiveTab('sensor-mat-hardware')}
            className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
              activeTab === 'sensor-mat-hardware'
                ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
            }`}
          >
            MAT (64)
          </button>
        </nav>
      </div>

      {/* Right Side: Bed Status and Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Bed ID pill (Mobile shows compact BED 07, Desktop shows BED 07 / ID A-204) */}
        <div
          onClick={() => setActiveTab('bed-roster')}
          className="flex items-center px-1.5 sm:px-2 py-0.5 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] cursor-pointer hover:bg-[#ebf6f4] whitespace-nowrap neo-btn"
          title="Click to view all beds in ICU Pod 3"
        >
          <span className="font-label-mono-sm text-[10px] sm:text-[11px] text-[#121c1b] font-bold">
            <span className="hidden sm:inline">BED 07 / ID A-204</span>
            <span className="sm:hidden">BED 07</span>
          </span>
        </div>

        {/* Active Shift Nurse Tag (Desktop only) */}
        <div className="hidden lg:flex items-center gap-1 bg-[#ffffff] px-2 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] whitespace-nowrap">
          <span className="font-label-mono-sm text-[10px] text-[#3f4947]">SHIFT:</span>
          <span className="font-label-mono-sm text-[10px] text-[#121c1b] font-bold">RN K. NYGÅRD</span>
        </div>

        {/* Backend API Connection Status Pill */}
        <div
          className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-[9px] sm:text-[10px] font-bold whitespace-nowrap transition-colors ${
            isApiConnected
              ? 'bg-[#adefe7] text-[#121c1b]'
              : 'bg-[#fff5eb] text-[#8b2635]'
          }`}
          title={
            isApiConnected
              ? 'Express + MongoDB API connected. Real-time telemetry active.'
              : 'Standalone mode. Start server (npm run server) with MongoDB to connect live.'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isApiConnected ? 'bg-[#1d635d] animate-pulse' : 'bg-[#d97757]'
            }`}
          />
          <span className="hidden sm:inline">{isApiConnected ? 'API: LIVE' : 'API: LOCAL'}</span>
          <span className="sm:hidden">{isApiConnected ? 'LIVE' : 'LOCAL'}</span>
        </div>

        {/* User profile icon */}
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] text-white cursor-pointer hover:bg-[#121c1b] transition-colors shrink-0 neo-btn"
          title="Current User: RN Karin Nygård (ICU Ward Lead)"
        >
          <span className="material-symbols-outlined text-[15px] sm:text-[17px]">person</span>
        </div>
      </div>
    </header>
  );
};
