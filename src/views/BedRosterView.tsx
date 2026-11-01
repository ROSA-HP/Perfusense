import React, { useEffect, useMemo, useState } from 'react';
import { PatientBed } from '../types';
import { levelToMmHg, pressureStyle } from '../utils/heatmapColors';
import { Chip, EmptyState, PageHeader, SampleBadge } from '../components/ui';

interface BedRosterViewProps {
  beds: (PatientBed & { nextTurnDueAt?: string | null; matFresh?: boolean })[];
  monitoredId: string;
  connected: boolean;
  cadenceMin: number;
  onMonitor: (bedId: string) => void;
  onLogTurnForBed: (bed: PatientBed) => void;
  onInspectBed: (bed: PatientBed) => void;
}

type Filter = 'all' | 'turn' | 'risk' | 'off';

// Lower = more urgent. Used for the default sort and the summary strip.
const URGENCY: Record<PatientBed['status'], number> = { overdue: 0, due_now: 1, pre_alert: 2, elevated: 3, optimal: 4, stable: 5, ambulating: 6 };
const STATUS_TONE: Record<PatientBed['status'], { bar: string; chip: 'carmine' | 'terracotta' | 'mint' | 'parchment' }> = {
  overdue: { bar: 'bg-[#8b2635]', chip: 'carmine' },
  due_now: { bar: 'bg-[#8b2635]', chip: 'carmine' },
  pre_alert: { bar: 'bg-[#d97757]', chip: 'terracotta' },
  elevated: { bar: 'bg-[#d97757]', chip: 'terracotta' },
  optimal: { bar: 'bg-[#1d635d]', chip: 'mint' },
  stable: { bar: 'bg-[#1d635d]', chip: 'mint' },
  ambulating: { bar: 'bg-[#a3cfc9]', chip: 'parchment' },
};
const SUMMARY: { label: string; statuses: PatientBed['status'][]; tone: string }[] = [
  { label: 'Overdue / due', statuses: ['overdue', 'due_now'], tone: 'bg-[#8b2635] text-white' },
  { label: 'Due soon / high load', statuses: ['pre_alert', 'elevated'], tone: 'bg-[#d97757] text-white' },
  { label: 'On schedule', statuses: ['optimal', 'stable'], tone: 'bg-[#adefe7] text-[#00201d]' },
  { label: 'Out of bed', statuses: ['ambulating'], tone: 'bg-[#ede8dc] text-[#121c1b]' },
];

function turnProgress(bed: BedRosterViewProps['beds'][number], cadenceMin: number, now: number): number {
  if (bed.status === 'overdue' || bed.status === 'due_now') return 100;
  if (!bed.nextTurnDueAt) return bed.status === 'pre_alert' ? 90 : 50;
  const remaining = (new Date(bed.nextTurnDueAt).getTime() - now) / 60000;
  return Math.max(0, Math.min(100, Math.round((1 - remaining / cadenceMin) * 100)));
}

function MiniMap({ levels }: { levels: number[][] }) {
  const n = levels.length || 10;
  return (
    <div className="grid gap-px bg-[#121c1b] border-[2px] border-[#121c1b] w-[72px] h-[72px] shrink-0" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden>
      {levels.flat().map((lvl, i) => (
        <span key={i} style={{ background: pressureStyle(levelToMmHg(lvl)).bg }} />
      ))}
    </div>
  );
}

export const BedRosterView: React.FC<BedRosterViewProps> = ({ beds, monitoredId, connected, cadenceMin, onMonitor, onLogTurnForBed, onInspectBed }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'urgency' | 'bed'>('urgency');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const needsTurn = (b: PatientBed) => b.status === 'overdue' || b.status === 'due_now' || b.status === 'pre_alert';
  const highRisk = (b: PatientBed) => b.bradenScore <= 12;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return beds
      .filter((b) => (filter === 'turn' ? needsTurn(b) : filter === 'risk' ? highRisk(b) : filter === 'off' ? b.status === 'ambulating' : true))
      .filter((b) => !q || [b.bedNumber, b.patientName, b.patientId, b.pod, b.assignedRn].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'urgency' ? URGENCY[a.status] - URGENCY[b.status] || a.bradenScore - b.bradenScore : a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true })));
  }, [beds, filter, query, sort]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: beds.length },
    { id: 'turn', label: 'Needs turn', count: beds.filter(needsTurn).length },
    { id: 'risk', label: 'Braden ≤ 12', count: beds.filter(highRisk).length },
    { id: 'off', label: 'Out of bed', count: beds.filter((b) => b.status === 'ambulating').length },
  ];

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full">
      <PageHeader title="Beds" subtitle="Most urgent first. Tap MONITOR to open a bed on the live map.">
        {!connected && <SampleBadge />}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bed, patient, RN…"
          aria-label="Search beds"
          className="bg-white border-[2px] border-[#121c1b] px-2 py-1.5 text-xs w-full sm:w-56 outline-none focus:shadow-[2px_2px_0px_#121c1b]"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'urgency' | 'bed')} aria-label="Sort beds" className="bg-white border-[2px] border-[#121c1b] px-2 py-1.5 text-xs font-bold">
          <option value="urgency">Sort: urgency</option>
          <option value="bed">Sort: bed number</option>
        </select>
      </PageHeader>

      {/* Ward summary: also acts as a legend for the card colours */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SUMMARY.map((s) => (
          <div key={s.label} className={`${s.tone} border-[2px] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] px-3 py-2 flex items-center justify-between`}>
            <span className="font-label-mono-sm text-[10px] uppercase font-bold">{s.label}</span>
            <span className="text-xl font-bold">{beds.filter((b) => s.statuses.includes(b.status)).length}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter beds">
        {filters.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 border-[2px] border-[#121c1b] font-label-mono-sm text-[11px] font-bold uppercase neo-btn ${
              filter === f.id ? 'bg-[#121c1b] text-white shadow-[2px_2px_0px_#1d635d]' : 'bg-white hover:bg-[#ebf6f4]'
            }`}
          >
            {f.label} · {f.count}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No beds match">Change the filter or the search.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {shown.map((bed) => {
            const tone = STATUS_TONE[bed.status];
            const urgent = bed.status === 'overdue' || bed.status === 'due_now';
            const monitored = bed.id === monitoredId;
            const progress = turnProgress(bed, cadenceMin, now);
            const peak = pressureStyle(bed.peakPressure);
            return (
              <article
                key={bed.id}
                className={`bg-white border-[3px] ${urgent ? 'border-[#8b2635]' : 'border-[#121c1b]'} shadow-[3px_3px_0px_#121c1b] flex flex-col ${monitored ? 'ring-[3px] ring-[#1d635d] ring-offset-2 ring-offset-[#f1fcf9]' : ''}`}
              >
                <div className={`${tone.bar} h-2 border-b-[2px] border-[#121c1b]`} />
                <div className="p-3 flex flex-col gap-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base uppercase">{bed.bedNumber}</span>
                        {monitored && <Chip tone="teal">Monitoring</Chip>}
                      </div>
                      <div className="font-bold text-sm truncate">{bed.patientName}</div>
                      <div className="font-label-mono-sm text-[10px] text-[#3f4947] truncate">
                        {bed.pod} · {bed.assignedRn || 'no RN'}
                      </div>
                    </div>
                    <Chip tone={tone.chip} className={urgent ? 'animate-pulse' : ''}>
                      {bed.statusLabel}
                    </Chip>
                  </div>

                  <div className="flex gap-3 items-center">
                    <MiniMap levels={bed.sensorMini} />
                    <dl className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 font-label-mono-sm text-[10px] min-w-0">
                      <dt className="text-[#3f4947]">Braden</dt>
                      <dd className={`font-bold text-right ${bed.bradenScore <= 12 ? 'text-[#8b2635]' : ''}`}>
                        {bed.bradenScore} · {bed.bradenRisk}
                      </dd>
                      <dt className="text-[#3f4947]">Peak</dt>
                      <dd className="font-bold text-right">
                        <span className="inline-block w-2 h-2 border border-[#121c1b] mr-1 align-middle" style={{ background: peak.bg }} />
                        {bed.peakPressure} mmHg
                      </dd>
                      <dt className="text-[#3f4947]">Position</dt>
                      <dd className="font-bold text-right truncate" title={bed.posture}>
                        {bed.posture}
                      </dd>
                      <dt className="text-[#3f4947]">Last turn</dt>
                      <dd className="font-bold text-right">{bed.lastTurnTime}</dd>
                    </dl>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline font-label-mono-sm text-[10px] font-bold mb-0.5">
                      <span className="text-[#3f4947]">{bed.status === 'ambulating' ? 'OUT OF BED FOR' : 'NEXT TURN'}</span>
                      <span className={`text-sm ${urgent ? 'text-[#8b2635]' : ''}`}>{bed.countdown}</span>
                    </div>
                    {bed.status !== 'ambulating' && (
                      <div className="h-2.5 bg-[#ebf6f4] border-[2px] border-[#121c1b]" title={`${progress}% of the ${cadenceMin}-minute turn window used`}>
                        <div className={`h-full ${tone.bar} transition-all`} style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 border-t-[2px] border-[#121c1b]">
                  <button onClick={() => onMonitor(bed.id)} className="py-2.5 font-label-mono-sm text-[11px] font-bold uppercase hover:bg-[#adefe7] border-r-[2px] border-[#121c1b]">
                    Monitor
                  </button>
                  <button
                    onClick={() => onLogTurnForBed(bed)}
                    className={`py-2.5 font-label-mono-sm text-[11px] font-bold uppercase border-r-[2px] border-[#121c1b] ${urgent ? 'bg-[#8b2635] text-white hover:bg-[#6c1c28]' : 'hover:bg-[#ebf6f4]'}`}
                  >
                    Log turn
                  </button>
                  <button onClick={() => onInspectBed(bed)} className="py-2.5 font-label-mono-sm text-[11px] font-bold uppercase hover:bg-[#ebf6f4]">
                    Details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
