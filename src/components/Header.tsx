import React from 'react';
import { ActiveTab, PatientBed } from '../types';

interface HeaderProps {
  tabs: { id: ActiveTab; label: string; badge?: number; urgent?: boolean }[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  connected: boolean;
  bed?: PatientBed;
  matFresh: boolean;
}

export const Header: React.FC<HeaderProps> = ({ tabs, activeTab, setActiveTab, connected, bed, matFresh }) => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-[#f1fcf9] border-b-[3px] border-[#121c1b] h-14 sm:h-16 px-2.5 sm:px-6 flex items-center justify-between gap-2 select-none">
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={() => setActiveTab('monitor')} className="flex items-center shrink-0" title="Perfusense: back to the monitor">
        <span className="w-8 h-8 bg-[#1d635d] flex items-center justify-center border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] mr-1.5 text-[#f1fcf9] font-label-mono-sm font-bold text-xs">
          PS
        </span>
        <span className="font-bold text-sm sm:text-base tracking-tight">
          PERFUSENSE<span className="text-[#1d635d]">.</span>
        </span>
      </button>

      <nav className="hidden md:flex items-center gap-1.5 ml-2" aria-label="Pages">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-1 rounded-full border-[2px] border-[#121c1b] text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#121c1b] neo-btn inline-flex items-center gap-1.5 ${
                active ? 'bg-[#1d635d] text-white' : 'bg-[#f1fcf9] text-[#1d635d] hover:bg-[#dfeae8]'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className={`px-1 text-[10px] leading-tight border border-[#121c1b] ${t.urgent ? 'bg-[#8b2635] text-white' : 'bg-white text-[#121c1b]'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>

    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {bed && (
        <button
          onClick={() => setActiveTab('bed-roster')}
          className="px-2 py-0.5 bg-white border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn font-label-mono-sm text-[10px] sm:text-[11px] font-bold whitespace-nowrap"
          title="Monitored bed. Choose another one on the Beds page."
        >
          {bed.bedNumber}
          <span className="hidden lg:inline font-normal text-[#3f4947]"> / {bed.pod}</span>
        </button>
      )}
      <span
        className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 border-[2px] border-[#121c1b] font-label-mono-sm text-[10px] font-bold ${
          connected && matFresh ? 'bg-[#adefe7]' : 'bg-white text-[#3f4947]'
        }`}
        title={connected ? (matFresh ? 'Frames are arriving from this mat' : 'No recent frame from this mat') : 'Backend offline'}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${connected && matFresh ? 'bg-[#1d635d] animate-pulse' : 'bg-[#3f4947]'}`} />
        MAT {connected ? (matFresh ? 'LIVE' : 'NO SIGNAL') : '—'}
      </span>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-[10px] font-bold whitespace-nowrap ${
          connected ? 'bg-[#adefe7] text-[#121c1b]' : 'bg-[#d97757] text-white'
        }`}
        title={connected ? 'Connected to the Perfusense API' : 'Backend offline: the app shows SAMPLE DATA'}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#1d635d]' : 'bg-white'}`} />
        {connected ? 'API LIVE' : 'SAMPLE'}
      </span>
    </div>
  </header>
);
