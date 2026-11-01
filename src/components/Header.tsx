import React from 'react';
import { ActiveTab, PatientBed } from '../types';
import { Logo } from './ui';

interface HeaderProps {
  tabs: { id: ActiveTab; label: string; badge?: number; urgent?: boolean }[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  connected: boolean;
  bed?: PatientBed;
  matFresh: boolean;
}

// The poster's title banner as the app bar: deep teal, the layered logo, white wordmark,
// mono caps chips for the pages.
export const Header: React.FC<HeaderProps> = ({ tabs, activeTab, setActiveTab, connected, bed, matFresh }) => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-[#1d635d] text-white border-b-[3px] border-[#121c1b] h-14 sm:h-16 px-2.5 sm:px-6 flex items-center justify-between gap-2 select-none">
    <div className="flex items-center gap-4 min-w-0">
      <button onClick={() => setActiveTab('monitor')} className="flex items-center gap-2 shrink-0 group" title="PerfuSense: back to the monitor">
        <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
          <Logo />
        </span>
        <span className="leading-none">
          <span className="block font-bold text-lg sm:text-2xl tracking-tight">PerfuSense</span>
          <span className="hidden xl:block text-[10px] text-[#adefe7] font-semibold mt-0.5">Low-cost smart pressure mat · early warning of pressure ulcers</span>
        </span>
      </button>

      <nav className="hidden md:flex items-center gap-1.5" aria-label="Pages">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative px-2.5 py-1 border-[2px] border-[#121c1b] font-label-mono-md uppercase neo-btn inline-flex items-center gap-1.5 transition-colors ${
                active ? 'bg-[#adefe7] text-[#121c1b] shadow-[3px_3px_0px_#121c1b]' : 'bg-[#f1fcf9] text-[#121c1b] hover:bg-white'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className={`px-1 text-[10px] leading-tight border border-[#121c1b] ${t.urgent ? 'bg-[#8b2635] text-white' : 'bg-[#121c1b] text-white'}`}>{t.badge}</span>
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
          className="px-2 py-0.5 bg-[#f1fcf9] text-[#121c1b] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn font-label-mono-md whitespace-nowrap"
          title="Monitored bed. Choose another one on the Beds page."
        >
          {bed.bedNumber}
        </button>
      )}
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 border-[2px] border-[#121c1b] font-label-mono-md whitespace-nowrap ${
          connected ? (matFresh ? 'bg-[#adefe7] text-[#121c1b]' : 'bg-[#f1fcf9] text-[#121c1b]') : 'bg-[#d97757] text-white'
        }`}
        title={connected ? (matFresh ? 'API connected; frames arriving from this mat' : 'API connected; no recent frame from this mat') : 'Backend offline: the app shows SAMPLE DATA'}
      >
        <span className="relative flex w-2 h-2">
          {connected && matFresh && <span className="absolute inset-0 rounded-full bg-[#1d635d] anim-halo-fast" />}
          <span className={`relative w-2 h-2 rounded-full ${connected ? (matFresh ? 'bg-[#1d635d]' : 'bg-[#3f4947]') : 'bg-white'}`} />
        </span>
        {connected ? (matFresh ? 'LIVE' : 'NO SIGNAL') : 'SAMPLE'}
      </span>
    </div>
  </header>
);
