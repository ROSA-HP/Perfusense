import mongoose, { Schema } from 'mongoose';

// Removes Mongo's internal fields from JSON output.
const clean = {
  transform: (_doc: unknown, ret: any) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};
const opts = { timestamps: true, toJSON: clean };

// ---------------------------------------------------------------- beds ---
// Facts about a bed and its patient. Status, countdown and labels are NOT stored:
// they are derived from these facts and the live mat data (see services/derive.ts).
const bedSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    bedNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    patientId: { type: String, required: true },
    pod: { type: String, required: true },
    age: { type: Number, min: 0, max: 130 },
    bradenScore: { type: Number, required: true, min: 6, max: 23 },
    bradenRisk: { type: String, enum: ['Severe', 'High', 'Moderate', 'Low'], required: true },
    posture: { type: String, default: 'UNKNOWN' },
    pressureLabel: { type: String, default: 'PEAK LOAD' },
    peakPressure: { type: Number, default: 0 }, // fallback when the mat is silent
    offBedSince: { type: Date, default: null },
    assignedRn: { type: String, default: '' },
    lastTurnAt: { type: Date, default: null },
    nextTurnDueAt: { type: Date, default: null },
    snoozedUntil: { type: Date, default: null },
    deviceId: { type: String, default: '' }, // e.g. "mat01"
    sensorMini: { type: [Number], default: undefined }, // fallback 8x8 levels, stored flat (64 numbers)
  },
  opts,
);
export const Bed = mongoose.model('Bed', bedSchema);

// --------------------------------------------------------------- mats ---
const cellSchema = new Schema(
  {
    id: String,
    num: Number,
    zone: String,
    load: Number,
    volt: String,
    snr: String,
    offset: String,
    impedance: String,
    status: { type: String, enum: ['nominal', 'warn', 'critical'] },
  },
  { _id: false },
);
const timerSchema = new Schema(
  { name: String, elapsedMin: Number, limitMin: Number },
  { _id: false },
);

// Live state of one 64-cell mat. One document per bed, updated on every frame.
const matSchema = new Schema(
  {
    bedId: { type: String, required: true, unique: true },
    cells: [cellSchema],
    baselineRaw: { type: [Number], default: () => Array(64).fill(0) }, // set by "tare"
    rawLast: { type: [Number], default: () => Array(64).fill(0) },
    matrix: { type: [Number], default: undefined }, // 8x8 levels 0..3, stored flat (64 numbers)
    peakMmHg: { type: Number, default: 0 },
    peakZone: { type: String, default: '' },
    zoneTimers: [timerSchema],
    lastFrameAt: { type: Date, default: null },
    frames: { type: Number, default: 0 },
  },
  opts,
);
export const MatState = mongoose.model('MatState', matSchema);

// -------------------------------------------------------- audit alerts ---
const auditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    at: { type: Date, required: true, index: true },
    bedId: { type: String, required: true, index: true },
    bedUnit: String,
    patientId: String,
    patientName: String,
    zoneLocus: String,
    zoneCategory: { type: String, enum: ['Sacrum', 'Trochanter', 'Heels', 'Occiput'] },
    peakMmHg: Number,
    dwellMin: Number,
    actionTaken: String,
    attendingRn: String,
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: '' },
    reAlertAt: { type: Date, default: null },
  },
  opts,
);
export const AuditLog = mongoose.model('AuditLog', auditSchema);

// ------------------------------------------------------- bed events etc ---
const eventSchema = new Schema(
  {
    bedId: { type: String, required: true, index: true },
    at: { type: Date, required: true },
    kind: { type: String, enum: ['turn', 'defer', 'snooze', 'zone-reset'], required: true },
    posture: String,
    note: String,
    rn: String,
    skinChecks: [Boolean],
    minutes: Number,
    reason: String,
  },
  opts,
);
export const BedEvent = mongoose.model('BedEvent', eventSchema);

const hwLogSchema = new Schema(
  {
    bedId: { type: String, required: true, index: true },
    at: { type: Date, required: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: String,
  },
  opts,
);
export const HardwareLog = mongoose.model('HardwareLog', hwLogSchema);

const broadcastSchema = new Schema(
  { at: Date, pod: String, message: String, sentBy: String },
  opts,
);
export const Broadcast = mongoose.model('Broadcast', broadcastSchema);

const settingSchema = new Schema(
  { key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed },
  opts,
);
export const SettingModel = mongoose.model('Setting', settingSchema);
