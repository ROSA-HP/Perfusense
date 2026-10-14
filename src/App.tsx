import React, { useState } from 'react';
import { ActiveTab, PatientBed } from './types';
import { INITIAL_BEDS, INITIAL_AUDIT_LOGS, INITIAL_PIEZO_CELLS } from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LiveHeatmapView } from './views/LiveHeatmapView';
import { TurnScheduleView } from './views/TurnScheduleView';
import { BedRosterView } from './views/BedRosterView';
import { PeakAlertsView } from './views/PeakAlertsView';
import { SensorHardwareView } from './views/SensorHardwareView';
import { Modals } from './components/Modals';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [selectedPod, setSelectedPod] = useState<string>('BED 07 / ICU-POD-3');
  const [beds, setBeds] = useState<PatientBed[]>(INITIAL_BEDS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [piezoCells] = useState(INITIAL_PIEZO_CELLS);

  // Modals state
  const [turnModalBed, setTurnModalBed] = useState<PatientBed | null>(null);
  const [isThresholdOpen, setIsThresholdOpen] = useState<boolean>(false);
  const [isProtocolOpen, setIsProtocolOpen] = useState<boolean>(false);
  const [inspectBed, setInspectBed] = useState<PatientBed | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ title: string; desc?: string; visible: boolean } | null>(null);

  const showToast = (title: string, desc?: string) => {
    setToast({ title, desc, visible: true });
    setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
    }, 3800);
  };

  const handleConfirmTurn = (bedId: string, posture: string, note?: string) => {
    setBeds((prev) =>
      prev.map((b) => {
        if (b.id === bedId) {
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

    // Add entry to audit log
    const bed = beds.find((b) => b.id === bedId);
    if (bed) {
      const nowStr = new Date().toTimeString().split(' ')[0] + ' EST';
      setAuditLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: nowStr,
          bedUnit: `${bed.bedNumber} [${bed.pod}]`,
          patientId: bed.patientId.split(' ')[0] || '#PT-NEW',
          patientName: bed.patientName,
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
    }

    showToast(
      'REPOSITION LOGGED TO EHR',
      `Patient ${bed?.patientName || bedId} re-zeroed in ${posture}.`
    );
  };

  return (
    <div className="min-h-screen bg-[#f1fcf9] text-[#121c1b] relative font-body-md">
      {/* Top Header with live marquee */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        heatingUpAlert={true}
      />

      {/* Fixed Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedPod={selectedPod}
        setSelectedPod={setSelectedPod}
      />

      {/* Main Content Area - Maximized Canvas */}
      <div className="w-full px-3 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 sm:pb-24">
        <main className="w-full max-w-[1720px] mx-auto">
          {activeTab === 'monitor' && (
            <LiveHeatmapView
              onOpenProtocolEdit={() => setIsProtocolOpen(true)}
              onOpenTurnLog={() => {
                const bed7 = beds.find((b) => b.bedNumber === 'BED 101') || beds[0];
                setTurnModalBed(bed7);
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'turn-schedule' && (
            <TurnScheduleView showToast={showToast} />
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
            />
          )}

          {activeTab === 'sensor-mat-hardware' && (
            <SensorHardwareView
              cells={piezoCells}
              showToast={showToast}
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
          showToast(
            'THRESHOLDS RE-CALIBRATED',
            `Critical: ${crit} mmHg, Max Dwell: ${dwell}m, Pager: ${autoPage ? 'ON' : 'OFF'}`
          );
        }}
        isProtocolOpen={isProtocolOpen}
        onCloseProtocol={() => setIsProtocolOpen(false)}
        onSaveProtocol={(cadence) => {
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
