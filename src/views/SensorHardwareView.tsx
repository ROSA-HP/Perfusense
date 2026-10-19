import React, { useState } from 'react';
import { PiezoCell } from '../types';
import { getSmoothPressureColor, getLegendGradientCss } from '../utils/heatmapColors';

interface SensorHardwareViewProps {
  cells: PiezoCell[];
  showToast: (title: string, desc?: string) => void;
  onTare?: () => void;
  isApiConnected?: boolean;
}

export const SensorHardwareView: React.FC<SensorHardwareViewProps> = ({
  cells,
  showToast,
  onTare,
  isApiConnected = false,
}) => {
  const [selectedCell, setSelectedCell] = useState<PiezoCell>(
    cells.find((c) => c.id === 'PZ-65') || cells.find((c) => c.id === 'PZ-36') || cells[0]
  );

  const handleTare = () => {
    if (onTare) {
      onTare();
    } else {
      showToast('MAT TARE INITIATED', 'Baseline voltage re-zeroed across all 100 piezoelectric cells.');
    }
  };

  const selectedStyle = getSmoothPressureColor(selectedCell.load);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 select-none w-full max-w-[1200px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EDE8DC] p-3 sm:p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold text-sm sm:text-lg">
              100-PIEZO CELL TOPOLOGY MAP (10×10)
            </h1>
          </div>
          <p className="font-body-sm text-[#3f4947] text-[11px] sm:text-xs mt-0.5">
            BED 07 // Interactive 10×10 sensor mat transducer matrix with smooth clinical gradient colors.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleTare}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs font-bold uppercase transition-all neo-btn flex items-center justify-center gap-1.5 cursor-pointer"
            title="Calibrate empty mat reading as baseline zero"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>TARE MAT</span>
          </button>
          <span className="bg-[#1d635d] text-white font-label-mono-sm px-2.5 py-1.5 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            {cells.length}/{cells.length} ACTIVE
          </span>
          <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-2.5 py-1.5 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            {isApiConnected ? 'CALIBRATED (API)' : 'CALIBRATED'}
          </span>
        </div>
      </div>

      {/* Main 100-Cell Topology Card */}
      <div className="bg-[#ffffff] p-3 sm:p-6 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] sm:shadow-[4px_4px_0px_#121c1b] flex flex-col gap-4 sm:gap-5">
        {/* Status Legend */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[#121c1b]/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="font-label-mono-sm text-[11px] sm:text-xs font-bold text-[#121c1b]">
              SMOOTH SENSOR SPECTRUM [10×10 MATRIX]
            </div>
            <div className="font-label-mono-sm text-[10px] sm:text-xs font-bold text-[#1d635d]">
              RESTING → LIGHT → HEAVY → HOTSPOT
            </div>
          </div>

          {/* Continuous gradient strip */}
          <div className="w-full">
            <div
              className="w-full h-3.5 border border-[#121c1b]"
              style={{ background: getLegendGradientCss() }}
            ></div>
            <div className="grid grid-cols-4 text-[9px] font-label-mono-sm font-bold text-[#121c1b] mt-0.5">
              <span>0-15m (REST)</span>
              <span className="text-center">16-32m (LIGHT)</span>
              <span className="text-center">33-55m (HEAVY)</span>
              <span className="text-right text-[#8b2635]">&gt;55m (HOT)</span>
            </div>
          </div>
        </div>

        {/* 10x10 Topology Matrix Box */}
        <div className="relative w-full bg-[#ebf6f4] p-2.5 sm:p-6 border-[2px] border-[#121c1b] flex flex-col items-center">
          <div className="w-full max-w-[340px] xs:max-w-[380px] sm:max-w-2xl flex justify-between items-center px-1 mb-2 font-label-mono-sm text-[#3f4947] text-[10px] sm:text-[11px] font-bold">
            <span>&lt; HEAD ROW 01-10 &gt;</span>
            <span className="hidden xs:inline">ANTERIOR-POSTERIOR AXIS</span>
          </div>

          {/* 10x10 Clickable Matrix */}
          <div className={`grid ${cells.length <= 64 ? 'grid-cols-8' : 'grid-cols-10'} gap-0.5 sm:gap-1.5 w-full max-w-[340px] xs:max-w-[380px] sm:max-w-2xl bg-[#ffffff] p-2 sm:p-4 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] sm:shadow-[3px_3px_0px_#121c1b]`}>
            {cells.map((cell) => {
              const isSelected = selectedCell.id === cell.id;
              const style = getSmoothPressureColor(cell.load);

              return (
                <button
                  key={cell.id}
                  onClick={() => {
                    setSelectedCell(cell);
                    showToast(`INSPECTING ${cell.id}`, `Zone: ${cell.zone} | Load: ${cell.load} mmHg (${style.label})`);
                  }}
                  style={{
                    backgroundColor: style.bg,
                    color: style.textColor,
                  }}
                  className={`w-full aspect-square flex flex-col items-center justify-center p-0.5 sm:p-1 text-center font-label-mono-sm text-[7px] xs:text-[8px] sm:text-[9px] tracking-tight leading-none border-[1.5px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] cursor-pointer transition-all duration-500 ease-out active:scale-95 hover:scale-105 hover:z-10 ${
                    isSelected ? 'ring-2 sm:ring-3 ring-[#121c1b] scale-105 z-10' : ''
                  }`}
                  title={`${cell.id} [${cell.zone}] - ${cell.load} mmHg (${style.label})`}
                >
                  <span className="font-bold pointer-events-none">
                    {String(cell.num).padStart(2, '0')}
                  </span>
                  <span className="text-[6.5px] sm:text-[8px] opacity-90 pointer-events-none mt-0.5 font-bold">
                    {cell.load}m
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full max-w-[340px] xs:max-w-[380px] sm:max-w-2xl flex justify-between items-center px-1 mt-2 font-label-mono-sm text-[#3f4947] text-[10px] sm:text-[11px] font-bold">
            <span>&lt; HEEL ROW 91-100 &gt;</span>
            <span>FOOT OF BED ↓</span>
          </div>
        </div>

        {/* Selected Node Details Bar */}
        <div className="bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2.5 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border border-[#121c1b] font-label-mono-lg font-bold shrink-0 shadow-[1px_1px_0px_#121c1b]"
              style={{
                backgroundColor: selectedStyle.bg,
                color: selectedStyle.textColor,
              }}
            >
              {String(selectedCell.num).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className="font-headline-sm font-bold text-xs uppercase text-[#121c1b] truncate">
                NODE {selectedCell.id} // {selectedCell.zone}
              </div>
              <div className="font-label-mono-sm text-[#3f4947] text-[9px] sm:text-[10px] mt-0.5">
                VOLT: <span className="font-bold text-[#121c1b]">{selectedCell.volt}</span> | SNR:{' '}
                <span className="font-bold text-[#121c1b]">{selectedCell.snr}</span> | IMP:{' '}
                <span className="font-bold text-[#121c1b]">{selectedCell.impedance}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#121c1b]/20">
            <span className="font-label-mono-sm text-[11px] sm:text-xs font-bold text-[#121c1b]">
              CURRENT LOAD:
            </span>
            <span
              className="px-2.5 py-1 border border-[#121c1b] font-headline-sm font-bold text-xs sm:text-sm shadow-[1px_1px_0px_#121c1b]"
              style={{
                backgroundColor: selectedStyle.bg,
                color: selectedStyle.textColor,
              }}
            >
              {selectedCell.load} mmHg ({selectedStyle.label})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
