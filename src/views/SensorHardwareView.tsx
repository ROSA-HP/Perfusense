import React, { useState } from 'react';
import { PatientBed, PiezoCell } from '../types';
import type { MatView } from '../App';
import { pressureStyle } from '../utils/heatmapColors';
import { Button, Card, Chip, HeatCell, PageHeader, PressureLegend, SampleBadge, StripHeader } from '../components/ui';

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

  const runTest = async () => {
    setTesting(true);
    setTest(await onSelfTest());
    setTesting(false);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full max-w-[1100px] mx-auto">
      <PageHeader title="Sensor mat" subtitle={`${bed.bedNumber} · ${cells.length} cells · ${n}×${n} Velostat grid read by the ESP32`}>
        {!connected ? (
          <SampleBadge />
        ) : (
          <Chip tone={mat.fresh ? 'mint' : 'carmine'}>{mat.fresh ? 'stream live' : 'no signal'}</Chip>
        )}
        <Chip tone="parchment" title="mmHg uses a placeholder scale until the mat is calibrated with known weights">
          not calibrated
        </Chip>
        <Button onClick={runTest} disabled={testing}>
          {testing ? 'Testing…' : 'Self-test'}
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
          {confirmTare ? 'Mat empty? Tap again' : 'Tare'}
        </Button>
      </PageHeader>

      {test && (
        <section className={`bg-white border-[2.5px] ${test.pass ? 'border-[#121c1b]' : 'border-[#8b2635]'} shadow-[4px_4px_0px_rgba(18,28,27,0.85)] anim-pop`}>
          <StripHeader
            label={`Self-test: ${test.pass ? 'passed' : 'failed'}`}
            right={
              <button onClick={() => setTest(null)} aria-label="Close" className="w-6 h-6 bg-white text-[#121c1b] border-[2px] border-[#121c1b]">
                ✕
              </button>
            }
          />
          <ul className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 anim-stagger">
            {test.checks.map((c, i) => (
              <li key={c.name} style={{ '--i': i } as React.CSSProperties} className="flex items-center gap-2 font-label-mono-sm">
                <Chip tone={c.pass ? 'mint' : 'carmine'}>{c.pass ? 'pass' : 'fail'}</Chip>
                <span>{c.name}</span>
                <span className="text-[#3f4947] font-normal truncate">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card title="Cell map" action={<span className="font-label-mono-sm text-[#3f4947]">tap a cell</span>} className="anim-rise">
        <div className="w-full max-w-[600px] mx-auto">
          <div className="flex justify-between font-label-mono-sm text-[#3f4947] mb-1">
            <span>HEAD · cells 1–{n}</span>
            <span>
              peak {mat.peakMmHg} mmHg · {mat.peakZone || '—'}
            </span>
          </div>
          <div className="grid gap-[3px] bg-[#121c1b] p-[3px] border-[2px] border-[#121c1b]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {cells.map((c) => (
              <HeatCell key={c.id} mmHg={c.load} showNumber selected={c.id === selectedId} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)} label={`${c.id} ${c.zone}`} />
            ))}
          </div>
          <div className="font-label-mono-sm text-[#3f4947] mt-1 text-right">
            FOOT · cells {cells.length - n + 1}–{cells.length}
          </div>
        </div>

        <div className="collapse" data-open={!!selected}>
          <div>
            {selected && (
              <div className="mt-3 bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2.5 flex flex-wrap items-center gap-3 font-label-mono-sm">
                <span
                  className="w-9 h-9 border-[2px] border-[#121c1b] flex items-center justify-center transition-colors duration-500"
                  style={{ background: pressureStyle(selected.load).bg, color: pressureStyle(selected.load).textColor }}
                >
                  {selected.num}
                </span>
                <span>{selected.id}</span>
                <span className="font-normal">{selected.zone}</span>
                <span className="font-normal">
                  row {Math.floor((selected.num - 1) / n) + 1}, column {((selected.num - 1) % n) + 1}
                </span>
                <Chip tone={selected.status === 'critical' ? 'carmine' : selected.status === 'warn' ? 'terracotta' : 'mint'}>
                  {selected.load} mmHg · {selected.status}
                </Chip>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <PressureLegend compact />
        </div>
      </Card>
    </div>
  );
};
