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
      {/* Toast Notification */}
      {toast?.visible && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121c1b] text-[#f1fcf9] p-4 border-[3px] border-[#121c1b] shadow-[6px_6px_0px_#1d635d] flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-[#adefe7] text-[28px]">
            check_circle
          </span>
          <div>
            <div className="font-label-mono-md uppercase font-bold text-sm tracking-wide">
              {toast.title}
            </div>
            {toast.desc && (
              <div className="font-body-sm text-[#adefe7] text-xs mt-0.5">{toast.desc}</div>
            )}
          </div>
        </div>
      )}

      {/* Turn Log Modal */}
      {turnModalBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121c1b]/50 backdrop-blur-none">
          <div className="bg-[#EDE8DC] border-[4px] border-[#121c1b] shadow-[8px_8px_0px_#121c1b] max-w-lg w-full p-6 select-none animate-in fade-in">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-[#121c1b] mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#1d635d] border-2 border-[#121c1b]"></span>
                <span className="font-headline-sm text-[#121c1b] uppercase font-bold">
                  {turnModalBed.bedNumber} // LOG REPOSITIONING
                </span>
              </div>
              <button
                onClick={onCloseTurnModal}
                className="p-1 border-[2px] border-[#121c1b] bg-[#ffffff] hover:bg-[#ebf6f4] neo-btn"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-md text-[#121c1b] mb-4">
              Select verified post-turn offload trajectory for patient{' '}
              <strong>{turnModalBed.patientName}</strong>. Mat will re-zero baseline within 45 seconds.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                'LEFT LATERAL 30°',
                'RIGHT LATERAL 30°',
                'SUPINE + FLOAT HEELS',
                'HIGH FOWLER 45°',
              ].map((pose) => (
                <button
                  key={pose}
                  onClick={() => setSelectedPosture(pose)}
                  className={`p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md text-xs uppercase font-bold text-left transition-all ${
                    selectedPosture === pose
                      ? 'bg-[#1d635d] text-white'
                      : 'bg-[#ffffff] text-[#121c1b] hover:bg-[#ebf6f4]'
                  }`}
                >
                  [{selectedPosture === pose ? 'X' : ' '}] {pose}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="font-label-mono-sm uppercase text-[#3f4947] block mb-1 font-bold">
                Clinical Skin Check Note:
              </label>
              <input
                value={turnNote}
                onChange={(e) => setTurnNote(e.target.value)}
                placeholder="e.g. Skin intact, barrier cream applied, 30-deg wedge secure."
                className="w-full bg-[#ffffff] border-[2px] border-[#121c1b] p-2 font-body-sm text-[#121c1b] outline-none shadow-[2px_2px_0px_#121c1b]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCloseTurnModal}
                className="px-4 py-3 bg-[#ffffff] text-[#121c1b] border-[3px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-headline-sm uppercase text-sm font-bold neo-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onConfirmTurn(turnModalBed.id, selectedPosture, turnNote);
                  onCloseTurnModal();
                }}
                className="flex-1 bg-[#1d635d] text-white py-3 border-[3px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] font-headline-sm text-sm uppercase font-bold hover:bg-[#121c1b] neo-btn"
              >
                CONFIRM &amp; ZERO TIMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Modal */}
      {isThresholdOpen && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-xl w-full p-6 border-[4px] border-[#121c1b] shadow-[8px_8px_0px_#121c1b] relative select-none animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b-[3px] border-[#121c1b]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#99462a]"></span>
                <h3 className="font-headline-md uppercase font-bold">
                  Alert Threshold Settings
                </h3>
              </div>
              <button
                onClick={onCloseThreshold}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#dfeae8] neo-btn"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-[#3f4947] my-3">
              Define criteria for automated alarm dispatch to bedside telemetry pagers and ward monitor displays.
            </p>

            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold">
                  Critical Peak Pressure (mmHg)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={critVal}
                    onChange={(e) => setCritVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-3 py-1.5 font-label-mono-md text-[#121c1b] w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold"
                  />
                  <span className="font-body-sm text-[#3f4947] text-xs">
                    Default: 65 mmHg (Triggers Red Urgent Banner)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold">
                  Max Sustained Dwell Time (Minutes)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={dwellVal}
                    onChange={(e) => setDwellVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-3 py-1.5 font-label-mono-md text-[#121c1b] w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold"
                  />
                  <span className="font-body-sm text-[#3f4947] text-xs">
                    Default: 60 min (Stage II Ischemic threshold)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-mono-sm uppercase text-[#121c1b] font-bold">
                  Warning Level Pressure (mmHg)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={warnVal}
                    onChange={(e) => setWarnVal(Number(e.target.value))}
                    className="bg-[#ebf6f4] px-3 py-1.5 font-label-mono-md text-[#121c1b] w-28 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-bold"
                  />
                  <span className="font-body-sm text-[#3f4947] text-xs">
                    Default: 45 mmHg (Triggers Yellow Advisory)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  checked={autoPage}
                  onChange={(e) => setAutoPage(e.target.checked)}
                  className="w-5 h-5 accent-[#1d635d] cursor-pointer"
                  id="auto-page-check"
                  type="checkbox"
                />
                <label
                  className="font-body-sm text-[#121c1b] select-none cursor-pointer font-medium"
                  htmlFor="auto-page-check"
                >
                  Auto-dispatch pager alerts to charge nurse on secondary breach
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-3 border-t-[2px] border-[#121c1b]">
              <button
                onClick={onCloseThreshold}
                className="bg-[#ebf6f4] text-[#121c1b] px-4 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] neo-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSaveThreshold(critVal, dwellVal, warnVal, autoPage);
                  onCloseThreshold();
                }}
                className="bg-[#1d635d] text-white px-5 py-2 font-label-mono-md uppercase border-[2px] border-[#121c1b] shadow-[4px_4px_0px_#121c1b] neo-btn font-bold"
              >
                Save Clinical Parameters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Edit Modal */}
      {isProtocolOpen && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-md w-full p-6 border-[4px] border-[#121c1b] shadow-[8px_8px_0px_#121c1b] select-none animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b-[3px] border-[#121c1b] mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-[#1d635d]"></span>
                <h3 className="font-headline-sm uppercase font-bold">
                  Clinical Protocol Editor
                </h3>
              </div>
              <button
                onClick={onCloseProtocol}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#ebf6f4] neo-btn"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-[#3f4947] mb-4">
              Adjust standard ward repositioning cadence according to attending physician orders:
            </p>

            <div className="flex flex-col gap-3 mb-5">
              {[60, 90, 120, 150].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setProtocolCadence(mins)}
                  className={`p-3 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md uppercase font-bold text-left flex justify-between items-center transition-all ${
                    protocolCadence === mins
                      ? 'bg-[#1d635d] text-white'
                      : 'bg-[#ebf6f4] text-[#121c1b] hover:bg-[#dfeae8]'
                  }`}
                >
                  <span>{mins} MINUTES ({mins / 60} HOURS)</span>
                  {protocolCadence === mins && (
                    <span className="material-symbols-outlined text-[20px]">check</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t-[2px] border-[#121c1b]">
              <button
                onClick={onCloseProtocol}
                className="px-4 py-2 bg-[#ffffff] border-[2px] border-[#121c1b] font-label-mono-md uppercase neo-btn font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSaveProtocol(protocolCadence);
                  onCloseProtocol();
                }}
                className="px-5 py-2 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-md uppercase neo-btn font-bold"
              >
                Save Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Bed Detail Modal */}
      {inspectBed && (
        <div className="fixed inset-0 bg-[#121c1b]/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] text-[#121c1b] max-w-lg w-full p-6 border-[4px] border-[#121c1b] shadow-[8px_8px_0px_#121c1b] select-none animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b-[3px] border-[#121c1b] mb-4">
              <div>
                <span className="font-label-mono-sm text-[#3f4947] uppercase font-bold">
                  {inspectBed.bedNumber} // {inspectBed.pod}
                </span>
                <h3 className="font-headline-md uppercase font-bold mt-0.5">
                  {inspectBed.patientName}
                </h3>
              </div>
              <button
                onClick={onCloseInspect}
                className="p-1 border-[2px] border-[#121c1b] hover:bg-[#ebf6f4] neo-btn"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 font-label-mono-sm text-xs">
              <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">BRADEN SCORE</span>
                <span className="font-headline-sm font-bold text-[#121c1b]">
                  {inspectBed.bradenScore} ({inspectBed.bradenRisk})
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">CURRENT POSTURE</span>
                <span className="font-headline-sm font-bold text-[#1d635d]">
                  {inspectBed.posture}
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">PEAK PRESSURE</span>
                <span className="font-headline-sm font-bold text-[#8b2635]">
                  {inspectBed.peakPressure} mmHg
                </span>
              </div>
              <div className="bg-[#ebf6f4] p-2.5 border-[2px] border-[#121c1b]">
                <span className="text-[#3f4947] block text-[10px]">ATTENDING RN</span>
                <span className="font-headline-sm font-bold text-[#121c1b]">
                  {inspectBed.assignedRn}
                </span>
              </div>
            </div>

            <div className="bg-[#EDE8DC] p-3 border-[2px] border-[#121c1b] mb-4">
              <div className="font-label-mono-sm uppercase text-[#3f4947] font-bold mb-1">
                CLINICAL REPOSITIONING DIRECTIVE
              </div>
              <p className="font-body-sm text-[#121c1b] leading-snug">
                Patient is scheduled for Q2H rotational offload. Use standard high-density foam wedge and confirm floating heels clear of mattress surface.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onCloseInspect}
                className="px-5 py-2.5 bg-[#1d635d] text-white border-[2px] border-[#121c1b] shadow-[3px_3px_0px_#121c1b] font-label-mono-md uppercase neo-btn font-bold"
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
