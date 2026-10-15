import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { config } from './config';
import { INITIAL_AUDIT_LOGS, INITIAL_BEDS, INITIAL_PIEZO_CELLS } from '../src/data/mockData';
import { AuditLog, Bed, BedEvent, Broadcast, HardwareLog, MatState, SettingModel } from './models';
import { DEFAULT_SETTINGS } from './lib/settings';

// Minutes from "now" until each mock bed's next turn is due. Chosen so the derived statuses
// match the mock data at seeding time (due now, overdue, pre-alert, ...). Time then moves on.
const DUE_IN_MIN: Record<string, number> = {
  'bed-101': -0.3,
  'bed-102': 45,
  'bed-103': 72,
  'bed-104': -5.23,
  'bed-105': 70,
  'bed-106': 12,
  'bed-107': 58,
  'bed-108': 32,
};
const OFF_BED_MIN: Record<string, number> = { 'bed-103': 72 };

// Zone timers as shown on the UI's Zones page (names must match server/lib/zones.ts).
const BED_07_TIMERS = [
  { name: 'SACRUM & COCCYX', elapsedMin: 112, limitMin: 120 },
  { name: 'HEELS (CALCANEUS)', elapsedMin: 42, limitMin: 90 },
  { name: 'LEFT TROCHANTER (HIP)', elapsedMin: 78, limitMin: 120 },
  { name: 'SHOULDERS (SCAPULAE)', elapsedMin: 35, limitMin: 120 },
  { name: 'RIGHT TROCHANTER (HIP)', elapsedMin: 10, limitMin: 120 },
  { name: 'ELBOWS & OCCIPUT', elapsedMin: 18, limitMin: 120 },
];
// Demo turn history for BED 07 (minutes ago, posture). The last one matches the bed's posture.
const BED_07_HISTORY: [number, string][] = [
  [440, 'SUPINE 0°'],
  [330, 'L-LATERAL 30°'],
  [210, 'SUPINE 0°'],
  [100, 'R-LATERAL 30°'],
];

// The monitor screen in the UI shows BED 07; the mock roster does not have it, so it is added.
const BED_07_MATRIX = [
  [0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, 2, 1, 1, 0, 0],
  [0, 1, 2, 1, 1, 0, 0, 0],
  [0, 2, 3, 3, 2, 1, 0, 0],
  [0, 1, 2, 2, 1, 0, 0, 0],
  [0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 2, 1, 0, 0, 0, 0],
];

/** "07:44:12 EST" or "Yesterday 23:40" to a Date relative to now. Demo data only. */
function parseMockTime(text: string, now: Date): Date {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  const d = new Date(now);
  d.setHours(m ? Number(m[1]) : 0, m ? Number(m[2]) : 0, m?.[3] ? Number(m[3]) : 0, 0);
  if (/yesterday/i.test(text) || d > now) d.setDate(d.getDate() - 1);
  return d;
}

export async function seedDatabase({ reset = true } = {}) {
  const now = new Date();
  if (reset) {
    await Promise.all([
      Bed.deleteMany({}),
      MatState.deleteMany({}),
      AuditLog.deleteMany({}),
      BedEvent.deleteMany({}),
      HardwareLog.deleteMany({}),
      Broadcast.deleteMany({}),
      SettingModel.deleteMany({}),
    ]);
  }
  const cadence = DEFAULT_SETTINGS.protocol.cadenceMin;
  const min = (n: number) => new Date(now.getTime() + n * 60000);

  const beds = INITIAL_BEDS.map((b) => {
    const due = DUE_IN_MIN[b.id] ?? cadence;
    return {
      id: b.id,
      bedNumber: b.bedNumber,
      patientName: b.patientName,
      patientId: b.patientId,
      pod: b.pod,
      bradenScore: b.bradenScore,
      bradenRisk: b.bradenRisk,
      posture: b.posture,
      pressureLabel: b.pressureLabel,
      peakPressure: b.peakPressure,
      offBedSince: OFF_BED_MIN[b.id] ? min(-OFF_BED_MIN[b.id]) : null,
      assignedRn: b.assignedRn,
      nextTurnDueAt: min(due),
      lastTurnAt: min(due - cadence),
      deviceId: '',
      sensorMini: b.sensorMini.flat(),
    };
  });
  beds.push({
    id: 'bed-07',
    bedNumber: 'BED 07',
    patientName: 'H. Berg',
    patientId: '#PT-44091',
    pod: 'POD-3',
    bradenScore: 11,
    bradenRisk: 'Severe',
    posture: 'R-LATERAL 30°',
    pressureLabel: 'SACRAL LOAD',
    peakPressure: 41,
    offBedSince: null,
    assignedRn: 'RN K. Nygård',
    nextTurnDueAt: min(20),
    lastTurnAt: min(20 - cadence),
    deviceId: 'mat01',
    sensorMini: BED_07_MATRIX.flat(),
  });
  await Bed.insertMany(beds);

  await MatState.insertMany(
    beds.map((b) => ({
      bedId: b.id,
      cells: INITIAL_PIEZO_CELLS.map((c) => ({ ...c })),
      matrix: b.sensorMini,
      zoneTimers: b.id === 'bed-07' ? BED_07_TIMERS : [],
    })),
  );

  await BedEvent.insertMany(
    BED_07_HISTORY.map(([ago, posture]) => ({
      bedId: 'bed-07',
      at: min(-ago),
      kind: 'turn',
      posture,
      note: 'Seed data',
      rn: 'RN K. Nygård',
    })),
  );

  await AuditLog.insertMany(
    INITIAL_AUDIT_LOGS.map((l) => ({
      id: l.id,
      at: parseMockTime(l.timestamp, now),
      bedId: /BED\s*(\d+)/i.exec(l.bedUnit) ? `bed-${/BED\s*(\d+)/i.exec(l.bedUnit)![1].padStart(2, '0')}` : 'unknown',
      bedUnit: l.bedUnit,
      patientId: l.patientId,
      patientName: l.patientName,
      zoneLocus: l.zoneLocus,
      zoneCategory: l.zoneCategory,
      peakMmHg: l.peakMmHg,
      dwellMin: l.dwellMin,
      actionTaken: l.actionTaken,
      attendingRn: l.attendingRn,
      status: l.status,
    })),
  );

  await SettingModel.create({ key: 'ward', value: DEFAULT_SETTINGS });
  return { beds: beds.length, auditLogs: INITIAL_AUDIT_LOGS.length };
}

// npm run seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mongoose.connect(config.mongoUri);
  const result = await seedDatabase();
  console.log(`Seeded ${result.beds} beds and ${result.auditLogs} audit log entries into ${config.mongoUri}`);
  await mongoose.disconnect();
}
