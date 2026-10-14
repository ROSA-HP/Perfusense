import React, { useState, useRef, useEffect } from 'react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedPod: string;
  setSelectedPod: (pod: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedPod,
  setSelectedPod,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const navItems = [
    {
      id: 'monitor' as ActiveTab,
      label: 'Monitor',
      icon: 'sensors',
      badge: 'LIVE',
    },
    {
      id: 'bed-roster' as ActiveTab,
      label: 'Bed Roster',
      icon: 'bed',
      badge: '8 BEDS',
    },
    {
      id: 'turn-schedule' as ActiveTab,
      label: 'Turn Schedule',
      icon: 'timer',
      badge: 'DUE NOW',
      badgeColor: 'bg-[#8b2635] text-white',
    },
    {
      id: 'peak-alerts' as ActiveTab,
      label: 'Peak Alerts',
      icon: 'warning',
      badge: '1 ACTIVE',
      badgeColor: 'bg-[#d97757] text-white',
    },
    {
      id: 'sensor-mat-hardware' as ActiveTab,
      label: 'Sensor Mat Hardware',
      icon: 'memory',
      badge: '64 CH',
    },
  ];

  const isVisible = isOpen || isPinned;

  return (
    <>
      {/* Far-Left Screen Edge Hover Sensor Zone - Starts strictly BELOW navbar */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="fixed left-0 top-[84px] sm:top-[92px] bottom-0 w-4 sm:w-5 z-30 cursor-pointer group"
        title="Hover to open navigation menu"
      >
        {/* Subtle Edge Indicator Bar */}
        <div className="absolute inset-y-0 left-0 w-1 bg-[#1d635d]/40 group-hover:bg-[#1d635d] group-hover:w-1.5 transition-all duration-200" />
      </div>

      {/* Persistent Tactile Tab Handle on Left Edge when Minimized */}
      {!isVisible && (
        <button
          onClick={() => setIsOpen(true)}
          onMouseEnter={handleMouseEnter}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-[#1d635d] hover:bg-[#121c1b] text-white border-[2px] border-[#121c1b] border-l-0 shadow-[2px_2px_0px_#121c1b] py-2 px-1 rounded-r-md flex flex-col items-center gap-1 cursor-pointer transition-all hover:translate-x-0.5 select-none"
          title="Click or hover to open Navigation"
        >
          <span className="material-symbols-outlined text-[15px]">
            chevron_right
          </span>
          <span className="font-label-mono-sm text-[8px] uppercase tracking-widest [writing-mode:vertical-rl] font-bold text-[#adefe7]">
            NAV
          </span>
        </button>
      )}

      {/* Minimized / Flyout Sidebar Container - Positioned flush below navbar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-[84px] sm:top-[92px] bottom-0 w-52 sm:w-56 bg-[#ebf6f4] border-r-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] z-40 flex flex-col justify-between p-2.5 overflow-y-auto select-none transition-transform duration-200 ease-out ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-3">
          {/* Top Bar inside Sidebar: Title & Controls (NO logo, NO project name) */}
          <div className="flex items-center justify-between pb-2 border-b-[2px] border-[#121c1b]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[#1d635d]">
                menu
              </span>
              <span className="font-headline-sm text-xs uppercase font-bold text-[#121c1b] tracking-wider">
                NAVIGATION
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Pin / Keep Open Toggle */}
              <button
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? 'Unpin sidebar (auto-hide on mouse leave)' : 'Pin sidebar open'}
                className={`p-1 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] transition-all cursor-pointer ${
                  isPinned
                    ? 'bg-[#1d635d] text-white'
                    : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#dfeae8]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  push_pin
                </span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setIsPinned(false);
                  setIsOpen(false);
                }}
                title="Collapse sidebar"
                className="p-1 border-[2px] border-[#121c1b] bg-[#ffffff] hover:bg-[#dfeae8] shadow-[1px_1px_0px_#121c1b] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  chevron_left
                </span>
              </button>
            </div>
          </div>

          {/* Care Unit Location Selector */}
          <div className="p-2 border-[2px] border-[#121c1b] bg-[#ffffff] shadow-[2px_2px_0px_#121c1b]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label-mono-sm text-[#3f4947] uppercase tracking-wider text-[10px] font-bold">
                ASSIGNED LOCATION
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#1d635d] animate-pulse"></span>
            </div>
            <div className="flex items-center justify-between bg-[#f1fcf9] px-2 py-1 border border-[#121c1b]">
              <select
                value={selectedPod}
                onChange={(e) => setSelectedPod(e.target.value)}
                aria-label="Assigned Location"
                className="bg-transparent font-label-mono-md text-[11px] text-[#121c1b] font-bold outline-none cursor-pointer w-full"
              >
                <option value="BED 07 / ICU-POD-3">BED 07 / ICU-POD-3</option>
                <option value="BED 03 / ICU-POD-1">BED 03 / ICU-POD-1</option>
                <option value="BED 101 / WING 4 NORTH">BED 101 / WING 4 NORTH</option>
                <option value="WARD OVERVIEW / ALL">WARD OVERVIEW / ALL</option>
              </select>
            </div>
          </div>

          {/* Navigation Items List */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (!isPinned) {
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 border-[2px] border-[#121c1b] font-headline-sm text-xs uppercase transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[2px_2px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-[#ffffff] text-[#121c1b] shadow-[1px_1px_0px_#121c1b] hover:bg-[#dfeae8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">
                      {item.icon}
                    </span>
                    <span className="font-bold text-[11px] sm:text-xs">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-label-mono-sm px-1 py-0.2 text-[8px] border border-[#121c1b] font-bold ${
                        item.badgeColor || (isActive ? 'bg-[#adefe7] text-[#00201d]' : 'bg-[#ebf6f4] text-[#121c1b]')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Hardware link & Protocol Status footer */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#121c1b]/30">
          <div className="p-1.5 border border-[#121c1b] bg-[#ffffff] shadow-[1px_1px_0px_#121c1b]">
            <div className="font-label-mono-sm uppercase text-[#3f4947] text-[9px]">HARDWARE LINK</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-label-mono-md text-[10px] text-[#1d635d] font-bold">BLE: 100%</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#1d635d] animate-ping"></span>
            </div>
          </div>

          <div className="p-1.5 border border-[#121c1b] bg-[#e5f0ee] shadow-[1px_1px_0px_#121c1b]">
            <div className="font-label-mono-sm uppercase text-[#3f4947] text-[9px]">PROTOCOL STATUS</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-[#1d635d] border border-[#121c1b]"></span>
              <span className="font-label-mono-md text-[10px] text-[#121c1b] font-bold">Q2H OFFLOAD</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
