import { randomUUID } from 'node:crypto';
import { AuditLog, Bed, MatState, PressureSample } from '../models';
import { CELL_ZONES } from '../data/cellLayout';
import { ApiError } from '../lib/errors';
import { getSettings } from '../lib/settings';
import {
  mmHgToLevel,
  categoryForCellZone,
  categoryForTimer,
  chunk8,
  timerForCell,
  ZONE_TIMER_NAMES,
  type Category,
} from '../lib/zones';
import { auditItem, zoneTimerView } from './derive';
import { hub } from './hub';

const MAX_GAP_MS = 60_000; // a gap longer than this only counts as one minute of time
const SAMPLE_EVERY_MS = 60_000; // pressure history resolution (one PressureSample per bed per minute)

export function defaultCells() {
  return CELL_ZONES.map((zone, i) => ({
    id: `PZ-${String(i + 1).padStart(2, '0')}`,
    num: i + 1,
    zone,
    load: 0,
    volt: '--',
    snr: '--',
    offset: '+0.00 mV',
    impedance: '--',
    status: 'nominal' as const,
  }));
}

export async function ensureMatState(bedId: string) {
  const existing = await MatState.findOne({ bedId });
  if (existing) return existing;
  return MatState.create({
    bedId,
    cells: defaultCells(),
    zoneTimers: [],
    matrix: Array(100).fill(0),
  });
}

type Pending = { category: Category; locus: string; peak: number; dwell: number };

/**
 * Takes one frame (one value 0..255 per mat cell, row-major) for a bed and updates everything that
 * depends on it. Assumes one writer per bed (one mat sends its own frames).
 */
export async function ingestFrame(
  bedId: string,
  raw: number[],
  at: Date = new Date(),
  format: 'raw' | 'json' = 'json',
) {
  if (raw.some((v) => !Number.isFinite(v) || v < 0 || v > 255)) {
    throw new ApiError(422, 'Frame values must be numbers between 0 and 255');
  }
  const [bed, settings] = await Promise.all([Bed.findOne({ id: bedId }), getSettings()]);
  if (!bed) throw new ApiError(404, `Unknown bed "${bedId}"`);
  const mat = await ensureMatState(bedId);
  // A frame of another size (e.g. 64 values from 8x8 firmware) would leave cells without a load.
  if (raw.length !== mat.cells.length) {
    throw new ApiError(422, `A frame for this mat must contain ${mat.cells.length} values, got ${raw.length}`);
  }
  const t = settings.telemetry;

  // 1. Subtract the tare baseline, then convert to pressure and level.
  const base = mat.baselineRaw.length === raw.length ? mat.baselineRaw : Array(raw.length).fill(0);
  const net = raw.map((v, i) => Math.max(0, v - base[i]));
  const loads = net.map((b) => b * t.mmHgPerByte);
  const levels = loads.map((p) => mmHgToLevel(p, t.levelMmHg)); // flat numbers

  // 2. Cell values and the peak.
  let peak = 0;
  let peakZone = '';
  const cells = mat.cells.map((c, i) => {
    if (loads[i] > peak) {
      peak = loads[i];
      peakZone = c.zone ?? '';
    }
    const status =
      loads[i] >= t.cellCriticalMmHg ? 'critical' : loads[i] >= t.cellWarnMmHg ? 'warn' : 'nominal';
    return { ...(c.toObject ? c.toObject() : c), load: Math.round(loads[i]), status };
  });

  // 3. Zone timers: grow while loaded, shrink faster while unloaded.
  const gapMs = mat.lastFrameAt ? at.getTime() - new Date(mat.lastFrameAt).getTime() : 0;
  const dtMin = Math.min(Math.max(gapMs, 0), MAX_GAP_MS) / 60000;
  const zoneIdx = new Map<string, number[]>();
  cells.forEach((c, i) => {
    const name = timerForCell(c.zone ?? '', c.num ?? i + 1);
    if (name) zoneIdx.set(name, [...(zoneIdx.get(name) ?? []), i]);
  });
  const zoneMax: Record<string, number> = {};
  const timers = ZONE_TIMER_NAMES.map((name) => {
    const prev = mat.zoneTimers.find((z) => z.name === name);
    const limitMin = settings.zoneLimitsMin[name] ?? 120;
    let elapsed = prev?.elapsedMin ?? 0;
    const idx = zoneIdx.get(name);
    if (idx?.length) {
      const zmax = Math.max(...idx.map((i) => loads[i]));
      zoneMax[name] = zmax;
      elapsed = zmax >= t.loadedMmHg ? elapsed + dtMin : Math.max(0, elapsed - dtMin * t.recoveryFactor);
    }
    return { name, elapsedMin: Math.round(elapsed * 1000) / 1000, limitMin };
  });

  // 4. Alerts: a zone past its time limit, or any single cell at or above the critical pressure.
  const pending = new Map<Category, Pending>();
  const add = (p: Pending) => {
    const cur = pending.get(p.category);
    if (!cur) pending.set(p.category, p);
    else pending.set(p.category, { ...cur, peak: Math.max(cur.peak, p.peak), dwell: Math.max(cur.dwell, p.dwell) });
  };
  for (const tm of timers) {
    const cat = categoryForTimer(tm.name);
    if (cat && tm.elapsedMin >= tm.limitMin) {
      add({ category: cat, locus: tm.name, peak: zoneMax[tm.name] ?? 0, dwell: tm.elapsedMin });
    }
  }
  cells.forEach((c, i) => {
    if (loads[i] >= settings.thresholds.criticalMmHg) {
      const cat = categoryForCellZone(c.zone ?? '');
      if (cat) add({ category: cat, locus: c.zone ?? cat, peak: loads[i], dwell: 0 });
    }
  });
  for (const p of pending.values()) await raiseAlert(bed, p, at);

  // 5. Pressure history: at most one sample per minute.
  const sampleDue = !mat.lastSampleAt || at.getTime() - new Date(mat.lastSampleAt).getTime() >= SAMPLE_EVERY_MS;
  if (sampleDue) {
    const loaded = loads.filter((l) => l >= t.loadedMmHg);
    await PressureSample.create({
      bedId,
      at,
      peakMmHg: Math.round(peak * 10) / 10,
      peakZone,
      meanLoadedMmHg: loaded.length ? Math.round((loaded.reduce((a, b) => a + b, 0) / loaded.length) * 10) / 10 : 0,
      loadedCells: loaded.length,
    });
  }

  // 6. Save and announce.
  // The same write hands over any queued device commands and clears them (new: false returns
  // the document as it was before this update), so a command is delivered exactly once.
  const before = await MatState.findOneAndUpdate(
    { bedId },
    {
      $set: {
        cells,
        matrix: levels,
        rawLast: raw,
        peakMmHg: Math.round(peak * 10) / 10,
        peakZone,
        zoneTimers: timers,
        lastFrameAt: at,
        lastFrameFormat: format,
        ...(sampleDue ? { lastSampleAt: at } : {}),
        pendingCommands: [],
      },
      $inc: { frames: 1 },
    },
    { new: false },
  );
  const commands: string[] = [...((before?.pendingCommands as string[] | undefined) ?? [])];
  hub.broadcast('frame', {
    bedId,
    at: at.toISOString(),
    matrix: chunk8(loads.map((l) => Math.round(l * 10) / 10)),
    peakMmHg: Math.round(peak * 10) / 10,
    peakZone,
    zoneTimers: timers.map((x) => zoneTimerView(x, settings)),
  });
  return { bedId, peakMmHg: Math.round(peak * 10) / 10, peakZone, alerts: pending.size, commands };
}

export type DeviceCommand = 'ack' | 'tare';

/** Queue a command for the mat. It is sent in the reply to the mat's next frame. */
export async function queueDeviceCommand(bedId: string, command: DeviceCommand) {
  await MatState.updateOne({ bedId }, { $addToSet: { pendingCommands: command } });
}

async function raiseAlert(bed: any, p: Pending, at: Date) {
  const active = await AuditLog.findOne({ bedId: bed.id, zoneCategory: p.category, status: 'ACTIVE' });
  const peak = Math.round(p.peak * 10) / 10;
  const dwell = Math.round(p.dwell);
  if (active) {
    // Only write when something meaningfully changed, so frames do not hammer the database.
    if (peak > active.peakMmHg! + 0.5 || dwell >= active.dwellMin! + 1) {
      await AuditLog.updateOne(
        { id: active.id },
        { $set: { peakMmHg: Math.max(peak, active.peakMmHg!), dwellMin: Math.max(dwell, active.dwellMin!) } },
      );
    }
    return;
  }
  const doc = await AuditLog.create({
    id: `log-${randomUUID().slice(0, 8)}`,
    at,
    bedId: bed.id,
    bedUnit: `${bed.bedNumber} [${bed.pod}]`,
    patientId: bed.patientId,
    patientName: bed.patientName,
    zoneLocus: p.locus,
    zoneCategory: p.category,
    peakMmHg: peak,
    dwellMin: dwell,
    actionTaken: 'Pending bedside assessment',
    attendingRn: bed.assignedRn,
    status: 'ACTIVE',
  });
  hub.broadcast('alert', auditItem(doc.toObject(), new Date()));
}
