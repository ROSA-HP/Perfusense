export type ActiveTab = 'monitor' | 'turn-schedule' | 'bed-roster' | 'peak-alerts' | 'sensor-mat-hardware';

export interface PatientBed {
  id: string;
  bedNumber: string;
  patientName: string;
  patientId: string;
  pod: string;
  bradenScore: number;
  bradenRisk: 'Severe' | 'High' | 'Moderate' | 'Low';
  posture: string;
  status: 'due_now' | 'optimal' | 'ambulating' | 'overdue' | 'stable' | 'pre_alert' | 'elevated';
  statusLabel: string;
  peakPressure: number;
  pressureLabel: string;
  countdown: string;
  isOverdue?: boolean;
  offloadDuration?: string;
  sensorMini: number[][]; // 8x8 pressure values (0=low, 1=med, 2=warn, 3=crit)
  assignedRn: string;
  lastTurnTime: string;
}

export interface PiezoCell {
  id: string;
  num: number;
  zone: string;
  load: number;
  volt: string;
  snr: string;
  offset: string;
  impedance: string;
  status: 'nominal' | 'warn' | 'critical';
}

export interface ZoneTimer {
  name: string;
  elapsedMin: number;
  limitMin: number;
  isNearLimit?: boolean;
  isElevated?: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  bedUnit: string;
  patientId: string;
  patientName: string;
  zoneLocus: string;
  zoneCategory: 'Sacrum' | 'Trochanter' | 'Heels' | 'Occiput';
  peakMmHg: number;
  dwellMin: number;
  actionTaken: string;
  attendingRn: string;
  status: 'ACTIVE' | 'RESOLVED';
}
