import React, { useState } from 'react';
import { AuditLogItem, ZoneTimer } from '../types';

interface PeakAlertsViewProps {
  auditLogs: AuditLogItem[];
  onOpenThresholds: () => void;
  showToast: (title: string, desc?: string) => void;
  liveTimers?: ZoneTimer[];
  onResetZone?: (zoneName: string) => void;
  onResetAll?: () => void;
  isApiConnected?: boolean;
}

export const PeakAlertsView: React.FC<PeakAlertsViewProps> = ({
  onOpenThresholds,
  showToast,
  liveTimers,
  onResetZone,
  onResetAll,
  isApiConnected = false,
}) => {
  const defaultTimers: ZoneTimer[] = [
    { name: 'SACRUM & COCCYX', elapsedMin: 112, limitMin: 120, isNearLimit: true },
    { name: 'HEELS (CALCANEUS)', elapsedMin: 42, limitMin: 90 },
    { name: 'LEFT TROCHANTER (HIP)', elapsedMin: 78, limitMin: 120, isElevated: true },
    { name: 'SHOULDERS (SCAPULAE)', elapsedMin: 35, limitMin: 120 },
    { name: 'RIGHT TROCHANTER (HIP)', elapsedMin: 10, limitMin: 120 },
    { name: 'ELBOWS & OCCIPUT', elapsedMin: 18, limitMin: 120 },
  ];

  const [localTimers, setLocalTimers] = useState<ZoneTimer[]>(defaultTimers);
  const timers = (liveTimers && liveTimers.length > 0) ? liveTimers : localTimers;

  const handleResetZone = (zoneName: string) => {
    if (onResetZone) {
      onResetZone(zoneName);
    } else {
      setLocalTimers((prev) =>
        prev.map((t) => (t.name === zoneName ? { ...t, elapsedMin: 0, isNearLimit: false, isElevated: false } : t))
      );
      showToast(`ZONE OFFLOADED: ${zoneName}`, `Timer reset to 0m. Bedside reposition verified.`);
    }
  };

  const handleResetAll = () => {
    if (onResetAll) {
      onResetAll();
    } else {
      setLocalTimers((prev) =>
        prev.map((t) => ({ ...t, elapsedMin: 0, isNearLimit: false, isElevated: false }))
      );
      showToast('ALL ZONES RE-ZEROED', 'Full patient posture re-zeroed and logged to clinical flowsheet.');
    }
  };

  return (
    <div className="flex flex-col gap-4 select-none w-full max-w-[1400px] mx-auto">
      {/* Top Header & Clinical Policy Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#EDE8DC] p-4 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
            <h1 className="font-headline-lg text-[#121c1b] uppercase tracking-tight font-bold text-base sm:text-lg">
              ANATOMICAL ZONE TIMERS
            </h1>
          </div>
          <p className="font-body-sm text-[#3f4947] text-xs mt-0.5">
            BED 07 // Real-time continuous tissue dwell monitoring across 6 critical pressure loci.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#ffffff] text-[#121c1b] font-label-mono-sm px-2.5 py-1 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            WARD POLICY: 2.0H CADENCE
          </span>
          <span className="bg-[#1d635d] text-white font-label-mono-sm px-2.5 py-1 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[1px_1px_0px_#121c1b]">
            BRADEN SCORE: 12 (HIGH RISK)
          </span>
          <button
            onClick={onOpenThresholds}
            className="bg-[#ffffff] hover:bg-[#dfeae8] text-[#121c1b] font-label-mono-sm px-3 py-1 border-[2px] border-[#121c1b] uppercase text-[10px] font-bold shadow-[2px_2px_0px_#121c1b] neo-btn flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>CUSTOMIZE LIMITS</span>
          </button>
        </div>
      </div>

      {/* Main 6 Anatomical Zone Dwell Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {timers.map((t) => {
          const pct = Math.min(100, Math.round((t.elapsedMin / t.limitMin) * 100));
          const remainingMin = Math.max(0, t.limitMin - t.elapsedMin);
          const isCritical = t.isNearLimit || pct >= 90;
          const isWarning = t.isElevated || (pct >= 60 && pct < 90);

          let barColor = 'bg-[#1d635d]';
          let borderStyle = 'border-[#121c1b]';
          let statusLabel = 'NOMINAL';
          let badgeBg = 'bg-[#a3cfc9] text-[#121c1b]';

          if (isCritical) {
            barColor = 'bg-[#8b2635]';
            borderStyle = 'border-[#8b2635]';
            statusLabel = 'DUE NOW';
            badgeBg = 'bg-[#8b2635] text-white animate-pulse';
          } else if (isWarning) {
            barColor = 'bg-[#d97757]';
            borderStyle = 'border-[#d97757]';
            statusLabel = 'ELEVATED';
            badgeBg = 'bg-[#d97757] text-white';
          }

          return (
            <div
              key={t.name}
              className={`bg-[#ffffff] border-[3px] ${borderStyle} p-4 shadow-[3px_3px_0px_#121c1b] flex flex-col justify-between gap-3`}
            >
              <div>
                {/* Zone Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#121c1b]/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#1d635d] text-[20px]">
                      radio_button_checked
                    </span>
                    <span className="font-headline-sm font-bold text-sm text-[#121c1b]">
                      {t.name}
                    </span>
                  </div>
                  <span className={`font-label-mono-sm px-2 py-0.5 border border-[#121c1b] text-[10px] font-bold ${badgeBg}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Dwell Metrics */}
                <div className="flex items-baseline justify-between mt-3 mb-1">
                  <div>
                    <span className="font-label-mono-sm text-[10px] text-[#3f4947] uppercase block">
                      ELAPSED DWELL
                    </span>
                    <span className="font-headline-lg font-bold text-lg text-[#121c1b]">
                      {t.elapsedMin}{' '}
                      <span className="text-xs font-normal text-[#3f4947]">
                        / {t.limitMin} MIN
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-label-mono-sm text-[10px] text-[#3f4947] uppercase block">
                      REMAINING
                    </span>
                    <span className={`font-headline-lg font-bold text-lg ${isCritical ? 'text-[#8b2635]' : 'text-[#1d635d]'}`}>
                      {remainingMin} MIN
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3.5 bg-[#ebf6f4] border-[2px] border-[#121c1b] overflow-hidden p-0.5 mt-1">
                  <div
                    className={`h-full ${barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#121c1b]/20">
                <span className="font-label-mono-sm text-[10px] text-[#3f4947]">
                  {pct}% Dwell Ratio
                </span>
                <button
                  onClick={() => handleResetZone(t.name)}
                  className="px-3 py-1 bg-[#f1fcf9] hover:bg-[#adefe7] text-[#121c1b] border border-[#121c1b] shadow-[1px_1px_0px_#121c1b] font-label-mono-sm text-[10px] font-bold uppercase transition-all neo-btn cursor-pointer"
                >
                  OFFLOAD ZONE (RESET)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Actions Footer */}
      <div className="bg-[#ffffff] p-3.5 border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1d635d]">info</span>
          <span className="font-body-sm text-xs text-[#121c1b]">
            Dwell timers tick automatically based on piezocapacitive contact load thresholds (&gt;15 mmHg).
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-[#1d635d] hover:bg-[#121c1b] text-white border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-sm text-xs font-bold uppercase transition-all neo-btn cursor-pointer"
          >
            RESET ALL 6 ZONES
          </button>
        </div>
      </div>
    </div>
  );
};
