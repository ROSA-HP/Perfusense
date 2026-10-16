import React, { useState } from 'react';
import { PatientBed } from '../types';

interface ModalsProps {
  // Turn Log Modal
  turnModalBed: PatientBed | null;
  onCloseTurnModal: () => void;
  onConfirmTurn: (bedId: string, posture: string, note?: string) => void;

  // Thresholds Modal
  isThresholdOpen: boolean;
  onCloseThreshold: () => void;
  onSaveThreshold: (crit: number, dwell: number, warn: number, autoPage: boolean) => void;

  // Protocol Edit Modal
  isProtocolOpen: boolean;
  onCloseProtocol: () => void;
  onSaveProtocol: (cadenceMin: number) => void;

  // Bed Inspect Modal
  inspectBed: PatientBed | null;
  onCloseInspect: () => void;

  // Toast
  toast: { title: string; desc?: string; visible: boolean } | null;
}

export const Modals: React.FC<ModalsProps> = ({
  turnModalBed,
  onCloseTurnModal,
  onConfirmTurn,
  isThresholdOpen,
  onCloseThreshold,
  onSaveThreshold,
  isProtocolOpen,
  onCloseProtocol,
  onSaveProtocol,
  inspectBed,
  onCloseInspect,
  toast,
}) => {
  const [selectedPosture, setSelectedPosture] = useState<string>('LEFT LATERAL 30°');
  const [turnNote, setTurnNote] = useState<string>('');

  // Threshold state
  const [critVal, setCritVal] = useState<number>(65);
  const [dwellVal, setDwellVal] = useState<number>(60);
  const [warnVal, setWarnVal] = useState<number>(45);
  const [autoPage, setAutoPage] = useState<boolean>(true);

  // Protocol edit state
  const [protocolCadence, setProtocolCadence] = useState<number>(120);

  return (
    <>
      {/* Toast Notification - Positioned above mobile bottom bar */}
      {toast?.visible && (
        <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 left-3 sm:left-auto z-50 bg-[#121c1b] text-[#f1fcf9] p-3 sm:p-4 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#1d635d] sm:shadow-[6px_6px_0px_#1d635d] flex items-center gap-3 animate-bounce max-w-md">
          <span className="material-symbols-outlined text-[#adefe7] text-[24px] sm:text-[28px] shrink-0">
            check_circle
          </span>
          <div className="min-w-0">
            <div className="font-label-mono-md uppercase font-bold text-xs sm:text-sm tracking-wide truncate">
              {toast.title}
            </div>
            {toast.desc && (
              <div className="font-body-sm text-[#adefe7] text-[11px] sm:text-xs mt-0.5 line-clamp-2">{toast.desc}</div>
            )}
          </div>
        </div>
      )}

      {/* Turn Log Modal */}
      {turnModalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#121c1b]/60 backdrop-blur-none">
          <div className="bg-[#EDE8DC] border-[3px] sm:border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] sm:shadow-[8px_8px_0px_#121c1b] max-w-lg w-full p-4 sm:p-6 select-none max-h-[92vh] overflow-y-auto animate-in fade-in">
            <div className="flex justify-between items-center pb-2.5 sm:pb-3 border-b-[3px] border-[#121c1b] mb-3 sm:mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3.5 h-3.5 bg-[#1d635d] border-2 border-[#121c1b] shrink-0"></span>
                <span className="font-headline-sm text-[#121c1b] uppercase font-bold text-xs sm:text-sm truncate">
                  {turnModalBed.bedNumber} // LOG REPOSITIONING
                </span>
              </div>
              <button
                onClick={onCloseTurnModal}
                className="p-1 border-[2px] border-[#121c1b] bg-[#ffffff] hover:bg-[#ebf6f4] neo-btn shrink-0"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-md text-[#121c1b] mb-3 text-xs sm:text-sm">
              Select verified post-turn offload trajectory for patient{' '}
              <strong>{turnModalBed.patientName}</strong>. Mat will re-zero baseline within 45 seconds.
            </p>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
              {[
                'LEFT LATERAL 30°',
                'RIGHT LATERAL 30°',
                'SUPINE + FLOAT HEELS',
                'HIGH FOWLER 45°',
              ].map((pose) => (
                <button
                  key={pose}
                  onClick={() => setSelectedPosture(pose)}
                  className={`p-2.5 sm:p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md text-[11px] sm:text-xs uppercase font-bold text-left transition-all ${
                    selectedPosture === pose
                      ? 'bg-[#1d635d] text-white'
                      : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#ebf6f4]'
                  }`}
                >
                  [{selectedPosture === pose ? 'X' : ' '}] {pose}
                </button>
              ))}
            </div>

            <div className="mb-3 sm:mb-4">
              <label className="font-label-mono-sm uppercase text-[#3f4947] block mb-1 font-bold text-[10px] sm:text-xs">
                Clinical Skin Check Note:
              </label>
              <input
                value={turnNote}
                onChange={(e) => setTurnNote(e.target.value)}
                placeholder="e.g. Skin intact, barrier cream applied, 30-deg wedge secure."
                className="w-full bg-[#ffffff] border-[2px] border-[#121c1b] p-2 font-body-sm text-[#121c1b] outline-none shadow-[2px_2px_0px_#121c1b] text-xs"
              />
            </div>

            <div className="flex flex-col-reverse xs:flex-row gap-2 sm:gap-3">
              <button
                onClick={onCloseTurnModal}
                className="px-4 py-2.5 bg-[#ffffff] text-[#121c1b] border-[2px] sm:border-[3px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] sm:shadow-[3px_3px_0px_#121c1b] font-headline-sm uppercase text-xs sm:text-sm font-bold neo-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirmTurn(turnModalBed.id, selectedPosture, turnNote);
                  onCloseTurnModal();
                }}
                className="flex-1 bg-[#1d635d] text-white py-2.5 sm:py-3 border-[2px] sm:border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] sm:shadow-[4px_4px_0px_#121c1b] font-headline-sm text-xs sm:text-sm uppercase font-bold hover:bg-[#121c1b] neo-btn"
              >
                CONFIRM &amp; ZERO TIMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Modal */}
      {isThresholdOpen && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-xl w-full p-4 sm:p-6 border-[3px] sm:border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] sm:shadow-[8px_8px_0px_#121c1b] relative select-none max-h-[92vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b-[3px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#99462a]"></span>
                <h3 className="font-headline-md uppercase font-bold text-xs sm:text-base">
                  Alert Threshold Settings
                </h3>
              </div>
              <button
                onClick={onCloseThreshold}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#dfeae8] neo-btn"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-[#3f4947] my-2.5 sm:my-3 text-xs leading-relaxed">
              Define criteria for automated alarm dispatch to bedside telemetry pagers and ward monitor displays.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold text-[10px] sm:text-xs">
                  Critical Peak Pressure (mmHg)
                </label>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <input
                    type="number"
                    value={critVal}
                    onChange={(e) => setCritVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-2.5 sm:px-3 py-1.5 font-label-mono-md text-[#121c1b] w-24 sm:w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold text-xs sm:text-sm"
                  />
                  <span className="font-body-sm text-[#3f4947] text-[10px] sm:text-xs">
                    Default: 65 mmHg (Urgent Red Banner)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold text-[10px] sm:text-xs">
                  Max Sustained Dwell Time (Minutes)
                </label>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <input
                    type="number"
                    value={dwellVal}
                    onChange={(e) => setDwellVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-2.5 sm:px-3 py-1.5 font-label-mono-md text-[#121c1b] w-24 sm:w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold text-xs sm:text-sm"
                  />
                  <span className="font-body-sm text-[#3f4947] text-[10px] sm:text-xs">
                    Default: 60 min (Stage II threshold)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold text-[10px] sm:text-xs">
                  Warning Level Pressure (mmHg)
                </label>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <input
                    type="number"
                    value={warnVal}
                    onChange={(e) => setWarnVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-2.5 sm:px-3 py-1.5 font-label-mono-md text-[#121c1b] w-24 sm:w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold text-xs sm:text-sm"
                  />
                  <span className="font-body-sm text-[#3f4947] text-[10px] sm:text-xs">
                    Default: 45 mmHg (Yellow Advisory)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  checked={autoPage}
                  onChange={(e) => setAutoPage(e.target.checked)}
                  className="w-4 h-4 sm:w-5 sm:h-5 accent-[#1d635d] cursor-pointer"
                  id="auto-page-check"
                  type="checkbox"
                />
                <label
                  className="font-body-sm text-[#121c1b] select-none cursor-pointer font-medium text-xs leading-snug"
                  htmlFor="auto-page-check"
                >
                  Auto-dispatch pager alerts to charge nurse on secondary breach
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse xs:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t-[2px] border-[#121c1b]">
              <button
                onClick={onCloseThreshold}
                className="bg-[#ebf6f4] text-[#121c1b] px-4 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSaveThreshold(critVal, dwellVal, warnVal, autoPage);
                  onCloseThreshold();
                }}
                className="bg-[#1d635d] text-white px-4 sm:px-5 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] sm:shadow-[4px_4px_0px_#121c1b] neo-btn font-bold text-xs sm:text-sm"
              >
                Save Clinical Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Edit Modal */}
      {isProtocolOpen && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-md w-full p-4 sm:p-6 border-[3px] sm:border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] sm:shadow-[8px_8px_0px_#121c1b] select-none max-h-[92vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b-[3px] border-[#121c1b] mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
                <h3 className="font-headline-sm uppercase font-bold text-xs sm:text-sm">
                  Clinical Protocol Editor
                </h3>
              </div>
              <button
                onClick={onCloseProtocol}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#ebf6f4] neo-btn"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-[#3f4947] mb-3 text-xs">
              Adjust standard ward repositioning cadence according to physician orders:
            </p>

            <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
              {[60, 90, 120, 150].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setProtocolCadence(mins)}
                  className={`p-2.5 sm:p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md uppercase font-bold text-left flex justify-between items-center transition-all text-xs sm:text-sm ${
                    protocolCadence === mins
                      ? 'bg-[#1d635d] text-white'
                      : 'bg-[#ebf6f4] text-[#121c1b] hover:bg-[#dfeae8]'
                  }`}
                >
                  <span>{mins} MIN ({mins / 60}H)</span>
                  {protocolCadence === mins && (
                    <span className="material-symbols-outlined text-[18px] sm:text-[20px]">check</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t-[2px] border-[#121c1b]">
              <button
                onClick={onCloseProtocol}
                className="px-4 py-2 bg-[#ffffff] border-[2px] border-[#121c1b] font-label-mono-md uppercase neo-btn font-bold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSaveProtocol(protocolCadence);
                  onCloseProtocol();
                }}
                className="px-5 py-2 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-md uppercase neo-btn font-bold text-xs sm:text-sm"
              >
                Save Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Bed Detail Modal */}
      {inspectBed && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-lg w-full p-4 sm:p-6 border-[3px] sm:border-[4px] border-[#121c1b] shadow-[6px_6px_0px_#121c1b] sm:shadow-[8px_8px_0px_#121c1b] select-none max-h-[92vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b-[3px] border-[#121c1b] mb-3 sm:mb-4">
              <div>
                <span className="font-label-mono-sm text-[#3f4947] uppercase font-bold text-[10px] sm:text-xs">
                  {inspectBed.bedNumber} // {inspectBed.pod}
                </span>
                <h3 className="font-headline-md uppercase font-bold text-sm sm:text-base mt-0.5">
                  {inspectBed.patientName}
                </h3>
              </div>
              <button
                onClick={onCloseInspect}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#ebf6f4] neo-btn"
              >
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 font-label-mono-sm text-xs">
              <div className="bg-[#ebf6f4] p-2 sm:p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[9px] sm:text-[10px]">BRADEN SCORE</span>
                <span className="font-headline-sm font-bold text-[#121c1b] text-xs sm:text-sm">
                  {inspectBed.bradenScore} ({inspectBed.bradenRisk})
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2 sm:p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[9px] sm:text-[10px]">CURRENT POSTURE</span>
                <span className="font-headline-sm font-bold text-[#1d635d] text-xs sm:text-sm truncate block">
                  {inspectBed.posture}
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2 sm:p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[9px] sm:text-[10px]">PEAK PRESSURE</span>
                <span className="font-headline-sm font-bold text-[#8b2635] text-xs sm:text-sm">
                  {inspectBed.peakPressure} mmHg
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2 sm:p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[9px] sm:text-[10px]">ATTENDING RN</span>
                <span className="font-headline-sm font-bold text-[#121c1b] text-xs sm:text-sm truncate block">
                  {inspectBed.assignedRn}
                </span>
              </div>
            </div>

            <div className="bg-[#EDE8DC] p-2.5 sm:p-3 border-[2px] border-[#121c1b] mb-3 sm:mb-4">
              <div className="font-label-mono-sm uppercase text-[#3f4947] font-bold mb-1 text-[10px] sm:text-xs">
                CLINICAL REPOSITIONING DIRECTIVE
              </div>
              <p className="font-body-sm text-[#121c1b] text-xs leading-snug">
                Patient is scheduled for Q2H rotational offload. Use standard high-density foam wedge and confirm floating heels clear of mattress surface.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onCloseInspect}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-md uppercase neo-btn font-bold text-xs sm:text-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
