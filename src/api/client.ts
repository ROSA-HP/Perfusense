import type { AuditLogItem, PatientBed, PiezoCell, ZoneTimer } from '../types';

// Empty base = same origin. In development Vite proxies /api to the Express server (vite.config.ts).
const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? res.statusText, data?.details);
  return data as T;
}

// ---- shapes the server adds on top of the UI types -------------------------------------
export type BedView = PatientBed & {
  age?: number;
  deviceId: string;
  snoozed: boolean;
  matFresh: boolean;
  nextTurnDueAt: string | null;
};
export type AuditLogRow = AuditLogItem & {
  at: string;
  bedId: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string;
  reAlertAt: string | null;
};
export type PostureSegment = {
  posture: string;
  group: 'BACK' | 'LEFT' | 'RIGHT' | 'OTHER';
  start: string;
  end: string;
  minutes: number;
};
export type PostureTimeline = {
  from: string;
  to: string;
  coverageStartsAt: string | null;
  segments: PostureSegment[];
  totalsMin: Record<'BACK' | 'LEFT' | 'RIGHT' | 'OTHER', number>;
};
export type Settings = {
  thresholds: { criticalMmHg: number; maxDwellMin: number; warnMmHg: number; autoPage: boolean };
  protocol: { cadenceMin: number; skinEnforce: boolean; preAlertMin: number };
  zoneLimitsMin: Record<string, number>;
  telemetry: Record<string, number | number[]>;
};

// ---- calls -------------------------------------------------------------------------------
export const api = {
  beds: {
    list: (params: { pod?: string; risk?: string; status?: string; q?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
      return request<BedView[]>(`/beds${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<BedView & { zoneTimers: ZoneTimer[] }>(`/beds/${id}`),
    zoneTimers: (id: string) => request<ZoneTimer[]>(`/beds/${id}/zone-timers`),
    matrix: (id: string) =>
      request<{ matrix: number[][]; peakMmHg: number; peakZone: string; lastFrameAt: string | null; fresh: boolean }>(`/beds/${id}/matrix`),
    postureTimeline: (id: string, hours = 8) => request<PostureTimeline>(`/beds/${id}/posture-timeline?hours=${hours}`),
    logTurn: (id: string, body: { posture: string; note?: string; rn?: string; skinChecks?: boolean[] }) =>
      request<{ bed: BedView; resolvedAlerts: number; log: AuditLogRow }>(`/beds/${id}/turns`, { method: 'POST', body }),
    snooze: (id: string, minutes = 5) => request<BedView>(`/beds/${id}/snooze`, { method: 'POST', body: { minutes } }),
    defer: (id: string, minutes = 10, reason?: string) =>
      request<BedView>(`/beds/${id}/defer`, { method: 'POST', body: { minutes, reason } }),
    setOffBed: (id: string, offBed: boolean) => request<BedView>(`/beds/${id}/off-bed`, { method: 'POST', body: { offBed } }),
    resetZone: (id: string, zoneName: string, rn?: string) =>
      request<{ zone: string; resolvedAlerts: number; zoneTimers: ZoneTimer[] }>(
        `/beds/${id}/zones/${encodeURIComponent(zoneName)}/reset`,
        { method: 'POST', body: { rn } },
      ),
    resetAllZones: (id: string, rn?: string) =>
      request<{ ok: boolean; resolvedAlerts: number }>(`/beds/${id}/zones/reset-all`, { method: 'POST', body: { rn } }),
  },
  auditLogs: {
    list: (params: { site?: string; zone?: string; q?: string; status?: string; bedId?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
      return request<AuditLogRow[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
    },
    acknowledge: (id: string, rn: string) => request<AuditLogRow>(`/audit-logs/${id}/acknowledge`, { method: 'POST', body: { rn } }),
    resolve: (id: string, action: string, rn: string) =>
      request<AuditLogRow>(`/audit-logs/${id}/resolve`, { method: 'POST', body: { action, rn } }),
    exportCsvUrl: (bedId?: string) => `${BASE}/api/audit-logs/export.csv${bedId ? `?bedId=${encodeURIComponent(bedId)}` : ''}`,
  },
  mats: {
    cells: (bedId: string) => request<PiezoCell[]>(`/mats/${bedId}/cells`),
    tare: (bedId: string) => request<{ ok: boolean; message: string }>(`/mats/${bedId}/tare`, { method: 'POST' }),
    zeroCell: (bedId: string, cellId: string) => request<{ ok: boolean }>(`/mats/${bedId}/cells/${cellId}/zero`, { method: 'POST' }),
    selfTest: (bedId: string) =>
      request<{ pass: boolean; checks: { name: string; pass: boolean; detail: string }[] }>(`/mats/${bedId}/self-test`, { method: 'POST' }),
  },
  settings: {
    get: () => request<Settings>('/settings'),
    update: (patch: Partial<{ thresholds: Partial<Settings['thresholds']>; protocol: Partial<Settings['protocol']>; zoneLimitsMin: Record<string, number> }>) =>
      request<Settings>('/settings', { method: 'PUT', body: patch }),
  },
  broadcast: (pod: string, message: string, sentBy = '') =>
    request<{ id?: string }>('/broadcasts', { method: 'POST', body: { pod, message, sentBy } }),
};

// ---- live updates -------------------------------------------------------------------------
export type LiveFrame = {
  bedId: string;
  at: string;
  matrix: number[][];
  peakMmHg: number;
  peakZone: string;
  zoneTimers: ZoneTimer[];
};

/** Opens the live stream. Returns a function that closes it. EventSource reconnects by itself. */
export function connectLive(handlers: {
  onFrame?: (f: LiveFrame) => void;
  onBed?: (b: BedView) => void;
  onAlert?: (a: AuditLogRow) => void;
}): () => void {
  const es = new EventSource(`${BASE}/api/stream`);
  const on = <T,>(name: string, fn?: (d: T) => void) => {
    if (fn) es.addEventListener(name, (e) => fn(JSON.parse((e as MessageEvent).data) as T));
  };
  on<LiveFrame>('frame', handlers.onFrame);
  on<BedView>('bed', handlers.onBed);
  on<AuditLogRow>('alert', handlers.onAlert);
  return () => es.close();
}
