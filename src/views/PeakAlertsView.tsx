import React, { useState } from 'react';
import { AuditLogItem, PatientBed, ZoneTimer } from '../types';
import type { Settings } from '../api/client';
import { Button, Card, Chip, EmptyState, PageHeader, SampleBadge } from '../components/ui';
import { TimerBar } from './LiveHeatmapView';

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

const ratio = (t: ZoneTimer) => t.elapsedMin / (t.limitMin || 1);
const level = (t?: ZoneTimer) => (!t ? 'none' : t.elapsedMin >= t.limitMin ? 'over' : t.isNearLimit ? 'near' : t.isElevated ? 'elevated' : 'ok');
const FILL: Record<string, string> = { none: '#ffffff', ok: '#a3cfc9', elevated: '#d97757', near: '#8b2635', over: '#4a1028' };
const LABEL: Record<string, string> = { none: 'NO DATA', ok: 'OK', elevated: 'ELEVATED', near: 'NEAR LIMIT', over: 'OVER LIMIT' };

// Body seen from above, head at the top (same orientation as the heatmap).
const BODY_ZONES: { name: string; shapes: { cx: number; cy: number; rx: number; ry: number }[] }[] = [
  { name: 'ELBOWS & OCCIPUT', shapes: [{ cx: 100, cy: 26, rx: 16, ry: 12 }, { cx: 44, cy: 128, rx: 10, ry: 10 }, { cx: 156, cy: 128, rx: 10, ry: 10 }] },
  { name: 'SHOULDERS (SCAPULAE)', shapes: [{ cx: 74, cy: 82, rx: 20, ry: 13 }, { cx: 126, cy: 82, rx: 20, ry: 13 }] },
  { name: 'LEFT TROCHANTER (HIP)', shapes: [{ cx: 66, cy: 178, rx: 13, ry: 16 }] },
  { name: 'RIGHT TROCHANTER (HIP)', shapes: [{ cx: 134, cy: 178, rx: 13, ry: 16 }] },
  { name: 'SACRUM & COCCYX', shapes: [{ cx: 100, cy: 182, rx: 18, ry: 16 }] },
  { name: 'HEELS (CALCANEUS)', shapes: [{ cx: 84, cy: 322, rx: 9, ry: 10 }, { cx: 116, cy: 322, rx: 9, ry: 10 }] },
];

function BodyMap({ timers, focus, onFocus }: { timers: ZoneTimer[]; focus: string | null; onFocus: (n: string) => void }) {
  return (
    <svg viewBox="0 0 200 345" className="w-full max-w-[220px] mx-auto" role="img" aria-label="Body map coloured by zone timer status">
      {/* silhouette */}
      <g fill="#ebf6f4" stroke="#121c1b" strokeWidth="2.5">
        <ellipse cx="100" cy="28" rx="20" ry="22" />
        <rect x="60" y="56" width="80" height="140" rx="22" />
        <rect x="34" y="66" width="20" height="96" rx="10" />
        <rect x="146" y="66" width="20" height="96" rx="10" />
        <rect x="68" y="188" width="28" height="140" rx="12" />
        <rect x="104" y="188" width="28" height="140" rx="12" />
      </g>
      {BODY_ZONES.map((z) => {
        const t = timers.find((x) => x.name === z.name);
        const lv = level(t);
        return (
          <g key={z.name} onClick={() => onFocus(z.name)} className="cursor-pointer" aria-label={`${z.name}: ${LABEL[lv]}`}>
            {z.shapes.map((s, i) => (
              <ellipse
                key={i}
                {...s}
                fill={FILL[lv]}
                stroke="#121c1b"
                strokeWidth={focus === z.name ? 4 : 2}
                className={lv === 'near' || lv === 'over' ? 'animate-pulse' : ''}
              />
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
  const [focus, setFocus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // zone name, or 'ALL'
  const [showResolved, setShowResolved] = useState(false);

  const sorted = [...timers].sort((a, b) => ratio(b) - ratio(a));
  const active = auditLogs.filter((l) => l.status === 'ACTIVE');
  const resolved = auditLogs.filter((l) => l.status === 'RESOLVED').slice(0, 15);
  const t = settings.telemetry;

  const reset = (name: string) => {
    if (confirm !== name) return setConfirm(name);
    setConfirm(null);
    name === 'ALL' ? onResetAll() : onResetZone(name);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader title="Zones & alerts" subtitle={`${bed.bedNumber} · ${bed.patientName} · Braden ${bed.bradenScore} (${bed.bradenRisk})`}>
        {!connected && <SampleBadge />}
        <Button onClick={onOpenProtocol} title="How often patients are turned">
          Cadence: {settings.protocol.cadenceMin} min
        </Button>
        <Button onClick={onOpenThresholds}>Alert limits</Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* Body map + legend */}
        <Card className="lg:col-span-4 flex flex-col gap-3">
          <h2 className="font-bold uppercase text-sm pb-2 border-b-[2px] border-[#121c1b]">Body map</h2>
          <BodyMap timers={timers} focus={focus} onFocus={setFocus} />
          <div className="grid grid-cols-2 gap-1 font-label-mono-sm text-[10px]">
            {(['ok', 'elevated', 'near', 'over'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="w-3 h-3 border-[2px] border-[#121c1b]" style={{ background: FILL[k] }} />
                {LABEL[k]}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[#3f4947] leading-snug">
            A timer counts while the highest cell in that area is at or above {t.loadedMmHg} mmHg, and counts down {t.recoveryFactor}× faster while it is relieved.
            “Elevated” starts at {Math.round(t.elevatedRatio * 100)}% of the limit, “near limit” at {Math.round(t.nearLimitRatio * 100)}%. All values are placeholders.
          </p>
        </Card>

        {/* Timers */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {sorted.length === 0 ? (
            <EmptyState title="No zone timers yet">They start with the first frame from this bed's mat.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sorted.map((z) => {
                const lv = level(z);
                const remaining = Math.max(0, z.limitMin - z.elapsedMin);
                return (
                  <Card
                    key={z.name}
                    className={`flex flex-col gap-2 transition-shadow ${focus === z.name ? '!shadow-[5px_5px_0px_#1d635d]' : ''} ${lv === 'near' || lv === 'over' ? '!border-[#8b2635]' : ''}`}
                  >
                    <button className="text-left" onClick={() => setFocus(z.name)}>
                      <TimerBar t={z} />
                    </button>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#121c1b]/20">
                      <span className="font-label-mono-sm text-[10px] text-[#3f4947]">{lv === 'over' ? `${z.elapsedMin - z.limitMin} min over` : `${remaining} min left`}</span>
                      <Button tone={confirm === z.name ? 'carmine' : 'white'} onClick={() => reset(z.name)} className="!min-h-[34px] !py-1">
                        {confirm === z.name ? 'Tap again to reset' : 'Area offloaded'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          {sorted.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border-[2px] border-[#121c1b] p-2.5">
              <span className="text-[11px] text-[#3f4947]">Resetting a zone also sends “ack” to the mat, which clears its local alarm.</span>
              <Button tone={confirm === 'ALL' ? 'carmine' : 'teal'} onClick={() => reset('ALL')}>
                {confirm === 'ALL' ? 'Tap again: reset all' : `Reset all ${sorted.length} zones`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-[2px] border-[#121c1b]">
          <h2 className="font-bold uppercase text-sm">Active alerts · whole ward ({active.length})</h2>
          <button onClick={() => setShowResolved((v) => !v)} className="font-label-mono-sm text-[10px] font-bold underline">
            {showResolved ? 'Hide resolved' : `Show resolved (${resolved.length})`}
          </button>
        </div>
        {active.length === 0 ? (
          <EmptyState title="No active alerts" />
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((a) => (
              <li key={a.id} className="border-[2px] border-[#8b2635] bg-[#fff5f3] p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="min-w-0 font-label-mono-sm text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="carmine">{a.zoneCategory}</Chip>
                    <span className="font-bold">{a.bedUnit}</span>
                    <span className="text-[#3f4947]">{a.timestamp}</span>
                    {a.acknowledgedAt && <Chip tone="parchment">ACK · {a.acknowledgedBy}</Chip>}
                  </div>
                  <div className="mt-1 truncate">
                    {a.zoneLocus} · peak {a.peakMmHg} mmHg · {a.dwellMin} min · {a.patientName}
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
        {showResolved && (
          <ul className="divide-y divide-[#121c1b]/20 mt-1">
            {resolved.map((a) => (
              <li key={a.id} className="py-1.5 font-label-mono-sm text-[11px] flex flex-wrap gap-2">
                <span className="text-[#3f4947]">{a.timestamp}</span>
                <span className="font-bold">{a.bedUnit}</span>
                <span>{a.zoneLocus}</span>
                <span className="text-[#3f4947] truncate">{a.actionTaken}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
