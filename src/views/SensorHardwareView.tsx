import React, { useState } from 'react';
import { PatientBed, PiezoCell } from '../types';
import type { MatView } from '../App';
import { pressureStyle } from '../utils/heatmapColors';
import { Button, Card, Chip, HeatCell, PageHeader, PressureLegend, SampleBadge, Stat } from '../components/ui';

type SelfTest = { pass: boolean; checks: { name: string; pass: boolean; detail: string }[] };

interface SensorHardwareViewProps {
  bed: PatientBed;
  cells: PiezoCell[];
  mat: MatView;
  connected: boolean;
  onTare: () => void;
  onSelfTest: () => Promise<SelfTest | null>;
}

export const SensorHardwareView: React.FC<SensorHardwareViewProps> = ({ bed, cells, mat, connected, onTare, onSelfTest }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmTare, setConfirmTare] = useState(false);
  const [test, setTest] = useState<SelfTest | null>(null);
  const [testing, setTesting] = useState(false);

  // Look the cell up on every render, so its load follows the live frames.
  const selected = cells.find((c) => c.id === selectedId) ?? null;
  const n = Math.round(Math.sqrt(cells.length)) || 10;
  const loaded = cells.filter((c) => c.status !== 'nominal').length;

  const runTest = async () => {
    setTesting(true);
    setTest(await onSelfTest());
    setTesting(false);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full max-w-[1200px] mx-auto">
      <PageHeader title={`Sensor mat · ${cells.length} cells`} subtitle={`${bed.bedNumber} · ${n}×${n} Velostat grid read by the ESP32`}>
        {!connected && <SampleBadge />}
        <Button onClick={runTest} disabled={testing}>
          {testing ? 'Testing…' : 'Run self-test'}
        </Button>
        <Button
          tone={confirmTare ? 'carmine' : 'teal'}
          onClick={() => {
            if (!confirmTare) return setConfirmTare(true);
            setConfirmTare(false);
            onTare();
          }}
          title="Learn the empty-mat level. The mat must be EMPTY."
        >
          {confirmTare ? 'Mat empty? Tap to tare' : 'Tare (empty mat)'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Stat label="Stream" value={connected ? (mat.fresh ? 'LIVE' : 'NO SIGNAL') : '—'} sub={mat.lastFrameAt ? `last frame ${new Date(mat.lastFrameAt).toLocaleTimeString()}` : 'no frame yet'} tone={mat.fresh ? 'teal' : 'carmine'} />
        <Stat label="Peak cell" value={`${mat.peakMmHg} mmHg`} sub={mat.peakZone || '—'} tone="carmine" />
        <Stat label="Cells above warn" value={loaded} sub={`of ${cells.length}`} />
        <Stat label="Calibration" value="NOT YET" sub="mmHg scale is a placeholder" />
      </div>

      {test && (
        <Card tone={test.pass ? 'slate' : 'white'} className={test.pass ? '' : '!border-[#8b2635]'}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold uppercase text-sm">Self-test: {test.pass ? 'passed' : 'failed'}</h2>
            <button onClick={() => setTest(null)} className="font-label-mono-sm text-[10px] underline">
              close
            </button>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {test.checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2 font-label-mono-sm text-[11px]">
                <Chip tone={c.pass ? 'mint' : 'carmine'}>{c.pass ? 'PASS' : 'FAIL'}</Chip>
                <span className="font-bold">{c.name}</span>
                <span className="text-[#3f4947] truncate">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <PressureLegend />
        <div className="w-full max-w-[640px] mx-auto">
          <div className="flex justify-between font-label-mono-sm text-[10px] text-[#3f4947] font-bold uppercase mb-1">
            <span>Head · cells 1–{n}</span>
            <span>row-major, cell = row × {n} + column + 1</span>
          </div>
          <div className="grid gap-[3px] bg-[#121c1b] p-[3px] border-[2px] border-[#121c1b]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {cells.map((c) => (
              <HeatCell key={c.id} mmHg={c.load} showNumber selected={c.id === selectedId} onClick={() => setSelectedId(c.id)} label={`${c.id} ${c.zone}`} />
            ))}
          </div>
          <div className="font-label-mono-sm text-[10px] text-[#3f4947] font-bold uppercase mt-1 text-right">Foot · cells {cells.length - n + 1}–{cells.length}</div>
        </div>

        <div className="bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2.5 flex flex-wrap items-center gap-3 font-label-mono-sm text-xs">
          {selected ? (
            <>
              <span className="w-9 h-9 border-[2px] border-[#121c1b] flex items-center justify-center font-bold" style={{ background: pressureStyle(selected.load).bg, color: pressureStyle(selected.load).textColor }}>
                {selected.num}
              </span>
              <span className="font-bold">{selected.id}</span>
              <span>{selected.zone}</span>
              <span>
                row {Math.floor((selected.num - 1) / n) + 1}, column {((selected.num - 1) % n) + 1}
              </span>
              <Chip tone={selected.status === 'critical' ? 'carmine' : selected.status === 'warn' ? 'terracotta' : 'mint'}>
                {selected.load} mmHg · {selected.status}
              </Chip>
            </>
          ) : (
            <span className="text-[#3f4947]">Tap a cell to see its number, body area and load.</span>
          )}
        </div>
      </Card>
    </div>
  );
};
