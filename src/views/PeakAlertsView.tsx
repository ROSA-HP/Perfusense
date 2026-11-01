import React, { useEffect, useState } from 'react';
import { AuditLogItem, PatientBed, ZoneTimer } from '../types';
import type { Settings } from '../api/client';
import { Button, Card, Chip, Disclosure, EmptyState, PageHeader, SampleBadge, StripHeader } from '../components/ui';

interface PeakAlertsViewProps {
  bed: PatientBed;
  timers: ZoneTimer[];
  auditLogs: (AuditLogItem & { acknowledgedAt?: string | null; acknowledgedBy?: string })[];
  settings: Settings;
  connected: boolean;
  onOpenThresholds: () => void;
  onOpenProtocol: () => void;
  onResetZone: (zoneName: string) => void;
  onResetAll: () => void;
  onAlertAction: (id: string, action: 'acknowledge' | 'resolve') => void;
}

type Level = 'none' | 'ok' | 'elevated' | 'near' | 'over';
const ratio = (t: ZoneTimer) => t.elapsedMin / (t.limitMin || 1);
const levelOf = (t?: ZoneTimer): Level => (!t ? 'none' : t.elapsedMin >= t.limitMin ? 'over' : t.isNearLimit ? 'near' : t.isElevated ? 'elevated' : 'ok');
const FILL: Record<Level, string> = { none: '#ffffff', ok: '#a3cfc9', elevated: '#d97757', near: '#8b2635', over: '#5a1428' };
const LABEL: Record<Level, string> = { none: 'NO DATA', ok: 'OK', elevated: 'ELEVATED', near: 'NEAR LIMIT', over: 'OVER LIMIT' };
const BAR: Record<Level, string> = { none: 'bg-white', ok: 'bg-[#1d635d]', elevated: 'bg-[#d97757]', near: 'bg-[#8b2635]', over: 'bg-[#5a1428]' };

// Pressure points on a body lying on its back, seen from above, head at the top
// (same orientation as the heatmap). Left of the drawing = the server's LEFT trochanter.
const SPOTS: { name: string; short: string; at: [number, number][]; r: number }[] = [
  { name: 'ELBOWS & OCCIPUT', short: 'Occiput & elbows', at: [[100, 30], [42, 176], [158, 176]], r: 10 },
  { name: 'SHOULDERS (SCAPULAE)', short: 'Shoulders', at: [[78, 104], [122, 104]], r: 12 },
  { name: 'LEFT TROCHANTER (HIP)', short: 'Left hip', at: [[66, 222]], r: 11 },
  { name: 'SACRUM & COCCYX', short: 'Sacrum', at: [[100, 226]], r: 14 },
  { name: 'RIGHT TROCHANTER (HIP)', short: 'Right hip', at: [[134, 222]], r: 11 },
  { name: 'HEELS (CALCANEUS)', short: 'Heels', at: [[84, 388], [116, 388]], r: 9 },
];

function BodyFigure({ timers, selected, onSelect }: { timers: ZoneTimer[]; selected: string | null; onSelect: (n: string) => void }) {
  return (
    <svg viewBox="0 0 200 410" className="w-full max-w-[250px] mx-auto overflow-visible" role="img" aria-label="Body map: pressure points coloured by their timers">
      <defs>
        <linearGradient id="skin" x1="0" x2="1">
          <stop offset="0" stopColor="#dff2ee" />
          <stop offset="0.5" stopColor="#f4fbf9" />
          <stop offset="1" stopColor="#dff2ee" />
        </linearGradient>
        <pattern id="mat" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#a3cfc9" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* the mat under the body */}
      <rect x="22" y="70" width="156" height="200" fill="url(#mat)" stroke="#a3cfc9" strokeDasharray="4 3" />
      <text x="174" y="266" textAnchor="end" fontSize="7" fontFamily="Space Mono, monospace" fill="#1d635d">
        MAT 10×10
      </text>

      {/* body: breathes gently (off with reduced motion) */}
      <g className="anim-breathe svg-center" fill="url(#skin)" stroke="#121c1b" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M58 82 C 40 86 36 104 38 128 L 34 214 C 33 226 50 228 50 214 L 58 132 Z" />
        <path d="M142 82 C 160 86 164 104 162 128 L 166 214 C 167 226 150 228 150 214 L 142 132 Z" />
        <path d="M70 236 C 68 290 72 340 76 384 C 77 400 96 400 96 384 L 99 250 Z" />
        <path d="M130 236 C 132 290 128 340 124 384 C 123 400 104 400 104 384 L 101 250 Z" />
        <path d="M60 86 C 62 76 78 72 90 70 L 110 70 C 122 72 138 76 140 86 C 144 120 134 150 134 176 C 136 200 140 222 134 240 C 120 252 80 252 66 240 C 60 222 64 200 66 176 C 66 150 56 120 60 86 Z" />
        <rect x="91" y="54" width="18" height="18" rx="4" />
        <ellipse cx="100" cy="34" rx="22" ry="26" />
      </g>
      <path d="M100 96 L100 214" stroke="#121c1b" strokeWidth="1" strokeDasharray="2 4" opacity="0.35" />

      {SPOTS.map((s) => {
        const t = timers.find((x) => x.name === s.name);
        const lv = levelOf(t);
        const isSel = selected === s.name;
        const pulse = lv === 'over' || lv === 'near' ? 'anim-halo-fast' : lv === 'elevated' ? 'anim-halo' : '';
        return (
          <g
            key={s.name}
            role="button"
            tabIndex={0}
            aria-label={`${s.short}: ${LABEL[lv]}${t ? `, ${t.elapsedMin} of ${t.limitMin} minutes` : ''}`}
            onClick={() => onSelect(s.name)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(s.name)}
            className="cursor-pointer outline-none group"
          >
            {s.at.map(([cx, cy], i) => (
              <g key={i}>
                {pulse && <circle cx={cx} cy={cy} r={s.r} fill={FILL[lv]} className={`svg-center ${pulse}`} />}
                <circle
                  cx={cx}
                  cy={cy}
                  r={s.r}
                  fill={FILL[lv]}
                  stroke="#121c1b"
                  strokeWidth={isSel ? 3.5 : 2}
                  className="svg-center transition-transform duration-200 group-hover:scale-125"
                />
                {isSel && <circle cx={cx} cy={cy} r={s.r + 6} fill="none" stroke="#121c1b" strokeWidth="1.5" strokeDasharray="4 3" className="svg-center anim-spin" />}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export const PeakAlertsView: React.FC<PeakAlertsViewProps> = ({
  bed,
  timers,
  auditLogs,
  settings,
  connected,
  onOpenThresholds,
  onOpenProtocol,
  onResetZone,
  onResetAll,
  onAlertAction,
}) => {
  const sorted = [...timers].sort((a, b) => ratio(b) - ratio(a));
  const [selected, setSelected] = useState<string | null>(sorted[0]?.name ?? null);
  const [confirm, setConfirm] = useState<string | null>(null); // zone name, or 'ALL'
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    if (!selected && sorted[0]) setSelected(sorted[0].name);
  }, [selected, sorted]);
  useEffect(() => setConfirm(null), [selected]);

  const active = auditLogs.filter((l) => l.status === 'ACTIVE');
  const sel = timers.find((t) => t.name === selected);
  const selLevel = levelOf(sel);
  const t = settings.telemetry;

  const reset = (name: string) => {
    if (confirm !== name) return setConfirm(name);
    setConfirm(null);
    name === 'ALL' ? onResetAll() : onResetZone(name);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader title="Zones & alerts" subtitle={`${bed.bedNumber} · ${bed.patientName} · Braden ${bed.bradenScore}`}>
        {!connected && <SampleBadge />}
        <Button onClick={onOpenProtocol} title="How often patients are turned">
          Every {settings.protocol.cadenceMin} min
        </Button>
        <Button onClick={onOpenThresholds}>Limits</Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        <Card className="lg:col-span-5 anim-rise" title="Body map" action={<button onClick={() => setShowHow((v) => !v)} className="font-label-mono-sm underline">{showHow ? 'hide' : 'how it works'}</button>}>
          <div className="collapse mb-1" data-open={showHow}>
            <div>
              <p className="text-[11px] text-[#3f4947] leading-snug pb-2">
                A timer counts while the highest cell in that area is at or above {t.loadedMmHg} mmHg and counts down {t.recoveryFactor}× faster while relieved. Elevated from{' '}
                {Math.round(t.elevatedRatio * 100)}% of the limit, near limit from {Math.round(t.nearLimitRatio * 100)}%. All values are placeholders.
              </p>
            </div>
          </div>
          {timers.length === 0 ? (
            <EmptyState title="No zone timers yet">They start with the first frame from this bed's mat.</EmptyState>
          ) : (
            <BodyFigure timers={timers} selected={selected} onSelect={setSelected} />
          )}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 font-label-mono-sm">
            {(['ok', 'elevated', 'near', 'over'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border-[2px] border-[#121c1b]" style={{ background: FILL[k] }} />
                {LABEL[k]}
              </span>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-7 flex flex-col gap-3.5 sm:gap-4">
          {sel && (
            <section key={sel.name} className="bg-white border-[2.5px] border-[#121c1b] shadow-[4px_4px_0px_rgba(18,28,27,0.85)] anim-pop">
              <StripHeader n={SPOTS.findIndex((s) => s.name === sel.name) + 1} label={sel.name} right={<Chip tone={selLevel === 'ok' ? 'mint' : selLevel === 'elevated' ? 'terracotta' : 'carmine'}>{LABEL[selLevel]}</Chip>} />
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="font-label-mono-sm text-[#3f4947] uppercase">Loaded for</div>
                    <div className="text-4xl font-bold tracking-tight leading-none">
                      {sel.elapsedMin}
                      <span className="text-base font-semibold text-[#3f4947]"> / {sel.limitMin} min</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-label-mono-sm text-[#3f4947] uppercase">{selLevel === 'over' ? 'Over by' : 'Left'}</div>
                    <div className={`text-2xl font-bold ${selLevel === 'near' || selLevel === 'over' ? 'text-[#8b2635]' : 'text-[#1d635d]'}`}>
                      {Math.abs(sel.limitMin - sel.elapsedMin)} min
                    </div>
                  </div>
                </div>
                <div className="h-4 bg-[#ebf6f4] border-[2px] border-[#121c1b]">
                  <div className={`h-full ${BAR[selLevel]} bar-fill ${selLevel === 'near' || selLevel === 'over' ? 'bar-shine' : ''}`} style={{ width: `${Math.min(100, ratio(sel) * 100)}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#3f4947]">Resetting also tells the mat to clear its alarm.</span>
                  <Button tone={confirm === sel.name ? 'carmine' : 'teal'} onClick={() => reset(sel.name)}>
                    {confirm === sel.name ? 'Tap again to confirm' : 'Area offloaded'}
                  </Button>
                </div>
              </div>
            </section>
          )}

          <Card
            title="All zones"
            action={
              sorted.length > 0 && (
                <button onClick={() => reset('ALL')} className={`font-label-mono-sm underline ${confirm === 'ALL' ? 'text-[#8b2635]' : ''}`}>
                  {confirm === 'ALL' ? 'tap again: reset all' : 'reset all'}
                </button>
              )
            }
          >
            <ul className="flex flex-col gap-1 anim-stagger">
              {sorted.map((z, i) => {
                const lv = levelOf(z);
                const isSel = z.name === selected;
                return (
                  <li key={z.name} style={{ '--i': i } as React.CSSProperties}>
                    <button
                      onClick={() => setSelected(z.name)}
                      aria-pressed={isSel}
                      className={`w-full grid grid-cols-[12px_1fr_auto] items-center gap-2 px-2 py-1.5 border-[2px] text-left transition-colors ${
                        isSel ? 'border-[#121c1b] bg-[#ebf6f4]' : 'border-transparent hover:border-[#121c1b]/30'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border-[2px] border-[#121c1b]" style={{ background: FILL[lv] }} />
                      <span className="min-w-0">
                        <span className="block font-label-mono-sm truncate">{z.name}</span>
                        <span className="block h-1.5 bg-[#ebf6f4] border border-[#121c1b]/40 mt-0.5">
                          <span className={`block h-full ${BAR[lv]} bar-fill`} style={{ width: `${Math.min(100, ratio(z) * 100)}%` }} />
                        </span>
                      </span>
                      <span className="font-label-mono-sm whitespace-nowrap">
                        {z.elapsedMin}/{z.limitMin}m
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card className={active.length ? '!border-[#8b2635]' : ''}>
        <Disclosure
          open={alertsOpen}
          onToggle={() => setAlertsOpen((v) => !v)}
          summary={
            <span className="flex items-center gap-2 font-bold">
              <span className="w-3.5 h-3.5 bg-[#8b2635]" />
              Active alerts, whole ward
              <Chip tone={active.length ? 'carmine' : 'mint'} className={active.length ? 'animate-pulse' : ''}>
                {active.length}
              </Chip>
            </span>
          }
        >
          <div className="pt-3">
            {active.length === 0 ? (
              <EmptyState title="No active alerts" />
            ) : (
              <ul className="flex flex-col gap-2">
                {active.map((a) => (
                  <li key={a.id} className="border-[2px] border-[#8b2635] bg-[#fbebeb] p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between anim-rise">
                    <div className="min-w-0 font-label-mono-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone="carmine">{a.zoneCategory}</Chip>
                        <span>{a.bedUnit}</span>
                        <span className="text-[#3f4947] font-normal">{a.timestamp}</span>
                        {a.acknowledgedAt && <Chip tone="parchment">ACK · {a.acknowledgedBy}</Chip>}
                      </div>
                      <div className="mt-1 truncate font-normal">
                        peak {a.peakMmHg} mmHg · {a.dwellMin} min · {a.patientName}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!a.acknowledgedAt && <Button onClick={() => onAlertAction(a.id, 'acknowledge')}>Acknowledge</Button>}
                      <Button tone="teal" onClick={() => onAlertAction(a.id, 'resolve')}>
                        Resolve
                      </Button>
                    </div>
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
