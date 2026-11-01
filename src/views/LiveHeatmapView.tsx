import React, { useEffect, useMemo, useState } from 'react';
import { PatientBed, ZoneTimer } from '../types';
import { api, PostureTimeline, Settings } from '../api/client';
import type { MatView } from '../App';
import { pressureStyle } from '../utils/heatmapColors';
import { Button, Card, Chip, EmptyState, HeatCell, PressureLegend, SampleBadge } from '../components/ui';

interface LiveHeatmapViewProps {
  bed: PatientBed;
  mat: MatView;
  timers: ZoneTimer[];
  settings: Settings;
  connected: boolean;
  onLogTurn: () => void;
  onSnooze: () => void;
  onOpenZones: () => void;
}

// Body region of each mat row (head at the top), matching server/data/cellLayout.ts.
const ROW_REGION = [
  'Head / occiput',
  'Neck / upper trapezius',
  'Shoulders / scapulae',
  'Upper back',
  'Mid spine',
  'Lumbar',
  'Pelvis / upper sacrum',
  'Sacrum, coccyx, trochanters',
  'Thighs / calves',
  'Heels',
];

const SAMPLE_TIMELINE: PostureTimeline = {
  from: '',
  to: '',
  coverageStartsAt: null,
  totalsMin: { BACK: 150, LEFT: 210, RIGHT: 120, OTHER: 0 },
  segments: [
    { posture: 'SUPINE', group: 'BACK', start: '', end: '', minutes: 150 },
    { posture: 'LEFT LATERAL 30°', group: 'LEFT', start: '', end: '', minutes: 210 },
    { posture: 'RIGHT LATERAL 30°', group: 'RIGHT', start: '', end: '', minutes: 120 },
  ],
};

const GROUP_STYLE: Record<string, string> = {
  BACK: 'bg-[#a3cfc9] text-[#121c1b]',
  LEFT: 'bg-[#1d635d] text-white',
  RIGHT: 'bg-[#ede8dc] text-[#121c1b]',
  OTHER: 'bg-white text-[#121c1b]',
};

function ago(iso: string | null, now: number) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const LiveHeatmapView: React.FC<LiveHeatmapViewProps> = ({ bed, mat, timers, settings, connected, onLogTurn, onSnooze, onOpenZones }) => {
  const [showNumbers, setShowNumbers] = useState(false);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [timeline, setTimeline] = useState<PostureTimeline | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!connected) return setTimeline(null);
    let live = true;
    api.beds
      .postureTimeline(bed.id, 8)
      .then((t) => live && setTimeline(t))
      .catch(() => live && setTimeline(null));
    return () => {
      live = false;
    };
  }, [connected, bed.id, bed.posture]);

  const n = mat.matrix.length || 10;
  const sel = selected && mat.matrix[selected.r]?.[selected.c] !== undefined ? selected : null;
  const selValue = sel ? mat.matrix[sel.r][sel.c] : null;
  const peak = pressureStyle(mat.peakMmHg);
  const hasSignal = !connected || mat.fresh;

  // The most urgent zone timer decides the action card.
  const worst = useMemo(
    () => [...timers].sort((a, b) => b.elapsedMin / (b.limitMin || 1) - a.elapsedMin / (a.limitMin || 1))[0],
    [timers],
  );
  const zoneOver = worst && worst.elapsedMin >= worst.limitMin;
  const flipTime = bed.status === 'due_now' || bed.status === 'overdue' || zoneOver || !!worst?.isNearLimit;

  const tl = connected ? timeline : SAMPLE_TIMELINE;
  const tlTotal = tl ? tl.segments.reduce((a, s) => a + s.minutes, 0) : 0;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      {/* Patient strip */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pb-2 border-b-[2px] border-[#121c1b]">
        <Chip tone="ink">{bed.bedNumber}</Chip>
        <Chip>{bed.patientName}</Chip>
        <Chip tone={bed.bradenScore <= 12 ? 'carmine' : 'teal'} title="Braden score: lower = higher risk (6-23)">
          BRADEN {bed.bradenScore} · {bed.bradenRisk}
        </Chip>
        <Chip tone={bed.status === 'overdue' || bed.status === 'due_now' ? 'carmine' : bed.status === 'pre_alert' || bed.status === 'elevated' ? 'terracotta' : 'mint'}>
          {bed.statusLabel}
        </Chip>
        <span className="ml-auto font-label-mono-sm text-[10px] text-[#3f4947]">RN: {bed.assignedRn || '—'}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* Heatmap */}
        <Card className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-[2px] border-[#121c1b]">
            <h2 className="font-bold uppercase text-sm sm:text-base">Live pressure map</h2>
            <div className="flex items-center gap-1.5">
              {!connected && <SampleBadge />}
              {connected && (
                <Chip tone={mat.fresh ? 'mint' : 'carmine'} title="Time since the last frame from the mat">
                  {mat.fresh ? `LIVE · ${ago(mat.lastFrameAt, now)}` : `NO SIGNAL · last ${ago(mat.lastFrameAt, now)}`}
                </Chip>
              )}
              <Button onClick={() => setShowNumbers((v) => !v)} className="!min-h-[30px] !py-1" title="Show mmHg in every cell">
                {showNumbers ? 'Hide mmHg' : 'Show mmHg'}
              </Button>
            </div>
          </div>

          <div className="w-full max-w-[460px] mx-auto">
            <div className="flex justify-between font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] font-bold uppercase mb-1">
              <span>Head ↑</span>
              <span>
                {n}×{n} cells
              </span>
            </div>
            <div className={`relative ${hasSignal ? '' : 'opacity-40 grayscale'}`}>
              <div className="grid gap-[3px] bg-[#121c1b] p-[3px] border-[2px] border-[#121c1b]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {mat.matrix.map((row, r) =>
                  row.map((v, c) => (
                    <HeatCell
                      key={`${r}-${c}`}
                      mmHg={v}
                      showNumber={showNumbers}
                      selected={sel?.r === r && sel?.c === c}
                      onClick={() => setSelected({ r, c })}
                      label={`Row ${r + 1}, column ${c + 1} (${ROW_REGION[r] ?? ''})`}
                    />
                  )),
                )}
              </div>
              {!hasSignal && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-white border-[2px] border-[#121c1b] px-3 py-1.5 font-label-mono-sm font-bold text-xs uppercase shadow-[2px_2px_0px_#121c1b]">
                    No recent frame from the mat
                  </span>
                </div>
              )}
            </div>
            <div className="text-center font-label-mono-sm text-[9px] sm:text-[10px] text-[#3f4947] font-bold uppercase mt-1">Foot of bed ↓</div>
          </div>

          <PressureLegend />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-label-mono-sm text-[11px]">
            <div className="flex items-center gap-2 bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2">
              <span className="w-6 h-6 border-[2px] border-[#121c1b] shrink-0" style={{ background: peak.bg }} />
              <div className="min-w-0">
                <div className="text-[9px] text-[#3f4947] uppercase font-bold">Peak cell</div>
                <div className="font-bold truncate">
                  {peak.mmHg} mmHg · {peak.label} · {mat.peakZone || '—'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#ebf6f4] border-[2px] border-[#121c1b] p-2">
              {sel && selValue !== null ? (
                <>
                  <span className="w-6 h-6 border-[2px] border-[#121c1b] shrink-0" style={{ background: pressureStyle(selValue).bg }} />
                  <div className="min-w-0">
                    <div className="text-[9px] text-[#3f4947] uppercase font-bold">
                      R{sel.r + 1} C{sel.c + 1} · {ROW_REGION[sel.r]}
                    </div>
                    <div className="font-bold">
                      {Math.round(selValue)} mmHg · {pressureStyle(selValue).label}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-[#3f4947]">Tap a cell to inspect it.</span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[#3f4947]">
            mmHg values use a placeholder scale ({settings.telemetry.mmHgPerByte} mmHg per byte) until the mat is calibrated with known weights.
          </p>
        </Card>

        {/* Right column */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4">
          {flipTime ? (
            <Card tone="carmine" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 bg-[#f1fcf9] border-[2px] border-[#121c1b] flex items-center justify-center text-[#8b2635] font-bold">!</span>
                <h2 className="font-bold uppercase text-2xl tracking-tight leading-none">Flip time.</h2>
              </div>
              <p className="text-xs leading-relaxed">
                {bed.status === 'overdue' || bed.status === 'due_now'
                  ? `Scheduled turn is ${bed.status === 'overdue' ? `overdue (${bed.countdown})` : 'due now'}.`
                  : 'A body area is close to its time limit.'}
                {worst ? ` Most loaded area: ${worst.name}, ${worst.elapsedMin} of ${worst.limitMin} min.` : ''}
              </p>
              <div className="flex flex-col xs:flex-row gap-2">
                <Button tone="terracotta" onClick={onLogTurn} className="flex-1 min-h-[44px]">
                  Done, turned
                </Button>
                <Button onClick={onSnooze} className="flex-1 min-h-[44px]">
                  Snooze 5 min
                </Button>
              </div>
            </Card>
          ) : (
            <Card tone="teal" className="flex flex-col gap-2">
              <div className="font-label-mono-sm text-[10px] uppercase font-bold text-[#adefe7]">Next scheduled turn</div>
              <div className="text-3xl font-bold tracking-tight">{bed.countdown}</div>
              <div className="text-xs">
                Every {settings.protocol.cadenceMin} min · last turn {bed.lastTurnTime}
              </div>
              <Button tone="mint" onClick={onLogTurn} className="mt-1">
                Log a turn now
              </Button>
            </Card>
          )}

          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-[10px] uppercase font-bold text-[#3f4947]">Position</span>
              <Chip tone="parchment" title="The posture AI is designed but not trained yet">
                AI: NOT TRAINED YET
              </Chip>
            </div>
            <div className="font-bold uppercase text-[#1d635d]">{bed.posture || 'UNKNOWN'}</div>
            <div className="text-[10px] text-[#3f4947]">Logged by the nurse at the last turn.</div>
          </Card>

          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-sm">Body-area timers</span>
              <button onClick={onOpenZones} className="font-label-mono-sm text-[10px] font-bold underline">
                All zones →
              </button>
            </div>
            {timers.length === 0 ? (
              <EmptyState title="No timers yet">They start with the first frame from the mat.</EmptyState>
            ) : (
              [...timers]
                .sort((a, b) => b.elapsedMin / (b.limitMin || 1) - a.elapsedMin / (a.limitMin || 1))
                .slice(0, 3)
                .map((t) => <TimerBar key={t.name} t={t} />)
            )}
          </Card>
        </div>
      </div>

      {/* Posture timeline */}
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-[2px] border-[#121c1b]">
          <h2 className="font-bold uppercase text-sm sm:text-base">Last 8 hours: positions</h2>
          {!connected && <SampleBadge />}
        </div>
        {!tl || tl.segments.length === 0 || tlTotal === 0 ? (
          <EmptyState title="No turns logged in the last 8 hours" />
        ) : (
          <>
            <div className="w-full flex border-[2px] border-[#121c1b] overflow-hidden">
              {tl.segments.map((s, i) => (
                <div
                  key={i}
                  className={`${GROUP_STYLE[s.group]} py-2 px-1 text-center border-r-[2px] last:border-r-0 border-[#121c1b] min-w-0`}
                  style={{ width: `${(s.minutes / tlTotal) * 100}%` }}
                  title={`${s.posture}: ${s.minutes} min`}
                >
                  <div className="font-label-mono-sm font-bold text-[9px] sm:text-[10px] uppercase truncate">{s.group}</div>
                  <div className="font-label-mono-sm text-[8px] sm:text-[9px] truncate">{(s.minutes / 60).toFixed(1)}h</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 font-label-mono-sm text-[10px]">
              {(['BACK', 'LEFT', 'RIGHT'] as const).map((g) => (
                <span key={g} className="inline-flex items-center gap-1">
                  <span className={`w-3 h-3 border border-[#121c1b] ${GROUP_STYLE[g]}`} />
                  {g}: {((tl.totalsMin[g] ?? 0) / 60).toFixed(1)}h
                </span>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export function TimerBar({ t }: { t: ZoneTimer }) {
  const pct = Math.min(100, Math.round((t.elapsedMin / (t.limitMin || 1)) * 100));
  const over = t.elapsedMin >= t.limitMin;
  const tone = over || t.isNearLimit ? 'bg-[#8b2635]' : t.isElevated ? 'bg-[#d97757]' : 'bg-[#1d635d]';
  const label = over ? 'OVER LIMIT' : t.isNearLimit ? 'NEAR LIMIT' : t.isElevated ? 'ELEVATED' : 'OK';
  return (
    <div>
      <div className="flex justify-between font-label-mono-sm text-[10px] font-bold">
        <span className="truncate">{t.name}</span>
        <span className="shrink-0 ml-2">
          {t.elapsedMin}/{t.limitMin} min · {label}
        </span>
      </div>
      <div className="h-3 bg-[#ebf6f4] border-[2px] border-[#121c1b] mt-0.5">
        <div className={`h-full ${tone} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
