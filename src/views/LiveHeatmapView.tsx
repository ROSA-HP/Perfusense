import React, { useState, useEffect, useRef } from 'react';
import { PatientBed } from '../types';
import { api } from '../api/client';
import {
  getSmoothPressureColor,
  getLegendGradientCss,
  CLINICAL_COLOR_STOPS,
  normalizeToMmHg,
} from '../utils/heatmapColors';

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

// Baseline realistic contact pressure (in mmHg) across 10x10 anatomical cells
const defaultMmHgMatrix: number[][] = [
  [2,  3,  5, 14, 18, 16, 12,  4,  3, 2], // Row 1: Head / Occipital
  [3,  4, 12, 22, 25, 24, 19, 10,  4, 2], // Row 2: Cervical / Upper Trapezius
  [4, 24, 36, 28, 20, 21, 27, 34, 22, 3], // Row 3: Scapulae & Upper Back
  [3, 18, 30, 22, 16, 15, 21, 28, 16, 3], // Row 4: Thoracic & Mid Back
  [3,  8, 16, 15, 14, 13, 14, 16,  7, 3], // Row 5: Lower Thoracic / Mid Spine
  [4, 10, 14, 18, 17, 16, 17, 14,  9, 3], // Row 6: Lumbar Spine & Flanks
  [5, 22, 35, 46, 52, 50, 44, 32, 20, 4], // Row 7: Pelvis & Upper Sacrum
  [6, 38, 54, 68, 72, 70, 62, 48, 32, 5], // Row 8: Sacrum & Trochanter Hotspot
  [3,  6, 12, 18, 20, 19, 17, 12,  5, 2], // Row 9: Femoral, Popliteal & Calves
  [4,  6, 36, 48, 20, 18, 46, 34,  5, 2], // Row 10: Calcaneus / Heels
];

const cellNames = [
  'Head / Occipital',
  'Cervical / Upper Trapezius',
  'Scapulae & Upper Back',
  'Thoracic / Mid Back',
  'Lower Thoracic / Mid Spine',
  'Lumbar Spine & Flanks',
  'Pelvis & Upper Sacrum',
  'Sacrum & Trochanter Hotspot',
  'Femoral, Popliteal & Calves',
  'Calcaneus / Heels',
];

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
  // Local simulated pressure matrix (in continuous mmHg)
  const [localMatrix, setLocalMatrix] = useState<number[][]>(defaultMmHgMatrix);
  const [isLiveWaveActive, setIsLiveWaveActive] = useState<boolean>(true);
  const [showCellNumbers, setShowCellNumbers] = useState<boolean>(false);
  const waveTickRef = useRef<number>(0);

  // Selected cell for fine-tuning & inspection
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; mmHg: number }>({
    r: 7,
    c: 4,
    mmHg: 72,
  });

  const [turnCompleted, setTurnCompleted] = useState<boolean>(false);
  const [snoozeActive, setSnoozeActive] = useState<boolean>(false);

  // When liveMatrix from backend changes, sync it
  useEffect(() => {
    if (liveMatrix && liveMatrix.length === 8) {
      const converted = liveMatrix.map((row) =>
        row.map((val) => normalizeToMmHg(val))
      );
      setLocalMatrix(converted);
    }
  }, [liveMatrix]);

  // Subtle physiological respiration / contact micro-oscillation in standalone mode
  useEffect(() => {
    if (isApiConnected || !isLiveWaveActive) return;

    const interval = setInterval(() => {
      waveTickRef.current += 1;
      const t = waveTickRef.current;

      setLocalMatrix((prev) => {
        return prev.map((row, r) =>
          row.map((baseVal, c) => {
            if (baseVal < 8) {
              // Minimal contact cells stay close to zero with minor drift
              const drift = Math.sin(t * 0.12 + r + c) * 0.8;
              return Math.max(0, Math.round((baseVal + drift) * 10) / 10);
            }
            // Loaded anatomical contact areas experience smooth breathing modulation (±2 to ±4.5 mmHg)
            const modulation = Math.sin(t * 0.16 + r * 0.6 + c * 0.4) * 3.2;
            const microSecondary = Math.cos(t * 0.28 + r * 0.3) * 1.4;
            const nextVal = Math.max(0, Math.min(85, baseVal + modulation + microSecondary));
            return Math.round(nextVal * 10) / 10;
          })
        );
      });
    }, 700);

    return () => clearInterval(interval);
  }, [isApiConnected, isLiveWaveActive]);

  // Determine current effective matrix and peak
  const currentMatrix = localMatrix;

  // Calculate live peak and location
  let computedPeak = 0;
  let computedPeakR = 3;
  let computedPeakC = 2;
  currentMatrix.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v > computedPeak) {
        computedPeak = v;
        computedPeakR = r;
        computedPeakC = c;
      }
    });
  });

  const currentPeak = peakPressure ?? computedPeak;
  const currentZone = peakZone || (cellNames[computedPeakR] ? cellNames[computedPeakR].toUpperCase() : 'SACRUM & TROCHANTER');

  // Keep selectedCell pressure synchronized
  useEffect(() => {
    if (currentMatrix[selectedCell.r] && typeof currentMatrix[selectedCell.r][selectedCell.c] === 'number') {
      setSelectedCell((prev) => ({
        ...prev,
        mmHg: currentMatrix[prev.r][prev.c],
      }));
    }
  }, [currentMatrix, selectedCell.r, selectedCell.c]);

  // User manually tunes pressure on the selected cell
  const handleUpdateCellPressure = (newMmHg: number) => {
    const val = Math.max(0, Math.min(85, newMmHg));
    setSelectedCell((prev) => ({ ...prev, mmHg: val }));
    setLocalMatrix((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[selectedCell.r][selectedCell.c] = val;
      // Slight soft falloff to direct neighbors (smooth fluid distribution)
      const neighbors = [
        [selectedCell.r - 1, selectedCell.c],
        [selectedCell.r + 1, selectedCell.c],
        [selectedCell.r, selectedCell.c - 1],
        [selectedCell.r, selectedCell.c + 1],
      ];
      neighbors.forEach(([nr, nc]) => {
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && copy[nr][nc] > 6) {
          const delta = (val - prev[selectedCell.r][selectedCell.c]) * 0.22;
          copy[nr][nc] = Math.max(0, Math.min(80, Math.round((copy[nr][nc] + delta) * 10) / 10));
        }
      });
      return copy;
    });
  };

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

  const selectedStyle = getSmoothPressureColor(selectedCell.mmHg);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 select-none w-full max-w-[1400px] mx-auto">
      {/* Top Metadata Status Strip */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b-[2px] border-[#121c1b]">
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          <div className="bg-[#121c1b] text-[#f1fcf9] px-2 sm:px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase tracking-wider flex items-center gap-1.5 text-[9px] sm:text-[10px]">
            <span className="w-1.5 h-1.5 bg-[#adefe7] animate-ping inline-block"></span>
            <span>{isApiConnected ? 'FEED // LIVE API' : 'FEED // SMOOTH TELEMETRY'}</span>
          </div>
          <div className="bg-[#ffffff] text-[#121c1b] px-2 sm:px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase font-bold text-[9px] sm:text-[10px]">
            PATIENT: {bed?.patientName ? bed.patientName.toUpperCase() : 'ELEANOR V. (AGE 76)'}
          </div>
          <div className="bg-[#1d635d] text-[#ffffff] px-2 sm:px-2.5 py-0.5 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] sm:shadow-[2px_2px_0px_#121c1b] font-label-mono-sm uppercase text-[9px] sm:text-[10px]">
            BRADEN: {bed?.bradenScore ?? 12} ({bed?.bradenRisk ? bed.bradenRisk.toUpperCase() + ' RISK' : 'HIGH RISK'})
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 font-label-mono-sm text-[9px] sm:text-[10px] text-[#121c1b]">
          <span className="hidden xs:inline">MAT: SENSO-GRID 100-CH (10×10)</span>
          <span className="hidden xs:inline opacity-40">/</span>
          <span>GRADIENT: 14-STOP SMOOTH</span>
        </div>
      </div>

      {/* FULL-WIDTH LIVE HEATMAP CARD */}
      <div className="w-full bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3 sm:p-5 flex flex-col gap-3.5 sm:gap-4">
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b-[2px] border-[#121c1b] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3.5 h-3.5 bg-[#1d635d] border border-[#121c1b] shrink-0"></div>
            <h2 className="font-headline-lg text-[#121c1b] tracking-tight uppercase text-xs sm:text-base font-bold truncate">
              SMOOTH SPECTRUM CONTACT HEATMAP
            </h2>
          </div>

          {/* Interactive Mode & Display Toggles */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setShowCellNumbers((prev) => !prev)}
              className={`px-2 py-1 text-[9px] sm:text-[10px] font-label-mono-sm font-bold uppercase border-[1.5px] border-[#121c1b] transition-all cursor-pointer ${
                showCellNumbers
                  ? 'bg-[#121c1b] text-[#f1fcf9]'
                  : 'bg-[#f1fcf9] text-[#121c1b] hover:bg-[#adefe7]'
              }`}
              title="Toggle numeric mmHg overlay inside matrix cells"
            >
              {showCellNumbers ? '✓ mmHg NUMBERS' : 'NUMBERS'}
            </button>

            <button
              onClick={() => {
                setIsLiveWaveActive((prev) => !prev);
                showToast(
                  !isLiveWaveActive ? 'LIVE WAVE RESUMED' : 'LIVE WAVE PAUSED',
                  !isLiveWaveActive
                    ? 'Simulating dynamic patient respiration and tissue micro-movement.'
                    : 'Pressure held stationary for precise inspection.'
                );
              }}
              className={`px-2 py-1 text-[9px] sm:text-[10px] font-label-mono-sm font-bold uppercase border-[1.5px] border-[#121c1b] transition-all cursor-pointer flex items-center gap-1 ${
                isLiveWaveActive
                  ? 'bg-[#1d635d] text-white'
                  : 'bg-[#f1fcf9] text-[#121c1b] hover:bg-[#e1f6f1]'
              }`}
              title="Toggle continuous smooth physiologic pressure variation"
            >
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${isLiveWaveActive ? 'bg-[#adefe7] animate-pulse' : 'bg-gray-400'}`}></span>
              <span>{isLiveWaveActive ? 'LIVE WAVE: ON' : 'WAVE: PAUSED'}</span>
            </button>
          </div>
        </div>

        {/* Heatmap Grid & Side Details in Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          {/* Centered 10x10 Tactile Matrix */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center w-full">
            <div className="bg-[#f8fdfc] p-2.5 sm:p-3.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] sm:shadow-[3px_3px_0px_#121c1b] w-full max-w-[340px] xs:max-w-[380px] sm:max-w-[430px] mx-auto">
              {/* Matrix Label */}
              <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-label-mono-sm text-[#3f4947] font-bold uppercase pb-1.5 mb-1 border-b border-[#121c1b]/20">
                <span>HEAD (ANTERIOR) ↑</span>
                <span>100-CELL MATRIX (10×10)</span>
              </div>

              {/* Smooth 10x10 Clickable Grid */}
              <div className={`grid ${currentMatrix[0]?.length === 8 ? 'grid-cols-8' : 'grid-cols-10'} gap-0.5 sm:gap-1 aspect-square w-full`}>
                {currentMatrix.map((row, rIdx) =>
                  row.map((pressureVal, cIdx) => {
                    const isSelected = selectedCell.r === rIdx && selectedCell.c === cIdx;
                    const style = getSmoothPressureColor(pressureVal);

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => {
                          setSelectedCell({ r: rIdx, c: cIdx, mmHg: pressureVal });
                        }}
                        style={{
                          backgroundColor: style.bg,
                          color: style.textColor,
                        }}
                        className={`relative aspect-square flex flex-col items-center justify-center cursor-pointer touch-manipulation border-[1.5px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b] transition-all duration-500 ease-out hover:scale-110 hover:z-20 active:scale-95 ${
                          isSelected ? 'ring-3 ring-[#121c1b] scale-105 z-10 shadow-[2px_2px_0px_#121c1b]' : ''
                        }`}
                        title={`Row ${rIdx + 1}, Col ${cIdx + 1} (${cellNames[rIdx]}) - ${style.mmHg} mmHg [${style.label}]`}
                      >
                        {/* High-Pressure Hotspot Indicator Badge */}
                        {style.isHot && (
                          <span className="w-1.5 h-1.5 bg-[#ffffff] rounded-full shadow-[0_0_4px_#ffffff] animate-ping absolute inset-auto"></span>
                        )}

                        {/* Optional Numeric Overlay */}
                        {showCellNumbers ? (
                          <span className="font-label-mono-sm text-[8px] xs:text-[9px] font-extrabold leading-none pointer-events-none">
                            {Math.round(style.mmHg)}
                          </span>
                        ) : isSelected ? (
                          <span className="font-label-mono-sm text-[7px] xs:text-[8px] font-bold uppercase leading-none pointer-events-none">
                            {Math.round(style.mmHg)}m
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-2 text-center font-label-mono-sm text-[#3f4947] uppercase tracking-widest text-[9px] sm:text-[10px] font-bold">
                FOOT OF BED ↓
              </div>
            </div>
          </div>

          {/* Side Telemetry Details & Color Spectrum Inspector */}
          <div className="lg:col-span-6 flex flex-col gap-2.5 sm:gap-3 w-full">
            {/* Position AI Detection Card */}
            <div className="bg-[#ebf6f4] text-[#121c1b] p-2.5 sm:p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b]">
              <div className="flex items-center justify-between">
                <span className="font-label-mono-sm uppercase text-[#121c1b]/80 text-[9px] sm:text-[10px] font-bold">
                  ESTIMATED PATIENT POSTURE
                </span>
                <span className="font-label-mono-sm text-[9px] bg-[#ffffff] px-1.5 py-0.5 border border-[#121c1b] font-bold">
                  CONFIDENCE: 94.2%
                </span>
              </div>
              <div className="font-headline-sm text-[#1d635d] mt-1 uppercase tracking-tight font-bold text-xs sm:text-sm">
                {bed?.posture || 'RIGHT 30° LATERAL TILT'}
              </div>
            </div>

            {/* Continuous Smooth Multi-Color Spectrum Legend */}
            <div className="bg-[#ffffff] border-[2px] border-[#121c1b] p-2.5 sm:p-3 shadow-[2px_2px_0px_#121c1b] flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#121c1b] pb-1">
                <span className="font-label-mono-sm text-[#121c1b] uppercase font-bold text-[9px] sm:text-[10px]">
                  CONTINUOUS PRESSURE SPECTRUM
                </span>
                <span className="font-label-mono-sm text-[9px] text-[#1d635d] font-bold">
                  4 MAIN ANCHORS + 10 INTERMEDIATE TINTS
                </span>
              </div>

              {/* Continuous Gradient Bar */}
              <div className="w-full">
                <div
                  className="w-full h-4 sm:h-5 border-[2px] border-[#121c1b] shadow-[1px_1px_0px_#121c1b]"
                  style={{ background: getLegendGradientCss() }}
                  title="Smooth color gradient across all pressure levels"
                ></div>

                {/* 4 Main Anchor Threshold Markers */}
                <div className="grid grid-cols-4 mt-1 font-label-mono-sm text-[8px] xs:text-[9px] text-[#121c1b] font-bold text-center">
                  <div className="text-left flex flex-col">
                    <span className="text-[#3f4947]">0-15 mmHg</span>
                    <span className="text-[#121c1b]">RESTING</span>
                  </div>
                  <div className="text-left flex flex-col pl-1 sm:pl-2">
                    <span className="text-[#3f4947]">16-32 mmHg</span>
                    <span className="text-[#1d635d]">LIGHT</span>
                  </div>
                  <div className="text-left flex flex-col pl-1 sm:pl-2">
                    <span className="text-[#3f4947]">33-55 mmHg</span>
                    <span className="text-[#1d635d]">HEAVY</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span className="text-[#8b2635]">&gt;55 mmHg</span>
                    <span className="text-[#8b2635]">HOTSPOT</span>
                  </div>
                </div>
              </div>

              {/* Intermediate Color Variation Swatch Strip */}
              <div className="mt-1 pt-1.5 border-t border-[#121c1b]/20">
                <div className="text-[8px] sm:text-[9px] font-label-mono-sm text-[#3f4947] uppercase font-bold mb-1">
                  CLICK VARIATION PRESET TO TEST SELECTED SENSOR:
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                  {[
                    { mmHg: 4, label: '04m (Rest)' },
                    { mmHg: 16, label: '16m (Light)' },
                    { mmHg: 28, label: '28m (Teal)' },
                    { mmHg: 40, label: '40m (Heavy)' },
                    { mmHg: 52, label: '52m (Amber)' },
                    { mmHg: 60, label: '60m (Coral)' },
                    { mmHg: 68, label: '68m (Ruby)' },
                  ].map((preset) => {
                    const presetStyle = getSmoothPressureColor(preset.mmHg);
                    return (
                      <button
                        key={preset.mmHg}
                        onClick={() => handleUpdateCellPressure(preset.mmHg)}
                        style={{
                          backgroundColor: presetStyle.bg,
                          color: presetStyle.textColor,
                        }}
                        className="py-1 px-1 border border-[#121c1b] font-label-mono-sm text-[8px] font-bold uppercase truncate text-center shadow-[1px_1px_0px_#121c1b] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                        title={`Set selected cell to ${preset.mmHg} mmHg (${presetStyle.label})`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Sensor & Interactive Tuning Card */}
            <div className="border-[2px] border-[#121c1b] bg-[#ebf6f4] p-2.5 sm:p-3 font-label-mono-sm text-[#121c1b] space-y-1.5 text-[10px] sm:text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-[#121c1b]/30">
                <span className="font-bold">INSPECTED SENSOR:</span>
                <span className="font-bold text-[#1d635d]">
                  R{selectedCell.r + 1}-C{selectedCell.c + 1} [{cellNames[selectedCell.r]}]
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 border border-[#121c1b] inline-block shadow-[1px_1px_0px_#121c1b]"
                    style={{ backgroundColor: selectedStyle.bg }}
                  ></span>
                  <span className="font-bold">{selectedStyle.mmHg} mmHg</span>
                  <span className="text-[9px] opacity-75">({selectedStyle.label})</span>
                </div>
                <div className="font-bold text-[#8b2635]">
                  PEAK: {currentPeak} mmHg ({currentZone})
                </div>
              </div>

              {/* Real-time Pressure Slider for Selected Sensor */}
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[9px] font-bold text-[#3f4947] shrink-0">ADJUST PRESSURE:</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="0.5"
                  value={selectedCell.mmHg}
                  onChange={(e) => handleUpdateCellPressure(parseFloat(e.target.value))}
                  className="w-full accent-[#1d635d] cursor-pointer"
                  title="Drag slider to smoothly transition colors between 0 and 80 mmHg"
                />
                <span className="text-[10px] font-bold w-12 text-right shrink-0">
                  {Math.round(selectedCell.mmHg)} mmHg
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM GRID ROW: Action Alert & 8-Hour History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* BOTTOM LEFT: ACTION ALERT "FLIP TIME." */}
        <div className="lg:col-span-6 bg-[#8b2635] text-[#f1fcf9] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3.5 sm:p-5 relative flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#f1fcf9] border-[2px] border-[#121c1b] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#121c1b]">
                <svg className="text-[#8b2635]" fill="none" height="16" viewBox="0 0 24 24" width="16">
                  <polygon fill="#8b2635" points="12,2 23,21 1,21"></polygon>
                  <line stroke="#f1fcf9" strokeLinecap="square" strokeWidth="2.5" x1="12" x2="12" y1="9" y2="14"></line>
                  <circle cx="12" cy="18" fill="#f1fcf9" r="1.3"></circle>
                </svg>
              </div>
              <h1 className="font-display-hero text-[#f1fcf9] uppercase tracking-tight leading-none text-lg sm:text-2xl font-bold">
                FLIP TIME.
              </h1>
            </div>

            <p className="font-body-md text-[#f1fcf9] max-w-lg mb-2.5 text-xs leading-relaxed">
              Sacrum contact threshold reached (112m dwell). Reposition patient to right 30-degree tilt using standard foam wedge.
            </p>

            <div className="bg-[#121c1b] text-[#f1fcf9] p-2 border-[2px] border-[#121c1b] mb-3 flex items-center justify-between font-label-mono-sm text-[10px] gap-2">
              <span className="shrink-0">RECOMMENDED POSE:</span>
              <span className="bg-[#adefe7] text-[#00201d] px-2 py-0.5 font-bold uppercase text-[9px] sm:text-[10px] truncate">
                RIGHT 30° LATERAL
              </span>
            </div>
          </div>

          {/* Action Buttons - Responsive Full Width on Mobile */}
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-2.5 pt-1 w-full">
            <button
              onClick={handleDoneTurned}
              className={`w-full xs:w-auto flex-1 min-h-[44px] px-4 py-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-headline-sm text-xs uppercase tracking-tight cursor-pointer transition-all flex items-center justify-center gap-2 neo-btn active:translate-y-0.5 ${
                turnCompleted
                  ? 'bg-[#f1fcf9] text-[#121c1b]'
                  : 'bg-[#d97757] text-[#ffffff] hover:shadow-[3px_3px_0px_#121c1b]'
              }`}
            >
              <span className={`w-3 h-3 inline-block shrink-0 ${turnCompleted ? 'bg-[#121c1b]' : 'bg-[#ffffff]'}`}></span>
              <span>{turnCompleted ? 'RECORDED: 09:42' : 'DONE, TURNED'}</span>
            </button>

            <button
              onClick={handleSnooze}
              className={`w-full xs:w-auto flex-1 min-h-[44px] px-4 py-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-headline-sm text-xs uppercase tracking-tight cursor-pointer transition-all flex items-center justify-center gap-1.5 neo-btn active:translate-y-0.5 ${
                snoozeActive
                  ? 'bg-[#a3cfc9] text-[#121c1b]'
                  : 'bg-[#ffffff] text-[#121c1b] hover:shadow-[3px_3px_0px_#121c1b]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-[#121c1b] shrink-0">
                {snoozeActive ? 'check' : 'update'}
              </span>
              <span>{snoozeActive ? 'SNOOZED +5M' : 'SNOOZE 5 MIN'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: LAST 8 HOURS HISTORY */}
        <div className="lg:col-span-6 bg-[#ffffff] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] p-3.5 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b-[2px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="font-headline-lg text-[#121c1b] uppercase tracking-tight text-xs sm:text-base font-bold">
                  LAST 8 HOURS
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="bg-[#121c1b] text-[#f1fcf9] border border-[#121c1b] px-1.5 sm:px-2 py-0.5 font-label-mono-sm uppercase font-bold text-[8px] sm:text-[9px]">
                  MAT ONLINE
                </span>
                <span className="bg-[#1d635d] text-[#ffffff] border border-[#121c1b] px-1.5 sm:px-2 py-0.5 font-label-mono-sm font-bold uppercase text-[8px] sm:text-[9px]">
                  6 ON-TIME TURNS
                </span>
              </div>
            </div>

            <div className="font-label-mono-sm text-[9px] sm:text-[10px] text-[#121c1b] mb-1.5 uppercase font-bold">
              BODY POSTURE CHRONOLOGY
            </div>

            {/* Segmented Timeline Bar */}
            <div className="w-full border-[2px] border-[#121c1b] bg-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex overflow-hidden">
              <div className="w-[31.25%] bg-[#a3cfc9] text-[#121c1b] py-2 px-1 border-r-[2px] border-[#121c1b] flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase text-[9px] sm:text-[10px] leading-tight">BACK</span>
                <span className="font-label-mono-sm text-[8px] sm:text-[9px]">2.5H</span>
              </div>
              <div className="w-[43.75%] bg-[#1d635d] text-[#ffffff] py-2 px-1 border-r-[2px] border-[#121c1b] flex flex-col justify-center items-center text-center relative">
                <span className="font-label-mono-md font-bold uppercase text-[9px] sm:text-[10px] leading-tight">LEFT</span>
                <span className="font-label-mono-sm text-[8px] sm:text-[9px]">3.5H (NOW)</span>
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#d97757]"></span>
              </div>
              <div className="w-[25%] bg-[#f1fcf9] text-[#121c1b] py-2 px-1 flex flex-col justify-center items-center text-center">
                <span className="font-label-mono-md font-bold uppercase text-[9px] sm:text-[10px] leading-tight">RIGHT</span>
                <span className="font-label-mono-sm text-[8px] sm:text-[9px]">2.0H</span>
              </div>
            </div>

            {/* Time Tick Markers */}
            <div className="w-full flex justify-between items-center mt-1.5 font-label-mono-sm text-[8px] sm:text-[9px] text-[#121c1b] px-0.5 font-bold">
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
            <div className="bg-[#ebf6f4] border border-[#121c1b] p-1.5 sm:p-2 shadow-[1px_1px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[8px] sm:text-[9px] text-[#121c1b]/70 uppercase">CUMULATIVE SACRUM</div>
              <div className="font-headline-sm text-xs text-[#8b2635] font-bold">5.2H / 8H</div>
            </div>
            <div className="bg-[#ebf6f4] border border-[#121c1b] p-1.5 sm:p-2 shadow-[1px_1px_0px_#121c1b]">
              <div className="font-label-mono-sm text-[8px] sm:text-[9px] text-[#121c1b]/70 uppercase">NURSE TURNS</div>
              <div className="font-headline-sm text-xs text-[#121c1b] font-bold">3 LOGGED</div>
            </div>
            <div className="bg-[#1d635d] text-[#ffffff] border border-[#121c1b] p-1.5 sm:p-2 shadow-[1px_1px_0px_#121c1b] col-span-2 sm:col-span-1">
              <div className="font-label-mono-sm text-[8px] sm:text-[9px] text-[#f1fcf9]/80 uppercase">AVG CYCLE</div>
              <div className="font-headline-sm text-xs text-[#ffffff] font-bold">114 MIN</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bedside Quick Action Bar - Stacks cleanly on mobile */}
      <div className="w-full p-3 bg-[#ffffff] border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1d635d] text-[18px] shrink-0">verified_user</span>
          <span className="font-body-sm text-xs text-[#121c1b]">
            Continuous contact monitoring active on BED 07. All readings sync to patient chart.
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenTurnLog}
            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-[#f1fcf9] hover:bg-[#adefe7] border border-[#121c1b] font-label-mono-sm uppercase text-[#121c1b] font-bold text-[10px] shadow-[1px_1px_0px_#121c1b] transition-all neo-btn cursor-pointer text-center"
          >
            LOG BEDSIDE TURN
          </button>
          <button
            onClick={handleExportAudit}
            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-[#1d635d] hover:bg-[#121c1b] text-white border border-[#121c1b] font-label-mono-sm uppercase font-bold text-[10px] shadow-[1px_1px_0px_#121c1b] transition-all neo-btn flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>EXPORT RECORD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
