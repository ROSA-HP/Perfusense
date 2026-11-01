import React, { useEffect, useMemo, useState } from 'react';
import { PatientBed } from '../types';
import { levelToMmHg, pressureStyle } from '../utils/heatmapColors';
import { Button, EmptyState, PageHeader, SampleBadge, StripHeader } from '../components/ui';

interface BedRosterViewProps {
  beds: (PatientBed & { nextTurnDueAt?: string | null })[];
  monitoredId: string;
  connected: boolean;
  cadenceMin: number;
  onMonitor: (bedId: string) => void;
  onLogTurnForBed: (bed: PatientBed) => void;
}

type Group = 'all' | 'due' | 'soon' | 'ok' | 'off';

// Lower = more urgent. Used for the default sort.
const URGENCY: Record<PatientBed['status'], number> = { overdue: 0, due_now: 1, pre_alert: 2, elevated: 3, optimal: 4, stable: 5, ambulating: 6 };
const GROUP_OF: Record<PatientBed['status'], Exclude<Group, 'all'>> = {
  overdue: 'due',
  due_now: 'due',
  pre_alert: 'soon',
  elevated: 'soon',
  optimal: 'ok',
  stable: 'ok',
  ambulating: 'off',
};
// The summary tiles are also the filters (one control instead of two rows).
const GROUPS: { id: Exclude<Group, 'all'>; label: string; tone: string; pill: string; bar: string }[] = [
  { id: 'due', label: 'Turn now', tone: 'bg-[#8b2635] text-white', pill: 'bg-[#8b2635] text-white', bar: 'bg-[#8b2635]' },
  { id: 'soon', label: 'Due soon / high load', tone: 'bg-[#d97757] text-white', pill: 'bg-[#d97757] text-white', bar: 'bg-[#d97757]' },
  { id: 'ok', label: 'On schedule', tone: 'bg-[#adefe7] text-[#00201d]', pill: 'bg-[#adefe7] text-[#00201d]', bar: 'bg-[#1d635d]' },
  { id: 'off', label: 'Out of bed', tone: 'bg-[#ede8dc] text-[#121c1b]', pill: 'bg-[#ede8dc] text-[#121c1b]', bar: 'bg-[#a3cfc9]' },
];
const groupStyle = (s: PatientBed['status']) => GROUPS.find((g) => g.id === GROUP_OF[s])!;

function turnProgress(bed: BedRosterViewProps['beds'][number], cadenceMin: number, now: number): number {
  if (bed.status === 'overdue' || bed.status === 'due_now') return 100;
  if (!bed.nextTurnDueAt) return bed.status === 'pre_alert' ? 90 : 50;
  const remaining = (new Date(bed.nextTurnDueAt).getTime() - now) / 60000;
  return Math.max(0, Math.min(100, Math.round((1 - remaining / cadenceMin) * 100)));
}

function MiniMap({ levels }: { levels: number[][] }) {
  const n = levels.length || 10;
  return (
    <div className="grid gap-px bg-[#121c1b] border-[2px] border-[#121c1b] w-[96px] h-[96px] shrink-0" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden>
      {levels.flat().map((lvl, i) => (
        <span key={i} style={{ background: pressureStyle(levelToMmHg(lvl)).bg }} />
      ))}
    </div>
  );
}

export const BedRosterView: React.FC<BedRosterViewProps> = ({ beds, monitoredId, connected, cadenceMin, onMonitor, onLogTurnForBed }) => {
  const [group, setGroup] = useState<Group>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'urgency' | 'bed' | 'braden'>('urgency');
  const [openId, setOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return beds
      .filter((b) => group === 'all' || GROUP_OF[b.status] === group)
      .filter((b) => !q || [b.bedNumber, b.patientName, b.patientId, b.pod, b.assignedRn].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) =>
        sort === 'urgency'
          ? URGENCY[a.status] - URGENCY[b.status] || a.bradenScore - b.bradenScore
          : sort === 'braden'
            ? a.bradenScore - b.bradenScore
            : a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true }),
      );
  }, [beds, group, query, sort]);

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader title="Beds" subtitle="Most urgent first · tap a bed for its details">
        {!connected && <SampleBadge />}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bed, patient, RN…"
          aria-label="Search beds"
          className="bg-[#f1fcf9] border-[2px] border-[#121c1b] px-2 py-1.5 text-xs w-full sm:w-52 outline-none focus:bg-white focus:shadow-[2px_2px_0px_#121c1b] transition-shadow"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort beds"
          className="bg-[#f1fcf9] border-[2px] border-[#121c1b] px-2 py-1.5 font-label-mono-sm uppercase"
        >
          <option value="urgency">Urgency</option>
          <option value="braden">Braden (risk)</option>
          <option value="bed">Bed number</option>
        </select>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="tablist" aria-label="Filter beds by status">
        {GROUPS.map((g) => {
          const count = beds.filter((b) => GROUP_OF[b.status] === g.id).length;
          const active = group === g.id;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={active}
              onClick={() => setGroup(active ? 'all' : g.id)}
              className={`${g.tone} border-[2.5px] border-[#121c1b] px-3 py-2 flex items-center justify-between neo-btn transition-all ${
                active ? 'shadow-[4px_4px_0px_#121c1b] -translate-x-0.5 -translate-y-0.5' : group === 'all' ? '' : 'opacity-55'
              }`}
              title={active ? 'Show all beds' : `Show only: ${g.label}`}
            >
              <span className="font-label-mono-sm uppercase text-left">{g.label}</span>
              <span className="text-2xl font-bold leading-none">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No beds match">Change the filter or the search.</EmptyState>
      ) : (
        <div key={`${group}-${sort}`} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 items-start anim-stagger">
          {shown.map((bed, i) => {
            const g = groupStyle(bed.status);
            const urgent = g.id === 'due';
            const monitored = bed.id === monitoredId;
            const open = openId === bed.id;
            const progress = turnProgress(bed, cadenceMin, now);
            const peak = pressureStyle(bed.peakPressure);
            return (
              <article
                key={bed.id}
                style={{ '--i': i } as React.CSSProperties}
                className={`bg-white border-[2.5px] border-[#121c1b] transition-shadow ${open ? 'shadow-[6px_6px_0px_#1d635d]' : 'shadow-[4px_4px_0px_rgba(18,28,27,0.85)]'} ${
                  monitored ? 'outline outline-[3px] outline-offset-2 outline-[#1d635d]' : ''
                }`}
              >
                <button type="button" onClick={() => setOpenId(open ? null : bed.id)} aria-expanded={open} className="w-full text-left block">
                  <StripHeader n={bed.bedNumber.replace(/\D/g, '') || '•'} label={`${bed.bedNumber} · ${bed.pod}`} right={<span className="chevron font-label-mono-sm">▾</span>} />
                  <div className={`${g.pill} border-b-[2px] border-[#121c1b] text-center font-label-mono-sm uppercase py-0.5 ${urgent ? 'animate-pulse' : ''}`}>
                    {bed.statusLabel}
                    {monitored ? ' · monitoring' : ''}
                  </div>
                  <div className="px-3 pt-2.5 pb-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm truncate">{bed.patientName}</span>
                      <span className={`font-label-mono-md shrink-0 ${urgent ? 'text-[#8b2635]' : ''}`}>{bed.countdown}</span>
                    </div>
                    {bed.status !== 'ambulating' && (
                      <div className="h-2 bg-[#ebf6f4] border-[1.5px] border-[#121c1b] mt-1.5" title={`${progress}% of the ${cadenceMin}-minute turn window used`}>
                        <div className={`h-full ${g.bar} bar-fill ${urgent ? 'bar-shine' : ''}`} style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </button>

                <div className="collapse" data-open={open}>
                  <div>
                    <div className="px-3 pb-3 flex gap-3 items-center border-t border-dashed border-[#121c1b]/40 pt-3">
                      <MiniMap levels={bed.sensorMini} />
                      <dl className="flex-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-label-mono-sm min-w-0">
                        <dt className="text-[#3f4947] font-normal">Braden</dt>
                        <dd className={`text-right ${bed.bradenScore <= 12 ? 'text-[#8b2635]' : ''}`}>
                          {bed.bradenScore} · {bed.bradenRisk}
                        </dd>
                        <dt className="text-[#3f4947] font-normal">Peak</dt>
                        <dd className="text-right">
                          <span className="inline-block w-2 h-2 border border-[#121c1b] mr-1 align-middle" style={{ background: peak.bg }} />
                          {bed.peakPressure} mmHg
                        </dd>
                        <dt className="text-[#3f4947] font-normal">Position</dt>
                        <dd className="text-right truncate" title={bed.posture}>
                          {bed.posture}
                        </dd>
                        <dt className="text-[#3f4947] font-normal">Last turn</dt>
                        <dd className="text-right">{bed.lastTurnTime}</dd>
                        <dt className="text-[#3f4947] font-normal">RN</dt>
                        <dd className="text-right truncate">{bed.assignedRn || '—'}</dd>
                        <dt className="text-[#3f4947] font-normal">Patient ID</dt>
                        <dd className="text-right truncate">{bed.patientId}</dd>
                      </dl>
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      <Button tone={monitored ? 'mint' : 'white'} onClick={() => onMonitor(bed.id)}>
                        {monitored ? 'Open monitor' : 'Monitor'}
                      </Button>
                      <Button tone={urgent ? 'carmine' : 'teal'} onClick={() => onLogTurnForBed(bed)}>
                        Log turn
                      </Button>
                    </div>
                  </div>
                </div>
                {urgent && !open && (
                  <div className="px-3 pb-3 -mt-1">
                    <Button tone="carmine" className="w-full" onClick={() => onLogTurnForBed(bed)}>
                      Log turn
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
