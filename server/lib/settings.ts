import { z } from 'zod';
import { SettingModel } from '../models';
import { ApiError, parse } from './errors';

// IMPORTANT: every number below is a configurable DEFAULT, not a validated clinical value.
// Thresholds, cadence and zone limits must be set by clinical staff. The telemetry
// numbers (mmHgPerByte, level bytes, loaded threshold) are PLACEHOLDERS until the mat
// has been calibrated with known weights.
const thresholds = z.object({
  criticalMmHg: z.number().min(10).max(300),
  maxDwellMin: z.number().min(5).max(480),
  warnMmHg: z.number().min(5).max(300),
  autoPage: z.boolean(),
});
const protocol = z.object({
  cadenceMin: z.number().min(15).max(480),
  skinEnforce: z.boolean(),
  preAlertMin: z.number().min(1).max(60),
});
const telemetry = z.object({
  mmHgPerByte: z.number().positive().max(5),
  levelMmHg: z.tuple([z.number().min(0.1).max(300), z.number().min(0.1).max(300), z.number().min(0.1).max(300)]),
  loadedMmHg: z.number().min(1).max(300),
  recoveryFactor: z.number().min(0).max(20),
  nearLimitRatio: z.number().min(0.1).max(1),
  elevatedRatio: z.number().min(0.1).max(1),
  elevatedMmHg: z.number().min(1).max(300),
  staleSec: z.number().min(2).max(3600),
  cellWarnMmHg: z.number().min(1).max(300),
  cellCriticalMmHg: z.number().min(1).max(300),
});

export const settingsSchema = z
  .object({
    thresholds,
    protocol,
    zoneLimitsMin: z.record(z.number().min(5).max(600)),
    telemetry,
  })
  .refine((s) => s.thresholds.warnMmHg < s.thresholds.criticalMmHg, {
    message: 'warnMmHg must be lower than criticalMmHg',
    path: ['thresholds', 'warnMmHg'],
  })
  .refine((s) => s.telemetry.cellWarnMmHg < s.telemetry.cellCriticalMmHg, {
    message: 'cellWarnMmHg must be lower than cellCriticalMmHg',
    path: ['telemetry', 'cellWarnMmHg'],
  })
  .refine((s) => s.telemetry.levelMmHg[0] < s.telemetry.levelMmHg[1] && s.telemetry.levelMmHg[1] < s.telemetry.levelMmHg[2], {
    message: 'levelMmHg must be increasing',
    path: ['telemetry', 'levelMmHg'],
  });

export type Settings = z.infer<typeof settingsSchema>;

export const settingsPatchSchema = z.object({
  thresholds: thresholds.partial().optional(),
  protocol: protocol.partial().optional(),
  zoneLimitsMin: z.record(z.number().min(5).max(600)).optional(),
  telemetry: telemetry.partial().optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { criticalMmHg: 65, maxDwellMin: 60, warnMmHg: 45, autoPage: true },
  protocol: { cadenceMin: 120, skinEnforce: true, preAlertMin: 15 },
  zoneLimitsMin: {
    'SACRUM & COCCYX': 120,
    'HEELS (CALCANEUS)': 90,
    'LEFT TROCHANTER (HIP)': 120,
    'SHOULDERS (SCAPULAE)': 120,
    'RIGHT TROCHANTER (HIP)': 120,
    'ELBOWS & OCCIPUT': 120,
  },
  telemetry: {
    mmHgPerByte: 0.4, // PLACEHOLDER
    levelMmHg: [10, 25, 40], // PLACEHOLDER: pressure where heatmap level 1 (light), 2 (heavy), 3 (hot spot) start
    loadedMmHg: 20, // PLACEHOLDER: a zone at or above this counts as loaded
    recoveryFactor: 2, // unloaded time removes this many times its length from a zone timer
    nearLimitRatio: 0.85,
    elevatedRatio: 0.6,
    elevatedMmHg: 30,
    staleSec: 30, // mat data older than this is treated as offline
    cellWarnMmHg: 30, // sensor-map colour bands: above this a cell is "warn" (UI legend 31-50)
    cellCriticalMmHg: 50, // above this a cell is "critical"
  },
};

function merge(base: Settings, patch: any): Settings {
  return {
    thresholds: { ...base.thresholds, ...(patch?.thresholds ?? {}) },
    protocol: { ...base.protocol, ...(patch?.protocol ?? {}) },
    zoneLimitsMin: { ...base.zoneLimitsMin, ...(patch?.zoneLimitsMin ?? {}) },
    telemetry: { ...base.telemetry, ...(patch?.telemetry ?? {}) },
  };
}

export async function getSettings(): Promise<Settings> {
  const doc = await SettingModel.findOne({ key: 'ward' }).lean();
  return merge(DEFAULT_SETTINGS, (doc as any)?.value);
}

export async function updateSettings(patchInput: unknown): Promise<Settings> {
  const patch = parse(settingsPatchSchema, patchInput);
  const next = merge(await getSettings(), patch);
  const check = settingsSchema.safeParse(next);
  if (!check.success) {
    throw new ApiError(
      422,
      'Settings are inconsistent',
      check.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  await SettingModel.updateOne({ key: 'ward' }, { $set: { value: next } }, { upsert: true });
  return next;
}
