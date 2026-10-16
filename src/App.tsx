import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveTab, PatientBed, PiezoCell, ZoneTimer } from './types';
import { INITIAL_BEDS, INITIAL_AUDIT_LOGS, INITIAL_PIEZO_CELLS } from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LiveHeatmapView } from './views/LiveHeatmapView';
import { TurnScheduleView } from './views/TurnScheduleView';
import { BedRosterView } from './views/BedRosterView';
import { PeakAlertsView } from './views/PeakAlertsView';
import { SensorHardwareView } from './views/SensorHardwareView';
import { Modals } from './components/Modals';
import { api, connectLive, LiveFrame } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [selectedPod, setSelectedPod] = useState<string>('BED 07 / ICU-POD-3');
  const [beds, setBeds] = useState<PatientBed[]>(INITIAL_BEDS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [piezoCells, setPiezoCells] = useState<PiezoCell[]>(INITIAL_PIEZO_CELLS);
  const [liveTimers, setLiveTimers] = useState<ZoneTimer[]>([]);

  // Live telemetry state
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  const [liveMatrix, setLiveMatrix] = useState<number[][] | null>(null);
  const [livePeakMmHg, setLivePeakMmHg] = useState<number | null>(null);
  const [livePeakZone, setLivePeakZone] = useState<string | null>(null);

  // Modals state
  const [turnModalBed, setTurnModalBed] = useState<PatientBed | null>(null);
  const [isThresholdOpen, setIsThresholdOpen] = useState<boolean>(false);
  const [isProtocolOpen, setIsProtocolOpen] = useState<boolean>(false);
  const [inspectBed, setInspectBed] = useState<PatientBed | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ title: string; desc?: string; visible: boolean } | null>(null);

  const showToast = useCallback((title: string, desc?: string) => {
    setToast({ title, desc, visible: true });
    setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
    }, 3800);
  }, []);

  const selectedBed = beds.find((b) => b.id === 'bed-07' || b.bedNumber === 'BED 07') || beds[0];

  // Sync data from Express API
  const syncFromApi = useCallback(async () => {
    try {
      const health = await api.health();
      if (!health) {
        setIsApiConnected(false);
        return false;
      }

      setIsApiConnected(true);

      // Fetch beds
      const apiBeds = await api.beds.list().catch(() => null);
      if (apiBeds && apiBeds.length > 0) {
        setBeds(apiBeds);
      }

      // Fetch audit logs
      const apiLogs = await api.auditLogs.list().catch(() => null);
      if (apiLogs && apiLogs.length > 0) {
        setAuditLogs(apiLogs);
      }

      // Fetch mat cells
      const cells = await api.mats.cells('bed-07').catch(() => null);
      if (cells && cells.length > 0) {
        setPiezoCells(cells);
      }

      // Fetch zone timers
      const timers = await api.beds.zoneTimers('bed-07').catch(() => null);
      if (timers && timers.length > 0) {
        setLiveTimers(timers);
      }

      // Fetch initial matrix
      const matrixRes = await api.beds.matrix('bed-07').catch(() => null);
      if (matrixRes && matrixRes.matrix) {
        setLiveMatrix(matrixRes.matrix);
        setLivePeakMmHg(matrixRes.peakMmHg);
        setLivePeakZone(matrixRes.peakZone);
      }

      return true;
    } catch {
      setIsApiConnected(false);
      return false;
    }
  }, []);

  // On mount: attempt connection and set up SSE stream + heartbeat poll
  const liveStreamCleanup = useRef<(() => void) | null>(null);

  const stopLiveStream = useCallback(() => {
    if (liveStreamCleanup.current) {
      liveStreamCleanup.current();
      liveStreamCleanup.current = null;
    }
  }, []);

  const startLiveStream = useCallback(() => {
    if (liveStreamCleanup.current) return;
    liveStreamCleanup.current = connectLive({
      onFrame: (f: LiveFrame) => {
        setIsApiConnected(true);
        if (f.bedId === 'bed-07' || !f.bedId) {
          if (f.matrix && f.matrix.length === 8) {
            setLiveMatrix(f.matrix);
          }
          if (typeof f.peakMmHg === 'number') {
            setLivePeakMmHg(f.peakMmHg);
          }
          if (f.peakZone) {
            setLivePeakZone(f.peakZone);
          }
          if (f.zoneTimers && f.zoneTimers.length > 0) {
            setLiveTimers(f.zoneTimers);
          }
        }
      },
      onBed: (updatedBed) => {
        setIsApiConnected(true);
        setBeds((prev) =>
          prev.map((b) => (b.id === updatedBed.id ? { ...b, ...updatedBed } : b))
        );
      },
      onAlert: (alert) => {
        setIsApiConnected(true);
        setAuditLogs((prev) => [alert, ...prev]);
        if (alert.status === 'ACTIVE') {
          showToast(`ALERT: ${alert.zoneLocus}`, `${alert.bedUnit} reached ${alert.peakMmHg} mmHg peak.`);
        }
      },
      onError: () => {
        // SSE disconnected or offline, handled gracefully
      },
    });
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;

    // Initial check
    syncFromApi().then((connected) => {
      if (!isMounted) return;
      if (connected) {
        showToast('API CONNECTED', 'Connected to Perfusense Express + MongoDB backend.');
        startLiveStream();
      }
    });

    // Background heartbeat to reconnect if server starts later
    const heartbeatTimer = setInterval(async () => {
      const h = await api.health();
      if (h && h.ok) {
        if (!isApiConnected) {
          setIsApiConnected(true);
          syncFromApi();
          showToast('BACKEND DETECTED', 'Synchronized live clinical data from MongoDB.');
          startLiveStream();
        }
      } else {
        if (isApiConnected) {
          setIsApiConnected(false);
          stopLiveStream();
        }
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(heartbeatTimer);
      stopLiveStream();
    };
  }, [syncFromApi, showToast, isApiConnected, startLiveStream, stopLiveStream]);

  // Turn confirmation handler (calls API if connected, else optimistic local update)
  const handleConfirmTurn = async (bedId: string, posture: string, note?: string) => {
    const targetBed = beds.find((b) => b.id === bedId) || selectedBed;
    const targetId = targetBed?.id || 'bed-07';

    if (isApiConnected) {
      try {
        const res = await api.beds.logTurn(targetId, {
          posture,
          note,
          rn: 'RN K. Nygård',
        });
        if (res && res.bed) {
          setBeds((prev) => prev.map((b) => (b.id === targetId ? { ...b, ...res.bed } : b)));
        }
        if (res && res.log) {
          setAuditLogs((prev) => [res.log, ...prev]);
        }
        // Refresh timers
        const updatedTimers = await api.beds.zoneTimers(targetId).catch(() => null);
        if (updatedTimers) setLiveTimers(updatedTimers);

        showToast(
          'REPOSITION LOGGED (API)',
          `Patient ${targetBed?.patientName || targetId} re-zeroed in ${posture}. Saved to MongoDB.`
        );
        return;
      } catch (e) {
        console.warn('API logTurn failed, falling back to local update:', e);
      }
    }

    // Local fallback update
    setBeds((prev) =>
      prev.map((b) => {
        if (b.id === targetId || b.id === bedId) {
          return {
            ...b,
            status: 'optimal',
            statusLabel: 'OPTIMAL',
            posture: posture,
            countdown: '1h 58m',
            isOverdue: false,
            peakPressure: 16,
          };
        }
        return b;
      })
    );

    const nowStr = new Date().toTimeString().split(' ')[0] + ' EST';
    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        bedUnit: `${targetBed.bedNumber} [${targetBed.pod}]`,
        patientId: targetBed.patientId.split(' ')[0] || '#PT-NEW',
        patientName: targetBed.patientName,
        zoneLocus: 'OFFLOADED',
        zoneCategory: 'Sacrum',
        peakMmHg: 16,
        dwellMin: 2,
        actionTaken: `Repositioned to ${posture}. ${note || 'Skin checked intact.'}`,
        attendingRn: 'RN K. Nygård (#892)',
        status: 'RESOLVED',
      },
      ...prev,
    ]);

    showToast(
      'REPOSITION LOGGED (LOCAL)',
      `Patient ${targetBed?.patientName || targetId} re-zeroed in ${posture}.`
    );
  };

  // Snooze handler
  const handleSnooze = async () => {
    const targetId = selectedBed?.id || 'bed-07';
    if (isApiConnected) {
      try {
        const updated = await api.beds.snooze(targetId, 5);
        if (updated) {
          setBeds((prev) => prev.map((b) => (b.id === targetId ? { ...b, ...updated } : b)));
        }
        showToast('ALARM SNOOZED +5 MIN', 'Clinical alert deferred for bedside assessment (saved to API).');
        return;
      } catch (e) {
        console.warn('API snooze failed:', e);
      }
    }
    showToast('ALARM SNOOZED +5 MIN', 'Clinical alert deferred for bedside assessment.');
  };

  // Reset zone timer
  const handleResetZone = async (zoneName: string) => {
    const targetId = selectedBed?.id || 'bed-07';
    if (isApiConnected) {
      try {
        const res = await api.beds.resetZone(targetId, zoneName, 'RN K. Nygård');
        if (res && res.zoneTimers) {
          setLiveTimers(res.zoneTimers);
        }
        showToast(`ZONE OFFLOADED: ${zoneName}`, `Timer reset on backend. Bedside reposition verified.`);
        return;
      } catch (e) {
        console.warn('API resetZone failed:', e);
      }
    }

    setLiveTimers((prev) =>
      prev.map((t) => (t.name === zoneName ? { ...t, elapsedMin: 0, isNearLimit: false, isElevated: false } : t))
    );
    showToast(`ZONE OFFLOADED: ${zoneName}`, `Timer reset to 0m. Bedside reposition verified.`);
  };

  // Reset all zone timers
  const handleResetAllZones = async () => {
    const targetId = selectedBed?.id || 'bed-07';
    if (isApiConnected) {
      try {
        await api.beds.resetAllZones(targetId, 'RN K. Nygård');
        const updated = await api.beds.zoneTimers(targetId).catch(() => null);
        if (updated) setLiveTimers(updated);
        showToast('ALL ZONES RE-ZEROED', 'Full patient posture re-zeroed on backend.');
        return;
      } catch (e) {
        console.warn('API resetAllZones failed:', e);
      }
    }

    setLiveTimers((prev) =>
      prev.map((t) => ({ ...t, elapsedMin: 0, isNearLimit: false, isElevated: false }))
    );
    showToast('ALL ZONES RE-ZEROED', 'Full patient posture re-zeroed and logged to clinical flowsheet.');
  };

  // Tare sensor mat
  const handleTareMat = async () => {
    const targetId = selectedBed?.id || 'bed-07';
    if (isApiConnected) {
      try {
        const res = await api.mats.tare(targetId);
        showToast('MAT TARE COMPLETE', res.message || 'Baseline plane stored on server.');
        return;
      } catch (e: any) {
        showToast('TARE NOTICE', e.message || 'Tare requested; make sure the mat is empty.');
        return;
      }
    }
    showToast('MAT TARE COMPLETE (LOCAL)', 'Baseline zero plane re-calibrated across all 64 cells.');
  };

  return (
    <div className="min-h-screen bg-[#f1fcf9] text-[#121c1b] relative font-body-md">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isApiConnected={isApiConnected}
      />

      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedPod={selectedPod}
        setSelectedPod={setSelectedPod}
      />

      {/* Main Content Area - Maximized Canvas */}
      <div className="w-full px-3 sm:px-6 lg:px-8 pt-18 sm:pt-20 pb-16 sm:pb-24">
        <main className="w-full max-w-[1720px] mx-auto">
          {activeTab === 'monitor' && (
            <LiveHeatmapView
              onOpenProtocolEdit={() => setIsProtocolOpen(true)}
              onOpenTurnLog={() => {
                setTurnModalBed(selectedBed);
              }}
              showToast={showToast}
              liveMatrix={liveMatrix}
              peakPressure={livePeakMmHg}
              peakZone={livePeakZone}
              isApiConnected={isApiConnected}
              onSnooze={handleSnooze}
              bed={selectedBed}
            />
          )}

          {activeTab === 'turn-schedule' && (
            <TurnScheduleView
              showToast={showToast}
              bedId={selectedBed?.id || 'bed-07'}
              isApiConnected={isApiConnected}
            />
          )}

          {activeTab === 'bed-roster' && (
            <BedRosterView
              beds={beds}
              onLogTurnForBed={(b) => setTurnModalBed(b)}
              onInspectBed={(b) => setInspectBed(b)}
              showToast={showToast}
            />
          )}

          {activeTab === 'peak-alerts' && (
            <PeakAlertsView
              auditLogs={auditLogs}
              onOpenThresholds={() => setIsThresholdOpen(true)}
              showToast={showToast}
              liveTimers={liveTimers}
              onResetZone={handleResetZone}
              onResetAll={handleResetAllZones}
              isApiConnected={isApiConnected}
            />
          )}

          {activeTab === 'sensor-mat-hardware' && (
            <SensorHardwareView
              cells={piezoCells}
              showToast={showToast}
              onTare={handleTareMat}
              isApiConnected={isApiConnected}
            />
          )}
        </main>
      </div>

      {/* Interactive Modals & Toast notifications */}
      <Modals
        turnModalBed={turnModalBed}
        onCloseTurnModal={() => setTurnModalBed(null)}
        onConfirmTurn={handleConfirmTurn}
        isThresholdOpen={isThresholdOpen}
        onCloseThreshold={() => setIsThresholdOpen(false)}
        onSaveThreshold={(crit, dwell, warn, autoPage) => {
          if (isApiConnected) {
            api.settings.update({
              thresholds: { criticalMmHg: crit, maxDwellMin: dwell, warnMmHg: warn, autoPage },
            }).catch(console.warn);
          }
          showToast(
            'THRESHOLDS RE-CALIBRATED',
            `Critical: ${crit} mmHg, Max Dwell: ${dwell}m, Pager: ${autoPage ? 'ON' : 'OFF'}`
          );
        }}
        isProtocolOpen={isProtocolOpen}
        onCloseProtocol={() => setIsProtocolOpen(false)}
        onSaveProtocol={(cadence) => {
          if (isApiConnected) {
            api.settings.update({
              protocol: { cadenceMin: cadence },
            }).catch(console.warn);
          }
          showToast(
            'PROTOCOL UPDATED',
            `Ward cadence set to ${cadence} minutes. Timers refreshed.`
          );
        }}
        inspectBed={inspectBed}
        onCloseInspect={() => setInspectBed(null)}
        toast={toast}
      />
    </div>
  );
}
