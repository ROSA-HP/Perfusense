import React, { useEffect, useMemo, useState } from 'react';
import { PatientBed, ZoneTimer } from '../types';
import { api, PostureTimeline, Settings } from '../api/client';
import type { MatView } from '../App';
import { pressureStyle } from '../utils/heatmapColors';
import { Button, Card, Chip, Disclosure, EmptyState, HeatCell, PressureLegend, SampleBadge } from '../components/ui';

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
  const [timelineOpen, setTimelineOpen] = useState(false);
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
  const shownValue = sel ? mat.matrix[sel.r][sel.c] : mat.peakMmHg;
  const shownStyle = pressureStyle(shownValue);
  const hasSignal = !connected || mat.fresh;

  const byRatio = useMemo(() => [...timers].sort((a, b) => b.elapsedMin / (b.limitMin || 1) - a.elapsedMin / (a.limitMin || 1)), [timers]);
  const worst = byRatio[0];
  const flipTime = bed.status === 'due_now' || bed.status === 'overdue' || (worst && (worst.elapsedMin >= worst.limitMin || !!worst.isNearLimit));

  const tl = connected ? timeline : SAMPLE_TIMELINE;
  const tlTotal = tl ? tl.segments.reduce((a, s) => a + s.minutes, 0) : 0;
  const tlSummary = tl && tlTotal ? (['BACK', 'LEFT', 'RIGHT'] as const).map((g) => `${g} ${((tl.totalsMin[g] ?? 0) / 60).toFixed(1)}h`).join(' · ') : 'no turns logged';

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      {/* One strip: who, risk, status, position */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 anim-rise">
        <Chip tone="ink">{bed.bedNumber}</Chip>
        <span className="font-bold text-base sm:text-lg mr-1">{bed.patientName}</span>
        <Chip tone={bed.bradenScore <= 12 ? 'carmine' : 'teal'} title="Braden score: lower = higher risk (6-23)">
          Braden {bed.bradenScore}
        </Chip>
        <Chip tone={bed.status === 'overdue' || bed.status === 'due_now' ? 'carmine' : bed.status === 'pre_alert' || bed.status === 'elevated' ? 'terracotta' : 'mint'}>
          {bed.statusLabel}
        </Chip>
        <Chip tone="white" title="Logged by the nurse at the last turn. The posture AI is not trained yet.">
          {bed.posture || 'UNKNOWN'} · logged
        </Chip>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start anim-stagger">
        {/* Heatmap */}
        <Card
          style={{ '--i': 0 } as React.CSSProperties}
          className="lg:col-span-7"
          title="Live pressure map"
          action={
            <>
              {!connected ? (
                <SampleBadge />
              ) : (
                <Chip tone={mat.fresh ? 'mint' : 'carmine'} title="Time since the last frame from the mat">
                  {mat.fresh ? `live · ${ago(mat.lastFrameAt, now)}` : `no signal · ${ago(mat.lastFrameAt, now)}`}
                </Chip>
              )}
              <button onClick={() => setShowNumbers((v) => !v)} aria-pressed={showNumbers} className="font-label-mono-sm underline">
                {showNumbers ? 'hide mmHg' : 'show mmHg'}
              </button>
            </>
          }
        >
          <div className="w-full max-w-[440px] mx-auto">
            <div className="flex justify-between font-label-mono-sm text-[#3f4947] mb-1">
              <span>HEAD ↑</span>
              <span>
                {n}×{n}
              </span>
            </div>
            <div className={`relative transition-all duration-500 ${hasSignal ? '' : 'opacity-40 grayscale'}`}>
              <div className="grid gap-[3px] bg-[#121c1b] p-[3px] border-[2px] border-[#121c1b]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {mat.matrix.map((row, r) =>
                  row.map((v, c) => (
                    <HeatCell
                      key={`${r}-${c}`}
                      mmHg={v}
                      showNumber={showNumbers}
                      selected={sel?.r === r && sel?.c === c}
                      onClick={() => setSelected(sel?.r === r && sel?.c === c ? null : { r, c })}
                      label={`Row ${r + 1}, column ${c + 1} (${ROW_REGION[r] ?? ''})`}
                    />
                  )),
                )}
              </div>
              {!hasSignal && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-white border-[2px] border-[#121c1b] px-3 py-1.5 font-label-mono-sm uppercase shadow-[2px_2px_0px_#121c1b] anim-pop">No recent frame from the mat</span>
                </div>
              )}
            </div>
            <div className="text-center font-label-mono-sm text-[#3f4947] mt-1">FOOT ↓</div>
          </div>

          {/* One line: the peak, or the tapped cell */}
          <div key={sel ? `${sel.r}-${sel.c}` : 'peak'} className="mt-3 flex items-center gap-2 bg-[#ebf6f4] border-[2px] border-[#121c1b] px-2 py-1.5 anim-fade">
            <span className="w-5 h-5 border-[2px] border-[#121c1b] shrink-0 transition-colors duration-500" style={{ background: shownStyle.bg }} />
            <span className="font-label-mono-sm min-w-0 truncate">
              {sel ? `R${sel.r + 1} C${sel.c + 1} · ${ROW_REGION[sel.r]}` : `PEAK · ${mat.peakZone || '—'}`}
            </span>
            <span className="ml-auto font-bold text-sm whitespace-nowrap">
              {Math.round(shownValue)} mmHg <span className="font-label-mono-sm">{shownStyle.label}</span>
            </span>
            {sel && (
              <button onClick={() => setSelected(null)} aria-label="Back to the peak" className="font-label-mono-sm px-1">
                ✕
              </button>
            )}
          </div>

          <div className="mt-3" title={`Placeholder scale: ${settings.telemetry.mmHgPerByte} mmHg per byte until the mat is calibrated with known weights.`}>
            <PressureLegend compact />
          </div>
        </Card>

        {/* Right column: the decision, then the timers */}
        <div style={{ '--i': 1 } as React.CSSProperties} className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4">
          {flipTime ? (
            <Card tone="carmine" className="flex flex-col gap-3 relative overflow-hidden">
              <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#d97757] opacity-30 svg-center anim-halo" aria-hidden />
              <h2 className="font-bold text-3xl tracking-tight leading-none relative">Flip time.</h2>
              <p className="text-xs leading-relaxed relative">
                {bed.status === 'overdue' || bed.status === 'due_now'
                  ? `Turn ${bed.status === 'overdue' ? `overdue (${bed.countdown})` : 'due now'}.`
                  : 'A body area is near its limit.'}
                {worst ? ` ${worst.name}: ${worst.elapsedMin} of ${worst.limitMin} min.` : ''}
              </p>
              <div className="grid grid-cols-2 gap-2 relative">
                <Button tone="terracotta" onClick={onLogTurn} className="min-h-[46px]">
                  Done, turned
                </Button>
                <Button onClick={onSnooze} className="min-h-[46px]">
                  Snooze 5 min
                </Button>
              </div>
            </Card>
          ) : (
            <Card tone="teal" className="flex flex-col gap-1.5">
              <div className="font-label-mono-sm uppercase text-[#adefe7]">Next turn in</div>
              <div className="text-4xl font-bold tracking-tight leading-none">{bed.countdown}</div>
              <div className="text-xs text-[#d6f5f0]">
                every {settings.protocol.cadenceMin} min · last at {bed.lastTurnTime}
              </div>
              <Button tone="mint" onClick={onLogTurn} className="mt-2">
                Log a turn
              </Button>
            </Card>
          )}

          <Card
            title="Body-area timers"
            action={
              <button onClick={onOpenZones} className="font-label-mono-sm underline">
                all {timers.length} →
              </button>
            }
          >
            {timers.length === 0 ? (
              <EmptyState title="No timers yet">They start with the first frame from the mat.</EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {byRatio.slice(0, 3).map((t) => (
                  <TimerBar key={t.name} t={t} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Positions over 8 h: one summary line, the bar on click */}
      <Card className="anim-rise">
        <Disclosure
          open={timelineOpen}
          onToggle={() => setTimelineOpen((v) => !v)}
          summary={
            <span className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 font-bold">
                <span className="w-3.5 h-3.5 bg-[#8b2635]" />
                Positions, last 8 h
              </span>
              <span className="font-label-mono-sm text-[#3f4947]">{tlSummary}</span>
              {!connected && <SampleBadge />}
            </span>
          }
        >
          <div className="pt-3">
            {!tl || tlTotal === 0 ? (
              <EmptyState title="No turns logged in the last 8 hours" />
            ) : (
              <div className="w-full flex border-[2px] border-[#121c1b] overflow-hidden">
                {tl.segments.map((s, i) => (
                  <div
                    key={i}
                    className={`${GROUP_STYLE[s.group]} py-2 px-1 text-center border-r-[2px] last:border-r-0 border-[#121c1b] min-w-0`}
                    style={{ width: `${(s.minutes / tlTotal) * 100}%` }}
                    title={`${s.posture}: ${s.minutes} min`}
                  >
                    <div className="font-label-mono-sm uppercase truncate">{s.group}</div>
                    <div className="font-label-mono-sm font-normal truncate">{(s.minutes / 60).toFixed(1)}h</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Disclosure>
      </Card>
    </div>
  );
};

export function TimerBar({ t }: { t: ZoneTimer }) {
  const pct = Math.min(100, Math.round((t.elapsedMin / (t.limitMin || 1)) * 100));
  const over = t.elapsedMin >= t.limitMin;
  const hot = over || t.isNearLimit;
  const tone = hot ? 'bg-[#8b2635]' : t.isElevated ? 'bg-[#d97757]' : 'bg-[#1d635d]';
  const label = over ? 'OVER' : t.isNearLimit ? 'NEAR LIMIT' : t.isElevated ? 'ELEVATED' : 'OK';
  return (
    <div>
      <div className="flex justify-between font-label-mono-sm">
        <span className="truncate">{t.name}</span>
        <span className="shrink-0 ml-2">
          {t.elapsedMin}/{t.limitMin}m · {label}
        </span>
      </div>
      <div className="h-3 bg-[#ebf6f4] border-[2px] border-[#121c1b] mt-0.5">
        <div className={`h-full ${tone} bar-fill ${hot ? 'bar-shine' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
