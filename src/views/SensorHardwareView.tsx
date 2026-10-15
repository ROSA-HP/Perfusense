import React, { useState } from 'react';
import { PiezoCell } from '../types';

interface SensorHardwareViewProps {
  cells: PiezoCell[];
  showToast: (title: string, desc?: string) => void;
}

export const SensorHardwareView: React.FC<SensorHardwareViewProps> = ({
  cells,
  showToast,
}) => {
  const [selectedCell, setSelectedCell] = useState<PiezoCell>(
    cells.find((c) => c.id === 'PZ-36') || cells[35]
  );

  return (
    <div className="flex flex-col gap-4 select-none w-full max-w-[1200px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EDE8DC] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold text-base sm:text-lg">
              64-PIEZO CELL TOPOLOGY MAP
            </h1>
          </div>
          <p className="font-body-sm text-[#3f4947] text-xs mt-0.5">
            BED 07 // Interactive 8×8 sensor mat transducer matrix. Click any node to inspect cell health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#1d635d] text-white font-label-mono-sm px-2.5 py-1 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            64/64 CELLS ACTIVE
          </span>
          <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-2.5 py-1 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            STATUS: CALIBRATED
          </span>
        </div>
      </div>

      {/* Main 64-Cell Topology Card */}
      <div className="bg-[#ffffff] p-4 sm:p-6 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex flex-col gap-5">
        {/* Status Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#121c1b]/30">
          <div className="font-label-mono-sm text-xs font-bold text-[#121c1b]">
            SENSOR GRID TOPOLOGY [8×8]
          </div>
          <div className="flex items-center gap-4 font-label-mono-sm text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-[#A8C5B5] border border-[#121c1b]"></span>
              NOMINAL (0-30 mmHg)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-[#fe9572] border border-[#121c1b]"></span>
              DRIFT WARN (31-50 mmHg)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-[#8b2635] border border-[#121c1b]"></span>
              PEAK LOAD (&gt;50 mmHg)
            </span>
          </div>
        </div>

        {/* 8x8 Topology Matrix Box */}
        <div className="relative w-full bg-[#ebf6f4] p-4 sm:p-6 border-[2px] border-[#121c1b] flex flex-col items-center">
          <div className="w-full max-w-xl flex justify-between items-center px-1 mb-2 font-label-mono-sm text-[#3f4947] text-[11px] font-bold">
            <span>&lt; HEAD / CERVICAL ROW 01-08 &gt;</span>
            <span>ANTERIOR-POSTERIOR AXIS</span>
          </div>

          {/* 8x8 Clickable Matrix */}
          <div className="grid grid-cols-8 gap-1.5 sm:gap-2 w-full max-w-xl bg-[#ffffff] p-3 sm:p-4 border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
            {cells.map((cell) => {
              const isSelected = selectedCell.id === cell.id;
              let bgStyle = 'bg-[#A8C5B5] text-[#121c1b] hover:bg-[#91d3cb]';
              if (cell.status === 'warn') {
                bgStyle = 'bg-[#fe9572] text-[#121c1b] hover:bg-[#ffb59e]';
              } else if (cell.status === 'critical') {
                bgStyle = 'bg-[#8b2635] text-white hover:bg-[#9d3442]';
              }

              return (
                <button
                  key={cell.id}
                  onClick={() => {
                    setSelectedCell(cell);
                    showToast(`INSPECTING ${cell.id}`, `Zone: ${cell.zone} | Load: ${cell.load} mmHg`);
                  }}
                  className={`w-full aspect-square flex flex-col items-center justify-center p-1 text-center font-label-mono-sm text-[10px] tracking-tight leading-none border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] cursor-pointer transition-transform neo-btn ${bgStyle} ${
                    isSelected ? 'ring-3 ring-[#1d635d] scale-105 z-10' : ''
                  }`}
                  title={`${cell.id} [${cell.zone}] - ${cell.load} mmHg`}
                >
                  <span className="font-bold pointer-events-none">
                    {String(cell.num).padStart(2, '0')}
                  </span>
                  <span className="text-[9px] opacity-80 pointer-events-none mt-0.5">
                    {cell.load}m
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full max-w-xl flex justify-between items-center px-1 mt-2 font-label-mono-sm text-[#3f4947] text-[11px] font-bold">
            <span>&lt; HEEL / CALCANEUS ROW 57-64 &gt;</span>
            <span>FOOT OF BED ↓</span>
          </div>
        </div>

        {/* Selected Node Details Bar */}
        <div className="bg-[#ebf6f4] border-[2px] border-[#121c1b] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1d635d] text-white flex items-center justify-center border border-[#121c1b] font-label-mono-lg font-bold">
              {String(selectedCell.num).padStart(2, '0')}
            </div>
            <div>
              <div className="font-headline-sm font-bold text-xs uppercase text-[#121c1b]">
                NODE {selectedCell.id} // {selectedCell.zone}
              </div>
              <div className="font-label-mono-sm text-[#3f4947] text-[10px] mt-0.5">
                VOLTAGE: <span className="font-bold text-[#121c1b]">{selectedCell.volt}</span> | SNR:{' '}
                <span className="font-bold text-[#121c1b]">{selectedCell.snr}</span> | IMPEDANCE:{' '}
                <span className="font-bold text-[#121c1b]">{selectedCell.impedance}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-label-mono-sm text-xs font-bold text-[#121c1b]">
              CURRENT LOAD:
            </span>
            <span className="px-2.5 py-1 bg-[#ffffff] border border-[#121c1b] font-headline-sm font-bold text-sm text-[#1d635d]">
              {selectedCell.load} mmHg
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
