import React, { useEffect, useState } from 'react';
import { PatientBed } from '../types';
import type { Settings } from '../api/client';
import { Button, StripHeader } from './ui';

export type ToastState = { title: string; desc?: string; tone: 'ok' | 'error' | 'alert' };

interface ModalsProps {
  settings: Settings;
  turnModalBed: PatientBed | null;
  onCloseTurnModal: () => void;
  onConfirmTurn: (bedId: string, posture: string, note?: string, skinChecks?: boolean[]) => void;
  isThresholdOpen: boolean;
  onCloseThreshold: () => void;
  onSaveThreshold: (thresholds: Settings['thresholds'], levelMmHg: [number, number, number]) => void;
  isProtocolOpen: boolean;
  onCloseProtocol: () => void;
  onSaveProtocol: (cadenceMin: number) => void;
  toast: ToastState | null;
  onDismissToast: () => void;
}

const POSTURES = ['LEFT LATERAL 30°', 'RIGHT LATERAL 30°', 'SUPINE', 'SUPINE + FLOAT HEELS', 'HIGH FOWLER 45°'];
const SKIN_CHECKS = ['Skin over the sacrum checked', 'Heels checked and floated', 'Hips / trochanters checked'];

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#121c1b]/60 anim-fade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-[3px] border-[#121c1b] shadow-[8px_8px_0px_#121c1b] max-w-lg w-full max-h-[92vh] overflow-y-auto anim-pop"
      >
        <StripHeader
          label={title}
          right={
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 border-[2px] border-[#121c1b] bg-white text-[#121c1b] hover:bg-[#adefe7]">
              ✕
            </button>
          }
        />
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-mono-sm uppercase font-bold text-[10px] sm:text-xs">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-white px-2.5 py-1.5 w-24 border-[2px] border-[#121c1b] font-bold text-sm"
        />
        {hint && <span className="text-[10px] text-[#3f4947]">{hint}</span>}
      </span>
    </label>
  );
}

export const Modals: React.FC<ModalsProps> = ({
  settings,
  turnModalBed,
  onCloseTurnModal,
  onConfirmTurn,
  isThresholdOpen,
  onCloseThreshold,
  onSaveThreshold,
  isProtocolOpen,
  onCloseProtocol,
  onSaveProtocol,
  toast,
  onDismissToast,
}) => {
  const [posture, setPosture] = useState(POSTURES[0]);
  const [note, setNote] = useState('');
  const [checks, setChecks] = useState<boolean[]>(SKIN_CHECKS.map(() => false));
  const [th, setTh] = useState(settings.thresholds);
  const [scale, setScale] = useState(settings.telemetry.levelMmHg);
  const [cadence, setCadence] = useState(settings.protocol.cadenceMin);

  // Each dialog opens with the current server values.
  useEffect(() => {
    if (turnModalBed) {
      setNote('');
      setChecks(SKIN_CHECKS.map(() => false));
    }
  }, [turnModalBed]);
  useEffect(() => {
    if (isThresholdOpen) {
      setTh(settings.thresholds);
      setScale(settings.telemetry.levelMmHg);
    }
  }, [isThresholdOpen, settings]);
  useEffect(() => {
    if (isProtocolOpen) setCadence(settings.protocol.cadenceMin);
  }, [isProtocolOpen, settings]);

  const enforce = settings.protocol.skinEnforce;
  const turnBlocked = enforce && !checks.every(Boolean);
  const scaleOk = scale[0] < scale[1] && scale[1] < scale[2];
  const thOk = th.warnMmHg < th.criticalMmHg;

  return (
    <>
      {toast && (
        <div key={toast.title + (toast.desc ?? "")}
          role={toast.tone === 'ok' ? 'status' : 'alert'}
          className={`fixed bottom-20 md:bottom-6 right-3 left-3 sm:left-auto z-50 max-w-md p-3 border-[3px] border-[#121c1b] shadow-[5px_5px_0px_#121c1b] flex items-start gap-3 anim-slide-up ${
            toast.tone === 'error' ? 'bg-[#8b2635] text-white' : toast.tone === 'alert' ? 'bg-[#d97757] text-white' : 'bg-[#121c1b] text-[#f1fcf9]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="font-label-mono-md uppercase font-bold text-xs tracking-wide">{toast.title}</div>
            {toast.desc && <div className="text-[11px] mt-0.5 opacity-90">{toast.desc}</div>}
          </div>
          <button onClick={onDismissToast} aria-label="Dismiss" className="text-sm font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {turnModalBed && (
        <Dialog title={`${turnModalBed.bedNumber} · log a turn`} onClose={onCloseTurnModal}>
          <p className="text-xs mb-3">
            New position for <strong>{turnModalBed.patientName}</strong>. Saving resets the body-area timers, resolves this bed's open alerts and tells the mat to clear its alarm.
          </p>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mb-3">
            {POSTURES.map((p) => (
              <button
                key={p}
                onClick={() => setPosture(p)}
                aria-pressed={posture === p}
                className={`p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md text-[11px] uppercase font-bold text-left ${
                  posture === p ? 'bg-[#1d635d] text-white' : 'bg-white hover:bg-[#ebf6f4]'
                }`}
              >
                {posture === p ? '● ' : '○ '}
                {p}
              </button>
            ))}
          </div>
          <fieldset className="mb-3 bg-white border-[2px] border-[#121c1b] p-2.5">
            <legend className="font-label-mono-sm uppercase font-bold text-[10px] px-1">Skin checks {enforce ? '(required)' : '(optional)'}</legend>
            {SKIN_CHECKS.map((c, i) => (
              <label key={c} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) => setChecks((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="w-4 h-4 accent-[#1d635d]"
                />
                {c}
              </label>
            ))}
          </fieldset>
          <label className="block mb-4">
            <span className="font-label-mono-sm uppercase font-bold text-[10px] block mb-1">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. skin intact, wedge in place"
              className="w-full bg-white border-[2px] border-[#121c1b] p-2 text-xs"
            />
          </label>
          <div className="flex flex-col-reverse xs:flex-row gap-2">
            <Button onClick={onCloseTurnModal}>Cancel</Button>
            <Button
              tone="teal"
              className="flex-1"
              disabled={turnBlocked}
              title={turnBlocked ? 'Complete every skin check first' : undefined}
              onClick={() => {
                onConfirmTurn(turnModalBed.id, posture, note || undefined, checks);
                onCloseTurnModal();
              }}
            >
              Save turn
            </Button>
          </div>
        </Dialog>
      )}

      {isThresholdOpen && (
        <Dialog title="Alert limits and pressure scale" onClose={onCloseThreshold}>
          <p className="text-[11px] text-[#3f4947] mb-3">All values are placeholders until the mat is calibrated and clinical staff set the limits.</p>
          <div className="flex flex-col gap-3">
            <NumberField label="Alert: any cell at or above (mmHg)" value={th.criticalMmHg} onChange={(v) => setTh({ ...th, criticalMmHg: v })} />
            <NumberField label="Warning level (mmHg)" value={th.warnMmHg} onChange={(v) => setTh({ ...th, warnMmHg: v })} hint={thOk ? undefined : 'must be below the alert level'} />
            <NumberField label="Max dwell (minutes)" value={th.maxDwellMin} onChange={(v) => setTh({ ...th, maxDwellMin: v })} />
            <div className="border-t-[2px] border-[#121c1b] pt-3">
              <span className="font-label-mono-sm uppercase font-bold text-[10px] block mb-2">Heatmap bands (used by the map, legend and sensor map)</span>
              <div className="grid grid-cols-3 gap-2">
                {(['Light from', 'Heavy from', 'Hot spot from'] as const).map((lbl, i) => (
                  <NumberField key={lbl} label={lbl} value={scale[i]} onChange={(v) => setScale((s) => s.map((x, j) => (j === i ? v : x)) as [number, number, number])} />
                ))}
              </div>
              {!scaleOk && <div className="text-[10px] text-[#8b2635] font-bold mt-1">Bands must increase: light &lt; heavy &lt; hot spot.</div>}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={th.autoPage} onChange={(e) => setTh({ ...th, autoPage: e.target.checked })} className="w-4 h-4 accent-[#1d635d]" />
              Page the charge nurse (stored only: paging is not built yet)
            </label>
          </div>
          <div className="mt-4 pt-3 border-t-[2px] border-[#121c1b] flex flex-col-reverse xs:flex-row justify-end gap-2">
            <Button onClick={onCloseThreshold}>Cancel</Button>
            <Button
              tone="teal"
              disabled={!scaleOk || !thOk}
              onClick={() => {
                onSaveThreshold(th, scale);
                onCloseThreshold();
              }}
            >
              Save
            </Button>
          </div>
        </Dialog>
      )}

      {isProtocolOpen && (
        <Dialog title="Turn cadence" onClose={onCloseProtocol}>
          <p className="text-xs mb-3">How often patients are turned. The next due time of every bed follows from its last turn.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[60, 90, 120, 150, 180, 240].map((m) => (
              <button
                key={m}
                onClick={() => setCadence(m)}
                aria-pressed={cadence === m}
                className={`p-2.5 border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] font-label-mono-md uppercase font-bold text-xs ${cadence === m ? 'bg-[#1d635d] text-white' : 'bg-white hover:bg-[#ebf6f4]'}`}
              >
                {m} min ({m / 60}h)
              </button>
            ))}
          </div>
          <div className="pt-3 border-t-[2px] border-[#121c1b] flex flex-col-reverse xs:flex-row justify-end gap-2">
            <Button onClick={onCloseProtocol}>Cancel</Button>
            <Button
              tone="teal"
              onClick={() => {
                onSaveProtocol(cadence);
                onCloseProtocol();
              }}
            >
              Save
            </Button>
          </div>
        </Dialog>
      )}

    </>
  );
};
