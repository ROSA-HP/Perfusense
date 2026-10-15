import type { AuditLogItem, PatientBed, ZoneTimer } from '../../src/types';
import { auditTimestamp, fmtOverdue, fmtRemaining, shortClock } from '../lib/format';
import type { Settings } from '../lib/settings';
import { categoryForCellZone, chunk8 } from '../lib/zones';
import { config } from '../config';

// The UI's PatientBed plus a few extras the UI can use or ignore.
export type BedView = PatientBed & {
  age?: number;
  deviceId: string;
  snoozed: boolean;
  matFresh: boolean;
  nextTurnDueAt: string | null;
};

export function isFresh(lastFrameAt: Date | null | undefined, settings: Settings, now: Date): boolean {
  return !!lastFrameAt && now.getTime() - new Date(lastFrameAt).getTime() <= settings.telemetry.staleSec * 1000;
}

export function zoneTimerView(
  t: { name: string; elapsedMin: number; limitMin: number },
  settings: Settings,
): ZoneTimer {
  const ratio = t.limitMin > 0 ? t.elapsedMin / t.limitMin : 0;
  const near = ratio >= settings.telemetry.nearLimitRatio;
  return {
    name: t.name,
    elapsedMin: Math.round(t.elapsedMin),
    limitMin: t.limitMin,
    ...(near ? { isNearLimit: true } : {}),
    ...(!near && ratio >= settings.telemetry.elevatedRatio ? { isElevated: true } : {}),
  };
}

/**
 * Builds the bed as the UI expects it. Status rules (all thresholds come from settings):
 *   off the bed ............ AMBULATING
 *   past the due time ...... DUE NOW (first minute) then OVERDUE
 *   within preAlertMin ..... PRE-ALERT
 *   peak at/above elevated . ELEVATED
 *   otherwise .............. STABLE for low Braden risk, OPTIMAL for the rest
 * A snooze pushes the effective due time out.
 */
export function bedView(bed: any, mat: any | null, settings: Settings, now: Date): BedView {
  const fresh = isFresh(mat?.lastFrameAt, settings, now);
  const peak = fresh ? Math.round(mat.peakMmHg) : Math.round(bed.peakPressure ?? 0);
  const flat: number[] | undefined = fresh && mat?.matrix?.length === 64 ? mat.matrix : bed.sensorMini?.length === 64 ? bed.sensorMini : undefined;
  const matrix: number[][] = flat ? chunk8([...flat]) : emptyMatrix();

  let pressureLabel: string = bed.pressureLabel || 'PEAK LOAD';
  if (fresh && mat.peakZone) {
    const cat = categoryForCellZone(mat.peakZone);
    pressureLabel = cat ? `${cat.toUpperCase()} LOAD` : `${mat.peakZone} LOAD`;
  }

  const snoozed = !!bed.snoozedUntil && new Date(bed.snoozedUntil) > now;
  const due = bed.nextTurnDueAt ? new Date(bed.nextTurnDueAt) : null;
  const effectiveDue = due && snoozed ? new Date(Math.max(due.getTime(), new Date(bed.snoozedUntil).getTime())) : due;

  let status: PatientBed['status'];
  let statusLabel: string;
  let countdown = '--';
  let isOverdue = false;
  let offloadDuration: string | undefined;

  if (bed.offBedSince) {
    const offMin = (now.getTime() - new Date(bed.offBedSince).getTime()) / 60000;
    status = 'ambulating';
    statusLabel = 'AMBULATING';
    countdown = fmtRemaining(offMin);
    offloadDuration = fmtRemaining(offMin);
  } else if (!effectiveDue) {
    status = 'stable';
    statusLabel = 'NO SCHEDULE';
  } else {
    const remainingSec = (effectiveDue.getTime() - now.getTime()) / 1000;
    if (remainingSec <= 0) {
      const overdueSec = -remainingSec;
      isOverdue = true;
      if (overdueSec < 60) {
        status = 'due_now';
        statusLabel = 'DUE NOW';
        countdown = '00:00';
      } else {
        status = 'overdue';
        statusLabel = `+${Math.floor(overdueSec / 60)}M OVERDUE`;
        countdown = fmtOverdue(overdueSec);
      }
    } else {
      countdown = fmtRemaining(remainingSec / 60);
      if (remainingSec / 60 <= settings.protocol.preAlertMin) {
        status = 'pre_alert';
        statusLabel = 'PRE-ALERT';
      } else if (peak >= settings.telemetry.elevatedMmHg) {
        status = 'elevated';
        statusLabel = 'ELEVATED';
      } else if (bed.bradenRisk === 'Low') {
        status = 'stable';
        statusLabel = 'STABLE';
      } else {
        status = 'optimal';
        statusLabel = 'OPTIMAL';
      }
    }
  }

  return {
    id: bed.id,
    bedNumber: bed.bedNumber,
    patientName: bed.patientName,
    patientId: bed.patientId,
    pod: bed.pod,
    bradenScore: bed.bradenScore,
    bradenRisk: bed.bradenRisk,
    posture: bed.posture,
    status,
    statusLabel,
    peakPressure: peak,
    pressureLabel,
    countdown,
    isOverdue,
    ...(offloadDuration ? { offloadDuration } : {}),
    sensorMini: matrix,
    assignedRn: bed.assignedRn,
    lastTurnTime: bed.lastTurnAt ? shortClock(new Date(bed.lastTurnAt), config.wardTz) : '--:--',
    ...(bed.age != null ? { age: bed.age } : {}),
    deviceId: bed.deviceId ?? '',
    snoozed,
    matFresh: fresh,
    nextTurnDueAt: effectiveDue ? effectiveDue.toISOString() : null,
  };
}

export function emptyMatrix(): number[][] {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

/** The audit log row in the shape the UI's AuditLogItem expects, plus extra fields. */
export function auditItem(doc: any, now: Date): AuditLogItem & {
  at: string;
  bedId: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string;
  reAlertAt: string | null;
} {
  return {
    id: doc.id,
    timestamp: auditTimestamp(new Date(doc.at), now, config.wardTz),
    bedUnit: doc.bedUnit,
    patientId: doc.patientId,
    patientName: doc.patientName,
    zoneLocus: doc.zoneLocus,
    zoneCategory: doc.zoneCategory,
    peakMmHg: doc.peakMmHg,
    dwellMin: doc.dwellMin,
    actionTaken: doc.actionTaken,
    attendingRn: doc.attendingRn,
    status: doc.status,
    at: new Date(doc.at).toISOString(),
    bedId: doc.bedId,
    acknowledgedAt: doc.acknowledgedAt ? new Date(doc.acknowledgedAt).toISOString() : null,
    acknowledgedBy: doc.acknowledgedBy ?? '',
    reAlertAt: doc.reAlertAt ? new Date(doc.reAlertAt).toISOString() : null,
  };
}
