import React, { useState } from 'react';

import { PatientBed } from '../types';
import { api } from '../api/client';

interface LiveHeatmapViewProps {
  onOpenProtocolEdit?: () => void;
  onOpenTurnLog: () => void;
  showToast: (title: string, desc?: string) => void;
  liveMatrix?: number[][] | null;
  peakPressure?: number | null;
  peakZone?: string | null;
  isApiConnected?: boolean;
  onSnooze?: () => void;
  bed?: PatientBed | null;
}

export const LiveHeatmapView: React.FC<LiveHeatmapViewProps> = ({
  onOpenTurnLog,
  showToast,
  liveMatrix,
  peakPressure,
  peakZone,
  isApiConnected = false,
  onSnooze,
  bed,
}) => {
  // 8x8 matrix pressure levels (0=none, 1=light, 2=heavy, 3=hotspot)
  const initialMatrix = [
    [0, 0, 1, 1, 1, 0, 0, 0], // Row 1: Head/Neck
    [0, 1, 2, 2, 1, 1, 0, 0], // Row 2: Shoulders
    [0, 1, 2, 1, 1, 0, 0, 0], // Row 3: Mid Back
    [0, 2, 3, 3, 2, 1, 0, 0], // Row 4: Sacrum / Hip Hotspot
    [0, 1, 2, 2, 1, 0, 0, 0], // Row 5: Lower Sacrum
    [0, 1, 1, 1, 0, 0, 0, 0], // Row 6: Thighs
    [0, 0, 1, 1, 0, 0, 0, 0], // Row 7: Lower Legs
    [0, 0, 2, 1, 0, 0, 0, 0], // Row 8: Heels
  ];

  const currentMatrix = (liveMatrix && liveMatrix.length === 8) ? liveMatrix : initialMatrix;
  const currentPeak = peakPressure ?? 68.4;
  const currentZone = peakZone || 'SACRUM & TROCHANTER';

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; val: number } | null>({
    r: 3,
    c: 2,
    val: 3,
  });

  const [turnCompleted, setTurnCompleted] = useState<boolean>(false);
  const [snoozeActive, setSnoozeActive] = useState<boolean>(false);

  const handleDoneTurned = () => {
    setTurnCompleted(true);
    onOpenTurnLog();
    setTimeout(() => {
      setTurnCompleted(false);
    }, 4500);
  };

  const handleSnooze = () => {
    setSnoozeActive(true);
    if (onSnooze) {
      onSnooze();
    } else {
      showToast('ALARM SNOOZED +5 MIN', 'Clinical alert deferred for bedside assessment.');
    }
    setTimeout(() => {
      setSnoozeActive(false);
    }, 3500);
  };

  const handleExportAudit = () => {
    if (isApiConnected) {
      const url = api.auditLogs.exportCsvUrl(bed?.id || 'bed-07');
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Perfusense_Audit_${bed?.id || 'bed-07'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('AUDIT LOG EXPORTED', 'Live CSV downloaded from Perfusense server.');
      return;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,Timestamp,Patient,Zone,PeakMmHg,RN\n09:42,Eleanor Vance,Sacrum,68.4,RN K. Nygård\n08:30,Eleanor Vance,Trochanter,28.0,RN T. Kowalski';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Perfusense_EHR_Bed07_Audit.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('AUDIT LOG EXPORTED', 'Perfusense_EHR_Bed07_Audit.csv downloaded.');
  };

  const cellNames = [
    'Head / Cervical',
    'Shoulders / Acromion',
    'Mid Back / Thoracic',
    'Sacrum & Trochanter',
    'Lower Sacrum / Gluteal',
    'Femoral / Thighs',
    'Lower Legs / Calves',
    'Calcaneus / Heels',
  ];

  return (
    <div className="flex flex-col gap-4 select-none w-full max-w-[1400px] mx-auto">
      {/* Top Metadata Status Strip */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b-[2px] border-[#121c1b]">
        <div className="flex items-center flex-wrap gap-2">
          <div className="bg-[#121c1b] text-[#f1fcf9] px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 bg-[#adefe7] animate-ping inline-block rounded-none"></span>
            <span>{isApiConnected ? 'TELEMETRY FEED // LIVE API' : 'TELEMETRY FEED // STANDALONE'}</span>
          </div>
          <div className="bg-[#ffffff] text-[#121c1b] px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase font-bold text-[10px]">
            PATIENT: {bed?.patientName ? bed.patientName.toUpperCase() : 'ELEANOR V. (AGE 76)'}
          </div>
          <div className="bg-[#1d635d] text-[#ffffff] px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase text-[10px]">
            BRADEN SCORE: {bed?.bradenScore ?? 12} ({bed?.bradenRisk ? bed.bradenRisk.toUpperCase() + ' RISK' : 'HIGH RISK'})
          </div>
        </div>

        <div className="flex items-center gap-2 font-label-mono-sm text-[10px] text-[#121c1b]">
          <span>MAT: SENSO-GRID v4.1</span>
          <span className="opacity-40">/</span>
          <span>{isApiConnected ? 'BACKEND: CONNECTED' : 'LATENCY: 14MS'}</span>
        </div>
      </div>

      {/* FULL-WIDTH LIVE HEATMAP CARD (Zone Timers moved to Zones page) */}
      <div className="w-full bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-4 sm:p-5 flex flex-col gap-4">
        {/* Card Header without fake sample stickers */}
        <div className="flex items-center justify-between pb-2 border-b-[2px] border-[#121c1b]">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-[#1d635d]"></div>
            <h2 className="font-headline-lg text-[#121c1b] tracking-tight uppercase text-sm sm:text-base font-bold">
              LIVE CONTACT PRESSURE HEATMAP
            </h2>
          </div>
          <div className="font-label-mono-sm text-xs text-[#1d635d] font-bold">
            {bed?.bedNumber || 'BED 07'} // CONTINUOUS MONITORING
          </div>
        </div>

        {/* Heatmap Grid & Side Details in Expanded 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Centered 8x8 Tactile Matrix */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="bg-[#ffffff] p-3 border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] w-full max-w-[360px]">
              <div className="grid grid-cols-8 gap-1.5 aspect-square w-full">
                {currentMatrix.map((row, rIdx) =>
                  row.map((cellVal, cIdx) => {
                    const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;

                    let cellBg = 'bg-[#f1fcf9] border border-[#121c1b]/30';
                    let content = null;

                    if (cellVal === 1) {
                      cellBg = 'bg-[#a3cfc9] border border-[#121c1b]';
                    } else if (cellVal === 2) {
                      cellBg = 'bg-[#1d635d] border border-[#121c1b]';
                    } else if (cellVal === 3) {
                      cellBg =
                        'bg-[#8b2635] border-[2px] border-[#121c1b] ring-2 ring-[#d97757] relative flex items-center justify-center';
                      content = <span className="w-1.5 h-1.5 bg-[#ffffff] rounded-full inline-block"></span>;
                    }

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => setSelectedCell({ r: rIdx, c: cIdx, val: cellVal })}
                        className={`transition-transform hover:scale-110 cursor-pointer ${cellBg} ${
                          isSelected ? 'ring-2 ring-[#1d635d] z-10' : ''
                        }`}
                        title={`Row ${rIdx + 1}, Col ${cIdx + 1} (${cellNames[rIdx]}) - Level: ${cellVal}`}
                      >
                        {content}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="mt-2 text-center font-label-mono-sm text-[#3f4947] uppercase tracking-widest text-[10px] font-bold">
                FOOT OF BED ↓
              </div>
            </div>
          </div>

          {/* Side Telemetry Details */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            {/* Position AI Detection Card */}
            <div className="bg-[#ebf6f4] text-[#121c1b] p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
              <div className="font-label-mono-sm uppercase text-[#121c1b]/80 text-[10px] font-bold">
                ESTIMATED PATIENT POSTURE
              </div>
              <div className="font-headline-sm text-[#1d635d] mt-0.5 uppercase tracking-tight font-bold text-sm">
                {bed?.posture || 'RIGHT 30° LATERAL TILT'}
              </div>
              <div className="mt-1.5 font-label-mono-sm text-[#121c1b] bg-[#ffffff] px-2 py-0.5 border border-[#121c1b] inline-block font-bold text-[10px]">
                CONFIDENCE: 94.2%
              </div>
            </div>

            {/* Discrete 4-Swatch Color-Blind Legend */}
            <div className="bg-[#ffffff] border-[2px] border-[#121c1b] p-3 shadow-[2px_2px_0px_#121c1b] flex flex-col gap-1.5">
              <div className="font-label-mono-sm text-[#121c1b] uppercase border-b border-[#121c1b] pb-1 font-bold text-[10px]">
                PRESSURE RANGE LEGEND
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-[#f1fcf9] border border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">NONE (0-15 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-[#a3cfc9] border border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">LIGHT (16-32 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-[#1d635d] border border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">HEAVY (33-55 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-[#8b2635] border border-[#121c1b] inline-block shrink-0 flex items-center justify-center">
                    <span className="w-1 h-1 bg-[#ffffff]"></span>
                  </span>
                  <span className="font-label-mono-sm text-[#8b2635] font-bold">
                    HOT SPOT (&gt;55 mmHg)
                  </span>
                </div>
              </div>
            </div>

            {/* Mat Pressure Vector Details */}
            <div className="border-[2px] border-[#121c1b] bg-[#ebf6f4] p-3 font-label-mono-sm text-[#121c1b] space-y-1 text-xs">
              <div className="flex justify-between">
                <span>ACTIVE PIEZOS:</span>
                <span className="font-bold text-[#1d635d]">64/64 OPERATIONAL</span>
              </div>
              <div className="flex justify-between">
                <span>PEAK CONTACT FORCE:</span>
                <span className="font-bold text-[#8b2635]">{currentPeak} mmHg ({currentZone})</span>
              </div>
              <div className="flex justify-between">
                <span>SELECTED SENSOR:</span>
                <span className="font-bold">
                  {selectedCell
                    ? `R${selectedCell.r + 1}-C${selectedCell.c + 1} [${cellNames[selectedCell.r]}]`
                    : 'R4-C3 [SACRUM]'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM GRID ROW: Action Alert & 8-Hour History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* BOTTOM LEFT: ACTION ALERT "FLIP TIME." (6 Cols) */}
        <div className="lg:col-span-6 bg-[#8b2635] text-[#f1fcf9] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-4 sm:p-5 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 bg-[#f1fcf9] border-[2px] border-[#121c1b] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#121c1b]">
                <svg className="text-[#8b2635]" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <polygon fill="#8b2635" points="12,2 23,21 1,21"></polygon>
                  <line stroke="#f1fcf9" strokeLinecap="square" strokeWidth="2.5" x1="12" x2="12" y1="9" y2="14"></line>
                  <circle cx="12" cy="18" fill="#f1fcf9" r="1.3"></circle>
                </svg>
              </div>
              <h1 className="font-display-hero text-[#f1fcf9] uppercase tracking-tight leading-none text-xl sm:text-2xl font-bold">
                FLIP TIME.
              </h1>
            </div>

            <p className="font-body-md text-[#f1fcf9] max-w-lg mb-3 text-xs leading-relaxed">
              Sacrum contact threshold reached (112m dwell). Reposition patient to right 30-degree tilt using standard foam wedge.
            </p>

            <div className="bg-[#121c1b] text-[#f1fcf9] p-2 border-[2px] border-[#121c1b] mb-4 flex items-center justify-between font-label-mono-sm text-[10px]">
              <span>RECOMMENDED POSE:</span>
              <span className="bg-[#adefe7] text-[#00201d] px-2 py-0.5 font-bold uppercase text-[10px]">
                RIGHT 30° LATERAL
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={handleDoneTurned}
              className={`px-4 py-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-headline-sm text-xs uppercase tracking-tight cursor-pointer transition-all flex items-center gap-2 neo-btn ${
                turnCompleted
                  ? 'bg-[#f1fcf9] text-[#121c1b]'
                  : 'bg-[#d97757] text-[#ffffff] hover:shadow-[3px_3px_0px_#121c1b]'
              }`}
            >
              <span className={`w-3 h-3 inline-block ${turnCompleted ? 'bg-[#121c1b]' : 'bg-[#ffffff]'}`}></span>
              <span>{turnCompleted ? 'RECORDED: 09:42' : 'DONE, TURNED'}</span>
            </button>

            <button
              onClick={handleSnooze}
              className={`px-4 py-2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-headline-sm text-xs uppercase tracking-tight cursor-pointer transition-all flex items-center gap-1.5 neo-btn ${
                snoozeActive
                  ? 'bg-[#a3cfc9] text-[#121c1b]'
                  : 'bg-[#ffffff] text-[#121c1b] hover:shadow-[3px_3px_0px_#121c1b]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-[#121c1b]">
                {snoozeActive ? 'check' : 'update'}
              </span>
              <span>{snoozeActive ? 'SNOOZED +5M' : 'SNOOZE 5 MIN'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: LAST 8 HOURS HISTORY (6 Cols) */}
        <div className="lg:col-span-6 bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b-[2px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="font-headline-lg text-[#121c1b] uppercase tracking-tight text-sm sm:text-base font-bold">
                  LAST 8 HOURS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#121c1b] text-[#f1fcf9] border border-[#121c1b] px-2 py-0.5 font-label-mono-sm uppercase font-bold text-[9px]">
                  MAT ONLINE
                </span>
                <span className="bg-[#1d635d] text-[#ffffff] border border-[#121c1b] px-2 py-0.5 font-label-mono-sm font-bold uppercase text-[9px]">
                  6 ON-TIME TURNS
                </span>
              </div>
            </div>

            <div className="font-label-mono-sm text-[10px] text-[#121c1b] mb-1.5 uppercase font-bold">
              BODY POSTURE CHRONOLOGY
            </div>

            {/* Segmented Timeline Bar */}
            <div className="w-full border-[2px] border-[#121c1b] bg-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex overflow-hidden">
              <div className="w-[31.25%] bg-[#a3cfc9] text-[#121c1b] py-2 px-1.5 border-r-[2px] border-[#121c1b] flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase text-[10px]">BACK</span>
                <span className="font-label-mono-sm text-[9px]">2.5 H</span>
              </div>
              <div className="w-[43.75%] bg-[#1d635d] text-[#ffffff] py-2 px-1.5 border-r-[2px] border-[#121c1b] flex flex-col justify-center items-center text-center relative">
                <span className="font-label-mono-md font-bold uppercase text-[10px]">LEFT</span>
                <span className="font-label-mono-sm text-[9px]">3.5 H (NOW)</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#d97757]"></span>
              </div>
              <div className="w-[25%] bg-[#f1fcf9] text-[#121c1b] py-2 px-1.5 flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase text-[10px]">RIGHT</span>
                <span className="font-label-mono-sm text-[9px]">2.0 H</span>
              </div>
            </div>

            {/* Time Tick Markers */}
            <div className="w-full flex justify-between items-center mt-1.5 font-label-mono-sm text-[9px] text-[#121c1b] px-1 font-bold">
              <span className="flex items-center gap-1">
                <span className="w-1 h-2 bg-[#121c1b] inline-block"></span>
                <span>8H AGO</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-2 bg-[#121c1b] inline-block"></span>
                <span>4H AGO</span>
              </span>
              <span className="flex items-center gap-1 text-[#1d635d]">
                <span className="w-1 h-2 bg-[#1d635d] inline-block"></span>
                <span>NOW [09:42]</span>
              </span>
            </div>
          </div>

          {/* Quick Telemetry Summary */}
          <div className="mt-3 pt-2 border-t border-[#121c1b] grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-[#ebf6f4] border border-[#121c1b] p-2 shadow-[1px_1px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[9px] text-[#121c1b]/70 uppercase">CUMULATIVE SACRUM</div>
              <div className="font-headline-sm text-xs text-[#8b2635] font-bold">5.2H / 8H</div>
            </div>
            <div className="bg-[#ebf6f4] border border-[#121c1b] p-2 shadow-[1px_1px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[9px] text-[#121c1b]/70 uppercase">NURSE TURNS</div>
              <div className="font-headline-sm text-xs text-[#121c1b] font-bold">3 LOGGED</div>
            </div>
            <div className="bg-[#1d635d] text-[#ffffff] border border-[#121c1b] p-2 shadow-[1px_1px_0px_#121c1b] col-span-2 sm:col-span-1">
              <div className="font-label-mono-sm text-[9px] text-[#f1fcf9]/80 uppercase">AVG CYCLE</div>
              <div className="font-headline-sm text-xs text-[#ffffff] font-bold">114 MIN</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bedside Quick Action Bar */}
      <div className="w-full p-3 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1d635d] text-[18px]">verified_user</span>
          <span className="font-body-sm text-xs text-[#121c1b]">
            Continuous contact monitoring active on BED 07. All readings sync to patient chart.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTurnLog}
            className="px-3 py-1.5 bg-[#f1fcf9] hover:bg-[#adefe7] border border-[#121c1b] font-label-mono-sm uppercase text-[#121c1b] font-bold text-[10px] shadow-[1px_1px_0px_#121c1b] transition-all neo-btn cursor-pointer whitespace-nowrap"
          >
            LOG BEDSIDE TURN
          </button>
          <button
            onClick={handleExportAudit}
            className="px-3 py-1.5 bg-[#1d635d] hover:bg-[#121c1b] text-white border border-[#121c1b] font-label-mono-sm uppercase font-bold text-[10px] shadow-[1px_1px_0px_#121c1b] transition-all neo-btn flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>EXPORT RECORD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
