import React, { useState } from 'react';
import { ZoneTimer } from '../types';

interface LiveHeatmapViewProps {
  onOpenProtocolEdit: () => void;
  onOpenTurnLog: () => void;
  showToast: (title: string, desc?: string) => void;
}

export const LiveHeatmapView: React.FC<LiveHeatmapViewProps> = ({
  onOpenProtocolEdit,
  onOpenTurnLog,
  showToast,
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

  const [matrix, setMatrix] = useState<number[][]>(initialMatrix);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; val: number } | null>({
    r: 3,
    c: 2,
    val: 3,
  });

  const [turnCompleted, setTurnCompleted] = useState<boolean>(false);
  const [snoozeActive, setSnoozeActive] = useState<boolean>(false);
  const [timers, setTimers] = useState<ZoneTimer[]>([
    { name: 'SACRUM', elapsedMin: 112, limitMin: 120, isNearLimit: true },
    { name: 'HEELS', elapsedMin: 42, limitMin: 90 },
    { name: 'LEFT HIP', elapsedMin: 78, limitMin: 120, isElevated: true },
    { name: 'SHOULDERS', elapsedMin: 35, limitMin: 120 },
    { name: 'RIGHT HIP', elapsedMin: 10, limitMin: 120 },
    { name: 'ELBOWS', elapsedMin: 18, limitMin: 120 },
  ]);

  const handleDoneTurned = () => {
    setTurnCompleted(true);
    // Reset sacrum timer
    setTimers((prev) =>
      prev.map((t) =>
        t.name === 'SACRUM' ? { ...t, elapsedMin: 4, isNearLimit: false } : t
      )
    );
    showToast('REPOSITION LOGGED: 09:42', 'Patient turned to Right 30° Lateral. Epic flowsheet auto-synced.');
    setTimeout(() => {
      setTurnCompleted(false);
    }, 4500);
  };

  const handleSnooze = () => {
    setSnoozeActive(true);
    showToast('ALARM SNOOZED +5 MIN', 'Clinical alert deferred for bedside assessment.');
    setTimeout(() => {
      setSnoozeActive(false);
    }, 3500);
  };

  const handleExportAudit = () => {
    const csvContent = "data:text/csv;charset=utf-8,Timestamp,Patient,Zone,PeakMmHg,RN\n09:42,Eleanor Vance,Sacrum,68.4,RN K. Nygård\n08:30,Eleanor Vance,Trochanter,28.0,RN T. Kowalski";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "FLIP_EHR_Bed07_Audit.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('AUDIT LOG EXPORTED', 'FLIP_EHR_Bed07_Audit.csv downloaded.');
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
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Top Metadata Status Strip */}
      <div className="w-full flex flex-wrap items-center justify-between gap-4 pb-2 border-b-[3px] border-[#121c1b]">
        <div className="flex items-center flex-wrap gap-3">
          <div className="bg-[#121c1b] text-[#f1fcf9] px-3 py-1 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#adefe7] animate-ping inline-block rounded-none"></span>
            <span>TELEMETRY FEED // RUNNING</span>
          </div>
          <div className="bg-[#ffffff] text-[#121c1b] px-3 py-1 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-sm uppercase font-bold">
            PATIENT: ELEANOR V. (AGE 76)
          </div>
          <div className="bg-[#1d635d] text-[#ffffff] px-3 py-1 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-sm uppercase">
            BRADEN SCORE: 12 (HIGH RISK)
          </div>
        </div>

        <div className="flex items-center gap-2 font-label-mono-sm text-[#121c1b]">
          <span>MAT: SENSO-GRID v4.1</span>
          <span className="opacity-40">/</span>
          <span>LATENCY: 14MS</span>
        </div>
      </div>

      {/* TOP GRID ROW: Heatmap & Zone Timers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT CARD: LIVE HEATMAP (7 Cols) */}
        <div className="lg:col-span-7 bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] p-5 sm:p-6 flex flex-col gap-5 relative">
          {/* Card Header with Sticker */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-[#1d635d]"></div>
              <h2 className="font-headline-lg text-[#121c1b] tracking-tight uppercase">
                LIVE HEATMAP
              </h2>
            </div>
            {/* Sample Data Sticker */}
            <div className="rotate-2 bg-[#f1fcf9] text-[#121c1b] border-[3px] border-dashed border-[#121c1b] shadow-[3px_3px_0px_#121c1b] px-3 py-0.5 font-label-mono-sm uppercase tracking-wider font-bold">
              [SAMPLE DATA]
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            {/* 8x8 Tactile Matrix (Obsidian Bio-Slate Backdrop) */}
            <div className="md:col-span-8 bg-[#121c1b] p-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b]">
              <div className="grid grid-cols-8 gap-1 aspect-square w-full">
                {matrix.map((row, rIdx) =>
                  row.map((cellVal, cIdx) => {
                    const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                    
                    // Render style based on pressure levels
                    let cellBg = 'bg-[#f1fcf9] border border-[#121c1b]/30';
                    let content = null;

                    if (cellVal === 1) {
                      cellBg = 'bg-[#a3cfc9] border border-[#121c1b]';
                    } else if (cellVal === 2) {
                      cellBg = 'bg-[#1d635d] border border-[#121c1b]';
                    } else if (cellVal === 3) {
                      cellBg = 'bg-[#8b2635] border-[2px] border-[#f1fcf9] ring-2 ring-[#d97757] relative flex items-center justify-center';
                      content = <span className="w-1.5 h-1.5 bg-[#ffffff] rounded-full inline-block"></span>;
                    }

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => setSelectedCell({ r: rIdx, c: cIdx, val: cellVal })}
                        className={`transition-transform hover:scale-110 cursor-pointer ${cellBg} ${
                          isSelected ? 'ring-2 ring-[#adefe7] z-10' : ''
                        }`}
                        title={`Row ${rIdx + 1}, Col ${cIdx + 1} (${cellNames[rIdx]}) - Level: ${cellVal}`}
                      >
                        {content}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="mt-2 text-center font-label-mono-sm text-[#f1fcf9]/70 uppercase tracking-widest">
                FOOT OF BED ↓
              </div>
            </div>

            {/* Heatmap Meta & Legend Rail */}
            <div className="md:col-span-4 flex flex-col gap-4">
              {/* Position AI Guess Pill Card */}
              <div className="bg-[#ebf6f4] text-[#121c1b] p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
                <div className="font-label-mono-sm uppercase text-[#121c1b]/80">
                  POSITION (AI GUESS)
                </div>
                <div className="font-headline-sm text-[#1d635d] mt-0.5 uppercase tracking-tight font-bold">
                  LEFT SIDE
                </div>
                <div className="mt-2 font-label-mono-sm text-[#121c1b] bg-[#ffffff] px-2 py-0.5 border-[2px] border-[#121c1b] inline-block font-bold">
                  CONFIDENCE: 94.2%
                </div>
              </div>

              {/* Discrete 4-Swatch Color-Blind Legend */}
              <div className="bg-[#ffffff] border-[3px] border-[#121c1b] p-3 shadow-[3px_3px_0px_#121c1b] flex flex-col gap-2">
                <div className="font-label-mono-sm text-[#121c1b] uppercase border-b-[2px] border-[#121c1b] pb-1 font-bold">
                  PRESSURE SWATCHES
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#f1fcf9] border-[2px] border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">NONE (0-15 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#a3cfc9] border-[2px] border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">LIGHT (16-32 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#1d635d] border-[2px] border-[#121c1b] inline-block shrink-0"></span>
                  <span className="font-label-mono-sm text-[#121c1b]">HEAVY (33-55 mmHg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#8b2635] border-[2px] border-[#121c1b] inline-block shrink-0 flex items-center justify-center">
                    <span className="w-1 h-1 bg-[#ffffff]"></span>
                  </span>
                  <span className="font-label-mono-sm text-[#8b2635] font-bold">
                    HOT SPOT (&gt;55 mmHg)
                  </span>
                </div>
              </div>

              {/* Mat State Vector */}
              <div className="border-[2px] border-[#121c1b] bg-[#ebf6f4] p-2.5 font-label-mono-sm text-[#121c1b] space-y-1">
                <div>
                  ACTIVE PIEZOS: <span className="font-bold text-[#1d635d]">64/64</span>
                </div>
                <div>
                  PEAK FORCE: <span className="font-bold text-[#8b2635]">68.4 mmHg</span>
                </div>
                <div>
                  HOT CELL LOC:{' '}
                  <span className="font-bold">
                    {selectedCell ? `R${selectedCell.r + 1}-C${selectedCell.c + 1} [${cellNames[selectedCell.r]}]` : 'R4-C3 [SACRUM]'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: ZONE TIMERS (5 Cols) */}
        <div className="lg:col-span-5 bg-[#ebf6f4] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            {/* Title Row */}
            <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b-[3px] border-[#121c1b]">
              <h2 className="font-headline-lg text-[#121c1b] uppercase tracking-tight">
                ZONE TIMERS
              </h2>
              <span className="font-label-mono-sm bg-[#ffffff] text-[#121c1b] border-[2px] border-[#121c1b] px-2 py-0.5 font-bold shadow-[2px_2px_0px_#121c1b]">
                LIMIT: 2.0H
              </span>
            </div>

            {/* 6 Anatomical Rows */}
            <div className="flex flex-col gap-3.5">
              {timers.map((t) => {
                const pct = Math.min(100, Math.round((t.elapsedMin / t.limitMin) * 100));
                const isCritical = t.isNearLimit || pct >= 90;
                const isWarning = t.isElevated || (pct >= 60 && pct < 90);

                let barColor = 'bg-[#1d635d]';
                let textColor = 'text-[#121c1b]';

                if (isCritical) {
                  barColor = 'bg-[#8b2635]';
                  textColor = 'text-[#8b2635]';
                } else if (isWarning) {
                  barColor = 'bg-[#d97757]';
                  textColor = 'text-[#d97757]';
                }

                return (
                  <div
                    key={t.name}
                    className={`bg-[#ffffff] p-2.5 sm:p-3 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] relative ${
                      isCritical ? 'ring-1 ring-[#8b2635]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-label-mono-md font-bold ${textColor}`}>
                          {t.name}
                        </span>
                        {isCritical && (
                          <span className="-rotate-2 bg-[#8b2635] text-[#ffffff] text-[10px] font-label-mono-sm px-1.5 py-0.2 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] uppercase font-bold">
                            NEAR ITS LIMIT
                          </span>
                        )}
                      </div>
                      <span className={`font-label-mono-md font-bold ${textColor}`}>
                        {t.elapsedMin} / {t.limitMin} MIN
                      </span>
                    </div>
                    <div className="w-full h-4 sm:h-5 bg-[#ebf6f4] border-[2px] border-[#121c1b] overflow-hidden p-0.5">
                      <div
                        className={`h-full ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footnote Text & Protocol Edit */}
          <div className="mt-4 pt-3 border-t-[2px] border-[#121c1b] font-label-mono-sm text-[#121c1b] flex items-center justify-between">
            <span>* Limits are set with clinical staff.</span>
            <button
              onClick={onOpenProtocolEdit}
              className="font-bold underline cursor-pointer hover:bg-[#ffffff] px-1.5 py-0.5 border border-transparent hover:border-[#121c1b] transition-all"
            >
              PROTOCOL EDIT
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM GRID ROW: Action Alert & 8-Hour History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* BOTTOM LEFT: ACTION ALERT "FLIP TIME." (6 Cols) */}
        <div className="lg:col-span-6 bg-[#8b2635] text-[#f1fcf9] border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] p-6 -rotate-0.5 relative flex flex-col justify-between">
          {/* Urgent Tag Stamp */}
          <div className="absolute -top-3.5 right-6 bg-[#f1fcf9] text-[#8b2635] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] px-3 py-0.5 font-label-mono-sm uppercase font-bold rotate-2">
            [ACTION REQUIRED: +8M REMAINING]
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              {/* Brutalist alert glyph SVG */}
              <div className="w-10 h-10 bg-[#f1fcf9] border-[3px] border-[#121c1b] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#121c1b]">
                <svg className="text-[#8b2635]" fill="none" height="22" viewBox="0 0 24 24" width="22">
                  <polygon fill="#8b2635" points="12,2 23,21 1,21"></polygon>
                  <line stroke="#f1fcf9" strokeLinecap="square" strokeWidth="2.5" x1="12" x2="12" y1="9" y2="14"></line>
                  <circle cx="12" cy="18" fill="#f1fcf9" r="1.3"></circle>
                </svg>
              </div>
              <h1 className="font-display-hero text-[#f1fcf9] uppercase tracking-tight leading-none">
                FLIP TIME.
              </h1>
            </div>

            <p className="font-body-lg text-[#f1fcf9] max-w-lg mb-5 leading-snug">
              Sacrum contact threshold reached (112m dwell). Reposition patient to right 30-degree tilt using standard foam wedge.
            </p>

            <div className="bg-[#121c1b] text-[#f1fcf9] p-3 border-[3px] border-[#121c1b] mb-6 flex items-center justify-between font-label-mono-sm">
              <span>RECOMMENDED POSE:</span>
              <span className="bg-[#adefe7] text-[#00201d] px-2 py-0.5 font-bold uppercase">
                RIGHT 30° LATERAL
              </span>
            </div>
          </div>

          {/* Touch Target Buttons >= 48px */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {/* Button 1: Done, turned */}
            <button
              onClick={handleDoneTurned}
              className={`min-h-[52px] px-6 py-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] font-headline-sm uppercase tracking-tight cursor-pointer transition-all flex items-center gap-2 neo-btn ${
                turnCompleted
                  ? 'bg-[#f1fcf9] text-[#121c1b]'
                  : 'bg-[#d97757] text-[#ffffff] hover:shadow-[6px_6px_0px_#121c1b]'
              }`}
            >
              <span className={`w-3.5 h-3.5 inline-block ${turnCompleted ? 'bg-[#121c1b]' : 'bg-[#ffffff]'}`}></span>
              <span>{turnCompleted ? 'RECORDED: 09:42' : 'DONE, TURNED'}</span>
            </button>

            {/* Button 2: Snooze 5 min */}
            <button
              onClick={handleSnooze}
              className={`min-h-[52px] px-6 py-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] font-headline-sm uppercase tracking-tight cursor-pointer transition-all flex items-center gap-2 neo-btn ${
                snoozeActive
                  ? 'bg-[#a3cfc9] text-[#121c1b]'
                  : 'bg-[#ffffff] text-[#121c1b] hover:shadow-[6px_6px_0px_#121c1b]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-[#121c1b]">
                {snoozeActive ? 'check' : 'update'}
              </span>
              <span>{snoozeActive ? 'SNOOZED +5M' : 'SNOOZE 5 MIN'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: LAST 8 HOURS HISTORY (6 Cols) */}
        <div className="lg:col-span-6 bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] p-6 flex flex-col justify-between">
          <div>
            {/* Header and Stickers */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b-[3px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="font-headline-lg text-[#121c1b] uppercase tracking-tight">
                  LAST 8 HOURS
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Mat Online Chip */}
                <span className="bg-[#121c1b] text-[#f1fcf9] border-[2px] border-[#121c1b] px-2.5 py-1 font-label-mono-sm uppercase font-bold shadow-[2px_2px_0px_#121c1b]">
                  MAT ONLINE
                </span>
                {/* Tilted Streak Sticker */}
                <span className="rotate-[2deg] bg-[#1d635d] text-[#ffffff] border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] px-2.5 py-1 font-label-mono-sm font-bold uppercase">
                  6 ON-TIME TURNS IN A ROW
                </span>
              </div>
            </div>

            <div className="font-label-mono-sm text-[#121c1b] mb-2 uppercase font-bold">
              BODY POSTURE CHRONOLOGY
            </div>

            {/* Segmented Timeline Bar */}
            <div className="w-full border-[3px] border-[#121c1b] bg-[#121c1b] shadow-[4px_4px_0px_#121c1b] flex overflow-hidden">
              {/* BACK: 2.5h (31.25%) */}
              <div className="w-[31.25%] bg-[#a3cfc9] text-[#121c1b] py-3.5 px-2 border-r-[3px] border-[#121c1b] flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase">BACK</span>
                <span className="font-label-mono-sm">2.5 H</span>
              </div>
              {/* LEFT: 3.5h (43.75%) */}
              <div className="w-[43.75%] bg-[#1d635d] text-[#ffffff] py-3.5 px-2 border-r-[3px] border-[#121c1b] flex flex-col justify-center items-center text-center relative">
                <span className="font-label-mono-md font-bold uppercase">LEFT</span>
                <span className="font-label-mono-sm">3.5 H (CURRENT)</span>
                {/* Overdue marker notch */}
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#d97757]"></span>
              </div>
              {/* RIGHT: 2.0h (25%) */}
              <div className="w-[25%] bg-[#f1fcf9] text-[#121c1b] py-3.5 px-2 flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase">RIGHT</span>
                <span className="font-label-mono-sm">2.0 H</span>
              </div>
            </div>

            {/* Time Tick Markers */}
            <div className="w-full flex justify-between items-center mt-2 font-label-mono-sm text-[#121c1b] px-1 font-bold">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-3 bg-[#121c1b] inline-block"></span>
                <span>8 H AGO</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-3 bg-[#121c1b] inline-block"></span>
                <span>4 H AGO</span>
              </span>
              <span className="flex items-center gap-1 text-[#1d635d]">
                <span className="w-1.5 h-3 bg-[#1d635d] inline-block"></span>
                <span>NOW [09:42]</span>
              </span>
            </div>
          </div>

          {/* Additional History Quick Telemetry Card */}
          <div className="mt-6 pt-4 border-t-[2px] border-[#121c1b] grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2.5 shadow-[2px_2px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[#121c1b]/70 uppercase">CUMULATIVE SACRUM</div>
              <div className="font-headline-sm text-[#8b2635] font-bold">5.2 H / 8H</div>
            </div>
            <div className="bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2.5 shadow-[2px_2px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[#121c1b]/70 uppercase">NURSE TURNS</div>
              <div className="font-headline-sm text-[#121c1b]">3 LOGGED</div>
            </div>
            <div className="bg-[#1d635d] text-[#ffffff] border-[2px] border-[#121c1b] p-2.5 shadow-[2px_2px_0px_#121c1b] col-span-2 sm:col-span-1">
              <div className="font-label-mono-sm text-[#f1fcf9]/80 uppercase">AVG CYCLE</div>
              <div className="font-headline-sm text-[#ffffff]">114 MIN</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ward Activity Sticker Strip */}
      <div className="w-full p-4 bg-[#ffffff] border-[4px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-3">
          <span className="font-headline-sm text-[#121c1b] uppercase">SHIFT LOG NOTE:</span>
          <span className="bg-[#1d635d] text-[#ffffff] border-[2px] border-[#121c1b] px-2.5 py-0.5 font-label-mono-sm font-bold shadow-[2px_2px_0px_#121c1b]">
            RN T. KOWALSKI VERIFIED 08:30
          </span>
          <span className="font-body-md text-[#121c1b]">
            Skin check clear over trochanters. Barrier ointment applied 07:15. Mat recalibrated.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTurnLog}
            className="px-3.5 py-2 bg-[#f1fcf9] border-[2px] border-[#121c1b] font-label-mono-sm uppercase text-[#121c1b] font-bold shadow-[2px_2px_0px_#121c1b] hover:bg-[#a3cfc9] transition-colors neo-btn"
          >
            VERIFY BEDSIDE TURN
          </button>
          <button
            onClick={handleExportAudit}
            className="px-3.5 py-2 bg-[#1d635d] text-white border-[2px] border-[#121c1b] font-label-mono-sm uppercase font-bold shadow-[2px_2px_0px_#121c1b] hover:bg-[#121c1b] transition-colors neo-btn flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>EXPORT EHR AUDIT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
