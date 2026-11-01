import React, { useEffect, useMemo, useState } from 'react';
import { PatientBed } from '../types';
import { api, PressureHistory, Settings } from '../api/client';
import { pressureStyle, getPressureScale } from '../utils/heatmapColors';
import { Button, Card, Chip, Disclosure, EmptyState, PageHeader, SampleBadge, Stat } from '../components/ui';

interface TurnScheduleViewProps {
  bed: PatientBed;
  connected: boolean;
  settings: Settings;
}

const RANGES = [
  { id: '8h', hours: 8 },
  { id: '24h', hours: 24 },
  { id: '7d', hours: 168 },
] as const;

// Offline only: a made-up 8-hour trend, labelled SAMPLE DATA.
function sampleHistory(): PressureHistory {
  const now = Date.now();
  const samples = Array.from({ length: 96 }, (_, i) => {
    const t = now - (95 - i) * 5 * 60_000;
    const cycle = (i % 24) / 24; // pressure builds until each turn
    const peak = Math.round((14 + cycle * 48 + Math.sin(i / 3) * 4) * 10) / 10;
    return { at: new Date(t).toISOString(), peakMmHg: peak, peakZone: 'SACRAL', meanLoadedMmHg: peak * 0.6, loadedCells: 12 };
  });
  const turns = [23, 47, 71].map((i, k) => ({ at: samples[i].at, posture: ['LEFT LATERAL 30°', 'RIGHT LATERAL 30°', 'SUPINE'][k], rn: '', note: '' }));
  const peaks = samples.map((s) => s.peakMmHg);
  const max = Math.max(...peaks);
  return {
    from: samples[0].at,
    to: samples[samples.length - 1].at,
    samples,
    turns,
    summary: {
      samples: samples.length,
      latestPeakMmHg: peaks[peaks.length - 1],
      maxPeakMmHg: max,
      maxPeakAt: samples[peaks.indexOf(max)].at,
      maxPeakZone: 'SACRAL',
      meanPeakMmHg: Math.round((peaks.reduce((a, b) => a + b, 0) / peaks.length) * 10) / 10,
      turns: turns.length,
    },
  };
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayClock = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const TurnScheduleView: React.FC<TurnScheduleViewProps> = ({ bed, connected, settings }) => {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [data, setData] = useState<PressureHistory | null>(null);
  const [error, setError] = useState('');
  const [hover, setHover] = useState<number | null>(null);
  const [turnsOpen, setTurnsOpen] = useState(false);

  useEffect(() => {
    if (!connected) {
      setData(sampleHistory());
      return;
    }
    let live = true;
    setError('');
    api.beds
      .pressureHistory(bed.id, range.hours)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    const t = window.setInterval(() => api.beds.pressureHistory(bed.id, range.hours).then((d) => live && setData(d)).catch(() => undefined), 60_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [connected, bed.id, range]);

  const [, heavy, hot] = getPressureScale();
  const chart = useMemo(() => {
    if (!data || data.samples.length < 2) return null;
    const W = 760;
    const H = 220;
    const px = 40;
    const py = 20;
    const t0 = new Date(data.from).getTime();
    const t1 = new Date(data.to).getTime();
    const yMax = Math.max(hot * 1.4, ...data.samples.map((s) => s.peakMmHg));
    const x = (iso: string) => px + ((new Date(iso).getTime() - t0) / Math.max(1, t1 - t0)) * (W - px * 2);
    const y = (v: number) => H - py - (v / yMax) * (H - py * 2);
    const pts = data.samples.map((s) => `${x(s.at).toFixed(1)},${y(s.peakMmHg).toFixed(1)}`).join(' ');
    return { W, H, px, py, x, y, yMax, pts };
  }, [data, hot]);

  const exportCsv = () => {
    if (!data) return;
    const rows = ['time,peak_mmHg,peak_zone,mean_loaded_mmHg,loaded_cells', ...data.samples.map((s) => `${s.at},${s.peakMmHg},${s.peakZone},${s.meanLoadedMmHg},${s.loadedCells}`)];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfusense_${bed.id}_pressure_${range.id}${connected ? '' : '_SAMPLE'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary;
  const hovered = hover !== null && data ? data.samples[hover] : null;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full max-w-[1300px] mx-auto">
      <PageHeader title="Pressure history" subtitle={`${bed.bedNumber} · ${bed.patientName} · one sample per minute from the mat`}>
        {!connected && <SampleBadge />}
        <div className="flex border-[2px] border-[#121c1b] bg-white">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r)}
              aria-pressed={range.id === r.id}
              className={`px-3 py-1 font-label-mono-sm text-xs font-bold uppercase ${range.id === r.id ? 'bg-[#1d635d] text-white' : 'hover:bg-[#ebf6f4]'}`}
            >
              {r.id}
            </button>
          ))}
        </div>
        <Button tone="teal" onClick={exportCsv} disabled={!data?.samples.length}>
          Export CSV
        </Button>
      </PageHeader>

      {error && <EmptyState title="Could not load history">{error}</EmptyState>}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 anim-stagger">
        <div style={{ '--i': 0 } as React.CSSProperties}>
          <Stat label="Latest peak" value={s?.latestPeakMmHg != null ? `${s.latestPeakMmHg} mmHg` : '—'} sub={s?.latestPeakMmHg != null ? pressureStyle(s.latestPeakMmHg).label : 'no data'} tone="teal" />
        </div>
        <div style={{ '--i': 1 } as React.CSSProperties}>
          <Stat
            label="Highest peak"
            value={s?.maxPeakMmHg != null ? `${s.maxPeakMmHg} mmHg` : '—'}
            sub={s?.maxPeakAt ? `${dayClock(s.maxPeakAt)} · ${s.maxPeakZone}` : 'no data'}
            tone="carmine"
          />
        </div>
        <div style={{ '--i': 2 } as React.CSSProperties}>
          <Stat label="Turns logged" value={s?.turns ?? 0} sub={`target: every ${settings.protocol.cadenceMin} min`} tone="teal" />
        </div>
      </div>

      <Card
        className="flex flex-col gap-3 anim-rise"
        title={`Peak pressure, ${range.id}`}
        action={
          <span className="flex items-center gap-3 font-label-mono-sm">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#d97757]" /> heavy ≥ {heavy}
            </span>
            <span className="inline-flex items-center gap-1 text-[#8b2635]">
              <span className="w-3 h-0.5 bg-[#8b2635]" /> hot ≥ {hot}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rotate-45 bg-[#121c1b]" /> turn
            </span>
          </span>
        }
      >
        {!chart ? (
          <EmptyState title="No pressure data in this window">Samples appear once the mat sends frames (one per minute is stored).</EmptyState>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full min-w-[560px] h-52" onMouseLeave={() => setHover(null)}>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={chart.px} x2={chart.W - chart.px} y1={chart.y(chart.yMax * f)} y2={chart.y(chart.yMax * f)} stroke="#121c1b" opacity="0.12" />
                  <text x={chart.px - 6} y={chart.y(chart.yMax * f) + 3} fontSize="9" textAnchor="end" fontFamily="monospace" fill="#3f4947">
                    {Math.round(chart.yMax * f)}
                  </text>
                </g>
              ))}
              <rect x={chart.px} width={chart.W - chart.px * 2} y={chart.y(chart.yMax)} height={chart.y(hot) - chart.y(chart.yMax)} fill="#8b2635" opacity="0.07" />
              <line x1={chart.px} x2={chart.W - chart.px} y1={chart.y(heavy)} y2={chart.y(heavy)} stroke="#d97757" strokeDasharray="4,4" strokeWidth="1.5" />
              <line x1={chart.px} x2={chart.W - chart.px} y1={chart.y(hot)} y2={chart.y(hot)} stroke="#8b2635" strokeDasharray="4,4" strokeWidth="1.5" />
              <polyline key={`${range.id}-${data!.samples.length}`} points={chart.pts} pathLength={1} fill="none" stroke="#1d635d" strokeWidth="2" strokeLinejoin="round" className="anim-draw" />
              {data!.turns.map((t, i) => (
                <g key={i}>
                  <line x1={chart.x(t.at)} x2={chart.x(t.at)} y1={chart.py} y2={chart.H - chart.py} stroke="#121c1b" strokeWidth="1" strokeDasharray="2,3" />
                  <rect x={chart.x(t.at) - 4} y={chart.py - 4} width="8" height="8" fill="#121c1b" transform={`rotate(45 ${chart.x(t.at)} ${chart.py})`} />
                </g>
              ))}
              {data!.samples.map((p, i) => (
                <rect key={i} x={chart.x(p.at) - 3} y={chart.py} width="6" height={chart.H - chart.py * 2} fill="transparent" onMouseEnter={() => setHover(i)} />
              ))}
              {hovered && <circle cx={chart.x(hovered.at)} cy={chart.y(hovered.peakMmHg)} r="5" fill={pressureStyle(hovered.peakMmHg).bg} stroke="#121c1b" strokeWidth="2" />}
              <text x={chart.px} y={chart.H - 4} fontSize="9" fontFamily="monospace" fill="#3f4947">
                {dayClock(data!.from)}
              </text>
              <text x={chart.W - chart.px} y={chart.H - 4} fontSize="9" fontFamily="monospace" fill="#3f4947" textAnchor="end">
                now
              </text>
            </svg>
          </div>
        )}
        <div className="font-label-mono-sm text-[11px] min-h-[18px]">
          {hovered ? (
            <>
              <strong>{clock(hovered.at)}</strong> · peak {hovered.peakMmHg} mmHg ({pressureStyle(hovered.peakMmHg).label}) · {hovered.peakZone || '—'} · {hovered.loadedCells} loaded cells
            </>
          ) : (
            <span className="text-[#3f4947]">
              Hover the chart to read a sample{s?.meanPeakMmHg != null ? ` · average peak ${s.meanPeakMmHg} mmHg over ${s.samples} samples` : ''}.
            </span>
          )}
        </div>
      </Card>

      <Card>
        <Disclosure
          open={turnsOpen}
          onToggle={() => setTurnsOpen((v) => !v)}
          summary={
            <span className="flex items-center gap-2 font-bold">
              <span className="w-3.5 h-3.5 bg-[#8b2635]" />
              Turns in this window
              <Chip tone="ink">{data?.turns.length ?? 0}</Chip>
            </span>
          }
        >
          <div className="pt-2">
            {!data || data.turns.length === 0 ? (
              <EmptyState title="No turns logged" />
            ) : (
              <ul className="divide-y divide-[#121c1b]/20">
                {[...data.turns].reverse().map((t, i) => (
                  <li key={i} className="py-2 flex flex-wrap items-center gap-2 font-label-mono-sm">
                    <Chip tone="ink">{dayClock(t.at)}</Chip>
                    <span>{t.posture}</span>
                    {t.rn && <span className="text-[#3f4947] font-normal">by {t.rn}</span>}
                    {t.note && <span className="text-[#3f4947] font-normal truncate">· {t.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Disclosure>
      </Card>
    </div>
  );
};
