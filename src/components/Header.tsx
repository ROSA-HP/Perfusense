import React from 'react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  heatingUpAlert?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  heatingUpAlert = true,
}) => {
  return (
    <>
      {/* Top Black Marquee / Telemetry Stream Bar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-[#121c1b] text-[#f1fcf9] h-7 border-b-[2px] border-[#121c1b] flex items-center overflow-hidden select-none">
        <div className="whitespace-nowrap font-label-mono-sm text-[10px] uppercase px-3 flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#91d3cb] inline-block animate-ping"></span>
            PERFUSENSE // BED 07 // LIVE // SAMPLE DATA // FLIP EARLY // STAY CHILL // 64 PIEZO CELLS ACTIVE
          </span>
          <span className="opacity-40">//</span>
          <span className="text-[#a3cfc9]">
            [TELEMETRY] BED 07: STABLE // SACRAL 28 mmHg // NEXT TURN: 14M // MAT: CALIBRATED
          </span>
          <span className="opacity-40">//</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#adefe7]"></span>
            EHR SYNC: 100% (EPIC INPATIENT OK)
          </span>
        </div>
      </div>

      {/* Main Top Header Bar - Strictly Single Row (flex-nowrap), Compact & Clean */}
      <header className="fixed top-7 left-0 right-0 z-50 bg-[#f1fcf9] border-b-[3px] border-[#121c1b] h-14 sm:h-16 px-3 sm:px-6 flex flex-nowrap items-center justify-between gap-2 sm:gap-4 select-none overflow-hidden">
        {/* Left Side: Brand & Navigation in a single flex row */}
        <div className="flex flex-nowrap items-center gap-2 sm:gap-4 lg:gap-6 shrink-0 min-w-0">
          {/* Brand Logo: Perfusense */}
          <div
            onClick={() => setActiveTab('monitor')}
            className="flex flex-nowrap items-center cursor-pointer select-none group shrink-0"
            title="Perfusense | Clinical OS"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] mr-1.5 text-[#f1fcf9] font-label-mono-sm font-bold text-xs">
              PS
            </div>
            <div className="flex items-baseline whitespace-nowrap">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#121c1b]">
                PERFUSENSE
              </span>
              <span className="font-bold text-sm sm:text-base text-[#1d635d]">
                .
              </span>
            </div>
          </div>

          {/* Navigation Pill Buttons - Compact single row, never wraps */}
          <nav className="flex flex-nowrap items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-2.5 sm:px-3.5 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
                activeTab === 'monitor'
                  ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                  : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
              }`}
            >
              LIVE
            </button>

            <button
              onClick={() => setActiveTab('turn-schedule')}
              className={`px-2.5 sm:px-3.5 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
                activeTab === 'turn-schedule'
                  ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                  : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
              }`}
            >
              HISTORY
            </button>

            <button
              onClick={() => setActiveTab('peak-alerts')}
              className={`px-2.5 sm:px-3.5 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
                activeTab === 'peak-alerts'
                  ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                  : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
              }`}
            >
              ZONES
            </button>

            <button
              onClick={() => setActiveTab('sensor-mat-hardware')}
              className={`px-2.5 sm:px-3.5 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider transition-all select-none whitespace-nowrap neo-btn ${
                activeTab === 'sensor-mat-hardware'
                  ? 'bg-[#1d635d] text-[#ffffff] shadow-[2px_2px_0px_#121c1b]'
                  : 'bg-[#f1fcf9] text-[#1d635d] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
              }`}
            >
              SETTINGS
            </button>
          </nav>
        </div>

        {/* Right Side: Status Badges in single flex row */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bed ID pill */}
          <div
            onClick={() => setActiveTab('bed-roster')}
            className="hidden md:flex items-center px-2 py-0.5 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] cursor-pointer hover:bg-[#ebf6f4] whitespace-nowrap neo-btn"
            title="Click to view all beds"
          >
            <span className="font-label-mono-sm text-[11px] text-[#121c1b] font-bold">
              BED 07 / ID A-204
            </span>
          </div>

          {/* Heating Up Tilted Tag Sticker */}
          {heatingUpAlert && (
            <div
              onClick={() => setActiveTab('peak-alerts')}
              className="rotate-1 cursor-pointer bg-[#d97757] text-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] px-2 py-0.5 font-label-mono-sm text-[10px] uppercase tracking-wider font-bold hover:rotate-0 transition-transform select-none whitespace-nowrap neo-btn"
              title="Click to view urgent focal ischemia peak"
            >
              [HEATING UP]
            </div>
          )}

          {/* Active Shift Nurse Tag (shows on large screens) */}
          <div className="hidden lg:flex items-center gap-1 bg-[#ffffff] px-2 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] whitespace-nowrap">
            <span className="font-label-mono-sm text-[10px] text-[#3f4947]">SHIFT:</span>
            <span className="font-label-mono-sm text-[10px] text-[#121c1b] font-bold">RN K. NYGÅRD</span>
          </div>

          {/* User profile icon */}
          <div
            className="w-7 h-7 rounded-full bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-white cursor-pointer hover:bg-[#121c1b] transition-colors shrink-0 neo-btn"
            title="Current User: RN Karin Nygård (ICU Ward Lead)"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
          </div>
        </div>
      </header>
    </>
  );
};
