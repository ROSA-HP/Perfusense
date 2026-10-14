import React from 'react';
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

  return (
    <aside className="fixed left-0 top-28 bottom-0 w-64 lg:w-72 bg-[#ebf6f4] border-r-[4px] border-[#121c1b] z-30 flex flex-col justify-between p-4 overflow-y-auto select-none">
      <div className="flex flex-col gap-4">
        {/* Care Unit Header */}
        <div className="p-3 border-[3px] border-[#121c1b] bg-[#ffffff] shadow-[3px_3px_0px_#121c1b]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-label-mono-sm text-[#3f4947] uppercase tracking-wider">
              ASSIGNED LOCATION
            </span>
            <span className="w-2 h-2 rounded-full bg-[#1d635d] animate-pulse"></span>
          </div>
          <div className="flex items-center justify-between bg-[#f1fcf9] px-2.5 py-1.5 border-[2px] border-[#121c1b]">
            <select
              value={selectedPod}
              onChange={(e) => setSelectedPod(e.target.value)}
              aria-label="Assigned Location"
              className="bg-transparent font-label-mono-md text-[#121c1b] font-bold outline-none cursor-pointer w-full"
            >
              <option value="BED 07 / ICU-POD-3">BED 07 / ICU-POD-3</option>
              <option value="BED 03 / ICU-POD-1">BED 03 / ICU-POD-1</option>
              <option value="BED 101 / WING 4 NORTH">BED 101 / WING 4 NORTH</option>
              <option value="WARD OVERVIEW / ALL">WARD OVERVIEW / ALL</option>
            </select>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 border-[3px] border-[#121c1b] font-headline-sm text-sm uppercase transition-all text-left ${
                  isActive
                    ? 'bg-[#1d635d] text-[#f1fcf9] shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-[#ffffff] text-[#121c1b] shadow-[2px_2px_0px_#121c1b] hover:bg-[#dfeae8]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`font-label-mono-sm px-1.5 py-0.5 text-[10px] border border-[#121c1b] font-bold ${
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
      <div className="flex flex-col gap-2.5 pt-4">
        <div className="p-2.5 border-[3px] border-[#121c1b] bg-[#ffffff] shadow-[3px_3px_0px_#121c1b]">
          <div className="font-label-mono-sm uppercase text-[#3f4947]">HARDWARE LINK</div>
          <div className="flex items-center justify-between mt-1">
            <span className="font-label-mono-md text-[#1d635d] font-bold">BLE: SYNCED 100%</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#1d635d] animate-ping"></span>
          </div>
        </div>

        <div className="p-2.5 border-[3px] border-[#121c1b] bg-[#e5f0ee] shadow-[3px_3px_0px_#121c1b]">
          <div className="font-label-mono-sm uppercase text-[#3f4947]">PROTOCOL STATUS</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 bg-[#1d635d] border border-[#121c1b]"></span>
            <span className="font-label-mono-md text-[#121c1b] font-bold">Q2H OFFLOAD ACTIVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
