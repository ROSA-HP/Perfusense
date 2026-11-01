import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveTab, AuditLogItem, PatientBed, PiezoCell, ZoneTimer } from './types';
import { INITIAL_AUDIT_LOGS, INITIAL_BEDS, INITIAL_PIEZO_CELLS, INITIAL_ZONE_TIMERS, SAMPLE_SETTINGS } from './data/mockData';
import { Header } from './components/Header';
import { LiveHeatmapView } from './views/LiveHeatmapView';
import { TurnScheduleView } from './views/TurnScheduleView';
import { BedRosterView } from './views/BedRosterView';
import { PeakAlertsView } from './views/PeakAlertsView';
import { SensorHardwareView } from './views/SensorHardwareView';
import { Modals, ToastState } from './components/Modals';
import { api, connectLive, LiveFrame, Settings } from './api/client';
import { setPressureScale } from './utils/heatmapColors';
import { Icon } from './components/ui';

const HEALTH_EVERY_MS = 15_000; // reconnect check
const ROSTER_EVERY_MS = 30_000; // countdowns are computed on the server, so refresh them

export type MatView = {
  matrix: number[][]; // mmHg per cell
  peakMmHg: number;
  peakZone: string;
  fresh: boolean; // frames arriving from the mat
  lastFrameAt: string | null;
};

const SAMPLE_MAT: MatView = (() => {
  const loads = INITIAL_PIEZO_CELLS.map((c) => c.load);
  const peak = Math.max(...loads);
  return {
    matrix: Array.from({ length: 10 }, (_, r) => loads.slice(r * 10, r * 10 + 10)),
    peakMmHg: peak,
    peakZone: INITIAL_PIEZO_CELLS[loads.indexOf(peak)].zone,
    fresh: false,
    lastFrameAt: null,
  };
})();

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);

  const [monitoredId, setMonitoredId] = useState('bed-07');
  const [beds, setBeds] = useState<PatientBed[]>(INITIAL_BEDS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(INITIAL_AUDIT_LOGS);
  const [cells, setCells] = useState<PiezoCell[]>(INITIAL_PIEZO_CELLS);
  const [timers, setTimers] = useState<ZoneTimer[]>(INITIAL_ZONE_TIMERS);
  const [mat, setMat] = useState<MatView>(SAMPLE_MAT);
  const [settings, setSettings] = useState<Settings>(SAMPLE_SETTINGS);

  const [turnModalBed, setTurnModalBed] = useState<PatientBed | null>(null);
  const [isThresholdOpen, setIsThresholdOpen] = useState(false);
  const [isProtocolOpen, setIsProtocolOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((title: string, desc?: string, tone: ToastState['tone'] = 'ok') => {
    window.clearTimeout(toastTimer.current);
    setToast({ title, desc, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 6000 : 3800);
  }, []);
  const showError = useCallback((what: string, e: unknown) => showToast(what, (e as Error)?.message || 'Request failed', 'error'), [showToast]);

  const monitoredBed = beds.find((b) => b.id === monitoredId) ?? beds[0];
  const monitoredRef = useRef(monitoredId);
  monitoredRef.current = monitoredId;

  useEffect(() => setPressureScale(settings.telemetry.levelMmHg), [settings]);

  // ---- loading from the API ----------------------------------------------------------------
  const loadBedDetail = useCallback(async (bedId: string) => {
    const [c, t, m] = await Promise.all([api.mats.cells(bedId), api.beds.zoneTimers(bedId), api.beds.matrix(bedId)]);
    if (monitoredRef.current !== bedId) return; // the user switched beds meanwhile
    setCells(c);
    setTimers(t);
    setMat({ matrix: m.matrix, peakMmHg: m.peakMmHg, peakZone: m.peakZone, fresh: m.fresh, lastFrameAt: m.lastFrameAt });
  }, []);

  const loadAll = useCallback(async () => {
    // When connected, the API is the only source: an empty list stays empty (no mock fill-in).
    const [b, logs, s] = await Promise.all([api.beds.list(), api.auditLogs.list(), api.settings.get()]);
    setBeds(b);
    setAuditLogs(logs);
    setSettings(s);
    const id = b.some((x) => x.id === monitoredRef.current) ? monitoredRef.current : b[0]?.id;
    if (id) {
      if (id !== monitoredRef.current) setMonitoredId(id);
      monitoredRef.current = id;
      await loadBedDetail(id);
    }
  }, [loadBedDetail]);

  const goOffline = useCallback(() => {
    connectedRef.current = false;
    setConnected(false);
    setBeds(INITIAL_BEDS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCells(INITIAL_PIEZO_CELLS);
    setTimers(INITIAL_ZONE_TIMERS);
    setMat(SAMPLE_MAT);
    setSettings(SAMPLE_SETTINGS);
  }, []);

  // ---- connection: health check, live stream, roster refresh ---------------------------------
  useEffect(() => {
    let stopStream: (() => void) | null = null;
    let cancelled = false;

    const startStream = () => {
      if (stopStream) return;
      stopStream = connectLive({
        onFrame: (f: LiveFrame) => {
          if (f.bedId !== monitoredRef.current) return;
          if (Array.isArray(f.matrix) && f.matrix.length > 0) {
            setMat({ matrix: f.matrix, peakMmHg: f.peakMmHg, peakZone: f.peakZone, fresh: true, lastFrameAt: f.at });
          }
          if (f.zoneTimers?.length) setTimers(f.zoneTimers);
        },
        onBed: (updated) => setBeds((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))),
        onAlert: (alert) => {
          setAuditLogs((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
          if (alert.status === 'ACTIVE') showToast(`ALERT: ${alert.zoneLocus}`, `${alert.bedUnit}: peak ${alert.peakMmHg} mmHg`, 'alert');
        },
      });
    };

    const check = async () => {
      const h = await api.health();
      if (cancelled) return;
      if (h?.ok && !connectedRef.current) {
        try {
          await loadAll();
          connectedRef.current = true;
          setConnected(true);
          startStream();
        } catch (e) {
          showError('COULD NOT LOAD DATA', e);
        }
      } else if (!h?.ok && connectedRef.current) {
        stopStream?.();
        stopStream = null;
        goOffline();
        showToast('BACKEND OFFLINE', 'Showing SAMPLE DATA until the API is back.', 'error');
      }
    };

    void check();
    const health = window.setInterval(check, HEALTH_EVERY_MS);
    const roster = window.setInterval(() => {
      if (connectedRef.current) api.beds.list().then(setBeds).catch(() => undefined);
    }, ROSTER_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearInterval(health);
      window.clearInterval(roster);
      stopStream?.();
    };
  }, [loadAll, goOffline, showToast, showError]);

  // Switching the monitored bed reloads its detail.
  const monitorBed = useCallback(
    (bedId: string) => {
      setMonitoredId(bedId);
      monitoredRef.current = bedId;
      setActiveTab('monitor');
      if (connectedRef.current) loadBedDetail(bedId).catch((e) => showError('COULD NOT LOAD BED', e));
    },
    [loadBedDetail, showError],
  );

  // ---- actions (API when connected; sample-only otherwise) -------------------------------------
  const sampleNote = 'SAMPLE DATA: not saved (backend offline).';

  const handleConfirmTurn = async (bedId: string, posture: string, note?: string, skinChecks?: boolean[]) => {
    const bed = beds.find((b) => b.id === bedId);
    if (connectedRef.current) {
      try {
        const res = await api.beds.logTurn(bedId, { posture, note, skinChecks });
        setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, ...res.bed } : b)));
        setAuditLogs((prev) => [res.log, ...prev.map((l) => (l.status === 'ACTIVE' && l.bedUnit === res.log.bedUnit ? { ...l, status: 'RESOLVED' as const } : l))]);
        if (bedId === monitoredRef.current) await loadBedDetail(bedId);
        showToast('TURN LOGGED', `${bed?.bedNumber ?? bedId}: ${posture}. Timers reset; the mat clears its alarm on its next frame.`);
      } catch (e) {
        showError('TURN NOT SAVED', e);
      }
      return;
    }
    setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, posture, status: 'optimal', statusLabel: 'OPTIMAL', isOverdue: false } : b)));
    if (bedId === monitoredId) setTimers((prev) => prev.map((t) => ({ ...t, elapsedMin: 0, isNearLimit: false, isElevated: false })));
    showToast('TURN LOGGED', sampleNote);
  };

  const handleSnooze = async () => {
    if (!monitoredBed) return;
    if (!connectedRef.current) return showToast('SNOOZED 5 MIN', sampleNote);
    try {
      const updated = await api.beds.snooze(monitoredBed.id, 5);
      setBeds((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      showToast('SNOOZED 5 MIN', `${monitoredBed.bedNumber}: turn reminder moved 5 minutes.`);
    } catch (e) {
      showError('SNOOZE FAILED', e);
    }
  };

  const handleResetZone = async (zoneName: string) => {
    if (!connectedRef.current) {
      setTimers((prev) => prev.map((t) => (t.name === zoneName ? { ...t, elapsedMin: 0, isNearLimit: false, isElevated: false } : t)));
      return showToast(`ZONE RESET: ${zoneName}`, sampleNote);
    }
    try {
      const res = await api.beds.resetZone(monitoredId, zoneName);
      setTimers(await api.beds.zoneTimers(monitoredId));
      if (res.resolvedAlerts) setAuditLogs(await api.auditLogs.list());
      showToast(`ZONE RESET: ${res.zone}`, res.resolvedAlerts ? `${res.resolvedAlerts} alert(s) resolved.` : 'Timer back to 0.');
    } catch (e) {
      showError('RESET FAILED', e);
    }
  };

  const handleResetAllZones = async () => {
    if (!connectedRef.current) {
      setTimers((prev) => prev.map((t) => ({ ...t, elapsedMin: 0, isNearLimit: false, isElevated: false })));
      return showToast('ALL ZONES RESET', sampleNote);
    }
    try {
      const res = await api.beds.resetAllZones(monitoredId);
      setTimers(await api.beds.zoneTimers(monitoredId));
      setAuditLogs(await api.auditLogs.list());
      showToast('ALL ZONES RESET', `${res.resolvedAlerts} alert(s) resolved.`);
    } catch (e) {
      showError('RESET FAILED', e);
    }
  };

  const handleAlertAction = async (id: string, action: 'acknowledge' | 'resolve') => {
    if (!connectedRef.current) {
      setAuditLogs((prev) => prev.map((l) => (l.id === id && action === 'resolve' ? { ...l, status: 'RESOLVED' } : l)));
      return showToast(action === 'resolve' ? 'ALERT RESOLVED' : 'ALERT ACKNOWLEDGED', sampleNote);
    }
    try {
      const rn = monitoredBed?.assignedRn || 'Ward RN';
      const row = action === 'resolve' ? await api.auditLogs.resolve(id, 'Resolved from the Zones page', rn) : await api.auditLogs.acknowledge(id, rn);
      setAuditLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...row } : l)));
      showToast(action === 'resolve' ? 'ALERT RESOLVED' : 'ALERT ACKNOWLEDGED', row.zoneLocus);
    } catch (e) {
      showError('ALERT UPDATE FAILED', e);
    }
  };

  const handleTareMat = async () => {
    if (!connectedRef.current) return showToast('TARE', sampleNote);
    try {
      const res = await api.mats.tare(monitoredId);
      showToast('TARE APPLIED', res.message);
    } catch (e) {
      showError('TARE REFUSED', e);
    }
  };

  const handleSelfTest = async () => {
    if (!connectedRef.current) {
      showToast('SELF-TEST', sampleNote);
      return null;
    }
    try {
      return await api.mats.selfTest(monitoredId);
    } catch (e) {
      showError('SELF-TEST FAILED', e);
      return null;
    }
  };

  const saveSettings = async (patch: Parameters<typeof api.settings.update>[0], label: string) => {
    if (!connectedRef.current) return showToast(label, sampleNote);
    try {
      setSettings(await api.settings.update(patch));
      showToast(label, 'Saved on the server.');
      if (patch.protocol || patch.zoneLimitsMin) setBeds(await api.beds.list());
    } catch (e) {
      showError('SETTINGS NOT SAVED', e);
    }
  };

  const activeAlerts = useMemo(() => auditLogs.filter((l) => l.status === 'ACTIVE').length, [auditLogs]);
  const dueBeds = useMemo(() => beds.filter((b) => b.status === 'due_now' || b.status === 'overdue').length, [beds]);
  const nearZones = timers.filter((t) => t.isNearLimit).length;

  const tabs: { id: ActiveTab; label: string; icon: React.ComponentProps<typeof Icon>['name']; badge?: number; urgent?: boolean }[] = [
    { id: 'monitor', label: 'Monitor', icon: 'monitor' },
    { id: 'bed-roster', label: 'Beds', icon: 'beds', badge: dueBeds || undefined, urgent: dueBeds > 0 },
    { id: 'peak-alerts', label: 'Zones', icon: 'zones', badge: activeAlerts + nearZones || undefined, urgent: activeAlerts > 0 },
    { id: 'turn-schedule', label: 'History', icon: 'history' },
    { id: 'sensor-mat-hardware', label: 'Mat', icon: 'mat' },
  ];

  return (
    <div className="min-h-screen bg-[#f1fcf9] text-[#121c1b] font-body-md overflow-x-hidden">
      <Header tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} connected={connected} bed={monitoredBed} matFresh={mat.fresh} />

      {!connected && (
        <div className="fixed top-14 sm:top-16 left-0 right-0 z-40 bg-[#d97757] text-white border-b-[3px] border-[#121c1b] px-3 py-1 text-center font-label-mono-sm text-[10px] sm:text-[11px] font-bold uppercase">
          SAMPLE DATA: backend offline. Run <code className="bg-[#121c1b] px-1">npm run dev:all</code> with MongoDB for live data.
        </div>
      )}

      <div className={`w-full px-2.5 sm:px-6 lg:px-8 ${connected ? 'pt-16 sm:pt-20' : 'pt-24 sm:pt-28'} pb-20 md:pb-12`}>
        {/* key = tab: each page change replays a short rise-in */}
        <main key={activeTab} className="w-full max-w-[1500px] mx-auto anim-rise">
          {activeTab === 'monitor' && monitoredBed && (
            <LiveHeatmapView
              bed={monitoredBed}
              mat={mat}
              timers={timers}
              settings={settings}
              connected={connected}
              onLogTurn={() => setTurnModalBed(monitoredBed)}
              onSnooze={handleSnooze}
              onOpenZones={() => setActiveTab('peak-alerts')}
            />
          )}
          {activeTab === 'bed-roster' && (
            <BedRosterView
              beds={beds}
              monitoredId={monitoredBed?.id ?? monitoredId}
              connected={connected}
              cadenceMin={settings.protocol.cadenceMin}
              onMonitor={monitorBed}
              onLogTurnForBed={(b) => setTurnModalBed(b)}
            />
          )}
          {activeTab === 'peak-alerts' && monitoredBed && (
            <PeakAlertsView
              bed={monitoredBed}
              timers={timers}
              auditLogs={auditLogs}
              settings={settings}
              connected={connected}
              onOpenThresholds={() => setIsThresholdOpen(true)}
              onOpenProtocol={() => setIsProtocolOpen(true)}
              onResetZone={handleResetZone}
              onResetAll={handleResetAllZones}
              onAlertAction={handleAlertAction}
            />
          )}
          {activeTab === 'turn-schedule' && monitoredBed && <TurnScheduleView bed={monitoredBed} connected={connected} settings={settings} />}
          {activeTab === 'sensor-mat-hardware' && monitoredBed && (
            <SensorHardwareView bed={monitoredBed} cells={cells} mat={mat} connected={connected} onTare={handleTareMat} onSelfTest={handleSelfTest} />
          )}
        </main>
      </div>

      {/* Phone navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-[3px] border-[#121c1b] flex items-stretch h-16 md:hidden">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative ${active ? 'text-[#121c1b]' : 'text-[#3f4947]'}`}
            >
              <span
                className={`w-10 h-7 flex items-center justify-center border-[2px] transition-all duration-200 ${
                  active ? 'bg-[#adefe7] border-[#121c1b] shadow-[2px_2px_0px_#121c1b] -translate-y-0.5' : 'border-transparent'
                }`}
              >
                <Icon name={t.icon} />
              </span>
              <span className="text-[10px] font-bold uppercase leading-none">{t.label}</span>
              {t.badge ? (
                <span className={`absolute top-1 right-[18%] text-[9px] px-1 border border-[#121c1b] font-bold leading-tight ${t.urgent ? 'bg-[#8b2635] text-white' : 'bg-[#121c1b] text-white'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <Modals
        settings={settings}
        turnModalBed={turnModalBed}
        onCloseTurnModal={() => setTurnModalBed(null)}
        onConfirmTurn={handleConfirmTurn}
        isThresholdOpen={isThresholdOpen}
        onCloseThreshold={() => setIsThresholdOpen(false)}
        onSaveThreshold={(thresholds, levelMmHg) =>
          // One pressure scale: the sensor-map bands follow the heatmap bands.
          saveSettings(
            { thresholds, telemetry: { levelMmHg, cellWarnMmHg: levelMmHg[1], cellCriticalMmHg: levelMmHg[2] } },
            'LIMITS SAVED',
          )
        }
        isProtocolOpen={isProtocolOpen}
        onCloseProtocol={() => setIsProtocolOpen(false)}
        onSaveProtocol={(cadenceMin) => saveSettings({ protocol: { cadenceMin } }, 'TURN CADENCE SAVED')}
        toast={toast}
        onDismissToast={() => setToast(null)}
      />
    </div>
  );
}
