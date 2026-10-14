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
      <div className="fixed top-0 left-0 w-full z-50 bg-[#121c1b] text-[#f1fcf9] h-8 border-b-[3px] border-[#121c1b] flex items-center overflow-hidden select-none">
        <div className="whitespace-nowrap font-label-mono-sm uppercase px-4 flex items-center gap-6 animate-pulse">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#91d3cb] inline-block animate-ping"></span>
            BED 07 // LIVE // SAMPLE DATA // FLIP EARLY // STAY CHILL // REALTIME SENSORS ONLINE // 64 PIEZO CELLS ACTIVE
          </span>
          <span className="opacity-40">//</span>
          <span className="text-[#a3cfc9]">
            [TELEMETRY STREAM] BED 07: STABLE // PRESSURE COORD: SACRAL ZONE 28 mmHg // NEXT TURN: 14M // MAT HARDWARE: CALIBRATED // BED 05: CAUTION HIGH PEAK
          </span>
          <span className="opacity-40">//</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#adefe7]"></span>
            EHR SYNC: 100% (EPIC INPATIENT OK)
          </span>
        </div>
      </div>

      {/* Main Top Header Bar */}
      <header className="fixed top-8 left-0 right-0 z-40 bg-[#f1fcf9] border-b-[4px] border-[#121c1b] h-20 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-6 lg:gap-10">
          {/* Logo */}
          <div
            onClick={() => setActiveTab('monitor')}
            className="flex items-center cursor-pointer select-none group"
            title="FLIP. Clinical OS - Home"
          >
            <div className="w-9 h-9 bg-[#1d635d] flex items-center justify-center border-[3px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] mr-2 text-[#f1fcf9] font-label-mono-lg font-bold">
              FL
            </div>
            <div className="flex items-baseline">
              <span className="font-display-hero text-3xl font-bold tracking-tight text-[#121c1b]">
                FLIP
              </span>
              <span className="font-display-hero text-3xl font-bold text-[#1d635d]">
                .
              </span>
            </div>
          </div>

          {/* Top Pill Navigation Tabs */}
          <nav className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-1.5 rounded-full border-[3px] border-[#121c1b] font-headline-sm text-sm uppercase tracking-wide transition-all select-none ${
                activeTab === 'monitor'
                  ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-[#ebf6f4] text-[#3f4947] hover:bg-[#dfeae8] hover:text-[#121c1b] shadow-[2px_2px_0px_#121c1b]'
              }`}
            >
              Live
            </button>

            <button
              onClick={() => setActiveTab('turn-schedule')}
              className={`px-4 py-1.5 rounded-full border-[3px] border-[#121c1b] font-headline-sm text-sm uppercase tracking-wide transition-all select-none ${
                activeTab === 'turn-schedule'
                  ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-[#ebf6f4] text-[#3f4947] hover:bg-[#dfeae8] hover:text-[#121c1b] shadow-[2px_2px_0px_#121c1b]'
              }`}
            >
              History
            </button>

            <button
              onClick={() => setActiveTab('peak-alerts')}
              className={`px-4 py-1.5 rounded-full border-[3px] border-[#121c1b] font-headline-sm text-sm uppercase tracking-wide transition-all select-none ${
                activeTab === 'peak-alerts'
                  ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-[#ebf6f4] text-[#3f4947] hover:bg-[#dfeae8] hover:text-[#121c1b] shadow-[2px_2px_0px_#121c1b]'
              }`}
            >
              Zones
            </button>

            <button
              onClick={() => setActiveTab('sensor-mat-hardware')}
              className={`px-4 py-1.5 rounded-full border-[3px] border-[#121c1b] font-headline-sm text-sm uppercase tracking-wide transition-all select-none ${
                activeTab === 'sensor-mat-hardware'
                  ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-[#ebf6f4] text-[#3f4947] hover:bg-[#dfeae8] hover:text-[#121c1b] shadow-[2px_2px_0px_#121c1b]'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Right Badges & Staff Info */}
        <div className="flex items-center gap-3">
          {/* Bed ID pill */}
          <div
            onClick={() => setActiveTab('bed-roster')}
            className="hidden sm:flex items-center px-3 py-1 bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] cursor-pointer hover:bg-[#ebf6f4]"
            title="Click to view all beds"
          >
            <span className="font-label-mono-md text-[#121c1b] font-bold">
              BED 07 / ID A-204
            </span>
          </div>

          {/* Heating Up Tilted Tag Sticker */}
          {heatingUpAlert && (
            <div
              onClick={() => setActiveTab('peak-alerts')}
              className="rotate-2 cursor-pointer bg-[#d97757] text-[#ffffff] border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] px-2.5 py-1 font-label-mono-sm uppercase tracking-wider font-bold hover:rotate-0 transition-transform select-none"
              title="Click to view urgent focal ischemia peak"
            >
              [HEATING UP]
            </div>
          )}

          {/* Active Shift Nurse Tag */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#ffffff] px-2.5 py-1 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
            <span className="font-label-mono-sm text-[#3f4947]">ACTIVE SHIFT:</span>
            <span className="font-label-mono-sm text-[#121c1b] font-bold">RN K. NYGÅRD</span>
          </div>

          {/* User profile icon */}
          <div
            className="w-9 h-9 rounded-full bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] text-white cursor-pointer hover:bg-[#121c1b] transition-colors"
            title="Current User: RN Karin Nygård (ICU Ward Lead)"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
        </div>
      </header>
    </>
  );
};
